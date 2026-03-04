# Changelog

## 2026-03-04

### Initial ShooterJS Build

#### Added
- Browser-only top-down shooter using vanilla JavaScript + Canvas 2D.
- ECS-style architecture with entities, components, and modular systems.
- Core systems: input, movement, aiming, vision, door physics, shooting, rendering.
- Fixed-timestep game loop (60 Hz).
- Hitscan shooting with tracer/hitmarker feedback.
- Swinging door interactions that affect movement, vision, and shooting.

#### Changed
- Replaced projectile-based shooting with hitscan raycast to avoid tunneling issues.
- Corrected FOV rendering with even-odd mask fill.
- Fixed angle normalization issues around 0°/360°.
- Fixed door push direction torque sign.

#### Notes
- Foundation prepared for future networking/multiplayer migration.

---

### Map Editor + Pushable Blocks + Deterministic Test Architecture

#### Added
- Data-driven map format (`MapDataV1`) and map runtime loader.
- Grid-based map editor (`editor.html`, `editor.js`, `editor.css`) with tools:
  - wall, door, block, erase, player spawn
  - door orientation + hinge side controls
  - JSON import/export and localStorage save
- Pushable block entity/component/system with continuous movement and collision behavior.
- Deterministic simulation boundary:
  - `core/simulationCore.js`
  - `core/mapBuildUtils.js`
- Runtime deterministic hooks/APIs:
  - `window.advanceTime(ms, options)`
  - `window.render_game_to_text()`
  - `window.serializeGameState()` / `window.deserializeGameState(payload)`
  - `window.setActiveMap(mapPayload)`
- Node test infrastructure:
  - Vitest unit tests (`tests/unit`)
  - Playwright E2E tests (`tests/e2e`)
  - fixture maps + metadata (`tests/fixtures/maps`)
  - local static test server and fixture generator scripts
  - testing docs in `TESTING.md`

#### Changed
- Runtime map generation moved from hardcoded room construction to map-data build flow.
- Shooting cooldown and effect lifetimes moved to simulation-time clock (`gameState.timeMs`) for deterministic stepping.
- Vision and shooting occlusion extended to include blocks.

#### Verification
- `npm run test:unit` passes.
- `npm run test:e2e` passes.
- `npm run test` (unit + e2e) passes.

#### Notes
- Single-player remains fully runnable with no server component.
- Architecture now explicitly supports future Node.js server-authoritative multiplayer work.
