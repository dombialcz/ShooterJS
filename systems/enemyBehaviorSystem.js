function getGeometryRef() {
    if (typeof window !== 'undefined' && window.Geometry) return window.Geometry;
    if (typeof Geometry !== 'undefined') return Geometry;
    if (typeof module !== 'undefined' && module.exports) {
        return require('../utils/geometry.js');
    }
    return null;
}

function getVisibilityUtilsRef() {
    if (typeof window !== 'undefined' && window.VisibilityUtils) return window.VisibilityUtils;
    if (typeof VisibilityUtils !== 'undefined') return VisibilityUtils;
    if (typeof module !== 'undefined' && module.exports) {
        return require('../core/visibilityUtils.js');
    }
    return null;
}

function getCollisionRef() {
    if (typeof window !== 'undefined' && window.Collision) return window.Collision;
    if (typeof Collision !== 'undefined') return Collision;
    if (typeof module !== 'undefined' && module.exports) {
        return require('../utils/collision.js');
    }
    return null;
}

function getAStarPathfindingRef() {
    if (typeof window !== 'undefined' && window.AStarPathfinding) return window.AStarPathfinding;
    if (typeof AStarPathfinding !== 'undefined') return AStarPathfinding;
    if (typeof module !== 'undefined' && module.exports) {
        return require('../core/aStarPathfinding.js');
    }
    return null;
}

const EnemyBehaviorSystem = {
    update(gameState, dt) {
        const geometry = getGeometryRef();
        const visibilityUtils = getVisibilityUtilsRef();
        const pathfinding = getAStarPathfindingRef();
        if (!geometry || !pathfinding) {
            return;
        }
        const player = gameState.player;
        if (!player || !Array.isArray(gameState.enemies) || gameState.enemies.length === 0) {
            return;
        }

        const playerTransform = player.getComponent('transform');
        const playerHealth = player.getComponent('health');
        if (!playerTransform || !playerHealth || playerHealth.current <= 0) {
            return;
        }

        const now = gameState.timeMs || 0;
        for (const enemyEntity of gameState.enemies) {
            const enemy = enemyEntity.getComponent('enemy');
            const transform = enemyEntity.getComponent('transform');
            const physics = enemyEntity.getComponent('physics');
            const health = enemyEntity.getComponent('health');
            if (!enemy || !transform || !physics || !health || health.current <= 0) continue;

            enemy.pendingAttack = false;

            if (!enemy.isAlerted) {
                this.clearPath(enemy);
                this.updatePatrol(enemy, transform, physics, now);
                this.trackStuckState(enemy, transform, physics, now);
                continue;
            }

            const toPlayerX = playerTransform.x - transform.x;
            const toPlayerY = playerTransform.y - transform.y;
            const distance = Math.hypot(toPlayerX, toPlayerY);
            const towardPlayer = geometry.normalize(toPlayerX, toPlayerY);
            const desiredSpeed = Math.max(1, enemy.moveSpeed);
            transform.rotation = Math.atan2(toPlayerY, toPlayerX);

            const hasDirectLOS = this.hasLineOfSight(
                gameState,
                transform.x,
                transform.y,
                playerTransform.x,
                playerTransform.y,
                visibilityUtils
            );
            const shouldForceRepath = this.shouldRepathForStuck(enemy, now);
            const shouldRepathForInterval = now >= (enemy.nextRepathAtMs || 0);

            if (!hasDirectLOS && (shouldRepathForInterval || shouldForceRepath)) {
                this.recomputePathToPlayer(gameState, enemy, transform, playerTransform, now, pathfinding);
            } else if (hasDirectLOS) {
                this.clearPath(enemy);
                enemy.nextRepathAtMs = now + Math.max(120, CONFIG.ENEMY_REPATH_INTERVAL_MS || 450);
            }

            if (enemy.type === 'melee') {
                if (distance <= enemy.attackRange) {
                    physics.vx = 0;
                    physics.vy = 0;
                    enemy.pendingAttack = true;
                    enemy.state = 'attacking';
                } else if (!hasDirectLOS && this.followCurrentPath(enemy, transform, physics)) {
                    enemy.state = 'chasing';
                } else {
                    physics.vx = towardPlayer.x * desiredSpeed;
                    physics.vy = towardPlayer.y * desiredSpeed;
                    enemy.state = 'chasing';
                }
                this.trackStuckState(enemy, transform, physics, now);
                continue;
            }

            const preferredDistance = Math.min(enemy.attackRange * 0.92, Math.max(60, enemy.preferredDistance || enemy.attackRange * 0.75));
            if (distance > enemy.attackRange) {
                if (!hasDirectLOS && this.followCurrentPath(enemy, transform, physics)) {
                    enemy.state = 'chasing';
                } else {
                    physics.vx = towardPlayer.x * desiredSpeed;
                    physics.vy = towardPlayer.y * desiredSpeed;
                    enemy.state = 'chasing';
                }
            } else if (distance < preferredDistance * 0.72) {
                physics.vx = -towardPlayer.x * desiredSpeed;
                physics.vy = -towardPlayer.y * desiredSpeed;
                enemy.state = 'repositioning';
            } else {
                physics.vx = 0;
                physics.vy = 0;
                enemy.state = 'holding';
            }

            if (distance <= enemy.attackRange && enemy.hasLineOfSight) {
                enemy.pendingAttack = true;
                enemy.state = 'attacking';
            }
            this.trackStuckState(enemy, transform, physics, now);
        }
    },

    updatePatrol(enemy, transform, physics, now) {
        if (!Array.isArray(enemy.patrol) || enemy.patrol.length === 0) {
            physics.vx = 0;
            physics.vy = 0;
            enemy.state = 'idle';
            return;
        }

        const index = Number.isInteger(enemy.patrolIndex) ? enemy.patrolIndex : 0;
        const waypoint = enemy.patrol[index] || enemy.patrol[0];
        if (!waypoint) {
            physics.vx = 0;
            physics.vy = 0;
            enemy.state = 'idle';
            return;
        }

        const dx = waypoint.x - transform.x;
        const dy = waypoint.y - transform.y;
        const distance = Math.hypot(dx, dy);
        const reachDistance = 8;
        if (distance <= reachDistance) {
            enemy.patrolIndex = (index + 1) % enemy.patrol.length;
            physics.vx = 0;
            physics.vy = 0;
            enemy.state = 'patrolling';
            enemy.lastRepathAtMs = now;
            return;
        }

        const geometry = getGeometryRef();
        if (!geometry) return;
        const direction = geometry.normalize(dx, dy);
        const speed = Math.max(1, enemy.moveSpeed * 0.75);
        physics.vx = direction.x * speed;
        physics.vy = direction.y * speed;
        transform.rotation = Math.atan2(dy, dx);
        enemy.state = 'patrolling';
    },

    recomputePathToPlayer(gameState, enemy, enemyTransform, playerTransform, now, pathfinding) {
        const mapData = gameState.currentMapData;
        if (!mapData) return;

        const grid = pathfinding.buildPassabilityGrid(mapData, gameState, {
            includeBlocks: true
        });
        const start = pathfinding.worldToCell(mapData, enemyTransform.x, enemyTransform.y);
        const goal = pathfinding.worldToCell(mapData, playerTransform.x, playerTransform.y);

        const result = pathfinding.findPath(
            grid,
            start.col,
            start.row,
            goal.col,
            goal.row,
            { maxExpansions: CONFIG.ENEMY_ASTAR_MAX_EXPANSIONS || 220 }
        );

        enemy.lastRepathAtMs = now;
        enemy.nextRepathAtMs = now + Math.max(120, CONFIG.ENEMY_REPATH_INTERVAL_MS || 450);

        if (!result.reached || result.path.length <= 1) {
            this.clearPath(enemy);
            return;
        }

        enemy.currentPath = result.path
            .slice(1)
            .map((cell) => pathfinding.cellToWorld(mapData, cell.col, cell.row));
        enemy.pathIndex = 0;
    },

    followCurrentPath(enemy, transform, physics) {
        if (!Array.isArray(enemy.currentPath) || enemy.currentPath.length === 0) return false;

        let index = Number.isInteger(enemy.pathIndex) ? enemy.pathIndex : 0;
        while (index < enemy.currentPath.length) {
            const waypoint = enemy.currentPath[index];
            const dx = waypoint.x - transform.x;
            const dy = waypoint.y - transform.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= 8) {
                index += 1;
                continue;
            }
            const geometry = getGeometryRef();
            if (!geometry) return false;
            const direction = geometry.normalize(dx, dy);
            physics.vx = direction.x * Math.max(1, enemy.moveSpeed);
            physics.vy = direction.y * Math.max(1, enemy.moveSpeed);
            transform.rotation = Math.atan2(dy, dx);
            enemy.pathIndex = index;
            return true;
        }

        this.clearPath(enemy);
        return false;
    },

    clearPath(enemy) {
        enemy.currentPath = [];
        enemy.pathIndex = 0;
    },

    trackStuckState(enemy, transform, physics, now) {
        const moving = Math.hypot(physics.vx, physics.vy) > 1;
        if (!moving) {
            enemy.lastPositionX = transform.x;
            enemy.lastPositionY = transform.y;
            enemy.stuckSinceMs = null;
            return;
        }

        if (enemy.lastPositionX === null || enemy.lastPositionY === null) {
            enemy.lastPositionX = transform.x;
            enemy.lastPositionY = transform.y;
            enemy.stuckSinceMs = null;
            return;
        }

        const delta = Math.hypot(transform.x - enemy.lastPositionX, transform.y - enemy.lastPositionY);
        if (delta <= 0.4) {
            enemy.stuckSinceMs = enemy.stuckSinceMs === null ? now : enemy.stuckSinceMs;
        } else {
            enemy.stuckSinceMs = null;
        }
        enemy.lastPositionX = transform.x;
        enemy.lastPositionY = transform.y;
    },

    shouldRepathForStuck(enemy, now) {
        if (enemy.stuckSinceMs === null || enemy.stuckSinceMs === undefined) return false;
        return now - enemy.stuckSinceMs >= Math.max(120, CONFIG.ENEMY_STUCK_REPATH_MS || 600);
    },

    hasLineOfSight(gameState, x1, y1, x2, y2, visibilityUtils) {
        if (visibilityUtils && typeof visibilityUtils.hasLineOfSight === 'function') {
            return visibilityUtils.hasLineOfSight(gameState, x1, y1, x2, y2);
        }

        const collision = getCollisionRef();
        if (!collision) return true;
        const segments = typeof gameState.getVisionSegments === 'function'
            ? gameState.getVisionSegments()
            : (gameState.walls || []);
        const epsilon = 0.001;
        for (const segment of segments) {
            const hit = collision.lineIntersection(x1, y1, x2, y2, segment.x1, segment.y1, segment.x2, segment.y2);
            if (!hit) continue;
            if (hit.t1 > epsilon && hit.t1 < 1 - epsilon) {
                return false;
            }
        }
        return true;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnemyBehaviorSystem;
}
