const AStarPathfinding = require('../../core/aStarPathfinding.js');

describe('AStarPathfinding', () => {
  it('chooses deterministic path with tie-break ordering', () => {
    const grid = [
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, false, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true]
    ];

    const result = AStarPathfinding.findPath(grid, 0, 2, 4, 2, { maxExpansions: 200 });
    expect(result.reached).toBe(true);
    expect(result.path).toEqual([
      { col: 0, row: 2 },
      { col: 1, row: 2 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 3, row: 1 },
      { col: 4, row: 1 },
      { col: 4, row: 2 }
    ]);
  });

  it('honors expansion cap deterministically', () => {
    const grid = [
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true]
    ];
    const result = AStarPathfinding.findPath(grid, 0, 0, 4, 4, { maxExpansions: 1 });
    expect(result.reached).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.expansions).toBe(1);
  });
});
