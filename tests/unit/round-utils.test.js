const RoundUtils = require('../../core/roundUtils.js');

describe('RoundUtils', () => {
  it('clamps step duration and expires exactly at round end', () => {
    expect(RoundUtils.getStepDurationMs(16.67, 5)).toBe(5);
    expect(RoundUtils.getRemainingMs(119999, 120000)).toBe(1);
    expect(RoundUtils.isExpired(119999, 120000)).toBe(false);
    expect(RoundUtils.isExpired(120000, 120000)).toBe(true);
  });

  it('formats countdown text for the HUD', () => {
    expect(RoundUtils.formatCountdown(120000)).toBe('2:00');
    expect(RoundUtils.formatCountdown(119000)).toBe('1:59');
    expect(RoundUtils.formatCountdown(0)).toBe('0:00');
  });
});
