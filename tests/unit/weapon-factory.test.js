const { loadScripts } = require('../helpers/loadVanillaScripts');

function weaponCtx() {
    return loadScripts([
        'weapons/WeaponBase.js',
        'weapons/GunWeapon.js',
        'weapons/MeleeWeapon.js',
        'weapons/WeaponFactory.js'
    ]);
}

describe('WeaponFactory', () => {
    describe('createWeaponBase', () => {
        it('creates a base weapon with required fields', () => {
            const ctx = weaponCtx();
            const base = ctx.createWeaponBase('gun', { damage: 15, range: 600, attackCooldownMs: 200 });
            expect(base.type).toBe('gun');
            expect(base.damage).toBe(15);
            expect(base.range).toBe(600);
            expect(base.attackCooldownMs).toBe(200);
            expect(base.canAttack).toBe(true);
            expect(base.lastAttackTime).toBe(0);
        });
    });

    describe('createGunWeapon', () => {
        it('creates a gun weapon with all required fields', () => {
            const ctx = weaponCtx();
            const gun = ctx.createGunWeapon();
            expect(gun.type).toBe('gun');
            expect(gun.damage).toBe(15);
            expect(gun.range).toBe(600);
            expect(gun.attackCooldownMs).toBe(200);
            expect(gun.length).toBe(20);
            expect(gun.width).toBe(8);
            expect(gun.offsetX).toBe(15);
            expect(typeof gun.currentSpreadHalfAngleRad).toBe('number');
            expect(gun.adsStartedAtMs).toBeNull();
            // ShootingSystem compatibility
            expect(gun.canShoot).toBe(true);
            expect(gun.lastShotTime).toBe(0);
            expect(gun.fireRate).toBe(200);
        });

        it('accepts custom overrides', () => {
            const ctx = weaponCtx();
            const gun = ctx.createGunWeapon({ damage: 20, range: 800 });
            expect(gun.damage).toBe(20);
            expect(gun.range).toBe(800);
        });
    });

    describe('createMeleeWeapon', () => {
        it('creates a melee weapon with all required fields', () => {
            const ctx = weaponCtx();
            const melee = ctx.createMeleeWeapon();
            expect(melee.type).toBe('melee');
            expect(melee.damage).toBe(35);
            expect(melee.range).toBe(60);
            expect(melee.attackCooldownMs).toBe(600);
            expect(melee.length).toBe(28);
            expect(melee.swingStartMs).toBeNull();
            expect(melee.swingDurationMs).toBe(250);
        });

        it('melee damage is greater than gun damage', () => {
            const ctx = weaponCtx();
            const gun = ctx.createGunWeapon();
            const melee = ctx.createMeleeWeapon();
            expect(melee.damage).toBeGreaterThan(gun.damage);
        });

        it('accepts custom overrides', () => {
            const ctx = weaponCtx();
            const melee = ctx.createMeleeWeapon({ damage: 50, range: 80, attackCooldownMs: 400 });
            expect(melee.damage).toBe(50);
            expect(melee.range).toBe(80);
            expect(melee.attackCooldownMs).toBe(400);
        });
    });

    describe('createWeapon factory', () => {
        it('creates gun weapon via factory', () => {
            const ctx = weaponCtx();
            const w = ctx.createWeapon('gun');
            expect(w.type).toBe('gun');
        });

        it('creates melee weapon via factory', () => {
            const ctx = weaponCtx();
            const w = ctx.createWeapon('melee');
            expect(w.type).toBe('melee');
        });

        it('throws on unknown weapon type', () => {
            const ctx = weaponCtx();
            expect(() => ctx.createWeapon('bazooka')).toThrow('unknown weapon type');
        });
    });
});
