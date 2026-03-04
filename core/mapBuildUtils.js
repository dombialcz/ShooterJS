// Pure-ish map build utilities for runtime and tests.
const MapFormatRef = typeof MapFormat !== 'undefined' ? MapFormat : require('../mapFormat.js');
const MapConfigRef = typeof CONFIG !== 'undefined'
    ? CONFIG
    : {
          DOOR_WIDTH: 60
      };

const MapBuildUtils = {
    extractWallSegments(mapData) {
        const tileSize = mapData.tileSize;
        const segments = [];

        const isWall = (col, row) => {
            if (col < 0 || row < 0 || col >= mapData.cols || row >= mapData.rows) {
                return false;
            }
            return mapData.tiles[row * mapData.cols + col] === MapFormatRef.TILE_WALL;
        };

        for (let row = 0; row < mapData.rows; row++) {
            for (let col = 0; col < mapData.cols; col++) {
                if (!isWall(col, row)) continue;

                const left = col * tileSize;
                const top = row * tileSize;
                const right = left + tileSize;
                const bottom = top + tileSize;

                if (!isWall(col, row - 1)) segments.push({ orientation: 'h', x1: left, y1: top, x2: right, y2: top });
                if (!isWall(col + 1, row)) segments.push({ orientation: 'v', x1: right, y1: top, x2: right, y2: bottom });
                if (!isWall(col, row + 1)) segments.push({ orientation: 'h', x1: left, y1: bottom, x2: right, y2: bottom });
                if (!isWall(col - 1, row)) segments.push({ orientation: 'v', x1: left, y1: top, x2: left, y2: bottom });
            }
        }

        return this.mergeSegments(segments);
    },

    mergeSegments(segments) {
        const merged = [];
        const horizontal = segments.filter((s) => s.orientation === 'h');
        const vertical = segments.filter((s) => s.orientation === 'v');

        const byY = new Map();
        for (const segment of horizontal) {
            const key = segment.y1;
            if (!byY.has(key)) byY.set(key, []);
            byY.get(key).push(segment);
        }

        for (const list of byY.values()) {
            if (list.length === 0) continue;
            list.sort((a, b) => a.x1 - b.x1);
            let current = { ...list[0] };
            for (let i = 1; i < list.length; i++) {
                const next = list[i];
                if (Math.abs(current.x2 - next.x1) < 0.001) {
                    current.x2 = next.x2;
                } else {
                    merged.push({ x1: current.x1, y1: current.y1, x2: current.x2, y2: current.y2 });
                    current = { ...next };
                }
            }
            merged.push({ x1: current.x1, y1: current.y1, x2: current.x2, y2: current.y2 });
        }

        const byX = new Map();
        for (const segment of vertical) {
            const key = segment.x1;
            if (!byX.has(key)) byX.set(key, []);
            byX.get(key).push(segment);
        }

        for (const list of byX.values()) {
            if (list.length === 0) continue;
            list.sort((a, b) => a.y1 - b.y1);
            let current = { ...list[0] };
            for (let i = 1; i < list.length; i++) {
                const next = list[i];
                if (Math.abs(current.y2 - next.y1) < 0.001) {
                    current.y2 = next.y2;
                } else {
                    merged.push({ x1: current.x1, y1: current.y1, x2: current.x2, y2: current.y2 });
                    current = { ...next };
                }
            }
            merged.push({ x1: current.x1, y1: current.y1, x2: current.x2, y2: current.y2 });
        }

        return merged;
    },

    getDoorEntityDefinition(mapData, doorData) {
        const tile = mapData.tileSize;
        const width = Math.max(MapConfigRef.DOOR_WIDTH, tile);

        if (doorData.orientation === 'vertical') {
            const x = (doorData.col + 0.5) * tile;
            if (doorData.hingeSide === 'top') {
                return { hingeX: x, hingeY: doorData.row * tile, width, hingeAngle: Math.PI / 2 };
            }
            if (doorData.hingeSide === 'bottom') {
                return { hingeX: x, hingeY: (doorData.row + 2) * tile, width, hingeAngle: -Math.PI / 2 };
            }
            return null;
        }

        if (doorData.orientation === 'horizontal') {
            const y = (doorData.row + 0.5) * tile;
            if (doorData.hingeSide === 'left') {
                return { hingeX: doorData.col * tile, hingeY: y, width, hingeAngle: 0 };
            }
            if (doorData.hingeSide === 'right') {
                return { hingeX: (doorData.col + 2) * tile, hingeY: y, width, hingeAngle: Math.PI };
            }
            return null;
        }

        return null;
    }
};

if (typeof window !== 'undefined') {
    window.MapBuildUtils = MapBuildUtils;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapBuildUtils;
}
