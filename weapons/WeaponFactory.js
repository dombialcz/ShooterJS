// Weapon factory – single entry-point for creating any weapon by type

/**
 * Creates a weapon component for the given type.
 * @param {'gun'|'melee'} type
 * @param {object} [opts] - Optional overrides forwarded to the concrete factory
 * @returns {object} Weapon component plain object
 */
function createWeapon(type, opts = {}) {
    switch (type) {
        case 'gun':
            return createGunWeapon(opts);
        case 'melee':
            return createMeleeWeapon(opts);
        default:
            throw new Error(`WeaponFactory: unknown weapon type "${type}"`);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createWeapon };
}
