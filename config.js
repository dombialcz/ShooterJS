// Game Configuration
const CONFIG = {
    // Canvas
    CANVAS_WIDTH: 1280,
    CANVAS_HEIGHT: 720,
    
    // Player
    PLAYER_SPEED: 200, // pixels per second
    PLAYER_RADIUS: 10,
    PLAYER_COLOR: '#4a9eff',
    
    // Gun
    GUN_LENGTH: 20,
    GUN_WIDTH: 8,
    GUN_OFFSET_X: 15, // Distance from player center
    GUN_COLOR: '#1a1a1a',
    GUN_FIRE_RATE: 200, // milliseconds between shots

    // Melee weapon
    MELEE_DAMAGE: 35,
    MELEE_RANGE: 60,               // Maximum hit distance from player center (pixels)
    MELEE_COOLDOWN_MS: 600,
    MELEE_LENGTH: 28,              // Blade length for rendering
    MELEE_WIDTH: 6,
    MELEE_COLOR: '#b0b0b0',
    MELEE_SWING_DURATION_MS: 250,  // Length of the swing animation
    FIRING_CONE_START_DEG: 20,
    FIRING_CONE_MIN_DEG: 0,
    FIRING_CONE_TIGHTEN_MS: 2000,
    FIRING_CONE_VISUAL_RANGE: 260,
    FIRING_CONE_STROKE_COLOR: 'rgba(255, 220, 120, 0.95)',
    FIRING_CONE_FILL_COLOR: 'rgba(255, 220, 120, 0.18)',
    PLAYER_ADS_SPEED_MULTIPLIER: 0.55,
    
    // Projectiles
    PROJECTILE_SPEED: 800, // pixels per second
    PROJECTILE_RADIUS: 3,
    PROJECTILE_COLOR: '#ffff00',
    PROJECTILE_TRAIL_COLOR: 'rgba(255, 255, 100, 0.5)',
    PROJECTILE_MAX_DISTANCE: 1000,
    
    // Field of Vision
    FOV_NORMAL: 120 * Math.PI / 180, // 120 degrees in radians
    FOV_ADS: 45 * Math.PI / 180, // 45 degrees in radians
    VISION_RANGE: 600,
    RAY_COUNT: 60, // Number of rays to cast in the vision cone
    
    // Targets
    TARGET_RADIUS: 20,
    TARGET_COLOR: '#ff4444',
    TARGET_COUNT: 5,
    ROUND_DURATION_MS: 120000,
    DEFAULT_LEVEL_GOAL_KILLS: 5,
    TARGET_RESPAWN_DELAY_MIN_MS: 10000,
    TARGET_RESPAWN_DELAY_MAX_MS: 20000,

    // Enemies
    ENEMY_RADIUS: 14,
    ENEMY_MELEE_COLOR: '#8ddf65',
    ENEMY_RANGED_COLOR: '#ff8f5e',
    ENEMY_MELEE_MAX_HEALTH: 45,
    ENEMY_RANGED_MAX_HEALTH: 25,
    ENEMY_MELEE_MOVE_SPEED: 120,
    ENEMY_RANGED_MOVE_SPEED: 105,
    ENEMY_MELEE_VISION_RANGE: 420,
    ENEMY_RANGED_VISION_RANGE: 520,
    ENEMY_MELEE_ATTACK_RANGE: 28,
    ENEMY_RANGED_ATTACK_RANGE: 420,
    ENEMY_MELEE_ATTACK_COOLDOWN_MS: 800,
    ENEMY_RANGED_ATTACK_COOLDOWN_MS: 1300,
    ENEMY_MELEE_DAMAGE: 12,
    ENEMY_RANGED_DAMAGE: 10,
    ENEMY_SHOT_MISS_MAX_OFFSET_RAD: 0.34,
    ENEMY_RNG_SEED: 0x51f15e71,
    ENEMY_REPATH_INTERVAL_MS: 450,
    ENEMY_STUCK_REPATH_MS: 600,
    ENEMY_ASTAR_MAX_EXPANSIONS: 220,
    ENEMY_LASER_SIGHT_COLOR: '#ff8800',
    ENEMY_LASER_SHOT_COLOR: '#ff2222',
    ENEMY_LASER_SIGHT_WINDUP_MS: 300,
    ENEMY_AIM_UPDATE_INTERVAL_MS: 100,
    ENEMY_LASER_SIGHT_SHOT_DURATION_MS: 400,

    // Walls
    WALL_COLOR: '#444444',
    WALL_THICKNESS: 10,
    
    // Doors
    DOOR_COLOR: '#8B4513',
    DOOR_WIDTH: 60,
    DOOR_PUSH_FORCE: 0.15,

    // Blocks
    BLOCK_COLOR: '#7fb069',
    BLOCK_SIZE: 40,
    BLOCK_PUSH_FORCE: 190,
    BLOCK_MAX_SPEED: 260,
    
    // Rendering
    DARKNESS_ALPHA: 0.85, // How dark the unseen areas are
    FOV_FILL_COLOR: 'rgba(255, 255, 100, 0.05)', // Slight tint in visible area
    
    // Game Loop
    FIXED_TIMESTEP: 1000 / 60, // 60 ticks per second
    MAX_FRAME_TIME: 250, // Maximum time to simulate in one frame (prevents spiral of death)
    
    // Hit Effects
    HIT_MARKER_DURATION: 200, // milliseconds
    HIT_MARKER_COLOR: '#ffffff',
    HIT_MARKER_RADIUS: 10,

    // Hit Vignette
    HIT_VIGNETTE_FADE_IN_MS: 150,   // Time to fade in after a hit
    HIT_VIGNETTE_HOLD_MS: 2000,     // Milliseconds of no damage before fade-out begins
    HIT_VIGNETTE_FADE_OUT_MS: 1200, // Time to fade out
    HIT_VIGNETTE_MAX_ALPHA: 0.55,   // Peak opacity of the red vignette
    
    // Rooms (for map generation)
    ROOM_SIZE: 200,
    CORRIDOR_WIDTH: 80,
    MAP_PADDING: 100,
    MAP_TILE_SIZE: 40,
    MAP_STORAGE_KEY: 'shooterjs.activeMap.v1',
    SHOT_RNG_SEED: 0x12345678,
    TARGET_RESPAWN_RNG_SEED: 0x9e3779b9
};
