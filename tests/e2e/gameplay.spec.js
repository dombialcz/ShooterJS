const { test, expect } = require('@playwright/test');
const { setActiveMap } = require('../helpers/mapFixtures');

async function getState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

test.describe('Deterministic gameplay maps', () => {
  test('door push + springback behavior', async ({ page }) => {
    await setActiveMap(page, 'door_push_map');
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    await page.evaluate(() => window.advanceTime(32));
    await expect(page).toHaveScreenshot('door_push_start.png');

    const startState = await getState(page);
    const startAngle = startState.doors[0].currentAngle;

    await page.keyboard.down('KeyD');
    await page.evaluate(() => window.advanceTime(900));
    await page.keyboard.up('KeyD');

    const pushedState = await getState(page);
    expect(Math.abs(pushedState.doors[0].currentAngle)).toBeGreaterThan(Math.abs(startAngle) + 0.03);

    await page.evaluate(() => window.advanceTime(1400));
    const settledState = await getState(page);
    expect(Math.abs(settledState.doors[0].currentAngle)).toBeLessThan(Math.abs(pushedState.doors[0].currentAngle));

    await expect(page).toHaveScreenshot('door_push_end.png');
  });

  test('block push movement and blocking', async ({ page }) => {
    await setActiveMap(page, 'block_push_map');
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    await page.evaluate(() => window.advanceTime(32));
    await expect(page).toHaveScreenshot('block_push_start.png');

    const stateA = await getState(page);
    const blocksA = stateA.blocks;
    const firstBlockA = blocksA[0];
    const secondBlockA = blocksA[1];

    await page.keyboard.down('KeyD');
    await page.evaluate(() => window.advanceTime(1600));
    await page.keyboard.up('KeyD');

    const stateB = await getState(page);
    const firstBlockB = stateB.blocks.find((b) => b.id === firstBlockA.id);
    const secondBlockB = stateB.blocks.find((b) => b.id === secondBlockA.id);

    expect(firstBlockB.x).toBeGreaterThan(firstBlockA.x + 1);
    expect(firstBlockB.aabb.x + firstBlockB.aabb.w).toBeLessThanOrEqual(secondBlockB.aabb.x + 0.5);

    await expect(page).toHaveScreenshot('block_push_end.png');
  });

  test('occlusion ordering: block then door then wall', async ({ page }) => {
    await setActiveMap(page, 'occlusion_map');
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    await page.evaluate(() => {
      const state = window.game.state;
      const player = state.player;
      const transform = player.getComponent('transform');
      const target = state.targets[0].getComponent('transform');
      const input = player.getComponent('input');
      const gun = player.getComponent('gun');

      input.aimAngle = Math.atan2(target.y - transform.y, target.x - transform.x);
      input.isADS = true;
      input.isShooting = true;
      gun.lastShotTime = -1e9;
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          aimAngle: input.aimAngle,
          isADS: true,
          isShooting: true,
          moveX: 0,
          moveY: 0
        }
      });
    });

    const hit1 = await getState(page);
    expect(hit1.latestTracer).not.toBeNull();
    const firstHitX = hit1.latestTracer.x2;

    await page.evaluate(() => {
      const state = window.game.state;
      for (const block of [...state.blocks]) {
        state.entities.delete(block.id);
      }
      state.blocks = [];
      window.advanceTime(32, { skipInput: true, inputFrame: { isADS: false, isShooting: false } });
    });

    await page.evaluate(() => {
      const state = window.game.state;
      const player = state.player;
      const transform = player.getComponent('transform');
      const target = state.targets[0].getComponent('transform');
      const angle = Math.atan2(target.y - transform.y, target.x - transform.x);
      const gun = player.getComponent('gun');
      gun.lastShotTime = -1e9;
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          aimAngle: angle,
          isADS: true,
          isShooting: true,
          moveX: 0,
          moveY: 0
        }
      });
    });

    const hit2 = await getState(page);
    const secondHitX = hit2.latestTracer.x2;
    expect(secondHitX).toBeGreaterThan(firstHitX + 40);

    await page.evaluate(() => {
      const door = window.game.state.doors[0].getComponent('door');
      door.currentAngle = Math.PI / 2;
      door.angularVelocity = 0;
      window.advanceTime(32, { skipInput: true, inputFrame: { isADS: false, isShooting: false } });
    });

    await page.evaluate(() => {
      const state = window.game.state;
      const player = state.player;
      const transform = player.getComponent('transform');
      const target = state.targets[0].getComponent('transform');
      const angle = Math.atan2(target.y - transform.y, target.x - transform.x);
      const gun = player.getComponent('gun');
      gun.lastShotTime = -1e9;
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          aimAngle: angle,
          isADS: true,
          isShooting: true,
          moveX: 0,
          moveY: 0
        }
      });
    });

    const hit3 = await getState(page);
    const thirdHitX = hit3.latestTracer.x2;
    expect(thirdHitX).toBeGreaterThan(secondHitX + 10);

    await expect(page).toHaveScreenshot('occlusion_end.png');
  });

  test('ADS firing cone shrinks and reaches precise shots after 2s', async ({ page }) => {
    await setActiveMap(page, 'smoke_default_map');
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    await page.evaluate(() => {
      const state = window.game.state;
      for (const entity of [...state.entities.values()]) {
        if (entity.type === 'wall' || entity.type === 'door' || entity.type === 'block') {
          state.entities.delete(entity.id);
        }
      }
      state.walls = [];
      state.doors = [];
      state.blocks = [];
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          isADS: true,
          isShooting: false
        }
      });
    });

    await expect(page).toHaveScreenshot('firing_cone_wide.png');

    const firstDeviation = await page.evaluate(() => {
      const state = window.game.state;
      const player = state.player;
      const gun = player.getComponent('gun');
      gun.lastShotTime = -1e9;
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          isADS: true,
          isShooting: true
        }
      });

      let latestTracer = null;
      for (const entity of state.entities.values()) {
        if (entity.type !== 'tracer') continue;
        if (!latestTracer || entity.id > latestTracer.id) latestTracer = entity;
      }
      if (!latestTracer) return null;
      const tracer = latestTracer.getComponent('tracer');
      const angle = Math.atan2(tracer.y2 - tracer.y1, tracer.x2 - tracer.x1);
      return Math.abs(angle);
    });

    expect(firstDeviation).not.toBeNull();
    expect(firstDeviation).toBeGreaterThan(0.001);

    await page.evaluate(() => {
      window.advanceTime(2000, {
        skipInput: true,
        inputFrame: {
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          isADS: true,
          isShooting: false
        }
      });
    });

    await expect(page).toHaveScreenshot('firing_cone_tight.png');

    const secondDeviation = await page.evaluate(() => {
      const state = window.game.state;
      const player = state.player;
      const gun = player.getComponent('gun');
      gun.lastShotTime = -1e9;
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          isADS: true,
          isShooting: true
        }
      });

      let latestTracer = null;
      for (const entity of state.entities.values()) {
        if (entity.type !== 'tracer') continue;
        if (!latestTracer || entity.id > latestTracer.id) latestTracer = entity;
      }
      if (!latestTracer) return null;
      const tracer = latestTracer.getComponent('tracer');
      const angle = Math.atan2(tracer.y2 - tracer.y1, tracer.x2 - tracer.x1);
      return Math.abs(angle);
    });

    expect(secondDeviation).not.toBeNull();
    expect(secondDeviation).toBeLessThan(1e-6);
  });

  test('player moves slower while ADS is held', async ({ page }) => {
    await setActiveMap(page, 'smoke_default_map');
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    const distances = await page.evaluate(() => {
      function resetToSpawn() {
        const state = window.game.state;
        const spawn = state.currentMapData.playerSpawn;
        const tile = state.currentMapData.tileSize;
        const transform = state.player.getComponent('transform');
        const physics = state.player.getComponent('physics');
        const input = state.player.getComponent('input');
        const playerState = state.player.getComponent('playerState');

        transform.x = spawn.col * tile + tile / 2;
        transform.y = spawn.row * tile + tile / 2;
        physics.vx = 0;
        physics.vy = 0;
        input.moveX = 0;
        input.moveY = 0;
        input.isADS = false;
        input.isShooting = false;
        playerState.isADSActive = false;
        playerState.movementSpeedMultiplier = 1;
      }

      resetToSpawn();
      const state = window.game.state;
      const startX = state.player.getComponent('transform').x;

      window.advanceTime(1000, {
        skipInput: true,
        inputFrame: {
          moveX: 1,
          moveY: 0,
          aimAngle: 0,
          isADS: false,
          isShooting: false
        }
      });
      const normalX = state.player.getComponent('transform').x;
      const normalMultiplier = JSON.parse(window.render_game_to_text()).player.movementSpeedMultiplier;

      resetToSpawn();
      window.advanceTime(1000, {
        skipInput: true,
        inputFrame: {
          moveX: 1,
          moveY: 0,
          aimAngle: 0,
          isADS: true,
          isShooting: false
        }
      });
      const adsX = state.player.getComponent('transform').x;
      const adsMultiplier = JSON.parse(window.render_game_to_text()).player.movementSpeedMultiplier;

      return {
        normalDistance: normalX - startX,
        adsDistance: adsX - startX,
        normalMultiplier,
        adsMultiplier
      };
    });

    expect(distances.normalMultiplier).toBe(1);
    expect(distances.adsMultiplier).toBeCloseTo(0.55, 2);
    expect(distances.adsDistance).toBeLessThan(distances.normalDistance * 0.7);
  });

  test('destroyed targets are refilled back to the intended concurrent count', async ({ page }) => {
    await setActiveMap(page, 'smoke_default_map');
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    const result = await page.evaluate(() => {
      window.advanceTime(32);
      const state = window.game.state;
      const beforeIds = state.targets.map((target) => target.id).sort((a, b) => a - b);
      const player = state.player;
      const transform = player.getComponent('transform');
      const input = player.getComponent('input');
      const gun = player.getComponent('gun');
      const targetTransform = state.targets[0].getComponent('transform');

      input.aimAngle = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x);
      gun.lastShotTime = -1e9;

      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          moveX: 0,
          moveY: 0,
          aimAngle: input.aimAngle,
          isADS: true,
          isShooting: true
        }
      });

      const afterIds = state.targets.map((target) => target.id).sort((a, b) => a - b);
      return {
        beforeIds,
        afterIds,
        score: state.score,
        alive: state.targets.length,
        targetCount: state.initialTargetCount
      };
    });

    expect(result.score).toBe(10);
    expect(result.alive).toBe(result.targetCount);
    expect(result.beforeIds).not.toEqual(result.afterIds);
  });

  test('time trial ends exactly when the countdown expires', async ({ page }) => {
    await setActiveMap(page, 'smoke_default_map');
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    await page.evaluate(() => window.advanceTime(119000));
    const beforeExpiry = await getState(page);
    expect(beforeExpiry.round.isExpired).toBe(false);
    expect(beforeExpiry.isGameOver).toBe(false);
    expect(beforeExpiry.round.timeRemainingMs).toBe(1000);

    await page.evaluate(() => window.advanceTime(1000));
    const expired = await getState(page);
    expect(expired.round.isExpired).toBe(true);
    expect(expired.round.timeRemainingMs).toBe(0);
    expect(expired.isGameOver).toBe(true);

    const overlayVisible = await page.evaluate(() => document.getElementById('gameOver').classList.contains('visible'));
    expect(overlayVisible).toBe(true);
  });
});
