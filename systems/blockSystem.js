// Block system - continuous pushing and collision for movable blocks
const BlockSystem = {
    update(gameState, dt) {
        if (!gameState.blocks || gameState.blocks.length === 0) {
            return;
        }

        this.applyPushers(gameState, dt);
        this.integrateBlocks(gameState, dt);
        this.resolveBlockStacking(gameState);
        this.resolvePlayerBlockCollisions(gameState);
    },

    applyPushers(gameState, dt) {
        const pushers = [];
        if (gameState.player) {
            pushers.push(gameState.player);
        }

        for (const pusher of pushers) {
            const transform = pusher.getComponent('transform');
            const collision = pusher.getComponent('collision');
            const physics = pusher.getComponent('physics');

            if (!transform || !collision || collision.type !== 'circle') {
                continue;
            }

            for (const blockEntity of gameState.blocks) {
                const blockComp = blockEntity.getComponent('block');
                const pushable = blockEntity.getComponent('pushable');
                if (!blockComp || !pushable || !pushable.canBePushedByPlayer) {
                    continue;
                }

                const aabb = this.getBlockAABB(blockEntity);
                const overlap = this.getCircleAABBOverlap(transform.x, transform.y, collision.radius, aabb);
                if (!overlap.hit) {
                    continue;
                }

                const pushStrength = (CONFIG.BLOCK_PUSH_FORCE * overlap.penetration) / Math.max(0.2, blockComp.mass);

                blockComp.vx -= overlap.normalX * pushStrength * dt;
                blockComp.vy -= overlap.normalY * pushStrength * dt;

                // Move pusher back slightly to avoid clipping into block body.
                transform.x += overlap.normalX * overlap.penetration * 0.55;
                transform.y += overlap.normalY * overlap.penetration * 0.55;

                if (physics) {
                    physics.vx *= 0.86;
                    physics.vy *= 0.86;
                }
            }
        }
    },

    integrateBlocks(gameState, dt) {
        for (const blockEntity of gameState.blocks) {
            const transform = blockEntity.getComponent('transform');
            const block = blockEntity.getComponent('block');
            const collision = blockEntity.getComponent('collision');
            if (!transform || !block || !collision || collision.type !== 'aabb') {
                continue;
            }

            block.vx *= block.friction;
            block.vy *= block.friction;

            const speed = Math.hypot(block.vx, block.vy);
            if (speed > CONFIG.BLOCK_MAX_SPEED) {
                const scale = CONFIG.BLOCK_MAX_SPEED / speed;
                block.vx *= scale;
                block.vy *= scale;
            }

            const oldX = transform.x;
            const oldY = transform.y;

            transform.x += block.vx * dt;
            if (this.isBlockBlocked(blockEntity, gameState)) {
                transform.x = oldX;
                block.vx = 0;
            }

            transform.y += block.vy * dt;
            if (this.isBlockBlocked(blockEntity, gameState)) {
                transform.y = oldY;
                block.vy = 0;
            }

            const halfW = collision.width / 2;
            const halfH = collision.height / 2;
            transform.x = Geometry.clamp(transform.x, halfW, CONFIG.CANVAS_WIDTH - halfW);
            transform.y = Geometry.clamp(transform.y, halfH, CONFIG.CANVAS_HEIGHT - halfH);
        }
    },

    isBlockBlocked(blockEntity, gameState) {
        const aabb = this.getBlockAABB(blockEntity);

        for (const wall of gameState.walls) {
            if (Collision.segmentIntersectsAABB(wall.x1, wall.y1, wall.x2, wall.y2, aabb.x, aabb.y, aabb.w, aabb.h)) {
                return true;
            }
        }

        for (const doorEntity of gameState.doors) {
            const door = doorEntity.getComponent('door');
            if (!door) continue;
            const segment = DoorSystem.getDoorSegment(door);
            if (Collision.segmentIntersectsAABB(segment.x1, segment.y1, segment.x2, segment.y2, aabb.x, aabb.y, aabb.w, aabb.h)) {
                return true;
            }
        }

        for (const other of gameState.blocks) {
            if (other.id === blockEntity.id) continue;
            if (this.blocksOverlap(blockEntity, other)) {
                return true;
            }
        }

        return false;
    },

    resolveBlockStacking(gameState) {
        for (let i = 0; i < gameState.blocks.length; i++) {
            for (let j = i + 1; j < gameState.blocks.length; j++) {
                const a = gameState.blocks[i];
                const b = gameState.blocks[j];
                if (!this.blocksOverlap(a, b)) {
                    continue;
                }

                const aT = a.getComponent('transform');
                const bT = b.getComponent('transform');
                const aC = a.getComponent('collision');
                const bC = b.getComponent('collision');

                const dx = bT.x - aT.x;
                const dy = bT.y - aT.y;
                const overlapX = (aC.width + bC.width) / 2 - Math.abs(dx);
                const overlapY = (aC.height + bC.height) / 2 - Math.abs(dy);

                if (overlapX < overlapY) {
                    const dir = dx >= 0 ? 1 : -1;
                    aT.x -= dir * overlapX * 0.5;
                    bT.x += dir * overlapX * 0.5;
                } else {
                    const dir = dy >= 0 ? 1 : -1;
                    aT.y -= dir * overlapY * 0.5;
                    bT.y += dir * overlapY * 0.5;
                }

                const aBlock = a.getComponent('block');
                const bBlock = b.getComponent('block');
                if (aBlock) {
                    aBlock.vx *= 0.5;
                    aBlock.vy *= 0.5;
                }
                if (bBlock) {
                    bBlock.vx *= 0.5;
                    bBlock.vy *= 0.5;
                }
            }
        }
    },

    blocksOverlap(a, b) {
        const aAABB = this.getBlockAABB(a);
        const bAABB = this.getBlockAABB(b);

        return (
            aAABB.x < bAABB.x + bAABB.w &&
            aAABB.x + aAABB.w > bAABB.x &&
            aAABB.y < bAABB.y + bAABB.h &&
            aAABB.y + aAABB.h > bAABB.y
        );
    },

    getBlockAABB(blockEntity) {
        const transform = blockEntity.getComponent('transform');
        const collision = blockEntity.getComponent('collision');
        return {
            x: transform.x + collision.offsetX,
            y: transform.y + collision.offsetY,
            w: collision.width,
            h: collision.height
        };
    },

    getCircleAABBOverlap(cx, cy, radius, aabb) {
        const closestX = Geometry.clamp(cx, aabb.x, aabb.x + aabb.w);
        const closestY = Geometry.clamp(cy, aabb.y, aabb.y + aabb.h);
        const dx = cx - closestX;
        const dy = cy - closestY;
        const dist = Math.hypot(dx, dy);

        if (dist >= radius) {
            return { hit: false };
        }

        if (dist === 0) {
            const centerX = aabb.x + aabb.w / 2;
            const centerY = aabb.y + aabb.h / 2;
            const dirX = cx >= centerX ? 1 : -1;
            const dirY = cy >= centerY ? 1 : -1;

            if (Math.abs(cx - centerX) > Math.abs(cy - centerY)) {
                return {
                    hit: true,
                    normalX: dirX,
                    normalY: 0,
                    penetration: radius
                };
            }

            return {
                hit: true,
                normalX: 0,
                normalY: dirY,
                penetration: radius
            };
        }

        return {
            hit: true,
            normalX: dx / dist,
            normalY: dy / dist,
            penetration: radius - dist
        };
    },

    resolvePlayerBlockCollisions(gameState) {
        const player = gameState.player;
        if (!player) return;

        const transform = player.getComponent('transform');
        const collision = player.getComponent('collision');
        if (!transform || !collision || collision.type !== 'circle') {
            return;
        }

        const maxIterations = 6;
        const epsilon = 0.001;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let hadOverlap = false;

            for (const blockEntity of gameState.blocks) {
                const aabb = this.getBlockAABB(blockEntity);
                const overlap = this.getCircleAABBOverlap(transform.x, transform.y, collision.radius, aabb);
                if (!overlap.hit) continue;

                hadOverlap = true;
                const pushDistance = overlap.penetration + epsilon;
                transform.x += overlap.normalX * pushDistance;
                transform.y += overlap.normalY * pushDistance;
            }

            if (!hadOverlap) break;
        }

        transform.x = Geometry.clamp(transform.x, collision.radius, CONFIG.CANVAS_WIDTH - collision.radius);
        transform.y = Geometry.clamp(transform.y, collision.radius, CONFIG.CANVAS_HEIGHT - collision.radius);

        if (typeof MovementSystem !== 'undefined' && MovementSystem && typeof MovementSystem.resolveWallCollisions === 'function') {
            MovementSystem.resolveWallCollisions(player, gameState.walls || []);
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockSystem;
}
