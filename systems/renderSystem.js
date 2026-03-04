// Rendering system - draws all entities and effects

const RenderSystem = {
    render(ctx, gameState, alpha) {
        // Clear canvas
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        
        // Draw walls (background layer)
        this.drawWalls(ctx, gameState);
        
        // Draw doors
        this.drawDoors(ctx, gameState);
        
        // Draw targets
        this.drawTargets(ctx, gameState);
        
        // Draw player and gun
        if (gameState.player) {
            this.drawPlayer(ctx, gameState.player);
            this.drawGun(ctx, gameState.player);
        }
        
        // Draw hit markers
        this.drawHitMarkers(ctx, gameState);
        
        // Apply darkness overlay (everything outside FOV)
        this.drawDarkness(ctx, gameState);
        
        // Draw crosshair
        this.drawCrosshair(ctx, gameState);
        
        // Debug: Draw FOV polygon outline
        // this.drawFOVDebug(ctx, gameState);
    },
    
    drawWalls(ctx, gameState) {
        ctx.strokeStyle = CONFIG.WALL_COLOR;
        ctx.lineWidth = CONFIG.WALL_THICKNESS;
        ctx.lineCap = 'round';
        
        for (const entity of gameState.entities.values()) {
            if (entity.type !== 'wall') continue;
            
            const wall = entity.getComponent('wall');
            if (!wall) continue;
            
            ctx.beginPath();
            ctx.moveTo(wall.x1, wall.y1);
            ctx.lineTo(wall.x2, wall.y2);
            ctx.stroke();
        }
    },
    
    drawDoors(ctx, gameState) {
        for (const entity of gameState.entities.values()) {
            if (entity.type !== 'door') continue;
            
            const door = entity.getComponent('door');
            const renderable = entity.getComponent('renderable');
            if (!door || !renderable) continue;
            
            // Calculate door endpoints
            const doorAngle = door.hingeAngle + door.currentAngle;
            const dx = Math.cos(doorAngle) * door.width;
            const dy = Math.sin(doorAngle) * door.width;
            
            const endX = door.hingeX + dx;
            const endY = door.hingeY + dy;
            
            // Draw door as thick line
            ctx.strokeStyle = renderable.color;
            ctx.lineWidth = door.thickness;
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(door.hingeX, door.hingeY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Draw hinge point
            ctx.fillStyle = '#333333';
            ctx.beginPath();
            ctx.arc(door.hingeX, door.hingeY, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    
    drawTargets(ctx, gameState) {
        for (const target of gameState.targets) {
            const transform = target.getComponent('transform');
            const renderable = target.getComponent('renderable');
            
            if (!transform || !renderable) continue;
            
            ctx.fillStyle = renderable.color;
            ctx.beginPath();
            ctx.arc(transform.x, transform.y, renderable.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw target crosshair design
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            const r = renderable.size;
            
            // Outer ring
            ctx.beginPath();
            ctx.arc(transform.x, transform.y, r * 0.7, 0, Math.PI * 2);
            ctx.stroke();
            
            // Center dot
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(transform.x, transform.y, r * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    
    drawPlayer(ctx, player) {
        const transform = player.getComponent('transform');
        const renderable = player.getComponent('renderable');
        
        if (!transform || !renderable) return;
        
        // Draw player circle
        ctx.fillStyle = renderable.color;
        ctx.beginPath();
        ctx.arc(transform.x, transform.y, renderable.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw player outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    },
    
    drawGun(ctx, player) {
        const transform = player.getComponent('transform');
        const gun = player.getComponent('gun');
        
        if (!transform || !gun) return;
        
        ctx.save();
        
        // Translate to player position and rotate
        ctx.translate(transform.x, transform.y);
        ctx.rotate(transform.rotation);
        
        // Draw gun rectangle (offset from center)
        ctx.fillStyle = gun.color || CONFIG.GUN_COLOR;
        ctx.fillRect(
            gun.offsetX,
            -gun.width / 2,
            gun.length,
            gun.width
        );
        
        ctx.restore();
    },
    
    drawHitMarkers(ctx, gameState) {
        const now = Date.now();
        
        for (const entity of gameState.entities.values()) {
            if (entity.type !== 'hitmarker') continue;
            
            const transform = entity.getComponent('transform');
            const renderable = entity.getComponent('renderable');
            const lifetime = entity.getComponent('lifetime');
            
            if (!transform || !renderable || !lifetime) continue;
            
            // Calculate fade based on lifetime
            const elapsed = now - lifetime.createdAt;
            const progress = elapsed / lifetime.duration;
            const alpha = 1 - progress;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            
            // Draw X marker
            ctx.strokeStyle = renderable.color;
            ctx.lineWidth = 3;
            const size = renderable.size;
            
            ctx.beginPath();
            ctx.moveTo(transform.x - size, transform.y - size);
            ctx.lineTo(transform.x + size, transform.y + size);
            ctx.moveTo(transform.x + size, transform.y - size);
            ctx.lineTo(transform.x - size, transform.y + size);
            ctx.stroke();
            
            ctx.restore();
        }
    },
    
    drawDarkness(ctx, gameState) {
        if (!gameState.player) return;
        
        const vision = gameState.player.getComponent('vision');
        if (!vision || !vision.visiblePolygon || vision.visiblePolygon.length === 0) {
            // No vision data, darken everything
            ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.DARKNESS_ALPHA})`;
            ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
            return;
        }
        
        const transform = gameState.player.getComponent('transform');
        
        // Save context state
        ctx.save();
        
        // Create an inverse mask using even-odd fill rule
        // This draws darkness everywhere EXCEPT inside the FOV polygon
        ctx.beginPath();
        
        // Outer rectangle (entire canvas)
        ctx.rect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        
        // Inner polygon (FOV) - draw in reverse winding order for even-odd rule
        ctx.moveTo(transform.x, transform.y);
        for (let i = vision.visiblePolygon.length - 1; i >= 0; i--) {
            const point = vision.visiblePolygon[i];
            ctx.lineTo(point.x, point.y);
        }
        ctx.closePath();
        
        // Fill using even-odd rule - fills outer rect but NOT inner polygon
        ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.DARKNESS_ALPHA})`;
        ctx.fill('evenodd');
        
        ctx.restore();
    },
    
    drawCrosshair(ctx, gameState) {
        if (!gameState.player) return;
        
        const input = gameState.player.getComponent('input');
        if (!input) return;
        
        // Get mouse position from input system
        const mouseX = InputSystem.inputState.mouse.x;
        const mouseY = InputSystem.inputState.mouse.y;
        
        const size = input.isADS ? 8 : 6;
        const gap = input.isADS ? 4 : 3;
        const color = input.isADS ? '#ff6464' : '#ffffff';
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        // Draw crosshair lines
        ctx.beginPath();
        // Top
        ctx.moveTo(mouseX, mouseY - gap);
        ctx.lineTo(mouseX, mouseY - gap - size);
        // Bottom
        ctx.moveTo(mouseX, mouseY + gap);
        ctx.lineTo(mouseX, mouseY + gap + size);
        // Left
        ctx.moveTo(mouseX - gap, mouseY);
        ctx.lineTo(mouseX - gap - size, mouseY);
        // Right
        ctx.moveTo(mouseX + gap, mouseY);
        ctx.lineTo(mouseX + gap + size, mouseY);
        ctx.stroke();
        
        // Draw center dot when ADS
        if (input.isADS) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(mouseX, mouseY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    
    drawFOVDebug(ctx, gameState) {
        if (!gameState.player) return;
        
        const vision = gameState.player.getComponent('vision');
        const transform = gameState.player.getComponent('transform');
        
        if (!vision || !vision.visiblePolygon || vision.visiblePolygon.length === 0) return;
        
        // Draw FOV polygon outline
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(transform.x, transform.y);
        
        for (const point of vision.visiblePolygon) {
            ctx.lineTo(point.x, point.y);
        }
        
        ctx.closePath();
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        for (const point of vision.visiblePolygon) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
};
