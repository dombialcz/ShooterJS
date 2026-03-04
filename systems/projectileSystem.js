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
            
            if (!transform || !physics || !projectile || !collision) continue;
            
            // Store previous position for trail/collision check
            const prevX = transform.x;
            const prevY = transform.y;
            
            // Calculate new position
            const newX = transform.x + physics.vx * dt;
            const newY = transform.y + physics.vy * dt;
            
            // Track distance traveled
            const distThisFrame = Geometry.distance(prevX, prevY, newX, newY);
            projectile.distanceTraveled += distThisFrame;
            
            // Remove if traveled too far
            if (projectile.distanceTraveled >= projectile.maxDistance) {
                projectilesToRemove.push(entity.id);
                continue;
            }
            
            // Remove if out of bounds
            if (!Geometry.inBounds(newX, newY, 0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT)) {
                projectilesToRemove.push(entity.id);
                continue;
            }
            
            // Check collision with walls (continuous detection)
            if (this.checkWallCollision(prevX, prevY, newX, newY, collision, gameState)) {
                projectilesToRemove.push(entity.id);
                continue;
            }
            
            // Check collision with doors (continuous detection)
            if (this.checkDoorCollision(prevX, prevY, newX, newY, collision, gameState)) {
                projectilesToRemove.push(entity.id);
                continue;
            }
            
            // Update position only after collision checks pass
            transform.x = newX;
            transform.y = newY;
            
            // Check collision with targets (point-based is fine for targets)
            const hitTarget = this.checkTargetCollision(newX, newY, collision, projectile, gameState);
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
    
    checkWallCollision(prevX, prevY, newX, newY, collision, gameState) {
        if (!gameState.walls || gameState.walls.length === 0) {
            return false;
        }
        
        // Check if bullet path intersects any wall
        for (const wall of gameState.walls) {
            if (!wall || wall.x1 === undefined) continue;
            
            // Line-line intersection for the bullet's path
            const intersection = Collision.lineIntersection(
                prevX, prevY, newX, newY,
                wall.x1, wall.y1, wall.x2, wall.y2
            );
            
            if (intersection) {
                return true;
            }
            
            // Also check circle collision at new position (for thick walls)
            const hit = Collision.circleLineSegment(
                newX, newY,
                collision.radius,
                wall.x1, wall.y1, wall.x2, wall.y2
            );
            
            if (hit && hit.hit) {
                return true;
            }
        }
        return false;
    },
    
    checkDoorCollision(prevX, prevY, newX, newY, collision, gameState) {
        for (const doorEntity of gameState.doors) {
            const door = doorEntity.getComponent('door');
            if (!door) continue;
            
            const doorSegment = DoorSystem.getDoorSegment(door);
            
            // Line-line intersection for the bullet's path
            const intersection = Collision.lineIntersection(
                prevX, prevY, newX, newY,
                doorSegment.x1, doorSegment.y1, doorSegment.x2, doorSegment.y2
            );
            
            if (intersection) {
                return true;
            }
            
            // Also check circle collision at new position
            const hit = Collision.circleLineSegment(
                newX, newY,
                collision.radius,
                doorSegment.x1, doorSegment.y1, doorSegment.x2, doorSegment.y2
            );
            
            if (hit && hit.hit) {
                return true;
            }
        }
        return false;
    },
    
    checkTargetCollision(x, y, collision, projectile, gameState) {
        for (const target of gameState.targets) {
            // Skip if target is already destroyed
            const targetComp = target.getComponent('target');
            if (!targetComp || targetComp.isDestroyed) continue;
            
            const targetTransform = target.getComponent('transform');
            const targetCollision = target.getComponent('collision');
            
            if (!targetTransform || !targetCollision) continue;
            
            // Check circle-circle collision
            const hit = Collision.circleCircle(
                x,
                y,
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
