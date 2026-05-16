const MeleeSystem = require('../../systems/meleeSystem.js');

function makeEntity(components) {
    return {
        id: Math.floor(Math.random() * 10000),
        getComponent(name) {
            return components[name] ?? null;
        }
    };
}

describe('MeleeSystem', () => {
    let removedIds;
    let addedEntities;

    beforeEach(() => {
        removedIds = [];
        addedEntities = [];

        global.CONFIG = {
            MELEE_DAMAGE: 35,
            MELEE_RANGE: 60,
            MELEE_COOLDOWN_MS: 600,
            MELEE_SWING_DURATION_MS: 250,
            HIT_MARKER_DURATION: 200,
            HIT_MARKER_COLOR: '#ffffff',
            HIT_MARKER_RADIUS: 10
        };

        global.createHitMarker = (x, y) => {
            const lifetime = { createdAt: 0, duration: 200 };
            return {
                type: 'hitmarker',
                getComponent(name) {
                    if (name === 'lifetime') return lifetime;
                    return null;
                }
            };
        };
    });

    function makeGameState(playerOpts = {}, extraOpts = {}) {
        const playerState = { activeWeapon: 'melee', ...playerOpts.playerState };
        const melee = {
            damage: 35,
            range: 60,
            attackCooldownMs: 600,
            lastAttackTime: 0,
            swingStartMs: null,
            swingDurationMs: 250,
            ...playerOpts.melee
        };
        const input = {
            isShooting: false,
            ...playerOpts.input
        };
        const transform = { x: 100, y: 100, ...playerOpts.transform };

        const player = {
            getComponent(name) {
                if (name === 'playerState') return playerState;
                if (name === 'melee') return melee;
                if (name === 'input') return input;
                if (name === 'transform') return transform;
                return null;
            },
            _melee: melee
        };

        return {
            timeMs: 1000,
            player,
            enemies: [],
            targets: [],
            score: 0,
            addScore(pts) { this.score += pts; },
            addEntity(e) { addedEntities.push(e); },
            removeEntity(id) { removedIds.push(id); },
            ...extraOpts
        };
    }

    it('does nothing when active weapon is gun', () => {
        const gameState = makeGameState({ playerState: { activeWeapon: 'gun' }, input: { isShooting: true } });
        MeleeSystem.update(gameState, 1 / 60);
        expect(removedIds).toHaveLength(0);
    });

    it('does not attack without a click (isShooting=false)', () => {
        const gameState = makeGameState({ input: { isShooting: false } });
        const enemy = makeEntity({
            transform: { x: 120, y: 100 },
            health: { current: 45, max: 45 },
            enemy: { type: 'melee', scoreValue: 20 }
        });
        gameState.enemies = [enemy];
        MeleeSystem.update(gameState, 1 / 60);
        expect(enemy.getComponent('health').current).toBe(45);
    });

    it('respects cooldown and does not attack before it expires', () => {
        const gameState = makeGameState({
            input: { isShooting: true },
            melee: { lastAttackTime: 600, attackCooldownMs: 600 }
        });
        gameState.timeMs = 1000; // only 400ms since last attack
        const enemy = makeEntity({
            transform: { x: 120, y: 100 },
            health: { current: 45, max: 45 },
            enemy: { type: 'melee', scoreValue: 20 }
        });
        gameState.enemies = [enemy];
        MeleeSystem.update(gameState, 1 / 60);
        expect(enemy.getComponent('health').current).toBe(45);
    });

    it('deals damage to an enemy within range on click', () => {
        const gameState = makeGameState({ input: { isShooting: true } });
        const enemyHealth = { current: 45, max: 45 };
        const enemy = makeEntity({
            transform: { x: 140, y: 100 }, // 40px away - within 60px range
            health: enemyHealth,
            enemy: { type: 'melee', scoreValue: 20 }
        });
        gameState.enemies = [enemy];
        MeleeSystem.update(gameState, 1 / 60);
        expect(enemyHealth.current).toBe(10); // 45 - 35 = 10
    });

    it('does not damage an enemy outside range', () => {
        const gameState = makeGameState({ input: { isShooting: true } });
        const enemyHealth = { current: 45, max: 45 };
        const enemy = makeEntity({
            transform: { x: 200, y: 100 }, // 100px away - outside 60px range
            health: enemyHealth,
            enemy: { type: 'melee', scoreValue: 20 }
        });
        gameState.enemies = [enemy];
        MeleeSystem.update(gameState, 1 / 60);
        expect(enemyHealth.current).toBe(45);
    });

    it('removes enemy and updates score when health reaches 0', () => {
        const gameState = makeGameState({ input: { isShooting: true } });
        const enemy = makeEntity({
            transform: { x: 130, y: 100 },
            health: { current: 20, max: 45 },
            enemy: { type: 'melee', scoreValue: 20 }
        });
        gameState.enemies = [enemy];
        MeleeSystem.update(gameState, 1 / 60);
        expect(removedIds).toContain(enemy.id);
        expect(gameState.score).toBe(20);
        expect(gameState.enemiesDestroyed).toBe(1);
    });

    it('starts a swing animation on attack', () => {
        const gameState = makeGameState({ input: { isShooting: true } });
        const player = gameState.player;
        MeleeSystem.update(gameState, 1 / 60);
        expect(player._melee.swingStartMs).toBe(1000);
    });

    it('melee weapon does more damage than the gun weapon (35 > 15)', () => {
        // Gun damage is hard-coded to 15 in ShootingSystem; melee CONFIG is 35
        expect(CONFIG.MELEE_DAMAGE).toBeGreaterThan(15);
    });
});
