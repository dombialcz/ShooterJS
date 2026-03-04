# ShooterJS Knowledge Index (Agent Entry Point)

Use this file first. It routes tasks to the right docs and defines required test gates.

## Read Order for Agents
1. Read this file (`info/index.md`).
2. Read `info/architecture.md` for runtime boundaries and data flow.
3. Read topic-specific docs based on your task:
   - `info/gameplay-systems.md`
   - `info/map-format-and-editor.md`
   - `info/testing.md`
4. Check `info/changelog.md` for recent intent and historical context.

## Task-to-Doc Routing
- Input/movement/door/block/shooting behavior:
  - `info/gameplay-systems.md`
  - `info/testing.md`
- Map schema, map loading, editor behavior, fixtures:
  - `info/map-format-and-editor.md`
  - `info/testing.md`
- Deterministic stepping, serialization, multiplayer-prep:
  - `info/architecture.md`
  - `info/testing.md`
- Test failures and snapshot drift:
  - `info/testing.md`
  - relevant fixture section in `info/map-format-and-editor.md`

## File Ownership Map
- Runtime entrypoints:
  - `index.html` (game)
  - `editor.html` (map editor)
- Core game orchestration:
  - `game.js`
  - `config.js`
- ECS model:
  - `components.js`
  - `entities.js`
- Core boundaries (important for future Node multiplayer):
  - `core/simulationCore.js`
  - `core/mapBuildUtils.js`
- Systems:
  - `systems/*.js`
- Map format:
  - `mapFormat.js`
- Tests:
  - `tests/unit/*`
  - `tests/e2e/*`
  - `tests/fixtures/maps/*`

## Mandatory Test Gates

### Update Unit Tests When
- You change pure logic in:
  - `utils/*`
  - `core/*`
  - `mapFormat.js`
  - deterministic math/collision/transform rules in systems

### Update E2E Tests When
- You change interaction flows or outcomes:
  - controls/input mapping
  - map loading behavior
  - door/block push dynamics
  - shooting occlusion
  - game-over/score flow
  - deterministic hooks or serialized output shape

### Update Screenshot Baselines When
- Visual output intentionally changes (render order, colors, line widths, overlays, UI placement).
- Then run: `npx playwright test --update-snapshots`.

### Update Fixture Maps When
- `MapDataV1` schema changes.
- Tile semantics change (`0/1/2`, door interpretation, spawn meaning).
- Scenario assumptions used by tests become invalid.

## When Agent Must Run Tests

### Minimum
- Logic/system/core changes: run `npm run test:unit`.
- Gameplay/map/editor/render/integration changes: run `npm run test:e2e`.

### Full Required Pass (`npm run test`)
Run full pass before finishing if any of these are touched:
- `game.js`
- `core/*`
- `mapFormat.js`
- `systems/*` (except trivial comments)
- map editor files
- fixture files
- test hooks or serialized state shape

### No Test Needed
- Docs-only changes under `info/` and `TESTING.md`.

## Commands
- Install deps: `npm install`
- Unit: `npm run test:unit`
- E2E: `npm run test:e2e`
- E2E headed: `npm run test:e2e:headed`
- Full pipeline: `npm run test`
- Regenerate fixtures: `npm run generate:fixtures`
