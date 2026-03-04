(() => {
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    const statusEl = document.getElementById('status');
    const jsonArea = document.getElementById('jsonArea');

    const toolGrid = document.getElementById('toolGrid');
    const orientationSelect = document.getElementById('doorOrientation');
    const hingeSelect = document.getElementById('doorHinge');

    let activeTool = 'wall';
    let isPainting = false;
    let mapData = loadInitialMap();

    setup();

    function setup() {
        refreshHingeOptions();
        bindToolButtons();
        bindControls();
        render();
        setStatus('Map loaded.');
    }

    function loadInitialMap() {
        const raw = localStorage.getItem(CONFIG.MAP_STORAGE_KEY);
        if (!raw) {
            const defaultMap = MapFormat.createDefaultMapData();
            jsonArea.value = MapFormat.mapToJson(defaultMap);
            return defaultMap;
        }

        try {
            const map = MapFormat.mapFromJson(raw);
            jsonArea.value = MapFormat.mapToJson(map);
            return map;
        } catch (error) {
            const fallback = MapFormat.createDefaultMapData();
            jsonArea.value = MapFormat.mapToJson(fallback);
            setStatus(`Saved map invalid. Loaded default (${error.message})`, true);
            return fallback;
        }
    }

    function bindToolButtons() {
        for (const button of toolGrid.querySelectorAll('button[data-tool]')) {
            button.addEventListener('click', () => {
                activeTool = button.dataset.tool;
                refreshToolHighlight();
            });
        }
        refreshToolHighlight();
    }

    function bindControls() {
        orientationSelect.addEventListener('change', () => {
            refreshHingeOptions();
            render();
        });

        canvas.addEventListener('mousedown', (event) => {
            if (event.button !== 0) return;
            isPainting = true;
            applyToolAtEvent(event);
        });

        canvas.addEventListener('mousemove', (event) => {
            if (!isPainting) return;
            if (!['wall', 'block', 'erase'].includes(activeTool)) return;
            applyToolAtEvent(event);
        });

        window.addEventListener('mouseup', () => {
            isPainting = false;
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            persistMap();
            setStatus('Map saved to browser storage.');
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            jsonArea.value = MapFormat.mapToJson(mapData);
            setStatus('JSON exported to text area.');
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            try {
                const imported = MapFormat.mapFromJson(jsonArea.value);
                mapData = imported;
                render();
                setStatus('JSON imported successfully.');
            } catch (error) {
                setStatus(`Import failed: ${error.message}`, true);
            }
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            mapData = MapFormat.createDefaultMapData();
            jsonArea.value = MapFormat.mapToJson(mapData);
            render();
            setStatus('Reset to default map.');
        });

        document.getElementById('previewBtn').addEventListener('click', () => {
            persistMap();
            window.open('./index.html', '_blank');
        });
    }

    function refreshToolHighlight() {
        for (const button of toolGrid.querySelectorAll('button[data-tool]')) {
            button.classList.toggle('active', button.dataset.tool === activeTool);
        }
    }

    function refreshHingeOptions() {
        const orientation = orientationSelect.value;
        const values = orientation === 'vertical' ? ['top', 'bottom'] : ['left', 'right'];

        const previous = hingeSelect.value;
        hingeSelect.innerHTML = '';
        for (const value of values) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            hingeSelect.appendChild(option);
        }

        if (values.includes(previous)) {
            hingeSelect.value = previous;
        }
    }

    function applyToolAtEvent(event) {
        const cell = eventToCell(event);
        if (!cell) return;

        if (activeTool === 'wall') {
            placeTile(cell.col, cell.row, MapFormat.TILE_WALL);
            removeDoorAt(cell.col, cell.row);
        } else if (activeTool === 'block') {
            placeTile(cell.col, cell.row, MapFormat.TILE_BLOCK);
            removeDoorAt(cell.col, cell.row);
        } else if (activeTool === 'erase') {
            placeTile(cell.col, cell.row, MapFormat.TILE_EMPTY);
            removeDoorAt(cell.col, cell.row);
        } else if (activeTool === 'player') {
            mapData.playerSpawn = { col: cell.col, row: cell.row };
        } else if (activeTool === 'door') {
            placeDoor(cell.col, cell.row, orientationSelect.value, hingeSelect.value);
        }

        render();
    }

    function placeTile(col, row, value) {
        if (!inBounds(col, row)) return;
        mapData.tiles[row * mapData.cols + col] = value;
    }

    function placeDoor(col, row, orientation, hingeSide) {
        const door = { col, row, orientation, hingeSide };

        if (orientation === 'vertical') {
            if (!inBounds(col, row) || !inBounds(col, row + 1)) {
                setStatus('Door placement out of bounds.', true);
                return;
            }
            placeTile(col, row, MapFormat.TILE_EMPTY);
            placeTile(col, row + 1, MapFormat.TILE_EMPTY);
            removeDoorAt(col, row);
            removeDoorAt(col, row + 1);
        } else {
            if (!inBounds(col, row) || !inBounds(col + 1, row)) {
                setStatus('Door placement out of bounds.', true);
                return;
            }
            placeTile(col, row, MapFormat.TILE_EMPTY);
            placeTile(col + 1, row, MapFormat.TILE_EMPTY);
            removeDoorAt(col, row);
            removeDoorAt(col + 1, row);
        }

        mapData.doors.push(door);
    }

    function removeDoorAt(col, row) {
        mapData.doors = mapData.doors.filter((door) => {
            if (door.orientation === 'vertical') {
                return !((door.col === col && door.row === row) || (door.col === col && door.row + 1 === row));
            }
            return !((door.col === col && door.row === row) || (door.col + 1 === col && door.row === row));
        });
    }

    function inBounds(col, row) {
        return col >= 0 && row >= 0 && col < mapData.cols && row < mapData.rows;
    }

    function eventToCell(event) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        const col = Math.floor(x / mapData.tileSize);
        const row = Math.floor(y / mapData.tileSize);

        if (!inBounds(col, row)) return null;
        return { col, row };
    }

    function persistMap() {
        const normalized = MapFormat.normalizeMapData(mapData);
        mapData = normalized;
        const text = MapFormat.mapToJson(normalized);
        localStorage.setItem(CONFIG.MAP_STORAGE_KEY, text);
        jsonArea.value = text;
    }

    function render() {
        drawBackground();
        drawGrid();
        drawTiles();
        drawDoors();
        drawPlayerSpawn();
    }

    function drawBackground() {
        ctx.fillStyle = '#1e2329';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawGrid() {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;

        for (let col = 0; col <= mapData.cols; col++) {
            const x = col * mapData.tileSize;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        for (let row = 0; row <= mapData.rows; row++) {
            const y = row * mapData.tileSize;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    function drawTiles() {
        for (let row = 0; row < mapData.rows; row++) {
            for (let col = 0; col < mapData.cols; col++) {
                const value = mapData.tiles[row * mapData.cols + col];
                if (value === MapFormat.TILE_EMPTY) continue;

                const x = col * mapData.tileSize;
                const y = row * mapData.tileSize;

                if (value === MapFormat.TILE_WALL) {
                    ctx.fillStyle = '#515964';
                } else if (value === MapFormat.TILE_BLOCK) {
                    ctx.fillStyle = '#7fb069';
                }

                ctx.fillRect(x + 1, y + 1, mapData.tileSize - 2, mapData.tileSize - 2);
            }
        }
    }

    function drawDoors() {
        for (const door of mapData.doors) {
            const tile = mapData.tileSize;
            ctx.strokeStyle = '#b7773d';
            ctx.lineWidth = 4;
            ctx.fillStyle = '#d8b38d';

            if (door.orientation === 'vertical') {
                const x = (door.col + 0.5) * tile;
                const y1 = door.row * tile;
                const y2 = (door.row + 2) * tile;
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();

                const hy = door.hingeSide === 'top' ? y1 : y2;
                ctx.beginPath();
                ctx.arc(x, hy, 4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                const y = (door.row + 0.5) * tile;
                const x1 = door.col * tile;
                const x2 = (door.col + 2) * tile;
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
                ctx.stroke();

                const hx = door.hingeSide === 'left' ? x1 : x2;
                ctx.beginPath();
                ctx.arc(hx, y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawPlayerSpawn() {
        const x = mapData.playerSpawn.col * mapData.tileSize + mapData.tileSize / 2;
        const y = mapData.playerSpawn.row * mapData.tileSize + mapData.tileSize / 2;

        ctx.strokeStyle = '#52b2ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, mapData.tileSize * 0.25, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y);
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x, y + 10);
        ctx.stroke();
    }

    function setStatus(text, isError = false) {
        statusEl.textContent = text;
        statusEl.style.color = isError ? '#ff7c7c' : '#f2c14e';
    }
})();
