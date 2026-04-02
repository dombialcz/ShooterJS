const EnemyCombatSystem = require('../../systems/enemyCombatSystem.js');

function makeEntity(components) {
  return {
    getComponent(name) {
      return components[name];
    }
  };
}

describe('EnemyCombatSystem', () => {
  beforeEach(() => {
    global.CONFIG = {
      ENEMY_SHOT_MISS_MAX_OFFSET_RAD: 0.34
    };
    global.createTracerLine = (x1, y1, x2, y2, color) => {
      const lifetime = { createdAt: 0, duration: 100 };
      return {
        type: 'tracer',
        getComponent(name) {
          if (name === 'lifetime') return lifetime;
          if (name === 'tracer') return { x1, y1, x2, y2, color };
          return null;
        }
      };
    };
    global.VisibilityUtils = {
      findFirstObstacleHit() {
        return null;
      }
    };
  });

  it('forces first ranged shot miss, then uses deterministic 50% miss rule', () => {
    const playerHealth = { current: 100, max: 100 };
    const enemy = {
      type: 'ranged',
      pendingAttack: true,
      attackRange: 500,
      attackCooldownMs: 200,
      lastAttackAtMs: Number.NEGATIVE_INFINITY,
      damage: 10,
      firstShotMustMiss: true,
      shotRngState: 1,
      laserSightStartMs: null
    };

    const gameState = {
      timeMs: 1000,
      walls: [],
      doors: [],
      blocks: [],
      entities: new Map(),
      enemies: [makeEntity({
        transform: { x: 0, y: 0 },
        collision: { type: 'circle', radius: 10 },
        health: { current: 30, max: 30 },
        enemy
      })],
      player: makeEntity({
        transform: { x: 200, y: 0 },
        collision: { type: 'circle', radius: 10 },
        health: playerHealth
      }),
      addEntity() {}
    };

    // First update starts the laser sight windup - nothing fires yet
    EnemyCombatSystem.update(gameState, 1 / 60);
    expect(playerHealth.current).toBe(100);
    expect(enemy.firstShotMustMiss).toBe(true);

    // After 300ms windup the first shot fires and must miss
    enemy.pendingAttack = true;
    gameState.timeMs += 300;
    EnemyCombatSystem.update(gameState, 1 / 60);
    expect(playerHealth.current).toBe(100);
    expect(enemy.firstShotMustMiss).toBe(false);

    // Start second windup (past cooldown)
    enemy.pendingAttack = true;
    enemy.shotRngState = 682; // first random after this seed is > 0.5 (hit branch)
    gameState.timeMs += 250;
    EnemyCombatSystem.update(gameState, 1 / 60);

    // After another 300ms the second shot fires and should hit
    enemy.pendingAttack = true;
    gameState.timeMs += 300;
    EnemyCombatSystem.update(gameState, 1 / 60);
    expect(playerHealth.current).toBe(90);
  });

  it('replays ranged hit/miss sequence deterministically for the same seed', () => {
    const run = () => {
      const playerHealth = { current: 100, max: 100 };
      const enemy = {
        type: 'ranged',
        pendingAttack: false,
        attackRange: 500,
        attackCooldownMs: 100,
        lastAttackAtMs: Number.NEGATIVE_INFINITY,
        damage: 10,
        firstShotMustMiss: true,
        shotRngState: 2000,
        laserSightStartMs: null
      };

      const gameState = {
        timeMs: 0,
        walls: [],
        doors: [],
        blocks: [],
        entities: new Map(),
        enemies: [makeEntity({
          transform: { x: 0, y: 0 },
          collision: { type: 'circle', radius: 10 },
          health: { current: 30, max: 30 },
          enemy
        })],
        player: makeEntity({
          transform: { x: 200, y: 0 },
          collision: { type: 'circle', radius: 10 },
          health: playerHealth
        }),
        addEntity() {}
      };

      for (let i = 0; i < 6; i++) {
        enemy.pendingAttack = true;
        gameState.timeMs += 150;
        EnemyCombatSystem.update(gameState, 1 / 60);
      }

      return {
        hp: playerHealth.current,
        rng: enemy.shotRngState
      };
    };

    expect(run()).toEqual(run());
  });
});
