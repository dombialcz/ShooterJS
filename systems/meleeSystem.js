// Melee system - handles close-range melee attacks

const MeleeSystem = {
    update(gameState, dt) {
        const player = gameState.player;
        if (!player) return;

        const playerState = player.getComponent('playerState');
        if (!playerState || playerState.activeWeapon !== 'melee') return;

        const melee = player.getComponent('melee');
        const input = player.getComponent('input');
        const transform = player.getComponent('transform');
        if (!melee || !input || !transform) return;

        const now = gameState.timeMs ?? Date.now();

        // Advance swing animation (clear it when finished)
        if (melee.swingStartMs !== null) {
            if (now - melee.swingStartMs >= melee.swingDurationMs) {
                melee.swingStartMs = null;
            }
        }

        // Only attack on click release, and only when cooldown has elapsed
        if (!input.isShooting) return;
        if (now - melee.lastAttackTime < melee.attackCooldownMs) return;

        melee.lastAttackTime = now;
        melee.swingStartMs = now;

        // Check all enemies within melee range and deal damage
        for (const enemyEntity of gameState.enemies || []) {
            const enemyTransform = enemyEntity.getComponent('transform');
            const enemyHealth = enemyEntity.getComponent('health');
            const enemyComp = enemyEntity.getComponent('enemy');
            if (!enemyTransform || !enemyHealth || !enemyComp || enemyHealth.current <= 0) continue;

            const dist = Math.hypot(
                enemyTransform.x - transform.x,
                enemyTransform.y - transform.y
            );
            if (dist > melee.range) continue;

            enemyHealth.current = Math.max(0, enemyHealth.current - melee.damage);

            const marker = createHitMarker(enemyTransform.x, enemyTransform.y);
            const markerLifetime = marker.getComponent('lifetime');
            if (markerLifetime) {
                markerLifetime.createdAt = gameState.timeMs ?? Date.now();
            }
            gameState.addEntity(marker);

            if (enemyHealth.current <= 0) {
                gameState.addScore(enemyComp.scoreValue || 25);
                gameState.enemiesDestroyed = (gameState.enemiesDestroyed || 0) + 1;
                gameState.removeEntity(enemyEntity.id);
            }
        }

        // Check targets within melee range
        for (const target of gameState.targets) {
            const targetComp = target.getComponent('target');
            if (!targetComp || targetComp.isDestroyed) continue;

            const targetTransform = target.getComponent('transform');
            const targetCollision = target.getComponent('collision');
            if (!targetTransform || !targetCollision) continue;

            const dist = Math.hypot(
                targetTransform.x - transform.x,
                targetTransform.y - transform.y
            );
            if (dist > melee.range + (targetCollision.radius || 0)) continue;

            gameState.addScore(targetComp.points);
            gameState.targetsDestroyed = (gameState.targetsDestroyed || 0) + 1;
            const marker = createHitMarker(targetTransform.x, targetTransform.y);
            const markerLifetime = marker.getComponent('lifetime');
            if (markerLifetime) {
                markerLifetime.createdAt = gameState.timeMs ?? Date.now();
            }
            gameState.addEntity(marker);
            gameState.removeEntity(target.id);
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeleeSystem;
}
