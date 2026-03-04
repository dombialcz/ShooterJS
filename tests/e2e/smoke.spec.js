const { test, expect } = require('@playwright/test');
const { setActiveMap } = require('../helpers/mapFixtures');

test('smoke map boots and exposes deterministic hooks', async ({ page }) => {
  await setActiveMap(page, 'smoke_default_map');
  await page.goto('/index.html');

  await page.waitForFunction(() => typeof window.advanceTime === 'function');
  await page.evaluate(() => window.advanceTime(100));

  const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  expect(snapshot.player).toBeTruthy();
  expect(snapshot.doors.length).toBeGreaterThan(0);
  expect(snapshot.blocks.length).toBeGreaterThan(0);
  expect(snapshot.activeMap.name).toBe('smoke_default_map');

  await expect(page).toHaveScreenshot('smoke_default.png');
});
