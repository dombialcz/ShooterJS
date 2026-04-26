const MapFormat = require('../../mapFormat.js');
const MapBuildUtils = require('../../core/mapBuildUtils.js');
const { loadFixtureMap } = require('../helpers/mapFixtures');
const fs = require('fs');
const path = require('path');

describe('MapFormat', () => {
  it('normalizes and validates fixtures', () => {
    const fixtureNames = ['door_push_map', 'block_push_map', 'occlusion_map', 'smoke_default_map'];

    for (const name of fixtureNames) {
      const fixture = loadFixtureMap(name);
      const normalized = MapFormat.normalizeMapData(fixture);
      const errors = MapFormat.validateMapData(normalized);
      expect(errors).toEqual([]);
      expect(normalized.meta.name).toBe(name);
    }
  });

  it('rejects invalid payload', () => {
    const badMap = {
      version: 1,
      meta: { name: 'bad' },
      tileSize: 40,
      cols: 2,
      rows: 2,
      tiles: [0, 0, 0],
      doors: [],
      playerSpawn: { col: 0, row: 0 }
    };

    const errors = MapFormat.validateMapData(badMap);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('extracts wall segments and door transforms', () => {
    const fixture = loadFixtureMap('door_push_map');
    const segments = MapBuildUtils.extractWallSegments(fixture);
    expect(segments.length).toBeGreaterThan(0);

    const doorDef = MapBuildUtils.getDoorEntityDefinition(fixture, fixture.doors[0]);
    expect(doorDef).toBeTruthy();
    expect(typeof doorDef.hingeX).toBe('number');
    expect(typeof doorDef.hingeY).toBe('number');
    expect(typeof doorDef.hingeAngle).toBe('number');
  });

  it('normalizes optional settings and keeps backward compatibility', () => {
    const fixture = loadFixtureMap('smoke_default_map');
    delete fixture.settings;

    const normalized = MapFormat.normalizeMapData(fixture);
    expect(normalized.settings).toBeTruthy();
    expect(Number.isInteger(normalized.settings.timeLimitMs)).toBe(true);
    expect(normalized.settings.timeLimitMs).toBeGreaterThan(0);
    expect(Number.isInteger(normalized.settings.maxTargetsToKill)).toBe(true);
    expect(normalized.settings.maxTargetsToKill).toBeGreaterThan(0);
  });

  it('rejects invalid settings payload', () => {
    const fixture = loadFixtureMap('smoke_default_map');
    fixture.settings = { timeLimitMs: -1, maxTargetsToKill: 0 };
    const errors = MapFormat.validateMapData(fixture);
    expect(errors.some((entry) => entry.includes('settings.timeLimitMs'))).toBe(true);
    expect(errors.some((entry) => entry.includes('settings.maxTargetsToKill'))).toBe(true);
  });

  it('accepts optional victory area and info payload', () => {
    const fixture = loadFixtureMap('smoke_default_map');
    fixture.victoryArea = { col: 3, row: 4, width: 2, height: 2 };
    fixture.info = {
      title: 'Briefing',
      body: ['Clear the room.', 'Reach the exit.']
    };

    const normalized = MapFormat.normalizeMapData(fixture);
    expect(normalized.victoryArea).toEqual({ col: 3, row: 4, width: 2, height: 2 });
    expect(normalized.info.title).toBe('Briefing');
    expect(normalized.info.body).toEqual(['Clear the room.', 'Reach the exit.']);
    expect(MapFormat.validateMapData(normalized)).toEqual([]);
  });

  it('rejects invalid victory area and info payloads', () => {
    const fixture = loadFixtureMap('smoke_default_map');
    fixture.victoryArea = { col: 31, row: 17, width: 2, height: 2 };
    fixture.info = { title: 12, body: ['ok'] };

    const errors = MapFormat.validateMapData(fixture);
    expect(errors.some((entry) => entry.includes('victoryArea'))).toBe(true);
    expect(errors.some((entry) => entry.includes('info.title'))).toBe(true);
  });

  it('accepts and normalizes optional enemies payload', () => {
    const fixture = loadFixtureMap('smoke_default_map');
    fixture.enemies = [
      {
        id: 'enemy-a',
        type: 'melee',
        spawn: { col: 4, row: 4 },
        patrol: [{ col: 5, row: 4 }, { col: 5, row: 5 }]
      },
      {
        type: 'ranged',
        spawn: { col: 10, row: 8 },
        maxHealth: 35,
        moveSpeed: 100,
        attackRange: 300,
        attackCooldownMs: 900,
        damage: 8
      }
    ];

    const normalized = MapFormat.normalizeMapData(fixture);
    expect(Array.isArray(normalized.enemies)).toBe(true);
    expect(normalized.enemies.length).toBe(2);
    expect(normalized.enemies[0].id).toBe('enemy-a');
    expect(normalized.enemies[1].id).toBe('enemy-2');
    expect(normalized.enemies[0].patrol.length).toBe(2);
    expect(normalized.enemies[1].type).toBe('ranged');
  });

  it('rejects invalid enemy payload entries', () => {
    const fixture = loadFixtureMap('smoke_default_map');
    fixture.enemies = [
      {
        id: 1,
        type: 'boss',
        spawn: { col: 1, row: 1 },
        patrol: [{ col: 2, row: 2 }]
      }
    ];

    const errors = MapFormat.validateMapData(fixture);
    expect(errors.some((entry) => entry.includes('enemies[0].id'))).toBe(true);
  });

  it('accepts committed static-targets level map', () => {
    const mapPath = path.join(process.cwd(), 'maps', 'static-targets.json');
    const payload = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    const normalized = MapFormat.normalizeMapData(payload);
    const errors = MapFormat.validateMapData(normalized);
    const horizontalBandAt = (row) => normalized.tiles
      .slice(row * normalized.cols + 10, row * normalized.cols + 22)
      .filter((tile) => tile === MapFormat.TILE_WALL)
      .length;
    expect(errors).toEqual([]);
    expect(normalized.meta.name).toBe('static-targets');
    expect(normalized.tiles.length).toBe(normalized.cols * normalized.rows);
    expect(horizontalBandAt(6)).toBe(10);
    expect(horizontalBandAt(11)).toBe(10);
  });

  it('accepts all committed level maps', () => {
    const mapDir = path.join(process.cwd(), 'maps');
    const catalog = JSON.parse(fs.readFileSync(path.join(mapDir, 'index.json'), 'utf8'));
    for (const level of catalog.levels) {
      const payload = JSON.parse(fs.readFileSync(path.join(process.cwd(), level.path), 'utf8'));
      const normalized = MapFormat.normalizeMapData(payload);
      expect(MapFormat.validateMapData(normalized)).toEqual([]);
      expect(normalized.info?.body?.length).toBeGreaterThan(0);
      expect(normalized.victoryArea).toBeTruthy();
    }
  });

  it('repairs legacy padded tile rows instead of dropping to empty tiles', () => {
    const base = MapFormat.normalizeMapData(MapFormat.createDefaultMapData());
    const paddedTiles = [];

    for (let row = 0; row < base.rows; row += 1) {
      const rowStart = row * base.cols;
      const rowTiles = base.tiles.slice(rowStart, rowStart + base.cols);
      if (row === 0 || row === base.rows - 1) {
        paddedTiles.push(...rowTiles);
        continue;
      }
      paddedTiles.push(...rowTiles.slice(0, base.cols - 2), MapFormat.TILE_EMPTY, ...rowTiles.slice(base.cols - 2));
    }

    const normalized = MapFormat.normalizeMapData({
      ...base,
      tiles: paddedTiles
    });

    expect(normalized.tiles.length).toBe(base.cols * base.rows);
    expect(normalized.tiles).toEqual(base.tiles);
  });
});
