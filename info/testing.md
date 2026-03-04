# Testing Guide for Agents

## Strategy
- Unit tests (Vitest): logic correctness and deterministic behavior.
- E2E tests (Playwright): integration behavior, deterministic stepping, and visual regression snapshots.
- Hybrid assertion model:
  - primary: state assertions using `window.render_game_to_text()`
  - secondary: screenshot snapshots

## Test Layout
- Unit: `tests/unit/`
- E2E: `tests/e2e/`
- Helpers: `tests/helpers/`
- Fixtures: `tests/fixtures/maps/`

## Commands
- Install: `npm install`
- Unit only: `npm run test:unit`
- E2E only: `npm run test:e2e`
- E2E headed: `npm run test:e2e:headed`
- Full pipeline: `npm run test`
- Update snapshots: `npx playwright test --update-snapshots`
- Regenerate fixtures: `npm run generate:fixtures`

## Deterministic Test Hooks
Exposed by runtime:
- `window.advanceTime(ms, options)`
- `window.render_game_to_text()`
- `window.serializeGameState()`
- `window.deserializeGameState(payload)`

Use deterministic stepping for robust E2E assertions instead of sleeping/waiting for real-time effects.

## Test Update Rules

### Update Unit Tests When
- Changing logic in `utils/*`, `core/*`, `mapFormat.js`.
- Changing collision, geometry, door math, map conversion, or serialization behavior.

### Update E2E Tests When
- Changing controls or input mapping.
- Changing map loading flow or localStorage map behavior.
- Changing door/block interactions, shooting occlusion, vision behavior, score/game-over behavior.
- Changing deterministic hook behavior or text-state output shape.

### Update Snapshots When
- Visual output intentionally changes.
- Typical causes:
  - render order changes
  - style/color/line-width changes
  - overlay/UI placement changes

### Update Fixtures When
- Map schema changes.
- Map semantics change (tiles/doors/spawns).
- Existing fixture scenarios stop representing intended game logic.

## Required Test Pass Policy

### Minimum per change type
- Pure logic/system changes: run `npm run test:unit`.
- Gameplay/render/editor/integration changes: run `npm run test:e2e`.

### Mandatory full pass
Run `npm run test` before closing a task if touching:
- `game.js`
- `core/*`
- `mapFormat.js`
- `systems/*`
- map editor files
- fixtures or deterministic hooks

### Docs-only changes
- No test run required for `info/*` or `TESTING.md` edits only.

## Failure Triage Checklist
1. Reproduce failing test in isolation.
2. Check if fixture expectations are stale.
3. Check if serialized state schema changed.
4. If visuals changed intentionally, update snapshots.
5. Re-run full `npm run test` after fixes.
