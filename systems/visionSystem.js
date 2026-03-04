// Vision system - calculates field of view using ray casting

const VisionSystem = {
    update(gameState, dt) {
        const player = gameState.player;
        if (!player) return;
        
        const transform = player.getComponent('transform');
        const vision = player.getComponent('vision');
        const input = player.getComponent('input');
        
        if (!transform || !vision || !input) return;
        
        // Cast vision cone
        const visiblePoints = Raycaster.castVisionCone(
            transform.x,
            transform.y,
            input.aimAngle,
            vision.fov,
            gameState.walls,
            vision.range
        );
        
        vision.visiblePolygon = visiblePoints;
    }
};
