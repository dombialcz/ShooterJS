const { loadScripts } = require('../helpers/loadVanillaScripts');

function makeEntity(id, type, components) {
  return {
    id,
    type,
    getComponent(name) {
      return components[name];
    }
  };
}

describe('DoorSystem invariants', () => {
  it('clamps angle to max swing range', () => {
    const ctx = loadScripts([
      'utils/geometry.js',
      'utils/collision.js',
      'systems/doorSystem.js'
    ]);

    const door = {
      hingeX: 100,
      hingeY: 100,
      width: 60,
      hingeAngle: 0,
      currentAngle: 10,
      angularVelocity: 0,
      maxSwingAngle: Math.PI * 0.45,
      springStrength: 3,
      damping: 0.92
    };

    const state = {
      player: makeEntity(1, 'player', {
        transform: { x: 20, y: 20 },
        collision: { type: 'circle', radius: 10 }
      }),
      entities: new Map([[2, makeEntity(2, 'door', { door })]])
    };

    ctx.DoorSystem.update(state, 1 / 60);
    expect(Math.abs(door.currentAngle)).toBeLessThanOrEqual(door.maxSwingAngle);
  });

  it('springs angle back toward zero over time', () => {
    const ctx = loadScripts([
      'utils/geometry.js',
      'utils/collision.js',
      'systems/doorSystem.js'
    ]);

    const door = {
      hingeX: 100,
      hingeY: 100,
      width: 60,
      hingeAngle: 0,
      currentAngle: 0.4,
      angularVelocity: 0,
      maxSwingAngle: Math.PI * 0.45,
      springStrength: 3,
      damping: 0.92
    };

    const state = {
      player: makeEntity(1, 'player', {
        transform: { x: 20, y: 20 },
        collision: { type: 'circle', radius: 10 }
      }),
      entities: new Map([[2, makeEntity(2, 'door', { door })]])
    };

    const start = Math.abs(door.currentAngle);
    for (let i = 0; i < 120; i++) {
      ctx.DoorSystem.update(state, 1 / 60);
    }
    expect(Math.abs(door.currentAngle)).toBeLessThan(start);
  });
});
