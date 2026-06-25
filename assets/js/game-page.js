import { helperUiBundleModules as helperBaseBundleModules } from "../helper/helpers.ui.bundle.min.js";
import { helperGameBundleModules } from "../helper/helpers.game.bundle.min.js";

const helperUiBundleModules = {
    ...helperBaseBundleModules,
    ...helperGameBundleModules,
};

const state = JSON.parse(document.getElementById("directGameState")?.textContent || "{}");
const { createGameSession } = helperUiBundleModules["./ui.game.core.js"];
const { createBusyOverlay } = helperUiBundleModules["./ui.busy.overlay.js"];
const host = document.getElementById("directGameHost");
const loadedStyles = new Set();
let activeSession = null;
let resizeFrame = 0;

if (host && state.module) {
    mountDirectGame();
}

async function mountDirectGame() {
    const session = createGameSession(host, {
        title: state.title,
        ariaLabel: `${state.title} game session`,
        className: "pbb-direct-game-session",
        fullscreen: false,
        width: host.clientWidth || window.innerWidth || 960,
        height: host.clientHeight || window.innerHeight || 720,
        closeLabel: "Close game",
        closeControl: {
            variant: "icon",
            icon: "actions.close",
        },
        background: "#07101d",
        onClose() {
            window.location.href = "/";
        },
    });
    activeSession = session;
    resizeActiveSession();

    const busy = createBusyOverlay(host, {
        text: `Loading ${state.title}...`,
        visible: true,
    });

    try {
        await loadGameAssets(state);
        const module = await import(state.module);
        if (typeof module.mountGame !== "function") {
            throw new Error(`Game module ${state.module} must export mountGame(session, options).`);
        }
        const controller = await module.mountGame(session, {
            game: state,
            helper: helperUiBundleModules,
        });
        if (!controller || typeof controller.destroy !== "function" || typeof controller.start !== "function") {
            throw new Error(`Game module ${state.module} must return a controller with start() and destroy().`);
        }
        session.on("close", () => controller.destroy());
        renderLaunchSplash(session, state, controller);
    } catch (error) {
        renderError(session, error);
    } finally {
        busy.destroy();
    }
}

window.addEventListener("resize", () => {
    if (!activeSession) {
        return;
    }
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(resizeActiveSession);
});

function resizeActiveSession() {
    if (!activeSession || !host) {
        return;
    }
    activeSession.resize(host.clientWidth || window.innerWidth || 960, host.clientHeight || window.innerHeight || 720);
}

async function loadGameAssets(game) {
    await Promise.all([
        loadStyles(game.styles || []),
        preloadAssets(game.assets || []),
    ]);
}

function loadStyles(paths) {
    return Promise.all(paths.map((path) => {
        if (!path || loadedStyles.has(path)) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = path;
            link.dataset.gameStyle = path;
            link.addEventListener("load", () => {
                loadedStyles.add(path);
                resolve();
            }, { once: true });
            link.addEventListener("error", () => reject(new Error(`Unable to load stylesheet ${path}`)), { once: true });
            document.head.appendChild(link);
        });
    }));
}

function preloadAssets(paths) {
    return Promise.all(paths.map((path) => {
        if (!path) {
            return Promise.resolve();
        }
        return fetch(path, { cache: "force-cache" }).then((response) => {
            if (!response.ok) {
                throw new Error(`Unable to load asset ${path}`);
            }
        });
    }));
}

function renderError(session, error) {
    console.error("[PBB Games] Failed to load direct game.", error);
    session.overlay.innerHTML = "";
    const panel = document.createElement("section");
    panel.className = "pbb-game-session-message";
    const title = document.createElement("h2");
    title.className = "ui-title";
    title.textContent = state.title || "Game";
    const message = document.createElement("p");
    message.textContent = error?.message || "The game could not be loaded.";
    panel.append(title, message);
    session.overlay.appendChild(panel);
}

function renderLaunchSplash(session, game, controller) {
    const launch = game.launch || {};
    const panel = document.createElement("section");
    panel.className = "pbb-game-launch-splash";
    panel.setAttribute("aria-label", `${game.title} launch screen`);

    const media = document.createElement("div");
    media.className = "pbb-game-launch-media";
    if (launch.splash_image) {
        panel.classList.add("has-splash-image");
        const image = document.createElement("img");
        image.src = launch.splash_image;
        image.alt = "";
        image.decoding = "async";
        image.loading = "eager";
        media.appendChild(image);
    } else {
        media.textContent = game.title ? game.title.slice(0, 1) : "G";
    }

    const content = document.createElement("div");
    content.className = "pbb-game-launch-content";

    const eyebrow = document.createElement("p");
    eyebrow.className = "ui-eyebrow";
    eyebrow.textContent = game.category || "Game";

    const title = document.createElement("h2");
    title.className = "ui-title";
    title.textContent = game.title || "Game";

    const objective = document.createElement("p");
    objective.className = "pbb-game-launch-objective";
    objective.textContent = launch.objective || game.description || "Get ready to play.";

    const controls = document.createElement("div");
    controls.className = "pbb-game-launch-controls";
    (launch.controls || []).forEach((label) => {
        const badge = document.createElement("span");
        badge.className = "ui-badge";
        badge.textContent = label;
        controls.appendChild(badge);
    });

    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.className = "ui-button ui-button-primary";
    startButton.textContent = launch.start_label || "Start";
    startButton.addEventListener("click", async () => {
        startButton.disabled = true;
        try {
            panel.remove();
            await playLaunchCountdown(session.overlay);
            await Promise.resolve(controller.start());
            session.root.focus({ preventScroll: true });
        } catch (error) {
            renderError(session, error);
        }
    }, { once: true });

    content.append(eyebrow, title, objective);
    if (controls.childElementCount > 0) {
        content.appendChild(controls);
    }
    content.appendChild(startButton);
    panel.append(media, content);
    session.overlay.appendChild(panel);
    startButton.focus({ preventScroll: true });
}

async function playLaunchCountdown(container) {
    const overlay = document.createElement("div");
    overlay.className = "pbb-game-countdown-overlay";
    overlay.setAttribute("aria-live", "assertive");
    overlay.setAttribute("aria-label", "Game starting countdown");

    const number = document.createElement("span");
    number.className = "pbb-game-countdown-number";
    overlay.appendChild(number);
    container.appendChild(overlay);

    for (const value of ["3", "2", "1"]) {
        number.textContent = value;
        number.classList.remove("is-ticking");
        number.getBoundingClientRect();
        number.classList.add("is-ticking");
        await wait(850);
    }

    overlay.remove();
}

function wait(duration) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, duration);
    });
}
