# ShooterJS Architecture

## Runtime Model
- Single-player browser runtime with fixed timestep updates.
- ECS-style entities/components with system-driven updates.
- Rendering via Canvas 2D.

## Entrypoints
- `index.html`: game runtime and script wiring.
- `editor.html`: map editor runtime.

## Main Runtime Files
- `game.js`: game bootstrap, state lifecycle, map load/build, game loop, runtime hooks.
- `config.js`: constants for gameplay, map, and testing.
- `mapFormat.js`: map schema validation and normalization.

## Core Boundaries (Multiplayer-Ready)

### `core/simulationCore.js`
Primary deterministic boundary for stepping and serialization.

Public responsibilities:
- `stepSimulation(gameState, dt, options)`
- `serializeGameState(gameState)`
- `deserializeGameState(payload)`

Intent:
- Keep simulation execution shape stable so Node server-authoritative step can reuse logic.
- Allow deterministic local tests independent of wall-clock frame timing.

### `core/mapBuildUtils.js`
Map conversion boundary.

Public responsibilities:
- `extractWallSegments(mapData)`
- `mergeSegments(segments)`
- `getDoorEntityDefinition(mapData, doorData)`

Intent:
- Keep map interpretation deterministic and testable outside browser DOM concerns.

## GameState Shape
Core fields in `game.js`:
- `entities`, `player`, `walls`, `doors`, `blocks`, `targets`
- `score`, `isPaused`, `isGameOver`
- `currentMapData`
- `timeMs` (simulation-time clock for deterministic lifetimes/cooldowns)

## Deterministic Hooks (Browser)
Exposed from `game.js`:
- `window.advanceTime(ms, options)`
- `window.render_game_to_text()`
- `window.serializeGameState()`
- `window.deserializeGameState(payload)`
- `window.setActiveMap(mapPayload)`

## Data Flow
1. Map is loaded from localStorage or default map.
2. Map build utilities convert tiles/doors into runtime entities.
3. Systems update state each fixed step.
4. Render system draws current frame.
5. Tests and automation can step simulation deterministically via `advanceTime`.

## Invariants Agents Should Preserve
- Fixed timestep behavior remains deterministic.
- `timeMs` is the source for step-relative timing logic.
- Serialization output ordering stays stable for tests.
- Map build semantics remain compatible with `MapDataV1` and fixtures.
