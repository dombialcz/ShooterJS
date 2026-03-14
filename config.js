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
    TARGET_RESPAWN_DELAY_MIN_MS: 10000,
    TARGET_RESPAWN_DELAY_MAX_MS: 20000,
    
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
    
    // Rooms (for map generation)
    ROOM_SIZE: 200,
    CORRIDOR_WIDTH: 80,
    MAP_PADDING: 100,
    MAP_TILE_SIZE: 40,
    MAP_STORAGE_KEY: 'shooterjs.activeMap.v1',
    SHOT_RNG_SEED: 0x12345678,
    TARGET_RESPAWN_RNG_SEED: 0x9e3779b9
};
