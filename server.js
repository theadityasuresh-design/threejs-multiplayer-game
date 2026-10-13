import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve frontend from public/
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    players: Object.keys(players).length,
    orbs: orbs.filter(o => !o.collected).length
  });
});

// Game Configuration
const ARENA_SIZE = 60; // Arena bounds from -30 to 30
const NUM_ORBS = 18;
const RESPAWN_DELAY_MS = 3000;
const COLLECTION_RADIUS = 2.2;

const PLAYER_COLORS = [
  '#00f5d4', '#7b2cbf', '#f72585', '#4cc9f0',
  '#ffbe0b', '#fb5607', '#ff006e', '#8338ec',
  '#3a86ff', '#06d6a0', '#ef476f', '#118ab2'
];

const ORB_COLORS = [
  '#ff007f', '#00f0ff', '#ffe600', '#00ff66', '#bd00ff', '#ff5500'
];

function getRandomArenaPos() {
  const margin = 5;
  return (Math.random() - 0.5) * (ARENA_SIZE - margin * 2);
}

// Generate initial collectibles
const orbs = [];
for (let i = 0; i < NUM_ORBS; i++) {
  orbs.push({
    id: `orb_${i}`,
    x: getRandomArenaPos(),
    y: 1.0,
    z: getRandomArenaPos(),
    color: ORB_COLORS[i % ORB_COLORS.length],
    value: 10,
    collected: false
  });
}

// Connected players state
const players = {};
let colorIndex = 0;

io.on('connection', (socket) => {
  console.log(`[Socket.io] Player connected: ${socket.id}`);

  // Handle player joining
  socket.on('joinGame', (data) => {
    const playerName = (data && data.name) ? String(data.name).trim().slice(0, 15) : `Player_${socket.id.slice(0, 4)}`;
    const playerColor = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
    colorIndex++;

    const newPlayer = {
      id: socket.id,
      name: playerName || 'Player',
      color: playerColor,
      x: (Math.random() - 0.5) * 20,
      y: 0.9,
      z: (Math.random() - 0.5) * 20,
      rotationY: 0,
      score: 0
    };

    players[socket.id] = newPlayer;

    // Send full game state to the joining player
    socket.emit('gameState', {
      selfId: socket.id,
      players,
      orbs,
      arenaSize: ARENA_SIZE
    });

    // Notify other players
    socket.broadcast.emit('playerJoined', newPlayer);
    console.log(`[Game] ${newPlayer.name} (${socket.id}) joined. Total players: ${Object.keys(players).length}`);
  });

  // Handle player movement
  socket.on('playerMove', (moveData) => {
    const player = players[socket.id];
    if (!player) return;

    // Validate bounds
    const maxBound = ARENA_SIZE / 2;
    player.x = Math.max(-maxBound, Math.min(maxBound, Number(moveData.x) || 0));
    player.z = Math.max(-maxBound, Math.min(maxBound, Number(moveData.z) || 0));
    player.rotationY = Number(moveData.rotationY) || 0;

    // Broadcast movement to all other clients
    socket.broadcast.emit('playerMoved', {
      id: socket.id,
      x: player.x,
      z: player.z,
      rotationY: player.rotationY
    });

    // Server authoritative collection detection
    for (const orb of orbs) {
      if (orb.collected) continue;

      const dx = player.x - orb.x;
      const dz = player.z - orb.z;
      const distSq = dx * dx + dz * dz;

      if (distSq <= COLLECTION_RADIUS * COLLECTION_RADIUS) {
        // Mark as collected immediately to prevent duplicate claims
        orb.collected = true;
        player.score += orb.value;

        console.log(`[Collect] ${player.name} collected ${orb.id}! Score: ${player.score}`);

        // Broadcast collection event to all clients
        io.emit('orbCollected', {
          orbId: orb.id,
          collectorId: socket.id,
          collectorName: player.name,
          newScore: player.score
        });

        // Respawn orb after ~3 seconds
        setTimeout(() => {
          orb.collected = false;
          orb.x = getRandomArenaPos();
          orb.z = getRandomArenaPos();

          io.emit('orbSpawned', {
            id: orb.id,
            x: orb.x,
            y: orb.y,
            z: orb.z,
            color: orb.color,
            value: orb.value
          });
        }, RESPAWN_DELAY_MS);

        break; // Max 1 orb per move step
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const player = players[socket.id];
    if (player) {
      console.log(`[Socket.io] Player disconnected: ${player.name} (${socket.id})`);
      delete players[socket.id];
      io.emit('playerLeft', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Multiplayer 3D Game Server running on port ${PORT}`);
  console.log(` http://localhost:${PORT}`);
  console.log(`===============================================`);
});
