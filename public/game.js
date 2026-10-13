import { playCollectSound, playJoinSound, playStepSound } from './audio.js';

// --- THREE.JS INITIALIZATION ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090e);
scene.fog = new THREE.FogExp2(0x07090e, 0.018);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 10, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xddeeff, 0.45);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
dirLight.position.set(30, 45, 25);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 10;
dirLight.shadow.camera.far = 120;
dirLight.shadow.camera.left = -40;
dirLight.shadow.camera.right = 40;
dirLight.shadow.camera.top = 40;
dirLight.shadow.camera.bottom = -40;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

// --- ARENA ENVIRONMENT ---
let ARENA_SIZE = 60;

// Cyberpunk Grid Ground Canvas
function createGridFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Dark metallic slate base
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, 1024, 1024);

  // Neon grid lines
  const gridSize = 64;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 1024; i += gridSize) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Major accent grid lines
  ctx.strokeStyle = 'rgba(112, 0, 255, 0.28)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 1024; i += gridSize * 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

const floorGeo = new THREE.PlaneGeometry(ARENA_SIZE + 4, ARENA_SIZE + 4);
const floorMat = new THREE.MeshStandardMaterial({
  map: createGridFloorTexture(),
  roughness: 0.4,
  metalness: 0.6
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Glowing Perimeter Barrier Walls
function buildPerimeterWall(w, h, d, x, y, z) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x141824,
    emissive: 0x00f0ff,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.8
  });
  const wall = new THREE.Mesh(geo, mat);
  wall.position.set(x, y, z);
  wall.receiveShadow = true;
  wall.castShadow = true;
  scene.add(wall);

  // Top Neon Edge Strip
  const stripGeo = new THREE.BoxGeometry(w, 0.15, d);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const strip = new THREE.Mesh(stripGeo, stripMat);
  strip.position.set(x, y + h / 2 + 0.08, z);
  scene.add(strip);
}

const halfA = ARENA_SIZE / 2;
const wallH = 2.4;
buildPerimeterWall(ARENA_SIZE, wallH, 0.6, 0, wallH / 2, -halfA);
buildPerimeterWall(ARENA_SIZE, wallH, 0.6, 0, wallH / 2, halfA);
buildPerimeterWall(0.6, wallH, ARENA_SIZE, -halfA, wallH / 2, 0);
buildPerimeterWall(0.6, wallH, ARENA_SIZE, halfA, wallH / 2, 0);

// Decorative Arena Neon Pillars
const pillars = [
  { x: -16, z: -16 }, { x: 16, z: -16 },
  { x: -16, z: 16 }, { x: 16, z: 16 },
  { x: 0, z: -20 }, { x: 0, z: 20 },
  { x: -20, z: 0 }, { x: 20, z: 0 }
];

pillars.forEach(p => {
  const colGeo = new THREE.CylinderGeometry(1.2, 1.4, 4.5, 16);
  const colMat = new THREE.MeshStandardMaterial({ color: 0x181e2b, roughness: 0.5, metalness: 0.5 });
  const col = new THREE.Mesh(colGeo, colMat);
  col.position.set(p.x, 2.25, p.z);
  col.castShadow = true;
  col.receiveShadow = true;
  scene.add(col);

  // Glowing Ring on Pillar
  const ringGeo = new THREE.TorusGeometry(1.35, 0.08, 8, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x7000ff });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(p.x, 3.2, p.z);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
});

// --- DYNAMIC SPRITE NAMETAG BUILDER ---
function createNameplateSprite(name, color, score = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');

  // Background rounded pill
  ctx.fillStyle = 'rgba(8, 11, 18, 0.82)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;

  const r = 18, x = 6, y = 6, w = 244, h = 60;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Name Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 34);

  // Score Text
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`★ ${score} pts`, 128, 56);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(3.2, 0.9, 1);
  sprite.position.y = 2.4;
  return { sprite, canvas, ctx, texture };
}

function updateNameplateSprite(nameplateObj, name, color, score) {
  const { ctx, canvas, texture } = nameplateObj;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(8, 11, 18, 0.82)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;

  const r = 18, x = 6, y = 6, w = 244, h = 60;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 34);

  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`★ ${score} pts`, 128, 56);

  texture.needsUpdate = true;
}

// --- PLAYER 3D MODEL BUILDER ---
function createPlayerMesh(playerData, isSelf = false) {
  const group = new THREE.Group();

  // 1. Hover Capsule Body
  const bodyGeo = new THREE.CylinderGeometry(0.7, 0.55, 1.3, 24);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: playerData.color,
    roughness: 0.3,
    metalness: 0.7
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.85;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 2. Dome Head
  const headGeo = new THREE.SphereGeometry(0.6, 24, 16);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x1f2430,
    roughness: 0.2,
    metalness: 0.85
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.5;
  head.castShadow = true;
  group.add(head);

  // 3. Glowing Visor (front facing)
  const visorGeo = new THREE.BoxGeometry(0.55, 0.2, 0.25);
  const visorMat = new THREE.MeshBasicMaterial({ color: isSelf ? 0x00f5d4 : 0xff007f });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 1.5, 0.5);
  group.add(visor);

  // 4. Thruster Ring at bottom
  const thrusterGeo = new THREE.TorusGeometry(0.5, 0.08, 12, 24);
  const thrusterMat = new THREE.MeshBasicMaterial({ color: playerData.color });
  const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
  thruster.rotation.x = Math.PI / 2;
  thruster.position.y = 0.2;
  group.add(thruster);

  // 5. Projected Soft Floor Shadow
  const shadowGeo = new THREE.CircleGeometry(0.85, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.45
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // 6. Nameplate Sprite
  const nameplateObj = createNameplateSprite(playerData.name, playerData.color, playerData.score);
  group.add(nameplateObj.sprite);

  group.position.set(playerData.x, 0, playerData.z);
  group.rotation.y = playerData.rotationY || 0;

  scene.add(group);
  return { group, nameplateObj };
}

// --- COLLECTIBLE ORBS SYSTEM ---
const orbsMeshes = new Map();

function createOrbMesh(orbData) {
  const orbGroup = new THREE.Group();

  // 1. Pulsating Icosahedron Core
  const coreGeo = new THREE.IcosahedronGeometry(0.65, 1);
  const coreMat = new THREE.MeshStandardMaterial({
    color: orbData.color,
    emissive: orbData.color,
    emissiveIntensity: 0.9,
    roughness: 0.15,
    metalness: 0.3
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.castShadow = true;
  orbGroup.add(core);

  // 2. Revolving Orbit Ring
  const ringGeo = new THREE.TorusGeometry(1.0, 0.04, 8, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: orbData.color });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  orbGroup.add(ring);

  // 3. PointLight radiating onto nearby arena
  const light = new THREE.PointLight(orbData.color, 1.2, 7);
  light.position.set(0, 0, 0);
  orbGroup.add(light);

  orbGroup.position.set(orbData.x, orbData.y, orbData.z);
  orbGroup.visible = !orbData.collected;

  scene.add(orbGroup);
  return { group: orbGroup, core, ring, data: orbData };
}

// Particle Collection Burst Effect
const activeParticles = [];

function triggerCollectionParticles(x, y, z, color) {
  const pCount = 20;
  const geom = new THREE.SphereGeometry(0.08, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: color });

  for (let i = 0; i < pCount; i++) {
    const pMesh = new THREE.Mesh(geom, mat);
    pMesh.position.set(x, y, z);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 8,
      Math.random() * 6 + 2,
      (Math.random() - 0.5) * 8
    );
    scene.add(pMesh);
    activeParticles.push({ mesh: pMesh, vel, life: 1.0 });
  }
}

function updateParticles(delta) {
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];
    p.life -= delta * 2.2;
    p.mesh.position.addScaledVector(p.vel, delta);
    p.vel.y -= 12 * delta; // gravity
    p.mesh.scale.setScalar(Math.max(0.01, p.life));

    if (p.life <= 0) {
      scene.remove(p.mesh);
      activeParticles.splice(i, 1);
    }
  }
}

// --- GAME STATE & NETWORKING ---
const socket = io();

let selfId = null;
let selfPlayer = null;
let selfPlayerMeshObj = null;

const remotePlayers = new Map(); // id -> { meshObj, targetX, targetZ, targetRot, data }

// UI Elements
const scoreCounter = document.getElementById('score-counter');
const playerCountText = document.getElementById('player-count-text');
const leaderboardList = document.getElementById('leaderboard-list');
const notificationBox = document.getElementById('notification-box');
const startOverlay = document.getElementById('start-overlay');
const joinBtn = document.getElementById('join-btn');
const playerNameInput = document.getElementById('player-name-input');

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  notificationBox.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3200);
}

function updateLeaderboard() {
  const allPlayers = [];
  if (selfPlayer) allPlayers.push(selfPlayer);
  remotePlayers.forEach(p => allPlayers.push(p.data));

  // Sort descending by score
  allPlayers.sort((a, b) => b.score - a.score);

  leaderboardList.innerHTML = '';
  allPlayers.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = `leaderboard-row ${p.id === selfId ? 'is-self' : ''}`;
    row.innerHTML = `
      <div class="player-name-wrapper">
        <span class="player-color-dot" style="background: ${p.color};"></span>
        <span>#${idx + 1} ${p.name}</span>
      </div>
      <span class="leaderboard-score">${p.score}</span>
    `;
    leaderboardList.appendChild(row);
  });

  playerCountText.textContent = `${allPlayers.length} Player${allPlayers.length === 1 ? '' : 's'} Online`;
}

// --- SOCKET.IO EVENT HANDLERS ---
socket.on('gameState', (data) => {
  console.log('[Socket] Received gameState:', data);
  selfId = data.selfId;
  ARENA_SIZE = data.arenaSize || 60;

  // Clear existing
  remotePlayers.forEach(p => scene.remove(p.meshObj.group));
  remotePlayers.clear();
  orbsMeshes.forEach(o => scene.remove(o.group));
  orbsMeshes.clear();

  // Spawn Orbs
  data.orbs.forEach(orbData => {
    orbsMeshes.set(orbData.id, createOrbMesh(orbData));
  });

  // Spawn Existing Players
  Object.values(data.players).forEach(pData => {
    if (pData.id === selfId) {
      selfPlayer = pData;
      selfPlayerMeshObj = createPlayerMesh(pData, true);
      scoreCounter.textContent = pData.score;
    } else {
      const meshObj = createPlayerMesh(pData, false);
      remotePlayers.set(pData.id, {
        meshObj,
        targetX: pData.x,
        targetZ: pData.z,
        targetRot: pData.rotationY || 0,
        data: pData
      });
    }
  });

  updateLeaderboard();
  showToast(`Connected! Arena initialized.`);
});

socket.on('playerJoined', (pData) => {
  if (pData.id === selfId) return;
  console.log('[Socket] Player joined:', pData.name);

  const meshObj = createPlayerMesh(pData, false);
  remotePlayers.set(pData.id, {
    meshObj,
    targetX: pData.x,
    targetZ: pData.z,
    targetRot: pData.rotationY || 0,
    data: pData
  });

  playJoinSound();
  showToast(`⚡ ${pData.name} joined the game!`);
  updateLeaderboard();
});

socket.on('playerMoved', (moveData) => {
  const remote = remotePlayers.get(moveData.id);
  if (remote) {
    remote.targetX = moveData.x;
    remote.targetZ = moveData.z;
    remote.targetRot = moveData.rotationY;
    remote.data.x = moveData.x;
    remote.data.z = moveData.z;
    remote.data.rotationY = moveData.rotationY;
  }
});

socket.on('orbCollected', (data) => {
  console.log('[Socket] Orb collected:', data);
  const orbObj = orbsMeshes.get(data.orbId);
  if (orbObj) {
    orbObj.group.visible = false;
    orbObj.data.collected = true;
    triggerCollectionParticles(orbObj.group.position.x, orbObj.group.position.y, orbObj.group.position.z, orbObj.data.color);
  }

  const isSelf = (data.collectorId === selfId);
  playCollectSound(isSelf);

  if (isSelf) {
    selfPlayer.score = data.newScore;
    scoreCounter.textContent = selfPlayer.score;
    scoreCounter.classList.add('bump');
    setTimeout(() => scoreCounter.classList.remove('bump'), 220);
    updateNameplateSprite(selfPlayerMeshObj.nameplateObj, selfPlayer.name, selfPlayer.color, selfPlayer.score);
    showToast(`★ You collected an Orb! (+10 pts)`);
  } else {
    const remote = remotePlayers.get(data.collectorId);
    if (remote) {
      remote.data.score = data.newScore;
      updateNameplateSprite(remote.meshObj.nameplateObj, remote.data.name, remote.data.color, remote.data.score);
    }
    showToast(`✨ ${data.collectorName} collected an Orb!`);
  }

  updateLeaderboard();
});

socket.on('orbSpawned', (orbData) => {
  let orbObj = orbsMeshes.get(orbData.id);
  if (orbObj) {
    orbObj.data = orbData;
    orbObj.group.position.set(orbData.x, orbData.y, orbData.z);
    orbObj.group.visible = true;
    orbObj.group.scale.set(0.01, 0.01, 0.01);
    // Elastic pop-in animation
    let s = 0.01;
    const popInterval = setInterval(() => {
      s += 0.15;
      orbObj.group.scale.setScalar(s);
      if (s >= 1.0) {
        orbObj.group.scale.setScalar(1.0);
        clearInterval(popInterval);
      }
    }, 16);
  } else {
    orbsMeshes.set(orbData.id, createOrbMesh(orbData));
  }
});

socket.on('playerLeft', (playerId) => {
  const remote = remotePlayers.get(playerId);
  if (remote) {
    showToast(`${remote.data.name} left the match.`);
    scene.remove(remote.meshObj.group);
    remotePlayers.delete(playerId);
    updateLeaderboard();
  }
});

// --- JOIN GAME INTERACTION ---
joinBtn.addEventListener('click', () => {
  const chosenName = playerNameInput.value.trim() || `Pilot_${Math.floor(Math.random() * 900 + 100)}`;
  startOverlay.classList.add('hidden');
  socket.emit('joinGame', { name: chosenName });
});

playerNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});

// --- INPUT & LOCAL PLAYER CONTROLLER ---
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  boost: false
};

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.forward = true;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.backward = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = true;
      break;
    case 'Space':
      keys.boost = true;
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.forward = false;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.backward = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = false;
      break;
    case 'Space':
      keys.boost = false;
      break;
  }
});

let lastStepSoundTime = 0;
let lastNetworkEmitTime = 0;

function updateLocalPlayer(delta) {
  if (!selfPlayer || !selfPlayerMeshObj) return;

  const moveSpeed = keys.boost ? 24 : 14;
  const turnSpeed = 3.2;

  let moved = false;

  // Turning
  if (keys.left) {
    selfPlayer.rotationY += turnSpeed * delta;
    moved = true;
  }
  if (keys.right) {
    selfPlayer.rotationY -= turnSpeed * delta;
    moved = true;
  }

  // Linear Movement
  let forwardDist = 0;
  if (keys.forward) {
    forwardDist += moveSpeed * delta;
    moved = true;
  }
  if (keys.backward) {
    forwardDist -= (moveSpeed * 0.65) * delta;
    moved = true;
  }

  if (forwardDist !== 0) {
    selfPlayer.x += Math.sin(selfPlayer.rotationY) * forwardDist;
    selfPlayer.z += Math.cos(selfPlayer.rotationY) * forwardDist;

    // Footstep / engine sound
    const now = performance.now();
    if (now - lastStepSoundTime > (keys.boost ? 220 : 360)) {
      playStepSound();
      lastStepSoundTime = now;
    }
  }

  // Clamp within arena perimeter
  const maxBound = (ARENA_SIZE / 2) - 1.5;
  selfPlayer.x = Math.max(-maxBound, Math.min(maxBound, selfPlayer.x));
  selfPlayer.z = Math.max(-maxBound, Math.min(maxBound, selfPlayer.z));

  // Update mesh transform
  selfPlayerMeshObj.group.position.x = selfPlayer.x;
  selfPlayerMeshObj.group.position.z = selfPlayer.z;
  selfPlayerMeshObj.group.rotation.y = selfPlayer.rotationY;

  // Gentle floating hover bobbing
  selfPlayerMeshObj.group.position.y = Math.sin(performance.now() * 0.006) * 0.08;

  // Emit movement update to server (~35 Hz)
  const now = performance.now();
  if (moved && now - lastNetworkEmitTime > 28) {
    socket.emit('playerMove', {
      x: selfPlayer.x,
      z: selfPlayer.z,
      rotationY: selfPlayer.rotationY
    });
    lastNetworkEmitTime = now;
  }
}

// Update Remote Players with smooth interpolation (lerp)
function updateRemotePlayers(delta) {
  remotePlayers.forEach((p) => {
    const mesh = p.meshObj.group;
    // Smooth lerp toward authoritative server target
    mesh.position.x += (p.targetX - mesh.position.x) * 0.28;
    mesh.position.z += (p.targetZ - mesh.position.z) * 0.28;

    // Angle lerp
    let diffRot = p.targetRot - mesh.rotation.y;
    while (diffRot < -Math.PI) diffRot += Math.PI * 2;
    while (diffRot > Math.PI) diffRot -= Math.PI * 2;
    mesh.rotation.y += diffRot * 0.28;

    // Gentle hover bobbing
    mesh.position.y = Math.sin(performance.now() * 0.006 + p.data.x) * 0.08;
  });
}

// Smooth 3rd-Person Follow Camera
function updateCamera(delta) {
  if (!selfPlayer) return;

  const camDistance = 11.5;
  const camHeight = 7.2;

  // Target camera position behind player
  const targetCamX = selfPlayer.x - Math.sin(selfPlayer.rotationY) * camDistance;
  const targetCamY = camHeight;
  const targetCamZ = selfPlayer.z - Math.cos(selfPlayer.rotationY) * camDistance;

  // Smooth lerp
  camera.position.x += (targetCamX - camera.position.x) * 0.14;
  camera.position.y += (targetCamY - camera.position.y) * 0.14;
  camera.position.z += (targetCamZ - camera.position.z) * 0.14;

  // Look ahead of player
  const lookTarget = new THREE.Vector3(
    selfPlayer.x + Math.sin(selfPlayer.rotationY) * 2.5,
    1.4,
    selfPlayer.z + Math.cos(selfPlayer.rotationY) * 2.5
  );
  camera.lookAt(lookTarget);
}

// Animate Collectible Orbs
function updateOrbs(time) {
  orbsMeshes.forEach((orb) => {
    if (!orb.group.visible) return;

    // Continuous rotation
    orb.core.rotation.x = time * 1.5;
    orb.core.rotation.y = time * 2.2;
    orb.ring.rotation.x = time * -1.8;
    orb.ring.rotation.z = time * 1.2;

    // Floating bobbing motion
    orb.group.position.y = 1.0 + Math.sin(time * 3.5 + orb.data.x) * 0.35;
  });
}

// --- RADAR MINIMAP ---
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');

function updateMinimap() {
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  minimapCtx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const scale = (w - 18) / ARENA_SIZE;

  // Radar circle grid
  minimapCtx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
  minimapCtx.lineWidth = 1;
  minimapCtx.beginPath();
  minimapCtx.arc(cx, cy, w / 2 - 4, 0, Math.PI * 2);
  minimapCtx.stroke();

  // Arena Bounds box
  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  minimapCtx.strokeRect(cx - (ARENA_SIZE / 2) * scale, cy - (ARENA_SIZE / 2) * scale, ARENA_SIZE * scale, ARENA_SIZE * scale);

  // Orbs (glowing dots)
  orbsMeshes.forEach((orb) => {
    if (!orb.group.visible) return;
    const ox = cx + orb.group.position.x * scale;
    const oz = cy + orb.group.position.z * scale;
    minimapCtx.fillStyle = orb.data.color;
    minimapCtx.beginPath();
    minimapCtx.arc(ox, oz, 2.5, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  // Remote Players (orange/red dots)
  remotePlayers.forEach((p) => {
    const rx = cx + p.meshObj.group.position.x * scale;
    const rz = cy + p.meshObj.group.position.z * scale;
    minimapCtx.fillStyle = p.data.color || '#ff007f';
    minimapCtx.beginPath();
    minimapCtx.arc(rx, rz, 3.5, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  // Local Player (cyan dot with heading arrow)
  if (selfPlayer) {
    const px = cx + selfPlayer.x * scale;
    const pz = cy + selfPlayer.z * scale;

    minimapCtx.fillStyle = '#00f0ff';
    minimapCtx.beginPath();
    minimapCtx.arc(px, pz, 4, 0, Math.PI * 2);
    minimapCtx.fill();

    // Orientation pointer
    minimapCtx.strokeStyle = '#ffffff';
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    minimapCtx.moveTo(px, pz);
    minimapCtx.lineTo(
      px + Math.sin(selfPlayer.rotationY) * 9,
      pz + Math.cos(selfPlayer.rotationY) * 9
    );
    minimapCtx.stroke();
  }
}

// --- RESIZE HANDLER ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- MAIN ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);
  const time = clock.getElapsedTime();

  updateLocalPlayer(delta);
  updateRemotePlayers(delta);
  updateCamera(delta);
  updateOrbs(time);
  updateParticles(delta);
  updateMinimap();

  renderer.render(scene, camera);
}

animate();
