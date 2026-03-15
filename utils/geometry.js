// Geometry utility functions
const Geometry = {
    /**
     * Calculate distance between two points
     */
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },
    
    /**
     * Calculate squared distance (faster, useful for comparisons)
     */
    distanceSquared(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    },
    
    /**
     * Normalize a vector
     */
    normalize(x, y) {
        const len = Math.sqrt(x * x + y * y);
        if (len === 0) return { x: 0, y: 0 };
        return { x: x / len, y: y / len };
    },
    
    /**
     * Calculate angle between two points (in radians)
     */
    angleBetween(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },
    
    /**
     * Rotate a point around origin
     */
    rotatePoint(x, y, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            x: x * cos - y * sin,
            y: x * sin + y * cos
        };
    },
    
    /**
     * Rotate a point around a center point
     */
    rotatePointAround(px, py, cx, cy, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = px - cx;
        const dy = py - cy;
        return {
            x: cx + (dx * cos - dy * sin),
            y: cy + (dx * sin + dy * cos)
        };
    },
    
    /**
     * Linear interpolation
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },
    
    /**
     * Clamp a value between min and max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    
    /**
     * Check if a point is within bounds
     */
    inBounds(x, y, minX, minY, maxX, maxY) {
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    },
    
    /**
     * Get the magnitude (length) of a vector
     */
    magnitude(x, y) {
        return Math.sqrt(x * x + y * y);
    },
    
    /**
     * Normalize angle to range [0, 2*PI)
     */
    normalizeAngle(angle) {
        while (angle < 0) angle += Math.PI * 2;
        while (angle >= Math.PI * 2) angle -= Math.PI * 2;
        return angle;
    }
};

if (typeof window !== 'undefined') {
    window.Geometry = Geometry;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Geometry;
}
