const AStarMapFormatRef = (typeof window !== 'undefined' && window.MapFormat)
    ? window.MapFormat
    : ((typeof MapFormat !== 'undefined')
        ? MapFormat
        : ((typeof module !== 'undefined' && module.exports) ? require('../mapFormat.js') : null));

const AStarPathfinding = {
    buildPassabilityGrid(mapData, gameState, options = {}) {
        const wallTileValue = AStarMapFormatRef ? AStarMapFormatRef.TILE_WALL : 1;
        const cols = mapData.cols;
        const rows = mapData.rows;
        const grid = new Array(rows);

        for (let row = 0; row < rows; row++) {
            const line = new Array(cols);
            for (let col = 0; col < cols; col++) {
                const tile = mapData.tiles[row * cols + col];
                line[col] = tile !== wallTileValue;
            }
            grid[row] = line;
        }

        if (options.includeBlocks !== false && Array.isArray(gameState?.blocks)) {
            for (const blockEntity of gameState.blocks) {
                const transform = blockEntity.getComponent('transform');
                const collision = blockEntity.getComponent('collision');
                if (!transform || !collision || collision.type !== 'aabb') continue;
                const centerCol = Math.floor(transform.x / mapData.tileSize);
                const centerRow = Math.floor(transform.y / mapData.tileSize);
                if (centerCol >= 0 && centerCol < cols && centerRow >= 0 && centerRow < rows) {
                    grid[centerRow][centerCol] = false;
                }
            }
        }

        return grid;
    },

    findPath(grid, startCol, startRow, goalCol, goalRow, options = {}) {
        if (!this.isPassable(grid, startCol, startRow) || !this.isPassable(grid, goalCol, goalRow)) {
            return { path: [], reached: false, expansions: 0 };
        }

        const maxExpansions = Math.max(1, options.maxExpansions || 220);
        const open = [];
        const parents = new Map();
        const gScore = new Map();
        const closed = new Set();
        const startKey = this.key(startCol, startRow);
        const goalKey = this.key(goalCol, goalRow);
        gScore.set(startKey, 0);
        open.push(this.makeNode(startCol, startRow, 0, this.heuristic(startCol, startRow, goalCol, goalRow)));

        let expansions = 0;

        while (open.length > 0 && expansions < maxExpansions) {
            open.sort((a, b) => this.compareNodes(a, b));
            const current = open.shift();
            const currentKey = this.key(current.col, current.row);
            if (closed.has(currentKey)) continue;

            if (currentKey === goalKey) {
                return {
                    path: this.reconstructPath(parents, current.col, current.row),
                    reached: true,
                    expansions
                };
            }

            closed.add(currentKey);
            expansions += 1;

            for (const neighbor of this.getNeighbors(current.col, current.row)) {
                if (!this.isPassable(grid, neighbor.col, neighbor.row)) continue;
                const neighborKey = this.key(neighbor.col, neighbor.row);
                if (closed.has(neighborKey)) continue;

                const tentativeG = current.g + 1;
                const knownG = gScore.has(neighborKey) ? gScore.get(neighborKey) : Infinity;
                if (tentativeG >= knownG) continue;

                gScore.set(neighborKey, tentativeG);
                parents.set(neighborKey, currentKey);
                const h = this.heuristic(neighbor.col, neighbor.row, goalCol, goalRow);
                open.push(this.makeNode(neighbor.col, neighbor.row, tentativeG, h));
            }
        }

        return { path: [], reached: false, expansions };
    },

    makeNode(col, row, g, h) {
        return {
            col,
            row,
            g,
            h,
            f: g + h
        };
    },

    compareNodes(a, b) {
        if (a.f !== b.f) return a.f - b.f;
        if (a.h !== b.h) return a.h - b.h;
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
    },

    reconstructPath(parents, goalCol, goalRow) {
        const path = [];
        let cursorKey = this.key(goalCol, goalRow);
        while (cursorKey) {
            const [colText, rowText] = cursorKey.split(',');
            path.push({ col: Number.parseInt(colText, 10), row: Number.parseInt(rowText, 10) });
            cursorKey = parents.get(cursorKey) || null;
        }
        path.reverse();
        return path;
    },

    heuristic(col, row, goalCol, goalRow) {
        return Math.abs(goalCol - col) + Math.abs(goalRow - row);
    },

    key(col, row) {
        return `${col},${row}`;
    },

    isPassable(grid, col, row) {
        if (row < 0 || row >= grid.length) return false;
        const line = grid[row];
        if (!line || col < 0 || col >= line.length) return false;
        return Boolean(line[col]);
    },

    getNeighbors(col, row) {
        return [
            { col: col + 1, row },
            { col: col - 1, row },
            { col, row: row + 1 },
            { col, row: row - 1 }
        ];
    },

    worldToCell(mapData, x, y) {
        return {
            col: Math.floor(x / mapData.tileSize),
            row: Math.floor(y / mapData.tileSize)
        };
    },

    cellToWorld(mapData, col, row) {
        return {
            x: col * mapData.tileSize + mapData.tileSize / 2,
            y: row * mapData.tileSize + mapData.tileSize / 2
        };
    }
};

if (typeof window !== 'undefined') {
    window.AStarPathfinding = AStarPathfinding;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AStarPathfinding;
}
