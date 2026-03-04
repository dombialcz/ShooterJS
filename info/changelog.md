# Changelog

## 2026-03-04 - Initial Development Session

### Project Initialization
- Created ray-cast FOV top-down shooter from scratch
- Implemented vanilla JavaScript with Canvas 2D API
- Set up Entity-Component System architecture
- Configured fixed 60Hz timestep game loop

### Core Systems Implemented

#### Entity-Component System
- Created lightweight ECS with `Entity` class and component Map
- Component types: Transform, Physics, Collision, Renderable, Gun, Vision, Door, Target, Projectile (deprecated), Tracer
- Entity factories: `createPlayer`, `createTarget`, `createWall`, `createDoor`, `createHitMarker`, `createTracerLine`

#### Game Systems
- **InputSystem**: Command-pattern keyboard/mouse input handling
- **MovementSystem**: Velocity-based physics with wall collision resolution
- **AimingSystem**: Gun rotation follows mouse cursor
- **VisionSystem**: Ray-casting FOV with sweep algorithm from Red Blob Games
- **DoorSystem**: Swinging door physics with hinge mechanics and angular velocity
- **ShootingSystem**: Initially projectile-based, replaced with hitscan raycast
- **RenderSystem**: Canvas rendering with even-odd fill for FOV darkness mask

#### Utilities
- **geometry.js**: Vector math (distance, normalize, angleBetween, rotatePoint, clamp, inBounds)
- **collision.js**: Collision detection (circleCircle, circleAABB, lineIntersection, circleLineSegment)
- **raycaster.js**: Vision cone ray-casting with angle normalization for 360° wrapping

### Map & Level Design
- Room-based map with 3 rooms connected by 2 corridors
- 20 wall segments forming room boundaries
- 4 interactive swinging doors at room entrances
- 5 randomly placed targets with scoring system
- Configurable room size, corridor width, and padding

### Features Added

#### Vision System
- 120° FOV in normal mode
- 45° FOV when aiming down sights (ADS)
- 600-pixel vision range
- 60 rays cast per frame
- Darkness overlay using even-odd fill rule (only areas outside FOV are darkened)

#### Shooting Mechanics
- **Initial Implementation**: Physical projectile bullets
  - 800 px/s projectile speed
  - 3px radius bullets
  - Yellow color with motion trails
  - Maximum travel distance: 1000px

- **Final Implementation** (Hitscan Raycast):
  - Instant hit detection via ray-casting
  - No bullet tunneling through walls
  - Tracer lines (yellow/red) for 0.1 second visual feedback
  - Line-line intersection for walls/doors
  - Ray-circle intersection for targets
  - Automatic closest-hit selection

#### Interactive Doors
- Hinge-based rotation physics
- Angular velocity and spring-back behavior
- Player collision pushes doors open
- Blocks vision and shooting when closed
- CONFIG.DOOR_WIDTH = 60 pixels

#### Player Mechanics
- WASD movement (200 px/s)
- Mouse aiming with gun rotation
- Right-click for ADS (narrows FOV)
- Can only shoot when ADS is active
- Fire rate: 200ms cooldown between shots

### Bug Fixes & Improvements

#### FOV Rendering Issues
- **Problem**: Darkness overlay covered entire canvas
- **Solution**: Switched from destination-out compositing to even-odd fill rule with outer rect + inner polygon with reversed winding

#### 360° Angle Wrapping
- **Problem**: Vision cone broke when rotating through 360° boundary
- **Solution**: Normalized ray angles relative to center angle before sorting: `(angle - centerAngle)` normalized to `[-π, π]`

#### Door Swing Direction
- **Problem**: Doors pushed toward player instead of away
- **Solution**: Added negative sign to torque calculation: `-Math.sign(cross)`

#### Projectile Collision Issues (Deprecated)
- **Problem**: Bullets passed through walls at certain angles
- **Attempts**:
  - Added continuous collision detection with line-line intersection
  - Added epsilon tolerance (0.001) for floating point precision
  - Added gun barrel clipping checks to prevent spawning through walls
  - Added detailed debug logging
- **Root Cause**: Fast-moving projectiles (800 px/s) with floating point errors and edge cases
- **Final Solution**: Replaced entire projectile system with instant hitscan raycast

#### Hitscan Implementation
- Instant ray-cast from gun tip to max range
- Checks all walls, doors, and targets
- Uses `Collision.lineIntersection` for walls/doors
- Uses ray-circle intersection (quadratic formula) for targets
- Finds closest hit within range
- Creates tracer line entity with 100ms lifetime
- Yellow tracer for misses, red tracer for target hits

### Configuration (config.js)
- Canvas: 1280x720
- Player: 200 px/s, 10px radius
- Gun: 20px length, 8px width, 15px offset from player
- Vision: 600px range, 120°/45° FOV (normal/ADS)
- Fire Rate: 200ms
- Tracer Duration: 100ms
- Hit Marker: 15px radius, 500ms duration
- Fixed Timestep: 16.67ms (60 FPS)

### Repository
- GitHub: dombialcz/ShooterJS
- Branch: main
- Initial commit: Project setup
- Latest commit: c000ccf "Replace projectile system with instant hitscan raycast system"

### Architecture Notes
- Designed for future multiplayer extensibility
- Command-pattern input for network serializability
- Deterministic fixed timestep for server authority
- Separated game state from rendering
- Component-based design for easy feature additions

### Files Structure
```
shooterJS/
├── index.html              # Main entry point, canvas setup, UI overlays
├── config.js               # Game constants and configuration
├── components.js           # Component factory functions
├── entities.js             # Entity class and factory functions
├── game.js                 # GameState class, game loop, map generation
├── utils/
│   ├── geometry.js         # Vector math utilities
│   ├── collision.js        # Collision detection functions
│   └── raycaster.js        # FOV ray-casting algorithm
├── systems/
│   ├── inputSystem.js      # Keyboard/mouse input handling
│   ├── movementSystem.js   # Physics and collision resolution
│   ├── aimingSystem.js     # Gun rotation toward mouse
│   ├── visionSystem.js     # FOV calculation
│   ├── doorSystem.js       # Door physics and interaction
│   ├── shootingSystem.js   # Hitscan raycast shooting
│   └── renderSystem.js     # Canvas rendering with FOV mask
└── info/
    ├── changelog.md        # This file
    └── summary.md          # AI-friendly architecture overview
```

### Removed Files
- `systems/projectileSystem.js` - Deprecated in favor of hitscan
- `systems/shootingSystem_old.js` - Backup of projectile-based shooting

### Future Considerations
- Multiplayer networking with Node.js server
- Server-authoritative game state
- Client-side prediction and interpolation
- Input command buffering for network sync
- Room-based matchmaking
