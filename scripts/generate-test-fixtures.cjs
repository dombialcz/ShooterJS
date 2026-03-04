const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'maps');
const TILE_EMPTY = 0;
const TILE_WALL = 1;
const TILE_BLOCK = 2;

function blankMap(name) {
  const cols = 32;
  const rows = 18;
  const tileSize = 40;
  const tiles = new Array(cols * rows).fill(TILE_EMPTY);

  for (let c = 0; c < cols; c++) {
    set(tiles, cols, c, 0, TILE_WALL);
    set(tiles, cols, c, rows - 1, TILE_WALL);
  }
  for (let r = 0; r < rows; r++) {
    set(tiles, cols, 0, r, TILE_WALL);
    set(tiles, cols, cols - 1, r, TILE_WALL);
  }

  return {
    version: 1,
    meta: { name },
    tileSize,
    cols,
    rows,
    tiles,
    doors: [],
    playerSpawn: { col: 2, row: 9 },
    targetSpawns: []
  };
}

function idx(cols, c, r) { return r * cols + c; }
function set(tiles, cols, c, r, v) { tiles[idx(cols, c, r)] = v; }

function addHorizontalLaneWalls(map, topRow, bottomRow, fromCol, toCol) {
  for (let c = fromCol; c <= toCol; c++) {
    set(map.tiles, map.cols, c, topRow, TILE_WALL);
    set(map.tiles, map.cols, c, bottomRow, TILE_WALL);
  }
}

function makeDoorPushMap() {
  const map = blankMap('door_push_map');
  for (let r = 2; r <= 15; r++) set(map.tiles, map.cols, 16, r, TILE_WALL);

  map.doors.push({ col: 16, row: 8, orientation: 'vertical', hingeSide: 'top' });
  set(map.tiles, map.cols, 16, 8, TILE_EMPTY);
  set(map.tiles, map.cols, 16, 9, TILE_EMPTY);

  map.playerSpawn = { col: 14, row: 9 };
  map.targetSpawns = [{ col: 26, row: 9 }];
  return map;
}

function makeBlockPushMap() {
  const map = blankMap('block_push_map');
  addHorizontalLaneWalls(map, 7, 11, 1, 30);

  map.playerSpawn = { col: 10, row: 9 };
  map.targetSpawns = [{ col: 28, row: 9 }];

  set(map.tiles, map.cols, 13, 9, TILE_BLOCK);
  set(map.tiles, map.cols, 16, 9, TILE_BLOCK);

  for (let r = 8; r <= 10; r++) set(map.tiles, map.cols, 22, r, TILE_WALL);
  map.doors.push({ col: 22, row: 8, orientation: 'vertical', hingeSide: 'bottom' });
  set(map.tiles, map.cols, 22, 8, TILE_EMPTY);
  set(map.tiles, map.cols, 22, 9, TILE_EMPTY);

  return map;
}

function makeOcclusionMap() {
  const map = blankMap('occlusion_map');
  addHorizontalLaneWalls(map, 7, 11, 1, 30);

  map.playerSpawn = { col: 4, row: 9 };
  map.targetSpawns = [{ col: 28, row: 9 }];

  // Block is nearest blocker, then door, then wall behind.
  set(map.tiles, map.cols, 10, 9, TILE_BLOCK);

  for (let r = 8; r <= 10; r++) set(map.tiles, map.cols, 14, r, TILE_WALL);
  map.doors.push({ col: 14, row: 8, orientation: 'vertical', hingeSide: 'top' });
  set(map.tiles, map.cols, 14, 8, TILE_EMPTY);
  set(map.tiles, map.cols, 14, 9, TILE_EMPTY);

  set(map.tiles, map.cols, 20, 9, TILE_WALL);

  return map;
}

function makeSmokeDefaultMap() {
  const map = blankMap('smoke_default_map');

  for (let r = 2; r <= 15; r++) {
    set(map.tiles, map.cols, 10, r, TILE_WALL);
    set(map.tiles, map.cols, 21, r, TILE_WALL);
  }
  for (let c = 11; c <= 20; c++) {
    set(map.tiles, map.cols, c, 6, TILE_WALL);
    set(map.tiles, map.cols, c, 11, TILE_WALL);
  }

  map.doors.push({ col: 10, row: 8, orientation: 'vertical', hingeSide: 'top' });
  map.doors.push({ col: 21, row: 8, orientation: 'vertical', hingeSide: 'bottom' });
  map.doors.push({ col: 15, row: 6, orientation: 'horizontal', hingeSide: 'left' });
  map.doors.push({ col: 15, row: 11, orientation: 'horizontal', hingeSide: 'right' });

  set(map.tiles, map.cols, 10, 8, TILE_EMPTY);
  set(map.tiles, map.cols, 10, 9, TILE_EMPTY);
  set(map.tiles, map.cols, 21, 8, TILE_EMPTY);
  set(map.tiles, map.cols, 21, 9, TILE_EMPTY);
  set(map.tiles, map.cols, 15, 6, TILE_EMPTY);
  set(map.tiles, map.cols, 16, 6, TILE_EMPTY);
  set(map.tiles, map.cols, 15, 11, TILE_EMPTY);
  set(map.tiles, map.cols, 16, 11, TILE_EMPTY);

  set(map.tiles, map.cols, 7, 4, TILE_BLOCK);
  set(map.tiles, map.cols, 16, 8, TILE_BLOCK);
  set(map.tiles, map.cols, 24, 13, TILE_BLOCK);

  map.playerSpawn = { col: 5, row: 9 };
  map.targetSpawns = [
    { col: 4, row: 4 },
    { col: 15, row: 3 },
    { col: 26, row: 4 },
    { col: 15, row: 14 },
    { col: 26, row: 13 }
  ];

  return map;
}

const fixtures = {
  door_push_map: makeDoorPushMap(),
  block_push_map: makeBlockPushMap(),
  occlusion_map: makeOcclusionMap(),
  smoke_default_map: makeSmokeDefaultMap()
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, payload] of Object.entries(fixtures)) {
  const outPath = path.join(OUT_DIR, `${name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
}

console.log('Generated fixtures:', Object.keys(fixtures).join(', '));
