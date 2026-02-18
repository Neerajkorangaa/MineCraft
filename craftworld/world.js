/* ==========================================
   CraftWorld — Optimized World Engine
   Merged geometry, face culling, DDA raycast
   ========================================== */

const WORLD_SIZE = 32;
const WORLD_HEIGHT = 32;
const SEA_LEVEL = 12;
const BASE_TERRAIN = 10;

// Face definitions: dir, matType (0=side,1=top,2=bottom), corners [x,y,z,u,v]
const FACES = [
  { dir: [1, 0, 0], mt: 0, c: [[1, 0, 0, 0, 0], [1, 1, 0, 0, 1], [1, 1, 1, 1, 1], [1, 0, 1, 1, 0]] },
  { dir: [-1, 0, 0], mt: 0, c: [[0, 0, 1, 0, 0], [0, 1, 1, 0, 1], [0, 1, 0, 1, 1], [0, 0, 0, 1, 0]] },
  { dir: [0, 1, 0], mt: 1, c: [[0, 1, 1, 0, 0], [1, 1, 1, 1, 0], [1, 1, 0, 1, 1], [0, 1, 0, 0, 1]] },
  { dir: [0, -1, 0], mt: 2, c: [[0, 0, 0, 0, 0], [1, 0, 0, 1, 0], [1, 0, 1, 1, 1], [0, 0, 1, 0, 1]] },
  { dir: [0, 0, 1], mt: 0, c: [[1, 0, 1, 0, 0], [1, 1, 1, 0, 1], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [0, 0, -1], mt: 0, c: [[0, 0, 0, 0, 0], [0, 1, 0, 0, 1], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
];

// Simple Noise
class SimpleNoise {
  constructor(seed) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed || 42;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 7) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(a, b, t) { return a + t * (b - a); }
  grad(hash, x, y) {
    const h = hash & 3;
    return ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  }
  noise2D(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = this.fade(xf), v = this.fade(yf);
    const p = this.perm;
    const a = p[X] + Y, b = p[X + 1] + Y;
    return this.lerp(
      this.lerp(this.grad(p[a], xf, yf), this.grad(p[b], xf - 1, yf), u),
      this.lerp(this.grad(p[a + 1], xf, yf - 1), this.grad(p[b + 1], xf - 1, yf - 1), u), v
    );
  }
  fbm(x, y, oct, lac, gain) {
    let sum = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < oct; i++) {
      sum += this.noise2D(x * freq, y * freq) * amp;
      max += amp; amp *= gain; freq *= lac;
    }
    return sum / max;
  }
}

class VoxelWorld {
  constructor(seed) {
    this.seed = seed || Math.floor(Math.random() * 999999);
    this.noise = new SimpleNoise(this.seed);
    this.noise2 = new SimpleNoise(this.seed + 1000);
    this.blocks = new Uint8Array(WORLD_SIZE * WORLD_HEIGHT * WORLD_SIZE);
    this.meshGroup = [];
  }

  idx(x, y, z) {
    if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= WORLD_SIZE) return -1;
    return y * WORLD_SIZE * WORLD_SIZE + z * WORLD_SIZE + x;
  }
  getBlock(x, y, z) { const i = this.idx(x, y, z); return i === -1 ? 0 : this.blocks[i]; }
  setBlock(x, y, z, t) { const i = this.idx(x, y, z); if (i !== -1) this.blocks[i] = t; }

  generate(progressCb) {
    const noise = this.noise, noise2 = this.noise2;
    for (let x = 0; x < WORLD_SIZE; x++) {
      for (let z = 0; z < WORLD_SIZE; z++) {
        let h = noise.fbm(x / WORLD_SIZE * 4, z / WORLD_SIZE * 4, 4, 2.0, 0.5);
        h = Math.pow((h + 1) / 2, 1.2);
        const th = BASE_TERRAIN + Math.floor(h * 14);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          if (y === 0) { this.setBlock(x, y, z, 10); }
          else if (y < th - 4) {
            this.setBlock(x, y, z, 3);
            const on = noise2.noise2D(x * 0.3 + y * 0.2, z * 0.3);
            if (y < 8 && on > 0.7) this.setBlock(x, y, z, 17);
            else if (y < 15 && on > 0.6) this.setBlock(x, y, z, 16);
            else if (y < 22 && on > 0.55) this.setBlock(x, y, z, 15);
            else if (on > 0.5) this.setBlock(x, y, z, 14);
          } else if (y < th - 1) { this.setBlock(x, y, z, 2); }
          else if (y === th - 1) {
            this.setBlock(x, y, z, th <= SEA_LEVEL + 1 ? 6 : (th > BASE_TERRAIN + 12 ? 11 : 1));
          } else if (y < SEA_LEVEL) { this.setBlock(x, y, z, 7); }
        }
        for (let y = 2; y < th - 2; y++) {
          if (noise2.fbm(x * 0.08, y * 0.08 + z * 0.08, 3, 2.0, 0.5) > 0.45) this.setBlock(x, y, z, 0);
        }
      }
      if (progressCb && x % 4 === 0) progressCb((x / WORLD_SIZE) * 70);
    }
    // Trees
    for (let x = 3; x < WORLD_SIZE - 3; x += 3) {
      for (let z = 3; z < WORLD_SIZE - 3; z += 3) {
        if (this.noise2.noise2D(x * 0.5, z * 0.5) > 0.2) {
          for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
            if (this.getBlock(x, y, z) === 1) { this.placeTree(x, y + 1, z); break; }
          }
        }
      }
    }
    if (progressCb) progressCb(100);
  }

  placeTree(x, y, z) {
    const h = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < h; i++) this.setBlock(x, y + i, z, 4);
    const ls = y + h - 2;
    for (let ly = ls; ly <= y + h + 1; ly++) {
      const r = ly <= y + h - 1 ? 2 : 1;
      for (let lx = -r; lx <= r; lx++) for (let lz = -r; lz <= r; lz++) {
        if (lx === 0 && lz === 0 && ly < y + h) continue;
        if (Math.abs(lx) === r && Math.abs(lz) === r && Math.random() > 0.5) continue;
        if (this.getBlock(x + lx, ly, z + lz) === 0) this.setBlock(x + lx, ly, z + lz, 5);
      }
    }
  }

  // Merged geometry mesh builder - ONE mesh per block type
  buildMesh(scene, blockMaterials) {
    for (const m of this.meshGroup) { scene.remove(m); m.geometry.dispose(); }
    this.meshGroup = [];

    // Collect exposed faces per block type, grouped by matType
    const data = {}; // blockId -> { 0:[], 1:[], 2:[] } (side/top/bottom face quads)

    for (let x = 0; x < WORLD_SIZE; x++)
      for (let y = 0; y < WORLD_HEIGHT; y++)
        for (let z = 0; z < WORLD_SIZE; z++) {
          const bid = this.getBlock(x, y, z);
          if (!bid || !BLOCK_TYPES[bid] || !BLOCK_TYPES[bid].solid) continue;

          for (const face of FACES) {
            const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
            const nb = this.getBlock(nx, ny, nz);
            const nbt = BLOCK_TYPES[nb];
            if (nb !== 0 && nbt && nbt.solid && !nbt.transparent) continue;
            if (nb === bid && nbt && nbt.transparent) continue;

            if (!data[bid]) data[bid] = { 0: [], 1: [], 2: [] };
            data[bid][face.mt].push({ x, y, z, corners: face.c });
          }
        }

    // Build geometry per block type
    for (const [bid, groups] of Object.entries(data)) {
      const positions = [], normals = [], uvs = [], indices = [];
      const matGroups = [];
      let vOff = 0;

      for (let mt = 0; mt < 3; mt++) {
        const faces = groups[mt];
        if (!faces || faces.length === 0) { matGroups.push(null); continue; }
        const start = indices.length;

        for (const f of faces) {
          for (const c of f.corners) {
            positions.push(f.x + c[0], f.y + c[1], f.z + c[2]);
            uvs.push(c[3], c[4]);
          }
          // Normal from first triangle cross product
          const ax = f.x + f.corners[1][0] - f.x - f.corners[0][0];
          const ay = f.y + f.corners[1][1] - f.y - f.corners[0][1];
          const az = f.z + f.corners[1][2] - f.z - f.corners[0][2];
          const bx = f.x + f.corners[2][0] - f.x - f.corners[0][0];
          const by = f.y + f.corners[2][1] - f.y - f.corners[0][1];
          const bz = f.z + f.corners[2][2] - f.z - f.corners[0][2];
          const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          for (let i = 0; i < 4; i++) normals.push(nx / len, ny / len, nz / len);

          indices.push(vOff, vOff + 1, vOff + 2, vOff, vOff + 2, vOff + 3);
          vOff += 4;
        }
        matGroups.push({ start, count: indices.length - start, mt });
      }

      if (positions.length === 0) continue;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);

      // Material array: [side, top, bottom]
      const srcMat = blockMaterials[bid];
      const mats = [srcMat[0], srcMat[2], srcMat[3]];

      for (const g of matGroups) {
        if (g) geo.addGroup(g.start, g.count, g.mt);
      }

      const mesh = new THREE.Mesh(geo, mats);
      scene.add(mesh);
      this.meshGroup.push(mesh);
    }
  }

  // DDA Voxel Raycast
  raycast(origin, direction, maxDist) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const sx = direction.x >= 0 ? 1 : -1;
    const sy = direction.y >= 0 ? 1 : -1;
    const sz = direction.z >= 0 ? 1 : -1;
    const tdx = Math.abs(1 / direction.x);
    const tdy = Math.abs(1 / direction.y);
    const tdz = Math.abs(1 / direction.z);
    let tmx = direction.x !== 0 ? ((sx > 0 ? x + 1 - origin.x : origin.x - x) * tdx) : 1e9;
    let tmy = direction.y !== 0 ? ((sy > 0 ? y + 1 - origin.y : origin.y - y) * tdy) : 1e9;
    let tmz = direction.z !== 0 ? ((sz > 0 ? z + 1 - origin.z : origin.z - z) * tdz) : 1e9;
    let dist = 0, face = { x: 0, y: 0, z: 0 };

    for (let i = 0; i < 100 && dist < maxDist; i++) {
      const b = this.getBlock(x, y, z);
      if (b !== 0 && BLOCK_TYPES[b] && BLOCK_TYPES[b].solid) {
        return { x, y, z, blockId: b, face };
      }
      if (tmx < tmy) {
        if (tmx < tmz) { x += sx; dist = tmx; tmx += tdx; face = { x: -sx, y: 0, z: 0 }; }
        else { z += sz; dist = tmz; tmz += tdz; face = { x: 0, y: 0, z: -sz }; }
      } else {
        if (tmy < tmz) { y += sy; dist = tmy; tmy += tdy; face = { x: 0, y: -sy, z: 0 }; }
        else { z += sz; dist = tmz; tmz += tdz; face = { x: 0, y: 0, z: -sz }; }
      }
    }
    return null;
  }

  findSpawnPosition() {
    // Try multiple positions to find solid ground with open air above
    const cx = Math.floor(WORLD_SIZE / 2), cz = Math.floor(WORLD_SIZE / 2);
    const candidates = [[cx, cz]];
    for (let dx = -3; dx <= 3; dx += 2) {
      for (let dz = -3; dz <= 3; dz += 2) {
        const sx = Math.min(WORLD_SIZE - 1, Math.max(0, cx + dx));
        const sz = Math.min(WORLD_SIZE - 1, Math.max(0, cz + dz));
        candidates.push([sx, sz]);
      }
    }

    for (const [px, pz] of candidates) {
      for (let y = WORLD_HEIGHT - 1; y >= 1; y--) {
        const b = this.getBlock(px, y, pz);
        if (b !== 0 && b !== 7) {
          // Ensure two blocks of open air above for the player
          const above1 = this.getBlock(px, y + 1, pz);
          const above2 = this.getBlock(px, y + 2, pz);
          if ((above1 === 0 || above1 === 7) && (above2 === 0 || above2 === 7)) {
            return { x: px + 0.5, y: y + 1 + 1.6, z: pz + 0.5 };
          }
        }
      }
    }
    return { x: cx + 0.5, y: 25, z: cz + 0.5 };
  }

}
