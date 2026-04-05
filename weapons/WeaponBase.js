// Base weapon factory – shared state for all weapon types

/**
 * Creates a plain-object weapon base with the common fields every weapon needs.
 * @param {string} type   - Unique weapon-type identifier ('gun' | 'melee' | …)
 * @param {object} opts
 * @param {number} opts.damage           - Damage dealt per successful hit
 * @param {number} opts.range            - Maximum attack reach in pixels
 * @param {number} opts.attackCooldownMs - Minimum milliseconds between attacks
 */
function createWeaponBase(type, opts = {}) {
    return {
        type: type,
        damage: opts.damage,
        range: opts.range,
        attackCooldownMs: opts.attackCooldownMs,
        canAttack: true,
        lastAttackTime: 0
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createWeaponBase };
}
