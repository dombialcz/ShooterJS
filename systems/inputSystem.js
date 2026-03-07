// Input handling system

const InputSystem = {
    inputState: {
        keys: new Set(),
        mouse: {
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            buttons: new Set()
        }
    },
    
    canvas: null,
    gameState: null,
    
    init(canvas, gameState) {
        this.canvas = canvas;
        this.gameState = gameState;
        
        // Keyboard events
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Mouse events
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        console.log('Input system initialized');
    },
    
    onKeyDown(e) {
        this.inputState.keys.add(e.code);
        
        // Prevent default behavior for game keys
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
    },
    
    onKeyUp(e) {
        this.inputState.keys.delete(e.code);
    },
    
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.inputState.mouse.x = e.clientX - rect.left;
        this.inputState.mouse.y = e.clientY - rect.top;
        
        // Convert to world coordinates (for now, same as canvas coords)
        this.inputState.mouse.worldX = this.inputState.mouse.x;
        this.inputState.mouse.worldY = this.inputState.mouse.y;
    },
    
    onMouseDown(e) {
        this.inputState.mouse.buttons.add(e.button);
        e.preventDefault();
    },
    
    onMouseUp(e) {
        this.inputState.mouse.buttons.delete(e.button);
        e.preventDefault();
    },
    
    update(gameState, dt, options = {}) {
        const player = gameState.player;
        if (!player) return;
        
        const input = player.getComponent('input');
        if (!input) return;
        const playerState = player.getComponent('playerState');
        
        // Process movement input (WASD)
        let moveX = 0;
        let moveY = 0;
        
        if (this.inputState.keys.has('KeyW')) moveY -= 1;
        if (this.inputState.keys.has('KeyS')) moveY += 1;
        if (this.inputState.keys.has('KeyA')) moveX -= 1;
        if (this.inputState.keys.has('KeyD')) moveX += 1;
        
        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            const len = Math.sqrt(moveX * moveX + moveY * moveY);
            moveX /= len;
            moveY /= len;
        }
        
        input.moveX = moveX;
        input.moveY = moveY;
        
        // Process aim input (mouse position)
        const transform = player.getComponent('transform');
        input.aimAngle = Geometry.angleBetween(
            transform.x,
            transform.y,
            this.inputState.mouse.worldX,
            this.inputState.mouse.worldY
        );
        
        // Process shooting input (left mouse button)
        input.isShooting = this.inputState.mouse.buttons.has(0);
        
        // Process ADS input (right mouse button)
        input.isADS = this.inputState.mouse.buttons.has(2);

        if (playerState) {
            playerState.isADSActive = input.isADS;
            playerState.movementSpeedMultiplier = input.isADS ? CONFIG.PLAYER_ADS_SPEED_MULTIPLIER : 1;
        }
        
        // Update ADS indicator in UI
        if (!options.skipDOM) {
            const adsIndicator = document.getElementById('adsIndicator');
            if (adsIndicator) {
                if (input.isADS) {
                    adsIndicator.classList.add('active');
                } else {
                    adsIndicator.classList.remove('active');
                }
            }
        }
        
        // Update vision FOV based on ADS
        const vision = player.getComponent('vision');
        if (vision) {
            vision.isADS = input.isADS;
            vision.fov = input.isADS ? CONFIG.FOV_ADS : CONFIG.FOV_NORMAL;
        }
    }
};
