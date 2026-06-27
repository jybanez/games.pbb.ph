export async function mountGame(session, options = {}) {
    const { createGameLoop } = options.helper["./ui.game.core.js"];
    const layer = session.addLayer({ id: "breakout-board", zIndex: 1, smoothing: true });
    const ctx = layer.context;
    const ui = createShell(session, options.game);
    const sound = options.sound;
    const levelDefinitions = [
        { id: "level-1", rows: 4, mobileColumns: 6, desktopColumns: 8, speed: 1, powerChance: 0.18, scoreMultiplier: 1, clearBonus: 400 },
        { id: "level-2", rows: 5, mobileColumns: 6, desktopColumns: 8, speed: 1.08, powerChance: 0.18, scoreMultiplier: 1.12, clearBonus: 600 },
        { id: "level-3", rows: 5, mobileColumns: 7, desktopColumns: 9, speed: 1.16, powerChance: 0.16, scoreMultiplier: 1.25, clearBonus: 800 },
        { id: "level-4", rows: 6, mobileColumns: 7, desktopColumns: 9, speed: 1.26, powerChance: 0.15, scoreMultiplier: 1.4, clearBonus: 1000 },
        { id: "level-5", rows: 6, mobileColumns: 7, desktopColumns: 10, speed: 1.36, powerChance: 0.14, scoreMultiplier: 1.58, clearBonus: 1200 },
    ];

    let paddle = 0;
    let ball = { x: 0, y: 0, vx: 0, vy: 0 };
    let blocks = [];
    let effects = [];
    let powerups = createPointCollectibleLayer();
    let widePaddleRemaining = 0;
    let score = 0;
    let levelIndex = 0;
    let levelTransitionRemaining = 0;
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
        if (levelTransitionRemaining > 0) {
            levelTransitionRemaining = Math.max(0, levelTransitionRemaining - delta);
            if (levelTransitionRemaining === 0) {
                startLevel(levelIndex + 1, { announce: true });
            }
            return;
        }
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
            options.onStateChange?.("gameOver", { detail: `Level ${levelIndex + 1} | ${blocks.filter((block) => block.live).length} blocks remaining` });
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
                score += block.points;
                addEffect("blockBreak", block.x + block.width / 2, block.y + block.height / 2, {
                    width: block.width,
                    height: block.height,
                    color: block.color,
                    particles: createBreakParticles(block, metrics),
                    duration: 0.42,
                });
                addEffect("scorePopup", block.x + block.width / 2, block.y + block.height / 2, {
                    text: `+${block.points}`,
                    color: block.color,
                    duration: 0.72,
                });
                maybeSpawnPowerup(block, metrics);
                syncScore();
                ball.vy *= -1;
                sound?.play?.("score");
            }
        });
        if (blocks.every((block) => !block.live)) {
            beginLevelTransition();
        }
    }

    function draw() {
        const metrics = getMetrics();
        const { width, height, ballRadius, paddleWidth, paddleHeight, paddleY } = metrics;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#07101d";
        ctx.fillRect(0, 0, width, height);
        drawStageGlow(metrics);
        drawBlockEffects();
        blocks.filter((block) => block.live).forEach((block) => {
            drawBlock(block, metrics);
        });
        drawScorePopups(metrics);
        drawPowerups(metrics);
        drawBallTrail();
        drawPaddle(metrics);
        drawPaddlePulse(metrics);
        ctx.fillStyle = "#d9f7ff";
        ctx.shadowColor = "#79d7ff";
        ctx.shadowBlur = Math.max(8, ballRadius * 2.2);
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
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
        effects = [];
        powerups.reset();
        widePaddleRemaining = 0;
        score = 0;
        levelIndex = 0;
        levelTransitionRemaining = 0;
        trailElapsed = 0;
        effectTime = 0;
        running = true;
        paused = false;
        startLevel(0, { announce: false });
        options.onStateChange?.("playing");
        syncScore();
        draw();
    }

    function startLevel(nextLevelIndex, options = {}) {
        levelIndex = nextLevelIndex;
        const metrics = getMetrics();
        paddle = (metrics.width - metrics.paddleWidth) / 2;
        ball = createBall(metrics);
        blocks = createBlocks(metrics);
        powerups.reset();
        widePaddleRemaining = 0;
        trailElapsed = 0;
        running = true;
        if (options.announce) {
            addEffect("levelBanner", metrics.width / 2, metrics.height * 0.36, {
                title: `Level ${levelIndex + 1}`,
                detail: getLevelDefinition().id.replace("-", " "),
                color: "#79d7ff",
                duration: 1,
            });
        }
        syncScore();
    }

    function beginLevelTransition() {
        const metrics = getMetrics();
        const level = getLevelDefinition();
        score += level.clearBonus;
        levelTransitionRemaining = 1.25;
        powerups.reset();
        widePaddleRemaining = 0;
        addEffect("levelBanner", metrics.width / 2, metrics.height * 0.36, {
            title: `Level ${levelIndex + 1} Clear`,
            detail: `+${level.clearBonus} bonus | Next Level ${levelIndex + 2}`,
            color: "#ffd166",
            duration: 1.2,
        });
        syncScore();
        sound?.play?.("score", { volume: 0.75 });
    }

    function syncScore() {
        const remaining = blocks.filter((block) => block.live).length;
        ui.score.textContent = `Score ${score}  Lv ${levelIndex + 1}  Blocks ${remaining}`;
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
        const level = getLevelDefinition();
        const width = Math.max(240, layer.canvas.width || session.viewport.clientWidth || 640);
        const height = Math.max(220, layer.canvas.height || session.viewport.clientHeight || 480);
        const basePaddleWidth = clamp(width * 0.14, 64, 112);
        const paddleWidth = widePaddleRemaining > 0 ? clamp(basePaddleWidth * 1.55, basePaddleWidth, 168) : basePaddleWidth;
        const paddleHeight = clamp(height * 0.014, 8, 12);
        const paddleY = height - clamp(height * 0.075, 24, 42);
        const ballRadius = clamp(Math.min(width, height) * 0.016, 6, 9);
        const ballSpeed = clamp(Math.min(width, height) * 0.62, 170, 300) * level.speed;
        const blockColumns = width < 520 ? level.mobileColumns : level.desktopColumns;
        const blockRows = level.rows;
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
        const level = getLevelDefinition();
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
                    points: Math.round((40 + (metrics.blockRows - y) * 15) * level.scoreMultiplier),
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
            addEffect("scorePopup", paddle + metrics.paddleWidth / 2, metrics.paddleY - metrics.paddleHeight * 1.4, {
                text: "WIDE PADDLE",
                color: "#ffd166",
                duration: 0.9,
            });
            sound?.play?.("select", { volume: 0.5 });
        }
        if (widePaddleRemaining > 0) {
            widePaddleRemaining = Math.max(0, widePaddleRemaining - delta);
            paddle = clamp(paddle, 0, metrics.width - getMetrics().paddleWidth);
        }
    }

    function maybeSpawnPowerup(block, metrics) {
        if (powerups.size() >= 1 || Math.random() > getLevelDefinition().powerChance) {
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

    function getLevelDefinition() {
        const lastLevel = levelDefinitions[levelDefinitions.length - 1];
        const base = levelDefinitions[levelIndex] || lastLevel;
        if (levelIndex < levelDefinitions.length) {
            return base;
        }
        const extra = levelIndex - levelDefinitions.length + 1;
        return {
            ...base,
            id: `level-${levelIndex + 1}`,
            speed: base.speed + extra * 0.06,
            powerChance: Math.max(0.1, base.powerChance - extra * 0.005),
            scoreMultiplier: base.scoreMultiplier + extra * 0.12,
            clearBonus: base.clearBonus + extra * 180,
        };
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

    function createBreakParticles(block, metrics) {
        const count = metrics.width < 520 ? 7 : 10;
        return Array.from({ length: count }, () => ({
            x: (Math.random() - 0.5) * block.width * 0.78,
            y: (Math.random() - 0.5) * block.height * 0.7,
            dx: (Math.random() - 0.5) * block.width * 1.35,
            dy: (Math.random() - 0.65) * block.height * 2.4,
            size: Math.max(3, Math.min(block.height * 0.38, 8) * (0.65 + Math.random() * 0.8)),
            spin: (Math.random() - 0.5) * Math.PI,
        }));
    }

    function drawStageGlow(metrics) {
        ctx.save();
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = "rgba(47, 119, 255, .18)";
        ctx.lineWidth = 1;
        const spacing = clamp(metrics.width * 0.075, 32, 64);
        for (let x = -spacing; x < metrics.width + spacing; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + metrics.height * 0.1, metrics.height);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawBlock(block, metrics) {
        const radius = Math.max(3, Math.min(block.height * 0.38, 8));
        const shineHeight = Math.max(2, block.height * 0.24);

        ctx.save();
        ctx.shadowColor = block.color;
        ctx.shadowBlur = Math.max(6, block.height * 0.65);
        ctx.fillStyle = block.color;
        ctx.beginPath();
        roundRectPath(block.x, block.y, block.width, block.height, radius);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        roundRectPath(block.x + 1, block.y + 1, block.width - 2, shineHeight, Math.max(2, radius - 1));
        ctx.fill();

        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = "rgba(255, 255, 255, .32)";
        ctx.lineWidth = Math.max(1, metrics.blockHeight * 0.08);
        ctx.beginPath();
        roundRectPath(block.x + 0.5, block.y + 0.5, block.width - 1, block.height - 1, radius);
        ctx.stroke();
        ctx.restore();
    }

    function drawBlockEffects() {
        effects.filter((effect) => effect.type === "blockBreak").forEach((effect) => {
            const progress = effect.age / effect.duration;
            const scale = 1 + progress * 0.55;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = Math.max(0, 1 - progress) * 0.72;
            ctx.fillStyle = effect.color || "#79a9ff";
            ctx.shadowColor = effect.color || "#79a9ff";
            ctx.shadowBlur = Math.max(10, effect.height * 0.9);
            ctx.translate(effect.x, effect.y);
            ctx.scale(scale, scale);
            ctx.beginPath();
            roundRectPath(-effect.width / 2, -effect.height / 2, effect.width, effect.height, Math.max(3, effect.height * 0.35));
            ctx.fill();
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            effect.particles?.forEach((particle) => {
                const x = effect.x + particle.x + particle.dx * progress;
                const y = effect.y + particle.y + particle.dy * progress + progress * progress * effect.height * 1.8;
                const size = particle.size * (1 - progress * 0.35);
                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - progress);
                ctx.translate(x, y);
                ctx.rotate(particle.spin * progress * 2);
                ctx.fillStyle = effect.color || "#79a9ff";
                ctx.fillRect(-size / 2, -size / 2, size, size);
                ctx.restore();
            });
            ctx.restore();
        });
    }

    function drawBallTrail() {
        effects.filter((effect) => effect.type === "ballTrail").forEach((effect) => {
            const progress = effect.age / effect.duration;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = (1 - progress) * 0.44;
            ctx.fillStyle = "#79d7ff";
            ctx.shadowColor = "#79d7ff";
            ctx.shadowBlur = Math.max(8, effect.radius * 2);
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.radius * (1.25 - progress * 0.35), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    function drawScorePopups(metrics) {
        effects.filter((effect) => effect.type === "scorePopup").forEach((effect) => {
            const progress = effect.age / effect.duration;
            const y = effect.y - metrics.ballRadius * 5 * progress;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = Math.max(0, 1 - progress);
            ctx.fillStyle = "#f8fbff";
            ctx.strokeStyle = "rgba(7, 16, 29, .84)";
            ctx.lineWidth = Math.max(3, metrics.ballRadius * 0.45);
            ctx.shadowColor = effect.color || "#ffd166";
            ctx.shadowBlur = Math.max(10, metrics.ballRadius * 2.4);
            ctx.font = `900 ${Math.max(15, Math.floor(metrics.ballRadius * 2.45))}px Segoe UI, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.strokeText(effect.text, effect.x, y);
            ctx.fillText(effect.text, effect.x, y);
            ctx.restore();
        });
        effects.filter((effect) => effect.type === "levelBanner").forEach((effect) => {
            drawLevelBanner(metrics, effect);
        });
    }

    function drawLevelBanner(metrics, effect) {
        const progress = effect.age / effect.duration;
        const intro = clamp(progress / 0.18, 0, 1);
        const fade = progress > 0.78 ? 1 - clamp((progress - 0.78) / 0.22, 0, 1) : 1;
        const ringRadius = metrics.width * (0.08 + progress * 0.22);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fade;
        ctx.strokeStyle = effect.color || "#ffd166";
        ctx.lineWidth = Math.max(2, metrics.ballRadius * 0.42);
        ctx.shadowColor = effect.color || "#ffd166";
        ctx.shadowBlur = Math.max(18, metrics.ballRadius * 3);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.translate(effect.x, effect.y);
        ctx.scale(0.88 + intro * 0.12, 0.88 + intro * 0.12);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(4, metrics.ballRadius * 0.58);
        ctx.strokeStyle = "rgba(7, 16, 29, .84)";
        ctx.fillStyle = "#f8fbff";
        ctx.font = `900 ${Math.max(24, Math.floor(metrics.ballRadius * 4.4))}px Segoe UI, sans-serif`;
        ctx.strokeText(effect.title, 0, 0);
        ctx.fillText(effect.title, 0, 0);
        ctx.fillStyle = effect.color || "#ffd166";
        ctx.font = `800 ${Math.max(13, Math.floor(metrics.ballRadius * 2))}px Segoe UI, sans-serif`;
        ctx.strokeText(effect.detail, 0, metrics.ballRadius * 5.2);
        ctx.fillText(effect.detail, 0, metrics.ballRadius * 5.2);
        ctx.restore();
    }

    function drawPaddle(metrics) {
        const radius = Math.max(4, metrics.paddleHeight * 0.45);
        ctx.save();
        ctx.fillStyle = widePaddleRemaining > 0 ? "#ffd166" : "#4fd29b";
        ctx.shadowColor = widePaddleRemaining > 0 ? "#ffd166" : "#54d3a5";
        ctx.shadowBlur = Math.max(8, metrics.paddleHeight * 1.1);
        ctx.beginPath();
        roundRectPath(paddle, metrics.paddleY, metrics.paddleWidth, metrics.paddleHeight, radius);
        ctx.fill();
        ctx.globalAlpha = 0.38;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        roundRectPath(paddle + 2, metrics.paddleY + 1, metrics.paddleWidth - 4, Math.max(2, metrics.paddleHeight * 0.28), radius);
        ctx.fill();
        ctx.restore();
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
            ctx.shadowColor = "#ffd166";
            ctx.shadowBlur = Math.max(8, item.radius * 0.9);
            ctx.beginPath();
            roundRectPath(item.x - size / 2, item.y - size / 2, size, size, Math.max(3, item.radius * 0.28));
            ctx.fill();
            ctx.strokeStyle = "#07101d";
            ctx.lineWidth = Math.max(1.5, item.radius * 0.16);
            ctx.beginPath();
            ctx.moveTo(item.x - item.radius * 0.45, item.y);
            ctx.lineTo(item.x + item.radius * 0.45, item.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(item.x, item.y - item.radius * 0.45);
            ctx.lineTo(item.x, item.y + item.radius * 0.45);
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
    score.textContent = "Score 0  Lv 1  Blocks 0";

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
