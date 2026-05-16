// Shooting system - handles hitscan shooting with tracer lines

const ShootingSystem = {
    update(gameState, dt) {
        const player = gameState.player;
        if (!player) return;
        
        const gun = player.getComponent('gun');
        const input = player.getComponent('input');
        const playerState = player.getComponent('playerState');
        
        if (!gun || !input) return;

        // Skip when melee weapon is active
        if (playerState && playerState.activeWeapon === 'melee') {
            // Reset ADS spread so it starts fresh when switching back
            gun.adsStartedAtMs = null;
            const startHalfRad = (CONFIG.FIRING_CONE_START_DEG * Math.PI / 180) * 0.5;
            gun.currentSpreadHalfAngleRad = startHalfRad;
            return;
        }

        this.updateFiringConeState(gameState, player);
        
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
        const shotAngle = this.getShotAngle(gameState, player);
        
        // Calculate gun tip position (start of raycast)
        const gunTipDistance = gun.offsetX + gun.length;
        const startX = transform.x + Math.cos(transform.rotation) * gunTipDistance;
        const startY = transform.y + Math.sin(transform.rotation) * gunTipDistance;
        
        // Raycast in the shooting direction
        const maxRange = CONFIG.VISION_RANGE || 1000;
        const endX = startX + Math.cos(shotAngle) * maxRange;
        const endY = startY + Math.sin(shotAngle) * maxRange;
        
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
        for (const enemyEntity of gameState.enemies || []) {
            const enemyComp = enemyEntity.getComponent('enemy');
            const enemyTransform = enemyEntity.getComponent('transform');
            const enemyCollision = enemyEntity.getComponent('collision');
            const enemyHealth = enemyEntity.getComponent('health');
            if (!enemyComp || !enemyTransform || !enemyCollision || !enemyHealth || enemyHealth.current <= 0) continue;

            const dx = endX - startX;
            const dy = endY - startY;
            const fx = startX - enemyTransform.x;
            const fy = startY - enemyTransform.y;

            const a = dx * dx + dy * dy;
            const b = 2 * (fx * dx + fy * dy);
            const c = (fx * fx + fy * fy) - enemyCollision.radius * enemyCollision.radius;

            const discriminant = b * b - 4 * a * c;
            if (discriminant < 0) continue;

            const t = (-b - Math.sqrt(discriminant)) / (2 * a);
            if (t < 0 || t > 1) continue;

            const hitX = startX + t * dx;
            const hitY = startY + t * dy;
            const dist = Geometry.distance(startX, startY, hitX, hitY);
            if (dist < closestDist) {
                closestDist = dist;
                closestHit = { x: hitX, y: hitY };
                hitType = 'enemy';
                hitEntity = enemyEntity;
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
        const tracer = createTracerLine(startX, startY, finalX, finalY, (hitType === 'target' || hitType === 'enemy') ? '#ff0000' : '#ffff00');
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
            gameState.targetsDestroyed = (gameState.targetsDestroyed || 0) + 1;
            const marker = createHitMarker(targetTransform.x, targetTransform.y);
            const markerLifetime = marker.getComponent('lifetime');
            if (markerLifetime) {
                markerLifetime.createdAt = gameState.timeMs ?? Date.now();
            }
            gameState.addEntity(marker);
            gameState.removeEntity(hitEntity.id);
            
            console.log(`Target hit! Score: ${gameState.score}`);
        }

        if (hitType === 'enemy' && hitEntity) {
            const enemyComp = hitEntity.getComponent('enemy');
            const enemyTransform = hitEntity.getComponent('transform');
            const enemyHealth = hitEntity.getComponent('health');
            if (enemyComp && enemyTransform && enemyHealth) {
                const shotDamage = 15;
                enemyHealth.current = Math.max(0, enemyHealth.current - shotDamage);
                const marker = createHitMarker(enemyTransform.x, enemyTransform.y);
                const markerLifetime = marker.getComponent('lifetime');
                if (markerLifetime) {
                    markerLifetime.createdAt = gameState.timeMs ?? Date.now();
                }
                gameState.addEntity(marker);

                if (enemyHealth.current <= 0) {
                    gameState.addScore(enemyComp.scoreValue || 25);
                    gameState.enemiesDestroyed = (gameState.enemiesDestroyed || 0) + 1;
                    gameState.removeEntity(hitEntity.id);
                }
            }
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
    },

    updateFiringConeState(gameState, player) {
        const input = player.getComponent('input');
        const gun = player.getComponent('gun');
        if (!input || !gun) return;

        const startHalfRad = (CONFIG.FIRING_CONE_START_DEG * Math.PI / 180) * 0.5;
        const minHalfRad = (CONFIG.FIRING_CONE_MIN_DEG * Math.PI / 180) * 0.5;
        const durationMs = Math.max(1, CONFIG.FIRING_CONE_TIGHTEN_MS || 2000);
        const now = gameState.timeMs ?? 0;

        if (!input.isADS) {
            gun.adsStartedAtMs = null;
            gun.currentSpreadHalfAngleRad = startHalfRad;
            return;
        }

        if (gun.adsStartedAtMs === null || gun.adsStartedAtMs === undefined) {
            gun.adsStartedAtMs = now;
        }

        const elapsed = Math.max(0, now - gun.adsStartedAtMs);
        const tightenProgress = Math.min(1, elapsed / durationMs);
        const spread = startHalfRad + (minHalfRad - startHalfRad) * tightenProgress;
        gun.currentSpreadHalfAngleRad = Math.max(minHalfRad, spread);
    },

    nextDeterministicRandom(gameState) {
        const a = 1664525;
        const c = 1013904223;
        const current = (gameState.shotRngState >>> 0) || 0;
        const next = (Math.imul(current, a) + c) >>> 0;
        gameState.shotRngState = next;
        return next / 4294967296;
    },

    getShotAngle(gameState, player) {
        const input = player.getComponent('input');
        const gun = player.getComponent('gun');
        if (!input || !gun) return 0;

        const spreadHalfAngle = Math.max(0, gun.currentSpreadHalfAngleRad || 0);
        if (spreadHalfAngle <= 0) {
            return input.aimAngle;
        }

        const random01 = this.nextDeterministicRandom(gameState);
        const offset = (random01 * 2 - 1) * spreadHalfAngle;
        return input.aimAngle + offset;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShootingSystem;
}
