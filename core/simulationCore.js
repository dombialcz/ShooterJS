// Deterministic simulation core boundary.
const SimulationCore = {
    stepSimulation(gameState, dt, options = {}) {
        if (!gameState || gameState.isPaused || gameState.isGameOver) {
            return gameState;
        }

        gameState.timeMs = (gameState.timeMs || 0) + dt * 1000;

        const systems = options.systems || {
            InputSystem,
            AimingSystem,
            EnemyPerceptionSystem,
            EnemyBehaviorSystem,
            MovementSystem,
            DoorSystem,
            BlockSystem,
            VisionSystem,
            ShootingSystem,
            EnemyCombatSystem
        };

        if (options.inputFrame) {
            this.applyInputFrame(gameState, options.inputFrame);
        }

        if (!options.skipInput && systems.InputSystem) {
            systems.InputSystem.update(gameState, dt, {
                skipDOM: Boolean(options.skipDOM)
            });
        }

        if (systems.AimingSystem) systems.AimingSystem.update(gameState, dt);
        if (systems.EnemyPerceptionSystem) systems.EnemyPerceptionSystem.update(gameState, dt);
        if (systems.EnemyBehaviorSystem) systems.EnemyBehaviorSystem.update(gameState, dt);
        if (systems.MovementSystem) systems.MovementSystem.update(gameState, dt);
        if (systems.DoorSystem) systems.DoorSystem.update(gameState, dt);
        if (systems.BlockSystem) systems.BlockSystem.update(gameState, dt);

        if (systems.MovementSystem && gameState.player) {
            systems.MovementSystem.resolveWallCollisions(gameState.player, gameState.walls);
        }

        if (systems.VisionSystem) systems.VisionSystem.update(gameState, dt);
        if (systems.ShootingSystem) systems.ShootingSystem.update(gameState, dt);
        if (systems.EnemyCombatSystem) systems.EnemyCombatSystem.update(gameState, dt);

        return gameState;
    },

    applyInputFrame(gameState, inputFrame) {
        const player = gameState.player;
        if (!player) return;

        const input = player.getComponent('input');
        if (!input) return;
        const playerState = player.getComponent('playerState');

        if (typeof inputFrame.moveX === 'number') input.moveX = inputFrame.moveX;
        if (typeof inputFrame.moveY === 'number') input.moveY = inputFrame.moveY;
        if (typeof inputFrame.aimAngle === 'number') input.aimAngle = inputFrame.aimAngle;
        if (typeof inputFrame.isADS === 'boolean') input.isADS = inputFrame.isADS;
        if (typeof inputFrame.isShooting === 'boolean') input.isShooting = inputFrame.isShooting;

        if (playerState && typeof inputFrame.isADS === 'boolean') {
            playerState.isADSActive = inputFrame.isADS;
            playerState.movementSpeedMultiplier = inputFrame.isADS ? CONFIG.PLAYER_ADS_SPEED_MULTIPLIER : 1;
        }
    },

    serializeGameState(gameState) {
        const player = gameState.player;
        const playerTransform = player ? player.getComponent('transform') : null;
        const playerPhysics = player ? player.getComponent('physics') : null;
        const playerInput = player ? player.getComponent('input') : null;
        const playerGun = player ? player.getComponent('gun') : null;
        const playerState = player ? player.getComponent('playerState') : null;
        const playerHealth = player ? player.getComponent('health') : null;

        const doors = gameState.doors
            .map((doorEntity) => {
                const door = doorEntity.getComponent('door');
                if (!door) return null;
                return {
                    id: doorEntity.id,
                    hingeX: round2(door.hingeX),
                    hingeY: round2(door.hingeY),
                    currentAngle: round4(door.currentAngle),
                    angularVelocity: round4(door.angularVelocity)
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.id - b.id);

        const blocks = gameState.blocks
            .map((blockEntity) => {
                const transform = blockEntity.getComponent('transform');
                const collision = blockEntity.getComponent('collision');
                const block = blockEntity.getComponent('block');
                if (!transform || !collision || !block) return null;
                return {
                    id: blockEntity.id,
                    x: round2(transform.x),
                    y: round2(transform.y),
                    vx: round3(block.vx),
                    vy: round3(block.vy),
                    aabb: {
                        x: round2(transform.x + collision.offsetX),
                        y: round2(transform.y + collision.offsetY),
                        w: collision.width,
                        h: collision.height
                    }
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.id - b.id);

        const enemies = (gameState.enemies || [])
            .map((enemyEntity) => {
                const transform = enemyEntity.getComponent('transform');
                const health = enemyEntity.getComponent('health');
                const enemy = enemyEntity.getComponent('enemy');
                if (!transform || !enemy) return null;

                return {
                    id: enemyEntity.id,
                    sourceId: enemy.sourceId || null,
                    type: enemy.type,
                    x: round2(transform.x),
                    y: round2(transform.y),
                    state: enemy.state,
                    alerted: Boolean(enemy.isAlerted),
                    hasLineOfSight: Boolean(enemy.hasLineOfSight),
                    health: health
                        ? { current: round2(health.current), max: round2(health.max) }
                        : null,
                    combat: {
                        lastAttackAtMs: Number.isFinite(enemy.lastAttackAtMs) ? Math.round(enemy.lastAttackAtMs) : null,
                        firstShotMustMiss: Boolean(enemy.firstShotMustMiss),
                        pendingAttack: Boolean(enemy.pendingAttack),
                        rngState: (enemy.shotRngState >>> 0) || 0
                    },
                    patrol: Array.isArray(enemy.patrol)
                        ? enemy.patrol.map((point) => ({ x: round2(point.x), y: round2(point.y) }))
                        : [],
                    path: Array.isArray(enemy.currentPath)
                        ? enemy.currentPath.map((point) => ({ x: round2(point.x), y: round2(point.y) }))
                        : []
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.id - b.id);

        const tracers = [];
        for (const entity of gameState.entities.values()) {
            if (entity.type !== 'tracer') continue;
            const tracer = entity.getComponent('tracer');
            if (!tracer) continue;
            tracers.push({
                id: entity.id,
                x1: round2(tracer.x1),
                y1: round2(tracer.y1),
                x2: round2(tracer.x2),
                y2: round2(tracer.y2),
                color: tracer.color
            });
        }
        tracers.sort((a, b) => a.id - b.id);

        const map = gameState.currentMapData || null;

        return {
            coordinateSystem: {
                origin: '(0,0) at top-left',
                axis: 'x right, y down'
            },
            player: playerTransform
                ? {
                    x: round2(playerTransform.x),
                    y: round2(playerTransform.y),
                    rotation: round4(playerTransform.rotation),
                    vx: playerPhysics ? round3(playerPhysics.vx) : 0,
                    vy: playerPhysics ? round3(playerPhysics.vy) : 0,
                    movementSpeedMultiplier: playerState ? round3(playerState.movementSpeedMultiplier || 1) : 1,
                    health: playerHealth
                        ? {
                            current: round2(playerHealth.current),
                            max: round2(playerHealth.max)
                        }
                        : null,
                    input: playerInput
                        ? {
                            moveX: round3(playerInput.moveX),
                            moveY: round3(playerInput.moveY),
                            aimAngle: round4(playerInput.aimAngle),
                            isADS: Boolean(playerInput.isADS),
                            isShooting: Boolean(playerInput.isShooting)
                        }
                        : null,
                    firingCone: playerGun
                        ? {
                            halfAngleRad: round4(playerGun.currentSpreadHalfAngleRad || 0),
                            tightenProgress: round4(getFiringConeTightenProgress(gameState, playerGun))
                        }
                        : null
                }
                : null,
            doors,
            blocks,
            enemies,
            targets: {
                alive: gameState.targets.length,
                targetCount: gameState.initialTargetCount || 0,
                pendingRespawns: Array.isArray(gameState.pendingTargetRespawns) ? gameState.pendingTargetRespawns.length : 0,
                destroyed: gameState.targetsDestroyed || 0,
                goal: Number.isFinite(gameState.levelGoalTargets) ? gameState.levelGoalTargets : null,
                enemiesAlive: (gameState.enemies || []).length,
                enemiesDestroyed: gameState.enemiesDestroyed || 0,
                eliminations: ((gameState.targetsDestroyed || 0) + (gameState.enemiesDestroyed || 0))
            },
            round: {
                timeRemainingMs: Math.max(0, Math.round(gameState.roundTimeRemainingMs || 0)),
                durationMs: Math.max(0, Math.round(gameState.roundDurationMs || 0)),
                isExpired: Boolean((gameState.roundTimeRemainingMs || 0) <= 0 || gameState.isGameOver),
                isLevelComplete: Boolean(gameState.isLevelComplete),
                gameOverReason: gameState.gameOverReason || null,
                hasReachedVictoryArea: Boolean(gameState.hasReachedVictoryArea)
            },
            score: gameState.score,
            isGameOver: gameState.isGameOver,
            isPaused: gameState.isPaused,
            activeMap: map
                ? {
                    name: map.meta?.name || null,
                    version: map.version,
                    cols: map.cols,
                    rows: map.rows,
                    tileSize: map.tileSize,
                    victoryArea: map.victoryArea || null,
                    info: map.info || null
                }
                : null,
            latestTracer: tracers.length > 0 ? tracers[tracers.length - 1] : null,
            shotRngState: (gameState.shotRngState >>> 0) || 0
        };
    },

    deserializeGameState(payload) {
        return JSON.parse(JSON.stringify(payload));
    }
};

function round2(value) {
    return Math.round(value * 100) / 100;
}

function round3(value) {
    return Math.round(value * 1000) / 1000;
}

function round4(value) {
    return Math.round(value * 10000) / 10000;
}

function getFiringConeTightenProgress(gameState, gun) {
    if (!gun || gun.adsStartedAtMs === null || gun.adsStartedAtMs === undefined) {
        return 0;
    }
    const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : null;
    const duration = Math.max(1, (cfg && cfg.FIRING_CONE_TIGHTEN_MS) || 2000);
    const now = gameState.timeMs || 0;
    return Math.min(1, Math.max(0, (now - gun.adsStartedAtMs) / duration));
}

if (typeof window !== 'undefined') {
    window.SimulationCore = SimulationCore;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimulationCore;
}
