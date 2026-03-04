// Aiming system - updates rotation based on input

const AimingSystem = {
    update(gameState, dt) {
        const player = gameState.player;
        if (!player) return;
        
        const transform = player.getComponent('transform');
        const input = player.getComponent('input');
        
        if (!transform || !input) return;
        
        // Update rotation to face aim direction
        transform.rotation = input.aimAngle;
    }
};
