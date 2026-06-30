const BOARD_COLUMNS = 7;
const BOARD_ROWS = 7;
const TILE_GAP_RATIO = 0.11;
const MATCH_SETTLE_SECONDS = 0.18;
const CLEAR_SECONDS = 0.24;
const DROP_SECONDS = 0.24;

const TILE_DEFINITIONS = {
    water: { label: "Water", short: "Water", symbol: "droplet", color: "#56d6ff", accent: "#c9f4ff" },
    medical: { label: "Medical", short: "Medical", symbol: "cross", color: "#68e6a2", accent: "#dfffea" },
    power: { label: "Power", short: "Power", symbol: "bolt", color: "#ffd166", accent: "#fff1b8" },
    comms: { label: "Comms", short: "Comms", symbol: "signal", color: "#b58cff", accent: "#eadcff" },
    shelter: { label: "Shelter", short: "Shelter", symbol: "shelter", color: "#57d9e6", accent: "#d8fbff" },
    food: { label: "Food", short: "Food", symbol: "bowl", color: "#ffad5f", accent: "#ffe0bd" },
};

const LEVEL_DEFINITIONS = [
    {
        id: "supply-sort",
        level: 1,
        title: "Supply Sort",
        moves: 18,
        tileTypes: ["water", "medical", "power", "comms", "shelter"],
        objectives: [
            { type: "collect", tile: "water", count: 10 },
            { type: "score", value: 600 },
        ],
        specialTiles: { lineClear: false, burst: false },
    },
    {
        id: "kit-check",
        level: 2,
        title: "Kit Check",
        moves: 20,
        tileTypes: ["water", "medical", "power", "comms", "shelter"],
        objectives: [
            { type: "collect", tile: "medical", count: 8 },
            { type: "collect", tile: "power", count: 8 },
            { type: "score", value: 950 },
        ],
        specialTiles: { lineClear: false, burst: false },
    },
    {
        id: "lane-clear",
        level: 3,
        title: "Lane Clear",
        moves: 21,
        tileTypes: ["water", "medical", "power", "comms", "shelter", "food"],
        objectives: [
            { type: "collect", tile: "comms", count: 10 },
            { type: "score", value: 1300 },
        ],
        specialTiles: { lineClear: true, burst: false },
    },
    {
        id: "supply-burst",
        level: 4,
        title: "Supply Burst",
        moves: 22,
        tileTypes: ["water", "medical", "power", "comms", "shelter", "food"],
        objectives: [
            { type: "collect", tile: "shelter", count: 10 },
            { type: "collect", tile: "food", count: 7 },
            { type: "score", value: 1700 },
        ],
        specialTiles: { lineClear: true, burst: true },
    },
    {
        id: "route-ready",
        level: 5,
        title: "Route Ready",
        moves: 24,
        tileTypes: ["water", "medical", "power", "comms", "shelter", "food"],
        objectives: [
            { type: "collect", tile: "water", count: 12 },
            { type: "collect", tile: "comms", count: 10 },
            { type: "score", value: 2200 },
        ],
        specialTiles: { lineClear: true, burst: true },
    },
];

export function mountGame(session, options = {}) {
    const { createGameLoop } = options.helper["./ui.game.core.js"];
    const effectModule = options.helper["./ui.game.effects.js"] || {};
    const createGameEffectTimeline = effectModule.createGameEffectTimeline;
    const effects = typeof createGameEffectTimeline === "function"
        ? createGameEffectTimeline({ defaultDuration: 360, defaultEasing: "outCubic", reducedMotion: "respect", idPrefix: "shuffle" })
        : createFallbackTimeline();
    const layer = session.addLayer({ id: "supply-shuffle-board", zIndex: 1, smoothing: true });
    const ctx = layer.context;
    const ui = createShell(session, options.game || { title: "Supply Shuffle" });
    const sound = options.sound;

    let levelIndex = 0;
    let level = LEVEL_DEFINITIONS[levelIndex];
    let board = [];
    let score = 0;
    let moves = 0;
    let collectProgress = {};
    let selected = null;
    let pointerStart = null;
    let pulseTime = 0;
    let resolving = false;
    let paused = false;
    let done = false;
    let statusBanner = null;
    let invalidSwap = null;
    let lastLayout = null;
    let inputActive = false;
    let runToken = 0;
    let destroyed = false;

    const loop = createGameLoop({
        autoStart: false,
        update({ delta }) {
            if (paused) {
                return;
            }
            pulseTime += delta;
            effects.update(delta * 1000);
            updateTileAnimation(delta);
            updateBanner(delta);
        },
        render() {
            draw();
        },
    });

    const resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(draw)
        : null;
    resizeObserver?.observe(session.viewport);
    session.viewport.style.touchAction = "none";
    session.viewport.addEventListener("pointerdown", handlePointerDown);
    session.viewport.addEventListener("pointerup", handlePointerUp);
    session.viewport.addEventListener("pointercancel", clearPointer);
    window.addEventListener("resize", draw);

    reset();
    if (isDebugEnabled()) {
        exposeDebugHooks();
    }

    return {
        start() {
            inputActive = true;
            loop.start();
        },
        destroy() {
            destroyed = true;
            advanceRunToken();
            loop.stop();
            effects.destroy?.();
            resizeObserver?.disconnect();
            session.viewport.style.touchAction = "";
            session.viewport.removeEventListener("pointerdown", handlePointerDown);
            session.viewport.removeEventListener("pointerup", handlePointerUp);
            session.viewport.removeEventListener("pointercancel", clearPointer);
            window.removeEventListener("resize", draw);
            if (window.__PBB_SUPPLY_SHUFFLE_DEBUG__?.session === session) {
                delete window.__PBB_SUPPLY_SHUFFLE_DEBUG__;
            }
            ui.root.remove();
        },
        pause() {
            if (!done) {
                inputActive = false;
                paused = true;
                effects.pause?.();
            }
        },
        resume() {
            if (!done) {
                inputActive = true;
                paused = false;
                effects.resume?.();
            }
        },
        restart() {
            inputActive = true;
            advanceRunToken();
            reset();
        },
    };

    function reset() {
        levelIndex = 0;
        score = 0;
        startLevel(0, { keepScore: true, announce: false });
    }

    function startLevel(nextLevelIndex, { keepScore = true, announce = true } = {}) {
        advanceRunToken();
        levelIndex = Math.min(nextLevelIndex, LEVEL_DEFINITIONS.length - 1);
        level = LEVEL_DEFINITIONS[levelIndex];
        if (!keepScore) {
            score = 0;
        }
        moves = level.moves;
        collectProgress = {};
        selected = null;
        pointerStart = null;
        resolving = false;
        paused = false;
        done = false;
        invalidSwap = null;
        statusBanner = announce
            ? createBanner(`Level ${level.level}`, level.title, "#ffd166", 1.15)
            : null;
        effects.clear();
        board = createInitialBoard(level);
        ensurePlayableBoard();
        options.onStateChange?.("playing");
        syncHud();
        draw();
    }

    function advanceRunToken() {
        runToken += 1;
        return runToken;
    }

    function isRunCurrent(token) {
        return !destroyed && token === runToken;
    }

    function delayWhileActive(seconds, token) {
        const targetMs = Math.max(0, seconds * 1000);
        if (!isRunCurrent(token)) {
            return Promise.resolve(false);
        }
        if (targetMs === 0) {
            return Promise.resolve(true);
        }
        return new Promise((resolve) => {
            let elapsed = 0;
            let last = performance.now();
            const step = () => {
                if (!isRunCurrent(token)) {
                    resolve(false);
                    return;
                }
                const now = performance.now();
                if (!paused) {
                    elapsed += now - last;
                }
                last = now;
                if (elapsed >= targetMs) {
                    resolve(isRunCurrent(token));
                    return;
                }
                window.setTimeout(step, 32);
            };
            window.setTimeout(step, 32);
        });
    }

    function handlePointerDown(event) {
        if (!inputActive || paused || done || resolving || !isPrimaryPointer(event)) {
            return;
        }
        const cell = getCellFromPointer(event);
        if (!cell) {
            selected = null;
            return;
        }
        pointerStart = {
            ...cell,
            x: event.clientX,
            y: event.clientY,
            previousSelected: selected && !sameCell(selected, cell) ? { ...selected } : null,
        };
        selected = cell;
        session.viewport.setPointerCapture?.(event.pointerId);
        draw();
    }

    function handlePointerUp(event) {
        if (!inputActive || paused || done || resolving || !isPrimaryPointer(event)) {
            return;
        }
        const target = getCellFromPointer(event);
        const start = pointerStart;
        clearPointer(event);
        if (!start) {
            return;
        }
        const drag = {
            x: event.clientX - start.x,
            y: event.clientY - start.y,
        };
        const layout = lastLayout || getLayout();
        const dragDistance = Math.hypot(drag.x, drag.y);
        if (dragDistance > layout.cellSize * 0.34) {
            const adjacent = Math.abs(drag.x) >= Math.abs(drag.y)
                ? { row: start.row, column: start.column + Math.sign(drag.x) }
                : { row: start.row + Math.sign(drag.y), column: start.column };
            attemptSwap(start, adjacent);
            return;
        }
        if (target && start.previousSelected && areAdjacent(start.previousSelected, target)) {
            attemptSwap(start.previousSelected, target);
            return;
        }
        if (target && selected && sameCell(start, target)) {
            selected = start;
            draw();
            return;
        }
        if (target && selected && areAdjacent(selected, target)) {
            attemptSwap(selected, target);
            return;
        }
        selected = target || null;
        draw();
    }

    function clearPointer(event = null) {
        if (event?.pointerId != null) {
            session.viewport.releasePointerCapture?.(event.pointerId);
        }
        pointerStart = null;
    }

    async function attemptSwap(a, b) {
        if (!isValidCell(a) || !isValidCell(b) || !areAdjacent(a, b)) {
            markInvalid(a);
            return false;
        }
        if (resolving || paused || done) {
            return false;
        }

        const token = runToken;
        selected = null;
        resolving = true;
        swapTiles(a, b);
        markTilesForSwap(a, b);
        effects.spawn({ type: "swap", duration: MATCH_SETTLE_SECONDS * 1000, payload: { cells: [a, b] } });
        if (!await delayWhileActive(MATCH_SETTLE_SECONDS, token)) {
            return false;
        }

        const activated = getActivatedSpecialCells(a, b);
        const groups = findMatches();
        if (!activated.length && !groups.length) {
            swapTiles(a, b);
            markTilesForSwap(a, b);
            invalidSwap = { cells: [a, b], age: 0, duration: 0.36 };
            sound?.play?.("error", { volume: 0.34 });
            if (!await delayWhileActive(0.22, token)) {
                return false;
            }
            resolving = false;
            draw();
            return false;
        }

        moves = Math.max(0, moves - 1);
        sound?.play?.("move", { volume: 0.36 });
        if (!await resolveBoard({ initialGroups: groups, activated, token })) {
            return false;
        }
        resolving = false;
        if (!findValidSwap() && moves > 0 && !objectivesMet()) {
            repairPlayableBoard();
        }
        checkLevelState();
        syncHud();
        draw();
        return true;
    }

    async function resolveBoard({ initialGroups = null, activated = [], token = runToken } = {}) {
        let cascade = 1;
        let groups = initialGroups || findMatches();
        let activeSpecials = activated;
        while ((groups.length || activeSpecials.length) && !done && isRunCurrent(token)) {
            const clearResult = buildClearSet(groups, activeSpecials);
            const specialPlan = chooseSpecialCreation(groups, clearResult.cells);
            const award = scoreClear(clearResult.cells.size, cascade);
            score += award;
            updateObjectives(clearResult.cells);
            spawnClearEffects(clearResult.cells, award, cascade, clearResult.color);
            sound?.play?.("score", { volume: Math.min(0.72, 0.34 + cascade * 0.08) });
            if (!await delayWhileActive(CLEAR_SECONDS, token)) {
                return false;
            }
            clearCells(clearResult.cells, specialPlan);
            applyGravity();
            syncHud();
            if (!await delayWhileActive(DROP_SECONDS, token)) {
                return false;
            }
            cascade += 1;
            groups = findMatches();
            activeSpecials = [];
        }
        return isRunCurrent(token);
    }

    function buildClearSet(groups, activeSpecials = []) {
        const cells = new Map();
        let color = "#7cf0c4";
        groups.forEach((group) => {
            group.cells.forEach((cell) => {
                cells.set(cellKey(cell), cell);
                color = TILE_DEFINITIONS[getTile(cell)?.type]?.color || color;
            });
        });
        activeSpecials.forEach((cell) => {
            const tile = getTile(cell);
            if (!tile) {
                return;
            }
            color = TILE_DEFINITIONS[tile.type]?.color || color;
            if (tile.special === "line") {
                for (let index = 0; index < BOARD_COLUMNS; index += 1) {
                    cells.set(cellKey({ row: cell.row, column: index }), { row: cell.row, column: index });
                }
                for (let index = 0; index < BOARD_ROWS; index += 1) {
                    cells.set(cellKey({ row: index, column: cell.column }), { row: index, column: cell.column });
                }
            } else if (tile.special === "burst") {
                for (let row = cell.row - 1; row <= cell.row + 1; row += 1) {
                    for (let column = cell.column - 1; column <= cell.column + 1; column += 1) {
                        if (isValidCell({ row, column })) {
                            cells.set(cellKey({ row, column }), { row, column });
                        }
                    }
                }
                board.flat().forEach((candidate) => {
                    if (candidate?.type === tile.type && Math.random() < 0.28) {
                        cells.set(cellKey(candidate), { row: candidate.row, column: candidate.column });
                    }
                });
            }
        });
        return { cells, color };
    }

    function chooseSpecialCreation(groups, clearedCells) {
        const ordered = [...groups]
            .filter((group) => group.cells.length >= 4)
            .sort((a, b) => b.cells.length - a.cells.length);
        if (!ordered.length) {
            return null;
        }
        const group = ordered[0];
        const type = group.cells.length >= 5 && level.specialTiles.burst
            ? "burst"
            : level.specialTiles.lineClear
                ? "line"
                : null;
        if (!type) {
            return null;
        }
        const source = group.cells.find((cell) => !clearedCells.has(cellKey(cell))) || group.cells[Math.floor(group.cells.length / 2)];
        return {
            row: source.row,
            column: source.column,
            tileType: getTile(source)?.type || group.tileType,
            special: type,
        };
    }

    function clearCells(cells, specialPlan = null) {
        cells.forEach((cell) => {
            board[cell.row][cell.column] = null;
        });
        if (specialPlan) {
            board[specialPlan.row][specialPlan.column] = createTile(specialPlan.tileType, specialPlan.row, specialPlan.column, specialPlan.special);
        }
    }

    function applyGravity() {
        for (let column = 0; column < BOARD_COLUMNS; column += 1) {
            const survivors = [];
            for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
                const tile = board[row][column];
                if (tile) {
                    survivors.push(tile);
                }
            }
            for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
                const tile = survivors.shift() || createTile(randomTileType(level), row, column);
                const previousY = tile.y ?? row;
                tile.row = row;
                tile.column = column;
                tile.targetX = column;
                tile.targetY = row;
                tile.y = previousY < row ? previousY : row - 1.2 - Math.random() * 1.8;
                tile.x = column;
                tile.clearing = false;
                board[row][column] = tile;
            }
        }
        effects.spawn({ type: "cascade", duration: DROP_SECONDS * 1000, payload: {} });
    }

    function scoreClear(count, cascade) {
        const base = count >= 5 ? 100 : count >= 4 ? 60 : 30;
        return Math.round(base * Math.max(1, count - 2) * Math.min(3, cascade));
    }

    function updateObjectives(cells) {
        cells.forEach((cell) => {
            const tile = getTile(cell);
            if (!tile) {
                return;
            }
            collectProgress[tile.type] = (collectProgress[tile.type] || 0) + 1;
        });
    }

    function checkLevelState() {
        if (objectivesMet()) {
            completeLevel();
            return;
        }
        if (moves <= 0) {
            done = true;
            options.onStateChange?.("gameOver", { detail: `Score ${score}` });
        }
    }

    async function completeLevel() {
        const token = runToken;
        const bonus = moves * 35 + level.level * 100;
        score += bonus;
        syncHud();
        statusBanner = createBanner(levelIndex >= LEVEL_DEFINITIONS.length - 1 ? "Shuffle Complete" : "Level Clear", `+${bonus} move bonus`, "#ffd166", 1.6);
        effects.spawn({ type: "levelClear", duration: 1200, payload: { bonus } });
        sound?.play?.("score", { volume: 0.78 });
        if (levelIndex >= LEVEL_DEFINITIONS.length - 1) {
            done = true;
            options.onStateChange?.("won", { detail: `Score ${score}` });
            return;
        }
        resolving = true;
        if (!await delayWhileActive(1.3, token)) {
            return;
        }
        if (!done && isRunCurrent(token)) {
            startLevel(levelIndex + 1, { keepScore: true, announce: true });
        }
    }

    function objectivesMet() {
        return level.objectives.every((objective) => {
            if (objective.type === "score") {
                return score >= objective.value;
            }
            return (collectProgress[objective.tile] || 0) >= objective.count;
        });
    }

    function findMatches() {
        const groups = [];
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            let run = [];
            let runType = "";
            for (let column = 0; column <= BOARD_COLUMNS; column += 1) {
                const tile = column < BOARD_COLUMNS ? board[row][column] : null;
                if (tile && run.length && tile.type === runType) {
                    run.push({ row, column });
                    continue;
                }
                if (run.length >= 3) {
                    groups.push({ axis: "row", tileType: runType, cells: run });
                }
                run = tile ? [{ row, column }] : [];
                runType = tile?.type || "";
            }
        }
        for (let column = 0; column < BOARD_COLUMNS; column += 1) {
            let run = [];
            let runType = "";
            for (let row = 0; row <= BOARD_ROWS; row += 1) {
                const tile = row < BOARD_ROWS ? board[row][column] : null;
                if (tile && run.length && tile.type === runType) {
                    run.push({ row, column });
                    continue;
                }
                if (run.length >= 3) {
                    groups.push({ axis: "column", tileType: runType, cells: run });
                }
                run = tile ? [{ row, column }] : [];
                runType = tile?.type || "";
            }
        }
        return groups;
    }

    function getActivatedSpecialCells(a, b) {
        return [a, b].filter((cell) => {
            const tile = getTile(cell);
            return tile?.special === "line" || tile?.special === "burst";
        });
    }

    function swapTiles(a, b) {
        const first = getTile(a);
        const second = getTile(b);
        board[a.row][a.column] = second;
        board[b.row][b.column] = first;
        if (first) {
            first.row = b.row;
            first.column = b.column;
            first.targetX = b.column;
            first.targetY = b.row;
        }
        if (second) {
            second.row = a.row;
            second.column = a.column;
            second.targetX = a.column;
            second.targetY = a.row;
        }
    }

    function markTilesForSwap(a, b) {
        [getTile(a), getTile(b)].forEach((tile) => {
            if (tile) {
                tile.x = tile.column;
                tile.y = tile.row;
                tile.pulse = 0.28;
            }
        });
    }

    function updateTileAnimation(delta) {
        if (invalidSwap) {
            invalidSwap.age += delta;
            if (invalidSwap.age >= invalidSwap.duration) {
                invalidSwap = null;
            }
        }
        board.flat().forEach((tile) => {
            if (!tile) {
                return;
            }
            tile.x += (tile.targetX - tile.x) * Math.min(1, delta * 16);
            tile.y += (tile.targetY - tile.y) * Math.min(1, delta * 16);
            tile.pulse = Math.max(0, tile.pulse - delta);
        });
    }

    function updateBanner(delta) {
        if (!statusBanner) {
            return;
        }
        statusBanner.age += delta;
        if (statusBanner.age >= statusBanner.duration) {
            statusBanner = null;
        }
    }

    function spawnClearEffects(cells, award, cascade, color) {
        const layout = getLayout();
        const cellArray = [...cells.values()];
        cellArray.forEach((cell, index) => {
            const center = cellCenter(layout, cell);
            effects.spawn({
                type: "matchBurst",
                duration: CLEAR_SECONDS * 1000 + index * 12,
                payload: { x: center.x, y: center.y, color, size: layout.cellSize },
            });
        });
        const anchor = cellCenter(layout, cellArray[Math.floor(cellArray.length / 2)] || { row: 3, column: 3 });
        effects.spawn({
            type: "scoreText",
            duration: 820,
            payload: {
                x: anchor.x,
                y: anchor.y,
                text: cascade > 1 ? `+${award} x${Math.min(3, cascade)}` : `+${award}`,
                color,
            },
        });
    }

    function markInvalid(cell) {
        if (!cell || !isValidCell(cell)) {
            return;
        }
        invalidSwap = { cells: [cell], age: 0, duration: 0.32 };
        sound?.play?.("error", { volume: 0.28 });
        draw();
    }

    function syncHud() {
        const collectText = level.objectives
            .filter((objective) => objective.type === "collect")
            .map((objective) => `${TILE_DEFINITIONS[objective.tile].label} ${Math.min(objective.count, collectProgress[objective.tile] || 0)}/${objective.count}`)
            .join("  ");
        const scoreObjective = level.objectives.find((objective) => objective.type === "score");
        const scoreText = scoreObjective ? `Target ${Math.min(scoreObjective.value, score)}/${scoreObjective.value}` : "";
        ui.score.textContent = `Score ${score}  Lv ${level.level}  Moves ${moves}`;
        ui.objectives.textContent = [collectText, scoreText].filter(Boolean).join("  |  ");
        options.onProgress?.({
            type: "progress:update",
            progress: {
                gameId: "supply-shuffle",
                scheme: "levels",
                level: level.level,
                levelId: level.id,
                levelName: level.title,
                objective: "Match supply tiles and complete the level targets",
                score,
                moves,
                progressCurrent: level.objectives.filter((objective) => objective.type === "collect").reduce((total, objective) => total + Math.min(objective.count, collectProgress[objective.tile] || 0), 0),
                progressTarget: level.objectives.filter((objective) => objective.type === "collect").reduce((total, objective) => total + objective.count, 0),
                progressLabel: ui.objectives.textContent,
            },
        });
    }

    function draw() {
        const layout = getLayout();
        lastLayout = layout;
        ctx.clearRect(0, 0, layout.width, layout.height);
        drawBackdrop(layout);
        drawBoardFrame(layout);
        drawTiles(layout);
        drawSelection(layout);
        drawTimelineEffects(layout);
        drawObjectives(layout);
        drawBanner(layout);
    }

    function getLayout() {
        const width = Math.max(260, layer.canvas.width || session.viewport.clientWidth || 390);
        const height = Math.max(360, layer.canvas.height || session.viewport.clientHeight || 720);
        const portrait = height >= width;
        const topReserve = clamp(height * (portrait ? 0.15 : 0.12), 70, portrait ? 122 : 92);
        const bottomReserve = clamp(height * (portrait ? 0.22 : 0.17), portrait ? 130 : 86, portrait ? 190 : 126);
        const sideMargin = clamp(width * 0.055, 14, 44);
        const availableWidth = width - sideMargin * 2;
        const availableHeight = height - topReserve - bottomReserve;
        const boardSize = Math.floor(Math.max(190, Math.min(availableWidth, availableHeight)));
        const boardX = Math.round((width - boardSize) / 2);
        const boardY = Math.round(topReserve + Math.max(0, (availableHeight - boardSize) * 0.45));
        const cellSize = boardSize / BOARD_COLUMNS;
        return { width, height, portrait, boardX, boardY, boardSize, cellSize };
    }

    function drawBackdrop(layout) {
        const gradient = ctx.createLinearGradient(0, 0, 0, layout.height);
        gradient.addColorStop(0, "#071625");
        gradient.addColorStop(0.58, "#0b1d2d");
        gradient.addColorStop(1, "#08101d");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, layout.width, layout.height);

        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = "#54d3a5";
        ctx.lineWidth = 1;
        const spacing = clamp(layout.cellSize * 1.2, 28, 56);
        for (let y = layout.height * 0.12; y < layout.height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(layout.width * 0.06, y);
            ctx.bezierCurveTo(layout.width * 0.3, y + 10, layout.width * 0.7, y - 10, layout.width * 0.94, y + 4);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawBoardFrame(layout) {
        ctx.save();
        ctx.fillStyle = "rgba(5, 13, 24, .72)";
        roundRect(layout.boardX - 9, layout.boardY - 9, layout.boardSize + 18, layout.boardSize + 18, 18);
        ctx.fill();
        ctx.strokeStyle = "rgba(126, 215, 195, .35)";
        ctx.lineWidth = 2;
        roundRect(layout.boardX - 8, layout.boardY - 8, layout.boardSize + 16, layout.boardSize + 16, 18);
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, .035)";
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let column = 0; column < BOARD_COLUMNS; column += 1) {
                const x = layout.boardX + column * layout.cellSize;
                const y = layout.boardY + row * layout.cellSize;
                const inset = layout.cellSize * TILE_GAP_RATIO;
                roundRect(x + inset, y + inset, layout.cellSize - inset * 2, layout.cellSize - inset * 2, Math.max(6, layout.cellSize * 0.18));
                ctx.fill();
            }
        }
        ctx.restore();
    }

    function drawTiles(layout) {
        board.flat().forEach((tile) => {
            if (!tile) {
                return;
            }
            drawTile(layout, tile);
        });
    }

    function drawTile(layout, tile) {
        const definition = TILE_DEFINITIONS[tile.type];
        const inset = layout.cellSize * TILE_GAP_RATIO;
        const x = layout.boardX + tile.x * layout.cellSize + inset;
        const y = layout.boardY + tile.y * layout.cellSize + inset;
        const size = layout.cellSize - inset * 2;
        const pulse = tile.pulse > 0 ? Math.sin(tile.pulse * Math.PI * 8) * 0.04 : 0;
        const invalid = invalidSwap?.cells?.some((cell) => cell.row === tile.row && cell.column === tile.column);
        const invalidWobble = invalidSwap && invalid
            ? Math.sin((invalidSwap.age / invalidSwap.duration) * Math.PI * 4) * layout.cellSize * 0.08
            : 0;

        ctx.save();
        ctx.translate(x + size / 2 + invalidWobble, y + size / 2);
        ctx.scale(1 + pulse, 1 + pulse);
        ctx.shadowColor = definition.color;
        ctx.shadowBlur = invalid ? 18 : Math.max(3, layout.cellSize * 0.09);
        ctx.fillStyle = hexToRgba(definition.color, 0.28);
        roundRect(-size / 2, -size / 2, size, size, Math.max(7, size * 0.22));
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = hexToRgba(definition.color, invalid ? 0.9 : 0.52);
        ctx.lineWidth = Math.max(1.4, size * 0.035);
        ctx.stroke();

        drawTileSymbol(definition.symbol, size * 0.82, definition.color, definition.accent);

        if (tile.special) {
            drawSpecialMark(tile.special, size, definition.accent);
        }
        ctx.restore();
    }

    function drawTileSymbol(symbol, size, color, accent) {
        const ink = color;
        const shade = "rgba(248, 251, 255, .66)";
        const light = accent || "rgba(255, 255, 255, .58)";
        ctx.save();
        ctx.shadowColor = shade;
        ctx.shadowBlur = Math.max(4, size * 0.08);
        ctx.fillStyle = ink;
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(3, size * 0.085);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (symbol === "droplet") {
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.3);
            ctx.bezierCurveTo(size * 0.24, -size * 0.06, size * 0.29, size * 0.1, size * 0.29, size * 0.2);
            ctx.bezierCurveTo(size * 0.29, size * 0.42, size * 0.12, size * 0.54, 0, size * 0.54);
            ctx.bezierCurveTo(-size * 0.12, size * 0.54, -size * 0.29, size * 0.42, -size * 0.29, size * 0.2);
            ctx.bezierCurveTo(-size * 0.29, size * 0.1, -size * 0.24, -size * 0.06, 0, -size * 0.3);
            ctx.fill();
            ctx.fillStyle = light;
            ctx.beginPath();
            ctx.ellipse(-size * 0.08, size * 0.08, size * 0.07, size * 0.13, -0.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (symbol === "cross") {
            const arm = size * 0.16;
            const long = size * 0.43;
            roundRect(-arm, -long, arm * 2, long * 2, arm * 0.34);
            ctx.fill();
            roundRect(-long, -arm, long * 2, arm * 2, arm * 0.34);
            ctx.fill();
        } else if (symbol === "bolt") {
            ctx.beginPath();
            ctx.moveTo(size * 0.08, -size * 0.45);
            ctx.lineTo(-size * 0.26, size * 0.05);
            ctx.lineTo(-size * 0.02, size * 0.05);
            ctx.lineTo(-size * 0.12, size * 0.45);
            ctx.lineTo(size * 0.28, -size * 0.12);
            ctx.lineTo(size * 0.04, -size * 0.12);
            ctx.closePath();
            ctx.fill();
        } else if (symbol === "signal") {
            ctx.fillStyle = ink;
            ctx.beginPath();
            ctx.arc(0, size * 0.22, size * 0.08, 0, Math.PI * 2);
            ctx.fill();
            for (let index = 0; index < 3; index += 1) {
                const radius = size * (0.18 + index * 0.15);
                ctx.beginPath();
                ctx.arc(0, size * 0.22, radius, Math.PI * 1.12, Math.PI * 1.88);
                ctx.stroke();
            }
        } else if (symbol === "shelter") {
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.44);
            ctx.lineTo(size * 0.38, -size * 0.12);
            ctx.lineTo(size * 0.3, size * 0.4);
            ctx.lineTo(-size * 0.3, size * 0.4);
            ctx.lineTo(-size * 0.38, -size * 0.12);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "rgba(248, 251, 255, .68)";
            roundRect(-size * 0.11, size * 0.06, size * 0.22, size * 0.34, size * 0.04);
            ctx.fill();
        } else if (symbol === "bowl") {
            ctx.beginPath();
            ctx.moveTo(-size * 0.38, -size * 0.04);
            ctx.quadraticCurveTo(0, size * 0.5, size * 0.38, -size * 0.04);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = ink;
            ctx.lineWidth = Math.max(3, size * 0.075);
            ctx.beginPath();
            ctx.moveTo(-size * 0.32, -size * 0.08);
            ctx.lineTo(size * 0.32, -size * 0.08);
            ctx.stroke();
            ctx.fillStyle = light;
            ctx.beginPath();
            ctx.arc(-size * 0.1, size * 0.12, size * 0.055, 0, Math.PI * 2);
            ctx.arc(size * 0.09, size * 0.1, size * 0.045, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawSpecialMark(special, size, color) {
        ctx.save();
        const badgeX = size * 0.26;
        const badgeY = size * 0.28;
        const badgeSize = Math.max(13, size * 0.26);
        ctx.globalAlpha = 0.98;
        ctx.fillStyle = "rgba(7, 16, 29, .9)";
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, size * 0.035);
        roundRect(badgeX - badgeSize / 2, badgeY - badgeSize / 2, badgeSize, badgeSize, badgeSize * 0.25);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(2, badgeSize * 0.16);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (special === "line") {
            ctx.beginPath();
            ctx.moveTo(badgeX - badgeSize * 0.26, badgeY - badgeSize * 0.12);
            ctx.lineTo(badgeX + badgeSize * 0.26, badgeY - badgeSize * 0.12);
            ctx.moveTo(badgeX - badgeSize * 0.26, badgeY + badgeSize * 0.12);
            ctx.lineTo(badgeX + badgeSize * 0.26, badgeY + badgeSize * 0.12);
            ctx.stroke();
        } else {
            ctx.beginPath();
            for (let index = 0; index < 6; index += 1) {
                const angle = -Math.PI / 2 + index * Math.PI / 3;
                const radius = index % 2 === 0 ? badgeSize * 0.34 : badgeSize * 0.15;
                const x = badgeX + Math.cos(angle) * radius;
                const y = badgeY + Math.sin(angle) * radius;
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    function drawSelection(layout) {
        if (!selected || !isValidCell(selected)) {
            return;
        }
        const x = layout.boardX + selected.column * layout.cellSize + layout.cellSize * 0.08;
        const y = layout.boardY + selected.row * layout.cellSize + layout.cellSize * 0.08;
        const size = layout.cellSize * 0.84;
        ctx.save();
        ctx.globalAlpha = 0.78 + Math.sin(pulseTime * 8) * 0.18;
        ctx.strokeStyle = "#f8fbff";
        ctx.lineWidth = Math.max(2, layout.cellSize * 0.06);
        roundRect(x, y, size, size, Math.max(8, size * 0.22));
        ctx.stroke();
        ctx.restore();
    }

    function drawTimelineEffects(layout) {
        effects.forEach((effect) => {
            if (!effect.active) {
                return;
            }
            if (effect.type === "matchBurst") {
                drawMatchBurst(effect, layout);
            }
            if (effect.type === "scoreText") {
                drawScoreText(effect);
            }
            if (effect.type === "levelClear") {
                drawLevelClearWave(effect, layout);
            }
        });
    }

    function drawMatchBurst(effect) {
        const payload = effect.payload || {};
        const progress = effect.eased ?? effect.progress;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = (1 - progress) * 0.85;
        ctx.strokeStyle = payload.color || "#7cf0c4";
        ctx.lineWidth = Math.max(2, payload.size * 0.06);
        ctx.shadowColor = payload.color || "#7cf0c4";
        ctx.shadowBlur = Math.max(12, payload.size * 0.45);
        ctx.beginPath();
        ctx.arc(payload.x, payload.y, payload.size * (0.22 + progress * 0.56), 0, Math.PI * 2);
        ctx.stroke();
        for (let index = 0; index < 8; index += 1) {
            const angle = (Math.PI * 2 * index) / 8;
            const distance = payload.size * (0.16 + progress * 0.5);
            const x = payload.x + Math.cos(angle) * distance;
            const y = payload.y + Math.sin(angle) * distance;
            const size = Math.max(2, payload.size * 0.08 * (1 - progress * 0.32));
            ctx.fillStyle = payload.color || "#7cf0c4";
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
        ctx.restore();
    }

    function drawScoreText(effect) {
        const payload = effect.payload || {};
        const progress = effect.progress;
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.fillStyle = "#f8fbff";
        ctx.strokeStyle = "rgba(7, 16, 29, .86)";
        ctx.lineWidth = 4;
        ctx.shadowColor = payload.color || "#ffd166";
        ctx.shadowBlur = 18;
        ctx.font = "900 20px Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const y = payload.y - progress * 38;
        ctx.strokeText(payload.text || "+0", payload.x, y);
        ctx.fillText(payload.text || "+0", payload.x, y);
        ctx.restore();
    }

    function drawLevelClearWave(effect, layout) {
        const progress = effect.progress;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = (1 - progress) * 0.52;
        ctx.strokeStyle = "#ffd166";
        ctx.lineWidth = Math.max(3, layout.cellSize * 0.08);
        ctx.shadowColor = "#ffd166";
        ctx.shadowBlur = 28;
        ctx.beginPath();
        ctx.arc(layout.boardX + layout.boardSize / 2, layout.boardY + layout.boardSize / 2, layout.boardSize * (0.12 + progress * 0.72), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function drawObjectives(layout) {
        const panelY = layout.boardY + layout.boardSize + clamp(layout.height * 0.028, 14, 24);
        const panelHeight = clamp(layout.height * 0.1, 64, 92);
        const panelX = clamp(layout.width * 0.06, 16, 42);
        const panelWidth = layout.width - panelX * 2;
        ctx.save();
        ctx.fillStyle = "rgba(7, 16, 29, .58)";
        ctx.strokeStyle = "rgba(126, 155, 205, .22)";
        ctx.lineWidth = 1;
        roundRect(panelX, panelY, panelWidth, panelHeight, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#b8d8ff";
        ctx.font = `800 ${clamp(layout.width * 0.032, 12, 15)}px Segoe UI, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(level.title, panelX + 14, panelY + 10);

        const objectiveY = panelY + 34;
        let x = panelX + 14;
        level.objectives.forEach((objective) => {
            const label = objective.type === "score"
                ? `Score ${Math.min(score, objective.value)}/${objective.value}`
                : `${TILE_DEFINITIONS[objective.tile].label} ${Math.min(objective.count, collectProgress[objective.tile] || 0)}/${objective.count}`;
            const textWidth = ctx.measureText(label).width + 20;
            const fill = objective.type === "score" ? "#ffd166" : TILE_DEFINITIONS[objective.tile].color;
            ctx.fillStyle = "rgba(248, 251, 255, .08)";
            roundRect(x, objectiveY, textWidth, 28, 14);
            ctx.fill();
            ctx.fillStyle = fill;
            ctx.font = `800 ${clamp(layout.width * 0.03, 11, 14)}px Segoe UI, sans-serif`;
            ctx.fillText(label, x + 10, objectiveY + 7);
            x += textWidth + 8;
        });
        ctx.restore();
    }

    function drawBanner(layout) {
        if (!statusBanner) {
            return;
        }
        const progress = clamp(statusBanner.age / statusBanner.duration, 0, 1);
        const fade = progress > 0.74 ? 1 - clamp((progress - 0.74) / 0.26, 0, 1) : 1;
        const scale = 0.9 + Math.sin(progress * Math.PI) * 0.12;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(layout.width / 2, layout.boardY + layout.boardSize * 0.36);
        ctx.scale(scale, scale);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = statusBanner.color;
        ctx.shadowBlur = 24;
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(7, 16, 29, .9)";
        ctx.fillStyle = "#f8fbff";
        ctx.font = `900 ${clamp(layout.width * 0.078, 28, 48)}px Segoe UI, sans-serif`;
        ctx.strokeText(statusBanner.title, 0, 0);
        ctx.fillText(statusBanner.title, 0, 0);
        ctx.fillStyle = statusBanner.color;
        ctx.font = `800 ${clamp(layout.width * 0.038, 14, 20)}px Segoe UI, sans-serif`;
        ctx.strokeText(statusBanner.detail, 0, 38);
        ctx.fillText(statusBanner.detail, 0, 38);
        ctx.restore();
    }

    function getCellFromPointer(event) {
        const layout = lastLayout || getLayout();
        const rect = session.viewport.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * layout.width;
        const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * layout.height;
        const column = Math.floor((x - layout.boardX) / layout.cellSize);
        const row = Math.floor((y - layout.boardY) / layout.cellSize);
        return isValidCell({ row, column }) ? { row, column } : null;
    }

    function createInitialBoard(currentLevel) {
        const result = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLUMNS).fill(null));
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let column = 0; column < BOARD_COLUMNS; column += 1) {
                let type = randomTileType(currentLevel);
                let guard = 0;
                while (wouldCreateImmediateMatch(result, row, column, type) && guard < 30) {
                    type = randomTileType(currentLevel);
                    guard += 1;
                }
                result[row][column] = createTile(type, row, column);
            }
        }
        return result;
    }

    function ensurePlayableBoard() {
        for (let attempt = 0; attempt < 16; attempt += 1) {
            if (!findMatches().length && findValidSwap()) {
                return;
            }
            board = createInitialBoard(level);
        }
        board = createGuaranteedBoard(level);
    }

    function repairPlayableBoard() {
        board = createInitialBoard(level);
        ensurePlayableBoard();
        selected = null;
        invalidSwap = null;
        statusBanner = createBanner("Reshuffle", "New supply route", "#79d7ff", 0.95);
        effects.spawn({ type: "levelClear", duration: 620, payload: { bonus: 0 } });
        draw();
    }

    function createGuaranteedBoard(currentLevel) {
        const types = currentLevel.tileTypes.length >= 5
            ? currentLevel.tileTypes
            : ["water", "medical", "power", "comms", "shelter"];
        const result = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLUMNS).fill(null));
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let column = 0; column < BOARD_COLUMNS; column += 1) {
                result[row][column] = createTile(types[(row * 2 + column * 3) % types.length], row, column);
            }
        }
        seedGuaranteedMove(currentLevel, result);
        return result;
    }

    function seedGuaranteedMove(currentLevel, targetBoard = board) {
        const primary = currentLevel.tileTypes[0] || "water";
        const secondary = currentLevel.tileTypes.find((type) => type !== primary) || "medical";
        [
            { row: 0, column: 0, type: primary },
            { row: 0, column: 1, type: secondary },
            { row: 0, column: 2, type: primary },
            { row: 1, column: 1, type: primary },
        ].forEach((cell) => {
            targetBoard[cell.row][cell.column] = createTile(cell.type, cell.row, cell.column);
        });
    }

    function wouldCreateImmediateMatch(currentBoard, row, column, type) {
        const leftOne = currentBoard[row]?.[column - 1]?.type;
        const leftTwo = currentBoard[row]?.[column - 2]?.type;
        const upOne = currentBoard[row - 1]?.[column]?.type;
        const upTwo = currentBoard[row - 2]?.[column]?.type;
        return (leftOne === type && leftTwo === type) || (upOne === type && upTwo === type);
    }

    function createTile(type, row, column, special = null) {
        return {
            id: `${type}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            type,
            special,
            row,
            column,
            x: column,
            y: row,
            targetX: column,
            targetY: row,
            pulse: 0,
        };
    }

    function exposeDebugHooks() {
        window.__PBB_SUPPLY_SHUFFLE_DEBUG__ = {
            session,
            getState: () => ({
                level: level.level,
                score,
                moves,
                board: board.map((row) => row.map((tile) => ({ type: tile.type, special: tile.special }))),
                objectivesMet: objectivesMet(),
                resolving,
                done,
            }),
            findValidSwap: () => findValidSwap(),
            swap: async (a, b) => attemptSwap(a, b),
            forceLevelClear: () => {
                level.objectives.forEach((objective) => {
                    if (objective.type === "collect") {
                        collectProgress[objective.tile] = objective.count;
                    }
                    if (objective.type === "score") {
                        score = Math.max(score, objective.value);
                    }
                });
                completeLevel();
            },
            forceGameOver: () => {
                moves = 0;
                done = true;
                syncHud();
                options.onStateChange?.("gameOver", { detail: `Score ${score}` });
            },
            forceSpecial: (special = "line") => {
                const cell = { row: Math.floor(BOARD_ROWS / 2), column: Math.floor(BOARD_COLUMNS / 2) };
                const tile = getTile(cell);
                if (!tile) {
                    return false;
                }
                tile.special = special === "burst" ? "burst" : "line";
                tile.pulse = 0.4;
                draw();
                return true;
            },
        };
    }

    function isDebugEnabled() {
        try {
            return new URLSearchParams(window.location.search).get("debugGame") === "supply-shuffle";
        } catch {
            return false;
        }
    }

    function findValidSwap() {
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let column = 0; column < BOARD_COLUMNS; column += 1) {
                const cell = { row, column };
                for (const next of [{ row, column: column + 1 }, { row: row + 1, column }]) {
                    if (!isValidCell(next)) {
                        continue;
                    }
                    swapTiles(cell, next);
                    const valid = findMatches().length > 0;
                    swapTiles(cell, next);
                    if (valid) {
                        return { a: cell, b: next };
                    }
                }
            }
        }
        return null;
    }

    function getTile(cell) {
        return isValidCell(cell) ? board[cell.row][cell.column] : null;
    }

    function hexToRgba(hex, alpha) {
        const value = hex.replace("#", "");
        const red = parseInt(value.slice(0, 2), 16);
        const green = parseInt(value.slice(2, 4), 16);
        const blue = parseInt(value.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    function roundRect(x, y, width, height, radius) {
        const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
            ctx.roundRect(x, y, width, height, r);
            return;
        }
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
    root.className = "pbb-game-session-ui pbb-supply-shuffle-session-ui";

    const hud = document.createElement("div");
    hud.className = "pbb-game-session-hud";

    const title = document.createElement("p");
    title.className = "pbb-game-session-title";
    title.textContent = game.title;

    const score = document.createElement("p");
    score.className = "ui-badge pbb-game-session-score";
    score.style.setProperty("position", "absolute", "important");
    score.style.setProperty("left", "50%", "important");
    score.style.setProperty("top", "54px", "important");
    score.style.setProperty("transform", "translateX(-50%)", "important");
    score.textContent = "Score 0  Lv 1  Moves 0";

    const objectives = document.createElement("p");
    objectives.hidden = true;
    objectives.textContent = "";

    hud.appendChild(title);
    root.append(hud, score);
    session.overlay.appendChild(root);

    return { root, score, objectives };
}

function randomTileType(level) {
    return level.tileTypes[Math.floor(Math.random() * level.tileTypes.length)] || "water";
}

function cellKey(cell) {
    return `${cell.row}:${cell.column}`;
}

function sameCell(a, b) {
    return a?.row === b?.row && a?.column === b?.column;
}

function areAdjacent(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 1;
}

function isValidCell(cell) {
    return cell
        && Number.isInteger(cell.row)
        && Number.isInteger(cell.column)
        && cell.row >= 0
        && cell.column >= 0
        && cell.row < BOARD_ROWS
        && cell.column < BOARD_COLUMNS;
}

function isPrimaryPointer(event) {
    return event.isPrimary !== false;
}

function cellCenter(layout, cell) {
    return {
        x: layout.boardX + (cell.column + 0.5) * layout.cellSize,
        y: layout.boardY + (cell.row + 0.5) * layout.cellSize,
    };
}

function createBanner(title, detail, color, duration) {
    return { title, detail, color, duration, age: 0 };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function createFallbackTimeline() {
    let items = [];
    let cursor = 0;
    let paused = false;
    return {
        spawn(effect = {}) {
            const item = {
                id: effect.id || `fallback-${cursor += 1}`,
                type: effect.type || "effect",
                payload: effect.payload || {},
                duration: Math.max(1, Number(effect.duration) || 300),
                elapsed: 0,
            };
            items.push(item);
            return item;
        },
        update(deltaMs) {
            if (paused) {
                return;
            }
            items = items
                .map((item) => ({ ...item, elapsed: item.elapsed + deltaMs }))
                .filter((item) => item.elapsed < item.duration);
        },
        forEach(callback) {
            items.forEach((item) => {
                const progress = clamp(item.elapsed / item.duration, 0, 1);
                callback({ ...item, age: item.elapsed, progress, eased: 1 - Math.pow(1 - progress, 3), active: true, done: progress >= 1 });
            });
        },
        clear() {
            items = [];
        },
        pause() {
            paused = true;
        },
        resume() {
            paused = false;
        },
        destroy() {
            items = [];
        },
    };
}
