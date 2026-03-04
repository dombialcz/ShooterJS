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
        
        // Create projectile entity
        const projectile = createProjectile(gunTipX, gunTipY, input.aimAngle, player.id);
        gameState.addEntity(projectile);
        
        console.log('Projectile fired!');
    }
};
