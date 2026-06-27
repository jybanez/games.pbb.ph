const DIRECTIONS = {
    up: { row: -1, column: 0 },
    down: { row: 1, column: 0 },
    left: { row: 0, column: -1 },
    right: { row: 0, column: 1 },
};

const OPPOSITE_DIRECTION = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
};

const PATROL_PHASES = [
    { mode: "scatter", duration: 5 },
    { mode: "chase", duration: 14 },
    { mode: "scatter", duration: 4 },
    { mode: "chase", duration: 18 },
];

const PATROL_LIMIT = 4;
const PATROL_COLORS = ["#ff7a90", "#ffb15f", "#7dd7ff", "#c18cff"];
const PATROL_SCATTER_TARGETS = [
    { row: 1, column: 17 },
    { row: 13, column: 1 },
    { row: 13, column: 17 },
    { row: 1, column: 1 },
];

const ROUTE_MILESTONES = [
    { progress: 0.25, title: "Route 25%", detail: "Keep supplies moving" },
    { progress: 0.5, title: "Route 50%", detail: "Half the route is clear" },
    { progress: 0.75, title: "Route 75%", detail: "Final supply lanes" },
];

const MAZE_MAP = [
    "###################",
    "#P......#.........#",
    "#.###.#.#.#.###.#.#",
    "#o#...#...#...#..o#",
    "#.#.#.#####.#.#.#.#",
    "#...#...#...#...#.#",
    "###.###.#.###.###.#",
    "#.....#...#.....#.#",
    "#.###.#GGG#.###.#.#",
    "#...#..BGD..#.....#",
    "###.#.#####.#.###.#",
    "#.....#...#.....#.#",
    "#.###...#.#.###.#.#",
    "#o....#...#....o..#",
    "###################",
];

const PATROL_BASE_TILES = new Set(["B", "D", "G"]);
const PATROL_BASE_CELLS = MAZE_MAP.flatMap((rowText, row) => [...rowText]
    .map((tile, column) => ({ row, column, tile }))
    .filter((cell) => PATROL_BASE_TILES.has(cell.tile)));

const TILE_DEFINITIONS = {
    "#": { type: "wall", enterable: false },
    ".": { type: "path", collectible: { type: "supply", value: 10 } },
    "o": { type: "path", collectible: { type: "power", value: 50 } },
    "P": { type: "path", point: "playerSpawn" },
    "G": { type: "path", point: "patrolSpawn" },
    "B": { type: "path" },
    "D": { type: "path" },
    " ": { type: "path" },
};

export async function mountGame(session, options = {}) {
    const { createGameLoop, createTouchControlPad } = options.helper["./ui.game.core.js"];
    const { createGridMaze, createGridMover, createGridPathfinder } = options.helper["./ui.game.grid.js"];
    const layer = session.addLayer({ id: "pacman-board", zIndex: 1, smoothing: true });
    const ctx = layer.context;
    const ui = createShell(session, options.game || { title: "Supply Run" });
    const sound = options.sound;

    const maze = createGridMaze({
        map: MAZE_MAP,
        tiles: TILE_DEFINITIONS,
        cellSize: 1,
    });
    const pathfinder = createGridPathfinder({
        rows: maze.rows,
        columns: maze.columns,
        canEnter: (row, column) => maze.canEnter(row, column),
    });
    const playerSpawn = maze.points.playerSpawn || { row: 1, column: 1 };
    const patrolSpawns = maze.getPoints("patrolSpawn");

    let player = null;
    let patrols = [];
    let supplies = new Map();
    let score = 0;
    let lives = 3;
    let totalSupplies = 0;
    let powerTimer = 0;
    let powerCatchStreak = 0;
    let powerWarningShown = false;
    let safetyTimer = 0;
    let patrolPhaseIndex = 0;
    let patrolPhaseTimer = PATROL_PHASES[0].duration;
    let respawnTimer = 0;
    let pulseTime = 0;
    let feedbacks = [];
    let banners = [];
    let bursts = [];
    let routeMilestoneIndex = -1;
    let lifeFlash = 0;
    let running = true;
    let paused = false;
    let done = false;
    let lastPlayerCell = "";

    const controls = createTouchControlPad(ui.movementControls, {
        visibility: "overlay",
        directions: ["up", "left", "right", "down"],
        repeat: true,
        repeatDelay: 110,
        labels: {
            up: "Move up",
            left: "Move left",
            right: "Move right",
            down: "Move down",
        },
        onDirection(vector, meta) {
            queuePlayerDirection(meta.direction);
        },
    });

    const resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(draw)
        : null;
    resizeObserver?.observe(session.viewport);

    const loop = createGameLoop({
        autoStart: false,
        update({ delta }) {
            pulseTime += delta;
            updateFeedback(delta);
            if (!running || paused || done) {
                return;
            }
            update(delta);
        },
        render() {
            draw();
        },
    });

    reset();
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", draw);
    session.viewport.style.touchAction = "none";

    return {
        start() {
            loop.start();
        },
        destroy() {
            loop.stop();
            controls.destroy();
            resizeObserver?.disconnect();
            window.removeEventListener("keydown", handleKeydown);
            window.removeEventListener("resize", draw);
            session.viewport.style.touchAction = "";
            ui.root.remove();
        },
        pause() {
            if (!done) {
                paused = true;
            }
        },
        resume() {
            if (!done) {
                paused = false;
            }
        },
        restart: reset,
    };

    function reset() {
        score = 0;
        lives = 3;
        powerTimer = 0;
        powerCatchStreak = 0;
        powerWarningShown = false;
        safetyTimer = 2.4;
        patrolPhaseIndex = 0;
        patrolPhaseTimer = PATROL_PHASES[0].duration;
        respawnTimer = 0;
        pulseTime = 0;
        feedbacks = [];
        banners = [];
        bursts = [];
        routeMilestoneIndex = -1;
        lifeFlash = 0;
        running = true;
        paused = false;
        done = false;
        supplies = createSupplyState();
        totalSupplies = countSupplyMarkers();
        resetActors();
        options.onStateChange?.("playing");
        syncScore();
        draw();
    }

    function resetActors() {
        resetPlayer();
        patrols = (patrolSpawns.length ? patrolSpawns : [{ row: 1, column: maze.columns - 2 }]).slice(0, PATROL_LIMIT).map((spawn, index) => {
            const mover = createGridMover({
                row: spawn.row,
                column: spawn.column,
                direction: index % 2 === 0 ? "left" : "right",
                speed: 3.25 + index * 0.16,
                cellSize: 1,
                canEnter: (row, column) => maze.canEnter(row, column),
            });
            mover.setDirection(index % 2 === 0 ? "left" : "right");
            return {
                id: `patrol-${index + 1}`,
                index,
                spawn: { row: spawn.row, column: spawn.column },
                mover,
                scatter: PATROL_SCATTER_TARGETS[index] || { row: 1, column: maze.columns - 2 },
                mode: "chase",
                returnPath: [],
                reviveTimer: 0,
            };
        });
    }

    function resetPlayer() {
        player = createGridMover({
            row: playerSpawn.row,
            column: playerSpawn.column,
            direction: "right",
            speed: 4.4,
            cellSize: 1,
            preTurnTolerance: 0.18,
            canEnter: (row, column) => maze.canEnter(row, column),
        });
        player.setDirection("right");
        lastPlayerCell = cellKey(playerSpawn);
    }

    function update(delta) {
        if (respawnTimer > 0) {
            respawnTimer = Math.max(0, respawnTimer - delta);
            return;
        }
        if (powerTimer > 0) {
            const previousPowerTimer = powerTimer;
            powerTimer = Math.max(0, powerTimer - delta);
            if (powerTimer <= 0) {
                powerCatchStreak = 0;
                powerWarningShown = false;
            } else if (!powerWarningShown && previousPowerTimer > 2 && powerTimer <= 2) {
                powerWarningShown = true;
                showBanner("Power Fading", "Avoid patrol contact", "#ffd166", 0.9);
            }
        }
        safetyTimer = Math.max(0, safetyTimer - delta);
        updatePatrolMode(delta);

        const playerState = player.update(delta);
        handleSupplyAt(playerState);

        patrols.forEach((patrol) => {
            updatePatrolIntent(patrol);
            patrol.mover.update(delta);
            updatePatrolReturnState(patrol, delta);
        });
        handlePatrolContacts();
    }

    function queuePlayerDirection(direction) {
        if (!direction || done || paused || respawnTimer > 0) {
            return;
        }
        player.queueDirection(direction);
    }

    function handleSupplyAt(playerState) {
        const key = cellKey(playerState);
        if (key === lastPlayerCell) {
            return;
        }
        lastPlayerCell = key;
        const item = supplies.get(key);
        if (!item) {
            return;
        }
        supplies.delete(key);
        score += item.value;
        addFeedback(`+${item.value}`, item, item.type === "power" ? "#fff1a8" : "#dfffea");
        addBurst(item, item.type === "power" ? "#ffd166" : "#54d3a5", item.type === "power" ? 18 : 10);
        if (item.type === "power") {
            powerTimer = 7;
            powerCatchStreak = 0;
            powerWarningShown = false;
            showBanner("Power Kit", "Patrols are vulnerable", "#ffd166", 1.05);
        }
        sound?.play?.("score", { volume: item.type === "power" ? 0.72 : 0.45 });
        syncScore();
        checkRouteMilestone();
        if (![...supplies.values()].some((supply) => supply.type === "supply")) {
            winGame();
        }
    }

    function updatePatrolIntent(patrol) {
        const state = patrol.mover.getState();
        if (patrol.mode === "reviving") {
            return;
        }
        if (patrol.mode === "returning" && sameCell(state, patrol.spawn)) {
            patrol.mode = "reviving";
            patrol.reviveTimer = 0.7;
            return;
        }
        if (state.target) {
            return;
        }
        if (patrol.mode === "returning") {
            queuePatrolReturnStep(patrol, state);
            return;
        }
        const nextMode = patrol.mode === "returning"
            ? "returning"
            : powerTimer > 0
                ? "frightened"
                : PATROL_PHASES[patrolPhaseIndex].mode;
        const modeChanged = patrol.mode !== nextMode;
        patrol.mode = nextMode;
        const playerState = player.getState();
        const target = patrol.mode === "returning"
            ? patrol.spawn
            : patrol.mode === "chase"
                ? getPatrolChaseTarget(patrol, playerState)
                : patrol.scatter;
        const next = pathfinder.nextStep(state, target);
        const direction = next ? directionBetween(state, next) : chooseFallbackDirection(state);
        const canReverse = modeChanged || patrol.mode === "returning";
        const allowedDirection = allowPatrolDirection(state, direction, canReverse)
            ? direction
            : chooseFallbackDirection(state, { avoidReverse: !canReverse });
        if (allowedDirection) {
            patrol.mover.queueDirection(allowedDirection);
        }
    }

    function queuePatrolReturnStep(patrol, state) {
        if (!Array.isArray(patrol.returnPath) || !patrol.returnPath.length || !areAdjacentCells(state, patrol.returnPath[0])) {
            patrol.returnPath = buildReturnPath(state, patrol.spawn);
        }
        const next = patrol.returnPath.shift();
        if (next) {
            if (!patrol.mover.moveTowardCell(next.row, next.column)) {
                patrol.returnPath = [];
            }
            return;
        }
        patrol.mover.moveTo(patrol.spawn.row, patrol.spawn.column);
        patrol.mode = "reviving";
        patrol.reviveTimer = 0.7;
    }

    function buildReturnPath(from, to) {
        return pathfinder.findPath(from, to).slice(1);
    }

    function updatePatrolReturnState(patrol, delta) {
        if (patrol.mode === "returning") {
            const state = patrol.mover.getState();
            if (!state.target && sameCell(state, patrol.spawn)) {
                patrol.mode = "reviving";
                patrol.returnPath = [];
                patrol.reviveTimer = 0.7;
            }
            return;
        }
        if (patrol.mode === "reviving") {
            patrol.reviveTimer = Math.max(0, patrol.reviveTimer - delta);
            if (patrol.reviveTimer <= 0) {
                patrol.mode = PATROL_PHASES[patrolPhaseIndex].mode;
            }
        }
    }

    function updatePatrolMode(delta) {
        if (powerTimer > 0) {
            return;
        }
        patrolPhaseTimer -= delta;
        while (patrolPhaseTimer <= 0) {
            patrolPhaseIndex = (patrolPhaseIndex + 1) % PATROL_PHASES.length;
            patrolPhaseTimer += PATROL_PHASES[patrolPhaseIndex].duration;
        }
    }

    function getPatrolChaseTarget(patrol, playerState) {
        if (patrol.index === 1) {
            const vector = DIRECTIONS[playerState.movingDirection || playerState.direction] || DIRECTIONS.right;
            const ambushTarget = {
                row: playerState.row + vector.row * 3,
                column: playerState.column + vector.column * 3,
            };
            if (maze.canEnter(ambushTarget.row, ambushTarget.column)) {
                return ambushTarget;
            }
        }
        if (patrol.index === 2) {
            return patrol.scatter;
        }
        if (patrol.index === 3) {
            const mirrorTarget = {
                row: maze.rows - 1 - playerState.row,
                column: maze.columns - 1 - playerState.column,
            };
            if (maze.canEnter(mirrorTarget.row, mirrorTarget.column)) {
                return mirrorTarget;
            }
        }
        return playerState;
    }

    function allowPatrolDirection(state, direction, canReverse) {
        return direction
            && (canReverse || direction !== OPPOSITE_DIRECTION[state.movingDirection || state.direction]);
    }

    function chooseFallbackDirection(state, options = {}) {
        const reverseDirection = OPPOSITE_DIRECTION[state.movingDirection || state.direction];
        return Object.keys(DIRECTIONS).find((direction) => {
            if (options.avoidReverse && direction === reverseDirection) {
                return false;
            }
            const vector = DIRECTIONS[direction];
            return maze.canEnter(state.row + vector.row, state.column + vector.column);
        }) || (options.avoidReverse ? chooseFallbackDirection(state) : "");
    }

    function handlePatrolContacts() {
        const playerState = player.getState();
        const hit = patrols.find((patrol) => isPatrolActiveForCollision(patrol) && sameCell(playerState, patrol.mover.getState()));
        if (!hit) {
            return;
        }
        if (safetyTimer > 0) {
            return;
        }
        if (powerTimer > 0) {
            powerCatchStreak += 1;
            const award = 100 * Math.min(powerCatchStreak, 4);
            score += award;
            hit.mode = "returning";
            hit.returnPath = buildReturnPath(hit.mover.getState(), hit.spawn);
            hit.reviveTimer = 0;
            addFeedback(`+${award}`, hit.mover.getState(), "#fff1a8");
            addBurst(hit.mover.getState(), "#ffd166", 18);
            showBanner("Patrol Rerouted", `+${award}`, "#ffd166", 0.74);
            sound?.play?.("score", { volume: 0.78 });
            syncScore();
            return;
        }
        loseLife();
    }

    function isPatrolActiveForCollision(patrol) {
        return patrol.mode !== "returning" && patrol.mode !== "reviving";
    }

    function loseLife() {
        lives -= 1;
        powerTimer = 0;
        powerCatchStreak = 0;
        powerWarningShown = false;
        lifeFlash = 0.68;
        addBurst(player.getState(), "#ff7a90", 24);
        sound?.play?.("error", { volume: 0.54 });
        if (lives <= 0) {
            done = true;
            running = false;
            syncScore();
            showBanner("Run Stopped", `Score ${score}`, "#ff9faf", 1.4);
            options.onStateChange?.("gameOver", { detail: `Score ${score}` });
            return;
        }
        respawnTimer = 1.2;
        safetyTimer = 1.8;
        resetPlayer();
        showBanner("Runner Reset", `${lives} lives left`, "#ffb15f", 0.95);
        syncScore();
    }

    function winGame() {
        done = true;
        running = false;
        syncScore();
        showBanner("Route Cleared", `Score ${score}`, "#54d3a5", 1.45);
        options.onStateChange?.("won", { title: "Route Cleared", detail: `Score ${score}` });
    }

    function handleKeydown(event) {
        if (event.key === "ArrowUp") queuePlayerDirection("up");
        if (event.key === "ArrowDown") queuePlayerDirection("down");
        if (event.key === "ArrowLeft") queuePlayerDirection("left");
        if (event.key === "ArrowRight") queuePlayerDirection("right");
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
        }
        if (event.key.toLowerCase() === "p") {
            event.preventDefault();
            options.requestPause?.();
        }
    }

    function createSupplyState() {
        return new Map(maze.collectibles.map((item) => [cellKey(item), {
            row: item.row,
            column: item.column,
            type: item.type,
            value: Number(item.value) || (item.type === "power" ? 50 : 10),
        }]));
    }

    function syncScore() {
        const progress = getRouteProgress();
        ui.score.textContent = `Score ${score}  Lives ${lives}  Route ${Math.round(progress * 100)}%`;
        options.onProgress?.({
            type: "progress:update",
            progress: {
                gameId: "pacman",
                mode: "supply-run",
                scheme: "challenge",
                level: 1,
                levelId: "central-route",
                levelName: "Central Route",
                difficulty: lives >= 3 ? "easy" : lives === 2 ? "normal" : "hard",
                objective: "Collect every supply marker and avoid patrol hazards",
                score,
                lives,
                progressCurrent: Math.round(progress * totalSupplies),
                progressTarget: totalSupplies,
                progressLabel: `Route ${Math.round(progress * 100)}%`,
            },
        });
    }

    function draw() {
        const layout = getLayout();
        ctx.clearRect(0, 0, layout.width, layout.height);
        ctx.fillStyle = "#06101d";
        ctx.fillRect(0, 0, layout.width, layout.height);
        drawBackdrop(layout);
        drawMaze(layout);
        drawPatrolBase(layout);
        drawSupplies(layout);
        drawRouteProgress(layout);
        drawBursts(layout);
        patrols.forEach((patrol) => drawPatrol(layout, patrol));
        drawDangerLinks(layout);
        drawPlayer(layout);
        drawFeedbacks(layout);
        drawBanners(layout);
        drawPowerAndLifeFlash(layout);
        if (respawnTimer > 0) {
            drawReadyPulse(layout);
        }
    }

    function getLayout() {
        const width = Math.max(240, layer.canvas.width || session.viewport.clientWidth || 360);
        const height = Math.max(320, layer.canvas.height || session.viewport.clientHeight || 640);
        const topReserve = clamp(height * 0.088, 48, 78);
        const bottomReserve = clamp(height * 0.19, 108, 158);
        const sideMargin = clamp(width * 0.04, 10, 32);
        const availableWidth = Math.max(120, width - sideMargin * 2);
        const availableHeight = Math.max(160, height - topReserve - bottomReserve);
        const cellSize = Math.floor(Math.max(8, Math.min(availableWidth / maze.columns, availableHeight / maze.rows)));
        const boardWidth = cellSize * maze.columns;
        const boardHeight = cellSize * maze.rows;
        return {
            width,
            height,
            cellSize,
            boardX: Math.round((width - boardWidth) / 2),
            boardY: Math.round(topReserve + (availableHeight - boardHeight) / 2),
            boardWidth,
            boardHeight,
        };
    }

    function drawBackdrop(layout) {
        ctx.save();
        ctx.globalAlpha = 0.26;
        ctx.strokeStyle = "#14213a";
        ctx.lineWidth = 1;
        const spacing = clamp(layout.cellSize * 2.2, 24, 48);
        for (let x = -spacing; x < layout.width + spacing; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + layout.height * 0.16, layout.height);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawMaze(layout) {
        ctx.save();
        ctx.fillStyle = "#081523";
        roundRect(layout.boardX - 4, layout.boardY - 4, layout.boardWidth + 8, layout.boardHeight + 8, 8);
        ctx.fill();
        maze.forEachCell((cell) => {
            const x = layout.boardX + cell.column * layout.cellSize;
            const y = layout.boardY + cell.row * layout.cellSize;
            if (cell.type === "wall") {
                ctx.fillStyle = "#173761";
                roundRect(x + 1, y + 1, layout.cellSize - 2, layout.cellSize - 2, Math.max(2, layout.cellSize * 0.22));
                ctx.fill();
                ctx.fillStyle = "rgba(121, 169, 255, .18)";
                ctx.fillRect(x + 2, y + 2, Math.max(1, layout.cellSize - 4), Math.max(1, layout.cellSize * 0.16));
                return;
            }
            ctx.fillStyle = "#07101d";
            ctx.fillRect(x, y, layout.cellSize, layout.cellSize);
        });
        ctx.restore();
    }

    function drawSupplies(layout) {
        const pulse = 1 + Math.sin(pulseTime * 5) * 0.08;
        supplies.forEach((item) => {
            const center = cellCenter(layout, item);
            ctx.save();
            ctx.fillStyle = item.type === "power" ? "#ffd166" : "#54d3a5";
            ctx.globalAlpha = item.type === "power" ? 0.96 : 0.82;
            ctx.beginPath();
            ctx.arc(center.x, center.y, layout.cellSize * (item.type === "power" ? 0.28 : 0.12) * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    function drawRouteProgress(layout) {
        const progress = getRouteProgress();
        const width = Math.min(layout.boardWidth * 0.72, layout.width * 0.54);
        const height = Math.max(5, Math.min(8, layout.cellSize * 0.24));
        const x = layout.boardX + (layout.boardWidth - width) / 2;
        const y = Math.max(42, layout.boardY - layout.cellSize * 0.7);

        ctx.save();
        ctx.fillStyle = "rgba(7, 16, 29, .72)";
        ctx.strokeStyle = "rgba(126, 155, 205, .28)";
        roundRect(x, y, width, height, height / 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = powerTimer > 0 ? "#ffd166" : "#54d3a5";
        ctx.shadowColor = powerTimer > 0 ? "#ffd166" : "#54d3a5";
        ctx.shadowBlur = 10;
        roundRect(x, y, Math.max(height, width * progress), height, height / 2);
        ctx.fill();
        ctx.restore();
    }

    function drawPatrolBase(layout) {
        if (!PATROL_BASE_CELLS.length) {
            return;
        }
        const minRow = Math.min(...PATROL_BASE_CELLS.map((cell) => cell.row));
        const maxRow = Math.max(...PATROL_BASE_CELLS.map((cell) => cell.row));
        const minColumn = Math.min(...PATROL_BASE_CELLS.map((cell) => cell.column));
        const maxColumn = Math.max(...PATROL_BASE_CELLS.map((cell) => cell.column));
        const inset = Math.max(2, layout.cellSize * 0.1);
        const x = layout.boardX + minColumn * layout.cellSize + inset;
        const y = layout.boardY + minRow * layout.cellSize + inset;
        const width = (maxColumn - minColumn + 1) * layout.cellSize - inset * 2;
        const height = (maxRow - minRow + 1) * layout.cellSize - inset * 2;

        ctx.save();
        ctx.fillStyle = "rgba(84, 211, 165, .045)";
        roundRect(x, y, width, height, Math.max(3, layout.cellSize * 0.16));
        ctx.fill();
        ctx.strokeStyle = "rgba(84, 211, 165, .58)";
        ctx.lineWidth = Math.max(1.25, layout.cellSize * 0.045);
        roundRect(x, y, width, height, Math.max(3, layout.cellSize * 0.16));
        ctx.stroke();

        PATROL_BASE_CELLS.forEach((cell) => {
            const cellX = layout.boardX + cell.column * layout.cellSize;
            const cellY = layout.boardY + cell.row * layout.cellSize;
            if (cell.tile === "D") {
                ctx.strokeStyle = "rgba(255, 209, 102, .86)";
                ctx.lineWidth = Math.max(2, layout.cellSize * 0.1);
                ctx.beginPath();
                ctx.moveTo(cellX + layout.cellSize * 0.16, cellY + layout.cellSize * 0.52);
                ctx.lineTo(cellX + layout.cellSize * 0.84, cellY + layout.cellSize * 0.52);
                ctx.stroke();
            }
        });
        ctx.restore();
    }

    function drawPlayer(layout) {
        const state = player.getState();
        const center = worldToScreen(layout, state.x, state.y);
        const radius = layout.cellSize * 0.36;
        const direction = state.movingDirection || state.direction || "right";
        const vector = DIRECTIONS[direction] || DIRECTIONS.right;
        const bob = Math.sin(pulseTime * 12) * layout.cellSize * 0.025;
        const bodyWidth = radius * 1.55;
        const bodyHeight = radius * 1.42;
        const bodyX = center.x - bodyWidth / 2;
        const bodyY = center.y - bodyHeight * 0.48 + bob;
        const glowColor = powerTimer > 0 ? "#ffd166" : safetyTimer > 0 ? "#54d3a5" : "#79d7ff";

        ctx.save();
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = powerTimer > 0 ? radius * 0.7 : safetyTimer > 0 ? radius * 0.56 : radius * 0.35;
        ctx.fillStyle = powerTimer > 0
            ? "rgba(255, 209, 102, .18)"
            : safetyTimer > 0
                ? "rgba(84, 211, 165, .16)"
                : "rgba(121, 215, 255, .14)";
        ctx.beginPath();
        ctx.arc(center.x, center.y + bob, radius * 1.18, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0, 0, 0, .28)";
        ctx.beginPath();
        ctx.ellipse(center.x, center.y + radius * 0.66, radius * 0.64, radius * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#177bd8";
        roundRect(bodyX, bodyY, bodyWidth, bodyHeight, Math.max(3, radius * 0.28));
        ctx.fill();
        ctx.fillStyle = "rgba(160, 225, 255, .28)";
        roundRect(bodyX + bodyWidth * 0.12, bodyY + bodyHeight * 0.08, bodyWidth * 0.76, bodyHeight * 0.2, Math.max(2, radius * 0.16));
        ctx.fill();

        ctx.fillStyle = "#0a1628";
        roundRect(
            bodyX + bodyWidth * 0.2,
            bodyY + bodyHeight * 0.3,
            bodyWidth * 0.6,
            bodyHeight * 0.42,
            Math.max(3, radius * 0.18),
        );
        ctx.fill();

        const eyeOffset = vector.column * radius * 0.07;
        ctx.fillStyle = powerTimer > 0 ? "#fff1a8" : safetyTimer > 0 ? "#dfffea" : "#8cf2ff";
        [-0.18, 0.18].forEach((offset) => {
            ctx.beginPath();
            ctx.ellipse(
                center.x + bodyWidth * offset + eyeOffset,
                bodyY + bodyHeight * 0.51,
                Math.max(1.8, radius * 0.1),
                Math.max(2.2, radius * 0.18),
                0,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        });

        ctx.fillStyle = "#42c7ff";
        ctx.beginPath();
        ctx.arc(center.x, bodyY - radius * 0.02, Math.max(2, radius * 0.16), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = powerTimer > 0 ? "#ffd166" : "#b9f7ff";
        ctx.beginPath();
        ctx.arc(center.x, bodyY - radius * 0.06, Math.max(1.5, radius * 0.09), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#125fa8";
        [-0.55, 0.55].forEach((offset) => {
            ctx.beginPath();
            ctx.arc(center.x + bodyWidth * offset, center.y + radius * 0.24 + bob, Math.max(2, radius * 0.2), 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.fillStyle = "#58b9ff";
        [-0.24, 0.24].forEach((offset) => {
            ctx.beginPath();
            ctx.arc(center.x + bodyWidth * offset, center.y + radius * 0.7 + bob, Math.max(1.8, radius * 0.16), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    function drawPatrol(layout, patrol) {
        const state = patrol.mover.getState();
        const center = worldToScreen(layout, state.x, state.y);
        const radius = layout.cellSize * 0.34;
        if (patrol.mode === "returning") {
            drawReturningPatrolDrone(center, radius, state);
            return;
        }
        const direction = state.movingDirection || state.direction || "right";
        const vector = DIRECTIONS[direction] || DIRECTIONS.right;
        const color = powerTimer > 0 && patrol.mode === "frightened"
            ? "#8db5ff"
            : PATROL_COLORS[patrol.index % PATROL_COLORS.length];
        const alpha = patrol.mode === "reviving"
            ? 0.42 + Math.sin(pulseTime * 14) * 0.14
            : powerTimer > 0 && patrol.mode === "frightened"
                ? 0.78
                : 0.95;
        const beamLength = radius * 1.35;
        const beamWidth = radius * 0.62;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = powerTimer > 0 && patrol.mode === "frightened"
            ? "rgba(141, 181, 255, .14)"
            : "rgba(255, 77, 109, .13)";
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(
            center.x + vector.column * beamLength - Math.abs(vector.row) * beamWidth,
            center.y + vector.row * beamLength - Math.abs(vector.column) * beamWidth,
        );
        ctx.lineTo(
            center.x + vector.column * beamLength + Math.abs(vector.row) * beamWidth,
            center.y + vector.row * beamLength + Math.abs(vector.column) * beamWidth,
        );
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "rgba(0, 0, 0, .3)";
        ctx.beginPath();
        ctx.ellipse(center.x, center.y + radius * 0.7, radius * 0.72, radius * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = color;
        ctx.shadowBlur = radius * 0.55;
        ctx.fillStyle = "#172136";
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, radius * 0.92, radius * 0.58, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.3, radius * 0.14);
        ctx.beginPath();
        ctx.ellipse(center.x, center.y - radius * 0.03, radius * 0.68, radius * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#233752";
        ctx.beginPath();
        ctx.arc(center.x, center.y - radius * 0.18, radius * 0.36, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = powerTimer > 0 && patrol.mode === "frightened" ? "#d9e7ff" : "#ff4d6d";
        [-0.62, 0, 0.62].forEach((offset, index) => {
            const blink = 0.76 + Math.sin(pulseTime * 10 + patrol.index + index) * 0.18;
            ctx.globalAlpha = alpha * blink;
            ctx.beginPath();
            ctx.arc(center.x + radius * offset, center.y + radius * 0.08, Math.max(1.4, radius * 0.12), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = alpha;

        ctx.strokeStyle = "rgba(120, 200, 255, .44)";
        ctx.lineWidth = Math.max(1, radius * 0.08);
        [-0.88, 0.88].forEach((offset) => {
            const rotorX = center.x + radius * offset;
            ctx.beginPath();
            ctx.arc(rotorX, center.y - radius * 0.03, radius * 0.24, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(rotorX - radius * 0.22, center.y - radius * 0.03);
            ctx.lineTo(rotorX + radius * 0.22, center.y - radius * 0.03);
            ctx.moveTo(rotorX, center.y - radius * 0.25);
            ctx.lineTo(rotorX, center.y + radius * 0.19);
            ctx.stroke();
        });

        ctx.fillStyle = "#9bdcff";
        ctx.beginPath();
        ctx.arc(center.x + vector.column * radius * 0.22, center.y + vector.row * radius * 0.16, Math.max(1.5, radius * 0.12), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawDangerLinks(layout) {
        if (!player || respawnTimer > 0) {
            return;
        }
        const playerState = player.getState();
        const playerCenter = worldToScreen(layout, playerState.x, playerState.y);
        patrols.forEach((patrol) => {
            if (!isPatrolActiveForCollision(patrol) || patrol.mode === "frightened") {
                return;
            }
            const patrolState = patrol.mover.getState();
            const distance = Math.abs(patrolState.row - playerState.row) + Math.abs(patrolState.column - playerState.column);
            if (distance > 3) {
                return;
            }
            const patrolCenter = worldToScreen(layout, patrolState.x, patrolState.y);
            const alpha = clamp((4 - distance) / 4, 0.18, 0.72);
            ctx.save();
            ctx.globalAlpha = alpha * (0.72 + Math.sin(pulseTime * 10) * 0.18);
            ctx.strokeStyle = "#ff7a90";
            ctx.lineWidth = Math.max(2, layout.cellSize * 0.07);
            ctx.setLineDash([Math.max(4, layout.cellSize * 0.24), Math.max(4, layout.cellSize * 0.18)]);
            ctx.beginPath();
            ctx.moveTo(playerCenter.x, playerCenter.y);
            ctx.lineTo(patrolCenter.x, patrolCenter.y);
            ctx.stroke();
            ctx.restore();
        });
    }

    function drawReturningPatrolDrone(center, radius, state) {
        const direction = state.movingDirection || state.direction || "right";
        const vector = DIRECTIONS[direction] || DIRECTIONS.right;
        const coreRadius = radius * 0.64;
        const pulse = 0.78 + Math.sin(pulseTime * 10) * 0.08;

        ctx.save();
        ctx.globalAlpha = 0.58;
        ctx.shadowColor = "rgba(140, 242, 255, .46)";
        ctx.shadowBlur = radius * 0.18;
        ctx.fillStyle = "rgba(178, 205, 220, .72)";
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, coreRadius * 0.58, coreRadius * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(64, 116, 166, .76)";
        ctx.lineWidth = Math.max(1, radius * 0.055);
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, coreRadius * 0.36, coreRadius * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(43, 84, 140, .82)";
        [-0.3, 0.3].forEach((offset, index) => {
            ctx.beginPath();
            ctx.arc(
                center.x + coreRadius * offset + vector.column * coreRadius * 0.07,
                center.y - coreRadius * 0.03 + vector.row * coreRadius * 0.07,
                Math.max(1, coreRadius * (index === 0 ? 0.08 : 0.1)) * pulse,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        });

        ctx.strokeStyle = "rgba(104, 150, 180, .42)";
        ctx.lineWidth = Math.max(1, radius * 0.04);
        [-0.72, 0.72].forEach((offset) => {
            ctx.beginPath();
            ctx.arc(center.x + coreRadius * offset, center.y, coreRadius * 0.12, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.restore();
    }

    function drawReadyPulse(layout) {
        const center = worldToScreen(layout, playerSpawn.column + 0.5, playerSpawn.row + 0.5);
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(pulseTime * 12) * 0.18;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(2, layout.cellSize * 0.08);
        ctx.beginPath();
        ctx.arc(center.x, center.y, layout.cellSize * 0.58, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function drawFeedbacks(layout) {
        feedbacks.forEach((feedback) => {
            const progress = clamp(feedback.age / feedback.duration, 0, 1);
            const center = worldToScreen(layout, feedback.column + 0.5, feedback.row + 0.5);
            ctx.save();
            ctx.globalAlpha = 1 - progress;
            ctx.fillStyle = feedback.color;
            ctx.shadowColor = feedback.color;
            ctx.shadowBlur = 16;
            ctx.font = `900 ${Math.max(14, Math.floor(layout.cellSize * 0.82))}px Segoe UI, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(feedback.text, center.x, center.y - layout.cellSize * (0.2 + progress * 1.25));
            ctx.restore();
        });
    }

    function drawBanners(layout) {
        banners.forEach((banner) => {
            const progress = clamp(banner.age / banner.duration, 0, 1);
            const fade = progress > 0.72 ? 1 - (progress - 0.72) / 0.28 : 1;
            const scale = 0.9 + Math.sin(progress * Math.PI) * 0.12;
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.translate(layout.width / 2, layout.boardY + layout.boardHeight * 0.34);
            ctx.scale(scale, scale);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = banner.color;
            ctx.shadowBlur = 24;
            ctx.fillStyle = "#f8fbff";
            ctx.font = `900 ${clamp(layout.width * 0.058, 28, 58)}px Segoe UI, sans-serif`;
            ctx.fillText(banner.title, 0, 0);
            ctx.shadowBlur = 12;
            ctx.fillStyle = banner.color;
            ctx.font = `800 ${clamp(layout.width * 0.026, 14, 24)}px Segoe UI, sans-serif`;
            ctx.fillText(banner.detail, 0, clamp(layout.height * 0.052, 34, 48));
            ctx.restore();
        });
    }

    function drawBursts(layout) {
        bursts.forEach((burst) => {
            const progress = clamp(burst.age / burst.duration, 0, 1);
            const center = worldToScreen(layout, burst.column + 0.5, burst.row + 0.5);
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            burst.particles.forEach((particle) => {
                const x = center.x + particle.dx * progress * layout.cellSize;
                const y = center.y + particle.dy * progress * layout.cellSize + progress * progress * layout.cellSize * 0.35;
                const size = Math.max(2, layout.cellSize * particle.size * (1 - progress * 0.35));
                ctx.globalAlpha = (1 - progress) * particle.alpha;
                ctx.fillStyle = burst.color;
                ctx.shadowColor = burst.color;
                ctx.shadowBlur = Math.max(6, layout.cellSize * 0.34);
                ctx.fillRect(x - size / 2, y - size / 2, size, size);
            });
            ctx.restore();
        });
    }

    function drawPowerAndLifeFlash(layout) {
        if (powerTimer > 0) {
            const powerAlpha = powerTimer < 2
                ? 0.1 + Math.sin(pulseTime * 18) * 0.08
                : 0.08;
            ctx.save();
            ctx.globalAlpha = Math.max(0, powerAlpha);
            ctx.strokeStyle = "#ffd166";
            ctx.lineWidth = Math.max(3, layout.cellSize * 0.14);
            ctx.strokeRect(layout.boardX + 2, layout.boardY + 2, layout.boardWidth - 4, layout.boardHeight - 4);
            ctx.restore();
        }
        if (lifeFlash > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(0.36, lifeFlash / 0.68 * 0.36);
            ctx.fillStyle = "#ff4d6d";
            ctx.fillRect(0, 0, layout.width, layout.height);
            ctx.restore();
        }
    }

    function cellCenter(layout, cell) {
        return worldToScreen(layout, cell.column + 0.5, cell.row + 0.5);
    }

    function updateFeedback(delta) {
        feedbacks = feedbacks
            .map((feedback) => ({ ...feedback, age: feedback.age + delta }))
            .filter((feedback) => feedback.age < feedback.duration);
        banners = banners
            .map((banner) => ({ ...banner, age: banner.age + delta }))
            .filter((banner) => banner.age < banner.duration);
        bursts = bursts
            .map((burst) => ({ ...burst, age: burst.age + delta }))
            .filter((burst) => burst.age < burst.duration);
        lifeFlash = Math.max(0, lifeFlash - delta);
    }

    function addFeedback(text, cell, color) {
        feedbacks.push({
            text,
            row: cell.row,
            column: cell.column,
            color,
            age: 0,
            duration: 0.86,
        });
    }

    function addBurst(cell, color, count) {
        bursts.push({
            row: cell.row,
            column: cell.column,
            color,
            age: 0,
            duration: 0.58,
            particles: Array.from({ length: count }, () => {
                const angle = Math.random() * Math.PI * 2;
                const distance = 0.45 + Math.random() * 0.72;
                return {
                    dx: Math.cos(angle) * distance,
                    dy: Math.sin(angle) * distance,
                    size: 0.06 + Math.random() * 0.08,
                    alpha: 0.58 + Math.random() * 0.38,
                };
            }),
        });
    }

    function showBanner(title, detail, color = "#79d7ff", duration = 1) {
        banners.push({ title, detail, color, age: 0, duration });
    }

    function checkRouteMilestone() {
        const progress = getRouteProgress();
        const nextIndex = ROUTE_MILESTONES.findIndex((milestone, index) => index > routeMilestoneIndex && progress >= milestone.progress);
        if (nextIndex === -1) {
            return;
        }
        routeMilestoneIndex = nextIndex;
        const milestone = ROUTE_MILESTONES[nextIndex];
        showBanner(milestone.title, milestone.detail, "#79d7ff", 1.05);
        sound?.play?.("select", { volume: 0.42 });
    }

    function getRouteProgress() {
        if (!totalSupplies) {
            return 0;
        }
        const remaining = countSupplyMarkers();
        return clamp((totalSupplies - remaining) / totalSupplies, 0, 1);
    }

    function countSupplyMarkers() {
        return [...supplies.values()].filter((item) => item.type === "supply").length;
    }

    function worldToScreen(layout, x, y) {
        return {
            x: layout.boardX + x * layout.cellSize,
            y: layout.boardY + y * layout.cellSize,
        };
    }

    function roundRect(x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

function createShell(session, game) {
    const root = document.createElement("div");
    root.className = "pbb-game-session-ui pbb-pacman-session-ui";

    const hud = document.createElement("div");
    hud.className = "pbb-game-session-hud";

    const title = document.createElement("p");
    title.className = "pbb-game-session-title";
    title.textContent = game.title;

    const score = document.createElement("p");
    score.className = "ui-badge pbb-game-session-score";
    score.textContent = "Score 0  Lives 3";

    const movementControls = document.createElement("div");
    movementControls.className = "pbb-game-session-movement-controls";

    hud.appendChild(title);
    root.append(hud, score, movementControls);
    session.overlay.appendChild(root);

    return { root, score, movementControls };
}

function cellKey(cell) {
    return `${cell.row}:${cell.column}`;
}

function sameCell(a, b) {
    return a.row === b.row && a.column === b.column;
}

function areAdjacentCells(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 1;
}

function directionBetween(from, to) {
    const rowDelta = to.row - from.row;
    const columnDelta = to.column - from.column;
    return Object.entries(DIRECTIONS).find(([, vector]) => vector.row === rowDelta && vector.column === columnDelta)?.[0] || "";
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
