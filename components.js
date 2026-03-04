// Component definitions (plain objects)

/**
 * Transform component - position and rotation in world space
 */
function Transform(x = 0, y = 0, rotation = 0) {
    return { x, y, rotation };
}

/**
 * Physics component - velocity and movement properties
 */
function Physics(speed = 0, friction = 0.8) {
    return {
        vx: 0,
        vy: 0,
        speed: speed,
        friction: friction
    };
}

/**
 * Collision component - for circle-based collision
 */
function CollisionCircle(radius) {
    return {
        type: 'circle',
        radius: radius
    };
}

/**
 * Collision component - for AABB collision
 */
function CollisionAABB(width, height, offsetX = 0, offsetY = 0) {
    return {
        type: 'aabb',
        width: width,
        height: height,
        offsetX: offsetX,
        offsetY: offsetY
    };
}

/**
 * Renderable component - visual representation
 */
function Renderable(type, color, size) {
    return {
        type: type, // 'circle', 'rect', 'line'
        color: color,
        size: size
    };
}

/**
 * Health component
 */
function Health(current, max = null) {
    return {
        current: current,
        max: max || current
    };
}

/**
 * Gun component - weapon properties
 */
function Gun(length, width, offsetX, offsetY) {
    return {
        length: length,
        width: width,
        offsetX: offsetX,
        offsetY: offsetY,
        canShoot: true,
        lastShotTime: 0,
        fireRate: 200 // milliseconds between shots
    };
}

/**
 * Vision component - field of view data
 */
function Vision(range, fov, isADS = false) {
    return {
        range: range,
        fov: fov,
        isADS: isADS,
        visiblePolygon: [] // Array of {x, y} points
    };
}

/**
 * Target component - marks entities as shootable targets
 */
function Target(points = 10) {
    return {
        points: points,
        isDestroyed: false
    };
}

/**
 * Wall segment component
 */
function WallSegment(x1, y1, x2, y2) {
    return {
        x1, y1, x2, y2
    };
}

/**
 * Input component - stores input state for an entity
 */
function Input() {
    return {
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        isShooting: false,
        isADS: false
    };
}
