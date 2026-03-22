const { test, expect } = require('@playwright/test');
const { setActiveMap, selectFirstLevel } = require('../helpers/mapFixtures');

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

test('smoke map boots and exposes deterministic hooks', async ({ page }) => {
  await setActiveMap(page, 'smoke_default_map');
  await page.goto('/index.html');
  await selectFirstLevel(page);

  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(100));
  await waitForCanvasPaint(page);

  const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  expect(snapshot.player).toBeTruthy();
  expect(snapshot.doors.length).toBeGreaterThan(0);
  expect(snapshot.blocks.length).toBeGreaterThan(0);
  expect(snapshot.activeMap.name).toBe('smoke_default_map');
  expect(snapshot.targets.alive).toBe(snapshot.targets.targetCount);
  expect(snapshot.round.durationMs).toBe(120000);
  expect(snapshot.round.timeRemainingMs).toBeLessThanOrEqual(119900);
  expect(snapshot.round.timeRemainingMs).toBeGreaterThanOrEqual(119780);
  expect(snapshot.round.isExpired).toBe(false);

  await expect(page).toHaveScreenshot('smoke_default.png');
});

test('editor preview query boots directly into saved map', async ({ page }) => {
  await setActiveMap(page, 'smoke_default_map');
  await page.goto('/index.html?editorPreview=1');
  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.waitForFunction(() => Boolean(window.game));
  await page.evaluate(() => window.advanceTime(100));
  await waitForCanvasPaint(page);

  const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  expect(snapshot.player).toBeTruthy();
  expect(snapshot.activeMap.name).toBe('smoke_default_map');

  const isLevelMenuVisible = await page.evaluate(() => document.getElementById('levelMenu').classList.contains('visible'));
  expect(isLevelMenuVisible).toBe(false);
});
