// Movement and collision system

const MovementSystem = {
    update(gameState, dt) {
        // Update all entities with physics and input
        for (const entity of gameState.entities.values()) {
            const transform = entity.getComponent('transform');
            const physics = entity.getComponent('physics');
            const input = entity.getComponent('input');
            const collision = entity.getComponent('collision');
            const playerState = entity.getComponent('playerState');
            
            if (!transform || !physics) continue;
            
            // Apply input to velocity
            if (input) {
                const effectiveSpeed = playerState
                    ? physics.baseSpeed * (playerState.movementSpeedMultiplier || 1)
                    : physics.baseSpeed;
                physics.speed = effectiveSpeed;
                physics.vx = input.moveX * effectiveSpeed;
                physics.vy = input.moveY * effectiveSpeed;
            }
            
            // Update position
            transform.x += physics.vx * dt;
            transform.y += physics.vy * dt;
            
            // Collision detection and resolution with walls
            if (collision && collision.type === 'circle') {
                this.resolveWallCollisions(entity, gameState.walls);
            }
            
            // Keep player in bounds
            if (entity.type === 'player') {
                const radius = collision ? collision.radius : 0;
                transform.x = Geometry.clamp(transform.x, radius, CONFIG.CANVAS_WIDTH - radius);
                transform.y = Geometry.clamp(transform.y, radius, CONFIG.CANVAS_HEIGHT - radius);
            }
        }
    },
    
    resolveWallCollisions(entity, walls) {
        const transform = entity.getComponent('transform');
        const collision = entity.getComponent('collision');
        
        if (!transform || !collision) return;
        
        const radius = collision.radius;
        
        // Check collision with each wall segment
        for (const wall of walls) {
            const result = Collision.circleLineSegment(
                transform.x,
                transform.y,
                radius,
                wall.x1,
                wall.y1,
                wall.x2,
                wall.y2
            );
            
            if (result.hit) {
                // Push entity away from wall
                const dx = transform.x - result.closestX;
                const dy = transform.y - result.closestY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0) {
                    const pushX = (dx / dist) * (radius - dist);
                    const pushY = (dy / dist) * (radius - dist);
                    
                    transform.x += pushX;
                    transform.y += pushY;
                }
            }
        }
    }
};
