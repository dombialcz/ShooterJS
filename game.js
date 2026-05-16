// Main game state and loop

class GameState {
    constructor() {
        this.entities = new Map();
        this.score = 0;
        this.isGameOver = false;
        this.isLevelComplete = false;
        this.isPaused = false;
        this.player = null;
        this.walls = [];
        this.doors = [];
        this.targets = [];
        this.blocks = [];
        this.enemies = [];
        this.currentMapData = null;
        this.timeMs = 0;
        this.shotRngState = CONFIG.SHOT_RNG_SEED >>> 0;
        this.targetRespawnRngState = CONFIG.TARGET_RESPAWN_RNG_SEED >>> 0;
        this.roundDurationMs = CONFIG.ROUND_DURATION_MS;
        this.roundTimeRemainingMs = CONFIG.ROUND_DURATION_MS;
        this.initialTargetCount = 0;
        this.targetSpawnCursor = 0;
        this.targetSpawnPoints = [];
        this.pendingTargetRespawns = [];
        this.levelGoalTargets = 0;
        this.targetsDestroyed = 0;
        this.enemiesDestroyed = 0;
        this.initialEnemyCount = 0;
        this.gameOverReason = null;
        this.hasDisplayedGameOver = false;
        this.hasReachedVictoryArea = false;
    }

    addEntity(entity) {
        this.entities.set(entity.id, entity);

        if (entity.type === 'player') {
            this.player = entity;
        } else if (entity.type === 'wall') {
            this.walls.push(entity.getComponent('wall'));
        } else if (entity.type === 'door') {
            this.doors.push(entity);
        } else if (entity.type === 'target') {
            this.targets.push(entity);
        } else if (entity.type === 'block') {
            this.blocks.push(entity);
        } else if (entity.type === 'enemy') {
            this.enemies.push(entity);
        }

        return entity;
    }

    removeEntity(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity) return;

        if (entity.type === 'target') {
            const index = this.targets.indexOf(entity);
            if (index > -1) this.targets.splice(index, 1);
            this.scheduleTargetRespawn();
        } else if (entity.type === 'door') {
            const index = this.doors.indexOf(entity);
            if (index > -1) this.doors.splice(index, 1);
        } else if (entity.type === 'block') {
            const index = this.blocks.indexOf(entity);
            if (index > -1) this.blocks.splice(index, 1);
        } else if (entity.type === 'enemy') {
            const index = this.enemies.indexOf(entity);
            if (index > -1) this.enemies.splice(index, 1);
        }

        this.entities.delete(entityId);
    }

    addScore(points) {
        this.score += points;
        const scoreValue = document.getElementById('scoreValue');
        if (scoreValue) {
            scoreValue.textContent = this.score;
        }
    }

    scheduleTargetRespawn() {
        if (this.initialTargetCount <= 0 || this.targetSpawnPoints.length <= 0) {
            return;
        }

        const minDelay = Math.max(0, CONFIG.TARGET_RESPAWN_DELAY_MIN_MS || 10000);
        const maxDelay = Math.max(minDelay, CONFIG.TARGET_RESPAWN_DELAY_MAX_MS || 20000);
        const delay = minDelay + Math.floor(this.nextTargetRespawnRandom() * (maxDelay - minDelay + 1));
        const readyAtMs = (this.timeMs || 0) + delay;
        this.pendingTargetRespawns.push({ readyAtMs });
    }

    nextTargetRespawnRandom() {
        const a = 1664525;
        const c = 1013904223;
        const current = (this.targetRespawnRngState >>> 0) || 0;
        const next = (Math.imul(current, a) + c) >>> 0;
        this.targetRespawnRngState = next;
        return next / 4294967296;
    }

    checkGameOver() {
        if (this.roundTimeRemainingMs <= 0 && !this.isGameOver) {
            this.isGameOver = true;
            this.isLevelComplete = false;
            this.gameOverReason = this.gameOverReason || 'timeout';
        }

        if (this.isGameOver && !this.hasDisplayedGameOver) {
            const finalScore = document.getElementById('finalScore');
            if (finalScore) {
                finalScore.textContent = this.score;
            }
            const title = document.getElementById('gameOverTitle');
            if (title) {
                if (this.isLevelComplete) {
                    title.textContent = 'LEVEL COMPLETE';
                } else if (this.gameOverReason === 'player_dead') {
                    title.textContent = 'YOU DIED';
                } else {
                    title.textContent = "TIME'S UP";
                }
            }
            const result = document.getElementById('gameOverResult');
            if (result) {
                if (this.isLevelComplete) {
                    result.textContent = 'You won this level.';
                } else if (this.gameOverReason === 'player_dead') {
                    result.textContent = 'You were eliminated by an enemy.';
                } else {
                    result.textContent = 'You lost this level.';
                }
            }
            const gameOver = document.getElementById('gameOver');
            if (gameOver) {
                gameOver.classList.add('visible');
            }
            this.hasDisplayedGameOver = true;
        }
    }

    getTotalEliminations() {
        return (this.targetsDestroyed || 0) + (this.enemiesDestroyed || 0);
    }

    getAllWallSegments() {
        const segments = [...this.walls];
        for (const doorEntity of this.doors) {
            const door = doorEntity.getComponent('door');
            if (door) {
                segments.push(DoorSystem.getDoorSegment(door));
            }
        }
        return segments;
    }

    getVisionSegments() {
        const segments = this.getAllWallSegments();
        for (const block of this.blocks) {
            const transform = block.getComponent('transform');
            const collision = block.getComponent('collision');
            if (!transform || !collision || collision.type !== 'aabb') continue;

            const x = transform.x + collision.offsetX;
            const y = transform.y + collision.offsetY;
            const w = collision.width;
            const h = collision.height;

            segments.push({ x1: x, y1: y, x2: x + w, y2: y });
            segments.push({ x1: x + w, y1: y, x2: x + w, y2: y + h });
            segments.push({ x1: x + w, y1: y + h, x2: x, y2: y + h });
            segments.push({ x1: x, y1: y + h, x2: x, y2: y });
        }
        return segments;
    }
}

class Game {
    constructor(initialMapData = null) {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = new GameState();
        this.initialMapData = initialMapData;

        this.lastTime = 0;
        this.accumulator = 0;
        this.dt = CONFIG.FIXED_TIMESTEP;
        this.fixedDtSeconds = this.dt / 1000;

        this.isRunning = false;
    }

    init() {
        console.log('Initializing game...');

        this.initializeMap();
        this.createPlayerFromMap();
        this.createTargets();
        this.createEnemies();
        this.configureLevelGoal();
        this.syncHUD();

        InputSystem.init(this.canvas, this.state);

        console.log('Game initialized!');
        console.log(`Player: ${this.state.player ? 'Created' : 'Missing'}`);
        console.log(`Walls: ${this.state.walls.length}`);
        console.log(`Doors: ${this.state.doors.length}`);
        console.log(`Blocks: ${this.state.blocks.length}`);
        console.log(`Targets: ${this.state.targets.length}`);
        console.log(`Enemies: ${this.state.enemies.length}`);
    }

    initializeMap() {
        const mapData = this.loadMapData();
        this.state.currentMapData = mapData;
        this.buildMapFromData(mapData);
    }

    loadMapData() {
        if (this.initialMapData) {
            return MapFormat.normalizeMapData(this.initialMapData);
        }
        return MapFormat.createDefaultMapData();
    }

    buildMapFromData(mapData) {
        const wallSegments = MapBuildUtils.extractWallSegments(mapData);
        for (const wall of wallSegments) {
            this.state.addEntity(createWall(wall.x1, wall.y1, wall.x2, wall.y2));
        }

        for (const doorData of mapData.doors) {
            const doorDef = MapBuildUtils.getDoorEntityDefinition(mapData, doorData);
            if (!doorDef) continue;
            this.state.addEntity(createDoor(doorDef.hingeX, doorDef.hingeY, doorDef.width, doorDef.hingeAngle));
        }

        const tileSize = mapData.tileSize;
        for (let row = 0; row < mapData.rows; row++) {
            for (let col = 0; col < mapData.cols; col++) {
                const tile = mapData.tiles[row * mapData.cols + col];
                if (tile !== MapFormat.TILE_BLOCK) continue;

                const x = col * tileSize + tileSize / 2;
                const y = row * tileSize + tileSize / 2;
                const size = Math.floor(tileSize * 0.8);
                this.state.addEntity(createBlock(x, y, size, size));
            }
        }
    }

    createPlayerFromMap() {
        const spawn = this.state.currentMapData.playerSpawn;
        const tile = this.state.currentMapData.tileSize;
        const playerX = spawn.col * tile + tile / 2;
        const playerY = spawn.row * tile + tile / 2;
        this.state.addEntity(createPlayer(playerX, playerY));
    }

    createTargets() {
        const mapData = this.state.currentMapData;
        const configuredTimeLimit = mapData.settings?.timeLimitMs;
        this.state.roundDurationMs = Number.isInteger(configuredTimeLimit) && configuredTimeLimit > 0
            ? configuredTimeLimit
            : CONFIG.ROUND_DURATION_MS;
        this.state.roundTimeRemainingMs = this.state.roundDurationMs;
        const tile = mapData.tileSize;
        const spawns = Array.isArray(mapData.targetSpawns) ? mapData.targetSpawns : [];
        this.state.targetSpawnPoints = spawns.map((spawn) => ({
            x: spawn.col * tile + tile / 2,
            y: spawn.row * tile + tile / 2
        }));
        this.state.initialTargetCount = this.state.targetSpawnPoints.length;
        this.state.targetsDestroyed = 0;
        this.state.targetSpawnCursor = 0;
        this.state.pendingTargetRespawns = [];
        this.spawnTargets(this.state.initialTargetCount);
    }

    createEnemies() {
        const mapData = this.state.currentMapData;
        const tile = mapData.tileSize;
        const enemies = Array.isArray(mapData.enemies) ? mapData.enemies : [];
        this.state.enemiesDestroyed = 0;
        this.state.initialEnemyCount = enemies.length;

        for (const enemyData of enemies) {
            const spawn = enemyData?.spawn;
            if (!spawn || !Number.isInteger(spawn.col) || !Number.isInteger(spawn.row)) continue;
            const x = spawn.col * tile + tile / 2;
            const y = spawn.row * tile + tile / 2;
            const patrol = Array.isArray(enemyData.patrol)
                ? enemyData.patrol.map((point) => ({
                    x: point.col * tile + tile / 2,
                    y: point.row * tile + tile / 2
                }))
                : [];
            this.state.addEntity(createEnemy(x, y, Object.assign({}, enemyData, { patrol })));
        }
    }

    configureLevelGoal() {
        const configuredGoal = this.state.currentMapData?.settings?.maxTargetsToKill;
        const availableEliminations = this.state.initialTargetCount + this.state.initialEnemyCount;
        if (Number.isInteger(configuredGoal) && configuredGoal > 0) {
            this.state.levelGoalTargets = configuredGoal;
        } else if (availableEliminations > 0) {
            this.state.levelGoalTargets = availableEliminations;
        } else {
            this.state.levelGoalTargets = Number.POSITIVE_INFINITY;
        }
    }

    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    }

    restart() {
        this.state = new GameState();
        const gameOver = document.getElementById('gameOver');
        if (gameOver) {
            gameOver.classList.remove('visible');
        }
        this.init();
        this.start();
    }

    gameLoop(currentTime) {
        if (!this.isRunning) return;

        requestAnimationFrame((time) => this.gameLoop(time));

        let frameTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        if (frameTime > CONFIG.MAX_FRAME_TIME) {
            frameTime = CONFIG.MAX_FRAME_TIME;
        }

        this.accumulator += frameTime;

        while (this.accumulator >= this.dt) {
            this.update(this.dt / 1000);
            this.accumulator -= this.dt;
        }

        const alpha = this.accumulator / this.dt;
        this.render(alpha);
    }

    update(dt, options = {}) {
        if (this.state.isPaused || this.state.isGameOver) return;

        const requestedMs = dt * 1000;
        const stepMs = RoundUtils.getStepDurationMs(requestedMs, this.state.roundTimeRemainingMs);
        if (stepMs <= 0) {
            this.state.roundTimeRemainingMs = 0;
            this.state.checkGameOver();
            this.syncHUD();
            return;
        }

        SimulationCore.stepSimulation(this.state, stepMs / 1000, options);
        this.state.roundTimeRemainingMs = RoundUtils.getRemainingMs(this.state.timeMs, this.state.roundDurationMs);

        this.removeExpiredEntities();
        const playerHealth = this.state.player?.getComponent('health');
        if (!this.state.isGameOver && playerHealth && playerHealth.current <= 0) {
            this.state.isGameOver = true;
            this.state.isLevelComplete = false;
            this.state.gameOverReason = 'player_dead';
        }
        this.state.hasReachedVictoryArea = this.isPlayerInsideVictoryArea();
        if (!this.state.isGameOver && this.hasMetLevelCompletionGoal()) {
            this.state.isLevelComplete = true;
            this.state.isGameOver = true;
            this.state.gameOverReason = 'level_complete';
        }
        this.state.checkGameOver();
        if (!this.state.isGameOver) {
            this.processTargetRespawns();
        }
        this.syncHUD();
    }

    removeExpiredEntities() {
        const now = this.state.timeMs ?? Date.now();
        const toRemove = [];

        for (const entity of this.state.entities.values()) {
            const lifetime = entity.getComponent('lifetime');
            if (lifetime && now - lifetime.createdAt >= lifetime.duration) {
                toRemove.push(entity.id);
            }
        }

        for (const id of toRemove) {
            this.state.removeEntity(id);
        }
    }

    render(alpha) {
        RenderSystem.render(this.ctx, this.state, alpha);
    }

    stepFrames(frameCount, options = {}) {
        for (let i = 0; i < frameCount; i++) {
            this.update(this.fixedDtSeconds, options);
            if (this.state.isGameOver) break;
        }
    }

    advanceTime(ms, options = {}) {
        const frames = Math.max(1, Math.round(ms / this.dt));
        this.stepFrames(frames, options);
        this.render(1);
    }

    renderGameToText() {
        return JSON.stringify(SimulationCore.serializeGameState(this.state));
    }

    processTargetRespawns() {
        if (!Array.isArray(this.state.pendingTargetRespawns) || this.state.pendingTargetRespawns.length === 0) {
            return;
        }
        const now = this.state.timeMs || 0;
        const dueCount = this.state.pendingTargetRespawns.reduce((count, entry) => (
            entry.readyAtMs <= now ? count + 1 : count
        ), 0);
        if (dueCount <= 0) {
            return;
        }

        const spawnedCount = this.spawnTargets(dueCount);
        if (spawnedCount <= 0) {
            return;
        }

        let remainingToRemove = spawnedCount;
        this.state.pendingTargetRespawns = this.state.pendingTargetRespawns.filter((entry) => {
            if (remainingToRemove > 0 && entry.readyAtMs <= now) {
                remainingToRemove -= 1;
                return false;
            }
            return true;
        });
    }

    spawnTargets(count) {
        const desiredCount = Math.max(0, Math.floor(count || 0));
        if (desiredCount <= 0 || this.state.targetSpawnPoints.length === 0) {
            return 0;
        }

        const targetRadius = CONFIG.TARGET_RADIUS;
        const selection = TargetSpawnUtils.collectSpawnSelections({
            spawnPoints: this.state.targetSpawnPoints,
            startCursor: this.state.targetSpawnCursor,
            desiredCount,
            radius: targetRadius,
            canvasWidth: CONFIG.CANVAS_WIDTH,
            canvasHeight: CONFIG.CANVAS_HEIGHT,
            walls: this.state.walls,
            doorSegments: this.state.doors
                .map((doorEntity) => doorEntity.getComponent('door'))
                .filter(Boolean)
                .map((door) => DoorSystem.getDoorSegment(door)),
            blocks: this.state.blocks
                .map((block) => {
                    const transform = block.getComponent('transform');
                    const collision = block.getComponent('collision');
                    if (!transform || !collision || collision.type !== 'aabb') return null;
                    return {
                        x: transform.x + collision.offsetX,
                        y: transform.y + collision.offsetY,
                        w: collision.width,
                        h: collision.height
                    };
                })
                .filter(Boolean),
            playerCircle: this.getPlayerCircle(),
            targetCircles: this.state.targets
                .map((target) => {
                    const transform = target.getComponent('transform');
                    const collision = target.getComponent('collision');
                    if (!transform || !collision || collision.type !== 'circle') return null;
                    return {
                        x: transform.x,
                        y: transform.y,
                        radius: collision.radius
                    };
                })
                .concat(this.state.enemies
                    .map((enemy) => {
                        const transform = enemy.getComponent('transform');
                        const collision = enemy.getComponent('collision');
                        if (!transform || !collision || collision.type !== 'circle') return null;
                        return {
                            x: transform.x,
                            y: transform.y,
                            radius: collision.radius
                        };
                    }))
                .filter(Boolean)
        });

        this.state.targetSpawnCursor = selection.nextCursor;
        for (const spawn of selection.selections) {
            this.state.addEntity(createTarget(spawn.x, spawn.y));
        }
        return selection.selections.length;
    }

    getPlayerCircle() {
        if (!this.state.player) return null;
        const transform = this.state.player.getComponent('transform');
        const collision = this.state.player.getComponent('collision');
        if (!transform || !collision || collision.type !== 'circle') return null;
        return {
            x: transform.x,
            y: transform.y,
            radius: collision.radius
        };
    }

    hasMetLevelCompletionGoal() {
        const hasEnoughEliminations = this.state.getTotalEliminations() >= this.state.levelGoalTargets;
        const victoryArea = this.state.currentMapData?.victoryArea;
        if (!victoryArea) {
            return hasEnoughEliminations;
        }
        return hasEnoughEliminations && this.state.hasReachedVictoryArea;
    }

    isPlayerInsideVictoryArea() {
        const area = this.state.currentMapData?.victoryArea;
        if (!area || !this.state.player) return false;

        const transform = this.state.player.getComponent('transform');
        if (!transform) return false;

        const tile = this.state.currentMapData.tileSize;
        const left = area.col * tile;
        const top = area.row * tile;
        const right = left + area.width * tile;
        const bottom = top + area.height * tile;

        return transform.x >= left
            && transform.x <= right
            && transform.y >= top
            && transform.y <= bottom;
    }

    syncHUD() {
        const scoreValue = document.getElementById('scoreValue');
        if (scoreValue) {
            scoreValue.textContent = this.state.score;
        }

        const timerValue = document.getElementById('timerValue');
        if (timerValue) {
            timerValue.textContent = RoundUtils.formatCountdown(this.state.roundTimeRemainingMs);
        }

        const mapName = document.getElementById('levelName');
        if (mapName) {
            mapName.textContent = this.state.currentMapData?.meta?.name || '-';
        }

        const goalValue = document.getElementById('goalValue');
        if (goalValue) {
            const eliminations = this.state.getTotalEliminations();
            if (Number.isFinite(this.state.levelGoalTargets)) {
                const baseGoal = `${eliminations}/${this.state.levelGoalTargets}`;
                goalValue.textContent = this.state.currentMapData?.victoryArea
                    ? `${baseGoal} + ${this.state.hasReachedVictoryArea ? 'EXIT OK' : 'EXIT'}`
                    : baseGoal;
            } else {
                goalValue.textContent = `${eliminations}/∞`;
            }
        }

        const hpValue = document.getElementById('hpValue');
        if (hpValue) {
            const hp = this.state.player?.getComponent('health')?.current;
            hpValue.textContent = Number.isFinite(hp) ? String(Math.max(0, Math.round(hp))) : '-';
        }

        const activeWeapon = this.state.player?.getComponent('playerState')?.activeWeapon ?? 'gun';
        const slot1 = document.getElementById('weaponSlot1');
        const slot2 = document.getElementById('weaponSlot2');
        if (slot1) slot1.classList.toggle('active', activeWeapon === 'gun');
        if (slot2) slot2.classList.toggle('active', activeWeapon === 'melee');
    }
}

async function loadLevelCatalog() {
    if (typeof window !== 'undefined' && Array.isArray(window.__testLevelCatalog)) {
        return window.__testLevelCatalog;
    }
    const response = await fetch('./maps/index.json', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Unable to load level catalog (${response.status}).`);
    }
    const payload = await response.json();
    if (!Array.isArray(payload?.levels)) {
        throw new Error('Level catalog must include a levels array.');
    }
    return payload.levels;
}

async function loadLevelMap(levelEntry) {
    if (typeof window !== 'undefined' && window.__testLevelMaps && levelEntry?.id && window.__testLevelMaps[levelEntry.id]) {
        return MapFormat.normalizeMapData(window.__testLevelMaps[levelEntry.id]);
    }
    const response = await fetch(`./${levelEntry.path}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Unable to load level "${levelEntry.name}" (${response.status}).`);
    }
    const payload = await response.json();
    return MapFormat.normalizeMapData(payload);
}

function showLevelMenu(levels, onSelect) {
    const menu = document.getElementById('levelMenu');
    const list = document.getElementById('levelList');
    const status = document.getElementById('levelMenuStatus');
    if (!menu || !list) return;

    list.innerHTML = '';
    for (const level of levels) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'level-item';
        button.textContent = level.name;
        button.addEventListener('click', () => onSelect(level));
        list.appendChild(button);
    }

    if (status) status.textContent = '';
    menu.classList.add('visible');
}

function hideLevelMenu() {
    const menu = document.getElementById('levelMenu');
    if (menu) menu.classList.remove('visible');
}

function setLevelMenuStatus(text) {
    const status = document.getElementById('levelMenuStatus');
    if (status) status.textContent = text;
}

function hideGameOverOverlay() {
    const gameOver = document.getElementById('gameOver');
    if (gameOver) {
        gameOver.classList.remove('visible');
    }
}

function getDefaultLevelInfo(mapData) {
    const timeLimit = RoundUtils.formatCountdown(mapData?.settings?.timeLimitMs || CONFIG.ROUND_DURATION_MS);
    const goal = mapData?.settings?.maxTargetsToKill || CONFIG.DEFAULT_LEVEL_GOAL_KILLS;
    const lines = [
        `Time limit: ${timeLimit}.`,
        `Elimination goal: ${goal}.`,
        mapData?.victoryArea
            ? 'After meeting the goal, reach the green EXIT area to win.'
            : 'Meet the elimination goal before the timer expires.'
    ];
    return {
        title: mapData?.meta?.name || 'Mission Briefing',
        body: lines
    };
}

function showInfoOverlay(mapData, game) {
    const overlay = document.getElementById('infoOverlay');
    const titleEl = document.getElementById('infoTitle');
    const bodyEl = document.getElementById('infoBody');
    if (!overlay || !bodyEl) return;

    const configuredInfo = mapData?.info;
    const info = configuredInfo && (configuredInfo.title || (Array.isArray(configuredInfo.body) && configuredInfo.body.length > 0))
        ? configuredInfo
        : getDefaultLevelInfo(mapData);

    if (titleEl) {
        titleEl.textContent = info.title || mapData?.meta?.name || 'Mission Briefing';
    }
    bodyEl.innerHTML = '';
    const lines = Array.isArray(info.body) ? info.body : [];
    for (const line of lines) {
        const paragraph = document.createElement('p');
        paragraph.textContent = line;
        bodyEl.appendChild(paragraph);
    }

    if (game?.state) {
        game.state.isPaused = true;
    }
    overlay.classList.add('visible');
}

function dismissInfoOverlay() {
    const overlay = document.getElementById('infoOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
    if (window.game?.state) {
        window.game.state.isPaused = false;
    }
}

function isInfoOverlayVisible() {
    return Boolean(document.getElementById('infoOverlay')?.classList.contains('visible'));
}

window.loadMapFromJson = function loadMapFromJson(text) {
    const map = MapFormat.mapFromJson(text);
    localStorage.setItem(CONFIG.MAP_STORAGE_KEY, MapFormat.mapToJson(map));
    return map;
};

window.exportCurrentMap = function exportCurrentMap() {
    const text = localStorage.getItem(CONFIG.MAP_STORAGE_KEY);
    if (text) {
        return text;
    }
    return MapFormat.mapToJson(MapFormat.createDefaultMapData());
};

window.setActiveMap = function setActiveMap(mapPayload) {
    const map = MapFormat.normalizeMapData(mapPayload);
    localStorage.setItem(CONFIG.MAP_STORAGE_KEY, MapFormat.mapToJson(map));
    return map;
};

window.serializeGameState = function serializeGameState() {
    if (!window.game) return null;
    return SimulationCore.serializeGameState(window.game.state);
};

window.deserializeGameState = function deserializeGameState(payload) {
    return SimulationCore.deserializeGameState(payload);
};

window.__setTargetsDestroyed = function __setTargetsDestroyed(count) {
    if (!window.game || !window.game.state) return;
    const next = Math.max(0, Math.floor(count));
    window.game.state.targetsDestroyed = next;
};

window.__setEnemiesDestroyed = function __setEnemiesDestroyed(count) {
    if (!window.game || !window.game.state) return;
    const next = Math.max(0, Math.floor(count));
    window.game.state.enemiesDestroyed = next;
};

function isEditorPreviewRequested() {
    const params = new URLSearchParams(window.location.search || '');
    return params.get('editorPreview') === '1';
}

function loadEditorPreviewMap() {
    const text = localStorage.getItem(CONFIG.MAP_STORAGE_KEY);
    if (!text) {
        return MapFormat.createDefaultMapData();
    }
    return MapFormat.mapFromJson(text);
}

window.addEventListener('load', () => {
    window.game = null;
    let levelsCache = [];

    const startGameWithMap = (mapData) => {
        hideGameOverOverlay();
        dismissInfoOverlay();
        const game = new Game(mapData);
        window.game = game;
        game.init();
        game.start();
        hideLevelMenu();
        showInfoOverlay(game.state.currentMapData, game);
    };

    const startLevel = async (level) => {
        try {
            setLevelMenuStatus('Loading level...');
            const mapData = await loadLevelMap(level);
            startGameWithMap(mapData);
        } catch (error) {
            setLevelMenuStatus(error.message);
        }
    };

    const ensureLevelsCache = async () => {
        if (levelsCache.length > 0) {
            return;
        }
        try {
            levelsCache = await loadLevelCatalog();
        } catch (error) {
            setLevelMenuStatus(error.message);
            levelsCache = [
                {
                    id: 'fallback-default',
                    name: 'Fallback Default',
                    path: ''
                }
            ];
            window.__testLevelMaps = window.__testLevelMaps || {};
            window.__testLevelMaps['fallback-default'] = MapFormat.createDefaultMapData();
        }
    };

    const returnToLevelSelect = async () => {
        const current = window.game;
        if (current) {
            current.isRunning = false;
        }
        window.game = null;
        hideGameOverOverlay();
        dismissInfoOverlay();
        await ensureLevelsCache();
        showLevelMenu(levelsCache, startLevel);
    };

    window.advanceTime = (ms, options = {}) => {
        const game = window.game;
        if (!game) {
            throw new Error('No active level. Select a level first.');
        }
        if (isInfoOverlayVisible()) {
            dismissInfoOverlay();
        }
        game.advanceTime(ms, Object.assign({ skipDOM: true }, options));
    };

    window.render_game_to_text = () => {
        const game = window.game;
        if (!game) {
            return JSON.stringify({
                mode: 'level_select',
                hasGame: false
            });
        }
        return game.renderGameToText();
    };

    const levelSelectButton = document.getElementById('levelSelectButton');
    if (levelSelectButton) {
        levelSelectButton.onclick = () => {
            void returnToLevelSelect();
        };
    }

    const infoStartButton = document.getElementById('infoStartButton');
    if (infoStartButton) {
        infoStartButton.onclick = () => dismissInfoOverlay();
    }

    window.addEventListener('keydown', (event) => {
        if (event.code === 'Escape' && window.game) {
            event.preventDefault();
            void returnToLevelSelect();
        }
    });

    (async () => {
        if (isEditorPreviewRequested()) {
            try {
                const previewMap = loadEditorPreviewMap();
                startGameWithMap(previewMap);
                return;
            } catch (error) {
                setLevelMenuStatus(`Editor preview failed: ${error.message}`);
            }
        }

        await ensureLevelsCache();
        showLevelMenu(levelsCache, startLevel);
    })();
});
