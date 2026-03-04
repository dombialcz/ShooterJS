const { loadScripts } = require('../helpers/loadVanillaScripts');

describe('Collision utils', () => {
  it('detects segment vs AABB intersections', () => {
    const ctx = loadScripts(['utils/geometry.js', 'utils/collision.js']);
    const { Collision } = ctx;

    expect(Collision.segmentIntersectsAABB(0, 0, 10, 0, 4, -2, 3, 4)).toBe(true);
    expect(Collision.segmentIntersectsAABB(0, 0, 3, 0, 4, -2, 3, 4)).toBe(false);
  });

  it('circle vs AABB overlap handles corners', () => {
    const ctx = loadScripts(['utils/geometry.js', 'utils/collision.js']);
    const { Collision } = ctx;

    expect(Collision.circleAABB(5, 5, 3, 8, 8, 4, 4)).toBe(false);
    expect(Collision.circleAABB(8, 8, 3, 8, 8, 4, 4)).toBe(true);
  });
});
