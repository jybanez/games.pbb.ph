export async function mountGame(session, options = {}) {
    const { createGameLoop } = options.helper["./ui.game.core.js"];
    const { createGameObjectLayer, createPointerInputRouter, createFlipCard } = options.helper["./ui.game.objects.js"];
    const layer = session.addLayer({ id: "memory-board", zIndex: 1, smoothing: true });
    const ctx = layer.context;
    const ui = createShell(session, options.game || { title: "Memory Cards" });
    const sound = options.sound;

    const symbols = ["W", "W", "R", "R", "K", "K", "F", "F", "M", "M", "L", "L"];
    let deck = [];
    let cards = [];
    let selected = [];
    let matches = 0;
    let moves = 0;
    let resolving = false;
    let paused = false;
    let hideTimeout = 0;

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
            window.clearTimeout(hideTimeout);
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
        window.clearTimeout(hideTimeout);
        objectLayer.clear();
        deck = shuffle(symbols).map((symbol, index) => ({
            id: `memory-card-${index + 1}`,
            symbol,
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
        options.onStateChange?.("playing");
        layoutCards();
        syncScore();
        draw();
    }

    function selectCard(card) {
        if (paused || resolving || card.matched || selected.includes(card)) {
            if (resolving && !card.matched && !selected.includes(card)) {
                card.hide();
            }
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
            first.setMatched(true);
            second.setMatched(true);
            selected = [];
            matches += 1;
            resolving = false;
            sound?.play?.("match");
            syncScore();
            if (matches === symbols.length / 2) {
                options.onStateChange?.("won", { title: "All Matched", detail: `Moves ${moves}` });
            }
            return;
        }

        sound?.play?.("error", { volume: 0.45 });
        syncScore();
        hideTimeout = window.setTimeout(() => {
            first.hide();
            second.hide();
            selected = [];
            resolving = false;
        }, 620);
    }

    function layoutCards() {
        const bounds = getBoardBounds();
        const columns = 4;
        const rows = 3;
        const gap = clamp(Math.min(bounds.width, bounds.height) * 0.025, 8, 18);
        const topReserve = clamp(bounds.height * 0.16, 54, 86);
        const bottomReserve = clamp(bounds.height * 0.13, 44, 74);
        const sideReserve = clamp(bounds.width * 0.055, 16, 72);
        const availableWidth = Math.max(180, bounds.width - sideReserve * 2);
        const availableHeight = Math.max(180, bounds.height - topReserve - bottomReserve);
        const maxCardWidth = (availableWidth - gap * (columns - 1)) / columns;
        const maxCardHeight = (availableHeight - gap * (rows - 1)) / rows;
        const cardHeight = Math.max(58, Math.min(maxCardHeight, maxCardWidth * 1.28));
        const cardWidth = Math.max(46, Math.min(maxCardWidth, cardHeight * 0.78));
        const boardWidth = cardWidth * columns + gap * (columns - 1);
        const boardHeight = cardHeight * rows + gap * (rows - 1);
        const startX = (bounds.width - boardWidth) / 2;
        const startY = topReserve + (availableHeight - boardHeight) / 2;

        cards.forEach((card, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            card
                .setPosition(startX + column * (cardWidth + gap), startY + row * (cardHeight + gap))
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
        ui.score.textContent = `Pairs ${matches}/${symbols.length / 2}  Moves ${moves}`;
    }

    function draw() {
        const bounds = getBoardBounds();
        ctx.clearRect(0, 0, bounds.width, bounds.height);
        ctx.fillStyle = "#07101d";
        ctx.fillRect(0, 0, bounds.width, bounds.height);
        drawBoardTexture(bounds);
        objectLayer.render(ctx);
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
        drawRoundedCard(context, card.width, card.height, "#e6f0ff", card.matched ? "#54d3a5" : "#8db5ff");
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
        drawRoundedCard(context, card.width, card.height, card.hover ? "#172843" : "#101b2e", card.hover ? "#79a9ff" : "#36517f");
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

    function drawRoundedCard(context, width, height, fill, stroke) {
        const radius = Math.min(14, width * 0.14, height * 0.12);
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
        context.fillStyle = fill;
        context.strokeStyle = stroke;
        context.lineWidth = Math.max(2, width * 0.035);
        context.fill();
        context.stroke();
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
    score.textContent = "Pairs 0/6  Moves 0";

    hud.appendChild(title);
    root.append(hud, score);
    session.overlay.appendChild(root);

    return { root, score };
}

function labelFor(symbol) {
    return {
        W: "Water",
        R: "Radio",
        K: "Kit",
        F: "First aid",
        M: "Map",
        L: "Light",
    }[symbol] || symbol;
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
