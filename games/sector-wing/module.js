const LEVEL_DEFINITIONS = [
    {
        id: "sector-one",
        level: 1,
        title: "Sector One",
        durationSeconds: 44,
        scrollSpeed: 118,
        playerSpeed: 270,
        fireCooldown: 0.18,
        enemySpeed: 150,
        spawnEvery: 1.16,
        energyEvery: 6.5,
        shieldEvery: 15,
        hazardChance: 0.28,
        enemyMix: { drone: 0.68, weaver: 0.24, interceptor: 0.08 },
        powerupEvery: 14,
        segments: [
            { id: "opening-run", from: 0, to: 10, pattern: "light" },
            { id: "hazard-field", from: 10, to: 24, pattern: "hazards" },
            { id: "exit-wave", from: 24, to: 44, pattern: "mixed" },
        ],
        boss: null,
        clearBonus: 500,
        noDamageBonus: 750,
    },
    {
        id: "signal-drift",
        level: 2,
        title: "Signal Drift",
        durationSeconds: 50,
        scrollSpeed: 142,
        playerSpeed: 280,
        fireCooldown: 0.165,
        enemySpeed: 178,
        spawnEvery: 0.98,
        energyEvery: 6,
        shieldEvery: 14,
        hazardChance: 0.38,
        enemyMix: { drone: 0.44, weaver: 0.38, interceptor: 0.18 },
        powerupEvery: 12,
        segments: [
            { id: "drift-entry", from: 0, to: 12, pattern: "weavers" },
            { id: "signal-shear", from: 12, to: 33, pattern: "mixed" },
            { id: "close-run", from: 33, to: 50, pattern: "interceptors" },
        ],
        boss: null,
        clearBonus: 700,
        noDamageBonus: 750,
    },
    {
        id: "guardian-route",
        level: 3,
        title: "Guardian Route",
        durationSeconds: 58,
        scrollSpeed: 158,
        playerSpeed: 288,
        fireCooldown: 0.15,
        enemySpeed: 196,
        spawnEvery: 0.86,
        energyEvery: 5.4,
        shieldEvery: 13,
        hazardChance: 0.45,
        enemyMix: { drone: 0.34, weaver: 0.36, interceptor: 0.3 },
        powerupEvery: 11,
        segments: [
            { id: "guardian-approach", from: 0, to: 16, pattern: "mixed" },
            { id: "pressure-lane", from: 16, to: 37, pattern: "interceptors" },
            { id: "guardian-stand", from: 37, to: 58, pattern: "guardian" },
        ],
        boss: {
            appearAt: 37,
            health: 28,
            speed: 94,
            fireEvery: 1.25,
        },
        clearBonus: 1000,
        noDamageBonus: 900,
    },
];

const ENEMY_TYPES = {
    drone: {
        health: 8,
        score: 50,
        speed: 1,
        radiusScale: 1,
        color: "#8f7cff",
        core: "#ff8ea3",
        drift: [4, 12],
    },
    weaver: {
        health: 7,
        score: 75,
        speed: 1.08,
        radiusScale: 0.95,
        color: "#ff8bd1",
        core: "#ffd1ec",
        drift: [34, 56],
        wave: [3.4, 5.2],
    },
    interceptor: {
        health: 14,
        score: 120,
        speed: 1.18,
        radiusScale: 1.08,
        color: "#ffd166",
        core: "#fff1b8",
        drift: [10, 20],
        trackStrength: 0.92,
    },
};

const POWERUP_TYPES = {
    spread: { label: "Spread", color: "#ffd166", duration: 7.5 },
    overcharge: { label: "Overcharge", color: "#56d6ff", duration: 6.5 },
};

const PLAYER_RADIUS = 18;
const PLAYER_MAX_ENERGY = 100;
const PLAYER_MAX_SHIELD = 100;
const PLAYER_START_ENERGY = 100;
const PLAYER_START_SHIELD = 70;
const PLAYER_START_LIVES = 3;
const PLAYER_RESPAWN_SECONDS = 0.9;
const PLAYER_RESPAWN_DELAY_SECONDS = 0.88;

export function mountGame(session, options = {}) {
    const { createGameLoop, createVirtualJoystick, createGameActionButtonGroup } = options.helper["./ui.game.core.js"];
    const layer = session.addLayer({ id: "sector-wing-stage", zIndex: 1, smoothing: true });
    const ctx = layer.context;
    const ui = createShell(session, options.game || { title: "Sector Wing" });
    const sound = options.sound;

    let metrics = getMetrics();
    let player = createPlayer(metrics);
    let keys = new Set();
    let joystickVector = { x: 0, y: 0, force: 0 };
    let fireHeld = false;
    let fireCooldown = 0;
    let levelIndex = 0;
    let levelTime = 0;
    let routeClearTimer = 0;
    let spawnTimer = 0;
    let energyTimer = 0;
    let shieldTimer = 0;
    let powerupTimer = 0;
    let bossFireTimer = 0;
    let bossSpawned = false;
    let screenShake = 0;
    let score = 0;
    let damageTakenThisLevel = false;
    let paused = false;
    let done = false;
    let stars = createStars(metrics);
    let projectiles = [];
    let enemies = [];
    let hazards = [];
    let pickups = [];
    let enemyShots = [];
    let effects = [];
    let banners = [];
    let activePowerups = createPowerupState();

    const joystick = createVirtualJoystick(ui.movementControls, {
        visibility: "ghost",
        radius: 62,
        onMove(vector) {
            joystickVector = vector || { x: 0, y: 0, force: 0 };
        },
        onEnd() {
            joystickVector = { x: 0, y: 0, force: 0 };
        },
    });

    const actions = createGameActionButtonGroup(ui.actions, {
        visibility: "overlay",
        layout: "row",
        buttons: [
            {
                id: "fire",
                label: "Fire",
                ariaLabel: "Fire pulse",
                icon: "media.gamepad",
                repeat: true,
                repeatDelay: 80,
                buttonClassName: "ui-button-primary",
                onPress() {
                    fireHeld = true;
                    fire();
                },
                onRepeat() {
                    fireHeld = true;
                    fire();
                },
                onRelease() {
                    fireHeld = false;
                },
            },
        ],
    });

    const loop = createGameLoop({
        autoStart: false,
        update({ delta }) {
            metrics = getMetrics();
            updateEffects(delta);
            if (paused) {
                return;
            }
            if (!done) {
                update(delta);
            }
        },
        render() {
            draw();
        },
    });

    const resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(handleResize)
        : null;
    resizeObserver?.observe(session.viewport);
    session.viewport.style.touchAction = "none";
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("keyup", handleKeyup);
    window.addEventListener("resize", handleResize);

    reset();

    return {
        start() {
            loop.start();
        },
        destroy() {
            loop.stop();
            joystick.destroy();
            actions.destroy?.();
            resizeObserver?.disconnect();
            session.viewport.style.touchAction = "";
            window.removeEventListener("keydown", handleKeydown);
            window.removeEventListener("keyup", handleKeyup);
            window.removeEventListener("resize", handleResize);
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

    function update(delta) {
        const level = getLevel();
        levelTime += delta;
        player.energy = clamp(player.energy + 14 * delta, 0, PLAYER_MAX_ENERGY);
        fireCooldown = Math.max(0, fireCooldown - delta);
        spawnTimer -= delta;
        energyTimer -= delta;
        shieldTimer -= delta;
        powerupTimer -= delta;
        bossFireTimer -= delta;
        screenShake = Math.max(0, screenShake - delta);
        updateActivePowerups(delta);

        updateStars(delta, level);
        updatePlayer(delta, level);
        if (fireHeld) {
            fire();
        }
        spawnLevelObjects(level);
        updateProjectiles(delta, level);
        updateEnemies(delta, level);
        updateHazards(delta, level);
        updatePickups(delta, level);
        updateEnemyShots(delta);
        handleCollisions(level);
        syncHud();

        if (routeClearTimer > 0) {
            routeClearTimer = Math.max(0, routeClearTimer - delta);
            if (routeClearTimer === 0) {
                completeRouteClear();
            }
            return;
        }

        if (levelTime >= level.durationSeconds && !enemies.some((enemy) => enemy.type === "guardian")) {
            beginRouteClear();
        }
    }

    function updatePlayer(delta, level) {
        player.invulnerable = Math.max(0, player.invulnerable - delta);
        player.hitFlash = Math.max(0, player.hitFlash - delta);
        player.respawnDelay = Math.max(0, player.respawnDelay - delta);
        if (player.pendingArrival && player.respawnDelay <= 0) {
            player.pendingArrival = false;
            player.respawnTimer = PLAYER_RESPAWN_SECONDS;
            player.invulnerable = Math.max(player.invulnerable, PLAYER_RESPAWN_SECONDS + 0.85);
            effects.push(createJumpArrival(player.x, player.y));
        }
        player.respawnTimer = Math.max(0, player.respawnTimer - delta);
        if (player.respawnDelay > 0 || player.respawnTimer > 0) {
            return;
        }
        const input = getInputVector();
        const speed = level.playerSpeed;
        player.x = clamp(player.x + input.x * speed * delta, player.radius + 5, metrics.width - player.radius - 5);
        player.y = clamp(player.y + input.y * speed * delta, player.radius + 5, metrics.height - player.radius - 5);
        player.trailTimer -= delta;
        if (player.trailTimer <= 0) {
            player.trailTimer = 0.045;
            effects.push({
                type: "trail",
                x: player.x - player.radius * 0.85,
                y: player.y,
                age: 0,
                duration: 0.34,
                color: "#56d6ff",
            });
        }
    }

    function spawnLevelObjects(level) {
        if (routeClearTimer > 0) {
            return;
        }
        if (spawnTimer <= 0) {
            spawnTimer = level.spawnEvery * (0.82 + Math.random() * 0.38);
            if (Math.random() < level.hazardChance) {
                spawnHazard(level);
            } else {
                spawnEnemy(level);
            }
        }
        if (energyTimer <= 0) {
            energyTimer = level.energyEvery * (0.72 + Math.random() * 0.45);
            spawnPickup("energy");
        }
        if (shieldTimer <= 0) {
            shieldTimer = level.shieldEvery * (0.8 + Math.random() * 0.42);
            spawnPickup("shield");
        }
        if (powerupTimer <= 0) {
            powerupTimer = level.powerupEvery * (0.82 + Math.random() * 0.36);
            if (Math.random() < 0.72) {
                spawnPickup(Math.random() < 0.55 ? "spread" : "overcharge");
            }
        }
        if (level.boss && !bossSpawned && levelTime >= level.boss.appearAt && !enemies.some((enemy) => enemy.type === "guardian")) {
            bossSpawned = true;
            enemies.push(createGuardian(level));
            banners.push(createBanner("Route Guardian", "Hold the lane and finish the sector", "#ffd166", 1.6));
            effects.push(createRoutePulse(metrics.width * 0.77, metrics.height * 0.5, "#ffd166", 1.35));
            screenShake = Math.max(screenShake, 0.24);
            sound?.play?.("select", { volume: 0.52 });
        }
    }

    function updateProjectiles(delta, level) {
        projectiles.forEach((shot) => {
            shot.prevX = shot.x;
            shot.prevY = shot.y;
            shot.x += shot.vx * delta;
            shot.y += shot.vy * delta;
            shot.life -= delta;
            shot.wobble += delta * 16;
        });
        projectiles = projectiles.filter((shot) => shot.x < metrics.width + 80 && shot.y > -60 && shot.y < metrics.height + 60 && shot.life > 0);

        if (level.boss && bossFireTimer <= 0) {
            const guardian = enemies.find((enemy) => enemy.type === "guardian");
            if (guardian) {
                bossFireTimer = level.boss.fireEvery;
                const angle = Math.atan2(player.y - guardian.y, player.x - guardian.x);
                enemyShots.push({
                    x: guardian.x - guardian.radius * 0.9,
                    y: guardian.y,
                    vx: Math.cos(angle) * 220,
                    vy: Math.sin(angle) * 220,
                    radius: 7,
                    damage: 26,
                    age: 0,
                    duration: 1.8,
                    life: 3.5,
                });
            }
        }
    }

    function updateEnemyShots(delta) {
        enemyShots.forEach((shot) => {
            shot.x += shot.vx * delta;
            shot.y += shot.vy * delta;
            shot.life -= delta;
        });
        enemyShots = enemyShots.filter((shot) => shot.life > 0 && shot.x > -60 && shot.y > -60 && shot.y < metrics.height + 60);
    }

    function updateEnemies(delta, level) {
        enemies.forEach((enemy) => {
            if (enemy.type === "guardian") {
                const targetX = metrics.width * 0.79;
                enemy.x += (targetX - enemy.x) * Math.min(1, delta * 1.9);
                enemy.y += Math.sin(levelTime * 2.2) * level.boss.speed * delta;
                enemy.phase += delta * 2.1;
                if (Math.sin(enemy.phase) > 0.82) {
                    enemy.y += Math.sign(player.y - enemy.y) * level.boss.speed * 0.3 * delta;
                }
                enemy.y = clamp(enemy.y, metrics.height * 0.18, metrics.height * 0.82);
                enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
                return;
            }
            enemy.x -= enemy.vx * delta;
            if (enemy.type === "weaver") {
                enemy.y += Math.sin(levelTime * enemy.wave + enemy.phase) * enemy.drift * delta;
            } else if (enemy.type === "interceptor") {
                enemy.y += clamp(player.y - enemy.y, -enemy.drift, enemy.drift) * enemy.trackStrength * delta;
            } else {
                enemy.y += Math.sin(levelTime * enemy.wave + enemy.phase) * enemy.drift * delta;
            }
            enemy.y = clamp(enemy.y, enemy.radius + 6, metrics.height - enemy.radius - 6);
            enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
        });
        enemies = enemies.filter((enemy) => enemy.x > -90 && enemy.health > 0);
    }

    function updateHazards(delta, level) {
        hazards.forEach((hazard) => {
            hazard.x -= (level.scrollSpeed + hazard.speed) * delta;
            hazard.spin += delta * hazard.spinSpeed;
        });
        hazards = hazards.filter((hazard) => hazard.x > -80);
    }

    function updatePickups(delta, level) {
        pickups.forEach((pickup) => {
            pickup.x -= level.scrollSpeed * 0.64 * delta;
            pickup.pulse += delta * 7;
        });
        pickups = pickups.filter((pickup) => pickup.x > -70);
    }

    function handleCollisions(level) {
        projectiles.forEach((shot) => {
            enemies.forEach((enemy) => {
                if (enemy.health > 0 && circlesOverlap(shot, enemy)) {
                    shot.life = 0;
                    enemy.health -= shot.damage;
                    enemy.hitFlash = enemy.type === "guardian" ? 0.18 : 0.14;
                    effects.push(createHitSpark(shot.x, shot.y, enemy.color || (enemy.type === "guardian" ? "#ffd166" : "#8ee7ff"), enemy.type === "guardian" ? 12 : 8));
                    if (enemy.health <= 0) {
                        const value = enemy.score || (enemy.type === "guardian" ? 600 : 50);
                        score += value;
                        effects.push(createEnemyDestroy(enemy));
                        effects.push(createScorePopup(`+${value}`, enemy.x, enemy.y, enemy.color || "#f8fbff"));
                        if (enemy.type === "guardian") {
                            effects.push(createRoutePulse(enemy.x, enemy.y, "#ffd166", 1.5));
                            screenShake = Math.max(screenShake, 0.42);
                        }
                        sound?.play?.("score", { volume: enemy.type === "guardian" ? 0.76 : 0.46 });
                    }
                }
            });
            hazards.forEach((hazard) => {
                if (circlesOverlap(shot, hazard)) {
                    shot.life = 0;
                    hazard.health -= shot.damage;
                    effects.push(createBurst(shot.x, shot.y, "#ff9fb1", 7));
                    if (hazard.health <= 0) {
                        score += 75;
                        effects.push(createScorePopup("+75", hazard.x, hazard.y, "#ffd166"));
                        sound?.play?.("score", { volume: 0.45 });
                    }
                }
            });
        });

        hazards = hazards.filter((hazard) => hazard.health > 0);
        enemies = enemies.filter((enemy) => enemy.health > 0);

        if (player.respawnDelay <= 0 && player.respawnTimer <= 0) {
            enemies.forEach((enemy) => {
                if (circlesOverlap(player, enemy)) {
                    damagePlayer(enemy.type === "guardian" ? 42 : 34, enemy.x, enemy.y);
                    if (enemy.type !== "guardian") {
                        enemy.health = 0;
                        effects.push(createBurst(enemy.x, enemy.y, "#ff9fb1", 10));
                    }
                }
            });
            hazards.forEach((hazard) => {
                if (circlesOverlap(player, hazard)) {
                    damagePlayer(30, hazard.x, hazard.y);
                    hazard.health = 0;
                    effects.push(createBurst(hazard.x, hazard.y, "#ff7a90", 12));
                }
            });
            enemyShots.forEach((shot) => {
                if (circlesOverlap(player, shot)) {
                    shot.life = 0;
                    damagePlayer(shot.damage, shot.x, shot.y);
                }
            });
            pickups.forEach((pickup) => {
                if (circlesOverlap(player, pickup)) {
                    pickup.collected = true;
                    if (pickup.type === "energy") {
                        score += 25;
                        player.energy = clamp(player.energy + 22, 0, PLAYER_MAX_ENERGY);
                        player.shield = clamp(player.shield + 8, 0, PLAYER_MAX_SHIELD);
                        effects.push(createText("+25 ENERGY", pickup.x, pickup.y, "#7cf0c4"));
                    } else if (pickup.type === "shield") {
                        player.shield = clamp(player.shield + 28, 0, PLAYER_MAX_SHIELD);
                        effects.push(createText("SHIELD", pickup.x, pickup.y, "#ffd166"));
                    } else if (POWERUP_TYPES[pickup.type]) {
                        activePowerups[pickup.type] = POWERUP_TYPES[pickup.type].duration;
                        effects.push(createScorePopup(POWERUP_TYPES[pickup.type].label.toUpperCase(), pickup.x, pickup.y, POWERUP_TYPES[pickup.type].color, 1.15));
                    }
                    effects.push(createBurst(pickup.x, pickup.y, pickupColor(pickup.type), 11));
                    sound?.play?.("score", { volume: 0.42 });
                }
            });
        }
        pickups = pickups.filter((pickup) => !pickup.collected);
    }

    function damagePlayer(amount, x, y) {
        if (player.invulnerable > 0 || player.respawnDelay > 0 || player.respawnTimer > 0 || done || routeClearTimer > 0) {
            return;
        }
        damageTakenThisLevel = true;
        player.shield -= amount;
        player.invulnerable = 1.05;
        player.hitFlash = 0.28;
        effects.push(createShieldImpact(player.x, player.y, player.shield > 0 ? "#7cf0c4" : "#ff7a90"));
        effects.push(createHitSpark(x, y, "#ff7a90", 16));
        screenShake = Math.max(screenShake, player.shield > 0 ? 0.14 : 0.26);
        sound?.play?.("error", { volume: 0.52 });
        if (player.shield > 0) {
            return;
        }
        const deathX = player.x;
        const deathY = player.y;
        player.lives -= 1;
        effects.push(createPlayerExplosion(deathX, deathY));
        if (player.lives <= 0) {
            endGame({ exploded: true });
            return;
        }
        const respawnX = metrics.width * 0.18;
        const respawnY = metrics.height * 0.5;
        player.shield = PLAYER_START_SHIELD;
        player.energy = PLAYER_START_ENERGY;
        player.x = respawnX;
        player.y = respawnY;
        player.invulnerable = PLAYER_RESPAWN_DELAY_SECONDS + PLAYER_RESPAWN_SECONDS + 0.85;
        player.respawnDelay = PLAYER_RESPAWN_DELAY_SECONDS;
        player.respawnTimer = 0;
        player.pendingArrival = true;
        player.trailTimer = 0.08;
        banners.push(createBanner("Shield Reset", `${player.lives} lives left`, "#ffb15f", 1.25));
    }

    function fire() {
        const energyCost = activePowerups.overcharge > 0 ? 4 : 8;
        if (done || paused || routeClearTimer > 0 || fireCooldown > 0 || player.energy < energyCost) {
            return;
        }
        const level = getLevel();
        fireCooldown = activePowerups.overcharge > 0 ? level.fireCooldown * 0.72 : level.fireCooldown;
        player.energy = clamp(player.energy - energyCost, 0, PLAYER_MAX_ENERGY);
        const spread = activePowerups.spread > 0;
        const shotOffsets = spread ? [-0.16, 0, 0.16] : [0];
        shotOffsets.forEach((angle) => {
            const speed = activePowerups.overcharge > 0 ? 620 : 540;
            projectiles.push({
            x: player.x + player.radius * 0.85,
                y: player.y - player.radius * 0.18,
                prevX: player.x + player.radius * 0.85,
                prevY: player.y - player.radius * 0.18,
                vx: speed,
                vy: Math.sin(angle) * speed,
                radius: activePowerups.overcharge > 0 ? 6 : 5,
                damage: activePowerups.overcharge > 0 ? 5 : 4,
                life: 1.8,
                color: activePowerups.overcharge > 0 ? "#56d6ff" : "#9cf5ff",
            wobble: 0,
                overcharged: activePowerups.overcharge > 0,
            });
        });
        sound?.play?.("move", { volume: 0.18 });
    }

    function beginRouteClear() {
        if (routeClearTimer > 0 || done) {
            return;
        }
        const level = getLevel();
        routeClearTimer = 1.85;
        const bonus = level.clearBonus + (damageTakenThisLevel ? 0 : level.noDamageBonus);
        score += bonus;
        projectiles = [];
        enemyShots = [];
        hazards = [];
        pickups = [];
        effects.push(createRouteClearWave(metrics.width * 0.5, metrics.height * 0.5));
        effects.push(createScorePopup(`+${bonus} SECTOR CLEAR`, metrics.width * 0.5, metrics.height * 0.42, "#ffd166", 1.55));
        banners.push(createBanner("Sector Clear", damageTakenThisLevel ? `Level ${level.level} complete` : `Level ${level.level} flawless bonus`, "#ffd166", 1.75));
        sound?.play?.("win", { volume: 0.62 });
        screenShake = Math.max(screenShake, 0.34);
        syncHud();
    }

    function completeRouteClear() {
        if (levelIndex >= LEVEL_DEFINITIONS.length - 1) {
            done = true;
            paused = false;
            options.onStateChange?.("won", { title: "Route Complete", detail: `Score ${score}` });
            return;
        }
        startLevel(levelIndex + 1);
    }

    function endGame(resultOptions = {}) {
        done = true;
        paused = false;
        if (!resultOptions.exploded) {
            effects.push(createPlayerExplosion(player.x, player.y));
        }
        options.onStateChange?.("gameOver", { detail: `Score ${score}` });
        sound?.play?.("lose", { volume: 0.64 });
    }

    function reset() {
        metrics = getMetrics();
        keys = new Set();
        joystickVector = { x: 0, y: 0, force: 0 };
        fireHeld = false;
        fireCooldown = 0;
        levelIndex = 0;
        score = 0;
        player = createPlayer(metrics);
        stars = createStars(metrics);
        projectiles = [];
        enemies = [];
        hazards = [];
        pickups = [];
        enemyShots = [];
        effects = [];
        banners = [createBanner("Sector One", "Clear the route", "#56d6ff", 1.2)];
        activePowerups = createPowerupState();
        paused = false;
        done = false;
        startLevel(0, { preservePlayer: true });
        options.onStateChange?.("playing");
        syncHud();
        draw();
    }

    function startLevel(index, options = {}) {
        levelIndex = index;
        levelTime = 0;
        routeClearTimer = 0;
        spawnTimer = 0.8;
        energyTimer = 2.4;
        shieldTimer = 9;
        powerupTimer = 7;
        bossFireTimer = 1.4;
        bossSpawned = false;
        damageTakenThisLevel = false;
        projectiles = [];
        enemies = [];
        hazards = [];
        pickups = [];
        enemyShots = [];
        activePowerups = createPowerupState();
        if (!options.preservePlayer) {
            player.x = metrics.width * 0.18;
            player.y = metrics.height * 0.5;
            player.invulnerable = 1.15;
            player.respawnDelay = 0;
            player.respawnTimer = PLAYER_RESPAWN_SECONDS * 0.72;
            player.pendingArrival = false;
            effects.push(createJumpArrival(player.x, player.y));
        }
        banners.push(createBanner(`Level ${getLevel().level}`, getLevel().title, "#56d6ff", 1.3));
        syncHud();
    }

    function syncHud() {
        const level = getLevel();
        const progress = clamp(levelTime / level.durationSeconds, 0, 1);
        ui.score.textContent = `Score ${score}  Lv ${level.level}`;
        syncLifeIcons(ui.lives, player.lives);
        options.onProgress?.({
            type: "progress:update",
            progress: {
                gameId: "sector-wing",
                scheme: "route",
                level: level.level,
                levelId: level.id,
                levelName: level.title,
                difficulty: level.level === 1 ? "easy" : level.level === 2 ? "normal" : "hard",
                objective: "Survive the sector route and clear hostile drones",
                score,
                progressCurrent: Math.round(progress * 100),
                progressTarget: 100,
                progressLabel: `${Math.round(progress * 100)}% route`,
            },
        });
    }

    function draw() {
        metrics = getMetrics();
        ctx.clearRect(0, 0, metrics.width, metrics.height);
        ctx.save();
        if (screenShake > 0) {
            const intensity = Math.min(9, 34 * screenShake);
            ctx.translate(randomBetween(-intensity, intensity), randomBetween(-intensity, intensity));
        }
        drawBackdrop();
        drawStars();
        drawRouteRails();
        drawPickups();
        drawHazards();
        drawEnemies();
        drawProjectiles();
        drawEnemyShots();
        drawPlayer();
        drawEffects();
        drawBanners();
        drawStatusBars();
        drawRouteProgress();
        drawGuardianHealth();
        drawPowerupStatus();
        ctx.restore();
    }

    function drawBackdrop() {
        const gradient = ctx.createLinearGradient(0, 0, metrics.width, metrics.height);
        gradient.addColorStop(0, "#07101d");
        gradient.addColorStop(0.5, "#0a1830");
        gradient.addColorStop(1, "#110b22");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, metrics.width, metrics.height);

        const glow = ctx.createRadialGradient(
            metrics.width * 0.25,
            metrics.height * 0.48,
            Math.min(metrics.width, metrics.height) * 0.08,
            metrics.width * 0.5,
            metrics.height * 0.5,
            Math.max(metrics.width, metrics.height) * 0.65,
        );
        glow.addColorStop(0, "rgba(86, 214, 255, .08)");
        glow.addColorStop(0.55, "rgba(124, 240, 196, .025)");
        glow.addColorStop(1, "rgba(86, 214, 255, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, metrics.width, metrics.height);
    }

    function drawStars() {
        ctx.save();
        stars.forEach((star) => {
            ctx.globalAlpha = star.alpha;
            ctx.fillStyle = star.color;
            ctx.fillRect(star.x, star.y, star.size, star.size);
        });
        ctx.restore();
    }

    function drawRouteRails() {
        const pulse = 0.45 + Math.sin(levelTime * 3) * 0.12;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(86, 214, 255, ${pulse})`;
        ctx.lineWidth = 2;
        [0.17, 0.83].forEach((ratio) => {
            const y = metrics.height * ratio;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= metrics.width; x += metrics.width / 12) {
                ctx.lineTo(x, y + Math.sin(x * 0.012 + levelTime * 2.4) * 5);
            }
            ctx.stroke();
        });
        ctx.restore();
    }

    function drawPlayer() {
        const flash = player.hitFlash > 0 || player.invulnerable > 0 && Math.floor(levelTime * 12) % 2 === 0;
        if (player.respawnDelay > 0) {
            return;
        }
        const respawnProgress = player.respawnTimer > 0
            ? 1 - player.respawnTimer / PLAYER_RESPAWN_SECONDS
            : 1;
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = player.respawnTimer > 0 ? clamp(0.25 + respawnProgress * 0.78, 0, 1) : 1;
        ctx.scale(
            player.respawnTimer > 0 ? clamp(0.24 + respawnProgress * 0.76, 0.24, 1) : 1,
            player.respawnTimer > 0 ? clamp(0.72 + respawnProgress * 0.28, 0.72, 1) : 1,
        );
        ctx.shadowColor = flash ? "#ffb15f" : "#56d6ff";
        ctx.shadowBlur = flash ? 24 : 18;
        ctx.fillStyle = flash ? "#ffe1a6" : "#dff9ff";
        ctx.beginPath();
        ctx.moveTo(player.radius * 1.35, 0);
        ctx.lineTo(-player.radius * 0.72, -player.radius * 0.72);
        ctx.lineTo(-player.radius * 0.28, 0);
        ctx.lineTo(-player.radius * 0.72, player.radius * 0.72);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#56d6ff";
        ctx.globalAlpha = 0.82;
        ctx.beginPath();
        ctx.moveTo(-player.radius * 0.5, -player.radius * 0.42);
        ctx.lineTo(player.radius * 0.42, 0);
        ctx.lineTo(-player.radius * 0.5, player.radius * 0.42);
        ctx.closePath();
        ctx.fill();

        const shieldAlpha = clamp(player.shield / PLAYER_MAX_SHIELD, 0, 1);
        if (shieldAlpha > 0.08) {
            ctx.globalAlpha = 0.16 + shieldAlpha * 0.22;
            ctx.strokeStyle = shieldAlpha > 0.35 ? "#7cf0c4" : "#ffb15f";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, player.radius * 1.55, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawProjectiles() {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        projectiles.forEach((shot) => {
            const y = shot.y + Math.sin(shot.wobble) * 1.4;
            ctx.strokeStyle = shot.color || "#9cf5ff";
            ctx.lineWidth = shot.overcharged ? 5 : 3;
            ctx.globalAlpha = shot.overcharged ? 0.58 : 0.38;
            ctx.beginPath();
            ctx.moveTo((shot.prevX || shot.x) - 22, shot.prevY || y);
            ctx.lineTo(shot.x + 4, y);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = shot.color || "#9cf5ff";
            ctx.shadowColor = shot.color || "#56d6ff";
            ctx.shadowBlur = shot.overcharged ? 18 : 12;
            roundRectPath(shot.x - 3, y - 3, shot.overcharged ? 30 : 24, shot.overcharged ? 7 : 6, 3);
            ctx.fill();
        });
        ctx.restore();
    }

    function drawEnemyShots() {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        enemyShots.forEach((shot) => {
            ctx.fillStyle = "#ff9fb1";
            ctx.shadowColor = "#ff7a90";
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    function drawEnemies() {
        enemies.forEach((enemy) => {
            ctx.save();
            ctx.translate(enemy.x, enemy.y);
            ctx.shadowColor = enemy.hitFlash > 0 ? "#ffffff" : enemy.type === "guardian" ? "#ffd166" : enemy.color || "#b58cff";
            ctx.shadowBlur = enemy.type === "guardian" ? 26 : 14;
            ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.type === "guardian" ? "#30213b" : enemy.color || "#2a2455";
            if (enemy.type === "guardian") {
                roundRectPath(-enemy.radius * 1.05, -enemy.radius * 1.25, enemy.radius * 2.1, enemy.radius * 2.5, enemy.radius * 0.32);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = "#ffd166";
                ctx.fillRect(-enemy.radius * 0.65, -enemy.radius * 0.08, enemy.radius * 1.3, enemy.radius * 0.16);
            } else if (enemy.type === "interceptor") {
                ctx.rotate(Math.sin(levelTime * 4 + enemy.phase) * 0.12);
                ctx.beginPath();
                ctx.moveTo(-enemy.radius * 0.95, -enemy.radius);
                ctx.lineTo(enemy.radius * 1.18, 0);
                ctx.lineTo(-enemy.radius * 0.95, enemy.radius);
                ctx.lineTo(-enemy.radius * 0.48, 0);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = enemy.core || "#fff1b8";
                roundRectPath(-enemy.radius * 0.25, -enemy.radius * 0.18, enemy.radius * 0.58, enemy.radius * 0.36, enemy.radius * 0.16);
                ctx.fill();
            } else if (enemy.type === "weaver") {
                ctx.rotate(Math.sin(levelTime * 5 + enemy.phase) * 0.26);
                ctx.beginPath();
                ctx.moveTo(-enemy.radius * 0.9, 0);
                ctx.quadraticCurveTo(0, -enemy.radius * 1.05, enemy.radius * 1.05, 0);
                ctx.quadraticCurveTo(0, enemy.radius * 1.05, -enemy.radius * 0.9, 0);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = enemy.core || "#ffd1ec";
                ctx.beginPath();
                ctx.arc(enemy.radius * 0.12, 0, enemy.radius * 0.22, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.rotate(Math.sin(levelTime * 3 + enemy.phase) * 0.18);
                ctx.beginPath();
                ctx.moveTo(-enemy.radius, -enemy.radius * 0.8);
                ctx.lineTo(enemy.radius * 1.1, 0);
                ctx.lineTo(-enemy.radius, enemy.radius * 0.8);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = enemy.core || "#ff9fb1";
                ctx.beginPath();
                ctx.arc(-enemy.radius * 0.25, 0, enemy.radius * 0.22, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });
    }

    function drawHazards() {
        hazards.forEach((hazard) => {
            ctx.save();
            ctx.translate(hazard.x, hazard.y);
            ctx.rotate(hazard.spin);
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = "#ff7a90";
            ctx.fillStyle = "rgba(255, 122, 144, .24)";
            ctx.shadowColor = "#ff7a90";
            ctx.shadowBlur = 18;
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let index = 0; index < 8; index += 1) {
                const angle = Math.PI * 2 * index / 8;
                const radius = index % 2 === 0 ? hazard.radius : hazard.radius * 0.52;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        });
    }

    function drawPickups() {
        pickups.forEach((pickup) => {
            const pulse = 1 + Math.sin(pickup.pulse) * 0.12;
            ctx.save();
            ctx.translate(pickup.x, pickup.y);
            ctx.scale(pulse, pulse);
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = pickupColor(pickup.type);
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 16;
            roundRectPath(-pickup.radius, -pickup.radius, pickup.radius * 2, pickup.radius * 2, pickup.radius * 0.35);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "#07101d";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-pickup.radius * 0.45, 0);
            ctx.lineTo(pickup.radius * 0.45, 0);
            if (pickup.type === "shield" || pickup.type === "spread") {
                ctx.moveTo(0, -pickup.radius * 0.45);
                ctx.lineTo(0, pickup.radius * 0.45);
            }
            if (pickup.type === "overcharge") {
                ctx.moveTo(-pickup.radius * 0.28, pickup.radius * 0.44);
                ctx.lineTo(pickup.radius * 0.18, -pickup.radius * 0.1);
                ctx.lineTo(-pickup.radius * 0.05, -pickup.radius * 0.1);
                ctx.lineTo(pickup.radius * 0.32, -pickup.radius * 0.44);
            }
            ctx.stroke();
            ctx.restore();
        });
    }

    function drawEffects() {
        effects.forEach((effect) => {
            const progress = effect.age / effect.duration;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            if (effect.type === "text") {
                ctx.globalAlpha = 1 - progress;
                ctx.fillStyle = effect.color;
                ctx.shadowColor = effect.color;
                ctx.shadowBlur = 18;
                ctx.font = `900 ${clamp(metrics.height * 0.038, 16, 24)}px Segoe UI, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.strokeStyle = "rgba(7, 16, 29, .86)";
                ctx.lineWidth = 4;
                ctx.strokeText(effect.text, effect.x, effect.y - progress * 42);
                ctx.fillText(effect.text, effect.x, effect.y - progress * 42);
            } else if (effect.type === "trail") {
                ctx.globalAlpha = (1 - progress) * 0.35;
                ctx.fillStyle = effect.color;
                ctx.shadowColor = effect.color;
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, PLAYER_RADIUS * (0.9 - progress * 0.3), 0, Math.PI * 2);
                ctx.fill();
            } else if (effect.type === "playerExplosion") {
                drawPlayerExplosion(effect, progress);
            } else if (effect.type === "jumpArrival") {
                drawJumpArrival(effect, progress);
            } else if (effect.type === "shieldImpact") {
                drawShieldImpact(effect, progress);
            } else if (effect.type === "routeClearWave") {
                drawRouteClearWave(effect, progress);
            } else {
                ctx.globalAlpha = 1 - progress;
                ctx.strokeStyle = effect.color;
                ctx.lineWidth = 3;
                ctx.shadowColor = effect.color;
                ctx.shadowBlur = 16;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, 8 + progress * 46, 0, Math.PI * 2);
                ctx.stroke();
                effect.particles?.forEach((particle) => {
                    ctx.fillStyle = effect.color;
                    ctx.globalAlpha = (1 - progress) * 0.85;
                    ctx.fillRect(
                        effect.x + particle.x * progress - particle.size / 2,
                        effect.y + particle.y * progress - particle.size / 2,
                        particle.size,
                        particle.size,
                    );
                });
            }
            ctx.restore();
        });
    }

    function drawPlayerExplosion(effect, progress) {
        const fade = 1 - progress;
        const coreRadius = PLAYER_RADIUS * (0.85 + progress * 2.4);

        ctx.globalAlpha = fade;
        ctx.fillStyle = "#ffd166";
        ctx.shadowColor = "#ff7a90";
        ctx.shadowBlur = 28;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, coreRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = fade * 0.72;
        ctx.strokeStyle = "#ff7a90";
        ctx.lineWidth = Math.max(2, PLAYER_RADIUS * 0.16);
        for (let index = 0; index < 3; index += 1) {
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, PLAYER_RADIUS * (1.2 + progress * (2.8 + index * 0.72)), 0, Math.PI * 2);
            ctx.stroke();
        }

        effect.shards.forEach((shard) => {
            const x = effect.x + shard.x * progress;
            const y = effect.y + shard.y * progress;
            ctx.save();
            ctx.globalAlpha = fade * shard.alpha;
            ctx.translate(x, y);
            ctx.rotate(shard.spin * progress);
            ctx.fillStyle = shard.color;
            ctx.fillRect(-shard.size / 2, -shard.size / 2, shard.size * 1.7, shard.size);
            ctx.restore();
        });
    }

    function drawJumpArrival(effect, progress) {
        const intro = clamp(progress / 0.72, 0, 1);
        const fade = progress > 0.82 ? 1 - clamp((progress - 0.82) / 0.18, 0, 1) : 1;
        ctx.globalAlpha = fade;
        ctx.shadowColor = "#56d6ff";
        ctx.shadowBlur = 24;

        effect.streaks.forEach((streak) => {
            const startX = effect.x - streak.length * (1 - intro) - streak.offset;
            const endX = effect.x + PLAYER_RADIUS * 1.1 * intro;
            const y = effect.y + streak.y;
            ctx.strokeStyle = streak.color;
            ctx.lineWidth = streak.width;
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y * 0.98 + effect.y * 0.02);
            ctx.stroke();
        });

        ctx.globalAlpha = fade * (1 - progress * 0.45);
        ctx.strokeStyle = "#8ee7ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(effect.x, effect.y, PLAYER_RADIUS * (0.8 + progress * 2.4), PLAYER_RADIUS * (0.34 + progress * 0.92), 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = fade * 0.52;
        ctx.fillStyle = "#f8fbff";
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, PLAYER_RADIUS * (0.18 + intro * 0.72), 0, Math.PI * 2);
        ctx.fill();
    }

    function drawBanners() {
        banners.forEach((banner) => {
            const progress = banner.age / banner.duration;
            const fade = progress > 0.72 ? 1 - clamp((progress - 0.72) / 0.28, 0, 1) : 1;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = fade;
            ctx.translate(metrics.width / 2, metrics.height * 0.32);
            ctx.scale(0.92 + Math.sin(progress * Math.PI) * 0.1, 0.92 + Math.sin(progress * Math.PI) * 0.1);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 6;
            ctx.strokeStyle = "rgba(7, 16, 29, .9)";
            ctx.fillStyle = "#f8fbff";
            ctx.shadowColor = banner.color;
            ctx.shadowBlur = 24;
            ctx.font = `900 ${clamp(metrics.height * 0.095, 30, 58)}px Segoe UI, sans-serif`;
            ctx.strokeText(banner.title, 0, 0);
            ctx.fillText(banner.title, 0, 0);
            ctx.fillStyle = banner.color;
            ctx.font = `800 ${clamp(metrics.height * 0.038, 14, 22)}px Segoe UI, sans-serif`;
            ctx.strokeText(banner.detail, 0, clamp(metrics.height * 0.078, 30, 46));
            ctx.fillText(banner.detail, 0, clamp(metrics.height * 0.078, 30, 46));
            ctx.restore();
        });
    }

    function drawStatusBars() {
        const width = clamp(metrics.width * 0.22, 118, 210);
        const height = 5;
        const rightInset = clamp(metrics.width * 0.12, 78, 126);
        const x = metrics.width - width - rightInset;
        const y = clamp(metrics.height * 0.05, 16, 30);
        drawMeterBar(x, y, width, height, player.energy / PLAYER_MAX_ENERGY, "#56d6ff");
        drawMeterBar(x, y + height + 6, width, height, player.shield / PLAYER_MAX_SHIELD, "#7cf0c4");
    }

    function drawMeterBar(x, y, width, height, progress, color) {
        const value = clamp(progress, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = "rgba(248, 251, 255, .14)";
        roundRectPath(x, y, width, height, height / 2);
        ctx.fill();
        ctx.fillStyle = color;
        roundRectPath(x, y, width * value, height, height / 2);
        ctx.fill();
        ctx.restore();
    }

    function drawRouteProgress() {
        const level = getLevel();
        const progress = clamp(levelTime / level.durationSeconds, 0, 1);
        const width = clamp(metrics.width * 0.18, 110, 190);
        const height = 4;
        const x = metrics.width / 2 - width / 2;
        const y = clamp(metrics.height * 0.085, 34, 54);
        ctx.save();
        ctx.globalAlpha = 0.86;
        ctx.fillStyle = "rgba(248, 251, 255, .12)";
        roundRectPath(x, y, width, height, height / 2);
        ctx.fill();
        ctx.fillStyle = routeClearTimer > 0 ? "#ffd166" : "#8ee7ff";
        roundRectPath(x, y, width * progress, height, height / 2);
        ctx.fill();
        ctx.fillStyle = "#b8d8ff";
        ctx.font = `800 ${clamp(metrics.height * 0.024, 11, 14)}px Segoe UI, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(`Route ${Math.round(progress * 100)}%`, x + width / 2, y + height + 5);
        ctx.restore();
    }

    function drawGuardianHealth() {
        const guardian = enemies.find((enemy) => enemy.type === "guardian");
        if (!guardian) {
            return;
        }
        const width = clamp(metrics.width * 0.22, 150, 260);
        const height = 6;
        const x = metrics.width / 2 - width / 2;
        const y = clamp(metrics.height * 0.13, 52, 84);
        const value = clamp(guardian.health / Math.max(1, guardian.maxHealth), 0, 1);
        ctx.save();
        ctx.fillStyle = "rgba(255, 209, 102, .16)";
        roundRectPath(x, y, width, height, height / 2);
        ctx.fill();
        ctx.fillStyle = "#ffd166";
        roundRectPath(x, y, width * value, height, height / 2);
        ctx.fill();
        ctx.restore();
    }

    function drawPowerupStatus() {
        const active = Object.entries(activePowerups)
            .filter(([, time]) => time > 0)
            .map(([type, time]) => ({ type, time, definition: POWERUP_TYPES[type] }));
        if (!active.length) {
            return;
        }
        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = `800 ${clamp(metrics.height * 0.026, 12, 15)}px Segoe UI, sans-serif`;
        active.forEach((item, index) => {
            const x = clamp(metrics.width * 0.03, 14, 32);
            const y = clamp(metrics.height * 0.13, 52, 84) + index * 24;
            const text = `${item.definition.label} ${Math.ceil(item.time)}s`;
            const width = Math.max(96, ctx.measureText(text).width + 22);
            ctx.fillStyle = "rgba(7, 16, 29, .66)";
            roundRectPath(x, y - 11, width, 22, 11);
            ctx.fill();
            ctx.fillStyle = item.definition.color;
            ctx.fillText(text, x + 11, y);
        });
        ctx.restore();
    }

    function spawnEnemy(level) {
        const type = chooseEnemyType(level);
        const definition = ENEMY_TYPES[type] || ENEMY_TYPES.drone;
        const radius = clamp(metrics.height * 0.028 * definition.radiusScale, 12, 24);
        enemies.push({
            type,
            x: metrics.width + radius * 2,
            y: randomBetween(metrics.height * 0.18, metrics.height * 0.82),
            radius,
            vx: level.enemySpeed * definition.speed * randomBetween(0.86, 1.18),
            health: definition.health,
            maxHealth: definition.health,
            score: definition.score,
            color: definition.color,
            core: definition.core,
            phase: Math.random() * Math.PI * 2,
            wave: definition.wave ? randomBetween(definition.wave[0], definition.wave[1]) : randomBetween(2.2, 4.4),
            drift: randomBetween(definition.drift[0], definition.drift[1]),
            trackStrength: definition.trackStrength || 0,
            hitFlash: 0,
        });
    }

    function drawShieldImpact(effect, progress) {
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = Math.max(2, PLAYER_RADIUS * 0.14);
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, PLAYER_RADIUS * (1.35 + progress * 1.8), 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawRouteClearWave(effect, progress) {
        const width = metrics.width * (0.12 + progress * 1.28);
        ctx.globalAlpha = (1 - progress) * 0.72;
        ctx.fillStyle = "#ffd166";
        ctx.shadowColor = "#ffd166";
        ctx.shadowBlur = 28;
        roundRectPath(effect.x - width / 2, 0, width, metrics.height, Math.max(10, metrics.height * 0.08));
        ctx.fill();
    }

    function spawnHazard(level) {
        const radius = clamp(metrics.height * 0.024, 12, 20);
        hazards.push({
            x: metrics.width + radius * 2,
            y: randomBetween(metrics.height * 0.17, metrics.height * 0.83),
            radius,
            speed: level.enemySpeed * randomBetween(0.32, 0.64),
            health: 7,
            spin: Math.random() * Math.PI,
            spinSpeed: randomBetween(1.8, 3.8),
        });
    }

    function spawnPickup(type) {
        pickups.push({
            type,
            x: metrics.width + 32,
            y: randomBetween(metrics.height * 0.22, metrics.height * 0.78),
            radius: POWERUP_TYPES[type] ? 13 : type === "energy" ? 10 : 12,
            pulse: Math.random() * Math.PI * 2,
        });
    }

    function createGuardian(level) {
        const radius = clamp(metrics.height * 0.074, 34, 54);
        return {
            type: "guardian",
            x: metrics.width + radius * 1.8,
            y: metrics.height * 0.5,
            radius,
            health: level.boss.health,
            maxHealth: level.boss.health,
            score: 600,
            color: "#ffd166",
            phase: 0,
            hitFlash: 0,
        };
    }

    function updateStars(delta, level) {
        stars.forEach((star) => {
            star.x -= (level.scrollSpeed * star.depth) * delta;
            if (star.x < -4) {
                star.x = metrics.width + Math.random() * 80;
                star.y = Math.random() * metrics.height;
            }
        });
    }

    function updateEffects(delta) {
        effects = effects
            .map((effect) => ({ ...effect, age: effect.age + delta }))
            .filter((effect) => effect.age < effect.duration);
        banners = banners
            .map((banner) => ({ ...banner, age: banner.age + delta }))
            .filter((banner) => banner.age < banner.duration);
    }

    function updateActivePowerups(delta) {
        Object.keys(activePowerups).forEach((key) => {
            activePowerups[key] = Math.max(0, activePowerups[key] - delta);
        });
    }

    function chooseEnemyType(level) {
        const segment = getCurrentSegment(level);
        if (segment?.pattern === "weavers") {
            return Math.random() < 0.72 ? "weaver" : "drone";
        }
        if (segment?.pattern === "interceptors") {
            return Math.random() < 0.66 ? "interceptor" : "weaver";
        }
        if (segment?.pattern === "hazards" && Math.random() < 0.35) {
            return "weaver";
        }
        const mix = level.enemyMix || {};
        const roll = Math.random();
        let cursor = 0;
        for (const type of ["drone", "weaver", "interceptor"]) {
            cursor += mix[type] || 0;
            if (roll <= cursor) {
                return type;
            }
        }
        return "drone";
    }

    function getCurrentSegment(level) {
        return level.segments?.find((segment) => levelTime >= segment.from && levelTime < segment.to) || null;
    }

    function getInputVector() {
        const vector = { x: 0, y: 0 };
        if (keys.has("ArrowLeft") || keys.has("a")) vector.x -= 1;
        if (keys.has("ArrowRight") || keys.has("d")) vector.x += 1;
        if (keys.has("ArrowUp") || keys.has("w")) vector.y -= 1;
        if (keys.has("ArrowDown") || keys.has("s")) vector.y += 1;
        if (joystickVector.force > 0.12) {
            vector.x += joystickVector.x;
            vector.y += joystickVector.y;
        }
        const length = Math.hypot(vector.x, vector.y);
        if (length <= 0) {
            return { x: 0, y: 0 };
        }
        return { x: vector.x / length, y: vector.y / length };
    }

    function handleKeydown(event) {
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d"].includes(key)) {
            keys.add(key);
            event.preventDefault();
        }
        if (key === " " || key === "Spacebar") {
            fireHeld = true;
            fire();
            event.preventDefault();
        }
    }

    function handleKeyup(event) {
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        keys.delete(key);
        if (key === " " || key === "Spacebar") {
            fireHeld = false;
            event.preventDefault();
        }
    }

    function handleResize() {
        metrics = getMetrics();
        player.x = clamp(player.x, player.radius + 5, metrics.width - player.radius - 5);
        player.y = clamp(player.y, player.radius + 5, metrics.height - player.radius - 5);
        draw();
    }

    function getMetrics() {
        return {
            width: Math.max(320, layer.canvas.width || session.viewport.clientWidth || 960),
            height: Math.max(220, layer.canvas.height || session.viewport.clientHeight || 540),
        };
    }

    function getLevel() {
        return LEVEL_DEFINITIONS[levelIndex] || LEVEL_DEFINITIONS[LEVEL_DEFINITIONS.length - 1];
    }

    function roundRectPath(x, y, width, height, radius) {
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
    root.className = "pbb-game-session-ui pbb-sector-wing-session-ui";

    const hud = document.createElement("div");
    hud.className = "pbb-game-session-hud";

    const title = document.createElement("p");
    title.className = "pbb-game-session-title";
    title.style.display = "inline-flex";
    title.style.alignItems = "center";
    title.style.gap = "8px";

    const titleText = document.createElement("span");
    titleText.textContent = game.title;

    const lives = document.createElement("span");
    lives.className = "pbb-sector-wing-lives";
    lives.setAttribute("aria-label", "Lives 3");
    lives.style.display = "inline-flex";
    lives.style.alignItems = "center";
    lives.style.gap = "4px";
    lives.style.marginLeft = "2px";
    lives.style.pointerEvents = "none";

    title.append(titleText, lives);
    syncLifeIcons(lives, PLAYER_START_LIVES);

    const score = document.createElement("p");
    score.className = "ui-badge pbb-game-session-score";
    score.textContent = "Score 0  Lv 1";

    const movementControls = document.createElement("div");
    movementControls.className = "pbb-game-session-movement-controls";

    const actions = document.createElement("div");
    actions.className = "pbb-game-session-actions";

    hud.append(title);
    root.append(hud, score, movementControls, actions);
    session.overlay.appendChild(root);

    return { root, score, lives, movementControls, actions };
}

function syncLifeIcons(container, lives) {
    if (!container) {
        return;
    }
    const count = Math.max(0, Math.min(PLAYER_START_LIVES, Math.round(lives)));
    container.replaceChildren();
    container.setAttribute("aria-label", `Lives ${count}`);
    for (let index = 0; index < count; index += 1) {
        container.appendChild(createLifeShipIcon());
    }
}

function createLifeShipIcon() {
    const icon = document.createElement("span");
    icon.className = "pbb-sector-wing-life-ship";
    icon.setAttribute("aria-hidden", "true");
    icon.style.display = "inline-block";
    icon.style.width = "14px";
    icon.style.height = "10px";
    icon.style.background = "linear-gradient(90deg, #f8fbff 0%, #8ee7ff 78%)";
    icon.style.clipPath = "polygon(100% 50%, 0 0, 24% 50%, 0 100%)";
    icon.style.filter = "drop-shadow(0 0 5px rgba(86, 214, 255, .82))";
    return icon;
}

function createPlayer(metrics) {
    return {
        x: metrics.width * 0.18,
        y: metrics.height * 0.5,
        radius: PLAYER_RADIUS,
        lives: PLAYER_START_LIVES,
        energy: PLAYER_START_ENERGY,
        shield: PLAYER_START_SHIELD,
        invulnerable: 1.2,
        hitFlash: 0,
        respawnDelay: 0,
        respawnTimer: 0,
        pendingArrival: false,
        trailTimer: 0,
    };
}

function createStars(metrics) {
    return Array.from({ length: 90 }, () => ({
        x: Math.random() * metrics.width,
        y: Math.random() * metrics.height,
        size: randomBetween(1, 2.6),
        depth: randomBetween(0.25, 1.15),
        alpha: randomBetween(0.22, 0.82),
        color: Math.random() > 0.72 ? "#7cf0c4" : "#b8d8ff",
    }));
}

function createBurst(x, y, color, count = 12) {
    return {
        type: "burst",
        x,
        y,
        color,
        age: 0,
        duration: 0.42,
        particles: Array.from({ length: count }, (_, index) => {
            const angle = Math.PI * 2 * index / count + Math.random() * 0.28;
            const distance = randomBetween(26, 64);
            return {
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                size: randomBetween(2.5, 6),
            };
        }),
    };
}

function createHitSpark(x, y, color, count = 10) {
    return {
        ...createBurst(x, y, color, count),
        duration: 0.28,
    };
}

function createEnemyDestroy(enemy) {
    return {
        ...createBurst(enemy.x, enemy.y, enemy.color || "#7cf0c4", enemy.type === "guardian" ? 34 : enemy.type === "interceptor" ? 18 : 14),
        duration: enemy.type === "guardian" ? 0.72 : 0.48,
    };
}

function createScorePopup(text, x, y, color, duration = 0.95) {
    return { type: "text", text, x, y, color, age: 0, duration };
}

function createShieldImpact(x, y, color) {
    return { type: "shieldImpact", x, y, color, age: 0, duration: 0.42 };
}

function createRouteClearWave(x, y) {
    return { type: "routeClearWave", x, y, age: 0, duration: 0.95 };
}

function createRoutePulse(x, y, color, duration = 0.8) {
    return {
        ...createBurst(x, y, color, 20),
        duration,
    };
}

function createPowerupState() {
    return Object.fromEntries(Object.keys(POWERUP_TYPES).map((key) => [key, 0]));
}

function pickupColor(type) {
    if (POWERUP_TYPES[type]) {
        return POWERUP_TYPES[type].color;
    }
    return type === "energy" ? "#7cf0c4" : "#ffd166";
}

function createPlayerExplosion(x, y) {
    return {
        type: "playerExplosion",
        x,
        y,
        color: "#ff7a90",
        age: 0,
        duration: 0.86,
        shards: Array.from({ length: 28 }, (_, index) => {
            const angle = Math.PI * 2 * index / 28 + Math.random() * 0.18;
            const distance = randomBetween(52, 132);
            return {
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance * randomBetween(0.72, 1.15),
                size: randomBetween(3, 8),
                spin: randomBetween(-Math.PI * 2.6, Math.PI * 2.6),
                alpha: randomBetween(0.55, 1),
                color: index % 3 === 0 ? "#ffd166" : index % 3 === 1 ? "#ff7a90" : "#8ee7ff",
            };
        }),
    };
}

function createJumpArrival(x, y) {
    return {
        type: "jumpArrival",
        x,
        y,
        age: 0,
        duration: PLAYER_RESPAWN_SECONDS,
        streaks: Array.from({ length: 11 }, (_, index) => ({
            y: (index - 5) * randomBetween(3.2, 5.4),
            offset: randomBetween(12, 48),
            length: randomBetween(90, 190),
            width: randomBetween(1.5, 4.2),
            color: index % 3 === 0 ? "#f8fbff" : index % 3 === 1 ? "#56d6ff" : "#7cf0c4",
        })),
    };
}

function createText(text, x, y, color, duration = 0.9) {
    return { type: "text", text, x, y, color, age: 0, duration };
}

function createBanner(title, detail, color, duration) {
    return { title, detail, color, age: 0, duration };
}

function circlesOverlap(a, b) {
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    return distance <= (a.radius || 0) + (b.radius || 0);
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
