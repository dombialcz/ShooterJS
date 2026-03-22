const Collision = require('../../utils/collision.js');
const DoorSystem = require('../../systems/doorSystem.js');
const VisibilityUtils = require('../../core/visibilityUtils.js');

global.Collision = Collision;
global.DoorSystem = DoorSystem;
global.VisibilityUtils = VisibilityUtils;

const EnemyPerceptionSystem = require('../../systems/enemyPerceptionSystem.js');

function makeEntity(components) {
  return {
    getComponent(name) {
      return components[name];
    }
  };
}

describe('EnemyPerceptionSystem', () => {
  function makeBaseState() {
    const enemyComponent = {
      type: 'melee',
      state: 'idle',
      isAlerted: false,
      hasLineOfSight: false,
      visionRange: 500,
      patrol: []
    };
    return {
      timeMs: 1000,
      walls: [],
      doors: [],
      blocks: [],
      player: makeEntity({
        transform: { x: 300, y: 100 },
        health: { current: 100, max: 100 }
      }),
      enemies: [makeEntity({
        transform: { x: 100, y: 100 },
        health: { current: 20, max: 20 },
        enemy: enemyComponent
      })]
    };
  }

  it('does not alert through wall/door/block occluders', () => {
    const withWall = makeBaseState();
    withWall.walls = [{ x1: 200, y1: 50, x2: 200, y2: 150 }];
    EnemyPerceptionSystem.update(withWall, 1 / 60);
    expect(withWall.enemies[0].getComponent('enemy').isAlerted).toBe(false);

    const withDoor = makeBaseState();
    withDoor.doors = [makeEntity({
      door: { hingeX: 200, hingeY: 50, width: 100, hingeAngle: Math.PI / 2, currentAngle: 0 }
    })];
    EnemyPerceptionSystem.update(withDoor, 1 / 60);
    expect(withDoor.enemies[0].getComponent('enemy').isAlerted).toBe(false);

    const withBlock = makeBaseState();
    withBlock.blocks = [makeEntity({
      transform: { x: 200, y: 100 },
      collision: { type: 'aabb', width: 40, height: 40, offsetX: -20, offsetY: -20 }
    })];
    EnemyPerceptionSystem.update(withBlock, 1 / 60);
    expect(withBlock.enemies[0].getComponent('enemy').isAlerted).toBe(false);
  });

  it('alerts enemy when player is in range with clear line of sight', () => {
    const state = makeBaseState();
    EnemyPerceptionSystem.update(state, 1 / 60);
    const enemy = state.enemies[0].getComponent('enemy');
    expect(enemy.hasLineOfSight).toBe(true);
    expect(enemy.isAlerted).toBe(true);
    expect(enemy.state).toBe('alerted');
  });
});
