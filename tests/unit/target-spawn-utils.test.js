const TargetSpawnUtils = require('../../core/targetSpawnUtils.js');

describe('TargetSpawnUtils', () => {
  it('rejects spawn positions that overlap blockers or actors', () => {
    const base = {
      radius: 20,
      canvasWidth: 1280,
      canvasHeight: 720,
      walls: [],
      doorSegments: [],
      blocks: [],
      playerCircle: null,
      targetCircles: [],
      reservedCircles: []
    };

    expect(
      TargetSpawnUtils.isTargetSpawnValid({ x: 100, y: 100 }, {
        ...base,
        walls: [{ x1: 80, y1: 100, x2: 120, y2: 100 }]
      })
    ).toBe(false);

    expect(
      TargetSpawnUtils.isTargetSpawnValid({ x: 200, y: 200 }, {
        ...base,
        doorSegments: [{ x1: 180, y1: 200, x2: 220, y2: 200 }]
      })
    ).toBe(false);

    expect(
      TargetSpawnUtils.isTargetSpawnValid({ x: 300, y: 300 }, {
        ...base,
        blocks: [{ x: 290, y: 290, w: 30, h: 30 }]
      })
    ).toBe(false);

    expect(
      TargetSpawnUtils.isTargetSpawnValid({ x: 400, y: 400 }, {
        ...base,
        playerCircle: { x: 410, y: 400, radius: 12 }
      })
    ).toBe(false);

    expect(
      TargetSpawnUtils.isTargetSpawnValid({ x: 500, y: 500 }, {
        ...base,
        targetCircles: [{ x: 515, y: 500, radius: 20 }]
      })
    ).toBe(false);
  });

  it('refills using stable cyclic order and skips occupied spawns', () => {
    const spawnPoints = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 300, y: 100 }
    ];

    const first = TargetSpawnUtils.collectSpawnSelections({
      spawnPoints,
      startCursor: 0,
      desiredCount: 2,
      radius: 20,
      canvasWidth: 1280,
      canvasHeight: 720,
      walls: [],
      doorSegments: [],
      blocks: [],
      playerCircle: null,
      targetCircles: []
    });

    expect(first.selections.map((s) => s.index)).toEqual([0, 1]);
    expect(first.nextCursor).toBe(2);

    const refill = TargetSpawnUtils.collectSpawnSelections({
      spawnPoints,
      startCursor: first.nextCursor,
      desiredCount: 1,
      radius: 20,
      canvasWidth: 1280,
      canvasHeight: 720,
      walls: [],
      doorSegments: [],
      blocks: [],
      playerCircle: null,
      targetCircles: [{ x: 200, y: 100, radius: 20 }]
    });

    expect(refill.selections.map((s) => s.index)).toEqual([2]);
    expect(refill.nextCursor).toBe(0);
  });
});
