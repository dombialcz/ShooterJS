// Collision detection utilities
const Collision = {
    /**
     * Circle vs Circle collision
     */
    circleCircle(x1, y1, r1, x2, y2, r2) {
        const distSq = Geometry.distanceSquared(x1, y1, x2, y2);
        const radiusSum = r1 + r2;
        return distSq < radiusSum * radiusSum;
    },
    
    /**
     * Circle vs AABB (Axis-Aligned Bounding Box)
     */
    circleAABB(cx, cy, radius, rx, ry, rw, rh) {
        // Find the closest point on the rectangle to the circle center
        const closestX = Geometry.clamp(cx, rx, rx + rw);
        const closestY = Geometry.clamp(cy, ry, ry + rh);
        
        // Calculate distance from circle center to closest point
        const distSq = Geometry.distanceSquared(cx, cy, closestX, closestY);
        
        return distSq < radius * radius;
    },
    
    /**
     * Point in rectangle check
     */
    pointInRect(px, py, rx, ry, rw, rh) {
        return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
    },
    
    /**
     * Point in circle check
     */
    pointInCircle(px, py, cx, cy, radius) {
        const distSq = Geometry.distanceSquared(px, py, cx, cy);
        return distSq <= radius * radius;
    },
    
    /**
     * Line segment intersection
     * Returns intersection point {x, y, t1, t2} or null if no intersection
     * t1 is the parameter along the first line, t2 along the second
     */
    lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        // Lines are parallel
        if (Math.abs(denom) < 0.0001) {
            return null;
        }
        
        const t1 = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const t2 = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        // Check if intersection is within both line segments
        // Use small epsilon for floating point tolerance
        const epsilon = 0.001;
        if (t1 >= -epsilon && t1 <= 1 + epsilon && t2 >= -epsilon && t2 <= 1 + epsilon) {
            return {
                x: x1 + t1 * (x2 - x1),
                y: y1 + t1 * (y2 - y1),
                t1: t1,
                t2: t2
            };
        }
        
        return null;
    },
    
    /**
     * Ray vs line segment intersection
     * Ray is defined by origin (x, y) and direction (dx, dy)
     * Returns {x, y, distance} or null if no intersection
     */
    raySegmentIntersect(rayX, rayY, rayDx, rayDy, segX1, segY1, segX2, segY2, maxDist = Infinity) {
        // Ray endpoint for intersection test
        const rayEndX = rayX + rayDx * maxDist;
        const rayEndY = rayY + rayDy * maxDist;
        
        const intersection = this.lineIntersection(
            rayX, rayY, rayEndX, rayEndY,
            segX1, segY1, segX2, segY2
        );
        
        if (intersection) {
            const dist = Geometry.distance(rayX, rayY, intersection.x, intersection.y);
            if (dist <= maxDist) {
                return {
                    x: intersection.x,
                    y: intersection.y,
                    distance: dist
                };
            }
        }
        
        return null;
    },
    
    /**
     * Circle vs line segment collision
     */
    circleLineSegment(cx, cy, radius, x1, y1, x2, y2) {
        // Vector from line start to circle center
        const dx = cx - x1;
        const dy = cy - y1;
        
        // Vector of the line segment
        const lx = x2 - x1;
        const ly = y2 - y1;
        
        // Project circle center onto line segment
        const lineLengthSq = lx * lx + ly * ly;
        let t = (dx * lx + dy * ly) / lineLengthSq;
        
        // Clamp to line segment
        t = Geometry.clamp(t, 0, 1);
        
        // Closest point on line segment
        const closestX = x1 + t * lx;
        const closestY = y1 + t * ly;
        
        // Check distance
        const distSq = Geometry.distanceSquared(cx, cy, closestX, closestY);
        
        if (distSq <= radius * radius) {
            return {
                hit: true,
                closestX: closestX,
                closestY: closestY,
                distance: Math.sqrt(distSq)
            };
        }
        
        return { hit: false };
    },
    
    /**
     * Push a circle out of an AABB
     * Returns the new position {x, y} for the circle
     */
    resolveCircleAABB(cx, cy, radius, rx, ry, rw, rh) {
        // Find closest point on rectangle
        const closestX = Geometry.clamp(cx, rx, rx + rw);
        const closestY = Geometry.clamp(cy, ry, ry + rh);
        
        // Vector from closest point to circle center
        let dx = cx - closestX;
        let dy = cy - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // If no collision, return original position
        if (dist >= radius) {
            return { x: cx, y: cy };
        }
        
        // If circle center is inside rectangle, push to nearest edge
        if (dist === 0) {
            const distLeft = cx - rx;
            const distRight = (rx + rw) - cx;
            const distTop = cy - ry;
            const distBottom = (ry + rh) - cy;
            
            const minDist = Math.min(distLeft, distRight, distTop, distBottom);
            
            if (minDist === distLeft) {
                return { x: rx - radius, y: cy };
            } else if (minDist === distRight) {
                return { x: rx + rw + radius, y: cy };
            } else if (minDist === distTop) {
                return { x: cx, y: ry - radius };
            } else {
                return { x: cx, y: ry + rh + radius };
            }
        }
        
        // Normalize and push out
        dx /= dist;
        dy /= dist;
        
        return {
            x: closestX + dx * radius,
            y: closestY + dy * radius
        };
    },

    /**
     * Line segment vs AABB intersection
     */
    segmentIntersectsAABB(x1, y1, x2, y2, rx, ry, rw, rh) {
        if (this.pointInRect(x1, y1, rx, ry, rw, rh) || this.pointInRect(x2, y2, rx, ry, rw, rh)) {
            return true;
        }

        const edges = [
            [rx, ry, rx + rw, ry],
            [rx + rw, ry, rx + rw, ry + rh],
            [rx + rw, ry + rh, rx, ry + rh],
            [rx, ry + rh, rx, ry]
        ];

        for (const edge of edges) {
            const hit = this.lineIntersection(x1, y1, x2, y2, edge[0], edge[1], edge[2], edge[3]);
            if (hit) {
                return true;
            }
        }

        return false;
    }
};

if (typeof window !== 'undefined') {
    window.Collision = Collision;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Collision;
}
