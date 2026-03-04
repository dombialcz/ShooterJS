// Ray casting for field of vision
const Raycaster = {
    /**
     * Cast a vision cone from origin point
     * Returns an array of points forming the visible polygon
     */
    castVisionCone(originX, originY, angle, fov, walls, maxRange) {
        const points = [];
        const rays = [];
        
        // Generate angles to cast rays
        const angles = this.generateRayAngles(originX, originY, angle, fov, walls, maxRange);
        
        // Cast a ray for each angle
        for (const rayAngle of angles) {
            const result = this.castRay(originX, originY, rayAngle, walls, maxRange);
            
            // Normalize angle relative to center angle to handle 360° wrapping
            let normalizedAngle = rayAngle - angle;
            while (normalizedAngle < -Math.PI) normalizedAngle += 2 * Math.PI;
            while (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
            
            rays.push({
                angle: rayAngle,
                normalizedAngle: normalizedAngle,  // For sorting
                x: result.x,
                y: result.y,
                distance: result.distance
            });
        }
        
        // Sort rays by normalized angle (relative to center) to handle 360° wrapping
        rays.sort((a, b) => a.normalizedAngle - b.normalizedAngle);
        
        // Convert rays to polygon points
        for (const ray of rays) {
            points.push({ x: ray.x, y: ray.y });
        }
        
        return points;
    },
    
    /**
     * Generate angles for ray casting
     * Includes regular intervals plus angles to wall endpoints
     */
    generateRayAngles(originX, originY, centerAngle, fov, walls, maxRange) {
        const angles = new Set();
        
        // Add regular intervals
        const rayCount = CONFIG.RAY_COUNT;
        const startAngle = centerAngle - fov / 2;
        const endAngle = centerAngle + fov / 2;
        
        for (let i = 0; i < rayCount; i++) {
            const t = i / (rayCount - 1);
            const angle = startAngle + (endAngle - startAngle) * t;
            angles.add(angle);
        }
        
        // Add angles to wall endpoints (for better accuracy)
        for (const wall of walls) {
            // Check both endpoints of the wall
            const endpoints = [
                { x: wall.x1, y: wall.y1 },
                { x: wall.x2, y: wall.y2 }
            ];
            
            for (const endpoint of endpoints) {
                const dist = Geometry.distance(originX, originY, endpoint.x, endpoint.y);
                if (dist <= maxRange) {
                    const angleToPoint = Geometry.angleBetween(originX, originY, endpoint.x, endpoint.y);
                    
                    // Check if angle is within FOV
                    let angleDiff = angleToPoint - centerAngle;
                    // Normalize angle difference to [-PI, PI]
                    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                    
                    if (Math.abs(angleDiff) <= fov / 2) {
                        // Add the angle and slight offsets for edge cases
                        angles.add(angleToPoint - 0.0001);
                        angles.add(angleToPoint);
                        angles.add(angleToPoint + 0.0001);
                    }
                }
            }
        }
        
        return Array.from(angles).sort((a, b) => a - b);
    },
    
    /**
     * Cast a single ray in a direction
     * Returns the hit point {x, y, distance}
     */
    castRay(originX, originY, angle, walls, maxRange) {
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        
        let closestHit = null;
        let closestDist = maxRange;
        
        // Check intersection with all walls
        for (const wall of walls) {
            const hit = Collision.raySegmentIntersect(
                originX, originY,
                dirX, dirY,
                wall.x1, wall.y1,
                wall.x2, wall.y2,
                maxRange
            );
            
            if (hit && hit.distance < closestDist) {
                closestDist = hit.distance;
                closestHit = hit;
            }
        }
        
        // If no hit, return max range point
        if (!closestHit) {
            return {
                x: originX + dirX * maxRange,
                y: originY + dirY * maxRange,
                distance: maxRange,
                hit: false
            };
        }
        
        return {
            x: closestHit.x,
            y: closestHit.y,
            distance: closestDist,
            hit: true
        };
    },
    
    /**
     * Cast a single ray for shooting (simpler, just finds first hit)
     */
    castShootingRay(originX, originY, angle, walls, maxRange) {
        return this.castRay(originX, originY, angle, walls, maxRange);
    },
    
    /**
     * Check if a point is visible from origin given walls
     */
    isPointVisible(originX, originY, targetX, targetY, walls) {
        const angle = Geometry.angleBetween(originX, originY, targetX, targetY);
        const maxDist = Geometry.distance(originX, originY, targetX, targetY);
        
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        
        // Check if any wall blocks the line of sight
        for (const wall of walls) {
            const hit = Collision.raySegmentIntersect(
                originX, originY,
                dirX, dirY,
                wall.x1, wall.y1,
                wall.x2, wall.y2,
                maxDist - 0.1 // Slight buffer
            );
            
            if (hit) {
                return false;
            }
        }
        
        return true;
    }
};
