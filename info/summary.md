# ShooterJS Summary

The technical summary has been split into agent-oriented knowledge chunks.

Start here:
- `info/index.md`

Then read based on task:
- `info/architecture.md`
- `info/gameplay-systems.md`
- `info/map-format-and-editor.md`
- `info/testing.md`
- `info/changelog.md`

## Quick Context
- Single-player browser shooter (Canvas 2D, ECS-style systems, fixed timestep).
- Data-driven maps (`MapDataV1`) with editor support.
- Deterministic simulation hooks available for tests and future networking boundaries.
- Test stack: Vitest (unit) + Playwright (E2E + snapshots).
