export async function mountGame(session, options = {}) {
    const { createGameLoop, createTouchControlPad, createGameActionButtonGroup } = options.helper["./ui.game.core.js"];
    const { createTetromino } = options.helper["./ui.game.objects.js"];
    const layer = session.addLayer({ id: "tetris-board", zIndex: 1, smoothing: false });
    const ctx = layer.context;
    const ui = createShell(session, options.game || { title: "Tetris" });
    const sound = options.sound;
    const showMilestone = typeof options.showMilestone === "function"
        ? options.showMilestone
        : () => undefined;

    const columns = 10;
    const visibleRows = 20;
    const hiddenRows = 2;
    const totalRows = visibleRows + hiddenRows;
    const shapes = ["I", "O", "T", "S", "Z", "J", "L"];
    const colors = {
        I: "#79d7ff",
        O: "#ffd166",
        T: "#b58cff",
        S: "#54d3a5",
        Z: "#ff7a90",
        J: "#79a9ff",
        L: "#ffb15f",
    };

    let board = createBoard();
    let bag = [];
    let queue = [];
    let piece = null;
    let score = 0;
    let lines = 0;
    let level = 1;
    let dropElapsed = 0;
    let lockElapsed = 0;
    let running = true;
    let paused = false;
    let done = false;

    const movementPad = createTouchControlPad(ui.movementControls, {
        visibility: "overlay",
        directions: ["left", "right", "down"],
        repeat: true,
        repeatDelay: 92,
        labels: {
            left: "Move left",
            right: "Move right",
            down: "Soft drop",
        },
        onDirection(vector, meta) {
            if (meta.direction === "left") {
                movePiece(-1, 0);
            }
            if (meta.direction === "right") {
                movePiece(1, 0);
            }
            if (meta.direction === "down") {
                softDrop();
            }
        },
    });

    const actionGroup = createGameActionButtonGroup(ui.actions, {
        visibility: "overlay",
        layout: "grid",
        buttons: [
            { id: "rotateLeft", label: "CCW", ariaLabel: "Rotate counterclockwise", icon: "actions.rotate-left", buttonClassName: "pbb-tetris-action-rotate-left", onPress: () => rotatePiece(-1) },
            { id: "rotateRight", label: "CW", ariaLabel: "Rotate clockwise", icon: "actions.rotate-right", buttonClassName: "ui-button-primary pbb-tetris-action-rotate-right", onPress: () => rotatePiece(1) },
        ],
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
            dropElapsed += delta;
            if (dropElapsed >= getDropInterval()) {
                dropElapsed = 0;
                gravityStep();
            }
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
            movementPad.destroy();
            actionGroup.destroy();
            resizeObserver?.disconnect();
            window.removeEventListener("keydown", handleKeydown);
            window.removeEventListener("resize", draw);
            session.viewport.style.touchAction = "";
            ui.root.remove();
        },
        pause() {
            if (!done) {
                paused = true;
                draw();
            }
        },
        resume() {
            if (!done) {
                paused = false;
                draw();
            }
        },
        restart: reset,
    };

    function reset() {
        board = createBoard();
        bag = [];
        queue = [];
        score = 0;
        lines = 0;
        level = 1;
        dropElapsed = 0;
        lockElapsed = 0;
        running = true;
        paused = false;
        done = false;
        fillQueue();
        spawnPiece();
        options.onStateChange?.("playing");
        syncScore();
        draw();
    }

    function spawnPiece() {
        fillQueue();
        piece = createPiece(queue.shift());
        fillQueue();
        lockElapsed = 0;
        if (!canPlace(piece.getCells())) {
            endGame();
        }
    }

    function createPiece(shape) {
        return createTetromino({
            shape,
            row: 0,
            column: shape === "I" ? 3 : 3,
            cellSize: getLayout().cellSize,
        });
    }

    function fillQueue() {
        while (queue.length < 4) {
            if (bag.length === 0) {
                bag = shuffle(shapes);
            }
            queue.push(bag.shift());
        }
    }

    function gravityStep() {
        if (movePiece(0, 1, { score: false, sound: false })) {
            return;
        }
        lockElapsed += getDropInterval();
        if (lockElapsed >= 0.42) {
            lockPiece();
        }
    }

    function softDrop() {
        if (done || paused) {
            return;
        }
        if (movePiece(0, 1, { score: true, sound: true })) {
            dropElapsed = 0;
            return;
        }
        lockElapsed = 0.42;
        lockPiece();
    }

    function hardDrop() {
        if (done || paused || !piece) {
            return;
        }
        let distance = 0;
        while (movePiece(0, 1, { score: false, resetLock: false, sound: false })) {
            distance += 1;
        }
        score += distance * 2;
        if (distance > 0) {
            sound?.play?.("drop");
        }
        lockPiece();
    }

    function movePiece(columnDelta, rowDelta, options = {}) {
        if (done || paused || !piece) {
            return false;
        }
        const preview = piece.getMovePreview(columnDelta, rowDelta);
        if (!canPlace(preview.cells)) {
            return false;
        }
        piece.moveBy(columnDelta, rowDelta);
        if (options.sound !== false) {
            if (rowDelta > 0 && columnDelta === 0) {
                sound?.play?.("drop", { volume: 0.34 });
            } else {
                sound?.play?.("move", { volume: 0.42 });
            }
        }
        if (options.score && rowDelta > 0) {
            score += 1;
            syncScore();
        }
        if (options.resetLock !== false) {
            lockElapsed = 0;
        }
        draw();
        return true;
    }

    function rotatePiece(direction) {
        if (done || paused || !piece) {
            return false;
        }
        const accepted = piece.getWallKickTests(direction).find((test) => canPlace(test.cells));
        if (!accepted) {
            return false;
        }
        piece.rotate(direction, accepted);
        lockElapsed = 0;
        sound?.play?.("rotate");
        draw();
        return true;
    }

    function lockPiece() {
        if (!piece || done) {
            return;
        }
        const cells = piece.getCells();
        cells.forEach((cell) => {
            if (cell.row >= 0 && cell.row < totalRows && cell.column >= 0 && cell.column < columns) {
                board[cell.row][cell.column] = piece.shape;
            }
        });
        const cleared = clearLines();
        if (cleared > 0) {
            const scoreResult = applyLineScore(cleared);
            sound?.play?.("score");
            showLineMilestone(cleared, scoreResult);
        }
        if (cells.some((cell) => cell.row < hiddenRows)) {
            endGame();
            return;
        }
        spawnPiece();
        syncScore();
        draw();
    }

    function clearLines() {
        let cleared = 0;
        for (let row = totalRows - 1; row >= hiddenRows; row -= 1) {
            if (!board[row].every(Boolean)) {
                continue;
            }
            board.splice(row, 1);
            board.unshift(Array(columns).fill(null));
            cleared += 1;
            row += 1;
        }
        return cleared;
    }

    function applyLineScore(cleared) {
        const lineScores = [0, 100, 300, 500, 800];
        const previousLevel = level;
        lines += cleared;
        level = Math.floor(lines / 10) + 1;
        const award = (lineScores[cleared] || 0) * level;
        score += award;
        return {
            award,
            previousLevel,
            nextLevel: level,
        };
    }

    function showLineMilestone(cleared, scoreResult) {
        if (done || paused) {
            return;
        }
        const leveledUp = scoreResult.nextLevel > scoreResult.previousLevel;
        if (leveledUp) {
            showMilestone({
                title: `Level ${scoreResult.nextLevel}`,
                detail: `${lines} lines cleared. Speed increased.`,
                tone: "success",
                position: "top-center",
                duration: 1300,
                autoDismiss: true,
                actions: [],
            });
            return;
        }

        const title = cleared === 4
            ? "Tetris!"
            : cleared === 1
                ? "Line Clear"
                : `${cleared} Lines`;

        showMilestone({
            title,
            detail: `+${scoreResult.award} points`,
            tone: cleared >= 4 ? "success" : "info",
            position: "top-center",
            duration: cleared >= 4 ? 1200 : 900,
            autoDismiss: true,
            actions: [],
        });
    }

    function canPlace(cells) {
        return cells.every((cell) => {
            if (cell.column < 0 || cell.column >= columns || cell.row < 0 || cell.row >= totalRows) {
                return false;
            }
            return !board[cell.row][cell.column];
        });
    }

    function getDropInterval() {
        return Math.max(0.12, 0.76 - (level - 1) * 0.055);
    }

    function syncScore() {
        ui.score.textContent = `Score ${score}  Lines ${lines}  Lv ${level}`;
    }

    function endGame() {
        done = true;
        running = false;
        options.onStateChange?.("gameOver", { detail: `Score ${score} | Lines ${lines}` });
        draw();
    }

    function handleKeydown(event) {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            movePiece(-1, 0);
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            movePiece(1, 0);
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            softDrop();
        }
        if (event.key === "ArrowUp" || event.key.toLowerCase() === "x") {
            event.preventDefault();
            rotatePiece(1);
        }
        if (event.key.toLowerCase() === "z") {
            event.preventDefault();
            rotatePiece(-1);
        }
        if (event.code === "Space") {
            event.preventDefault();
            hardDrop();
        }
        if (event.key.toLowerCase() === "p") {
            event.preventDefault();
            options.requestPause?.();
        }
    }

    function draw() {
        const layout = getLayout();
        ctx.clearRect(0, 0, layout.width, layout.height);
        ctx.fillStyle = "#07101d";
        ctx.fillRect(0, 0, layout.width, layout.height);
        drawBackdrop(layout);
        drawBoard(layout);
        drawGhost(layout);
        drawPiece(layout);
        drawNext(layout);
    }

    function getLayout() {
        const width = Math.max(240, layer.canvas.width || session.viewport.clientWidth || 360);
        const height = Math.max(320, layer.canvas.height || session.viewport.clientHeight || 640);
        const portrait = height >= width;
        const topReserve = portrait ? clamp(height * 0.075, 48, 72) : 48;
        const bottomReserve = portrait ? clamp(height * 0.18, 120, 164) : 88;
        const sidePanelWidth = !portrait && width >= 700 ? clamp(width * 0.17, 116, 160) : 0;
        const sideMargin = clamp(width * 0.045, 12, 42);
        const availableWidth = Math.max(120, width - sideMargin * 2 - sidePanelWidth);
        const availableHeight = Math.max(180, height - topReserve - bottomReserve);
        const cellSize = Math.floor(Math.max(10, Math.min(availableWidth / columns, availableHeight / visibleRows)));
        const boardWidth = cellSize * columns;
        const boardHeight = cellSize * visibleRows;
        const boardX = Math.round((width - sidePanelWidth - boardWidth) / 2);
        const boardY = Math.round(topReserve + (availableHeight - boardHeight) / 2);

        return {
            width,
            height,
            cellSize,
            boardX,
            boardY,
            boardWidth,
            boardHeight,
            sidePanelWidth,
            portrait,
        };
    }

    function drawBackdrop(layout) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = "#14213a";
        ctx.lineWidth = 1;
        const spacing = clamp(layout.cellSize * 1.8, 24, 48);
        for (let x = -spacing; x < layout.width + spacing; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + layout.height * 0.18, layout.height);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawBoard(layout) {
        ctx.save();
        ctx.fillStyle = "#08111f";
        ctx.fillRect(layout.boardX, layout.boardY, layout.boardWidth, layout.boardHeight);
        ctx.strokeStyle = "#2b3750";
        ctx.lineWidth = 2;
        ctx.strokeRect(layout.boardX, layout.boardY, layout.boardWidth, layout.boardHeight);

        ctx.strokeStyle = "rgba(126, 155, 205, .14)";
        ctx.lineWidth = 1;
        for (let column = 1; column < columns; column += 1) {
            const x = layout.boardX + column * layout.cellSize;
            ctx.beginPath();
            ctx.moveTo(x, layout.boardY);
            ctx.lineTo(x, layout.boardY + layout.boardHeight);
            ctx.stroke();
        }
        for (let row = 1; row < visibleRows; row += 1) {
            const y = layout.boardY + row * layout.cellSize;
            ctx.beginPath();
            ctx.moveTo(layout.boardX, y);
            ctx.lineTo(layout.boardX + layout.boardWidth, y);
            ctx.stroke();
        }

        for (let row = hiddenRows; row < totalRows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const shape = board[row][column];
                if (shape) {
                    drawBlock(layout, row, column, colors[shape] || "#79a9ff", 1);
                }
            }
        }
        ctx.restore();
    }

    function drawGhost(layout) {
        if (!piece || done) {
            return;
        }
        const distance = getDropDistance();
        if (distance <= 0) {
            return;
        }
        piece.getCells({ row: piece.row + distance }).forEach((cell) => {
            drawBlock(layout, cell.row, cell.column, colors[piece.shape] || "#79a9ff", 0.2);
        });
    }

    function drawPiece(layout) {
        if (!piece) {
            return;
        }
        piece.getCells().forEach((cell) => {
            drawBlock(layout, cell.row, cell.column, colors[piece.shape] || "#79a9ff", 1);
        });
    }

    function drawBlock(layout, row, column, color, alpha = 1) {
        const visibleRow = row - hiddenRows;
        if (visibleRow < 0 || visibleRow >= visibleRows) {
            return;
        }
        const gap = Math.max(1, Math.floor(layout.cellSize * 0.08));
        const x = layout.boardX + column * layout.cellSize + gap;
        const y = layout.boardY + visibleRow * layout.cellSize + gap;
        const size = layout.cellSize - gap * 2;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = "rgba(255, 255, 255, .18)";
        ctx.fillRect(x, y, size, Math.max(2, size * 0.16));
        ctx.strokeStyle = "rgba(7, 16, 29, .54)";
        ctx.lineWidth = Math.max(1, layout.cellSize * 0.045);
        ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
        ctx.restore();
    }

    function drawNext(layout) {
        if (!queue.length) {
            return;
        }
        const canUseSidePanel = layout.sidePanelWidth > 0;
        const panelX = canUseSidePanel
            ? layout.boardX + layout.boardWidth + 24
            : layout.boardX + layout.boardWidth - layout.cellSize * 2.7;
        const panelY = canUseSidePanel
            ? layout.boardY + layout.cellSize
            : layout.boardY + layout.cellSize * 0.6;
        const previewSize = Math.max(8, Math.floor(layout.cellSize * (canUseSidePanel ? 0.62 : 0.44)));

        ctx.save();
        ctx.globalAlpha = canUseSidePanel ? 1 : 0.86;
        ctx.fillStyle = "rgba(7, 16, 29, .68)";
        ctx.strokeStyle = "rgba(126, 155, 205, .22)";
        ctx.lineWidth = 1;
        ctx.fillRect(panelX - 10, panelY - 24, previewSize * 4.6, previewSize * 4.9);
        ctx.strokeRect(panelX - 10, panelY - 24, previewSize * 4.6, previewSize * 4.9);
        ctx.fillStyle = "#b2c2e5";
        ctx.font = `700 ${Math.max(10, Math.floor(previewSize * 0.58))}px Segoe UI, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("Next", panelX, panelY - 10);
        drawMiniShape(queue[0], panelX, panelY + previewSize * 0.7, previewSize);
        ctx.restore();
    }

    function drawMiniShape(shape, x, y, size) {
        const preview = createTetromino({ shape, row: 0, column: 0, cellSize: size });
        const cells = preview.getCells();
        const minRow = Math.min(...cells.map((cell) => cell.row));
        const minColumn = Math.min(...cells.map((cell) => cell.column));
        cells.forEach((cell) => {
            const px = x + (cell.column - minColumn) * size;
            const py = y + (cell.row - minRow) * size;
            ctx.fillStyle = colors[shape] || "#79a9ff";
            ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
        });
    }

    function getDropDistance() {
        let distance = 0;
        while (canPlace(piece.getMovePreview(0, distance + 1).cells)) {
            distance += 1;
        }
        return distance;
    }
}

function createShell(session, game) {
    const root = document.createElement("div");
    root.className = "pbb-game-session-ui pbb-tetris-session-ui";

    const hud = document.createElement("div");
    hud.className = "pbb-game-session-hud";

    const title = document.createElement("p");
    title.className = "pbb-game-session-title";
    title.textContent = game.title;

    const score = document.createElement("p");
    score.className = "ui-badge pbb-game-session-score";
    score.textContent = "Score 0  Lines 0  Lv 1";

    const movementControls = document.createElement("div");
    movementControls.className = "pbb-game-session-movement-controls";

    const actions = document.createElement("div");
    actions.className = "pbb-game-session-actions pbb-tetris-session-actions";

    hud.appendChild(title);
    root.append(hud, score, movementControls, actions);
    session.overlay.appendChild(root);

    return { root, score, movementControls, actions };
}

function createBoard() {
    return Array.from({ length: 22 }, () => Array(10).fill(null));
}

function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
