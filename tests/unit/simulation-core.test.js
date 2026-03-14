const SimulationCore = require('../../core/simulationCore.js');

describe('SimulationCore', () => {
  it('replays deterministic updates with same input stream', () => {
    const makeState = () => ({
      isPaused: false,
      isGameOver: false,
      score: 0,
      walls: [],
      doors: [],
      blocks: [],
      targets: [],
      currentMapData: { version: 1, tileSize: 40, cols: 2, rows: 2, meta: { name: 'test' } },
      shotRngState: 0x12345678,
      roundDurationMs: 120000,
      roundTimeRemainingMs: 120000,
      initialTargetCount: 0,
      entities: new Map(),
      player: {
        getComponent(name) {
          if (name === 'input') return this.input;
          if (name === 'transform') return this.transform;
          if (name === 'gun') return this.gun;
          if (name === 'playerState') return this.playerState;
          return null;
        },
        input: { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false },
        transform: { x: 1, y: 2, rotation: 0 },
        gun: { adsStartedAtMs: null, currentSpreadHalfAngleRad: 0.1 },
        playerState: { isADSActive: false, movementSpeedMultiplier: 1 }
      }
    });

    const systems = {
      InputSystem: {
        update(state, dt) {
          state.player.transform.x += state.player.input.moveX * dt * 10;
          state.player.transform.y += state.player.input.moveY * dt * 10;
        }
      }
    };

    const run = () => {
      const state = makeState();
      for (let i = 0; i < 120; i++) {
        SimulationCore.stepSimulation(state, 1 / 60, {
          systems,
          inputFrame: { moveX: 1, moveY: 0.5 }
        });
      }
      return SimulationCore.serializeGameState(state);
    };

    const a = run();
    const b = run();
    expect(a).toEqual(b);
  });

  it('serializes blocks and doors in stable id order', () => {
    const mkEntity = (id, comps) => ({ id, getComponent: (n) => comps[n] });
    const state = {
      isPaused: false,
      isGameOver: false,
      score: 0,
      roundDurationMs: 120000,
      roundTimeRemainingMs: 45000,
      initialTargetCount: 3,
      currentMapData: { version: 1, tileSize: 40, cols: 2, rows: 2, meta: { name: 'stable' } },
      entities: new Map(),
      walls: [],
      targets: [],
      shotRngState: 42,
      player: null,
      doors: [
        mkEntity(12, { door: { hingeX: 0, hingeY: 0, currentAngle: 0.1, angularVelocity: 0.2 } }),
        mkEntity(7, { door: { hingeX: 0, hingeY: 0, currentAngle: 0.2, angularVelocity: 0.4 } })
      ],
      blocks: [
        mkEntity(5, {
          transform: { x: 10, y: 20 },
          collision: { type: 'aabb', width: 4, height: 4, offsetX: -2, offsetY: -2 },
          block: { vx: 0, vy: 0 }
        }),
        mkEntity(3, {
          transform: { x: 30, y: 20 },
          collision: { type: 'aabb', width: 4, height: 4, offsetX: -2, offsetY: -2 },
          block: { vx: 0, vy: 0 }
        })
      ]
    };

    const snapshot = SimulationCore.serializeGameState(state);
    expect(snapshot.doors.map((d) => d.id)).toEqual([7, 12]);
    expect(snapshot.blocks.map((b) => b.id)).toEqual([3, 5]);
    expect(snapshot.targets.targetCount).toBe(3);
    expect(snapshot.round.timeRemainingMs).toBe(45000);
    expect(snapshot.shotRngState).toBe(42);
  });

  it('serializes player firing cone state for deterministic debug output', () => {
    const state = {
      isPaused: false,
      isGameOver: false,
      score: 0,
      timeMs: 1000,
      shotRngState: 99,
      roundDurationMs: 120000,
      roundTimeRemainingMs: 119000,
      initialTargetCount: 5,
      currentMapData: { version: 1, tileSize: 40, cols: 2, rows: 2, meta: { name: 'stable' } },
      entities: new Map(),
      walls: [],
      targets: [],
      doors: [],
      blocks: [],
      player: {
        getComponent(name) {
          if (name === 'transform') return { x: 10, y: 20, rotation: 1.2 };
          if (name === 'input') return { moveX: 0, moveY: 0, aimAngle: 1.2, isADS: true, isShooting: false };
          if (name === 'physics') return { vx: 0, vy: 0 };
          if (name === 'gun') return { adsStartedAtMs: 0, currentSpreadHalfAngleRad: 0.05 };
          if (name === 'playerState') return { isADSActive: true, movementSpeedMultiplier: 0.55 };
          return null;
        }
      }
    };

    global.CONFIG = global.CONFIG || {};
    global.CONFIG.FIRING_CONE_TIGHTEN_MS = 2000;

    const snapshot = SimulationCore.serializeGameState(state);
    expect(snapshot.player.firingCone.halfAngleRad).toBeCloseTo(0.05, 4);
    expect(snapshot.player.firingCone.tightenProgress).toBeCloseTo(0.5, 4);
    expect(snapshot.player.movementSpeedMultiplier).toBeCloseTo(0.55, 4);
    expect(snapshot.round.durationMs).toBe(120000);
    expect(snapshot.round.timeRemainingMs).toBe(119000);
    expect(snapshot.round.isExpired).toBe(false);
    expect(snapshot.targets.targetCount).toBe(5);
    expect(snapshot.shotRngState).toBe(99);
  });

  it('applies ADS movement toggle to player state from deterministic input frames', () => {
    global.CONFIG = global.CONFIG || {};
    global.CONFIG.PLAYER_ADS_SPEED_MULTIPLIER = 0.55;

    const playerState = { isADSActive: false, movementSpeedMultiplier: 1 };
    const input = { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false };
    const state = {
      player: {
        getComponent(name) {
          if (name === 'input') return input;
          if (name === 'playerState') return playerState;
          return null;
        }
      }
    };

    SimulationCore.applyInputFrame(state, { isADS: true });
    expect(playerState.isADSActive).toBe(true);
    expect(playerState.movementSpeedMultiplier).toBeCloseTo(0.55, 4);

    SimulationCore.applyInputFrame(state, { isADS: false });
    expect(playerState.isADSActive).toBe(false);
    expect(playerState.movementSpeedMultiplier).toBe(1);
  });

  it('preserves the release-shot input pulse across deterministic input frames', () => {
    const input = { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false };
    const state = {
      player: {
        getComponent(name) {
          if (name === 'input') return input;
          return null;
        }
      }
    };

    SimulationCore.applyInputFrame(state, { aimAngle: 0.75, isADS: true, isShooting: false });
    expect(input.aimAngle).toBeCloseTo(0.75, 4);
    expect(input.isADS).toBe(true);
    expect(input.isShooting).toBe(false);

    SimulationCore.applyInputFrame(state, { isADS: true, isShooting: true });
    expect(input.isADS).toBe(true);
    expect(input.isShooting).toBe(true);

    SimulationCore.applyInputFrame(state, { isADS: false, isShooting: false });
    expect(input.isADS).toBe(false);
    expect(input.isShooting).toBe(false);
  });
});
