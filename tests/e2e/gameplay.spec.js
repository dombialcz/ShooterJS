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
});
