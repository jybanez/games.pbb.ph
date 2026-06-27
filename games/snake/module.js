export async function mountGame(session, options = {}) {
    const { createGameLoop, createVirtualJoystick } = options.helper["./ui.game.core.js"];
    const layer = session.addLayer({ id: "snake-board", zIndex: 1, smoothing: false });
    const ctx = layer.context;
    const ui = createShell(session, options.game);
    const sound = options.sound;
    const controlsHost = document.createElement("div");
    ui.movementControls.appendChild(controlsHost);

    const desktopColumns = 32;
    const levels = [
        { id: "supply-start", level: 1, title: "Supply Start", scoreTarget: 0, tickInterval: 0.138, bonusEvery: 5, bonusTtl: 5.5 },
        { id: "route-pace", level: 2, title: "Route Pace", scoreTarget: 6, tickInterval: 0.124, bonusEvery: 5, bonusTtl: 5.1 },
        { id: "quick-hands", level: 3, title: "Quick Hands", scoreTarget: 14, tickInterval: 0.112, bonusEvery: 4, bonusTtl: 4.8 },
        { id: "barangay-run", level: 4, title: "Barangay Run", scoreTarget: 24, tickInterval: 0.102, bonusEvery: 4, bonusTtl: 4.5 },
        { id: "responder-flow", level: 5, title: "Responder Flow", scoreTarget: 38, tickInterval: 0.094, bonusEvery: 3, bonusTtl: 4.2 },
    ];
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
    let combo = 0;
    let comboTimer = 0;
    let currentLevel = levels[0];
    let elapsed = 0;
    let pulseTime = 0;
    let eatEffects = [];
    let floatingTexts = [];
    let collectionBursts = [];
    let banners = [];
    let deathFlash = 0;
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
            elapsed += delta;
            pulseTime += delta;
            updateEffects(delta);
            if (done || paused) {
                return;
            }
            updateBonus(delta);
            if (elapsed >= currentLevel.tickInterval) {
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
            deathFlash = 0.72;
            floatingTexts.push({
                text: `Score ${score}`,
                x: (snake[0].x + 0.5) * bounds.cellWidth,
                y: (snake[0].y + 0.5) * bounds.cellHeight,
                color: "#ff9faf",
                age: 0,
                duration: 1.2,
            });
            sound?.play?.("error", { volume: 0.54 });
            options.onStateChange?.("gameOver", { detail: `Score ${score}` });
            draw();
            return;
        }
        snake.unshift(head);
        const collected = supplies.collectAt(head.y, head.x);
        if (collected) {
            const previousLevel = currentLevel.level;
            score += Number(collected.value) || 1;
            foodCollected += collected.type === "food" ? 1 : 0;
            combo = Math.min(9, combo + 1);
            comboTimer = collected.type === "bonus" ? 3.4 : 2.2;
            spawnCollectionEffects(collected, head);
            syncLevel();
            if (currentLevel.level > previousLevel) {
                banners.push({
                    title: `Level ${currentLevel.level}`,
                    detail: currentLevel.title,
                    age: 0,
                    duration: 1.25,
                });
                sound?.play?.("select", { volume: 0.45 });
            }
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
        combo = 0;
        comboTimer = 0;
        currentLevel = levels[0];
        elapsed = 0;
        pulseTime = 0;
        eatEffects = [];
        floatingTexts = [];
        collectionBursts = [];
        banners = [];
        deathFlash = 0;
        done = false;
        paused = false;
        options.onStateChange?.("playing");
        syncScore();
        draw();
    }

    function syncScore() {
        const nextLevel = levels.find((level) => level.level === currentLevel.level + 1);
        const nextLabel = nextLevel ? `  Next ${Math.max(0, nextLevel.scoreTarget - score)}` : "  Max Lv";
        ui.score.textContent = `Score ${score}  Lv ${currentLevel.level}${nextLabel}`;
        options.onProgress?.({
            type: "progress:update",
            progress: {
                gameId: "snake",
                scheme: "endless",
                level: currentLevel.level,
                levelId: currentLevel.id,
                levelName: currentLevel.title,
                difficulty: currentLevel.level <= 2 ? "easy" : currentLevel.level <= 4 ? "normal" : "hard",
                objective: "Collect supplies and keep the route clear",
                score,
                progressCurrent: nextLevel ? score : currentLevel.scoreTarget,
                progressTarget: nextLevel?.scoreTarget || currentLevel.scoreTarget,
                progressLabel: nextLevel ? `Next level in ${Math.max(0, nextLevel.scoreTarget - score)}` : "Max level",
            },
        });
    }

    function syncLevel() {
        currentLevel = getLevelForScore(score);
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
        if (foodCollected > 0 && foodCollected % currentLevel.bonusEvery === 0 && !supplies.get("bonus")) {
            supplies.spawn({
                id: "bonus",
                type: "bonus",
                value: 3,
                ttl: currentLevel.bonusTtl,
            });
            banners.push({
                title: "Bonus Supply",
                detail: "Grab it before it fades",
                age: 0,
                duration: 1.05,
                tone: "bonus",
            });
            sound?.play?.("select", { volume: 0.36 });
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
        comboTimer = Math.max(0, comboTimer - delta);
        if (comboTimer <= 0) {
            combo = 0;
        }
        eatEffects = eatEffects
            .map((effect) => ({ ...effect, age: effect.age + delta }))
            .filter((effect) => effect.age < effect.duration);
        floatingTexts = floatingTexts
            .map((effect) => ({ ...effect, age: effect.age + delta }))
            .filter((effect) => effect.age < effect.duration);
        collectionBursts = collectionBursts
            .map((effect) => ({ ...effect, age: effect.age + delta }))
            .filter((effect) => effect.age < effect.duration);
        banners = banners
            .map((effect) => ({ ...effect, age: effect.age + delta }))
            .filter((effect) => effect.age < effect.duration);
        deathFlash = Math.max(0, deathFlash - delta);
    }

    function getBounds() {
        const width = Math.max(1, layer.canvas.width);
        const height = Math.max(1, layer.canvas.height);
        const columns = getColumnCount(width, height);
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

    function getColumnCount(width, height) {
        if (width < 520 || height > width * 1.35) {
            return 20;
        }
        if (width < 760) {
            return 24;
        }
        return desktopColumns;
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
        drawBackdrop();
        ctx.strokeStyle = "#2b3750";
        ctx.strokeRect(0.5, 0.5, bounds.width - 1, bounds.height - 1);
        drawRouteGrid();
        drawSnakeGlow();
        drawSnake();
        drawSupplies();
        drawEatEffects();
        drawCollectionBursts();
        drawFloatingTexts();
        drawBanners();
        drawDeathFlash();
    }

    function drawBackdrop() {
        const gradient = ctx.createRadialGradient(
            bounds.width * 0.5,
            bounds.height * 0.44,
            Math.min(bounds.width, bounds.height) * 0.08,
            bounds.width * 0.5,
            bounds.height * 0.5,
            Math.max(bounds.width, bounds.height) * 0.72,
        );
        gradient.addColorStop(0, "#0d1b30");
        gradient.addColorStop(0.58, "#081525");
        gradient.addColorStop(1, "#060d19");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, bounds.width, bounds.height);

        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = "#173056";
        ctx.lineWidth = 1;
        const spacing = Math.max(24, Math.min(bounds.width, bounds.height) * 0.075);
        const drift = (pulseTime * 18) % spacing;
        for (let x = -spacing * 2; x < bounds.width + spacing * 2; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x + drift, 0);
            ctx.lineTo(x + drift + bounds.height * 0.18, bounds.height);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawRouteGrid() {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = "#14213a";
        ctx.lineWidth = 1;
        for (let column = 4; column < bounds.columns; column += 4) {
            const x = column * bounds.cellWidth;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, bounds.height);
            ctx.stroke();
        }
        for (let row = 4; row < bounds.rows; row += 4) {
            const y = row * bounds.cellHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(bounds.width, y);
            ctx.stroke();
        }
        ctx.restore();

        const signalAlpha = 0.34 + Math.sin(pulseTime * 3.2) * 0.12;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = signalAlpha;
        ctx.fillStyle = "#54d3a5";
        const signalCount = Math.max(4, Math.floor(bounds.columns / 5));
        for (let index = 0; index < signalCount; index += 1) {
            const column = (index * 5 + Math.floor(pulseTime * 1.4)) % bounds.columns;
            const row = (index * 7 + Math.floor(pulseTime * 0.9)) % bounds.rows;
            const radius = Math.max(1.5, Math.min(bounds.cellWidth, bounds.cellHeight) * 0.07);
            ctx.beginPath();
            ctx.arc((column + 0.5) * bounds.cellWidth, (row + 0.5) * bounds.cellHeight, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawSnakeGlow() {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        snake.forEach((part, index) => {
            const progress = 1 - index / Math.max(1, snake.length);
            const alpha = index === 0 ? 0.34 : Math.max(0.04, progress * 0.16);
            const radius = Math.min(bounds.cellWidth, bounds.cellHeight) * (index === 0 ? 0.72 : 0.54);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = index === 0 ? "#79d7ff" : "#54d3a5";
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = Math.max(8, radius * 1.8);
            ctx.beginPath();
            ctx.arc((part.x + 0.5) * bounds.cellWidth, (part.y + 0.5) * bounds.cellHeight, radius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    function drawSnake() {
        snake.forEach((part, index) => {
            const x = part.x * bounds.cellWidth + 1;
            const y = part.y * bounds.cellHeight + 1;
            const inset = index === 0 ? 0.8 : 1.4;
            const width = bounds.cellWidth - 2 - inset * 2;
            const height = bounds.cellHeight - 2 - inset * 2;
            const pulse = index === 0 ? 1 + Math.sin(pulseTime * 9) * 0.035 : 1;
            const cx = x + inset + width / 2;
            const cy = y + inset + height / 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(pulse, pulse);
            ctx.fillStyle = index === 0 ? "#b7d7ff" : bodyColor(index);
            ctx.shadowColor = index === 0 ? "rgba(121, 215, 255, .42)" : "rgba(84, 211, 165, .18)";
            ctx.shadowBlur = index === 0 ? Math.max(5, bounds.cellWidth * 0.38) : Math.max(2, bounds.cellWidth * 0.12);
            roundRectPath(-width / 2, -height / 2, width, height, Math.max(2, Math.min(width, height) * 0.24));
            ctx.fill();
            ctx.shadowBlur = 0;
            if (index === 0) {
                drawHeadEyes(width, height);
            } else if (index % 3 === 0) {
                ctx.globalAlpha = 0.22;
                ctx.fillStyle = "#e8f5ff";
                ctx.beginPath();
                ctx.arc(width * 0.16, -height * 0.12, Math.max(1.2, Math.min(width, height) * 0.08), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });
    }

    function bodyColor(index) {
        const blend = Math.min(1, index / Math.max(1, snake.length));
        return blend > 0.66 ? "#5ec49e" : blend > 0.33 ? "#69bde2" : "#79a9ff";
    }

    function drawHeadEyes(width, height) {
        const eyeRadius = Math.max(1.4, Math.min(width, height) * 0.1);
        const forwardX = dir.x * width * 0.16;
        const forwardY = dir.y * height * 0.16;
        const sideX = dir.y === 0 ? 0 : width * 0.16;
        const sideY = dir.x === 0 ? 0 : height * 0.16;
        ctx.fillStyle = "#07101d";
        [-1, 1].forEach((side) => {
            ctx.beginPath();
            ctx.arc(forwardX + sideX * side, forwardY + sideY * side, eyeRadius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawSupplies() {
        supplies.forEach((item) => {
            const pulse = 1 + Math.sin(pulseTime * (item.type === "bonus" ? 9 : 6)) * (item.type === "bonus" ? 0.14 : 0.08);
            const centerX = (item.column + 0.5) * bounds.cellWidth;
            const centerY = (item.row + 0.5) * bounds.cellHeight;
            const radius = Math.min(bounds.cellWidth, bounds.cellHeight) * (item.type === "bonus" ? 0.34 : 0.26) * pulse;
            ctx.save();
            const ttlAlpha = item.ttl == null ? 1 : Math.max(0.38, Math.min(1, item.ttl / currentLevel.bonusTtl));
            ctx.fillStyle = item.type === "bonus" ? "#ffd166" : "#4fd29b";
            ctx.globalAlpha = item.type === "bonus" ? 0.94 : 0.86;
            ctx.shadowColor = item.type === "bonus" ? "#ffd166" : "#54d3a5";
            ctx.shadowBlur = Math.max(6, radius * 1.1);
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = ttlAlpha * 0.7;
            ctx.strokeStyle = item.type === "bonus" ? "#fff1b8" : "#dfffea";
            ctx.lineWidth = Math.max(1, radius * 0.16);
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 1.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ttlAlpha);
            ctx.stroke();
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

    function spawnCollectionEffects(item, cell) {
        const value = Number(item.value) || 1;
        const bonus = item.type === "bonus";
        const center = {
            x: (cell.x + 0.5) * bounds.cellWidth,
            y: (cell.y + 0.5) * bounds.cellHeight,
        };
        const color = bonus ? "#ffe071" : combo >= 4 ? "#9cf5ff" : "#75f0bd";
        eatEffects.push({ x: cell.x, y: cell.y, age: 0, duration: bonus ? 0.42 : 0.28, type: item.type });
        floatingTexts.push({
            text: bonus ? `+${value} BONUS` : combo >= 3 ? `+${value}  x${combo}` : `+${value}`,
            x: center.x,
            y: center.y,
            color,
            age: 0,
            duration: bonus ? 1.18 : 0.96,
            bonus,
            combo,
        });
        collectionBursts.push({
            x: center.x,
            y: center.y,
            color,
            bonus,
            combo,
            age: 0,
            duration: bonus ? 0.62 : combo >= 3 ? 0.56 : 0.46,
            particles: createCollectionParticles(bonus ? 18 : combo >= 3 ? 14 : 10),
        });
    }

    function createCollectionParticles(count) {
        return Array.from({ length: count }, (_, index) => {
            const angle = (Math.PI * 2 * index) / count + Math.random() * 0.22;
            return {
                angle,
                distance: 0.7 + Math.random() * 0.75,
                size: 0.07 + Math.random() * 0.08,
            };
        });
    }

    function drawCollectionBursts() {
        collectionBursts.forEach((effect) => {
            const progress = Math.min(1, effect.age / effect.duration);
            const cellSize = Math.min(bounds.cellWidth, bounds.cellHeight);
            const alpha = 1 - progress;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = alpha * (effect.combo >= 3 ? 0.78 : 0.62);
            ctx.strokeStyle = effect.color;
            ctx.lineWidth = Math.max(2, cellSize * 0.09);
            ctx.shadowColor = effect.color;
            ctx.shadowBlur = Math.max(10, cellSize * 0.8);
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, cellSize * (0.42 + progress * (effect.bonus ? 1.4 : effect.combo >= 3 ? 1.24 : 1.05)), 0, Math.PI * 2);
            ctx.stroke();

            effect.particles.forEach((particle) => {
                const distance = cellSize * particle.distance * progress;
                const size = Math.max(2, cellSize * particle.size * (1 - progress * 0.25));
                const x = effect.x + Math.cos(particle.angle) * distance;
                const y = effect.y + Math.sin(particle.angle) * distance;
                ctx.globalAlpha = alpha * (effect.bonus ? 0.92 : effect.combo >= 3 ? 0.84 : 0.72);
                ctx.fillStyle = effect.color;
                ctx.fillRect(x - size / 2, y - size / 2, size, size);
            });
            ctx.restore();
        });
    }

    function drawFloatingTexts() {
        floatingTexts.forEach((effect) => {
            const progress = Math.min(1, effect.age / effect.duration);
            const lift = effect.bonus ? 2.45 : 2.05;
            const comboBoost = effect.combo >= 3 ? 1.12 : 1;
            const fontSize = Math.max(effect.bonus ? 21 : 18, Math.floor(Math.min(bounds.cellWidth, bounds.cellHeight) * (effect.bonus ? 1.38 : 1.22) * comboBoost));
            ctx.save();
            ctx.globalAlpha = 1 - progress;
            ctx.fillStyle = effect.color;
            ctx.shadowColor = effect.color;
            ctx.shadowBlur = 20;
            ctx.font = `900 ${fontSize}px Segoe UI, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = Math.max(4, fontSize * 0.2);
            ctx.strokeStyle = "rgba(7, 16, 29, .9)";
            ctx.strokeText(effect.text, effect.x, effect.y - progress * bounds.cellHeight * lift);
            ctx.fillText(effect.text, effect.x, effect.y - progress * bounds.cellHeight * lift);
            ctx.restore();
        });
    }

    function drawBanners() {
        banners.forEach((banner) => {
            const progress = Math.min(1, banner.age / banner.duration);
            const fade = progress > 0.72 ? 1 - (progress - 0.72) / 0.28 : 1;
            const scale = 0.92 + Math.sin(progress * Math.PI) * 0.12;
            const color = banner.tone === "bonus" ? "#ffe071" : "#79d7ff";
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.translate(bounds.width / 2, bounds.height * 0.28);
            ctx.scale(scale, scale);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = color;
            ctx.shadowBlur = 22;
            ctx.fillStyle = "#f8fbff";
            ctx.font = `900 ${Math.max(30, Math.floor(Math.min(bounds.width, bounds.height) * 0.1))}px Segoe UI, sans-serif`;
            ctx.fillText(banner.title, 0, 0);
            ctx.shadowBlur = 12;
            ctx.fillStyle = banner.tone === "bonus" ? "#fff1b8" : "#9fc0ff";
            ctx.font = `800 ${Math.max(14, Math.floor(Math.min(bounds.width, bounds.height) * 0.04))}px Segoe UI, sans-serif`;
            ctx.fillText(banner.detail, 0, Math.max(34, bounds.height * 0.07));
            ctx.restore();
        });
    }

    function drawDeathFlash() {
        if (deathFlash <= 0) {
            return;
        }
        const progress = deathFlash / 0.72;
        ctx.save();
        ctx.globalAlpha = Math.min(0.42, progress * 0.42);
        ctx.fillStyle = "#ff4d6d";
        ctx.fillRect(0, 0, bounds.width, bounds.height);
        ctx.restore();
    }

    function getLevelForScore(value) {
        return [...levels].reverse().find((level) => value >= level.scoreTarget) || levels[0];
    }

    function roundRectPath(x, y, width, height, radius) {
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
    root.className = "pbb-game-session-ui pbb-snake-session-ui";

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
