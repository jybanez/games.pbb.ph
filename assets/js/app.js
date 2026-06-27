import { helperUiBundleModules as helperBaseBundleModules } from "../helper/helpers.ui.bundle.min.js";
import { helperGameBundleModules } from "../helper/helpers.game.bundle.min.js";

const helperUiBundleModules = {
    ...helperBaseBundleModules,
    ...helperGameBundleModules,
};

const state = JSON.parse(document.getElementById("appState")?.textContent || "{}");
const assetVersion = String(state.assetVersion || "").trim();
const { createNavbar } = helperUiBundleModules["./ui.navbar.js"];
const { createIconGrid } = helperUiBundleModules["./ui.icon.grid.js"];
const { createEmptyState } = helperUiBundleModules["./ui.empty.state.js"];
const { createSelect } = helperUiBundleModules["./ui.select.js"];
const { createIcon } = helperUiBundleModules["./ui.icons.js"];
const { createGameSession } = helperUiBundleModules["./ui.game.core.js"];
const { createGameStateChrome } = helperUiBundleModules["./ui.game.state.chrome.js"];
const { createGameAudio, createStarterGameSounds } = helperUiBundleModules["./ui.game.audio.js"];
const { createBusyOverlay } = helperUiBundleModules["./ui.busy.overlay.js"];

const GAME_AUDIO_MUTED_KEY = "pbb.games.audio.muted";
const GAME_AUDIO_BASE_URL = "assets/sounds/game/";

let activeCategories = [];
let searchTerm = "";
let grid = null;
let emptyView = null;
let categorySelect = null;
let activeGame = null;
let resizeFrame = 0;
let gameFullscreenElement = null;
let gameOrientationLocked = false;
let gameAudio = null;
let gameAudioPreloadPromise = null;

const categoryHost = document.getElementById("categoryFilters");
const gridHost = document.getElementById("gridHost");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("gameSearch");
const sessionHost = document.getElementById("gameSessionHost");
const loadedStyles = new Set();

createNavbar(document.getElementById("navbarHost"), {}, {
    brandText: "PBB Games Corner",
    brandSubtitle: "Local games and learning",
    className: "pbb-launcher-navbar",
    mobileCollapse: false,
    sticky: false,
    contentEnd: () => {
        if (!searchInput) {
            return null;
        }
        const searchHost = document.createElement("div");
        searchHost.className = "pbb-navbar-search";
        searchHost.appendChild(searchInput);
        return searchHost;
    },
});

renderFilters();
renderGrid();

searchInput?.addEventListener("input", () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    renderGrid();
});

function renderFilters() {
    if (!categoryHost) {
        return;
    }

    const items = Object.entries(state.categories || {})
        .filter(([id]) => id !== "all")
        .map(([id, label]) => ({
            value: id,
            label: `${label} (${state.counts?.[id] ?? 0})`,
        }));

    if (!categorySelect) {
        categorySelect = createSelect(categoryHost, items, {
            ariaLabel: "Filter game categories",
            placeholder: `All games (${state.counts?.all ?? 0})`,
            searchable: true,
            multiple: true,
            closeOnSelect: false,
            clearable: true,
            selected: activeCategories,
            onChange(values) {
                activeCategories = Array.isArray(values) ? values : [];
                renderGrid();
            },
        });
        return;
    }

    categorySelect.update(items, {
        selected: activeCategories,
        placeholder: `All games (${state.counts?.all ?? 0})`,
    });
}

function renderGrid() {
    if (!gridHost) {
        return;
    }

    const items = filteredGames().map((game) => ({
        id: game.id,
        label: game.title,
        description: game.description,
        href: game.path,
        image: game.icon_image || "",
        initial: game.icon || game.title.slice(0, 1),
        badge: "",
        status: "unknown",
        tone: toneFor(game.category),
        meta: game,
    }));

    updateEmptyState(items.length);
    if (emptyState) {
        emptyState.hidden = items.length > 0;
    }
    gridHost.hidden = items.length === 0;

    if (!grid) {
        grid = createIconGrid(gridHost, items, {
            ariaLabel: "PBB Games launcher",
            className: "pbb-helper-icon-grid",
            columns: "auto",
            minTileWidth: 132,
            iconSize: 64,
            chrome: false,
            editable: false,
            keyboardReorder: false,
            autoArrange: true,
            scrollable: true,
            maxHeight: "100%",
            emptyText: "No games available.",
            onActivate(item) {
                if (item.meta?.module) {
                    launchGame(item.meta);
                    return;
                }
                if (item.href && item.href !== "#") {
                    window.location.href = item.href;
                }
            },
        });
        return;
    }

    grid.setItems(items);
}

function updateEmptyState(itemCount) {
    if (!emptyState) {
        return;
    }

    const hasSearch = searchTerm.length > 0;
    const title = hasSearch ? "No matching games" : "No games visible";
    const description = hasSearch
        ? "Clear the search filter or choose another category."
        : "Choose another category to see available games.";
    const actions = hasSearch
        ? [{ id: "clear-search", label: "Clear Search", className: "ui-button-primary" }]
        : activeCategories.length > 0
            ? [{ id: "show-all", label: "Show All Games", className: "ui-button-primary" }]
            : [];

    if (!emptyView) {
        emptyView = createEmptyState(emptyState, {
            title,
            description,
            actions,
        }, {
            ariaLabel: "No games visible",
            className: "pbb-helper-empty-state",
            onActionClick(action) {
                if (action.id === "clear-search" && searchInput) {
                    searchInput.value = "";
                    searchTerm = "";
                }
                if (action.id === "show-all") {
                    activeCategories = [];
                    categorySelect?.setValue([]);
                }
                renderGrid();
            },
        });
        return;
    }

    if (itemCount === 0) {
        emptyView.update({ title, description, actions });
    }
}

function filteredGames() {
    return (state.games || []).filter((game) => {
        const matchesCategory = activeCategories.length === 0 || activeCategories.includes(game.category);
        const haystack = [game.title, game.description, ...(game.tags || [])].join(" ").toLowerCase();
        const matchesSearch = !searchTerm || haystack.includes(searchTerm);
        return matchesCategory && matchesSearch;
    });
}

function toneFor(category) {
    if (category === "learning") {
        return "success";
    }
    if (category === "retro") {
        return "warning";
    }
    if (category === "local") {
        return "info";
    }
    return "neutral";
}

async function launchGame(game) {
    if (!sessionHost) {
        navigateToGame(game);
        return;
    }

    if (activeGame?.game?.id === game.id) {
        activeGame.session.root.focus({ preventScroll: true });
        return;
    }

    closeActiveGame("switch");
    const session = createGameSession(sessionHost, {
        title: game.title,
        ariaLabel: `${game.title} game session`,
        className: "pbb-active-game-session",
        fullscreen: true,
        width: window.innerWidth || 1280,
        height: window.innerHeight || 720,
        closeLabel: "Close game",
        closeControl: {
            variant: "icon",
            icon: "actions.close",
        },
        closeOnEscape: false,
        background: "#07101d",
        onClose() {
            cleanupActiveGame(session);
        },
    });

    const stateChrome = createGameStateChrome(session, {
        initialState: "loading",
        labels: {
            close: "Close game",
            pause: "Pause game",
            resume: "Resume",
            restart: "Restart",
            exit: "Home",
        },
        overlays: {
            pause: {
                title: "Paused",
                actions: [
                    "resume",
                    "restart",
                    { id: "exit", label: "Home", nextState: "ready", closeSession: false },
                ],
            },
            result: {
                actions: [
                    { id: "restart", label: "Play Again" },
                    { id: "exit", label: "Home", nextState: "ready", closeSession: false },
                ],
                restartLabel: "Play Again",
            },
        },
        shortcuts: {
            enabled: true,
            pause: ["p", "P"],
            escape: "pause-or-exit",
        },
        onAction(action, detail) {
            return handleStateChromeAction(session, action, detail);
        },
        onStateChange(nextState, previousState, detail) {
            handleStateChromeStateChange(session, nextState, previousState, detail);
        },
    });

    activeGame = {
        game,
        session,
        stateChrome,
        controller: null,
        phase: "loading",
        homeView: null,
        launchSplash: null,
        started: false,
        homeMode: "new",
        acceptModuleState: false,
    };
    resizeActiveSession();
    await requestGameFullscreen();
    await lockGameOrientation(game.orientation);

    const busy = createBusyOverlay({
        text: `Loading ${game.title}...`,
        zIndex: "2147482500",
    });

    try {
        await loadGameAssets(game);
        const module = await import(withAssetVersion(game.module));
        if (typeof module.mountGame !== "function") {
            throw new Error(`Game module ${game.module} must export mountGame(session, options).`);
        }
        const controller = await module.mountGame(session, {
            game,
            helper: helperUiBundleModules,
            sound: createGameSoundInterface(),
            onStateChange(nextPhase, stateDetail) {
                handleGameModuleState(session, nextPhase, stateDetail);
            },
            showMilestone(milestoneOptions) {
                if (activeGame?.session !== session) {
                    return undefined;
                }
                return activeGame.stateChrome?.showMilestone?.(milestoneOptions);
            },
            requestPause() {
                if (activeGame?.session === session) {
                    pauseActiveGame();
                }
            },
        });
        if (!controller || typeof controller.destroy !== "function" || typeof controller.start !== "function") {
            throw new Error(`Game module ${game.module} must return a controller with start() and destroy().`);
        }
        if (activeGame?.session === session) {
            activeGame.controller = controller;
            activeGame.acceptModuleState = true;
            setActiveChromeState(session, "splash");
            renderLaunchSplash(session, game, controller);
        } else {
            controller.destroy();
        }
    } catch (error) {
        renderGameLoadError(session, game, error);
    } finally {
        busy.destroy();
    }
}

function closeActiveGame(reason = "api") {
    if (!activeGame) {
        return;
    }
    const session = activeGame.session;
    if (session.getState?.().closed) {
        cleanupActiveGame(session);
        return;
    }
    session.close(reason);
}

function cleanupActiveGame(session) {
    if (!activeGame || activeGame.session !== session) {
        return;
    }
    activeGame.homeView?.remove();
    activeGame.launchSplash?.remove();
    activeGame.stateChrome?.destroy?.();
    activeGame.controller?.destroy?.();
    activeGame = null;
    unlockGameOrientation();
    exitGameFullscreen();
}

function handleGameModuleState(session, nextPhase, stateDetail = {}) {
    if (!activeGame || activeGame.session !== session) {
        return;
    }
    if (!activeGame.acceptModuleState) {
        return;
    }
    const normalizedState = normalizeGameState(nextPhase);
    setActiveChromeState(session, normalizedState);
    if ((normalizedState === "won" || normalizedState === "gameOver") && stateDetail && typeof stateDetail === "object") {
        playGameSound(normalizedState === "won" ? "win" : "lose");
        activeGame.stateChrome?.showResult?.({
            state: normalizedState,
            title: stateDetail.title,
            detail: stateDetail.detail,
        });
    }
}

function setActiveChromeState(session, nextState) {
    if (!activeGame || activeGame.session !== session) {
        return;
    }
    if (activeGame.stateChrome?.getState?.().state === nextState) {
        handleStateChromeStateChange(session, nextState, activeGame.phase, {});
        return;
    }
    activeGame.stateChrome?.setState(nextState);
}

function handleStateChromeStateChange(session, nextState) {
    if (!activeGame || activeGame.session !== session) {
        return;
    }
    activeGame.phase = nextState;
    if (nextState === "ready") {
        renderGameHome(activeGame);
        return;
    }
    clearGameHome(activeGame);
}

function normalizeGameState(nextPhase) {
    const value = String(nextPhase || "").trim();
    if (value === "won" || value === "gameOver" || value === "playing" || value === "paused") {
        return value;
    }
    return "playing";
}

function handleStateChromeAction(session, action, detail = {}) {
    if (!activeGame || activeGame.session !== session) {
        return undefined;
    }

    if (action === "pause") {
        activeGame.controller?.pause?.();
        playGameSound("pause");
        return undefined;
    }

    if (action === "resume") {
        clearGameHome(activeGame);
        activeGame.controller?.resume?.();
        activeGame.started = true;
        playGameSound("select");
        return undefined;
    }

    if (action === "restart") {
        clearGameHome(activeGame);
        activeGame.homeMode = "new";
        activeGame.started = true;
        activeGame.controller?.restart?.();
        playGameSound("select");
        return undefined;
    }

    if (action === "exit" && detail.actionConfig?.closeSession === false) {
        activeGame.controller?.pause?.();
        activeGame.homeMode = activeGame.phase === "paused" ? "resume" : "new";
        playGameSound("select");
        return undefined;
    }

    return undefined;
}

function pauseActiveGame() {
    if (!activeGame || activeGame.phase !== "playing") {
        return;
    }
    activeGame.controller?.pause?.();
    playGameSound("pause");
    setActiveChromeState(activeGame.session, "paused");
}

function resumeActiveGame() {
    if (!activeGame || activeGame.phase !== "paused") {
        return;
    }
    clearGameHome(activeGame);
    activeGame.controller?.resume?.();
    activeGame.started = true;
    playGameSound("select");
    setActiveChromeState(activeGame.session, "playing");
    activeGame.session.root.focus({ preventScroll: true });
}

function restartActiveGame() {
    if (!activeGame) {
        return;
    }
    clearGameHome(activeGame);
    activeGame.homeMode = "new";
    activeGame.controller?.restart?.();
    activeGame.started = true;
    playGameSound("select");
    setActiveChromeState(activeGame.session, "playing");
    activeGame.session.root.focus({ preventScroll: true });
}

function createGameSoundInterface() {
    return {
        play(id, options) {
            return playGameSound(id, options);
        },
    };
}

function getGameAudio() {
    if (gameAudio || typeof createGameAudio !== "function" || typeof createStarterGameSounds !== "function") {
        return gameAudio;
    }

    gameAudio = createGameAudio({
        muted: isGameAudioMuted(),
        sounds: createStarterGameSounds({
            baseUrl: GAME_AUDIO_BASE_URL,
        }),
    });
    return gameAudio;
}

async function unlockGameAudio() {
    const audio = getGameAudio();
    if (!audio) {
        return false;
    }

    try {
        await audio.unlock?.();
        gameAudioPreloadPromise = gameAudioPreloadPromise || Promise.resolve(audio.preload?.()).catch((error) => {
            console.info("[PBB Games] Game sound preload was not completed.", error);
            return null;
        });
        return true;
    } catch (error) {
        console.info("[PBB Games] Game audio unlock was not accepted by the browser.", error);
        return false;
    }
}

function playGameSound(id, options = {}) {
    const audio = getGameAudio();
    if (!audio || isGameAudioMuted()) {
        return null;
    }

    try {
        return audio.play(id, options);
    } catch (error) {
        console.info(`[PBB Games] Unable to play game sound "${id}".`, error);
        return null;
    }
}

function setGameAudioMuted(muted) {
    const nextMuted = !!muted;
    try {
        window.localStorage?.setItem(GAME_AUDIO_MUTED_KEY, nextMuted ? "1" : "0");
    } catch {
        // Ignore blocked storage; the live audio controller still reflects the choice.
    }
    getGameAudio()?.setMuted?.(nextMuted);
}

function isGameAudioMuted() {
    try {
        return window.localStorage?.getItem(GAME_AUDIO_MUTED_KEY) === "1";
    } catch {
        return false;
    }
}

function syncGameAudioToggle(button) {
    const muted = isGameAudioMuted();
    if (button.classList.contains("pbb-game-home-icon-button")) {
        button.replaceChildren(createIcon(muted ? "actions.volume-muted" : "actions.volume", {
            size: 20,
            decorative: true,
        }));
    } else {
        button.textContent = muted ? "Sound Off" : "Sound On";
    }
    button.setAttribute("aria-pressed", muted ? "false" : "true");
    button.setAttribute("aria-label", muted ? "Turn game sound on" : "Turn game sound off");
    button.title = button.getAttribute("aria-label");
}

window.addEventListener("resize", () => {
    if (!activeGame?.session) {
        return;
    }
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(resizeActiveSession);
});

function resizeActiveSession() {
    if (!activeGame?.session) {
        return;
    }
    activeGame.session.resize(window.innerWidth || 1280, window.innerHeight || 720);
}

async function requestGameFullscreen() {
    if (!sessionHost || isStandaloneDisplay() || !isMobileBrowser()) {
        return false;
    }

    const request = sessionHost.requestFullscreen
        || sessionHost.webkitRequestFullscreen
        || sessionHost.msRequestFullscreen;

    if (typeof request !== "function" || document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
        return false;
    }

    try {
        await request.call(sessionHost);
        gameFullscreenElement = sessionHost;
        return true;
    } catch (error) {
        console.info("[PBB Games] Fullscreen request was not accepted by the browser.", error);
        return false;
    }
}

async function lockGameOrientation(orientationPreference = "any") {
    const preference = normalizeOrientationPreference(orientationPreference);
    if (preference === "any") {
        return false;
    }

    const orientation = screen.orientation;
    if (!orientation || typeof orientation.lock !== "function") {
        return false;
    }

    try {
        await orientation.lock(preference);
        gameOrientationLocked = true;
        return true;
    } catch (error) {
        console.info("[PBB Games] Landscape orientation lock was not accepted by the browser.", error);
        return false;
    }
}

function normalizeOrientationPreference(orientationPreference) {
    const value = String(orientationPreference || "any").trim().toLowerCase();
    return ["any", "portrait", "landscape"].includes(value) ? value : "any";
}

function unlockGameOrientation() {
    if (!gameOrientationLocked) {
        return;
    }
    gameOrientationLocked = false;
    if (screen.orientation && typeof screen.orientation.unlock === "function") {
        screen.orientation.unlock();
    }
}

function exitGameFullscreen() {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
    if (!gameFullscreenElement || fullscreenElement !== gameFullscreenElement) {
        gameFullscreenElement = null;
        return;
    }

    const exit = document.exitFullscreen
        || document.webkitExitFullscreen
        || document.msExitFullscreen;

    gameFullscreenElement = null;
    if (typeof exit === "function") {
        Promise.resolve(exit.call(document)).catch((error) => {
            console.info("[PBB Games] Fullscreen exit was not accepted by the browser.", error);
        });
    }
}

function isStandaloneDisplay() {
    return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function isMobileBrowser() {
    if (typeof navigator.userAgentData?.mobile === "boolean") {
        return navigator.userAgentData.mobile;
    }

    const userAgent = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(userAgent)) {
        return true;
    }

    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    const noHover = window.matchMedia?.("(hover: none)")?.matches;
    const shortSide = Math.min(window.screen?.width || 0, window.screen?.height || 0);
    return !!(coarsePointer && noHover && shortSide > 0 && shortSide <= 1024);
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

function withAssetVersion(path) {
    if (!path || !assetVersion || /^(https?:)?\/\//.test(path) || /[?&]v=/.test(path)) {
        return path;
    }
    return `${path}${path.includes("?") ? "&" : "?"}v=${encodeURIComponent(assetVersion)}`;
}

function renderGameLoadError(session, game, error) {
    console.error("[PBB Games] Failed to load game.", error);
    session.overlay.innerHTML = "";
    const panel = document.createElement("section");
    panel.className = "pbb-game-session-message";
    panel.innerHTML = `
        <p class="ui-eyebrow">Game unavailable</p>
        <h2 class="ui-title"></h2>
        <p></p>
        <div class="ui-inline">
            <button class="ui-button ui-button-primary" type="button">Back to Games</button>
            <a class="ui-button ui-button-ghost" href="${escapeAttribute(game.path || "#")}">Open game page</a>
        </div>
    `;
    panel.querySelector("h2").textContent = game.title;
    panel.querySelector("p:not(.ui-eyebrow)").textContent = error?.message || "The game could not be loaded.";
    panel.querySelector("button").addEventListener("click", () => session.close("load-error"));
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
        media.textContent = game.icon || game.title.slice(0, 1);
    }

    const content = document.createElement("div");
    content.className = "pbb-game-launch-content";

    const hero = document.createElement("div");
    hero.className = "pbb-game-launch-hero";

    const icon = document.createElement("div");
    icon.className = "pbb-game-launch-icon";
    if (game.icon_image) {
        const iconImage = document.createElement("img");
        iconImage.src = game.icon_image;
        iconImage.alt = "";
        iconImage.decoding = "async";
        icon.appendChild(iconImage);
    } else {
        icon.textContent = game.icon || game.title.slice(0, 1);
    }

    const heading = document.createElement("div");
    heading.className = "pbb-game-launch-heading";

    const eyebrow = document.createElement("p");
    eyebrow.className = "ui-eyebrow";
    eyebrow.textContent = game.category ? `${game.category} game` : "Game";

    const title = document.createElement("h2");
    title.className = "ui-title";
    title.textContent = game.title;

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

    const actions = document.createElement("div");
    actions.className = "ui-inline";

    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.className = "ui-button ui-button-primary pbb-game-launch-start";
    startButton.textContent = launch.enter_label || "Enter Game";
    startButton.addEventListener("click", () => {
        startButton.disabled = true;
        unlockGameAudio().then(() => playGameSound("select"));
        panel.remove();
        if (activeGame?.session === session) {
            activeGame.launchSplash = null;
            activeGame.homeMode = "new";
            setActiveChromeState(session, "ready");
        }
    }, { once: true });

    actions.appendChild(startButton);
    heading.append(eyebrow, title, objective);
    hero.append(icon, heading);
    content.appendChild(hero);
    if (controls.childElementCount > 0) {
        content.appendChild(controls);
    }
    content.appendChild(actions);
    panel.append(media, content);
    session.overlay.appendChild(panel);
    if (activeGame?.session === session) {
        activeGame.launchSplash = panel;
    }
    startButton.focus({ preventScroll: true });
}

function renderGameHome(gameState) {
    if (!gameState?.session || gameState.homeView?.isConnected) {
        return;
    }

    const { game, session } = gameState;
    const launch = game.launch || {};
    const home = document.createElement("section");
    home.className = "pbb-game-home";
    home.setAttribute("aria-label", `${game.title} home`);

    const homeImage = launch.home_image || launch.splash_image || "";
    if (homeImage) {
        home.classList.add("has-home-image");
        const background = document.createElement("img");
        background.className = "pbb-game-home-bg";
        background.src = homeImage;
        background.alt = "";
        background.decoding = "async";
        background.loading = "eager";
        home.appendChild(background);
    }

    const hud = document.createElement("div");
    hud.className = "pbb-game-home-hud";

    const hudActions = document.createElement("div");
    hudActions.className = "pbb-game-home-hud-actions";

    const bestText = homeBestText(game);
    if (bestText) {
        const best = document.createElement("div");
        best.className = "pbb-game-home-stat";
        const bestLabel = document.createElement("span");
        bestLabel.textContent = "Best";
        const bestValue = document.createElement("strong");
        bestValue.textContent = bestText;
        best.append(bestLabel, bestValue);
        hud.appendChild(best);
    }

    const soundToggle = document.createElement("button");
    soundToggle.type = "button";
    soundToggle.className = "ui-button ui-button-quiet pbb-game-home-icon-button pbb-game-sound-toggle";
    syncGameAudioToggle(soundToggle);
    soundToggle.addEventListener("click", () => {
        setGameAudioMuted(!isGameAudioMuted());
        syncGameAudioToggle(soundToggle);
        unlockGameAudio().then(() => playGameSound("select"));
    });

    hudActions.appendChild(soundToggle);
    hud.appendChild(hudActions);

    const content = document.createElement("div");
    content.className = "pbb-game-home-content";

    const actions = document.createElement("div");
    actions.className = "ui-inline pbb-game-home-actions";

    const play = document.createElement("button");
    play.type = "button";
    play.className = "ui-button ui-button-primary pbb-game-home-play";
    play.textContent = gameState.homeMode === "resume" ? "Continue Playing" : "Play Now";
    play.addEventListener("click", () => {
        startPlayingFromHome(gameState).catch((error) => renderGameLoadError(session, game, error));
    });

    actions.append(play);
    content.appendChild(actions);
    home.append(hud, content);
    session.overlay.appendChild(home);
    gameState.homeView = home;
    play.focus({ preventScroll: true });
}

function clearGameHome(gameState) {
    gameState?.homeView?.remove();
    if (gameState) {
        gameState.homeView = null;
    }
}

async function startPlayingFromHome(gameState) {
    if (!gameState || activeGame !== gameState) {
        return;
    }

    await unlockGameAudio();
    playGameSound("select");
    clearGameHome(gameState);
    setActiveChromeState(gameState.session, "countdown");
    await playLaunchCountdown(gameState.session.overlay);
    if (activeGame !== gameState) {
        return;
    }

    await lockGameOrientation(gameState.game.orientation);
    if (!gameState.started) {
        await Promise.resolve(gameState.controller?.start?.());
        gameState.started = true;
    } else if (gameState.homeMode === "resume") {
        await Promise.resolve(gameState.controller?.resume?.());
    } else {
        await Promise.resolve(gameState.controller?.restart?.());
    }

    gameState.homeMode = "new";
    setActiveChromeState(gameState.session, "playing");
    gameState.session.root.focus({ preventScroll: true });
}

function homeBestText(game) {
    return "";
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

function navigateToGame(game) {
    if (game.path && game.path !== "#") {
        window.location.href = game.path;
    }
}

function escapeAttribute(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char]));
}
