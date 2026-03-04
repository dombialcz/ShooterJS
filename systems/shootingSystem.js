// Shooting system - handles weapon firing

const ShootingSystem = {
    update(gameState, dt) {
        const player = gameState.player;
        if (!player) return;
        
        const transform = player.getComponent('transform');
        const gun = player.getComponent('gun');
        const input = player.getComponent('input');
        const vision = player.getComponent('vision');
        
        if (!transform || !gun || !input) return;
        
        // Can only shoot when ADS is active
        if (!input.isADS) return;
        
        // Check if shooting and can shoot (fire rate)
        const now = Date.now();
        if (input.isShooting && gun.canShoot && now - gun.lastShotTime >= gun.fireRate) {
            this.shoot(gameState, player);
            gun.lastShotTime = now;
        }
    },
    
    shoot(gameState, player) {
        const transform = player.getComponent('transform');
        const gun = player.getComponent('gun');
        const input = player.getComponent('input');
        const vision = player.getComponent('vision');
        
        // Calculate gun tip position
        const gunTipX = transform.x + Math.cos(transform.rotation) * gun.offsetX;
        const gunTipY = transform.y + Math.sin(transform.rotation) * gun.offsetX;
        
        // Cast a ray
        const rayResult = Raycaster.castShootingRay(
            gunTipX,
            gunTipY,
            input.aimAngle,
            gameState.walls,
            vision.range
        );
        
        // Check if ray hits any target
        let hitTarget = null;
        let closestDist = Infinity;
        
        for (const target of gameState.targets) {
            const targetTransform = target.getComponent('transform');
            const targetCollision = target.getComponent('collision');
            const targetComp = target.getComponent('target');
            
            if (!targetTransform || !targetCollision || !targetComp) continue;
            if (targetComp.isDestroyed) continue;
            
            // Check if target is along the ray path
            const distToTarget = Geometry.distance(gunTipX, gunTipY, targetTransform.x, targetTransform.y);
            
            // Must be within ray range and closer than wall hit
            if (distToTarget <= rayResult.distance && distToTarget < closestDist) {
                // Check if ray actually hits the target circle
                const angle = Geometry.angleBetween(gunTipX, gunTipY, targetTransform.x, targetTransform.y);
                const angleDiff = Math.abs(angle - input.aimAngle);
                
                // Simple check: is target close enough to ray line?
                const rayDx = Math.cos(input.aimAngle);
                const rayDy = Math.sin(input.aimAngle);
                
                // Vector from gun to target
                const toTargetX = targetTransform.x - gunTipX;
                const toTargetY = targetTransform.y - gunTipY;
                
                // Project onto ray direction
                const projectionLength = toTargetX * rayDx + toTargetY * rayDy;
                
                if (projectionLength > 0) {
                    // Closest point on ray to target
                    const closestX = gunTipX + rayDx * projectionLength;
                    const closestY = gunTipY + rayDy * projectionLength;
                    
                    // Distance from target to ray
                    const distToRay = Geometry.distance(closestX, closestY, targetTransform.x, targetTransform.y);
                    
                    if (distToRay <= targetCollision.radius) {
                        hitTarget = target;
                        closestDist = distToTarget;
                    }
                }
            }
        }
        
        // If we hit a target, destroy it
        if (hitTarget) {
            const targetTransform = hitTarget.getComponent('transform');
            const targetComp = hitTarget.getComponent('target');
            
            // Add score
            gameState.addScore(targetComp.points);
            
            // Create hit marker
            gameState.addEntity(createHitMarker(targetTransform.x, targetTransform.y));
            
            // Remove target
            gameState.removeEntity(hitTarget.id);
            
            console.log(`Target hit! Score: ${gameState.score}`);
        }
    }
};
