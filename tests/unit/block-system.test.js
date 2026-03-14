const BlockSystem = require('../../systems/blockSystem.js');

function makeEntity(components) {
  return {
    getComponent(name) {
      return components[name] || null;
    }
  };
}

function circleAABBOverlap(cx, cy, radius, aabb) {
  const closestX = Math.max(aabb.x, Math.min(cx, aabb.x + aabb.w));
  const closestY = Math.max(aabb.y, Math.min(cy, aabb.y + aabb.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

describe('BlockSystem player depenetration', () => {
  const originalConfig = global.CONFIG;
  const originalGeometry = global.Geometry;
  const originalMovementSystem = global.MovementSystem;

  beforeEach(() => {
    global.CONFIG = {
      CANVAS_WIDTH: 1280,
      CANVAS_HEIGHT: 720
    };
    global.Geometry = {
      clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }
    };
    global.MovementSystem = {
      resolveWallCollisions() {}
    };
  });

  afterAll(() => {
    global.CONFIG = originalConfig;
    global.Geometry = originalGeometry;
    global.MovementSystem = originalMovementSystem;
  });

  it('separates player from a single overlapping block in one pass', () => {
    const player = makeEntity({
      transform: { x: 100, y: 100 },
      collision: { type: 'circle', radius: 10 }
    });
    const block = makeEntity({
      transform: { x: 108, y: 100 },
      collision: { type: 'aabb', width: 20, height: 20, offsetX: -10, offsetY: -10 }
    });

    const gameState = {
      player,
      blocks: [block],
      walls: []
    };

    BlockSystem.resolvePlayerBlockCollisions(gameState);

    const playerTransform = player.getComponent('transform');
    const aabb = BlockSystem.getBlockAABB(block);
    expect(circleAABBOverlap(playerTransform.x, playerTransform.y, 10, aabb)).toBe(false);
  });

  it('separates player from multiple overlapping blocks within iteration cap', () => {
    const player = makeEntity({
      transform: { x: 120, y: 120 },
      collision: { type: 'circle', radius: 10 }
    });
    const blockA = makeEntity({
      transform: { x: 126, y: 120 },
      collision: { type: 'aabb', width: 20, height: 20, offsetX: -10, offsetY: -10 }
    });
    const blockB = makeEntity({
      transform: { x: 120, y: 126 },
      collision: { type: 'aabb', width: 20, height: 20, offsetX: -10, offsetY: -10 }
    });

    const gameState = {
      player,
      blocks: [blockA, blockB],
      walls: []
    };

    BlockSystem.resolvePlayerBlockCollisions(gameState);

    const playerTransform = player.getComponent('transform');
    expect(circleAABBOverlap(playerTransform.x, playerTransform.y, 10, BlockSystem.getBlockAABB(blockA))).toBe(false);
    expect(circleAABBOverlap(playerTransform.x, playerTransform.y, 10, BlockSystem.getBlockAABB(blockB))).toBe(false);
  });
});
