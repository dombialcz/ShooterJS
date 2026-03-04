// Shooting system - handles hitscan shooting with tracer lines

const ShootingSystem = {
    update(gameState, dt) {
        const player = gameState.player;
        if (!player) return;
        
        const gun = player.getComponent('gun');
        const input = player.getComponent('input');
        
        if (!gun || !input) return;
        
        // Can only shoot when ADS is active
        if (!input.isADS) return;
        
        // Check if shooting and can shoot (fire rate)
        const now = gameState.timeMs ?? Date.now();
        if (input.isShooting && gun.canShoot && now - gun.lastShotTime >= gun.fireRate) {
            this.shoot(gameState, player);
            gun.lastShotTime = now;
        }
    },
    
    shoot(gameState, player) {
        const transform = player.getComponent('transform');
        const gun = player.getComponent('gun');
        const input = player.getComponent('input');
        
        // Calculate gun tip position (start of raycast)
        const gunTipDistance = gun.offsetX + gun.length;
        const startX = transform.x + Math.cos(transform.rotation) * gunTipDistance;
        const startY = transform.y + Math.sin(transform.rotation) * gunTipDistance;
        
        // Raycast in the shooting direction
        const maxRange = CONFIG.VISION_RANGE || 1000;
        const endX = startX + Math.cos(input.aimAngle) * maxRange;
        const endY = startY + Math.sin(input.aimAngle) * maxRange;
        
        let closestHit = null;
        let closestDist = Infinity;
        let hitType = null;
        let hitEntity = null;
        
        // Check walls
        for (const wall of gameState.walls) {
            const intersection = Collision.lineIntersection(
                startX, startY, endX, endY,
                wall.x1, wall.y1, wall.x2, wall.y2
            );
            
            if (intersection) {
                const dist = Geometry.distance(startX, startY, intersection.x, intersection.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestHit = {x: intersection.x, y: intersection.y};
                    hitType = 'wall';
                }
            }
        }
        
        // Check doors
        for (const doorEntity of gameState.doors) {
            const door = doorEntity.getComponent('door');
            if (!door) continue;
            
            const doorSegment = DoorSystem.getDoorSegment(door);
            const intersection = Collision.lineIntersection(
                startX, startY, endX, endY,
                doorSegment.x1, doorSegment.y1, doorSegment.x2, doorSegment.y2
            );
            
            if (intersection) {
                const dist = Geometry.distance(startX, startY, intersection.x, intersection.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestHit = {x: intersection.x, y: intersection.y};
                    hitType = 'door';
                }
            }
        }

        // Check blocks
        if (gameState.blocks) {
            for (const blockEntity of gameState.blocks) {
                const hit = this.getRayBlockHit(startX, startY, endX, endY, blockEntity);
                if (!hit) continue;

                const dist = Geometry.distance(startX, startY, hit.x, hit.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestHit = { x: hit.x, y: hit.y };
                    hitType = 'block';
                    hitEntity = blockEntity;
                }
            }
        }
        
        // Check targets
        for (const target of gameState.targets) {
            const targetComp = target.getComponent('target');
            if (!targetComp || targetComp.isDestroyed) continue;
            
            const targetTransform = target.getComponent('transform');
            const targetCollision = target.getComponent('collision');
            
            if (!targetTransform || !targetCollision) continue;
            
            // Check if ray intersects target circle
            // Use line-circle intersection
            const dx = endX - startX;
            const dy = endY - startY;
            const fx = startX - targetTransform.x;
            const fy = startY - targetTransform.y;
            
            const a = dx * dx + dy * dy;
            const b = 2 * (fx * dx + fy * dy);
            const c = (fx * fx + fy * fy) - targetCollision.radius * targetCollision.radius;
            
            const discriminant = b * b - 4 * a * c;
            
            if (discriminant >= 0) {
                const t = (-b - Math.sqrt(discriminant)) / (2 * a);
                if (t >= 0 && t <= 1) {
                    const hitX = startX + t * dx;
                    const hitY = startY + t * dy;
                    const dist = Geometry.distance(startX, startY, hitX, hitY);
                    
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestHit = {x: hitX, y: hitY};
                        hitType = 'target';
                        hitEntity = target;
                    }
                }
            }
        }
        
        // Use closest hit or max range
        const finalX = closestHit ? closestHit.x : endX;
        const finalY = closestHit ? closestHit.y : endY;
        
        // Create tracer line for visual feedback
        const tracer = createTracerLine(startX, startY, finalX, finalY, hitType === 'target' ? '#ff0000' : '#ffff00');
        const tracerLifetime = tracer.getComponent('lifetime');
        if (tracerLifetime) {
            tracerLifetime.createdAt = gameState.timeMs ?? Date.now();
        }
        gameState.addEntity(tracer);
        
        // Handle hit
        if (hitType === 'target' && hitEntity) {
            const targetComp = hitEntity.getComponent('target');
            const targetTransform = hitEntity.getComponent('transform');
            
            gameState.addScore(targetComp.points);
            const marker = createHitMarker(targetTransform.x, targetTransform.y);
            const markerLifetime = marker.getComponent('lifetime');
            if (markerLifetime) {
                markerLifetime.createdAt = gameState.timeMs ?? Date.now();
            }
            gameState.addEntity(marker);
            gameState.removeEntity(hitEntity.id);
            
            console.log(`Target hit! Score: ${gameState.score}`);
        }
    },

    getRayBlockHit(startX, startY, endX, endY, blockEntity) {
        const transform = blockEntity.getComponent('transform');
        const collision = blockEntity.getComponent('collision');
        if (!transform || !collision || collision.type !== 'aabb') {
            return null;
        }

        const rx = transform.x + collision.offsetX;
        const ry = transform.y + collision.offsetY;
        const rw = collision.width;
        const rh = collision.height;

        const edges = [
            [rx, ry, rx + rw, ry],
            [rx + rw, ry, rx + rw, ry + rh],
            [rx + rw, ry + rh, rx, ry + rh],
            [rx, ry + rh, rx, ry]
        ];

        let closest = null;
        let closestDist = Infinity;

        for (const edge of edges) {
            const intersection = Collision.lineIntersection(
                startX, startY, endX, endY,
                edge[0], edge[1], edge[2], edge[3]
            );
            if (!intersection) continue;

            const dist = Geometry.distance(startX, startY, intersection.x, intersection.y);
            if (dist < closestDist) {
                closestDist = dist;
                closest = { x: intersection.x, y: intersection.y };
            }
        }

        return closest;
    }
};
