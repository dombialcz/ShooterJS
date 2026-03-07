const ShootingSystem = require('../../systems/shootingSystem.js');

describe('ShootingSystem firing cone', () => {
  const originalConfig = global.CONFIG;

  beforeEach(() => {
    global.CONFIG = {
      FIRING_CONE_START_DEG: 20,
      FIRING_CONE_MIN_DEG: 0,
      FIRING_CONE_TIGHTEN_MS: 2000
    };
  });

  afterAll(() => {
    global.CONFIG = originalConfig;
  });

  function makePlayer() {
    const input = { aimAngle: 1.0, isADS: false, isShooting: false };
    const gun = {
      adsStartedAtMs: null,
      currentSpreadHalfAngleRad: (20 * Math.PI / 180) * 0.5
    };
    return {
      input,
      gun,
      getComponent(name) {
        if (name === 'input') return this.input;
        if (name === 'gun') return this.gun;
        return null;
      }
    };
  }

  it('produces deterministic RNG sequence for the same seed', () => {
    const stateA = { shotRngState: 0x12345678 };
    const stateB = { shotRngState: 0x12345678 };
    const seqA = [];
    const seqB = [];

    for (let i = 0; i < 5; i++) {
      seqA.push(ShootingSystem.nextDeterministicRandom(stateA));
      seqB.push(ShootingSystem.nextDeterministicRandom(stateB));
    }

    expect(seqA).toEqual(seqB);
  });

  it('shrinks spread linearly over time and reaches precise aim at 2s', () => {
    const player = makePlayer();
    const gameState = { timeMs: 0 };
    const startHalfRad = (20 * Math.PI / 180) * 0.5;

    player.input.isADS = true;
    ShootingSystem.updateFiringConeState(gameState, player);
    expect(player.gun.currentSpreadHalfAngleRad).toBeCloseTo(startHalfRad, 6);

    gameState.timeMs = 1000;
    ShootingSystem.updateFiringConeState(gameState, player);
    expect(player.gun.currentSpreadHalfAngleRad).toBeCloseTo(startHalfRad * 0.5, 6);

    gameState.timeMs = 2000;
    ShootingSystem.updateFiringConeState(gameState, player);
    expect(player.gun.currentSpreadHalfAngleRad).toBeCloseTo(0, 6);
  });

  it('resets spread when ADS is released', () => {
    const player = makePlayer();
    const gameState = { timeMs: 0 };
    const startHalfRad = (20 * Math.PI / 180) * 0.5;

    player.input.isADS = true;
    ShootingSystem.updateFiringConeState(gameState, player);

    gameState.timeMs = 1500;
    ShootingSystem.updateFiringConeState(gameState, player);
    expect(player.gun.currentSpreadHalfAngleRad).toBeLessThan(startHalfRad);

    player.input.isADS = false;
    ShootingSystem.updateFiringConeState(gameState, player);
    expect(player.gun.adsStartedAtMs).toBeNull();
    expect(player.gun.currentSpreadHalfAngleRad).toBeCloseTo(startHalfRad, 6);
  });
});
