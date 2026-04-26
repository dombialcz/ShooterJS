# Map Format and Editor

## MapDataV1 Schema
Defined and validated in `mapFormat.js`.

Fields:
- `version`
- `meta` (optional; supports `meta.name`)
- `settings` (optional; supports `timeLimitMs` and `maxTargetsToKill`)
- `tileSize`
- `cols`, `rows`
- `tiles` (flat array of length `cols * rows`)
- `doors` array of `{ col, row, orientation, hingeSide }`
- `playerSpawn`
- `targetSpawns`
- `victoryArea` (optional `{ col, row, width, height }` extraction zone)
- `info` (optional `{ title, body }`, where `body` is an array of briefing lines)
- `enemies` (optional array of enemy spawn/combat descriptors)

Tile values:
- `0`: empty
- `1`: wall
- `2`: block

## Door Representation
- Orientation:
  - `vertical`: hingeSide must be `top` or `bottom`
  - `horizontal`: hingeSide must be `left` or `right`
- Runtime converts descriptor to hinge position + hinge angle via `MapBuildUtils.getDoorEntityDefinition`.

## Runtime Map Loading
- Primary source: committed level catalog (`maps/index.json`) and map files under `maps/`.
- Active map key: `CONFIG.MAP_STORAGE_KEY` (`shooterjs.activeMap.v1`).
- LocalStorage map APIs remain for editor import/export and manual preview hooks.
- `MapFormat.createDefaultMapData()` is kept as an emergency code fallback when the level catalog cannot be loaded.
- `MapBuildUtils` converts walls to merged segments.

Runtime APIs:
- `window.loadMapFromJson(text)`
- `window.exportCurrentMap()`
- `window.setActiveMap(mapPayload)`

## Editor Behavior
Files:
- `editor.html`
- `editor.css`
- `editor.js`

Tools:
- wall
- door
- block
- erase
- player spawn
- target spawn
- victory area
- enemy melee spawn
- enemy ranged spawn
- patrol waypoint authoring (select enemy, then place/remove waypoints)

Door placement controls:
- Orientation selector
- Hinge side selector constrained by orientation

Persistence:
- Save to localStorage (active map key)
- JSON import/export
- Preview in game page

## Fixture Maps for Tests
Location: `tests/fixtures/maps/`
- `door_push_map.json`
- `block_push_map.json`
- `occlusion_map.json`
- `smoke_default_map.json`
- `metadata.json`

Regenerate fixtures:
- `npm run generate:fixtures`

## When to Update Map Docs/Fixtures
Update map docs and fixtures when:
- schema changes
- door semantics change
- tile interpretation changes
- fixture scenarios no longer represent expected gameplay behavior
