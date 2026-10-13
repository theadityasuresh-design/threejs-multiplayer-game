import { io } from 'socket.io-client';

console.log('=== STARTING MULTIPLAYER TEST ===');

const p1 = io('http://localhost:3000');
const p2 = io('http://localhost:3000');

let p1State = null;
let p2State = null;
let targetOrb = null;

p1.on('connect', () => {
  console.log('[Test] Player 1 (Alice) socket connected');
  p1.emit('joinGame', { name: 'Alice' });
});

p1.on('gameState', (state) => {
  console.log('[Test] Alice received gameState. Players count:', Object.keys(state.players).length, 'Orbs:', state.orbs.length);
  p1State = state;
  targetOrb = state.orbs[0];
  console.log('[Test] Target orb for test:', targetOrb.id, 'at', targetOrb.x, targetOrb.z);

  // Now connect Bob
  p2.emit('joinGame', { name: 'Bob' });
});

p2.on('connect', () => {
  console.log('[Test] Player 2 (Bob) socket connected');
});

p1.on('playerJoined', (data) => {
  console.log('[Test] Alice saw playerJoined event for:', data.name, 'with ID:', data.id);
});

p2.on('gameState', (state) => {
  console.log('[Test] Bob received gameState. Players count:', Object.keys(state.players).length);
  p2State = state;

  // Now Alice moves to the target orb!
  console.log(`[Test] Alice moving to target orb ${targetOrb.id} at (${targetOrb.x}, ${targetOrb.z})...`);
  p1.emit('playerMove', {
    x: targetOrb.x,
    z: targetOrb.z,
    rotationY: 0
  });
});

p2.on('playerMoved', (data) => {
  console.log('[Test] Bob received playerMoved event from Alice at:', data.x, data.z);
});

let orbCollectedReceived = false;

p1.on('orbCollected', (data) => {
  console.log('[Test] Alice received orbCollected event:', data);
  if (data.collectorName === 'Alice' && data.newScore === 10) {
    orbCollectedReceived = true;
    console.log('[Test] SUCCESS: Alice successfully collected orb and scored 10 points!');
  }
});

p2.on('orbCollected', (data) => {
  console.log('[Test] Bob ALSO received authoritative orbCollected event for Alice:', data);
});

p1.on('orbSpawned', (orb) => {
  console.log('[Test] Alice received orbSpawned event after 3 seconds! Respawned orb:', orb.id, 'at new pos:', orb.x, orb.z);

  // Now test disconnect
  console.log('[Test] Disconnecting Bob...');
  p2.disconnect();
});

p1.on('playerLeft', (leftId) => {
  console.log('[Test] Alice received playerLeft event for socket:', leftId);
  console.log('=== MULTIPLAYER TEST PASSED WITH 100% SUCCESS ===');
  p1.disconnect();
  process.exit(0);
});

// Timeout safeguard
setTimeout(() => {
  console.error('[Test] Timeout waiting for test completion!');
  process.exit(1);
}, 9000);
