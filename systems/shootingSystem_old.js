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
        
        // Calculate gun tip position (end of barrel)
        const gunTipDistance = gun.offsetX + gun.length;
        const gunTipX = transform.x + Math.cos(transform.rotation) * gunTipDistance;
        const gunTipY = transform.y + Math.sin(transform.rotation) * gunTipDistance;
        
        // Check if gun barrel passes through any walls
        // If so, spawn bullet at the wall instead of at gun tip
        let spawnX = gunTipX;
        let spawnY = gunTipY;
        let closestDist = Infinity;
        let wallBlocking = false;
        
        for (const wall of gameState.walls) {
            const intersection = Collision.lineIntersection(
                transform.x, transform.y, gunTipX, gunTipY,
                wall.x1, wall.y1, wall.x2, wall.y2
            );
            
            if (intersection) {
                wallBlocking = true;
                const dist = Geometry.distance(transform.x, transform.y, intersection.x, intersection.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    // Spawn bullet slightly before the wall to prevent spawning inside it
                    const offset = 2;
                    const dx = intersection.x - transform.x;
                    const dy = intersection.y - transform.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    spawnX = intersection.x - (dx / len) * offset;
                    spawnY = intersection.y - (dy / len) * offset;
                }
            }
        }
        
        if (wallBlocking) {
            console.log('Gun blocked by wall! Spawning at wall instead of gun tip', {
                player: {x: transform.x.toFixed(1), y: transform.y.toFixed(1)},
                gunTip: {x: gunTipX.toFixed(1), y: gunTipY.toFixed(1)},
                spawn: {x: spawnX.toFixed(1), y: spawnY.toFixed(1)}
            });
        }
        
        // Create projectile entity
        const projectile = createProjectile(spawnX, spawnY, input.aimAngle, player.id);
        gameState.addEntity(projectile);
    }
};
