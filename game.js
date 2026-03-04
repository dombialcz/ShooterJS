// Main game state and loop

class GameState {
    constructor() {
        this.entities = new Map();
        this.score = 0;
        this.isGameOver = false;
        this.isPaused = false;
        this.player = null;
        this.walls = [];
        this.targets = [];
    }
    
    addEntity(entity) {
        this.entities.set(entity.id, entity);
        
        // Keep references to important entities
        if (entity.type === 'player') {
            this.player = entity;
        } else if (entity.type === 'wall') {
            this.walls.push(entity.getComponent('wall'));
        } else if (entity.type === 'target') {
            this.targets.push(entity);
        }
        
        return entity;
    }
    
    removeEntity(entityId) {
        const entity = this.entities.get(entityId);
        if (entity) {
            // Update references
            if (entity.type === 'target') {
                const index = this.targets.indexOf(entity);
                if (index > -1) {
                    this.targets.splice(index, 1);
                }
            }
            
            this.entities.delete(entityId);
        }
    }
    
    getEntitiesByType(type) {
        const result = [];
        for (const entity of this.entities.values()) {
            if (entity.type === type) {
                result.push(entity);
            }
        }
        return result;
    }
    
    addScore(points) {
        this.score += points;
        document.getElementById('scoreValue').textContent = this.score;
    }
    
    checkGameOver() {
        if (this.targets.length === 0 && !this.isGameOver) {
            this.isGameOver = true;
            document.getElementById('finalScore').textContent = this.score;
            document.getElementById('gameOver').classList.add('visible');
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = new GameState();
        
        this.lastTime = 0;
        this.accumulator = 0;
        this.dt = CONFIG.FIXED_TIMESTEP;
        
        this.isRunning = false;
    }
    
    init() {
        console.log('Initializing game...');
        
        // Initialize map with rooms and walls
        this.initializeMap();
        
        // Create player
        const playerX = CONFIG.CANVAS_WIDTH / 2;
        const playerY = CONFIG.CANVAS_HEIGHT / 2;
        this.state.addEntity(createPlayer(playerX, playerY));
        
        // Create targets
        this.createTargets();
        
        // Initialize input system
        InputSystem.init(this.canvas, this.state);
        
        // Setup restart button
        document.getElementById('restartButton').addEventListener('click', () => {
            this.restart();
        });
        
        console.log('Game initialized!');
        console.log(`Player: ${this.state.player ? 'Created' : 'Missing'}`);
        console.log(`Walls: ${this.state.walls.length}`);
        console.log(`Targets: ${this.state.targets.length}`);
    }
    
    initializeMap() {
        const rooms = this.generateRooms();
        
        // Create walls for each room
        for (const room of rooms) {
            this.createRoomWalls(room);
        }
    }
    
    generateRooms() {
        // Create 3 rooms with corridors
        const roomSize = CONFIG.ROOM_SIZE;
        const corridorWidth = CONFIG.CORRIDOR_WIDTH;
        const padding = CONFIG.MAP_PADDING;
        
        const rooms = [];
        
        // Room 1 - Top left
        rooms.push({
            x: padding,
            y: padding,
            width: roomSize,
            height: roomSize
        });
        
        // Room 2 - Top right
        rooms.push({
            x: CONFIG.CANVAS_WIDTH - padding - roomSize,
            y: padding,
            width: roomSize,
            height: roomSize
        });
        
        // Room 3 - Bottom center
        rooms.push({
            x: CONFIG.CANVAS_WIDTH / 2 - roomSize / 2,
            y: CONFIG.CANVAS_HEIGHT - padding - roomSize,
            width: roomSize,
            height: roomSize
        });
        
        // Corridor connecting room 1 and 2 (horizontal)
        rooms.push({
            x: padding + roomSize,
            y: padding + roomSize / 2 - corridorWidth / 2,
            width: CONFIG.CANVAS_WIDTH - 2 * padding - 2 * roomSize,
            height: corridorWidth,
            isCorridor: true
        });
        
        // Corridor connecting to room 3 (vertical from middle)
        rooms.push({
            x: CONFIG.CANVAS_WIDTH / 2 - corridorWidth / 2,
            y: padding + roomSize,
            width: corridorWidth,
            height: CONFIG.CANVAS_HEIGHT - padding * 2 - roomSize * 2,
            isCorridor: true
        });
        
        return rooms;
    }
    
    createRoomWalls(room) {
        const { x, y, width, height } = room;
        
        // Top wall
        this.state.addEntity(createWall(x, y, x + width, y));
        // Right wall
        this.state.addEntity(createWall(x + width, y, x + width, y + height));
        // Bottom wall
        this.state.addEntity(createWall(x + width, y + height, x, y + height));
        // Left wall
        this.state.addEntity(createWall(x, y + height, x, y));
    }
    
    createTargets() {
        const rooms = this.generateRooms().filter(r => !r.isCorridor);
        const margin = 40;
        
        for (let i = 0; i < CONFIG.TARGET_COUNT; i++) {
            // Pick a random room
            const room = rooms[Math.floor(Math.random() * rooms.length)];
            
            // Random position within room (with margin)
            const x = room.x + margin + Math.random() * (room.width - 2 * margin);
            const y = room.y + margin + Math.random() * (room.height - 2 * margin);
            
            this.state.addEntity(createTarget(x, y));
        }
    }
    
    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    }
    
    restart() {
        // Reset state
        this.state = new GameState();
        
        // Hide game over screen
        document.getElementById('gameOver').classList.remove('visible');
        
        // Reinitialize
        this.init();
        this.start();
    }
    
    gameLoop(currentTime) {
        if (!this.isRunning) return;
        
        requestAnimationFrame((time) => this.gameLoop(time));
        
        // Calculate delta time
        let frameTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Cap frame time to prevent spiral of death
        if (frameTime > CONFIG.MAX_FRAME_TIME) {
            frameTime = CONFIG.MAX_FRAME_TIME;
        }
        
        this.accumulator += frameTime;
        
        // Fixed timestep updates
        while (this.accumulator >= this.dt) {
            this.update(this.dt / 1000); // Convert to seconds
            this.accumulator -= this.dt;
        }
        
        // Render with interpolation
        const alpha = this.accumulator / this.dt;
        this.render(alpha);
    }
    
    update(dt) {
        if (this.state.isPaused || this.state.isGameOver) return;
        
        // Update all systems
        InputSystem.update(this.state, dt);
        AimingSystem.update(this.state, dt);
        MovementSystem.update(this.state, dt);
        VisionSystem.update(this.state, dt);
        ShootingSystem.update(this.state, dt);
        
        // Remove expired entities (like hit markers)
        this.removeExpiredEntities();
        
        // Check game over condition
        this.state.checkGameOver();
    }
    
    removeExpiredEntities() {
        const now = Date.now();
        const toRemove = [];
        
        for (const entity of this.state.entities.values()) {
            const lifetime = entity.getComponent('lifetime');
            if (lifetime && now - lifetime.createdAt >= lifetime.duration) {
                toRemove.push(entity.id);
            }
        }
        
        for (const id of toRemove) {
            this.state.removeEntity(id);
        }
    }
    
    render(alpha) {
        RenderSystem.render(this.ctx, this.state, alpha);
    }
}

// Initialize and start the game when the page loads
window.addEventListener('load', () => {
    const game = new Game();
    game.init();
    game.start();
});
