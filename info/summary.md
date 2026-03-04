# ShooterJS - Technical Summary

**AI-Friendly Architecture Overview**

This document provides a comprehensive technical overview of the ShooterJS game for AI agents to understand the codebase structure, systems, and data flow.

---

## Project Overview

**Type**: Top-down 2D shooter with ray-traced field of vision  
**Tech Stack**: Vanilla JavaScript, Canvas 2D API  
**Architecture**: Entity-Component System (ECS)  
**Game Loop**: Fixed 60Hz timestep with accumulator pattern  
**Repository**: GitHub - dombialcz/ShooterJS

### Core Concept
- Player navigates a room-based map with WASD movement
- Mouse controls aiming direction
- Right-click to aim down sights (ADS) - narrows FOV and enables shooting
- Shoot targets using hitscan raycast mechanics
- Vision cone darkens areas outside player's FOV
- Interactive swinging doors block movement and vision
- Score points by destroying 5 targets

---

## File Structure & Responsibilities

### Entry Point
**`index.html`**
- Canvas element (1280x720)
- UI overlays: score counter, ADS indicator, game over screen, restart button
- Script loading order (critical - must be in this order):
  1. config.js
  2. utils/*.js
  3. components.js
  4. entities.js
  5. systems/*.js
  6. game.js

### Configuration
**`config.js`**
- All game constants in a single `CONFIG` object
- Canvas dimensions, player stats, weapon properties, vision settings
- Easy to modify for balancing gameplay
- Used by all systems - import by accessing global `CONFIG`

### Core ECS Files

**`entities.js`**
- `Entity` class: id, type, components Map
- `nextEntityId` counter for unique IDs
- Factory functions:
  - `createPlayer(x, y)` → player entity with Transform, Physics, CollisionCircle, Renderable, Gun, Vision, Input
  - `createTarget(x, y)` → target entity with Transform, CollisionCircle, Renderable, Target
  - `createWall(x1, y1, x2, y2)` → wall entity with WallSegment
  - `createDoor(hingeX, hingeY, width, hingeAngle)` → door entity with Door, Renderable
  - `createHitMarker(x, y)` → temporary visual effect with Lifetime
  - `createTracerLine(x1, y1, x2, y2, color)` → shot visualization with Lifetime

**`components.js`**
- Component factory functions (return plain objects)
- Key components:
  - `Transform(x, y, rotation)` - position and orientation
  - `Physics(speed, friction=0.9, mass=1)` - movement with vx/vy
  - `CollisionCircle(radius)` / `CollisionAABB(width, height)` - hit detection
  - `Renderable(shape, color, size)` - visual representation
  - `Gun(length, width, offsetX, color)` - weapon properties with lastShotTime, fireRate
  - `Vision(range, fovAngle, rayCount)` - FOV parameters with currentFOV
  - `Door(hingeX, hingeY, width, hingeAngle)` - hinge physics with currentAngle, angularVelocity
  - `Target(points, isDestroyed)` - score value and destruction state
  - `WallSegment(x1, y1, x2, y2)` - line segment for walls
  - `Tracer(x1, y1, x2, y2, color)` - shot visualization line

### Game State
**`game.js`**

**`GameState` class:**
```javascript
{
  entities: Map<id, Entity>,    // All game entities
  player: Entity,                // Quick reference to player
  walls: [WallSegment],          // Array of wall components
  doors: [Entity],               // Array of door entities
  targets: [Entity],             // Array of target entities
  score: number,
  isPaused: boolean,
  isGameOver: boolean
}
```

**Methods:**
- `addEntity(entity)` - adds to entities Map and populates reference arrays
- `removeEntity(entityId)` - removes from Map and cleans up references
- `getAllWallSegments()` - returns walls + door segments for raycasting
- `addScore(points)` - increments score
- `checkGameOver()` - checks if all targets destroyed

**`Game` class:**
- Manages game loop with fixed timestep accumulator
- `init()` - creates map, player, targets, sets up input
- `update(dt)` - calls all system updates in order
- `render(alpha)` - calls RenderSystem
- `initializeMap()` - creates room-based layout
- `createRoomWallsWithDoors()` - manually places walls with gaps for doors

---

## Systems (Update Order Matters!)

### 1. InputSystem (`systems/inputSystem.js`)
**Purpose**: Capture keyboard/mouse input and store in player's Input component

**Input Component Structure:**
```javascript
{
  keys: Set<string>,           // Currently pressed keys
  mouseX: number,              // Canvas coordinates
  mouseY: number,
  aimAngle: number,            // Angle from player to mouse
  isADS: boolean,              // Right mouse button held
  isShooting: boolean          // Left mouse button held
}
```

**Event Listeners:**
- keydown/keyup → adds/removes from keys Set
- mousemove → updates mouseX, mouseY, calculates aimAngle
- mousedown/mouseup → sets isADS (button 2) or isShooting (button 0)
- contextmenu → prevents right-click menu

**Flow**: User input → Input component → other systems read Input component

---

### 2. AimingSystem (`systems/aimingSystem.js`)
**Purpose**: Update player rotation to face mouse cursor

**Algorithm:**
```javascript
transform.rotation = input.aimAngle
```

**Simple but critical**: Gun and vision cone use player rotation

---

### 3. MovementSystem (`systems/movementSystem.js`)
**Purpose**: Handle player physics and wall collision

**Movement:**
- WASD keys set velocity: `physics.vx`, `physics.vy`
- Speed normalized for diagonal movement
- Apply friction: `vx *= friction`, `vy *= friction`
- Update position: `x += vx * dt`, `y += vy * dt`

**Wall Collision:**
- Check `gameState.walls` array
- Use `Collision.circleLineSegment()` for each wall
- If hit, resolve by pushing player away from wall
- Calculate normal vector and push distance

**Door Collision:**
- Similar to walls but uses `DoorSystem.getDoorSegment()` for dynamic position
- Doors can be pushed open (handled by DoorSystem)

---

### 4. DoorSystem (`systems/doorSystem.js`)
**Purpose**: Handle door physics and player interaction

**Door Component:**
```javascript
{
  hingeX, hingeY,              // Fixed hinge point
  width,                       // Door length
  hingeAngle,                  // Initial angle (closed position)
  currentAngle,                // Current rotation from hinge angle
  angularVelocity,             // Rotation speed
  openDamping: 0.95,           // Angular friction
  springStrength: 0.05         // Force pulling door back to closed
}
```

**Physics:**
1. Apply spring force: pulls door back to closed (currentAngle → 0)
2. Apply damping: reduces angular velocity
3. Player collision: calculate torque based on push direction
4. Update: `currentAngle += angularVelocity * dt`

**`getDoorSegment(door)`:**
- Returns line segment from hinge point to door end
- Used by collision detection and rendering
```javascript
{
  x1: hingeX,
  y1: hingeY,
  x2: hingeX + cos(hingeAngle + currentAngle) * width,
  y2: hingeY + sin(hingeAngle + currentAngle) * width
}
```

---

### 5. VisionSystem (`systems/visionSystem.js`)
**Purpose**: Calculate field of vision cone using ray-casting

**Algorithm** (from Red Blob Games):
1. Determine FOV angle (120° normal, 45° ADS)
2. Generate ray angles:
   - Regular intervals across FOV arc
   - Additional rays toward wall endpoints (optimization)
3. Cast each ray using `Raycaster.castRay()`
4. Sort rays by normalized angle to handle 360° wrapping
5. Store results in `vision.fovPolygon` for rendering

**Critical Fix**: Angle normalization
```javascript
// Normalize angle to [-π, π] relative to center
normalizedAngle = (angle - centerAngle + π) % (2π) - π
```
This prevents FOV breaking when rotating through 0°/360°.

---

### 6. ShootingSystem (`systems/shootingSystem.js`)
**Purpose**: Handle weapon firing with instant hitscan raycast

**Trigger Conditions:**
- `input.isADS` must be true
- `input.isShooting` must be true
- Time since last shot ≥ `gun.fireRate` (200ms)

**Hitscan Algorithm:**
1. Calculate gun tip position: `playerPos + (gunOffset + gunLength) * rotation`
2. Create ray from gun tip in aim direction, length = VISION_RANGE
3. Test ray against all obstacles:
   
   **Walls:**
   - `Collision.lineIntersection(ray, wallSegment)`
   - Store hit point and distance
   
   **Doors:**
   - Get dynamic segment via `DoorSystem.getDoorSegment(door)`
   - `Collision.lineIntersection(ray, doorSegment)`
   
   **Targets:**
   - Ray-circle intersection using quadratic formula
   - `discriminant = b² - 4ac`
   - `t = (-b - √discriminant) / 2a`
   - Check if `0 ≤ t ≤ 1`

4. Find closest hit (minimum distance)
5. Create tracer line from gun tip to hit point (or max range)
6. If target hit: destroy target, add score, create hit marker

**Tracer Lines:**
- Yellow for misses, red for target hits
- Entity with `Tracer` component
- Lifetime: 100ms (automatically removed)

---

### 7. RenderSystem (`systems/renderSystem.js`)
**Purpose**: Draw all entities and effects to canvas

**Render Order** (back to front):
1. Clear canvas (dark gray background)
2. Draw walls (gray lines, 5px thick)
3. Draw doors (brown lines, dynamic position)
4. Draw targets (red circles)
5. Draw tracer lines (yellow/red with glow)
6. Draw player (blue circle)
7. Draw gun (black rectangle, rotated)
8. Draw hit markers (orange circles, fading)
9. Apply darkness mask (FOV darkness overlay)
10. Draw crosshair

**FOV Darkness Mask** (Critical Implementation):
Uses **even-odd fill rule** to create inverse mask:
```javascript
ctx.save()
ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
ctx.beginPath()

// Outer rectangle (entire canvas)
ctx.rect(0, 0, width, height)

// Inner polygon (FOV cone, REVERSE WINDING)
ctx.moveTo(player.x, player.y)
for (ray in reverse order) {
  ctx.lineTo(ray.x, ray.y)
}
ctx.closePath()

ctx.fill('evenodd')  // Only fills area between outer and inner
ctx.restore()
```

**Key**: Outer rect clockwise, inner polygon counter-clockwise. Even-odd rule fills areas crossed odd number of times.

---

## Utility Modules

### `utils/geometry.js`
Vector math and geometric utilities:
- `distance(x1, y1, x2, y2)` - Euclidean distance
- `distanceSquared(x1, y1, x2, y2)` - For fast comparisons
- `normalize(x, y)` - Returns unit vector {x, y}
- `angleBetween(x1, y1, x2, y2)` - Angle from point 1 to point 2
- `rotatePoint(x, y, angle)` - Rotate vector by angle
- `clamp(value, min, max)` - Constrain value to range
- `inBounds(x, y, minX, minY, maxX, maxY)` - Check if point in rect

### `utils/collision.js`
Collision detection functions:

**`circleCircle(x1, y1, r1, x2, y2, r2)`**
- Returns true if circles overlap
- `distance² < (r1 + r2)²`

**`circleAABB(cx, cy, cr, rx, ry, rw, rh)`**
- Circle vs axis-aligned bounding box
- Find closest point on rect to circle center
- Check if within radius

**`lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4)`**
- Line segment intersection using parametric equations
- Returns `{x, y, t1, t2}` if intersects, null otherwise
- **Critical**: Uses epsilon (0.001) for floating point tolerance
- `t1, t2 ∈ [-ε, 1+ε]` to catch edge cases

**`circleLineSegment(cx, cy, radius, x1, y1, x2, y2)`**
- Project circle center onto line segment
- Clamp projection to segment bounds
- Check distance from closest point
- Returns `{hit: true/false, closestX, closestY, distance}`

**`resolveCircleAABB(cx, cy, radius, rx, ry, rw, rh)`**
- Push circle out of rectangle
- Returns new position {x, y}
- Used for wall collision response

### `utils/raycaster.js`
FOV ray-casting implementation:

**`castVisionCone(startX, startY, angle, fovAngle, range, obstacles, rayCount)`**
1. Generate ray angles across FOV arc
2. Add rays toward all wall/door endpoints (optimization from Red Blob Games)
3. Cast each ray via `castRay()`
4. Normalize angles relative to center: `(angle - centerAngle) % 2π`
5. Sort by normalized angle
6. Return ordered array of {x, y, angle, distance, normalizedAngle}

**`castRay(startX, startY, angle, range, obstacles)`**
- Single ray cast
- Test against all obstacles using `raySegmentIntersect()`
- Return closest intersection point

**`generateRayAngles(centerAngle, fovAngle, rayCount, obstacles)`**
- Uniform distribution across FOV
- Add angles toward wall endpoints for crisp shadows

---

## Data Flow

### Input → State → Render Pipeline
```
1. User Input
   ↓
2. InputSystem captures input → Input component
   ↓
3. AimingSystem reads Input → updates Transform rotation
   ↓
4. MovementSystem reads Input → updates Transform position
   ↓
5. DoorSystem checks player collisions → updates Door angle
   ↓
6. VisionSystem reads Transform → casts rays → updates fovPolygon
   ↓
7. ShootingSystem reads Input + Transform → raycasts → creates Tracer
   ↓
8. RenderSystem reads all components → draws to canvas
```

### Entity Lifecycle
```
1. Created by factory function (createPlayer, createTarget, etc.)
   ↓
2. Added to GameState via addEntity()
   ↓
3. Systems update components each frame
   ↓
4. RenderSystem draws entity
   ↓
5. Removed by removeEntity() or automatic cleanup (Lifetime component)
```

### Collision Detection Flow
```
Player Movement:
  MovementSystem → circleLineSegment(player, wall)
  
Door Interaction:
  Player → getDoorSegment(door) → apply torque
  
Shooting:
  ShootingSystem → lineIntersection(ray, walls/doors)
                 → ray-circle intersection(ray, targets)
```

---

## Map Generation

### Room Layout (`createRoomWallsWithDoors`)
```
Room 1 (Top Left):
  Position: (100, 100)
  Size: 200x200
  Door: Right wall (connects to horizontal corridor)

Horizontal Corridor:
  Position: (300, 160)
  Size: 680x80
  Connects: Room 1 ↔ Room 2

Room 2 (Top Right):
  Position: (980, 100)
  Size: 200x200
  Doors: Left wall (corridor), Bottom wall (vertical corridor)

Vertical Corridor:
  Position: (600, 300)
  Size: 80x120
  Connects: Room 2 ↔ Room 3

Room 3 (Bottom Center):
  Position: (540, 420)
  Size: 200x200
  Door: Top wall (connects to vertical corridor)
```

### Wall Creation
Walls are line segments with gaps for doors. Each room has 5 walls (top, right, bottom, left, subdivided for door gaps).

### Door Placement
4 doors total, placed at:
1. Room 1 → Corridor: (300, 130) vertical door
2. Corridor → Room 2: (980, 200) vertical door  
3. Room 2 → Corridor: (640, 300) horizontal door
4. Corridor → Room 3: (640, 420) horizontal door

---

## Debugging & Development

### Console Logging
- Input system initialization
- Game initialization with entity counts
- Target hits with score
- (Debug logs removed in production)

### Common Issues & Solutions

**Bullets passing through walls:**
- Solution: Switched from physical projectiles to instant hitscan
- Root cause: Fast movement causing frame-to-frame tunneling

**FOV breaking at 360°:**
- Solution: Normalize angles relative to center before sorting
- Root cause: Angle wrapping discontinuity at 0/2π

**Doors pushing wrong direction:**
- Solution: Negate torque sign
- Root cause: Cross product gave opposite direction

**Floating point precision:**
- Solution: Epsilon tolerance in line intersection (±0.001)
- Root cause: `t = 1.0000001` failing strict bounds check

---

## Performance Considerations

### Optimization Strategies
1. **Ray-casting**: Only cast toward wall endpoints, not uniform grid
2. **Collision**: Use distance² for comparisons (avoid sqrt)
3. **Entity filtering**: Systems iterate only relevant entity types
4. **Fixed timestep**: Consistent 60Hz regardless of render FPS
5. **Component references**: Store walls/doors in arrays for fast iteration

### Scalability
- Current: 5 targets, 20 walls, 4 doors, 1 player
- Can handle 100+ entities at 60 FPS
- Bottleneck: Ray-casting (O(n) where n = obstacles)
- Future: Spatial partitioning (quadtree) for collision detection

---

## Extending the Game

### Adding New Entity Types
1. Create component in `components.js`
2. Create factory function in `entities.js`
3. Update `GameState.addEntity()` if needed
4. Create/update system in `systems/`
5. Update `RenderSystem` to draw new entity

### Adding New Weapons
1. Modify `Gun` component with weapon properties
2. Update `ShootingSystem.shoot()` with new logic
3. Add weapon-specific rendering in `RenderSystem`

### Multiplayer Preparation
Current architecture supports:
- Command-pattern input (serializable)
- Deterministic fixed timestep
- Separated game state from rendering
- ECS for easy state synchronization

TODO for multiplayer:
- Server-authoritative game state
- Client prediction and interpolation
- Input buffering and reconciliation
- WebSocket connection handling

---

## Key Algorithms

### Ray-Circle Intersection (for target shooting)
```javascript
// Ray: start + t * direction, t ∈ [0, 1]
// Circle: (x - cx)² + (y - cy)² = r²

dx = endX - startX
dy = endY - startY
fx = startX - circleX
fy = startY - circleY

a = dx² + dy²
b = 2(fx*dx + fy*dy)
c = fx² + fy² - r²

discriminant = b² - 4ac

if discriminant ≥ 0:
  t = (-b - √discriminant) / 2a
  if 0 ≤ t ≤ 1:
    hitX = startX + t*dx
    hitY = startY + t*dy
    RETURN hit
```

### Line-Line Intersection (for wall collision)
```javascript
// Lines: p1→p2 and p3→p4
// Parametric: p1 + t1(p2-p1), t1 ∈ [0,1]
//            p3 + t2(p4-p3), t2 ∈ [0,1]

denom = (x1-x2)(y3-y4) - (y1-y2)(x3-x4)

if |denom| < 0.0001:
  RETURN null (parallel)

t1 = ((x1-x3)(y3-y4) - (y1-y3)(x3-x4)) / denom
t2 = -((x1-x2)(y1-y3) - (y1-y2)(x1-x3)) / denom

epsilon = 0.001
if -epsilon ≤ t1 ≤ 1+epsilon AND -epsilon ≤ t2 ≤ 1+epsilon:
  x = x1 + t1(x2-x1)
  y = y1 + t1(y2-y1)
  RETURN {x, y, t1, t2}
```

---

## Configuration Reference

All constants in `config.js`:

**Canvas:**
- WIDTH: 1280, HEIGHT: 720

**Player:**
- SPEED: 200 px/s
- RADIUS: 10 px
- COLOR: #4a9eff (blue)

**Gun:**
- LENGTH: 20 px
- WIDTH: 8 px
- OFFSET_X: 15 px (from player center)
- COLOR: #1a1a1a (black)

**Shooting:**
- FIRE_RATE: 200 ms

**Vision:**
- RANGE: 600 px
- FOV_NORMAL: 120° (2.094 rad)
- FOV_ADS: 45° (0.785 rad)
- RAY_COUNT: 60

**Doors:**
- WIDTH: 60 px
- COLOR: #8B4513 (brown)

**Targets:**
- RADIUS: 15 px
- COLOR: #ff4444 (red)
- POINTS: 100

**Hit Markers:**
- RADIUS: 15 px
- COLOR: #ff8c00 (orange)
- DURATION: 500 ms

**Map:**
- ROOM_SIZE: 200 px
- CORRIDOR_WIDTH: 80 px
- MAP_PADDING: 100 px

**Game Loop:**
- FIXED_TIMESTEP: 16.67 ms (60 FPS)
- MAX_FRAME_TIME: 250 ms (prevent spiral of death)

---

## Summary

ShooterJS is a well-structured top-down shooter demonstrating:
- Clean ECS architecture
- Ray-traced vision and shooting mechanics
- Physics-based door interactions
- Fixed timestep game loop
- Instant hitscan combat system

The codebase is modular, extensible, and ready for multiplayer implementation. Each system is isolated, components are data-only, and game state is cleanly separated from rendering.

**For AI agents: This summary provides all necessary context to understand, debug, and extend the game without prior knowledge of the codebase.**
