// Base weapon factory – shared state for all weapon types

/**
 * Creates a plain-object weapon base with the common fields every weapon needs.
 * @param {string} type   - Unique weapon-type identifier ('gun' | 'melee' | …)
 * @param {object} opts
 * @param {number} [opts.damage=0]           - Damage dealt per successful hit
 * @param {number} [opts.range=0]            - Maximum attack reach in pixels
 * @param {number} [opts.attackCooldownMs=0] - Minimum milliseconds between attacks
 */
function createWeaponBase(type, opts = {}) {
    return {
        type: type,
        damage: opts.damage ?? 0,
        range: opts.range ?? 0,
        attackCooldownMs: opts.attackCooldownMs ?? 0,
        canAttack: true,
        lastAttackTime: 0
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createWeaponBase };
}
