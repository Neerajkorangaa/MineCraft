/* ==========================================
   CraftWorld — Procedural Block Textures
   Generates Minecraft-style textures via Canvas
   No external images needed!
   ========================================== */

const TEXTURE_SIZE = 16;

// Block type definitions
const BLOCK_TYPES = {
  0: { name: 'Air', solid: false },
  1: { name: 'Grass', solid: true },
  2: { name: 'Dirt', solid: true },
  3: { name: 'Stone', solid: true },
  4: { name: 'Oak Wood', solid: true },
  5: { name: 'Oak Leaves', solid: true, transparent: true },
  6: { name: 'Sand', solid: true },
  7: { name: 'Water', solid: false, transparent: true },
  8: { name: 'Oak Planks', solid: true },
  9: { name: 'Cobblestone', solid: true },
  10: { name: 'Bedrock', solid: true },
  11: { name: 'Snow', solid: true },
  12: { name: 'Glass', solid: true, transparent: true },
  13: { name: 'Brick', solid: true },
  14: { name: 'Coal Ore', solid: true },
  15: { name: 'Iron Ore', solid: true },
  16: { name: 'Gold Ore', solid: true },
  17: { name: 'Diamond Ore', solid: true },
};

// Hotbar default blocks
const HOTBAR_BLOCKS = [1, 2, 3, 4, 8, 9, 6, 13, 12];

// ---- Pixel drawing helpers ----
function createTexCanvas() {
  const c = document.createElement('canvas');
  c.width = TEXTURE_SIZE;
  c.height = TEXTURE_SIZE;
  return c;
}

function fillBase(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
}

function addNoise(ctx, amount, darkOnly) {
  const imgData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - (darkOnly ? 0.5 : 0.5)) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
}

function drawPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function scatterPixels(ctx, color, count) {
  for (let i = 0; i < count; i++) {
    drawPixel(ctx, Math.floor(Math.random() * TEXTURE_SIZE),
      Math.floor(Math.random() * TEXTURE_SIZE), color);
  }
}

// ---- Generate individual textures ----
function generateGrassTop() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#5b8731');
  addNoise(ctx, 25);
  scatterPixels(ctx, '#4a7828', 20);
  scatterPixels(ctx, '#6b9a3a', 15);
  return c;
}

function generateGrassSide() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  // Dirt bottom
  fillBase(ctx, '#8b6914');
  addNoise(ctx, 20);
  // Grass top strip
  ctx.fillStyle = '#5b8731';
  ctx.fillRect(0, 0, TEXTURE_SIZE, 3);
  addNoise(ctx, 15);
  // Transition
  for (let x = 0; x < TEXTURE_SIZE; x++) {
    const h = 3 + Math.floor(Math.random() * 2);
    drawPixel(ctx, x, h, Math.random() > 0.5 ? '#5b8731' : '#6b7a2e');
  }
  return c;
}

function generateDirt() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#8b6914');
  addNoise(ctx, 25);
  scatterPixels(ctx, '#7a5c12', 15);
  scatterPixels(ctx, '#9c7a1c', 10);
  return c;
}

function generateStone() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#8a8a8a');
  addNoise(ctx, 30);
  scatterPixels(ctx, '#7a7a7a', 20);
  scatterPixels(ctx, '#999', 15);
  // Cracks
  ctx.fillStyle = '#666';
  ctx.fillRect(2, 4, 5, 1);
  ctx.fillRect(8, 10, 6, 1);
  ctx.fillRect(1, 13, 4, 1);
  return c;
}

function generateWoodSide() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#6b4c2a');
  // Bark lines
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    if (y % 3 === 0) {
      ctx.fillStyle = '#5a3e22';
      ctx.fillRect(0, y, TEXTURE_SIZE, 1);
    }
  }
  addNoise(ctx, 15);
  // Vertical grain
  for (let x = 0; x < TEXTURE_SIZE; x += 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(x, 0, 1, TEXTURE_SIZE);
  }
  return c;
}

function generateWoodTop() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#9c7a4a');
  // Rings
  const cx = 8, cy = 8;
  for (let r = 2; r <= 6; r += 2) {
    ctx.strokeStyle = '#7a5c33';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  addNoise(ctx, 15);
  return c;
}

function generateLeaves() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#2d6b1a');
  addNoise(ctx, 35);
  scatterPixels(ctx, '#1a5510', 20);
  scatterPixels(ctx, '#3a8a28', 15);
  scatterPixels(ctx, '#44992f', 8);
  return c;
}

function generateSand() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#d4c484');
  addNoise(ctx, 20);
  scatterPixels(ctx, '#c4b474', 15);
  scatterPixels(ctx, '#e4d494', 10);
  return c;
}

function generateWater() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#2255aa');
  addNoise(ctx, 15);
  // Water highlights
  ctx.fillStyle = 'rgba(100,180,255,0.3)';
  ctx.fillRect(2, 3, 6, 1);
  ctx.fillRect(9, 8, 5, 1);
  ctx.fillRect(1, 12, 4, 1);
  return c;
}

function generatePlanks() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#b8944a');
  addNoise(ctx, 15);
  // Plank lines
  ctx.fillStyle = '#9a7a3a';
  ctx.fillRect(0, 3, TEXTURE_SIZE, 1);
  ctx.fillRect(0, 7, TEXTURE_SIZE, 1);
  ctx.fillRect(0, 11, TEXTURE_SIZE, 1);
  ctx.fillRect(0, 15, TEXTURE_SIZE, 1);
  // Vertical dividers (offset per plank)
  ctx.fillRect(7, 0, 1, 4);
  ctx.fillRect(12, 4, 1, 4);
  ctx.fillRect(4, 8, 1, 4);
  ctx.fillRect(10, 12, 1, 4);
  return c;
}

function generateCobblestone() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#777');
  addNoise(ctx, 25);
  // Stone pattern
  const stones = [
    [0, 0, 7, 5, '#888'], [8, 0, 8, 4, '#6a6a6a'], [0, 5, 5, 5, '#7a7a7a'],
    [5, 4, 6, 6, '#8a8a8a'], [11, 4, 5, 5, '#707070'], [0, 10, 8, 6, '#828282'],
    [8, 9, 8, 7, '#757575'],
  ];
  for (const [x, y, w, h, col] of stones) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  addNoise(ctx, 12);
  return c;
}

function generateBedrock() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#444');
  addNoise(ctx, 40);
  scatterPixels(ctx, '#333', 25);
  scatterPixels(ctx, '#555', 15);
  scatterPixels(ctx, '#222', 10);
  return c;
}

function generateSnow() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#f0f0f5');
  addNoise(ctx, 10);
  scatterPixels(ctx, '#e8e8f0', 10);
  scatterPixels(ctx, '#dde0e8', 8);
  return c;
}

function generateGlass() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, 'rgba(200,220,255,0.3)');
  // Frame
  ctx.fillStyle = '#cce';
  ctx.fillRect(0, 0, TEXTURE_SIZE, 1);
  ctx.fillRect(0, 15, TEXTURE_SIZE, 1);
  ctx.fillRect(0, 0, 1, TEXTURE_SIZE);
  ctx.fillRect(15, 0, 1, TEXTURE_SIZE);
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(2, 2, 3, 3);
  return c;
}

function generateBrick() {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  fillBase(ctx, '#8a4433');
  addNoise(ctx, 15);
  // Mortar lines
  ctx.fillStyle = '#bba888';
  // Horizontal
  ctx.fillRect(0, 3, TEXTURE_SIZE, 1);
  ctx.fillRect(0, 7, TEXTURE_SIZE, 1);
  ctx.fillRect(0, 11, TEXTURE_SIZE, 1);
  ctx.fillRect(0, 15, TEXTURE_SIZE, 1);
  // Vertical (offset)
  ctx.fillRect(7, 0, 1, 4);
  ctx.fillRect(0, 4, 1, 4);
  ctx.fillRect(7, 4, 1, 4);
  ctx.fillRect(3, 8, 1, 4);
  ctx.fillRect(11, 8, 1, 4);
  ctx.fillRect(7, 12, 1, 4);
  return c;
}

function generateOre(baseColor, oreColor, oreCount) {
  const c = createTexCanvas();
  const ctx = c.getContext('2d');
  // Stone base
  fillBase(ctx, '#8a8a8a');
  addNoise(ctx, 20);
  // Ore spots
  for (let i = 0; i < oreCount; i++) {
    const x = Math.floor(Math.random() * 13) + 1;
    const y = Math.floor(Math.random() * 13) + 1;
    ctx.fillStyle = oreColor;
    ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, 1, 1);
  }
  return c;
}

// ---- Build all textures ----
function generateAllTextures() {
  const textures = {};

  // Grass: top, side, bottom
  textures[1] = {
    top: generateGrassTop(),
    side: generateGrassSide(),
    bottom: generateDirt(),
  };

  // Simple blocks (all faces same)
  const simpleGenerators = {
    2: generateDirt,
    3: generateStone,
    6: generateSand,
    8: generatePlanks,
    9: generateCobblestone,
    10: generateBedrock,
    11: generateSnow,
    12: generateGlass,
    13: generateBrick,
  };

  for (const [id, gen] of Object.entries(simpleGenerators)) {
    const c = gen();
    textures[id] = { top: c, side: c, bottom: c };
  }

  // Wood: side vs top/bottom
  textures[4] = {
    top: generateWoodTop(),
    side: generateWoodSide(),
    bottom: generateWoodTop(),
  };

  // Leaves
  const leaves = generateLeaves();
  textures[5] = { top: leaves, side: leaves, bottom: leaves };

  // Water
  const water = generateWater();
  textures[7] = { top: water, side: water, bottom: water };

  // Ores
  const coalOre = generateOre('#333', '#222', 5);
  textures[14] = { top: coalOre, side: coalOre, bottom: coalOre };

  const ironOre = generateOre('#c4a882', '#d4b894', 4);
  textures[15] = { top: ironOre, side: ironOre, bottom: ironOre };

  const goldOre = generateOre('#fcdb4d', '#ffe066', 4);
  textures[16] = { top: goldOre, side: goldOre, bottom: goldOre };

  const diamondOre = generateOre('#44e8d4', '#66ffee', 4);
  textures[17] = { top: diamondOre, side: diamondOre, bottom: diamondOre };

  return textures;
}

// ---- Convert canvas textures to Three.js materials ----
function createBlockMaterials(textures) {
  const materials = {};

  for (const [id, tex] of Object.entries(textures)) {
    const blockType = BLOCK_TYPES[id];
    const transparent = blockType && blockType.transparent;

    const makeTexture = (canvas) => {
      const t = new THREE.CanvasTexture(canvas);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      return t;
    };

    // Six face materials: +X, -X, +Y, -Y, +Z, -Z
    // Three.js box order: right, left, top, bottom, front, back
    materials[id] = [
      new THREE.MeshLambertMaterial({ map: makeTexture(tex.side), transparent, opacity: transparent ? 0.7 : 1 }),
      new THREE.MeshLambertMaterial({ map: makeTexture(tex.side), transparent, opacity: transparent ? 0.7 : 1 }),
      new THREE.MeshLambertMaterial({ map: makeTexture(tex.top), transparent, opacity: transparent ? 0.7 : 1 }),
      new THREE.MeshLambertMaterial({ map: makeTexture(tex.bottom), transparent, opacity: transparent ? 0.7 : 1 }),
      new THREE.MeshLambertMaterial({ map: makeTexture(tex.side), transparent, opacity: transparent ? 0.7 : 1 }),
      new THREE.MeshLambertMaterial({ map: makeTexture(tex.side), transparent, opacity: transparent ? 0.7 : 1 }),
    ];
  }

  return materials;
}
