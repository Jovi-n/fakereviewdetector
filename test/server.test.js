const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const PORT = 3100;

async function startServer() {
  const child = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT), GOOGLE_MAPS_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server start timeout')), 5000);

    child.stdout.on('data', (data) => {
      if (String(data).includes(`http://localhost:${PORT}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      reject(new Error(`server exited early with ${code}`));
    });
  });

  return child;
}

async function stopServer(child) {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.on('exit', resolve));
}

test('analyze endpoint falls back to demo mode when API key is not set', async () => {
  const child = await startServer();

  try {
    const response = await fetch(`http://localhost:${PORT}/api/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mapsUrl: 'https://maps.google.com/?q=place_id:ChIJN1t_tDeuEmsRUsoyG83frY4' })
    });

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.mode, 'demo');
    assert.equal(typeof payload.warning, 'string');
    assert.equal(payload.summary.totalReviews > 0, true);
  } finally {
    await stopServer(child);
  }
});

test('accepts normal Google Maps URL without place_id and still returns demo analysis', async () => {
  const child = await startServer();

  try {
    const response = await fetch(`http://localhost:${PORT}/api/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mapsUrl: 'https://www.google.com/maps/place/Taj+Mahal/@27.1751,78.0421,17z' })
    });

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.mode, 'demo');
    assert.equal(payload.summary.totalReviews > 0, true);
    assert.equal(typeof payload.place.name, 'string');
  } finally {
    await stopServer(child);
  }
});
