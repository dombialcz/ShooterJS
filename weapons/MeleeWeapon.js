// Melee weapon factory

/**
 * Creates a melee weapon component for close-range attacks.
 */
function createMeleeWeapon(opts = {}) {
    const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};

    const base = createWeaponBase('melee', {
        damage: opts.damage ?? (cfg.MELEE_DAMAGE || 35),
        range: opts.range ?? (cfg.MELEE_RANGE || 60),
        attackCooldownMs: opts.attackCooldownMs ?? (cfg.MELEE_COOLDOWN_MS || 600)
    });

    return Object.assign(base, {
        length: opts.length ?? (cfg.MELEE_LENGTH || 28),
        width: opts.width ?? (cfg.MELEE_WIDTH || 6),
        color: opts.color ?? (cfg.MELEE_COLOR || '#888888'),
        // Swing animation state
        swingStartMs: null,
        swingDurationMs: opts.swingDurationMs ?? (cfg.MELEE_SWING_DURATION_MS || 250)
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createMeleeWeapon };
}
