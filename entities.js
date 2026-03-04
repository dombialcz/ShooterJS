// Entity factory functions

class Entity {
    constructor(id, type) {
        this.id = id;
        this.type = type;
        this.components = new Map();
    }
    
    addComponent(name, component) {
        this.components.set(name, component);
        return this;
    }
    
    getComponent(name) {
        return this.components.get(name);
    }
    
    hasComponent(name) {
        return this.components.has(name);
    }
    
    removeComponent(name) {
        this.components.delete(name);
        return this;
    }
}

// Entity ID generator
let nextEntityId = 1;

/**
 * Create a player entity
 */
function createPlayer(x, y) {
    const player = new Entity(nextEntityId++, 'player');
    
    player.addComponent('transform', Transform(x, y, 0));
    player.addComponent('physics', Physics(CONFIG.PLAYER_SPEED));
    player.addComponent('collision', CollisionCircle(CONFIG.PLAYER_RADIUS));
    player.addComponent('renderable', Renderable('circle', CONFIG.PLAYER_COLOR, CONFIG.PLAYER_RADIUS));
    player.addComponent('gun', Gun(
        CONFIG.GUN_LENGTH,
        CONFIG.GUN_WIDTH,
        CONFIG.GUN_OFFSET_X,
        0
    ));
    player.addComponent('vision', Vision(
        CONFIG.VISION_RANGE,
        CONFIG.FOV_NORMAL,
        false
    ));
    player.addComponent('input', Input());
    player.addComponent('health', Health(100));
    
    return player;
}

/**
 * Create a target entity
 */
function createTarget(x, y) {
    const target = new Entity(nextEntityId++, 'target');
    
    target.addComponent('transform', Transform(x, y, 0));
    target.addComponent('collision', CollisionCircle(CONFIG.TARGET_RADIUS));
    target.addComponent('renderable', Renderable('circle', CONFIG.TARGET_COLOR, CONFIG.TARGET_RADIUS));
    target.addComponent('target', Target(10));
    
    return target;
}

/**
 * Create a wall segment entity
 */
function createWall(x1, y1, x2, y2) {
    const wall = new Entity(nextEntityId++, 'wall');
    
    wall.addComponent('wall', WallSegment(x1, y1, x2, y2));
    wall.addComponent('renderable', Renderable('line', CONFIG.WALL_COLOR, CONFIG.WALL_THICKNESS));
    
    return wall;
}

/**
 * Create a swinging door entity
 */
function createDoor(hingeX, hingeY, width, hingeAngle) {
    const door = new Entity(nextEntityId++, 'door');
    
    door.addComponent('door', Door(hingeX, hingeY, width, hingeAngle));
    door.addComponent('renderable', Renderable('door', CONFIG.DOOR_COLOR || '#8B4513', CONFIG.WALL_THICKNESS));
    
    return door;
}

/**
 * Create a projectile/bullet entity
 */
function createProjectile(x, y, angle, ownerId) {
    const projectile = new Entity(nextEntityId++, 'projectile');
    
    const vx = Math.cos(angle) * CONFIG.PROJECTILE_SPEED;
    const vy = Math.sin(angle) * CONFIG.PROJECTILE_SPEED;
    
    projectile.addComponent('transform', Transform(x, y, angle));
    projectile.addComponent('physics', Physics(CONFIG.PROJECTILE_SPEED));
    projectile.getComponent('physics').vx = vx;
    projectile.getComponent('physics').vy = vy;
    projectile.addComponent('collision', CollisionCircle(CONFIG.PROJECTILE_RADIUS));
    projectile.addComponent('renderable', Renderable('circle', CONFIG.PROJECTILE_COLOR, CONFIG.PROJECTILE_RADIUS));
    projectile.addComponent('projectile', Projectile(ownerId));
    
    return projectile;
}

/**
 * Create a hit marker effect (temporary visual feedback)
 */
function createHitMarker(x, y) {
    const marker = new Entity(nextEntityId++, 'hitmarker');
    
    marker.addComponent('transform', Transform(x, y, 0));
    marker.addComponent('renderable', Renderable('circle', CONFIG.HIT_MARKER_COLOR, CONFIG.HIT_MARKER_RADIUS));
    
    // Add lifetime component
    marker.addComponent('lifetime', {
        createdAt: Date.now(),
        duration: CONFIG.HIT_MARKER_DURATION
    });
    
    return marker;
}

/**
 * Create a tracer line (visual feedback for hitscan shot)
 */
function createTracerLine(x1, y1, x2, y2, color = '#ffff00') {
    const tracer = new Entity(nextEntityId++, 'tracer');
    
    tracer.addComponent('tracer', {
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        color: color
    });
    
    // Add lifetime component - short duration for quick flash
    tracer.addComponent('lifetime', {
        createdAt: Date.now(),
        duration: 100 // 0.1 seconds
    });
    
    return tracer;
}

/**
 * Create a pushable block entity
 */
function createBlock(x, y, width, height) {
    const block = new Entity(nextEntityId++, 'block');

    block.addComponent('transform', Transform(x, y, 0));
    block.addComponent('collision', CollisionAABB(width, height, -width / 2, -height / 2));
    block.addComponent('renderable', Renderable('rect', CONFIG.BLOCK_COLOR || '#7fb069', { width, height }));
    block.addComponent('block', Block(width, height));
    block.addComponent('pushable', Pushable(true, true));

    return block;
}
