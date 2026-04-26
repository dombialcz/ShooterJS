const { test, expect } = require('@playwright/test');
const { setActiveMap, selectFirstLevel } = require('../helpers/mapFixtures');

function makeOpenEnemyMap(name = 'enemy-test') {
  const cols = 32;
  const rows = 18;
  const tiles = new Array(cols * rows).fill(0);
  for (let col = 0; col < cols; col++) {
    tiles[col] = 1;
    tiles[(rows - 1) * cols + col] = 1;
  }
  for (let row = 0; row < rows; row++) {
    tiles[row * cols] = 1;
    tiles[row * cols + (cols - 1)] = 1;
  }
  return {
    version: 1,
    meta: { name },
    settings: { timeLimitMs: 120000, maxTargetsToKill: 1 },
    tileSize: 40,
    cols,
    rows,
    tiles,
    doors: [],
    playerSpawn: { col: 4, row: 9 },
    targetSpawns: [],
    enemies: []
  };
}

async function setInlineMap(page, map, id = 'inline-level') {
  await page.addInitScript(({ payload, levelId }) => {
    window.__testLevelCatalog = [
      {
        id: levelId,
        name: levelId,
        path: `${levelId}.json`
      }
    ];
    window.__testLevelMaps = {
      [levelId]: payload
    };
  }, { payload: map, levelId: id });
}

async function getState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function waitForCanvasPaint(page) {
  await page.waitForFunction(() => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    return pixel[3] !== 0;
  });
}

test.describe('Deterministic gameplay maps', () => {
  test('boot shows level menu and waits for selection', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('#levelMenu.visible');

    const hasGame = await page.evaluate(() => Boolean(window.game));
    expect(hasGame).toBe(false);

    const levelCount = await page.locator('#levelList .level-item').count();
    expect(levelCount).toBeGreaterThan(0);

    await expect(page.locator('#levelList .level-item').first()).toContainText('Static targets');
  });

  test('door push + springback behavior', async ({ page }) => {
    await setActiveMap(page, 'door_push_map');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');
    await page.evaluate(() => window.advanceTime(32));
    await waitForCanvasPaint(page);
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

    await waitForCanvasPaint(page);
    await expect(page).toHaveScreenshot('door_push_end.png');
  });

  test('block push movement and blocking', async ({ page }) => {
    await setActiveMap(page, 'block_push_map');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    await page.evaluate(() => window.advanceTime(32));
    await waitForCanvasPaint(page);
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

    await waitForCanvasPaint(page);
    await expect(page).toHaveScreenshot('block_push_end.png');
  });

  test('player is not trapped inside pushable blocks after sustained push', async ({ page }) => {
    await setActiveMap(page, 'block_push_map');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    const result = await page.evaluate(() => {
      function overlapCircleAABB(cx, cy, radius, aabb) {
        const closestX = Math.max(aabb.x, Math.min(cx, aabb.x + aabb.w));
        const closestY = Math.max(aabb.y, Math.min(cy, aabb.y + aabb.h));
        const dx = cx - closestX;
        const dy = cy - closestY;
        return dx * dx + dy * dy < radius * radius;
      }

      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          moveX: 1,
          moveY: 0,
          aimAngle: 0,
          isADS: false,
          isShooting: false
        }
      });

      window.advanceTime(2200, {
        skipInput: true,
        inputFrame: {
          moveX: 1,
          moveY: 0,
          aimAngle: 0,
          isADS: false,
          isShooting: false
        }
      });

      const afterPush = JSON.parse(window.render_game_to_text());
      const pushedX = afterPush.player.x;
      const playerRadius = 10;
      const overlappedAfterPush = afterPush.blocks.some((block) => overlapCircleAABB(afterPush.player.x, afterPush.player.y, playerRadius, block.aabb));

      window.advanceTime(700, {
        skipInput: true,
        inputFrame: {
          moveX: -1,
          moveY: 0,
          aimAngle: 0,
          isADS: false,
          isShooting: false
        }
      });

      const afterEscape = JSON.parse(window.render_game_to_text());
      const escapedX = afterEscape.player.x;
      const overlappedAfterEscape = afterEscape.blocks.some((block) => overlapCircleAABB(afterEscape.player.x, afterEscape.player.y, playerRadius, block.aabb));

      window.advanceTime(500, {
        skipInput: true,
        inputFrame: {
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          isADS: false,
          isShooting: false
        }
      });
      const settled = JSON.parse(window.render_game_to_text());
      const overlappedSettled = settled.blocks.some((block) => overlapCircleAABB(settled.player.x, settled.player.y, playerRadius, block.aabb));

      return {
        pushedX,
        escapedX,
        overlappedAfterPush,
        overlappedAfterEscape,
        overlappedSettled
      };
    });

    expect(result.escapedX).toBeLessThan(result.pushedX - 5);
    expect(result.overlappedAfterPush).toBe(false);
    expect(result.overlappedAfterEscape).toBe(false);
    expect(result.overlappedSettled).toBe(false);
  });

  test('occlusion ordering: block then door then wall', async ({ page }) => {
    await setActiveMap(page, 'occlusion_map');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    await page.evaluate(() => {
      const state = window.game.state;
      const player = state.player;
      const transform = player.getComponent('transform');
      const target = state.targets[0].getComponent('transform');
      const gun = player.getComponent('gun');
      const angle = Math.atan2(target.y - transform.y, target.x - transform.x);

      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          aimAngle: angle,
          isADS: true,
          isShooting: false,
          moveX: 0,
          moveY: 0
        }
      });
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
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          aimAngle: angle,
          isADS: true,
          isShooting: false,
          moveX: 0,
          moveY: 0
        }
      });
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
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          aimAngle: angle,
          isADS: true,
          isShooting: false,
          moveX: 0,
          moveY: 0
        }
      });
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

    await waitForCanvasPaint(page);
    await expect(page).toHaveScreenshot('occlusion_end.png');
  });

  test('ADS firing cone shrinks and reaches precise shots after 2s', async ({ page }) => {
    await setActiveMap(page, 'smoke_default_map');
    await page.goto('/index.html');
    await selectFirstLevel(page);
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

    await waitForCanvasPaint(page);
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

    await waitForCanvasPaint(page);
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
    expect(secondDeviation).toBeLessThan(0.12);
  });

  test('player moves slower while ADS is held', async ({ page }) => {
    await setActiveMap(page, 'smoke_default_map');
    await page.goto('/index.html');
    await selectFirstLevel(page);
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

  test('destroyed targets respawn after a delayed 10-20s window', async ({ page }) => {
    await setActiveMap(page, 'smoke_default_map');
    await page.goto('/index.html');
    await selectFirstLevel(page);
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

      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          moveX: 0,
          moveY: 0,
          aimAngle: input.aimAngle,
          isADS: true,
          isShooting: false
        }
      });
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

      const afterShotIds = state.targets.map((target) => target.id).sort((a, b) => a - b);
      const pendingAfterShot = state.pendingTargetRespawns.length;

      window.advanceTime(9000, {
        skipInput: true,
        inputFrame: {
          moveX: 0,
          moveY: 0,
          aimAngle: input.aimAngle,
          isADS: false,
          isShooting: false
        }
      });

      const aliveAt9s = state.targets.length;

      window.advanceTime(12000, {
        skipInput: true,
        inputFrame: {
          moveX: 0,
          moveY: 0,
          aimAngle: input.aimAngle,
          isADS: false,
          isShooting: false
        }
      });

      const afterDelayIds = state.targets.map((target) => target.id).sort((a, b) => a - b);
      return {
        beforeIds,
        afterShotIds,
        afterDelayIds,
        score: state.score,
        aliveAt9s,
        aliveAfterDelay: state.targets.length,
        targetCount: state.initialTargetCount,
        pendingAfterShot
      };
    });

    expect(result.score).toBe(10);
    expect(result.pendingAfterShot).toBe(1);
    expect(result.afterShotIds.length).toBe(result.targetCount - 1);
    expect(result.aliveAt9s).toBe(result.targetCount - 1);
    expect(result.aliveAfterDelay).toBe(result.targetCount);
    expect(result.beforeIds).not.toEqual(result.afterDelayIds);
  });

  test('time trial ends exactly when the countdown expires', async ({ page }) => {
    await setActiveMap(page, 'smoke_default_map');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    await page.evaluate(() => window.advanceTime(119000));
    const beforeExpiry = await getState(page);
    expect(beforeExpiry.round.isExpired).toBe(false);
    expect(beforeExpiry.isGameOver).toBe(false);
    expect(beforeExpiry.round.timeRemainingMs).toBeLessThanOrEqual(1000);
    expect(beforeExpiry.round.timeRemainingMs).toBeGreaterThanOrEqual(700);

    await page.evaluate(() => window.advanceTime(1000));
    const expired = await getState(page);
    expect(expired.round.isExpired).toBe(true);
    expect(expired.round.timeRemainingMs).toBe(0);
    expect(expired.isGameOver).toBe(true);

    const overlayVisible = await page.evaluate(() => document.getElementById('gameOver').classList.contains('visible'));
    expect(overlayVisible).toBe(true);
  });

  test('level completes when kill goal is reached before timer expires', async ({ page }) => {
    await setActiveMap(page, 'smoke_default_map');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    const result = await page.evaluate(() => {
      window.game.state.currentMapData.settings = window.game.state.currentMapData.settings || {};
      window.game.state.currentMapData.settings.maxTargetsToKill = 1;
      window.game.state.levelGoalTargets = 1;
      window.__setTargetsDestroyed(1);
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: {
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          isADS: false,
          isShooting: false
        }
      });
      return JSON.parse(window.render_game_to_text());
    });

    expect(result.round.isLevelComplete).toBe(true);
    expect(result.isGameOver).toBe(true);
  });

  test('victory area requires the player to extract after meeting the goal', async ({ page }) => {
    const map = makeOpenEnemyMap('extract-goal');
    map.settings.maxTargetsToKill = 1;
    map.victoryArea = { col: 10, row: 9, width: 2, height: 2 };
    map.targetSpawns = [{ col: 8, row: 9 }];

    await setInlineMap(page, map, 'extract-goal');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    const beforeExit = await page.evaluate(() => {
      window.__setTargetsDestroyed(1);
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false }
      });
      return JSON.parse(window.render_game_to_text());
    });
    expect(beforeExit.round.isLevelComplete).toBe(false);
    expect(beforeExit.round.hasReachedVictoryArea).toBe(false);

    const afterExit = await page.evaluate(() => {
      const transform = window.game.state.player.getComponent('transform');
      transform.x = 10 * 40 + 40;
      transform.y = 9 * 40 + 40;
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false }
      });
      return JSON.parse(window.render_game_to_text());
    });

    expect(afterExit.round.hasReachedVictoryArea).toBe(true);
    expect(afterExit.round.isLevelComplete).toBe(true);
    expect(afterExit.round.gameOverReason).toBe('level_complete');
  });

  test('enemy stays idle without LOS and alerts after LOS is restored', async ({ page }) => {
    const map = makeOpenEnemyMap('enemy-los-gate');
    map.settings.maxTargetsToKill = 1;
    for (let row = 7; row <= 11; row++) {
      map.tiles[row * map.cols + 7] = 1;
    }
    map.enemies = [
      {
        id: 'enemy-1',
        type: 'melee',
        spawn: { col: 10, row: 9 },
        visionRange: 600
      }
    ];

    await setInlineMap(page, map, 'enemy-los-gate');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    const before = await page.evaluate(() => {
      window.advanceTime(1200, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false }
      });
      return JSON.parse(window.render_game_to_text());
    });
    expect(before.enemies[0].alerted).toBe(false);

    const after = await page.evaluate(() => {
      const state = window.game.state;
      for (const entity of [...state.entities.values()]) {
        if (entity.type === 'wall') {
          state.entities.delete(entity.id);
        }
      }
      state.walls = [];
      window.advanceTime(300, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false }
      });
      return JSON.parse(window.render_game_to_text());
    });
    expect(after.enemies[0].alerted).toBe(true);
  });

  test('melee enemy chases and can kill player', async ({ page }) => {
    const map = makeOpenEnemyMap('enemy-melee-kill');
    map.enemies = [
      {
        id: 'enemy-1',
        type: 'melee',
        spawn: { col: 7, row: 9 },
        attackCooldownMs: 400,
        damage: 20,
        moveSpeed: 145,
        attackRange: 140
      }
    ];

    await setInlineMap(page, map, 'enemy-melee-kill');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');
    const snapshot = await page.evaluate(() => {
      window.advanceTime(7000, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false }
      });
      return JSON.parse(window.render_game_to_text());
    });

    expect(snapshot.isGameOver).toBe(true);
    expect(snapshot.round.gameOverReason).toBe('player_dead');
    expect(snapshot.player.health.current).toBe(0);
  });

  test('ranged enemy first shot misses, later shots can hit deterministically', async ({ page }) => {
    const map = makeOpenEnemyMap('enemy-ranged-miss');
    map.enemies = [
      {
        id: 'enemy-1',
        type: 'ranged',
        spawn: { col: 10, row: 9 },
        attackCooldownMs: 900,
        damage: 8,
        attackRange: 500
      }
    ];

    await setInlineMap(page, map, 'enemy-ranged-miss');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    const firstWindow = await page.evaluate(() => {
      window.advanceTime(500, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false }
      });
      return JSON.parse(window.render_game_to_text());
    });
    expect(firstWindow.player.health.current).toBe(100);

    const secondWindow = await page.evaluate(() => {
      window.advanceTime(9000, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false }
      });
      return JSON.parse(window.render_game_to_text());
    });
    expect(secondWindow.player.health.current).toBeLessThan(100);
  });

  test('enemy elimination counts toward level completion goal', async ({ page }) => {
    const map = makeOpenEnemyMap('enemy-goal');
    map.settings.maxTargetsToKill = 1;
    map.enemies = [
      {
        id: 'enemy-1',
        type: 'ranged',
        spawn: { col: 7, row: 9 },
        maxHealth: 15,
        attackCooldownMs: 3000
      }
    ];

    await setInlineMap(page, map, 'enemy-goal');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    const snapshot = await page.evaluate(() => {
      const state = window.game.state;
      const player = state.player;
      const transform = player.getComponent('transform');
      const gun = player.getComponent('gun');
      const enemyTransform = state.enemies[0].getComponent('transform');
      const angle = Math.atan2(enemyTransform.y - transform.y, enemyTransform.x - transform.x);
      gun.currentSpreadHalfAngleRad = 0;
      gun.adsStartedAtMs = state.timeMs || 0;

      window.advanceTime(32, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: angle, isADS: true, isShooting: false }
      });
      gun.lastShotTime = -1e9;
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: angle, isADS: true, isShooting: true }
      });
      window.advanceTime(32, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: angle, isADS: false, isShooting: false }
      });
      return JSON.parse(window.render_game_to_text());
    });

    expect(snapshot.targets.eliminations).toBe(1);
    expect(snapshot.round.isLevelComplete).toBe(true);
    expect(snapshot.isGameOver).toBe(true);
  });

  test('patrolling enemy follows waypoints then transitions to alert state on sighting player', async ({ page }) => {
    const map = makeOpenEnemyMap('enemy-patrol');
    map.playerSpawn = { col: 2, row: 2 };
    map.settings.maxTargetsToKill = 2;
    map.enemies = [
      {
        id: 'enemy-1',
        type: 'ranged',
        spawn: { col: 24, row: 9 },
        visionRange: 420,
        patrol: [
          { col: 24, row: 5 },
          { col: 27, row: 9 },
          { col: 24, row: 13 },
          { col: 21, row: 9 }
        ]
      }
    ];

    await setInlineMap(page, map, 'enemy-patrol');
    await page.goto('/index.html');
    await selectFirstLevel(page);
    await page.waitForFunction(() => typeof window.advanceTime === 'function');

    const patrolState = await page.evaluate(() => {
      window.advanceTime(1200, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false }
      });
      return JSON.parse(window.render_game_to_text());
    });
    expect(patrolState.enemies[0].state).toBe('patrolling');
    expect(Math.abs(patrolState.enemies[0].y - (9 * 40 + 20))).toBeGreaterThan(1);

    const alertedState = await page.evaluate(() => {
      const state = window.game.state;
      const enemy = state.enemies[0].getComponent('transform');
      const player = state.player.getComponent('transform');
      player.x = enemy.x - 80;
      player.y = enemy.y;
      window.advanceTime(400, {
        skipInput: true,
        inputFrame: { moveX: 0, moveY: 0, aimAngle: 0, isADS: false, isShooting: false }
      });
      return JSON.parse(window.render_game_to_text());
    });
    expect(alertedState.enemies[0].alerted).toBe(true);
    expect(alertedState.enemies[0].state).not.toBe('patrolling');
  });
});
