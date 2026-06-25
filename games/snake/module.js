export async function mountGame(session, options = {}) {
    const { createGameLoop, createVirtualJoystick } = options.helper["./ui.game.core.js"];
    const layer = session.addLayer({ id: "snake-board", zIndex: 1, smoothing: false });
    const ctx = layer.context;
    const ui = createShell(session, options.game);
    const sound = options.sound;
    const controlsHost = document.createElement("div");
    ui.movementControls.appendChild(controlsHost);

    const columns = 32;
    let bounds = getBounds();
    let snake = [centerCell(bounds)];
    let dir = { x: 1, y: 0 };
    let next = { x: 1, y: 0 };
    let supplies = createGridCollectibleLayer({
        getColumns: () => bounds.columns,
        getRows: () => bounds.rows,
        canPlace: (row, column) => column >= 0
            && row >= 0
            && column < bounds.columns
            && row < bounds.rows
            && !snake.some((part) => part.x === column && part.y === row),
    });
    let score = 0;
    let foodCollected = 0;
    let elapsed = 0;
    let pulseTime = 0;
    let eatEffects = [];
    let done = false;
    let paused = false;

    const joystick = createVirtualJoystick(controlsHost, {
        visibility: "ghost",
        radius: 58,
        onMove(vector) {
            setDirectionFromJoystick(vector);
        },
    });

    const loop = createGameLoop({
        autoStart: false,
        update({ delta }) {
            if (done || paused) {
                return;
            }
            elapsed += delta;
            pulseTime += delta;
            updateEffects(delta);
            updateBonus(delta);
            if (elapsed >= 0.135) {
                elapsed = 0;
                tick();
            }
        },
        render() {
            draw();
        },
    });

    window.addEventListener("keydown", handleKeydown);
    reset();

    return {
        start() {
            loop.start();
        },
        destroy() {
            loop.stop();
            joystick.destroy();
            window.removeEventListener("keydown", handleKeydown);
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

    function tick() {
        bounds = getBounds();
        keepSnakeInBounds();
        dir = next;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (head.x < 0 || head.y < 0 || head.x >= bounds.columns || head.y >= bounds.rows || snake.some((part) => part.x === head.x && part.y === head.y)) {
            done = true;
            options.onStateChange?.("gameOver", { detail: `Score ${score}` });
            draw();
            return;
        }
        snake.unshift(head);
        const collected = supplies.collectAt(head.y, head.x);
        if (collected) {
            score += Number(collected.value) || 1;
            foodCollected += collected.type === "food" ? 1 : 0;
            eatEffects.push({ x: head.x, y: head.y, age: 0, duration: collected.type === "bonus" ? 0.34 : 0.22, type: collected.type });
            ensureFood();
            maybeSpawnBonus();
            sound?.play?.("score");
            syncScore();
        } else {
            snake.pop();
        }
    }

    function setDirection(x, y) {
        if (done || (dir.x + x === 0 && dir.y + y === 0)) {
            return;
        }
        if (next.x !== x || next.y !== y) {
            sound?.play?.("move", { volume: 0.45 });
        }
        next = { x, y };
    }

    function setDirectionFromJoystick(vector) {
        if (!vector || vector.force < 0.35) {
            return;
        }
        if (Math.abs(vector.x) >= Math.abs(vector.y)) {
            setDirection(vector.x > 0 ? 1 : -1, 0);
            return;
        }
        setDirection(0, vector.y > 0 ? 1 : -1);
    }

    function handleKeydown(event) {
        if (event.key === "ArrowUp") setDirection(0, -1);
        if (event.key === "ArrowDown") setDirection(0, 1);
        if (event.key === "ArrowLeft") setDirection(-1, 0);
        if (event.key === "ArrowRight") setDirection(1, 0);
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
        }
    }

    function reset() {
        bounds = getBounds();
        snake = [centerCell(bounds)];
        dir = { x: 1, y: 0 };
        next = { x: 1, y: 0 };
        supplies.reset();
        ensureFood({
            column: Math.min(bounds.columns - 4, centerCell(bounds).x + 5),
            row: centerCell(bounds).y,
        });
        score = 0;
        foodCollected = 0;
        elapsed = 0;
        pulseTime = 0;
        eatEffects = [];
        done = false;
        paused = false;
        options.onStateChange?.("playing");
        syncScore();
        draw();
    }

    function syncScore() {
        ui.score.textContent = `Score ${score}`;
    }

    function ensureFood(preferred = null) {
        if (supplies.get("food")) {
            return;
        }
        supplies.spawn({
            id: "food",
            type: "food",
            value: 1,
            column: preferred?.column,
            row: preferred?.row,
        });
    }

    function maybeSpawnBonus() {
        if (foodCollected > 0 && foodCollected % 5 === 0 && !supplies.get("bonus")) {
            supplies.spawn({
                id: "bonus",
                type: "bonus",
                value: 3,
                ttl: 5.5,
            });
        }
    }

    function updateBonus(delta) {
        supplies.forEach((item) => {
            if (item.ttl == null) {
                return;
            }
            item.ttl -= delta;
            if (item.ttl <= 0) {
                supplies.remove(item.id);
            }
        });
    }

    function updateEffects(delta) {
        eatEffects = eatEffects
            .map((effect) => ({ ...effect, age: effect.age + delta }))
            .filter((effect) => effect.age < effect.duration);
    }

    function getBounds() {
        const width = Math.max(1, layer.canvas.width);
        const height = Math.max(1, layer.canvas.height);
        const rows = Math.max(18, Math.round(columns * height / width));
        return {
            columns,
            rows,
            cellWidth: width / columns,
            cellHeight: height / rows,
            width,
            height,
        };
    }

    function centerCell(currentBounds) {
        return {
            x: Math.floor(currentBounds.columns / 2),
            y: Math.floor(currentBounds.rows / 2),
        };
    }

    function keepSnakeInBounds() {
        if (snake.every((part) => part.x >= 0 && part.y >= 0 && part.x < bounds.columns && part.y < bounds.rows)) {
            return;
        }
        snake = [centerCell(bounds)];
        supplies.reset();
        ensureFood();
    }

    function draw() {
        bounds = getBounds();
        ctx.clearRect(0, 0, bounds.width, bounds.height);
        ctx.fillStyle = "#07101d";
        ctx.fillRect(0, 0, bounds.width, bounds.height);
        ctx.fillStyle = "#0b1220";
        ctx.fillRect(0, 0, bounds.width, bounds.height);
        ctx.strokeStyle = "#2b3750";
        ctx.strokeRect(0.5, 0.5, bounds.width - 1, bounds.height - 1);
        drawSnake();
        drawSupplies();
        drawEatEffects();
    }

    function drawSnake() {
        snake.forEach((part, index) => {
            const x = part.x * bounds.cellWidth + 1;
            const y = part.y * bounds.cellHeight + 1;
            const inset = index === 0 ? 0.8 : 1.4;
            ctx.fillStyle = index === 0 ? "#9ec5ff" : "#79a9ff";
            ctx.fillRect(x + inset, y + inset, bounds.cellWidth - 2 - inset * 2, bounds.cellHeight - 2 - inset * 2);
        });
    }

    function drawSupplies() {
        supplies.forEach((item) => {
            const pulse = 1 + Math.sin(pulseTime * (item.type === "bonus" ? 9 : 6)) * (item.type === "bonus" ? 0.14 : 0.08);
            const centerX = (item.column + 0.5) * bounds.cellWidth;
            const centerY = (item.row + 0.5) * bounds.cellHeight;
            const radius = Math.min(bounds.cellWidth, bounds.cellHeight) * (item.type === "bonus" ? 0.34 : 0.26) * pulse;
            ctx.save();
            ctx.fillStyle = item.type === "bonus" ? "#ffd166" : "#4fd29b";
            ctx.globalAlpha = item.type === "bonus" ? 0.94 : 0.86;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    function drawEatEffects() {
        eatEffects.forEach((effect) => {
            const progress = Math.min(1, effect.age / effect.duration);
            const centerX = (effect.x + 0.5) * bounds.cellWidth;
            const centerY = (effect.y + 0.5) * bounds.cellHeight;
            const radius = Math.min(bounds.cellWidth, bounds.cellHeight) * (0.28 + progress * 0.42);
            ctx.save();
            ctx.globalAlpha = 1 - progress;
            ctx.strokeStyle = effect.type === "bonus" ? "#ffd166" : "#4fd29b";
            ctx.lineWidth = Math.max(1, Math.min(bounds.cellWidth, bounds.cellHeight) * 0.08);
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });
    }
}

function createGridCollectibleLayer(options = {}) {
    const items = new Map();
    const canPlace = typeof options.canPlace === "function" ? options.canPlace : () => true;
    const getColumns = typeof options.getColumns === "function" ? options.getColumns : () => 32;
    const getRows = typeof options.getRows === "function" ? options.getRows : () => 32;

    return {
        collectAt,
        forEach(callback) {
            items.forEach(callback);
        },
        get(id) {
            return items.get(id) || null;
        },
        remove(id) {
            return items.delete(id);
        },
        reset() {
            items.clear();
        },
        spawn,
    };

    function spawn(item = {}) {
        const positioned = resolvePosition(item);
        if (!positioned) {
            return null;
        }
        const id = item.id || `${item.type || "item"}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const nextItem = {
            ...item,
            id,
            type: item.type || "food",
            value: Number(item.value) || 1,
            row: positioned.row,
            column: positioned.column,
        };
        items.set(id, nextItem);
        return nextItem;
    }

    function collectAt(row, column) {
        for (const item of items.values()) {
            if (item.row === row && item.column === column) {
                items.delete(item.id);
                return item;
            }
        }
        return null;
    }

    function resolvePosition(item) {
        const row = Number(item.row);
        const column = Number(item.column);
        if (Number.isInteger(row) && Number.isInteger(column) && isOpen(row, column, item)) {
            return { row, column };
        }
        for (let attempt = 0; attempt < 800; attempt += 1) {
            const candidate = {
                row: Math.floor(Math.random() * Math.max(1, getRows())),
                column: Math.floor(Math.random() * Math.max(1, getColumns())),
            };
            if (isOpen(candidate.row, candidate.column, item)) {
                return candidate;
            }
        }
        return null;
    }

    function isOpen(row, column, item) {
        return canPlace(row, column, item)
            && ![...items.values()].some((current) => current.row === row && current.column === column);
    }
}

function createShell(session, game) {
    const root = document.createElement("div");
    root.className = "pbb-game-session-ui";

    const hud = document.createElement("div");
    hud.className = "pbb-game-session-hud";

    const title = document.createElement("p");
    title.className = "pbb-game-session-title";
    title.textContent = game.title;

    const score = document.createElement("p");
    score.className = "ui-badge pbb-game-session-score";
    score.textContent = "Score 0";

    const movementControls = document.createElement("div");
    movementControls.className = "pbb-game-session-movement-controls";

    hud.appendChild(title);
    root.append(hud, score, movementControls);
    session.overlay.appendChild(root);

    return { root, score, movementControls };
}
