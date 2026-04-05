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
      ENEMY_SHOT_MISS_MAX_OFFSET_RAD: 0.34,
      ENEMY_AIM_UPDATE_INTERVAL_MS: 100
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
      laserSightStartMs: null,
      aimAngle: null,
      lastAimUpdateMs: null
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
    enemy.shotRngState = 1; // aim updates at windup-start and fire-time both roll >= 0.5 → hit
    gameState.timeMs += 250;
    EnemyCombatSystem.update(gameState, 1 / 60);

    // After another 300ms the second shot fires and should hit
    enemy.pendingAttack = true;
    gameState.timeMs += 300;
    EnemyCombatSystem.update(gameState, 1 / 60);
    expect(playerHealth.current).toBe(90);
  });

  it('updates aim direction every 100ms during windup using yellow warning laser', () => {
    const enemy = {
      type: 'ranged',
      pendingAttack: true,
      attackRange: 500,
      attackCooldownMs: 200,
      lastAttackAtMs: Number.NEGATIVE_INFINITY,
      damage: 10,
      firstShotMustMiss: false,
      shotRngState: 1,
      laserSightStartMs: null,
      aimAngle: null,
      lastAimUpdateMs: null
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
        health: { current: 100, max: 100 }
      }),
      addEntity() {}
    };

    // First update: starts windup and immediately computes first aim
    EnemyCombatSystem.update(gameState, 1 / 60);
    expect(enemy.laserSightStartMs).toBe(1000);
    expect(enemy.aimAngle).not.toBeNull();
    expect(enemy.lastAimUpdateMs).toBe(1000);
    const firstAimAngle = enemy.aimAngle;

    // 50ms later: still in windup, too soon for another aim update (< 100ms interval)
    enemy.pendingAttack = true;
    gameState.timeMs += 50;
    EnemyCombatSystem.update(gameState, 1 / 60);
    expect(enemy.laserSightStartMs).toBe(1000);
    expect(enemy.aimAngle).toBe(firstAimAngle); // unchanged - interval not yet reached

    // 100ms after last update: aim is re-randomized
    enemy.pendingAttack = true;
    gameState.timeMs += 50; // now 100ms since lastAimUpdateMs
    EnemyCombatSystem.update(gameState, 1 / 60);
    expect(enemy.lastAimUpdateMs).toBe(1100);
    // aimAngle may or may not differ from firstAimAngle depending on RNG, but it was re-evaluated
    expect(enemy.laserSightStartMs).toBe(1000); // still in windup (only 100ms elapsed)

    // After full 300ms windup: fires using the last computed aim angle
    enemy.pendingAttack = true;
    gameState.timeMs += 200; // now 300ms since windup start
    EnemyCombatSystem.update(gameState, 1 / 60);
    expect(enemy.laserSightStartMs).toBeNull(); // windup cleared after firing
    expect(enemy.aimAngle).toBeNull();          // aim cleared after firing
    expect(enemy.lastAimUpdateMs).toBeNull();   // timestamp cleared after firing
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
        laserSightStartMs: null,
        aimAngle: null,
        lastAimUpdateMs: null
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
