// Main game state and loop

class GameState {
    constructor() {
        this.entities = new Map();
        this.score = 0;
        this.isGameOver = false;
        this.isPaused = false;
        this.player = null;
        this.walls = [];
        this.doors = [];
        this.targets = [];
        this.blocks = [];
        this.currentMapData = null;
        this.timeMs = 0;
        this.shotRngState = CONFIG.SHOT_RNG_SEED >>> 0;
        this.roundDurationMs = CONFIG.ROUND_DURATION_MS;
        this.roundTimeRemainingMs = CONFIG.ROUND_DURATION_MS;
        this.initialTargetCount = 0;
        this.targetSpawnCursor = 0;
        this.targetSpawnPoints = [];
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
        }

        return entity;
    }

    removeEntity(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity) return;

        if (entity.type === 'target') {
            const index = this.targets.indexOf(entity);
            if (index > -1) this.targets.splice(index, 1);
        } else if (entity.type === 'door') {
            const index = this.doors.indexOf(entity);
            if (index > -1) this.doors.splice(index, 1);
        } else if (entity.type === 'block') {
            const index = this.blocks.indexOf(entity);
            if (index > -1) this.blocks.splice(index, 1);
        }

        this.entities.delete(entityId);
    }

    addScore(points) {
        this.score += points;
        document.getElementById('scoreValue').textContent = this.score;
    }

    checkGameOver() {
        if (this.roundTimeRemainingMs <= 0 && !this.isGameOver) {
            this.isGameOver = true;
            const finalScore = document.getElementById('finalScore');
            if (finalScore) {
                finalScore.textContent = this.score;
            }
            const title = document.getElementById('gameOverTitle');
            if (title) {
                title.textContent = "TIME'S UP";
            }
            const gameOver = document.getElementById('gameOver');
            if (gameOver) {
                gameOver.classList.add('visible');
            }
        }
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
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = new GameState();

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
        this.syncHUD();

        InputSystem.init(this.canvas, this.state);

        document.getElementById('restartButton').onclick = () => {
            this.restart();
        };

        console.log('Game initialized!');
        console.log(`Player: ${this.state.player ? 'Created' : 'Missing'}`);
        console.log(`Walls: ${this.state.walls.length}`);
        console.log(`Doors: ${this.state.doors.length}`);
        console.log(`Blocks: ${this.state.blocks.length}`);
        console.log(`Targets: ${this.state.targets.length}`);
    }

    initializeMap() {
        const mapData = this.loadMapData();
        this.state.currentMapData = mapData;
        this.buildMapFromData(mapData);
    }

    loadMapData() {
        const fallback = MapFormat.createDefaultMapData();
        let rawText = null;

        try {
            rawText = localStorage.getItem(CONFIG.MAP_STORAGE_KEY);
        } catch (error) {
            console.warn('Unable to access localStorage map. Falling back to default.', error);
        }

        if (!rawText) {
            return fallback;
        }

        try {
            return MapFormat.mapFromJson(rawText);
        } catch (error) {
            console.warn('Invalid saved map, using default map:', error.message);
            return fallback;
        }
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
        const tile = mapData.tileSize;
        const spawns = Array.isArray(mapData.targetSpawns) ? mapData.targetSpawns : [];
        this.state.targetSpawnPoints = spawns.map((spawn) => ({
            x: spawn.col * tile + tile / 2,
            y: spawn.row * tile + tile / 2
        }));
        this.state.initialTargetCount = this.state.targetSpawnPoints.length;
        this.state.targetSpawnCursor = 0;
        this.refillTargets();
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
        this.state.checkGameOver();
        if (!this.state.isGameOver) {
            this.refillTargets();
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

    refillTargets() {
        const missingCount = Math.max(0, this.state.initialTargetCount - this.state.targets.length);
        if (missingCount <= 0 || this.state.targetSpawnPoints.length === 0) {
            return;
        }

        const targetRadius = CONFIG.TARGET_RADIUS;
        const selection = TargetSpawnUtils.collectSpawnSelections({
            spawnPoints: this.state.targetSpawnPoints,
            startCursor: this.state.targetSpawnCursor,
            desiredCount: missingCount,
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
                .filter(Boolean)
        });

        this.state.targetSpawnCursor = selection.nextCursor;
        for (const spawn of selection.selections) {
            this.state.addEntity(createTarget(spawn.x, spawn.y));
        }
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

    syncHUD() {
        const scoreValue = document.getElementById('scoreValue');
        if (scoreValue) {
            scoreValue.textContent = this.state.score;
        }

        const timerValue = document.getElementById('timerValue');
        if (timerValue) {
            timerValue.textContent = RoundUtils.formatCountdown(this.state.roundTimeRemainingMs);
        }
    }
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

window.addEventListener('load', () => {
    const game = new Game();
    window.game = game;
    game.init();
    game.start();

    window.advanceTime = (ms, options = {}) => {
        if (game.isRunning) {
            game.isRunning = false;
        }
        game.advanceTime(ms, Object.assign({ skipDOM: true }, options));
    };

    window.render_game_to_text = () => game.renderGameToText();
});
