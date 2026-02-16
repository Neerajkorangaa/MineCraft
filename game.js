/* ==========================================
   CraftWorld — Optimized Game Controller
   Performance: object pooling, dirty-flag mesh,
   mobile touch controls, adaptive quality
   ========================================== */

const loadingScreen = document.getElementById('loadingScreen');
const startScreen = document.getElementById('startScreen');
const hudEl = document.getElementById('hud');
const pauseMenu = document.getElementById('pauseMenu');
const loadingBar = document.getElementById('loadingBar');
const loadingText = document.getElementById('loadingText');
const hotbarEl = document.getElementById('hotbar');
const blockTooltip = document.getElementById('blockTooltip');
const fpsCounter = document.getElementById('fpsCounter');
const posInfo = document.getElementById('posInfo');

let scene, camera, renderer;
let world, blockMaterials, blockTextures;
let highlightMesh;

// ---- Device Detection ----
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

const QUALITY = {
  pixelRatio: isMobile ? 1 : Math.min(devicePixelRatio, 2),
  fogDensity: isMobile ? 0.04 : 0.025,
  farPlane: isMobile ? 80 : 150,
  antialias: !isMobile,
};

const playerState = {
  velocity: new THREE.Vector3(),
  onGround: false,
  speed: 0.08,
  jumpForce: 0.15,
  gravity: -0.006,
  height: 1.7,
  eyeHeight: 1.6,
  selectedSlot: 0,
};

const keys = {};
let mouseDX = 0, mouseDY = 0;
let isPointerLocked = false;
let isPaused = false;
let frameCount = 0, lastFPSTime = 0, fps = 0, tooltipTimer = 0;
let targetHit = null;

// ---- Reusable Vector3 pool (avoid GC pressure) ----
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _mv = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _np = new THREE.Vector3();
const _colCheck = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

// ---- Dirty flag for mesh rebuild batching ----
let meshDirty = false;

function scheduleMeshRebuild() {
  meshDirty = true;
}

// ---- Mobile Touch State ----
let touchJoystick = { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0 };
let touchLook = { active: false, id: null, lastX: 0, lastY: 0 };
let touchJump = false;
let touchBreak = false;
let touchPlace = false;

// ---- INIT ----
async function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.FogExp2(0x87CEEB, QUALITY.fogDensity);

  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, QUALITY.farPlane);

  renderer = new THREE.WebGLRenderer({ antialias: QUALITY.antialias });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(QUALITY.pixelRatio);
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  scene.add(new THREE.AmbientLight(0xccccff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(50, 80, 30);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x87CEEB, 0x8B6914, 0.3));

  const hlGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
  const hlMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.5 });
  highlightMesh = new THREE.Mesh(hlGeo, hlMat);
  highlightMesh.visible = false;
  scene.add(highlightMesh);

  updateLoading(20, 'Generating textures...');
  await delay(30);
  blockTextures = generateAllTextures();
  blockMaterials = createBlockMaterials(blockTextures);

  updateLoading(30, 'Generating terrain...');
  await delay(30);
  world = new VoxelWorld();
  world.generate(pct => updateLoading(30 + pct * 0.5, 'Generating terrain...'));

  updateLoading(85, 'Building mesh...');
  await delay(30);
  world.buildMesh(scene, blockMaterials);

  const spawn = world.findSpawnPosition();
  camera.position.set(spawn.x, spawn.y, spawn.z);

  buildHotbar();
  setupEvents();

  if (isMobile) setupMobileControls();

  updateLoading(100, 'Ready!');
  await delay(200);
  loadingScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function updateLoading(p, t) { loadingBar.style.width = p + '%'; if (t) loadingText.textContent = t; }

// ---- HOTBAR ----
function buildHotbar() {
  hotbarEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot' + (i === playerState.selectedSlot ? ' active' : '');
    const num = document.createElement('span');
    num.className = 'slot-num';
    num.textContent = i + 1;
    slot.appendChild(num);
    const bid = HOTBAR_BLOCKS[i];
    if (bid && blockTextures && blockTextures[bid]) {
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 16;
      cv.getContext('2d').drawImage(blockTextures[bid].top || blockTextures[bid].side, 0, 0);
      slot.appendChild(cv);
    }
    slot.addEventListener('click', () => selectSlot(i));
    hotbarEl.appendChild(slot);
  }
}

function selectSlot(i) {
  playerState.selectedSlot = i;
  document.querySelectorAll('.hotbar-slot').forEach((s, j) => s.classList.toggle('active', j === i));
  const bid = HOTBAR_BLOCKS[i];
  if (bid && BLOCK_TYPES[bid]) {
    blockTooltip.textContent = BLOCK_TYPES[bid].name;
    blockTooltip.classList.remove('hidden');
    tooltipTimer = 60;
  }
}

// ---- EVENTS ----
function setupEvents() {
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code >= 'Digit1' && e.code <= 'Digit9') selectSlot(parseInt(e.code[5]) - 1);
    if (e.code === 'Escape' && isPaused) resumeGame();
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });
  document.addEventListener('mousemove', e => {
    if (!isPointerLocked) return;
    mouseDX += e.movementX; mouseDY += e.movementY;
  });
  renderer.domElement.addEventListener('mousedown', e => {
    if (isMobile) return; // mobile uses touch controls
    if (!isPointerLocked) { renderer.domElement.requestPointerLock(); return; }
    if (e.button === 0) breakBlock();
    if (e.button === 2) placeBlock();
  });
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('wheel', e => {
    if (!isPointerLocked) return;
    let s = playerState.selectedSlot + (e.deltaY > 0 ? 1 : -1);
    if (s < 0) s = 8; if (s > 8) s = 0;
    selectSlot(s);
  });
  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === renderer.domElement;
    if (!isPointerLocked && !isPaused && !isMobile) showPause();
  });
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  document.getElementById('btnPlay').addEventListener('click', startGame);
  document.getElementById('btnResume').addEventListener('click', resumeGame);
  document.getElementById('btnRestart').addEventListener('click', restartGame);
}

// ---- MOBILE TOUCH CONTROLS ----
function setupMobileControls() {
  const mobileUI = document.getElementById('mobileControls');
  if (mobileUI) mobileUI.classList.remove('hidden');

  const joystickArea = document.getElementById('joystickArea');
  const joystickKnob = document.getElementById('joystickKnob');
  const lookArea = document.getElementById('lookArea');

  // Joystick touch
  if (joystickArea) {
    joystickArea.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      touchJoystick.active = true;
      touchJoystick.id = t.identifier;
      touchJoystick.startX = t.clientX;
      touchJoystick.startY = t.clientY;
      touchJoystick.dx = 0;
      touchJoystick.dy = 0;
    }, { passive: false });

    joystickArea.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === touchJoystick.id) {
          const maxR = 40;
          let dx = t.clientX - touchJoystick.startX;
          let dy = t.clientY - touchJoystick.startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
          touchJoystick.dx = dx / maxR;
          touchJoystick.dy = dy / maxR;
          if (joystickKnob) {
            joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
          }
        }
      }
    }, { passive: false });

    const endJoystick = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === touchJoystick.id) {
          touchJoystick.active = false;
          touchJoystick.dx = 0;
          touchJoystick.dy = 0;
          if (joystickKnob) joystickKnob.style.transform = '';
        }
      }
    };
    joystickArea.addEventListener('touchend', endJoystick);
    joystickArea.addEventListener('touchcancel', endJoystick);
  }

  // Look area touch (right side of screen)
  if (lookArea) {
    lookArea.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      touchLook.active = true;
      touchLook.id = t.identifier;
      touchLook.lastX = t.clientX;
      touchLook.lastY = t.clientY;
    }, { passive: false });

    lookArea.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === touchLook.id) {
          mouseDX += (t.clientX - touchLook.lastX) * 1.5;
          mouseDY += (t.clientY - touchLook.lastY) * 1.5;
          touchLook.lastX = t.clientX;
          touchLook.lastY = t.clientY;
        }
      }
    }, { passive: false });

    const endLook = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === touchLook.id) {
          touchLook.active = false;
        }
      }
    };
    lookArea.addEventListener('touchend', endLook);
    lookArea.addEventListener('touchcancel', endLook);
  }

  // Action buttons
  const btnJump = document.getElementById('btnTouchJump');
  const btnBreak = document.getElementById('btnTouchBreak');
  const btnPlace = document.getElementById('btnTouchPlace');

  if (btnJump) {
    btnJump.addEventListener('touchstart', e => { e.preventDefault(); touchJump = true; }, { passive: false });
    btnJump.addEventListener('touchend', e => { touchJump = false; });
  }
  if (btnBreak) {
    btnBreak.addEventListener('touchstart', e => { e.preventDefault(); breakBlock(); }, { passive: false });
  }
  if (btnPlace) {
    btnPlace.addEventListener('touchstart', e => { e.preventDefault(); placeBlock(); }, { passive: false });
  }
}

// ---- GAME STATE ----
function startGame() {
  startScreen.classList.add('hidden');
  hudEl.classList.remove('hidden');
  isPaused = false;
  if (!isMobile) {
    renderer.domElement.requestPointerLock();
  }
  lastFPSTime = performance.now();
  gameLoop();
}
function showPause() { isPaused = true; pauseMenu.classList.remove('hidden'); }
function resumeGame() {
  isPaused = false;
  pauseMenu.classList.add('hidden');
  if (!isMobile) renderer.domElement.requestPointerLock();
}
function restartGame() {
  pauseMenu.classList.add('hidden'); hudEl.classList.add('hidden');
  loadingScreen.classList.remove('hidden'); updateLoading(0, 'New world...');
  for (const m of world.meshGroup) { scene.remove(m); m.geometry.dispose(); }
  setTimeout(async () => {
    world = new VoxelWorld();
    world.generate(p => updateLoading(p * 0.8, 'Terrain...'));
    updateLoading(85, 'Building...'); await delay(30);
    world.buildMesh(scene, blockMaterials);
    const sp = world.findSpawnPosition();
    camera.position.set(sp.x, sp.y, sp.z);
    playerState.velocity.set(0, 0, 0);
    updateLoading(100, 'Ready!'); await delay(200);
    loadingScreen.classList.add('hidden'); hudEl.classList.remove('hidden');
    isPaused = false;
    if (!isMobile) renderer.domElement.requestPointerLock();
    lastFPSTime = performance.now(); gameLoop();
  }, 50);
}

// ---- PLAYER (optimized — reuses Vector3 objects) ----
function updatePlayer() {
  const sens = isMobile ? 0.003 : 0.002;
  if (mouseDX || mouseDY) {
    camera.rotation.order = 'YXZ';
    camera.rotation.y -= mouseDX * sens;
    camera.rotation.x = Math.max(-1.56, Math.min(1.56, camera.rotation.x - mouseDY * sens));
    mouseDX = mouseDY = 0;
  }

  camera.getWorldDirection(_fwd); _fwd.y = 0; _fwd.normalize();
  _right.crossVectors(_fwd, _up).normalize();
  _mv.set(0, 0, 0);

  // Keyboard input
  if (keys['KeyW'] || keys['ArrowUp']) _mv.add(_fwd);
  if (keys['KeyS'] || keys['ArrowDown']) _mv.sub(_fwd);
  if (keys['KeyA'] || keys['ArrowLeft']) _mv.sub(_right);
  if (keys['KeyD'] || keys['ArrowRight']) _mv.add(_right);

  // Mobile joystick input
  if (touchJoystick.active) {
    _mv.addScaledVector(_fwd, -touchJoystick.dy);
    _mv.addScaledVector(_right, touchJoystick.dx);
  }

  if (_mv.lengthSq() > 0) _mv.normalize().multiplyScalar(playerState.speed);

  playerState.velocity.x = _mv.x;
  playerState.velocity.z = _mv.z;
  playerState.velocity.y += playerState.gravity;
  if ((keys['Space'] || touchJump) && playerState.onGround) {
    playerState.velocity.y = playerState.jumpForce;
    playerState.onGround = false;
  }

  _np.copy(camera.position).add(playerState.velocity);
  const pr = 0.3;

  // X collision
  _colCheck.set(_np.x, camera.position.y, camera.position.z);
  if (!checkCol(_colCheck, pr)) camera.position.x = _np.x;
  else playerState.velocity.x = 0;
  // Z collision
  _colCheck.set(camera.position.x, camera.position.y, _np.z);
  if (!checkCol(_colCheck, pr)) camera.position.z = _np.z;
  else playerState.velocity.z = 0;
  // Y collision
  _colCheck.set(camera.position.x, _np.y, camera.position.z);
  if (!checkCol(_colCheck, pr)) {
    camera.position.y = _np.y; playerState.onGround = false;
  } else {
    if (playerState.velocity.y < 0) {
      playerState.onGround = true;
      camera.position.y = Math.floor(camera.position.y - playerState.eyeHeight) + playerState.eyeHeight + 1;
    }
    playerState.velocity.y = 0;
  }
  if (camera.position.y < 2) { camera.position.y = 2; playerState.velocity.y = 0; playerState.onGround = true; }
  camera.position.x = Math.max(0.5, Math.min(WORLD_SIZE - 0.5, camera.position.x));
  camera.position.z = Math.max(0.5, Math.min(WORLD_SIZE - 0.5, camera.position.z));
}

function checkCol(pos, r) {
  const feet = pos.y - playerState.eyeHeight;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 2; dy++) {
    const bx = Math.floor(pos.x + dx * r), by = Math.floor(feet + dy), bz = Math.floor(pos.z + dz * r);
    const b = world.getBlock(bx, by, bz);
    if (b && BLOCK_TYPES[b] && BLOCK_TYPES[b].solid) {
      if (pos.x + r > bx && pos.x - r < bx + 1 && feet < by + 1 && pos.y > by && pos.z + r > bz && pos.z - r < bz + 1)
        return true;
    }
  }
  return false;
}

// ---- BLOCK INTERACTION (DDA Raycast) ----
function updateRaycast() {
  camera.getWorldDirection(_rayDir);
  targetHit = world.raycast(camera.position, _rayDir, 7);
  if (targetHit) {
    highlightMesh.visible = true;
    highlightMesh.position.set(targetHit.x + 0.5, targetHit.y + 0.5, targetHit.z + 0.5);
  } else {
    highlightMesh.visible = false;
  }
}

function breakBlock() {
  if (!targetHit) return;
  if (targetHit.blockId === 10) return; // bedrock
  world.setBlock(targetHit.x, targetHit.y, targetHit.z, 0);
  scheduleMeshRebuild(); // deferred rebuild instead of instant
  highlightMesh.visible = false;
  targetHit = null;
}

function placeBlock() {
  if (!targetHit) return;
  const x = targetHit.x + targetHit.face.x;
  const y = targetHit.y + targetHit.face.y;
  const z = targetHit.z + targetHit.face.z;
  if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= WORLD_SIZE) return;
  const px = Math.floor(camera.position.x), pz = Math.floor(camera.position.z);
  const py = Math.floor(camera.position.y - playerState.eyeHeight);
  if (x === px && z === pz && (y === py || y === py + 1)) return;
  const bid = HOTBAR_BLOCKS[playerState.selectedSlot];
  if (!bid) return;
  world.setBlock(x, y, z, bid);
  scheduleMeshRebuild(); // deferred rebuild instead of instant
}

// ---- GAME LOOP (optimized) ----
function gameLoop() {
  if (isPaused) { renderer.render(scene, camera); requestAnimationFrame(gameLoop); return; }

  updatePlayer();
  updateRaycast();

  // Batch mesh rebuild — at most once per frame
  if (meshDirty) {
    world.buildMesh(scene, blockMaterials);
    meshDirty = false;
  }

  if (tooltipTimer > 0) { tooltipTimer--; if (tooltipTimer <= 0) blockTooltip.classList.add('hidden'); }
  frameCount++;
  const now = performance.now();
  if (now - lastFPSTime >= 1000) { fps = frameCount; frameCount = 0; lastFPSTime = now; fpsCounter.textContent = 'FPS: ' + fps; }
  posInfo.textContent = `X:${camera.position.x.toFixed(1)} Y:${camera.position.y.toFixed(1)} Z:${camera.position.z.toFixed(1)}`;
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}

init();
