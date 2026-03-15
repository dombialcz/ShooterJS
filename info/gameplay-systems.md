# Gameplay Systems Guide

This file summarizes behavior and coupling between gameplay systems.

## Update Order
Current step pipeline (through `SimulationCore`):
1. `InputSystem`
2. `AimingSystem`
3. `EnemyPerceptionSystem`
4. `EnemyBehaviorSystem`
5. `MovementSystem`
6. `DoorSystem`
7. `BlockSystem`
8. wall correction pass (`MovementSystem.resolveWallCollisions` for player)
9. `VisionSystem`
10. `ShootingSystem`
11. `EnemyCombatSystem`

Order matters for interactions and tests.

## Systems

### InputSystem (`systems/inputSystem.js`)
- Captures keyboard/mouse and writes player input state.
- Supports `skipDOM` option for deterministic test steps.
- Feeds movement vectors, ADS flag, shoot intent, and aim angle.

### AimingSystem (`systems/aimingSystem.js`)
- Aligns player transform rotation with input aim angle.

### MovementSystem (`systems/movementSystem.js`)
- Applies velocity from input to movement.
- Resolves circle-vs-wall collisions.
- Used again as post-block correction for player wall clipping prevention.

### DoorSystem (`systems/doorSystem.js`)
- Hinge-based swinging doors with spring and damping.
- Player collision adds torque and pushes door/player apart.
- Door line segment is used by collision/vision/shooting systems.

### BlockSystem (`systems/blockSystem.js`)
- Pushable block behavior with continuous movement.
- Handles pusher-block overlap resolution.
- Prevents blocks from penetrating walls, doors, and other blocks.
- Stabilizes block stacking overlaps.

### VisionSystem (`systems/visionSystem.js`)
- Raycasts against combined obstacle segments.
- Uses `gameState.getVisionSegments()` so doors + blocks affect FOV clipping.

### ShootingSystem (`systems/shootingSystem.js`)
- ADS-gated hitscan logic.
- Checks intersections with walls, doors, blocks, then targets.
- Uses `gameState.timeMs` for fire-rate timing in deterministic tests.
- Spawns tracer/hitmarker effects with simulation-time-based lifetimes.

### EnemyPerceptionSystem / EnemyBehaviorSystem / EnemyCombatSystem (`systems/enemy*.js`)
- Enemies remain idle/patrolling until they gain LOS to player.
- Melee enemies close distance and deal contact damage.
- Ranged enemies fire with deterministic miss policy (first miss, then 50% miss chance).
- Path-following uses deterministic grid A* when direct LOS pathing is blocked.

### RenderSystem (`systems/renderSystem.js`)
- Draws world layers in fixed order.
- Uses `gameState.timeMs` for lifetime-based visual fade.
- Visual changes may require Playwright snapshot updates.

## Coupling Notes
- Door and block geometry are shared across movement, vision, and shooting.
- Any change in segment generation or collision tolerance may affect all three systems.
- Simulation-time changes can impact both game feel and deterministic test assertions.

## High-Risk Change Areas
- `DoorSystem.getDoorSegment` behavior
- `BlockSystem.isBlockBlocked` and collision overlap math
- Ray intersection logic in `ShootingSystem`
- Vision segment sourcing in `gameState.getVisionSegments`

When touching these, run full test pass: `npm run test`.
