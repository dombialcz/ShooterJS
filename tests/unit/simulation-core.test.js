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
      entities: new Map(),
      player: {
        getComponent(name) {
          if (name === 'input') return this.input;
          if (name === 'transform') return this.transform;
          return null;
        },
        input: { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false },
        transform: { x: 1, y: 2, rotation: 0 }
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
      currentMapData: { version: 1, tileSize: 40, cols: 2, rows: 2, meta: { name: 'stable' } },
      entities: new Map(),
      walls: [],
      targets: [],
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
  });
});
