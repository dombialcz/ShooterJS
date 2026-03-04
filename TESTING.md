# Testing

## Prerequisites
- Node.js 20+
- Install dependencies:

```bash
npm install
```

## Fixture maps
Fixture maps are stored in `tests/fixtures/maps` and use `MapDataV1`.

Regenerate fixtures:

```bash
npm run generate:fixtures
```

## Unit tests
Run logic and deterministic-core tests:

```bash
npm run test:unit
```

## E2E tests
Run Playwright tests (includes deterministic stepping + state assertions + screenshots):

```bash
npm run test:e2e
```

Run headed for visual debugging:

```bash
npm run test:e2e:headed
```

## Snapshot updates
If intended visual changes occur, update screenshots with:

```bash
npx playwright test --update-snapshots
```

## Run specific tests
Unit:

```bash
npx vitest run tests/unit/door-system.test.js
```

E2E:

```bash
npx playwright test tests/e2e/gameplay.spec.js -g "door push"
```
