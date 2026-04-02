function getVisibilityUtilsRef() {
    if (typeof window !== 'undefined' && window.VisibilityUtils) return window.VisibilityUtils;
    if (typeof VisibilityUtils !== 'undefined') return VisibilityUtils;
    if (typeof module !== 'undefined' && module.exports) {
        return require('../core/visibilityUtils.js');
    }
    return null;
}

const EnemyCombatSystem = {
    update(gameState, dt) {
        const visibilityUtils = getVisibilityUtilsRef();
        const player = gameState.player;
        if (!player || !Array.isArray(gameState.enemies) || gameState.enemies.length === 0) return;

        const playerTransform = player.getComponent('transform');
        const playerCollision = player.getComponent('collision');
        const playerHealth = player.getComponent('health');
        if (!playerTransform || !playerCollision || !playerHealth || playerHealth.current <= 0) return;

        const now = gameState.timeMs || 0;

        for (const enemyEntity of gameState.enemies) {
            const enemy = enemyEntity.getComponent('enemy');
            const enemyTransform = enemyEntity.getComponent('transform');
            const enemyCollision = enemyEntity.getComponent('collision');
            const enemyHealth = enemyEntity.getComponent('health');
            if (!enemy || !enemyTransform || !enemyCollision || !enemyHealth || enemyHealth.current <= 0) {
                if (enemy) enemy.laserSightStartMs = null;
                continue;
            }

            // Handle active laser sight windup for ranged enemies
            if (enemy.type === 'ranged' && enemy.laserSightStartMs !== null) {
                if (!enemy.pendingAttack) {
                    // Lost target during windup - cancel laser sight
                    enemy.laserSightStartMs = null;
                    continue;
                }

                const windupElapsed = now - enemy.laserSightStartMs;
                if (windupElapsed < (CONFIG.ENEMY_LASER_SIGHT_WINDUP_MS || 300)) {
                    // Still in windup - keep laser sight visible, don't fire yet
                    continue;
                }

                // Windup complete - fire!
                this.resolveRangedAttack(gameState, enemy, enemyTransform, playerTransform, playerCollision, playerHealth, visibilityUtils);
                enemy.lastAttackAtMs = now;
                enemy.laserSightStartMs = null;
                enemy.pendingAttack = false;
                continue;
            }

            if (!enemy.pendingAttack) continue;

            const elapsed = now - (enemy.lastAttackAtMs || 0);
            if (Number.isFinite(enemy.lastAttackAtMs) && elapsed < enemy.attackCooldownMs) {
                enemy.pendingAttack = false;
                continue;
            }

            if (enemy.type === 'melee') {
                this.resolveMeleeAttack(gameState, enemy, enemyTransform, enemyCollision, playerTransform, playerCollision, playerHealth);
                enemy.lastAttackAtMs = now;
                enemy.pendingAttack = false;
                continue;
            }

            // Start laser sight windup for ranged enemy
            enemy.laserSightStartMs = now;
        }
    },

    resolveMeleeAttack(gameState, enemy, enemyTransform, enemyCollision, playerTransform, playerCollision, playerHealth) {
        const dx = playerTransform.x - enemyTransform.x;
        const dy = playerTransform.y - enemyTransform.y;
        const distance = Math.hypot(dx, dy);
        const reach = enemy.attackRange + enemyCollision.radius + playerCollision.radius;
        if (distance > reach) return;
        this.applyPlayerDamage(gameState, playerHealth, enemy.damage);
    },

    resolveRangedAttack(gameState, enemy, enemyTransform, playerTransform, playerCollision, playerHealth, visibilityUtils) {
        const toPlayerX = playerTransform.x - enemyTransform.x;
        const toPlayerY = playerTransform.y - enemyTransform.y;
        const distanceToPlayer = Math.hypot(toPlayerX, toPlayerY);
        if (distanceToPlayer > enemy.attackRange) return;

        let shotAngle = Math.atan2(toPlayerY, toPlayerX);
        let shouldMiss = false;
        if (enemy.firstShotMustMiss) {
            shouldMiss = true;
            enemy.firstShotMustMiss = false;
        } else {
            shouldMiss = this.nextEnemyRandom(enemy) < 0.5;
        }

        if (shouldMiss) {
            const missOffset = (this.nextEnemyRandom(enemy) * 2 - 1) * (CONFIG.ENEMY_SHOT_MISS_MAX_OFFSET_RAD || 0.34);
            shotAngle += missOffset;
        }

        const maxRange = Math.max(enemy.attackRange, 100);
        const startX = enemyTransform.x;
        const startY = enemyTransform.y;
        const endX = startX + Math.cos(shotAngle) * maxRange;
        const endY = startY + Math.sin(shotAngle) * maxRange;

        const obstacleHit = visibilityUtils && typeof visibilityUtils.findFirstObstacleHit === 'function'
            ? visibilityUtils.findFirstObstacleHit(gameState, startX, startY, endX, endY)
            : null;
        const playerHit = this.getRayCircleHit(startX, startY, endX, endY, playerTransform.x, playerTransform.y, playerCollision.radius);
        const obstacleT = obstacleHit ? obstacleHit.t1 : Infinity;

        let finalX = endX;
        let finalY = endY;
        if (obstacleHit) {
            finalX = obstacleHit.x;
            finalY = obstacleHit.y;
        }

        const hitsPlayer = !shouldMiss && playerHit && playerHit.t >= 0 && playerHit.t <= 1 && playerHit.t < obstacleT;
        if (hitsPlayer) {
            finalX = playerHit.x;
            finalY = playerHit.y;
            this.applyPlayerDamage(gameState, playerHealth, enemy.damage);
        }

        const tracerColor = CONFIG.ENEMY_LASER_SHOT_COLOR || '#ff2222';
        const tracerDuration = CONFIG.ENEMY_LASER_SIGHT_SHOT_DURATION_MS || 400;
        const tracer = createTracerLine(startX, startY, finalX, finalY, tracerColor, tracerDuration);
        const tracerLifetime = tracer.getComponent('lifetime');
        if (tracerLifetime) {
            tracerLifetime.createdAt = gameState.timeMs ?? Date.now();
        }
        gameState.addEntity(tracer);
    },

    applyPlayerDamage(gameState, playerHealth, damage) {
        playerHealth.current = Math.max(0, playerHealth.current - Math.max(0, damage || 0));
        if (playerHealth.current <= 0) {
            gameState.isGameOver = true;
            gameState.isLevelComplete = false;
            gameState.gameOverReason = 'player_dead';
        }
    },

    getRayCircleHit(startX, startY, endX, endY, cx, cy, radius) {
        const dx = endX - startX;
        const dy = endY - startY;
        const fx = startX - cx;
        const fy = startY - cy;
        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = (fx * fx + fy * fy) - radius * radius;
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return null;

        const root = Math.sqrt(discriminant);
        const t1 = (-b - root) / (2 * a);
        const t2 = (-b + root) / (2 * a);
        const t = (t1 >= 0 && t1 <= 1) ? t1 : (t2 >= 0 && t2 <= 1 ? t2 : null);
        if (t === null) return null;

        return {
            t,
            x: startX + t * dx,
            y: startY + t * dy
        };
    },

    nextEnemyRandom(enemy) {
        const a = 1664525;
        const c = 1013904223;
        const current = (enemy.shotRngState >>> 0) || 0;
        const next = (Math.imul(current, a) + c) >>> 0;
        enemy.shotRngState = next;
        return next / 4294967296;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnemyCombatSystem;
}
