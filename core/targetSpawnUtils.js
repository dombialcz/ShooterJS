const TargetSpawnUtils = {
    isTargetSpawnValid(spawn, context) {
        if (!spawn) return false;

        const radius = context.radius;
        const x = spawn.x;
        const y = spawn.y;

        if (x - radius < 0 || y - radius < 0 || x + radius > context.canvasWidth || y + radius > context.canvasHeight) {
            return false;
        }

        for (const wall of context.walls || []) {
            if (circleLineSegmentHit(x, y, radius, wall.x1, wall.y1, wall.x2, wall.y2)) {
                return false;
            }
        }

        for (const door of context.doorSegments || []) {
            if (circleLineSegmentHit(x, y, radius, door.x1, door.y1, door.x2, door.y2)) {
                return false;
            }
        }

        for (const block of context.blocks || []) {
            if (circleAABBHit(x, y, radius, block.x, block.y, block.w, block.h)) {
                return false;
            }
        }

        if (context.playerCircle && circleCircleHit(x, y, radius, context.playerCircle.x, context.playerCircle.y, context.playerCircle.radius)) {
            return false;
        }

        for (const target of context.targetCircles || []) {
            if (circleCircleHit(x, y, radius, target.x, target.y, target.radius)) {
                return false;
            }
        }

        for (const reserved of context.reservedCircles || []) {
            if (circleCircleHit(x, y, radius, reserved.x, reserved.y, reserved.radius)) {
                return false;
            }
        }

        return true;
    },

    collectSpawnSelections(options) {
        const spawnPoints = options.spawnPoints || [];
        if (spawnPoints.length === 0 || options.desiredCount <= 0) {
            return {
                selections: [],
                nextCursor: 0
            };
        }

        const reservedCircles = [];
        const selections = [];
        let cursor = normalizeCursor(options.startCursor || 0, spawnPoints.length);
        let inspected = 0;

        while (selections.length < options.desiredCount && inspected < spawnPoints.length) {
            const index = cursor;
            const spawn = spawnPoints[index];
            cursor = (cursor + 1) % spawnPoints.length;
            inspected += 1;

            if (!this.isTargetSpawnValid(spawn, {
                radius: options.radius,
                canvasWidth: options.canvasWidth,
                canvasHeight: options.canvasHeight,
                walls: options.walls,
                doorSegments: options.doorSegments,
                blocks: options.blocks,
                playerCircle: options.playerCircle,
                targetCircles: options.targetCircles,
                reservedCircles
            })) {
                continue;
            }

            selections.push({
                index,
                x: spawn.x,
                y: spawn.y
            });
            reservedCircles.push({
                x: spawn.x,
                y: spawn.y,
                radius: options.radius
            });
        }

        return {
            selections,
            nextCursor: cursor
        };
    }
};

function normalizeCursor(cursor, length) {
    if (length <= 0) return 0;
    const normalized = cursor % length;
    return normalized < 0 ? normalized + length : normalized;
}

function circleCircleHit(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const radiusSum = r1 + r2;
    return dx * dx + dy * dy < radiusSum * radiusSum;
}

function circleAABBHit(cx, cy, radius, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < radius * radius;
}

function circleLineSegmentHit(cx, cy, radius, x1, y1, x2, y2) {
    const dx = cx - x1;
    const dy = cy - y1;
    const lx = x2 - x1;
    const ly = y2 - y1;
    const lineLengthSq = lx * lx + ly * ly;
    const t = lineLengthSq === 0 ? 0 : clamp((dx * lx + dy * ly) / lineLengthSq, 0, 1);
    const closestX = x1 + t * lx;
    const closestY = y1 + t * ly;
    const distX = cx - closestX;
    const distY = cy - closestY;
    return distX * distX + distY * distY <= radius * radius;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

if (typeof window !== 'undefined') {
    window.TargetSpawnUtils = TargetSpawnUtils;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TargetSpawnUtils;
}
