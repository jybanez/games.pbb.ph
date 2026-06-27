const LEVEL_DEFINITIONS = [
    {
        level: 1,
        columns: 4,
        rows: 3,
        symbols: ["W", "R", "K", "F", "M", "L"],
        matchBonus: 100,
        mismatchDelay: 620,
    },
    {
        level: 2,
        columns: 4,
        rows: 4,
        symbols: ["W", "R", "K", "F", "M", "L", "B", "S"],
        matchBonus: 125,
        mismatchDelay: 560,
    },
    {
        level: 3,
        columns: 5,
        rows: 4,
        symbols: ["W", "R", "K", "F", "M", "L", "B", "S", "H", "C"],
        matchBonus: 150,
        mismatchDelay: 520,
    },
];

const SYMBOL_LABELS = {
    W: "Water",
    R: "Radio",
    K: "Kit",
    F: "First aid",
    M: "Map",
    L: "Light",
    B: "Battery",
    S: "Shelter",
    H: "Help",
    C: "Comms",
};

export async function mountGame(session, options = {}) {
    const { createGameLoop } = options.helper["./ui.game.core.js"];
    const { createGameObjectLayer, createPointerInputRouter, createFlipCard } = options.helper["./ui.game.objects.js"];
    const layer = session.addLayer({ id: "memory-board", zIndex: 1, smoothing: true });
    const ctx = layer.context;
    const ui = createShell(session, options.game || { title: "Memory Cards" });
    const sound = options.sound;

    let levelIndex = 0;
    let currentLevel = LEVEL_DEFINITIONS[levelIndex];
    let deck = [];
    let cards = [];
    let selected = [];
    let matches = 0;
    let moves = 0;
    let score = 0;
    let resolving = false;
    let paused = false;
    let levelClearing = false;
    let particles = [];
    let popups = [];
    let banners = [];
    const timers = new Set();

    const objectLayer = createGameObjectLayer();
    const router = createPointerInputRouter(layer.canvas, objectLayer);

    const resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(layoutCards)
        : null;
    resizeObserver?.observe(session.viewport);

    const loop = createGameLoop({
        autoStart: false,
        update({ delta }) {
            objectLayer.update(delta);
            updateEffects();
        },
        render() {
            draw();
        },
    });

    reset();
    window.addEventListener("resize", layoutCards);

    return {
        start() {
            loop.start();
        },
        destroy() {
            loop.stop();
            clearTimers();
            window.removeEventListener("resize", layoutCards);
            resizeObserver?.disconnect();
            router.destroy();
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

    function reset() {
        clearTimers();
        levelIndex = 0;
        score = 0;
        startLevel(levelIndex, { announce: false });
    }

    function startLevel(nextLevelIndex, { announce = true } = {}) {
        clearTimers();
        objectLayer.clear();
        currentLevel = LEVEL_DEFINITIONS[nextLevelIndex] || LEVEL_DEFINITIONS[LEVEL_DEFINITIONS.length - 1];
        levelIndex = Math.min(nextLevelIndex, LEVEL_DEFINITIONS.length - 1);
        deck = shuffle(currentLevel.symbols.flatMap((symbol) => [symbol, symbol])).map((symbol, index) => ({
            id: `memory-card-${currentLevel.level}-${index + 1}`,
            symbol,
            effect: "",
            effectUntil: 0,
            shakeUntil: 0,
        }));
        cards = deck.map((item, index) => {
            const card = createFlipCard({
                id: item.id,
                x: 0,
                y: 0,
                width: 96,
                height: 128,
                zIndex: index,
                frontLabel: item.symbol,
                backLabel: "PBB",
                flipDuration: 180,
                data: item,
                onSelect(selectedCard) {
                    selectCard(selectedCard);
                },
                renderFront,
                renderBack,
            });
            objectLayer.add(card);
            return card;
        });
        selected = [];
        matches = 0;
        moves = 0;
        resolving = false;
        paused = false;
        levelClearing = false;
        particles = [];
        popups = [];
        banners = [];
        options.onStateChange?.("playing");
        layoutCards();
        syncScore();
        if (announce) {
            showBanner(`Level ${currentLevel.level}`, "Find every pair");
            sound?.play?.("score", { volume: 0.42 });
        }
        draw();
    }

    function selectCard(card) {
        if (paused || resolving || levelClearing || card.matched || selected.includes(card)) {
            return;
        }

        selected.push(card);
        sound?.play?.("select");
        if (selected.length !== 2) {
            return;
        }

        resolving = true;
        moves += 1;
        const [first, second] = selected;
        if (first.data.symbol === second.data.symbol) {
            completeMatch(first, second);
            return;
        }

        missMatch(first, second);
    }

    function completeMatch(first, second) {
        const now = performance.now();
        first.setMatched(true);
        second.setMatched(true);
        first.data.effect = "match";
        second.data.effect = "match";
        first.data.effectUntil = now + 520;
        second.data.effectUntil = now + 520;
        selected = [];
        matches += 1;
        score += currentLevel.matchBonus;
        resolving = false;
        sound?.play?.("match");
        spawnCardBurst(first, "#54d3a5");
        spawnCardBurst(second, "#79a9ff");
        showPopup(`+${currentLevel.matchBonus}`, averageCenter(first, second), "#dfffea");
        syncScore();
        if (matches === currentLevel.symbols.length) {
            beginLevelClear();
        }
    }

    function missMatch(first, second) {
        const now = performance.now();
        first.data.effect = "miss";
        second.data.effect = "miss";
        first.data.effectUntil = now + currentLevel.mismatchDelay;
        second.data.effectUntil = now + currentLevel.mismatchDelay;
        first.data.shakeUntil = now + 360;
        second.data.shakeUntil = now + 360;
        sound?.play?.("error", { volume: 0.45 });
        syncScore();
        schedule(() => {
            first.hide();
            second.hide();
            selected = [];
            resolving = false;
        }, currentLevel.mismatchDelay);
    }

    function beginLevelClear() {
        levelClearing = true;
        resolving = true;
        const levelBonus = Math.max(250, currentLevel.matchBonus * currentLevel.level);
        score += levelBonus;
        syncScore();
        showBanner(`Level ${currentLevel.level} Complete`, `+${levelBonus} bonus`);
        showPopup(`+${levelBonus}`, { x: getBoardBounds().width / 2, y: getBoardBounds().height * 0.42 }, "#fff3a8", 1500);
        sound?.play?.("win", { volume: 0.58 });
        schedule(() => {
            if (levelIndex + 1 < LEVEL_DEFINITIONS.length) {
                startLevel(levelIndex + 1, { announce: true });
                return;
            }
            options.onStateChange?.("won", {
                title: "All Matched",
                detail: `Score ${score}`,
            });
        }, 1450);
    }

    function layoutCards() {
        const bounds = getBoardBounds();
        const columns = currentLevel.columns;
        const rows = currentLevel.rows;
        const gap = clamp(Math.min(bounds.width, bounds.height) * 0.024, 7, 16);
        const topReserve = clamp(bounds.height * 0.16, 56, 90);
        const bottomReserve = clamp(bounds.height * 0.12, 42, 70);
        const sideReserve = clamp(bounds.width * 0.055, 16, 72);
        const availableWidth = Math.max(180, bounds.width - sideReserve * 2);
        const availableHeight = Math.max(180, bounds.height - topReserve - bottomReserve);
        const maxCardWidth = (availableWidth - gap * (columns - 1)) / columns;
        const maxCardHeight = (availableHeight - gap * (rows - 1)) / rows;
        const cardHeight = Math.max(48, Math.min(maxCardHeight, maxCardWidth * 1.28));
        const cardWidth = Math.max(38, Math.min(maxCardWidth, cardHeight * 0.78));
        const boardWidth = cardWidth * columns + gap * (columns - 1);
        const boardHeight = cardHeight * rows + gap * (rows - 1);
        const startX = (bounds.width - boardWidth) / 2;
        const startY = topReserve + (availableHeight - boardHeight) / 2;

        cards.forEach((card, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            card.baseX = startX + column * (cardWidth + gap);
            card.baseY = startY + row * (cardHeight + gap);
            card
                .setPosition(card.baseX, card.baseY)
                .setSize(cardWidth, cardHeight);
        });
        draw();
    }

    function getBoardBounds() {
        return {
            width: Math.max(1, layer.canvas.width || session.viewport.clientWidth || 640),
            height: Math.max(1, layer.canvas.height || session.viewport.clientHeight || 480),
        };
    }

    function syncScore() {
        ui.score.textContent = `Score ${score}  Lv ${currentLevel.level}  Pairs ${matches}/${currentLevel.symbols.length}  Moves ${moves}`;
    }

    function updateEffects() {
        const now = performance.now();
        cards.forEach((card) => {
            if (card.data.effectUntil && now > card.data.effectUntil) {
                card.data.effect = "";
                card.data.effectUntil = 0;
            }
            if (Number.isFinite(card.baseX) && Number.isFinite(card.baseY)) {
                const remaining = Math.max(0, (card.data.shakeUntil || 0) - now);
                const offset = remaining
                    ? Math.sin(now * 0.09) * clamp(remaining / 34, 0, 8)
                    : 0;
                card.setPosition(card.baseX + offset, card.baseY);
            }
        });
        particles = particles.filter((particle) => now - particle.createdAt < particle.duration);
        popups = popups.filter((popup) => now - popup.createdAt < popup.duration);
        banners = banners.filter((banner) => now - banner.createdAt < banner.duration);
    }

    function draw() {
        const bounds = getBoardBounds();
        ctx.clearRect(0, 0, bounds.width, bounds.height);
        ctx.fillStyle = "#07101d";
        ctx.fillRect(0, 0, bounds.width, bounds.height);
        drawBoardTexture(bounds);
        objectLayer.render(ctx);
        drawParticles();
        drawPopups();
        drawBanners(bounds);
    }

    function drawBoardTexture(bounds) {
        ctx.save();
        ctx.globalAlpha = 0.34;
        ctx.strokeStyle = "#14213a";
        ctx.lineWidth = 1;
        const spacing = clamp(Math.min(bounds.width, bounds.height) * 0.09, 28, 54);
        for (let x = -spacing; x < bounds.width + spacing; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + bounds.height * 0.25, bounds.height);
            ctx.stroke();
        }
        for (let y = 0; y < bounds.height + spacing; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(bounds.width, y - bounds.width * 0.25);
            ctx.stroke();
        }
        ctx.restore();
    }

    function renderFront(context, card) {
        const isMatch = card.data.effect === "match";
        const isMiss = card.data.effect === "miss";
        drawRoundedCard(context, card.width, card.height, {
            fill: card.matched ? "#dfffea" : "#e6f0ff",
            stroke: isMiss ? "#ff7b8a" : card.matched ? "#54d3a5" : "#8db5ff",
            glow: isMatch ? "#54d3a5" : isMiss ? "#ff7b8a" : "",
        });
        context.fillStyle = "#07101d";
        context.font = `800 ${Math.max(24, Math.floor(card.height * 0.36))}px Segoe UI, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(card.data.symbol, card.width / 2, card.height / 2 - card.height * 0.04);
        context.fillStyle = "#4b5d7b";
        context.font = `700 ${Math.max(10, Math.floor(card.height * 0.09))}px Segoe UI, sans-serif`;
        context.fillText(labelFor(card.data.symbol), card.width / 2, card.height * 0.78);
    }

    function renderBack(context, card) {
        drawRoundedCard(context, card.width, card.height, {
            fill: card.hover ? "#172843" : "#101b2e",
            stroke: card.hover ? "#79a9ff" : "#36517f",
            glow: card.hover ? "#4278d8" : "",
        });
        context.fillStyle = "#79a9ff";
        context.font = `800 ${Math.max(13, Math.floor(card.height * 0.16))}px Segoe UI, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("PBB", card.width / 2, card.height / 2);
        context.fillStyle = "rgba(84, 211, 165, .7)";
        context.beginPath();
        context.arc(card.width * 0.5, card.height * 0.68, Math.max(3, card.width * 0.045), 0, Math.PI * 2);
        context.fill();
    }

    function drawRoundedCard(context, width, height, optionsForCard) {
        const radius = Math.min(14, width * 0.14, height * 0.12);
        context.save();
        if (optionsForCard.glow) {
            context.shadowColor = optionsForCard.glow;
            context.shadowBlur = Math.max(10, width * 0.14);
        }
        context.beginPath();
        context.moveTo(radius, 0);
        context.lineTo(width - radius, 0);
        context.quadraticCurveTo(width, 0, width, radius);
        context.lineTo(width, height - radius);
        context.quadraticCurveTo(width, height, width - radius, height);
        context.lineTo(radius, height);
        context.quadraticCurveTo(0, height, 0, height - radius);
        context.lineTo(0, radius);
        context.quadraticCurveTo(0, 0, radius, 0);
        context.closePath();
        context.fillStyle = optionsForCard.fill;
        context.strokeStyle = optionsForCard.stroke;
        context.lineWidth = Math.max(2, width * 0.035);
        context.fill();
        context.stroke();
        context.restore();
    }

    function spawnCardBurst(card, color) {
        const center = {
            x: card.x + card.width / 2,
            y: card.y + card.height / 2,
        };
        for (let index = 0; index < 16; index += 1) {
            const angle = (Math.PI * 2 * index) / 16;
            const speed = 55 + Math.random() * 75;
            particles.push({
                x: center.x,
                y: center.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 3,
                color,
                createdAt: performance.now(),
                duration: 620,
            });
        }
    }

    function drawParticles() {
        const now = performance.now();
        particles.forEach((particle) => {
            const age = now - particle.createdAt;
            const progress = clamp(age / particle.duration, 0, 1);
            ctx.save();
            ctx.globalAlpha = 1 - progress;
            ctx.fillStyle = particle.color;
            ctx.shadowColor = particle.color;
            ctx.shadowBlur = 10;
            ctx.fillRect(
                particle.x + particle.vx * progress * 0.8,
                particle.y + particle.vy * progress * 0.8,
                particle.size,
                particle.size,
            );
            ctx.restore();
        });
    }

    function showPopup(label, point, color = "#dfffea", duration = 850) {
        popups.push({
            label,
            x: point.x,
            y: point.y,
            color,
            createdAt: performance.now(),
            duration,
        });
    }

    function drawPopups() {
        const now = performance.now();
        popups.forEach((popup) => {
            const age = now - popup.createdAt;
            const progress = clamp(age / popup.duration, 0, 1);
            ctx.save();
            ctx.globalAlpha = 1 - progress;
            ctx.fillStyle = popup.color;
            ctx.shadowColor = popup.color;
            ctx.shadowBlur = 16;
            ctx.font = `900 ${Math.round(28 + (1 - progress) * 10)}px Segoe UI, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(popup.label, popup.x, popup.y - progress * 48);
            ctx.restore();
        });
    }

    function showBanner(title, detail = "") {
        banners.push({
            title,
            detail,
            createdAt: performance.now(),
            duration: 1250,
        });
    }

    function drawBanners(bounds) {
        const now = performance.now();
        banners.forEach((banner) => {
            const age = now - banner.createdAt;
            const progress = clamp(age / banner.duration, 0, 1);
            const scale = 0.92 + Math.sin(Math.min(1, progress) * Math.PI) * 0.12;
            ctx.save();
            ctx.globalAlpha = progress > 0.75 ? (1 - progress) / 0.25 : 1;
            ctx.translate(bounds.width / 2, bounds.height * 0.34);
            ctx.scale(scale, scale);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#e8f1ff";
            ctx.shadowColor = "#79a9ff";
            ctx.shadowBlur = 20;
            ctx.font = `900 ${clamp(bounds.width * 0.055, 30, 64)}px Segoe UI, sans-serif`;
            ctx.fillText(banner.title, 0, 0);
            if (banner.detail) {
                ctx.shadowBlur = 12;
                ctx.fillStyle = "#9fc0ff";
                ctx.font = `800 ${clamp(bounds.width * 0.026, 15, 24)}px Segoe UI, sans-serif`;
                ctx.fillText(banner.detail, 0, clamp(bounds.height * 0.055, 34, 52));
            }
            ctx.restore();
        });
    }

    function averageCenter(first, second) {
        return {
            x: (first.x + first.width / 2 + second.x + second.width / 2) / 2,
            y: (first.y + first.height / 2 + second.y + second.height / 2) / 2,
        };
    }

    function schedule(callback, delay) {
        const timer = window.setTimeout(() => {
            timers.delete(timer);
            callback();
        }, delay);
        timers.add(timer);
        return timer;
    }

    function clearTimers() {
        timers.forEach((timer) => window.clearTimeout(timer));
        timers.clear();
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
    score.textContent = "Score 0  Lv 1  Pairs 0/6  Moves 0";

    hud.appendChild(title);
    root.append(hud, score);
    session.overlay.appendChild(root);

    return { root, score };
}

function labelFor(symbol) {
    return SYMBOL_LABELS[symbol] || symbol;
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
