// Map format, validation and default map helpers
function getMapRuntimeConfig() {
    if (typeof CONFIG !== 'undefined') {
        return CONFIG;
    }

    return {
        MAP_TILE_SIZE: 40,
        CANVAS_WIDTH: 1280,
        CANVAS_HEIGHT: 720
    };
}

const MapFormat = {
    VERSION: 1,
    TILE_EMPTY: 0,
    TILE_WALL: 1,
    TILE_BLOCK: 2,

    createEmptyTiles(cols, rows, fill = 0) {
        const tiles = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                tiles.push(fill);
            }
        }
        return tiles;
    },

    index(col, row, cols) {
        return row * cols + col;
    },

    getTile(tiles, cols, rows, col, row) {
        if (col < 0 || row < 0 || col >= cols || row >= rows) {
            return this.TILE_EMPTY;
        }
        return tiles[this.index(col, row, cols)] ?? this.TILE_EMPTY;
    },

    setTile(tiles, cols, rows, col, row, value) {
        if (col < 0 || row < 0 || col >= cols || row >= rows) {
            return;
        }
        tiles[this.index(col, row, cols)] = value;
    },

    rectWalls(tiles, cols, rows, x, y, w, h) {
        for (let col = x; col < x + w; col++) {
            this.setTile(tiles, cols, rows, col, y, this.TILE_WALL);
            this.setTile(tiles, cols, rows, col, y + h - 1, this.TILE_WALL);
        }
        for (let row = y; row < y + h; row++) {
            this.setTile(tiles, cols, rows, x, row, this.TILE_WALL);
            this.setTile(tiles, cols, rows, x + w - 1, row, this.TILE_WALL);
        }
    },

    carveDoorGap(tiles, cols, rows, col, row, orientation) {
        if (orientation === 'vertical') {
            this.setTile(tiles, cols, rows, col, row, this.TILE_EMPTY);
            this.setTile(tiles, cols, rows, col, row + 1, this.TILE_EMPTY);
        } else {
            this.setTile(tiles, cols, rows, col, row, this.TILE_EMPTY);
            this.setTile(tiles, cols, rows, col + 1, row, this.TILE_EMPTY);
        }
    },

    createDefaultMapData() {
        const cfg = getMapRuntimeConfig();
        const tileSize = cfg.MAP_TILE_SIZE;
        const cols = Math.floor(cfg.CANVAS_WIDTH / tileSize);
        const rows = Math.floor(cfg.CANVAS_HEIGHT / tileSize);
        const tiles = this.createEmptyTiles(cols, rows, this.TILE_EMPTY);

        // Outer map boundary.
        for (let col = 0; col < cols; col++) {
            this.setTile(tiles, cols, rows, col, 0, this.TILE_WALL);
            this.setTile(tiles, cols, rows, col, rows - 1, this.TILE_WALL);
        }
        for (let row = 0; row < rows; row++) {
            this.setTile(tiles, cols, rows, 0, row, this.TILE_WALL);
            this.setTile(tiles, cols, rows, cols - 1, row, this.TILE_WALL);
        }

        // Inner wall layout with planned door gaps.
        for (let row = 2; row <= 15; row++) {
            this.setTile(tiles, cols, rows, 10, row, this.TILE_WALL);
            this.setTile(tiles, cols, rows, 21, row, this.TILE_WALL);
        }
        for (let col = 11; col <= 20; col++) {
            this.setTile(tiles, cols, rows, col, 6, this.TILE_WALL);
            this.setTile(tiles, cols, rows, col, 11, this.TILE_WALL);
        }

        const doors = [
            { col: 10, row: 8, orientation: 'vertical', hingeSide: 'top' },
            { col: 21, row: 8, orientation: 'vertical', hingeSide: 'bottom' },
            { col: 15, row: 6, orientation: 'horizontal', hingeSide: 'left' },
            { col: 15, row: 11, orientation: 'horizontal', hingeSide: 'right' }
        ];

        for (const door of doors) {
            this.carveDoorGap(tiles, cols, rows, door.col, door.row, door.orientation);
        }

        // A few pushable blocks in corridors/rooms
        this.setTile(tiles, cols, rows, 7, 4, this.TILE_BLOCK);
        this.setTile(tiles, cols, rows, 16, 8, this.TILE_BLOCK);
        this.setTile(tiles, cols, rows, 24, 13, this.TILE_BLOCK);

        return {
            version: this.VERSION,
            meta: { name: 'default' },
            settings: {
                timeLimitMs: cfg.ROUND_DURATION_MS || 120000,
                maxTargetsToKill: 5
            },
            tileSize: tileSize,
            cols: cols,
            rows: rows,
            tiles: tiles,
            doors: doors,
            playerSpawn: { col: 5, row: 9 },
            targetSpawns: [
                { col: 4, row: 4 },
                { col: 15, row: 3 },
                { col: 26, row: 4 },
                { col: 15, row: 14 },
                { col: 26, row: 13 }
            ]
        };
    },

    validateMapData(raw) {
        const errors = [];

        if (!raw || typeof raw !== 'object') {
            errors.push('Map must be an object.');
            return errors;
        }

        if (raw.version !== this.VERSION) {
            errors.push(`Unsupported map version: ${raw.version}. Expected ${this.VERSION}.`);
        }

        if (!Number.isInteger(raw.tileSize) || raw.tileSize <= 0) {
            errors.push('tileSize must be a positive integer.');
        }

        if (!Number.isInteger(raw.cols) || raw.cols <= 0) {
            errors.push('cols must be a positive integer.');
        }

        if (!Number.isInteger(raw.rows) || raw.rows <= 0) {
            errors.push('rows must be a positive integer.');
        }

        if (!Array.isArray(raw.tiles)) {
            errors.push('tiles must be an array.');
        } else if (Number.isInteger(raw.cols) && Number.isInteger(raw.rows) && raw.tiles.length !== raw.cols * raw.rows) {
            errors.push('tiles length must equal cols * rows.');
        } else {
            for (let i = 0; i < raw.tiles.length; i++) {
                const value = raw.tiles[i];
                if (!Number.isInteger(value) || value < this.TILE_EMPTY || value > this.TILE_BLOCK) {
                    errors.push(`tiles[${i}] has invalid value ${value}.`);
                    break;
                }
            }
        }

        if (!raw.playerSpawn || !Number.isInteger(raw.playerSpawn.col) || !Number.isInteger(raw.playerSpawn.row)) {
            errors.push('playerSpawn must include integer col and row.');
        }

        if (!Array.isArray(raw.doors)) {
            errors.push('doors must be an array.');
        } else {
            for (let i = 0; i < raw.doors.length; i++) {
                const door = raw.doors[i];
                if (!door || !Number.isInteger(door.col) || !Number.isInteger(door.row)) {
                    errors.push(`doors[${i}] must include integer col/row.`);
                    break;
                }
                if (door.orientation !== 'horizontal' && door.orientation !== 'vertical') {
                    errors.push(`doors[${i}] has invalid orientation.`);
                    break;
                }
                const validHinge = ['left', 'right', 'top', 'bottom'];
                if (!validHinge.includes(door.hingeSide)) {
                    errors.push(`doors[${i}] has invalid hingeSide.`);
                    break;
                }
                const isVertical = door.orientation === 'vertical';
                if (isVertical && !['top', 'bottom'].includes(door.hingeSide)) {
                    errors.push(`doors[${i}] hingeSide must be top/bottom for vertical doors.`);
                    break;
                }
                if (!isVertical && !['left', 'right'].includes(door.hingeSide)) {
                    errors.push(`doors[${i}] hingeSide must be left/right for horizontal doors.`);
                    break;
                }
            }
        }

        if (raw.meta !== undefined && (typeof raw.meta !== 'object' || raw.meta === null)) {
            errors.push('meta must be an object when provided.');
        }

        if (raw.meta?.name !== undefined && typeof raw.meta.name !== 'string') {
            errors.push('meta.name must be a string when provided.');
        }

        if (raw.settings !== undefined) {
            if (typeof raw.settings !== 'object' || raw.settings === null) {
                errors.push('settings must be an object when provided.');
            } else {
                if (raw.settings.timeLimitMs !== undefined) {
                    if (!Number.isInteger(raw.settings.timeLimitMs) || raw.settings.timeLimitMs <= 0) {
                        errors.push('settings.timeLimitMs must be a positive integer when provided.');
                    }
                }
                if (raw.settings.maxTargetsToKill !== undefined) {
                    if (!Number.isInteger(raw.settings.maxTargetsToKill) || raw.settings.maxTargetsToKill <= 0) {
                        errors.push('settings.maxTargetsToKill must be a positive integer when provided.');
                    }
                }
            }
        }

        if (raw.targetSpawns !== undefined) {
            if (!Array.isArray(raw.targetSpawns)) {
                errors.push('targetSpawns must be an array when provided.');
            } else {
                for (let i = 0; i < raw.targetSpawns.length; i++) {
                    const spawn = raw.targetSpawns[i];
                    if (!spawn || !Number.isInteger(spawn.col) || !Number.isInteger(spawn.row)) {
                        errors.push(`targetSpawns[${i}] must include integer col/row.`);
                        break;
                    }
                }
            }
        }

        return errors;
    },

    normalizeMapData(raw) {
        const base = this.createDefaultMapData();
        const candidate = {
            version: this.VERSION,
            meta: typeof raw?.meta === 'object' && raw.meta !== null ? { ...raw.meta } : { ...base.meta },
            settings: {
                timeLimitMs: Number.isInteger(raw?.settings?.timeLimitMs) && raw.settings.timeLimitMs > 0
                    ? raw.settings.timeLimitMs
                    : (Number.isInteger(base?.settings?.timeLimitMs) ? base.settings.timeLimitMs : 120000),
                maxTargetsToKill: Number.isInteger(raw?.settings?.maxTargetsToKill) && raw.settings.maxTargetsToKill > 0
                    ? raw.settings.maxTargetsToKill
                    : (Number.isInteger(base?.settings?.maxTargetsToKill) ? base.settings.maxTargetsToKill : 1)
            },
            tileSize: Number.isInteger(raw?.tileSize) && raw.tileSize > 0 ? raw.tileSize : base.tileSize,
            cols: Number.isInteger(raw?.cols) && raw.cols > 0 ? raw.cols : base.cols,
            rows: Number.isInteger(raw?.rows) && raw.rows > 0 ? raw.rows : base.rows,
            tiles: Array.isArray(raw?.tiles) ? raw.tiles.slice() : base.tiles.slice(),
            doors: Array.isArray(raw?.doors) ? raw.doors.slice() : base.doors.slice(),
            playerSpawn: {
                col: Number.isInteger(raw?.playerSpawn?.col) ? raw.playerSpawn.col : base.playerSpawn.col,
                row: Number.isInteger(raw?.playerSpawn?.row) ? raw.playerSpawn.row : base.playerSpawn.row
            },
            targetSpawns: Array.isArray(raw?.targetSpawns) ? raw.targetSpawns.slice() : base.targetSpawns.slice()
        };

        if (candidate.tiles.length !== candidate.cols * candidate.rows) {
            candidate.tiles = this.createEmptyTiles(candidate.cols, candidate.rows, this.TILE_EMPTY);
        }

        const errors = this.validateMapData(candidate);
        if (errors.length > 0) {
            throw new Error(`Invalid map data: ${errors.join(' ')}`);
        }

        return candidate;
    },

    mapToJson(mapData) {
        return JSON.stringify(mapData, null, 2);
    },

    mapFromJson(text) {
        let raw;
        try {
            raw = JSON.parse(text);
        } catch (error) {
            throw new Error(`JSON parse error: ${error.message}`);
        }

        return this.normalizeMapData(raw);
    }
};

if (typeof window !== 'undefined') {
    window.MapFormat = MapFormat;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapFormat;
}
