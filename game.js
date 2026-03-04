// Main game state and loop

class GameState {
    constructor() {
        this.entities = new Map();
        this.score = 0;
        this.isGameOver = false;
        this.isPaused = false;
        this.player = null;
        this.walls = [];
        this.doors = [];
        this.targets = [];
    }
    
    addEntity(entity) {
        this.entities.set(entity.id, entity);
        
        // Keep references to important entities
        if (entity.type === 'player') {
            this.player = entity;
        } else if (entity.type === 'wall') {
            this.walls.push(entity.getComponent('wall'));
        } else if (entity.type === 'door') {
            this.doors.push(entity);
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
    
    /**
     * Get all wall segments including door segments (for vision and collision)
     */
    getAllWallSegments() {
        const segments = [...this.walls];
        
        // Add door segments (they act as dynamic walls)
        for (const doorEntity of this.doors) {
            const door = doorEntity.getComponent('door');
            if (door) {
                segments.push(DoorSystem.getDoorSegment(door));
            }
        }
        
        return segments;
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
        
        // Create walls for rooms, but leave gaps for doors at corridor connections
        this.createRoomWallsWithDoors();
    }
    
    generateRooms() {
        // Create 3 rooms with corridors
        const roomSize = CONFIG.ROOM_SIZE;
        const corridorWidth = CONFIG.CORRIDOR_WIDTH;
        const padding = CONFIG.MAP_PADDING;
        
        const rooms = [];
        
        // Room 1 - Top left
        rooms.push({
            id: 'room1',
            x: padding,
            y: padding,
            width: roomSize,
            height: roomSize
        });
        
        // Room 2 - Top right
        rooms.push({
            id: 'room2',
            x: CONFIG.CANVAS_WIDTH - padding - roomSize,
            y: padding,
            width: roomSize,
            height: roomSize
        });
        
        // Room 3 - Bottom center
        rooms.push({
            id: 'room3',
            x: CONFIG.CANVAS_WIDTH / 2 - roomSize / 2,
            y: CONFIG.CANVAS_HEIGHT - padding - roomSize,
            width: roomSize,
            height: roomSize
        });
        
        // Corridor connecting room 1 and 2 (horizontal)
        rooms.push({
            id: 'corridor_h',
            x: padding + roomSize,
            y: padding + roomSize / 2 - corridorWidth / 2,
            width: CONFIG.CANVAS_WIDTH - 2 * padding - 2 * roomSize,
            height: corridorWidth,
            isCorridor: true
        });
        
        // Corridor connecting to room 3 (vertical from middle)
        rooms.push({
            id: 'corridor_v',
            x: CONFIG.CANVAS_WIDTH / 2 - corridorWidth / 2,
            y: padding + roomSize,
            width: corridorWidth,
            height: CONFIG.CANVAS_HEIGHT - padding * 2 - roomSize * 2,
            isCorridor: true
        });
        
        return rooms;
    }
    
    createRoomWallsWithDoors() {
        const roomSize = CONFIG.ROOM_SIZE;
        const corridorWidth = CONFIG.CORRIDOR_WIDTH;
        const padding = CONFIG.MAP_PADDING;
        const doorWidth = CONFIG.DOOR_WIDTH;
        
        // Room 1 (top left) - add door on right wall
        const r1 = { x: padding, y: padding, width: roomSize, height: roomSize };
        const door1Y = r1.y + r1.height / 2;
        
        this.state.addEntity(createWall(r1.x, r1.y, r1.x + r1.width, r1.y)); // Top
        this.state.addEntity(createWall(r1.x + r1.width, r1.y, r1.x + r1.width, door1Y - doorWidth / 2)); // Right top
        this.state.addEntity(createWall(r1.x + r1.width, door1Y + doorWidth / 2, r1.x + r1.width, r1.y + r1.height)); // Right bottom
        this.state.addEntity(createWall(r1.x + r1.width, r1.y + r1.height, r1.x, r1.y + r1.height)); // Bottom
        this.state.addEntity(createWall(r1.x, r1.y + r1.height, r1.x, r1.y)); // Left
        
        // Add door at room 1 right entrance
        this.state.addEntity(createDoor(r1.x + r1.width, door1Y - doorWidth / 2, doorWidth, Math.PI / 2));
        
        // Room 2 (top right) - add door on left wall and bottom wall
        const r2 = { x: CONFIG.CANVAS_WIDTH - padding - roomSize, y: padding, width: roomSize, height: roomSize };
        const door2Y = r2.y + r2.height / 2;
        const door3X = r2.x + r2.width / 2;
        
        this.state.addEntity(createWall(r2.x, r2.y, r2.x + r2.width, r2.y)); // Top
        this.state.addEntity(createWall(r2.x + r2.width, r2.y, r2.x + r2.width, r2.y + r2.height)); // Right
        this.state.addEntity(createWall(r2.x + r2.width, r2.y + r2.height, door3X + doorWidth / 2, r2.y + r2.height)); // Bottom right
        this.state.addEntity(createWall(door3X - doorWidth / 2, r2.y + r2.height, r2.x, r2.y + r2.height)); // Bottom left
        this.state.addEntity(createWall(r2.x, r2.y + r2.height, r2.x, door2Y + doorWidth / 2)); // Left bottom
        this.state.addEntity(createWall(r2.x, door2Y - doorWidth / 2, r2.x, r2.y)); // Left top
        
        // Add doors
        this.state.addEntity(createDoor(r2.x, door2Y + doorWidth / 2, doorWidth, -Math.PI / 2));
        this.state.addEntity(createDoor(door3X - doorWidth / 2, r2.y + r2.height, doorWidth, 0));
        
        // Room 3 (bottom center) - add door on top wall
        const r3 = { x: CONFIG.CANVAS_WIDTH / 2 - roomSize / 2, y: CONFIG.CANVAS_HEIGHT - padding - roomSize, width: roomSize, height: roomSize };
        const door4X = r3.x + r3.width / 2;
        
        this.state.addEntity(createWall(r3.x, r3.y, door4X - doorWidth / 2, r3.y)); // Top left
        this.state.addEntity(createWall(door4X + doorWidth / 2, r3.y, r3.x + r3.width, r3.y)); // Top right
        this.state.addEntity(createWall(r3.x + r3.width, r3.y, r3.x + r3.width, r3.y + r3.height)); // Right
        this.state.addEntity(createWall(r3.x + r3.width, r3.y + r3.height, r3.x, r3.y + r3.height)); // Bottom
        this.state.addEntity(createWall(r3.x, r3.y + r3.height, r3.x, r3.y)); // Left
        
        // Add door
        this.state.addEntity(createDoor(door4X + doorWidth / 2, r3.y, doorWidth, Math.PI));
        
        // Corridor walls (horizontal)
        const ch = { x: padding + roomSize, y: padding + roomSize / 2 - corridorWidth / 2, width: CONFIG.CANVAS_WIDTH - 2 * padding - 2 * roomSize, height: corridorWidth };
        this.state.addEntity(createWall(ch.x, ch.y, ch.x + ch.width, ch.y)); // Top
        this.state.addEntity(createWall(ch.x, ch.y + ch.height, ch.x + ch.width, ch.y + ch.height)); // Bottom
        
        // Corridor walls (vertical)
        const cv = { x: CONFIG.CANVAS_WIDTH / 2 - corridorWidth / 2, y: padding + roomSize, width: corridorWidth, height: CONFIG.CANVAS_HEIGHT - padding * 2 - roomSize * 2 };
        this.state.addEntity(createWall(cv.x, cv.y, cv.x, cv.y + cv.height)); // Left
        this.state.addEntity(createWall(cv.x + cv.width, cv.y, cv.x + cv.width, cv.y + cv.height)); // Right
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
        const roomSize = CONFIG.ROOM_SIZE;
        const padding = CONFIG.MAP_PADDING;
        const margin = 40;
        
        // Define the 3 main rooms
        const rooms = [
            { x: padding, y: padding, width: roomSize, height: roomSize }, // Room 1
            { x: CONFIG.CANVAS_WIDTH - padding - roomSize, y: padding, width: roomSize, height: roomSize }, // Room 2
            { x: CONFIG.CANVAS_WIDTH / 2 - roomSize / 2, y: CONFIG.CANVAS_HEIGHT - padding - roomSize, width: roomSize, height: roomSize } // Room 3
        ];
        
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
        DoorSystem.update(this.state, dt);
        ProjectileSystem.update(this.state, dt);
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
