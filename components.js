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
        baseSpeed: speed,
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
    const startSpreadHalfAngleRad = (CONFIG.FIRING_CONE_START_DEG * Math.PI / 180) * 0.5;
    return {
        length: length,
        width: width,
        offsetX: offsetX,
        offsetY: offsetY,
        canShoot: true,
        lastShotTime: 0,
        fireRate: 200, // milliseconds between shots
        adsStartedAtMs: null,
        currentSpreadHalfAngleRad: startSpreadHalfAngleRad
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

/**
 * Player state - player-owned toggles and movement modifiers
 */
function PlayerState() {
    return {
        isADSActive: false,
        movementSpeedMultiplier: 1
    };
}

/**
 * Door component - swinging door with hinge physics
 */
function Door(hingeX, hingeY, width, hingeAngle) {
    return {
        hingeX: hingeX,           // Hinge point (fixed)
        hingeY: hingeY,
        width: width,             // Door width
        hingeAngle: hingeAngle,   // Angle of the wall where hinge is attached
        currentAngle: 0,          // Current swing angle (0 = closed)
        angularVelocity: 0,       // Rotation speed
        maxSwingAngle: Math.PI * 0.45,  // Max 80 degrees swing
        springStrength: 3.0,      // How fast it returns to closed
        damping: 0.92,            // Angular velocity damping
        thickness: 8              // Door thickness for rendering
    };
}

/**
 * Projectile component - bullet physics
 */
function Projectile(ownerId, damage = 10) {
    return {
        ownerId: ownerId,         // Entity ID of shooter (to avoid self-hit)
        damage: damage,
        distanceTraveled: 0,
        maxDistance: CONFIG.PROJECTILE_MAX_DISTANCE
    };
}

/**
 * Block component - physics properties for movable block entities
 */
function Block(width, height, mass = 1.4, friction = 0.82, restitution = 0.0) {
    return {
        width: width,
        height: height,
        mass: mass,
        friction: friction,
        restitution: restitution,
        vx: 0,
        vy: 0
    };
}

/**
 * Pushable flags - future-ready for enemies and other actors
 */
function Pushable(canBePushedByPlayer = true, canBePushedByEnemies = true) {
    return {
        canBePushedByPlayer: canBePushedByPlayer,
        canBePushedByEnemies: canBePushedByEnemies
    };
}

/**
 * Enemy component - AI and combat runtime state
 */
function Enemy(type, options = {}) {
    const enemyType = type === 'ranged' ? 'ranged' : 'melee';
    const defaults = enemyType === 'ranged'
        ? {
            moveSpeed: CONFIG.ENEMY_RANGED_MOVE_SPEED,
            visionRange: CONFIG.ENEMY_RANGED_VISION_RANGE,
            attackRange: CONFIG.ENEMY_RANGED_ATTACK_RANGE,
            attackCooldownMs: CONFIG.ENEMY_RANGED_ATTACK_COOLDOWN_MS,
            damage: CONFIG.ENEMY_RANGED_DAMAGE,
            maxHealth: CONFIG.ENEMY_RANGED_MAX_HEALTH
        }
        : {
            moveSpeed: CONFIG.ENEMY_MELEE_MOVE_SPEED,
            visionRange: CONFIG.ENEMY_MELEE_VISION_RANGE,
            attackRange: CONFIG.ENEMY_MELEE_ATTACK_RANGE,
            attackCooldownMs: CONFIG.ENEMY_MELEE_ATTACK_COOLDOWN_MS,
            damage: CONFIG.ENEMY_MELEE_DAMAGE,
            maxHealth: CONFIG.ENEMY_MELEE_MAX_HEALTH
        };

    const patrol = Array.isArray(options.patrol)
        ? options.patrol
            .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
            .map((point) => ({ x: point.x, y: point.y }))
        : [];

    return {
        type: enemyType,
        state: 'idle',
        isAlerted: false,
        hasLineOfSight: false,
        lastSeenPlayerAtMs: null,
        moveSpeed: Number.isFinite(options.moveSpeed) ? options.moveSpeed : defaults.moveSpeed,
        visionRange: Number.isFinite(options.visionRange) ? options.visionRange : defaults.visionRange,
        attackRange: Number.isFinite(options.attackRange) ? options.attackRange : defaults.attackRange,
        attackCooldownMs: Number.isFinite(options.attackCooldownMs) ? options.attackCooldownMs : defaults.attackCooldownMs,
        damage: Number.isFinite(options.damage) ? options.damage : defaults.damage,
        scoreValue: Number.isFinite(options.scoreValue) ? options.scoreValue : 25,
        pendingAttack: false,
        lastAttackAtMs: Number.NEGATIVE_INFINITY,
        laserSightStartMs: null,
        aimAngle: null,
        lastAimUpdateMs: null,
        firstShotMustMiss: enemyType === 'ranged',
        shotRngState: (options.shotRngState >>> 0) || 0,
        patrol: patrol,
        patrolIndex: 0,
        currentPath: [],
        pathIndex: 0,
        nextRepathAtMs: 0,
        lastRepathAtMs: 0,
        lastPositionX: null,
        lastPositionY: null,
        stuckSinceMs: null,
        preferredDistance: Number.isFinite(options.preferredDistance) ? options.preferredDistance : defaults.attackRange * 0.75,
        maxHealth: Number.isFinite(options.maxHealth) ? options.maxHealth : defaults.maxHealth,
        sourceId: typeof options.sourceId === 'string' ? options.sourceId : null
    };
}
