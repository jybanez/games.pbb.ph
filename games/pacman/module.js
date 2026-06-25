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
    let powerTimer = 0;
    let patrolPhaseIndex = 0;
    let patrolPhaseTimer = PATROL_PHASES[0].duration;
    let respawnTimer = 0;
    let pulseTime = 0;
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
        patrolPhaseIndex = 0;
        patrolPhaseTimer = PATROL_PHASES[0].duration;
        respawnTimer = 0;
        pulseTime = 0;
        running = true;
        paused = false;
        done = false;
        supplies = createSupplyState();
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
        pulseTime += delta;
        if (respawnTimer > 0) {
            respawnTimer = Math.max(0, respawnTimer - delta);
            return;
        }
        if (powerTimer > 0) {
            powerTimer = Math.max(0, powerTimer - delta);
        }
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
        if (item.type === "power") {
            powerTimer = 7;
        }
        sound?.play?.("score", { volume: item.type === "power" ? 0.72 : 0.45 });
        syncScore();
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
        if (powerTimer > 0) {
            score += 100;
            hit.mode = "returning";
            hit.returnPath = buildReturnPath(hit.mover.getState(), hit.spawn);
            hit.reviveTimer = 0;
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
        sound?.play?.("error", { volume: 0.54 });
        if (lives <= 0) {
            done = true;
            running = false;
            syncScore();
            options.onStateChange?.("gameOver", { detail: `Score ${score}` });
            return;
        }
        respawnTimer = 1.2;
        resetPlayer();
        syncScore();
    }

    function winGame() {
        done = true;
        running = false;
        syncScore();
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
        ui.score.textContent = `Score ${score}  Lives ${lives}`;
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
        patrols.forEach((patrol) => drawPatrol(layout, patrol));
        drawPlayer(layout);
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
        const open = 0.22 + Math.abs(Math.sin(pulseTime * 10)) * 0.18;
        const direction = state.movingDirection || state.direction || "right";
        const angle = directionAngle(direction);

        ctx.save();
        ctx.fillStyle = powerTimer > 0 ? "#ffd166" : "#79d7ff";
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.arc(center.x, center.y, radius, angle + open, angle + Math.PI * 2 - open);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#06101d";
        ctx.beginPath();
        ctx.arc(center.x + Math.cos(angle - Math.PI / 2) * radius * 0.28, center.y + Math.sin(angle - Math.PI / 2) * radius * 0.28, Math.max(1.8, radius * 0.12), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawPatrol(layout, patrol) {
        const state = patrol.mover.getState();
        const center = worldToScreen(layout, state.x, state.y);
        const radius = layout.cellSize * 0.34;
        if (patrol.mode === "returning") {
            drawReturningPatrolEyes(center, radius, state);
            return;
        }
        ctx.save();
        ctx.fillStyle = powerTimer > 0 && patrol.mode === "frightened"
            ? "#8db5ff"
            : PATROL_COLORS[patrol.index % PATROL_COLORS.length];
        ctx.globalAlpha = patrol.mode === "reviving"
            ? 0.42 + Math.sin(pulseTime * 14) * 0.14
            : powerTimer > 0 && patrol.mode === "frightened"
                ? 0.78
                : 0.95;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, Math.PI, 0);
        ctx.lineTo(center.x + radius, center.y + radius * 0.55);
        for (let i = 2; i >= -2; i -= 1) {
            ctx.lineTo(center.x + i * radius * 0.24, center.y + radius * (i % 2 === 0 ? 0.32 : 0.58));
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#06101d";
        ctx.beginPath();
        ctx.arc(center.x - radius * 0.28, center.y - radius * 0.14, Math.max(1.5, radius * 0.12), 0, Math.PI * 2);
        ctx.arc(center.x + radius * 0.28, center.y - radius * 0.14, Math.max(1.5, radius * 0.12), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawReturningPatrolEyes(center, radius, state) {
        const direction = state.movingDirection || state.direction || "right";
        const vector = DIRECTIONS[direction] || DIRECTIONS.right;
        const eyeRadius = Math.max(2, radius * 0.28);
        const pupilRadius = Math.max(1, radius * 0.11);
        const pupilOffsetX = vector.column * radius * 0.12;
        const pupilOffsetY = vector.row * radius * 0.12;

        ctx.save();
        ctx.globalAlpha = 0.94;
        [-0.3, 0.3].forEach((offset) => {
            const x = center.x + radius * offset;
            const y = center.y - radius * 0.03;
            ctx.fillStyle = "#f8fbff";
            ctx.beginPath();
            ctx.arc(x, y, eyeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#1b4fd7";
            ctx.beginPath();
            ctx.arc(x + pupilOffsetX, y + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
            ctx.fill();
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

    function cellCenter(layout, cell) {
        return worldToScreen(layout, cell.column + 0.5, cell.row + 0.5);
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

function directionAngle(direction) {
    return {
        right: 0,
        down: Math.PI / 2,
        left: Math.PI,
        up: -Math.PI / 2,
    }[direction] ?? 0;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
