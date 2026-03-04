const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'maps');

function loadFixtureMap(name) {
  const filePath = path.join(FIXTURE_DIR, `${name}.json`);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function loadFixtureMetadata() {
  const filePath = path.join(FIXTURE_DIR, 'metadata.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

async function setActiveMap(page, name, storageKey = 'shooterjs.activeMap.v1') {
  const map = loadFixtureMap(name);
  await page.addInitScript(
    ({ key, payload }) => {
      localStorage.setItem(key, JSON.stringify(payload));
    },
    { key: storageKey, payload: map }
  );
  return map;
}

module.exports = {
  loadFixtureMap,
  loadFixtureMetadata,
  setActiveMap
};
