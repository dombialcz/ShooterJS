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

function fallbackLineOfSight(gameState, x1, y1, x2, y2) {
    const collision = getCollisionRef();
    if (!collision) return true;
    const epsilon = 0.001;
    const segments = typeof gameState.getVisionSegments === 'function'
        ? gameState.getVisionSegments()
        : (gameState.walls || []);
    for (const segment of segments) {
        const hit = collision.lineIntersection(x1, y1, x2, y2, segment.x1, segment.y1, segment.x2, segment.y2);
        if (!hit) continue;
        if (hit.t1 > epsilon && hit.t1 < 1 - epsilon) {
            return false;
        }
    }
    return true;
}

const EnemyPerceptionSystem = {
    update(gameState, dt) {
        const visibilityUtils = getVisibilityUtilsRef();
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
            const health = enemyEntity.getComponent('health');
            if (!enemy || !transform || !health || health.current <= 0) continue;

            const dx = playerTransform.x - transform.x;
            const dy = playerTransform.y - transform.y;
            const distance = Math.hypot(dx, dy);
            const inRange = distance <= enemy.visionRange;

            let seesPlayer = false;
            if (inRange) {
                seesPlayer = visibilityUtils
                    ? visibilityUtils.hasLineOfSight(
                        gameState,
                        transform.x,
                        transform.y,
                        playerTransform.x,
                        playerTransform.y
                    )
                    : fallbackLineOfSight(gameState, transform.x, transform.y, playerTransform.x, playerTransform.y);
            }

            enemy.hasLineOfSight = seesPlayer;
            if (seesPlayer) {
                enemy.isAlerted = true;
                enemy.lastSeenPlayerAtMs = now;
                enemy.state = 'alerted';
                continue;
            }

            if (enemy.isAlerted) {
                enemy.state = 'alerted';
                continue;
            }

            enemy.state = Array.isArray(enemy.patrol) && enemy.patrol.length > 0 ? 'patrolling' : 'idle';
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnemyPerceptionSystem;
}
