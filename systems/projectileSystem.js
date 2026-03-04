// Projectile system - handles bullet physics and collision

const ProjectileSystem = {
    update(gameState, dt) {
        const projectilesToRemove = [];
        
        for (const entity of gameState.entities.values()) {
            if (entity.type !== 'projectile') continue;
            
            const transform = entity.getComponent('transform');
            const physics = entity.getComponent('physics');
            const collision = entity.getComponent('collision');
            const projectile = entity.getComponent('projectile');
            
            if (!transform || !physics || !projectile) continue;
            
            // Store previous position for trail/collision check
            const prevX = transform.x;
            const prevY = transform.y;
            
            // Update position
            transform.x += physics.vx * dt;
            transform.y += physics.vy * dt;
            
            // Track distance traveled
            const distThisFrame = Geometry.distance(prevX, prevY, transform.x, transform.y);
            projectile.distanceTraveled += distThisFrame;
            
            // Remove if traveled too far
            if (projectile.distanceTraveled >= projectile.maxDistance) {
                projectilesToRemove.push(entity.id);
                continue;
            }
            
            // Remove if out of bounds
            if (!Geometry.inBounds(transform.x, transform.y, 0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT)) {
                projectilesToRemove.push(entity.id);
                continue;
            }
            
            // Check collision with walls
            if (this.checkWallCollision(transform, collision, gameState)) {
                projectilesToRemove.push(entity.id);
                continue;
            }
            
            // Check collision with doors
            if (this.checkDoorCollision(transform, collision, gameState)) {
                projectilesToRemove.push(entity.id);
                continue;
            }
            
            // Check collision with targets
            const hitTarget = this.checkTargetCollision(transform, collision, projectile, gameState);
            if (hitTarget) {
                // Remove target and projectile
                const targetTransform = hitTarget.getComponent('transform');
                const targetComp = hitTarget.getComponent('target');
                
                gameState.addScore(targetComp.points);
                gameState.addEntity(createHitMarker(targetTransform.x, targetTransform.y));
                gameState.removeEntity(hitTarget.id);
                projectilesToRemove.push(entity.id);
                
                console.log(`Target hit by projectile! Score: ${gameState.score}`);
            }
        }
        
        // Remove marked projectiles
        for (const id of projectilesToRemove) {
            gameState.removeEntity(id);
        }
    },
    
    checkWallCollision(transform, collision, gameState) {
        if (!gameState.walls || gameState.walls.length === 0) {
            return false;
        }
        
        for (const wall of gameState.walls) {
            if (!wall || wall.x1 === undefined) continue;
            
            const hit = Collision.circleLineSegment(
                transform.x,
                transform.y,
                collision.radius,
                wall.x1,
                wall.y1,
                wall.x2,
                wall.y2
            );
            
            if (hit && hit.hit) {
                return true;
            }
        }
        return false;
    },
    
    checkDoorCollision(transform, collision, gameState) {
        for (const doorEntity of gameState.doors) {
            const door = doorEntity.getComponent('door');
            if (!door) continue;
            
            const doorSegment = DoorSystem.getDoorSegment(door);
            const hit = Collision.circleLineSegment(
                transform.x,
                transform.y,
                collision.radius,
                doorSegment.x1,
                doorSegment.y1,
                doorSegment.x2,
                doorSegment.y2
            );
            
            if (hit.hit) {
                return true;
            }
        }
        return false;
    },
    
    checkTargetCollision(transform, collision, projectile, gameState) {
        for (const target of gameState.targets) {
            // Skip if target is already destroyed
            const targetComp = target.getComponent('target');
            if (!targetComp || targetComp.isDestroyed) continue;
            
            const targetTransform = target.getComponent('transform');
            const targetCollision = target.getComponent('collision');
            
            if (!targetTransform || !targetCollision) continue;
            
            // Check circle-circle collision
            const hit = Collision.circleCircle(
                transform.x,
                transform.y,
                collision.radius,
                targetTransform.x,
                targetTransform.y,
                targetCollision.radius
            );
            
            if (hit) {
                return target;
            }
        }
        return null;
    }
};
