function getCollisionRef() {
    if (typeof window !== 'undefined' && window.Collision) return window.Collision;
    if (typeof Collision !== 'undefined') return Collision;
    if (typeof module !== 'undefined' && module.exports) {
        return require('../utils/collision.js');
    }
    return null;
}

function getDoorSystemRef() {
    if (typeof window !== 'undefined' && window.DoorSystem) return window.DoorSystem;
    if (typeof DoorSystem !== 'undefined') return DoorSystem;
    if (typeof module !== 'undefined' && module.exports) {
        return require('../systems/doorSystem.js');
    }
    return null;
}

const VisibilityUtils = {
    collectObstacleSegments(gameState, options = {}) {
        const doorSystem = getDoorSystemRef();
        const includeBlocks = options.includeBlocks !== false;
        const segments = [];

        for (const wall of gameState.walls || []) {
            segments.push({ x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2, kind: 'wall' });
        }

        for (const doorEntity of gameState.doors || []) {
            if (!doorSystem) continue;
            const door = doorEntity.getComponent('door');
            if (!door) continue;
            const segment = doorSystem.getDoorSegment(door);
            segments.push({
                x1: segment.x1,
                y1: segment.y1,
                x2: segment.x2,
                y2: segment.y2,
                kind: 'door'
            });
        }

        if (includeBlocks) {
            for (const blockEntity of gameState.blocks || []) {
                const transform = blockEntity.getComponent('transform');
                const collision = blockEntity.getComponent('collision');
                if (!transform || !collision || collision.type !== 'aabb') continue;
                const x = transform.x + collision.offsetX;
                const y = transform.y + collision.offsetY;
                const w = collision.width;
                const h = collision.height;

                segments.push({ x1: x, y1: y, x2: x + w, y2: y, kind: 'block' });
                segments.push({ x1: x + w, y1: y, x2: x + w, y2: y + h, kind: 'block' });
                segments.push({ x1: x + w, y1: y + h, x2: x, y2: y + h, kind: 'block' });
                segments.push({ x1: x, y1: y + h, x2: x, y2: y, kind: 'block' });
            }
        }

        return segments;
    },

    hasLineOfSight(gameState, x1, y1, x2, y2, options = {}) {
        const collision = getCollisionRef();
        if (!collision) return false;
        const epsilon = options.epsilon || 0.001;
        const segments = this.collectObstacleSegments(gameState, options);
        for (const segment of segments) {
            const hit = collision.lineIntersection(
                x1,
                y1,
                x2,
                y2,
                segment.x1,
                segment.y1,
                segment.x2,
                segment.y2
            );
            if (!hit) continue;
            if (hit.t1 > epsilon && hit.t1 < 1 - epsilon) {
                return false;
            }
        }
        return true;
    },

    findFirstObstacleHit(gameState, startX, startY, endX, endY, options = {}) {
        const collision = getCollisionRef();
        if (!collision) return null;
        const epsilon = options.epsilon || 0.001;
        const segments = this.collectObstacleSegments(gameState, options);
        let bestHit = null;

        for (const segment of segments) {
            const hit = collision.lineIntersection(
                startX,
                startY,
                endX,
                endY,
                segment.x1,
                segment.y1,
                segment.x2,
                segment.y2
            );
            if (!hit) continue;
            if (hit.t1 < epsilon || hit.t1 > 1 + epsilon) continue;

            if (!bestHit || hit.t1 < bestHit.t1) {
                bestHit = {
                    x: hit.x,
                    y: hit.y,
                    t1: hit.t1,
                    kind: segment.kind
                };
            }
        }

        return bestHit;
    }
};

if (typeof window !== 'undefined') {
    window.VisibilityUtils = VisibilityUtils;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VisibilityUtils;
}
