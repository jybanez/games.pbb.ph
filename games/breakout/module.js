export async function mountGame(session, options = {}) {
    const { createGameLoop } = options.helper["./ui.game.core.js"];
    const layer = session.addLayer({ id: "breakout-board", zIndex: 1, smoothing: true });
    const ctx = layer.context;
    const ui = createShell(session, options.game);
    const sound = options.sound;

    let paddle = 0;
    let ball = { x: 0, y: 0, vx: 0, vy: 0 };
    let blocks = [];
    let effects = [];
    let powerups = createPointCollectibleLayer();
    let widePaddleRemaining = 0;
    let trailElapsed = 0;
    let effectTime = 0;
    let running = true;
    let paused = false;

    const loop = createGameLoop({
        autoStart: false,
        update({ delta }) {
            if (running && !paused) {
                update(delta);
            }
        },
        render() {
            draw();
        },
    });

    const resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(syncToStageSize)
        : null;
    resizeObserver?.observe(session.viewport);

    reset();
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", syncToStageSize);
    session.viewport.addEventListener("pointerdown", handlePointerMove);
    session.viewport.addEventListener("pointermove", handlePointerMove);
    session.viewport.style.touchAction = "none";

    return {
        start() {
            loop.start();
        },
        destroy() {
            loop.stop();
            resizeObserver?.disconnect();
            window.removeEventListener("keydown", handleKeydown);
            window.removeEventListener("resize", syncToStageSize);
            session.viewport.removeEventListener("pointerdown", handlePointerMove);
            session.viewport.removeEventListener("pointermove", handlePointerMove);
            session.viewport.style.touchAction = "";
            ui.root.remove();
        },
        pause() {
            paused = true;
        },
        resume() {
            paused = false;
        },
        restart: reset,
    };

    function update(delta) {
        const metrics = getMetrics();
        const { width, height, ballRadius, paddleWidth, paddleY } = metrics;
        effectTime += delta;
        updateEffects(delta, metrics);
        ball.x += ball.vx * delta;
        ball.y += ball.vy * delta;
        trailElapsed += delta;
        if (trailElapsed >= 0.045) {
            trailElapsed = 0;
            addEffect("ballTrail", ball.x, ball.y, { radius: ballRadius, duration: 0.22 });
        }
        if (ball.x < ballRadius) {
            ball.x = ballRadius;
            ball.vx = Math.abs(ball.vx);
        }
        if (ball.x > width - ballRadius) {
            ball.x = width - ballRadius;
            ball.vx = -Math.abs(ball.vx);
        }
        if (ball.y < ballRadius) {
            ball.y = ballRadius;
            ball.vy = Math.abs(ball.vy);
        }
        if (ball.y > height) {
            running = false;
            options.onStateChange?.("gameOver", { detail: `${blocks.filter((block) => block.live).length} blocks remaining` });
            return;
        }
        if (ball.y + ballRadius >= paddleY && ball.y - ballRadius <= paddleY + metrics.paddleHeight && ball.x > paddle && ball.x < paddle + paddleWidth) {
            ball.vy = -Math.abs(ball.vy);
            ball.y = paddleY - ballRadius;
            const paddleCenter = paddle + paddleWidth / 2;
            ball.vx += ((ball.x - paddleCenter) / (paddleWidth / 2)) * metrics.paddleDeflect;
            ball.vx = clamp(ball.vx, -metrics.maxBallSpeed, metrics.maxBallSpeed);
            addEffect("paddlePulse", paddleCenter, paddleY + metrics.paddleHeight / 2, { width: paddleWidth, height: metrics.paddleHeight, duration: 0.2 });
            sound?.play?.("move", { volume: 0.4 });
        }
        blocks.forEach((block) => {
            if (block.live && ball.x + ballRadius > block.x && ball.x - ballRadius < block.x + block.width && ball.y + ballRadius > block.y && ball.y - ballRadius < block.y + block.height) {
                block.live = false;
                addEffect("blockBreak", block.x + block.width / 2, block.y + block.height / 2, {
                    width: block.width,
                    height: block.height,
                    color: block.color,
                    duration: 0.28,
                });
                maybeSpawnPowerup(block, metrics);
                syncScore();
                ball.vy *= -1;
                sound?.play?.("score");
            }
        });
        if (blocks.every((block) => !block.live)) {
            running = false;
            options.onStateChange?.("won", { title: "Cleared", detail: "All blocks cleared" });
        }
    }

    function draw() {
        const metrics = getMetrics();
        const { width, height, ballRadius, paddleWidth, paddleHeight, paddleY } = metrics;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#07101d";
        ctx.fillRect(0, 0, width, height);
        drawBlockEffects();
        blocks.filter((block) => block.live).forEach((block) => {
            ctx.fillStyle = block.color;
            ctx.fillRect(block.x, block.y, block.width, block.height);
        });
        drawPowerups(metrics);
        drawBallTrail();
        ctx.fillStyle = "#4fd29b";
        ctx.fillRect(paddle, paddleY, paddleWidth, paddleHeight);
        drawPaddlePulse(metrics);
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    function handleKeydown(event) {
        const metrics = getMetrics();
        if (event.key === "ArrowLeft") paddle -= metrics.paddleStep;
        if (event.key === "ArrowRight") paddle += metrics.paddleStep;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
        }
        paddle = clamp(paddle, 0, metrics.width - metrics.paddleWidth);
    }

    function handlePointerMove(event) {
        const rect = session.viewport.getBoundingClientRect();
        const metrics = getMetrics();
        paddle = clamp(((event.clientX - rect.left) / rect.width) * metrics.width - metrics.paddleWidth / 2, 0, metrics.width - metrics.paddleWidth);
    }

    function reset() {
        const metrics = getMetrics();
        paddle = (metrics.width - metrics.paddleWidth) / 2;
        ball = createBall(metrics);
        blocks = createBlocks(metrics);
        effects = [];
        powerups.reset();
        widePaddleRemaining = 0;
        trailElapsed = 0;
        effectTime = 0;
        running = true;
        paused = false;
        options.onStateChange?.("playing");
        syncScore();
        draw();
    }

    function syncScore() {
        const remaining = blocks.filter((block) => block.live).length;
        ui.score.textContent = `Blocks ${remaining}`;
    }

    function syncToStageSize() {
        const metrics = getMetrics();
        blocks = reflowBlocks(metrics);
        paddle = clamp(paddle, 0, metrics.width - metrics.paddleWidth);
        ball.x = clamp(ball.x, metrics.ballRadius, metrics.width - metrics.ballRadius);
        ball.y = clamp(ball.y, metrics.ballRadius, metrics.height - metrics.ballRadius);
        draw();
    }

    function getMetrics() {
        const width = Math.max(240, layer.canvas.width || session.viewport.clientWidth || 640);
        const height = Math.max(220, layer.canvas.height || session.viewport.clientHeight || 480);
        const basePaddleWidth = clamp(width * 0.14, 64, 112);
        const paddleWidth = widePaddleRemaining > 0 ? clamp(basePaddleWidth * 1.55, basePaddleWidth, 168) : basePaddleWidth;
        const paddleHeight = clamp(height * 0.014, 8, 12);
        const paddleY = height - clamp(height * 0.075, 24, 42);
        const ballRadius = clamp(Math.min(width, height) * 0.016, 6, 9);
        const ballSpeed = clamp(Math.min(width, height) * 0.62, 170, 300);
        const blockColumns = width < 520 ? 6 : 8;
        const blockRows = 4;
        const blockGap = clamp(width * 0.022, 8, 22);
        const blockMargin = clamp(width * 0.07, 18, 90);
        const blockWidth = Math.max(24, (width - blockMargin * 2 - blockGap * (blockColumns - 1)) / blockColumns);
        const blockHeight = clamp(height * 0.025, 12, 18);
        const blockTop = clamp(height * 0.085, 36, 70);
        const blockGapY = clamp(height * 0.02, 8, 14);

        return {
            width,
            height,
            paddleWidth,
            paddleHeight,
            paddleY,
            paddleStep: Math.max(24, paddleWidth * 0.38),
            paddleDeflect: ballSpeed * 0.22,
            ballRadius,
            ballSpeed,
            maxBallSpeed: ballSpeed * 1.45,
            blockColumns,
            blockRows,
            blockGap,
            blockMargin,
            blockWidth,
            blockHeight,
            blockTop,
            blockGapY,
        };
    }

    function createBall(metrics = getMetrics()) {
        const blocksBottom = metrics.blockTop + metrics.blockRows * metrics.blockHeight + (metrics.blockRows - 1) * metrics.blockGapY;
        return {
            x: metrics.width / 2,
            y: clamp(metrics.height * 0.58, blocksBottom + metrics.ballRadius + 22, metrics.paddleY - metrics.ballRadius - 24),
            vx: metrics.ballSpeed * 0.72,
            vy: -metrics.ballSpeed,
        };
    }

    function createBlocks(metrics = getMetrics()) {
        const result = [];
        for (let y = 0; y < metrics.blockRows; y += 1) {
            for (let x = 0; x < metrics.blockColumns; x += 1) {
                result.push({
                    id: `block-${y}-${x}`,
                    x: metrics.blockMargin + x * (metrics.blockWidth + metrics.blockGap),
                    y: metrics.blockTop + y * (metrics.blockHeight + metrics.blockGapY),
                    width: metrics.blockWidth,
                    height: metrics.blockHeight,
                    color: blockColor(y),
                    live: true,
                });
            }
        }
        return result;
    }

    function reflowBlocks(metrics = getMetrics()) {
        const liveState = blocks.map((block) => block.live);
        return createBlocks(metrics).map((block, index) => ({
            ...block,
            live: liveState[index] !== false,
        }));
    }

    function updateEffects(delta, metrics) {
        effects = effects
            .map((effect) => ({ ...effect, age: effect.age + delta }))
            .filter((effect) => effect.age < effect.duration);
        powerups.forEach((item) => {
            item.y += item.vy * delta;
        });
        powerups.removeWhere((item) => item.y - item.radius > metrics.height);
        const collected = powerups.collectWhere((item) => (
            item.x + item.radius >= paddle
            && item.x - item.radius <= paddle + metrics.paddleWidth
            && item.y + item.radius >= metrics.paddleY
            && item.y - item.radius <= metrics.paddleY + metrics.paddleHeight
        ));
        if (collected) {
            widePaddleRemaining = 7;
            addEffect("paddlePulse", paddle + metrics.paddleWidth / 2, metrics.paddleY + metrics.paddleHeight / 2, {
                width: metrics.paddleWidth,
                height: metrics.paddleHeight,
                duration: 0.34,
            });
            sound?.play?.("select", { volume: 0.5 });
        }
        if (widePaddleRemaining > 0) {
            widePaddleRemaining = Math.max(0, widePaddleRemaining - delta);
            paddle = clamp(paddle, 0, metrics.width - getMetrics().paddleWidth);
        }
    }

    function maybeSpawnPowerup(block, metrics) {
        if (powerups.size() >= 1 || Math.random() > 0.18) {
            return;
        }
        powerups.spawn({
            id: `wide-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type: "widePaddle",
            x: block.x + block.width / 2,
            y: block.y + block.height / 2,
            radius: clamp(metrics.ballRadius * 1.45, 9, 14),
            vy: metrics.ballSpeed * 0.36,
        });
    }

    function addEffect(type, x, y, options = {}) {
        effects.push({
            id: `${type}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            type,
            x,
            y,
            age: 0,
            duration: options.duration || 0.24,
            ...options,
        });
    }

    function drawBlockEffects() {
        effects.filter((effect) => effect.type === "blockBreak").forEach((effect) => {
            const progress = effect.age / effect.duration;
            const scale = 1 + progress * 0.35;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - progress);
            ctx.fillStyle = effect.color || "#79a9ff";
            ctx.translate(effect.x, effect.y);
            ctx.scale(scale, scale);
            ctx.fillRect(-effect.width / 2, -effect.height / 2, effect.width, effect.height);
            ctx.restore();
        });
    }

    function drawBallTrail() {
        effects.filter((effect) => effect.type === "ballTrail").forEach((effect) => {
            const progress = effect.age / effect.duration;
            ctx.save();
            ctx.globalAlpha = (1 - progress) * 0.32;
            ctx.fillStyle = "#d9f7ff";
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.radius * (1 - progress * 0.35), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    function drawPaddlePulse(metrics) {
        effects.filter((effect) => effect.type === "paddlePulse").forEach((effect) => {
            const progress = effect.age / effect.duration;
            ctx.save();
            ctx.globalAlpha = (1 - progress) * 0.4;
            ctx.strokeStyle = "#ffd166";
            ctx.lineWidth = Math.max(2, metrics.paddleHeight * 0.22);
            ctx.strokeRect(
                paddle - progress * 8,
                metrics.paddleY - progress * 5,
                metrics.paddleWidth + progress * 16,
                metrics.paddleHeight + progress * 10,
            );
            ctx.restore();
        });
    }

    function drawPowerups(metrics) {
        powerups.forEach((item) => {
            const pulse = 1 + Math.sin(effectTime * 9) * 0.08;
            const size = item.radius * 2 * pulse;
            ctx.save();
            ctx.fillStyle = "#ffd166";
            ctx.globalAlpha = 0.94;
            ctx.beginPath();
            roundRectPath(item.x - size / 2, item.y - size / 2, size, size, Math.max(3, item.radius * 0.28));
            ctx.fill();
            ctx.strokeStyle = "#07101d";
            ctx.lineWidth = Math.max(1.5, item.radius * 0.16);
            ctx.beginPath();
            ctx.moveTo(item.x - item.radius * 0.45, item.y);
            ctx.lineTo(item.x + item.radius * 0.45, item.y);
            ctx.stroke();
            ctx.restore();
        });
    }

    function blockColor(row) {
        return ["#79a9ff", "#6ed7c3", "#ffd166", "#ff8ea3"][row % 4];
    }

    function roundRectPath(x, y, width, height, radius) {
        if (typeof ctx.roundRect === "function") {
            ctx.roundRect(x, y, width, height, radius);
            return;
        }
        const r = Math.min(radius, width / 2, height / 2);
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
    root.className = "pbb-game-session-ui";

    const hud = document.createElement("div");
    hud.className = "pbb-game-session-hud";

    const title = document.createElement("p");
    title.className = "pbb-game-session-title";
    title.textContent = game.title;

    const score = document.createElement("p");
    score.className = "ui-badge pbb-game-session-score";
    score.textContent = "Blocks 0";

    hud.append(title);
    root.append(hud, score);
    session.overlay.appendChild(root);

    return { root, score };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function createPointCollectibleLayer() {
    const items = new Map();

    return {
        collectWhere(predicate) {
            for (const item of items.values()) {
                if (predicate(item)) {
                    items.delete(item.id);
                    return item;
                }
            }
            return null;
        },
        forEach(callback) {
            items.forEach(callback);
        },
        removeWhere(predicate) {
            items.forEach((item) => {
                if (predicate(item)) {
                    items.delete(item.id);
                }
            });
        },
        reset() {
            items.clear();
        },
        size() {
            return items.size;
        },
        spawn(item) {
            items.set(item.id, { ...item });
            return items.get(item.id);
        },
    };
}
