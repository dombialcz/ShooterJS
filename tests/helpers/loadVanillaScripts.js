const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScripts(relativePaths, contextExtras = {}) {
  const context = {
    console,
    Math,
    Date,
    JSON,
    CONFIG: {
      CANVAS_WIDTH: 1280,
      CANVAS_HEIGHT: 720,
      MAP_TILE_SIZE: 40,
      BLOCK_PUSH_FORCE: 190,
      BLOCK_MAX_SPEED: 260,
      DOOR_PUSH_FORCE: 0.15,
      DOOR_WIDTH: 60,
      WALL_THICKNESS: 10,
      VISION_RANGE: 600,
      RAY_COUNT: 60
    },
    ...contextExtras
  };

  vm.createContext(context);

  for (const relPath of relativePaths) {
    const absPath = path.join(process.cwd(), relPath);
    const code = fs.readFileSync(absPath, 'utf8');
    vm.runInContext(code, context, { filename: relPath });
  }

  const knownSymbols = [
    'Geometry',
    'Collision',
    'DoorSystem',
    'MapFormat',
    'MapBuildUtils',
    'SimulationCore'
  ];

  for (const symbol of knownSymbols) {
    try {
      const value = vm.runInContext(
        `typeof ${symbol} !== 'undefined' ? ${symbol} : undefined`,
        context
      );
      if (value !== undefined) {
        context[symbol] = value;
      }
    } catch (_error) {
      // Ignore missing symbols for scripts that don't define them.
    }
  }

  return context;
}

module.exports = {
  loadScripts
};
