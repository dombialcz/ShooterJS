// Door physics system - handles swinging door mechanics

const DoorSystem = {
    update(gameState, dt) {
        const player = gameState.player;
        if (!player) return;
        
        const playerTransform = player.getComponent('transform');
        const playerCollision = player.getComponent('collision');
        
        if (!playerTransform || !playerCollision) return;
        
        // Update all doors
        for (const entity of gameState.entities.values()) {
            if (entity.type !== 'door') continue;
            
            const door = entity.getComponent('door');
            if (!door) continue;
            
            // Check collision with player and apply push force
            this.handlePlayerDoorCollision(door, playerTransform, playerCollision, dt);
            
            // Apply spring force to return door to closed position
            const springForce = -door.currentAngle * door.springStrength;
            door.angularVelocity += springForce * dt;
            
            // Apply damping
            door.angularVelocity *= door.damping;
            
            // Update door angle
            door.currentAngle += door.angularVelocity * dt;
            
            // Clamp to max swing angles
            if (door.currentAngle > door.maxSwingAngle) {
                door.currentAngle = door.maxSwingAngle;
                door.angularVelocity *= -0.5; // Bounce back
            } else if (door.currentAngle < -door.maxSwingAngle) {
                door.currentAngle = -door.maxSwingAngle;
                door.angularVelocity *= -0.5; // Bounce back
            }
        }
    },
    
    handlePlayerDoorCollision(door, playerTransform, playerCollision, dt) {
        // Calculate door endpoints
        const doorAngle = door.hingeAngle + door.currentAngle;
        const dx = Math.cos(doorAngle) * door.width;
        const dy = Math.sin(doorAngle) * door.width;
        
        const doorEndX = door.hingeX + dx;
        const doorEndY = door.hingeY + dy;
        
        // Check if player collides with door line segment
        const collision = Collision.circleLineSegment(
            playerTransform.x,
            playerTransform.y,
            playerCollision.radius,
            door.hingeX,
            door.hingeY,
            doorEndX,
            doorEndY
        );
        
        if (collision.hit) {
            // Calculate which side of the door the player is on
            const toPlayerX = playerTransform.x - door.hingeX;
            const toPlayerY = playerTransform.y - door.hingeY;
            
            // Cross product to determine side
            const cross = dx * toPlayerY - dy * toPlayerX;
            
            // Apply torque based on collision point distance from hinge
            const collisionDist = Geometry.distance(door.hingeX, door.hingeY, collision.closestX, collision.closestY);
            const leverArm = collisionDist / door.width; // 0 to 1
            
            // Push force proportional to penetration and lever arm
            // Negative sign so door swings AWAY from player
            const penetration = playerCollision.radius - collision.distance;
            const torque = -Math.sign(cross) * penetration * leverArm * CONFIG.DOOR_PUSH_FORCE;
            
            door.angularVelocity += torque;
            
            // Push player away from door
            const pushX = playerTransform.x - collision.closestX;
            const pushY = playerTransform.y - collision.closestY;
            const pushDist = Math.sqrt(pushX * pushX + pushY * pushY);
            
            if (pushDist > 0) {
                const pushAmount = (playerCollision.radius - collision.distance) * 0.5;
                playerTransform.x += (pushX / pushDist) * pushAmount;
                playerTransform.y += (pushY / pushDist) * pushAmount;
            }
        }
    },
    
    /**
     * Get door line segment for collision/vision (used by other systems)
     */
    getDoorSegment(door) {
        const doorAngle = door.hingeAngle + door.currentAngle;
        const dx = Math.cos(doorAngle) * door.width;
        const dy = Math.sin(doorAngle) * door.width;
        
        return {
            x1: door.hingeX,
            y1: door.hingeY,
            x2: door.hingeX + dx,
            y2: door.hingeY + dy
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DoorSystem;
}
