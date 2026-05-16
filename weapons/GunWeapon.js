// Gun weapon factory

/**
 * Creates a gun weapon component.  All parameters are optional; defaults are
 * pulled from CONFIG so the factory works in both browser and Node test env.
 *
 * Field names are intentionally kept compatible with the ShootingSystem's
 * existing expectations (canShoot, lastShotTime, fireRate).
 */
function createGunWeapon(opts = {}) {
    const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
    const startSpreadHalfAngleRad = ((cfg.FIRING_CONE_START_DEG || 20) * Math.PI / 180) * 0.5;

    const base = createWeaponBase('gun', {
        damage: opts.damage ?? 15,
        range: opts.range ?? (cfg.VISION_RANGE || 600),
        attackCooldownMs: opts.attackCooldownMs ?? (cfg.GUN_FIRE_RATE || 200)
    });

    return Object.assign(base, {
        length: opts.length ?? (cfg.GUN_LENGTH || 20),
        width: opts.width ?? (cfg.GUN_WIDTH || 8),
        offsetX: opts.offsetX ?? (cfg.GUN_OFFSET_X || 15),
        offsetY: opts.offsetY ?? 0,
        color: opts.color ?? (cfg.GUN_COLOR || '#1a1a1a'),
        // ShootingSystem-compatible field names
        canShoot: true,
        lastShotTime: 0,
        fireRate: opts.attackCooldownMs ?? (cfg.GUN_FIRE_RATE || 200),
        // ADS / spread state
        adsStartedAtMs: null,
        currentSpreadHalfAngleRad: startSpreadHalfAngleRad
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createGunWeapon };
}
