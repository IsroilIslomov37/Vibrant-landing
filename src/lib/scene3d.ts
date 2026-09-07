/**
 * A small, dependency-free 3D renderer for the pinned hero scene.
 *
 * Why not three.js: the scene is a few hundred flat-shaded faces driven by a
 * scroll timeline. A real perspective camera + painter's algorithm on a 2D
 * canvas renders it at 60fps on a phone, ships ~0 KB of extra JavaScript, and
 * needs no WebGL context (which is what usually dies first on low-end Android).
 *
 * Pipeline per frame:
 *   1. apply per-mesh spin into a scratch world buffer
 *   2. project every vertex once (perspective divide)
 *   3. per face: backface cull, world-space normal -> diffuse + rim lighting
 *   4. depth sort (painter) and fill
 *   5. additive passes for orbit lines, screen glows and particles
 */

export type RGB = [number, number, number];
export type Cluster = 'base' | 'hub' | 'desks' | 'community';
export type Layer = 'ground' | 'object';
export type Quality = 'high' | 'medium' | 'low';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Flat shape so GSAP can tween every channel directly. */
export interface CameraState {
  yaw: number;
  pitch: number;
  distance: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  fov: number;
  roll: number;
  lightYaw: number;
  exposure: number;
  focusHub: number;
  focusDesks: number;
  focusCommunity: number;
  /** Pointer parallax, in degrees, layered on top of the scroll keyframes. */
  parallaxYaw: number;
  parallaxPitch: number;
}

interface Spin {
  speed: number;
  cx: number;
  cy: number;
  cz: number;
}

interface Face {
  /** Indices into the owning mesh's vertex buffer. */
  idx: number[];
  color: RGB;
  /** 0 = fully lit by the scene light, 1 = self-illuminated. */
  emissive: number;
  alpha: number;
  /** Draws a hairline edge in a lighter tint — reads as a bevel. */
  edge?: boolean;
}

interface Mesh {
  cluster: Cluster;
  layer: Layer;
  base: Float32Array;
  world: Float32Array;
  screen: Float32Array; // sx, sy, depth, visible
  faces: Face[];
  spin?: Spin;
}

interface Polyline {
  cluster: Cluster;
  layer: Layer;
  base: Float32Array;
  world: Float32Array;
  screen: Float32Array;
  color: RGB;
  alpha: number;
  width: number;
  closed: boolean;
  additive: boolean;
  spin?: Spin;
}

interface Glow {
  cluster: Cluster;
  x: number;
  y: number;
  z: number;
  radius: number;
  color: RGB;
  intensity: number;
  /** Adds a slow breathing pulse so the scene never looks frozen. */
  pulse: number;
  spin?: Spin;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  phase: number;
  color: RGB;
}

export interface Scene {
  meshes: Mesh[];
  lines: Polyline[];
  glows: Glow[];
  particles: Particle[];
  quality: Quality;
}

/* ------------------------------------------------------------------ palette */

const C = {
  deck: [30, 34, 66] as RGB,
  deckEdge: [58, 64, 118] as RGB,
  deckTop: [38, 43, 82] as RGB,
  brand: [109, 91, 255] as RGB,
  brandDeep: [71, 48, 209] as RGB,
  aqua: [34, 200, 231] as RGB,
  sun: [255, 138, 31] as RGB,
  rose: [255, 77, 141] as RGB,
  panel: [46, 52, 96] as RGB,
  panelLight: [72, 80, 138] as RGB,
  bone: [222, 228, 255] as RGB,
  wood: [92, 76, 132] as RGB,
  screen: [140, 220, 255] as RGB,
};

const DEG = Math.PI / 180;

/* --------------------------------------------------------- geometry helpers */

function rotateY(x: number, z: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c + z * s, -x * s + z * c];
}

interface BoxOptions {
  rotY?: number;
  /** Per-face colours override the base colour, keyed by face name. */
  top?: RGB;
  side?: RGB;
  emissive?: number;
  emissiveTop?: number;
  alpha?: number;
  edge?: boolean;
  /** Shears the top face backwards — used for the angled laptop screens. */
  tiltX?: number;
}

/** Emits an axis-aligned box (optionally rotated about Y) into a mesh builder. */
function pushBox(
  verts: number[],
  faces: Face[],
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  color: RGB,
  options: BoxOptions = {},
) {
  const { rotY = 0, top, side, emissive = 0, emissiveTop, alpha = 1, edge = true, tiltX = 0 } = options;
  const base = verts.length / 3;
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;

  // 0-3 bottom ring, 4-7 top ring (matching the winding table below).
  const local: [number, number, number][] = [
    [-hw, -hh, -hd],
    [hw, -hh, -hd],
    [hw, -hh, hd],
    [-hw, -hh, hd],
    [-hw + tiltX, hh, -hd],
    [hw + tiltX, hh, -hd],
    [hw + tiltX, hh, hd],
    [-hw + tiltX, hh, hd],
  ];

  for (const [lx, ly, lz] of local) {
    const [rx, rz] = rotateY(lx, lz, rotY);
    verts.push(cx + rx, cy + ly, cz + rz);
  }

  const sideColor = side ?? color;
  const topColor = top ?? color;
  const topEmissive = emissiveTop ?? emissive;

  // Outward CCW winding, so a world-space normal always points away from the solid.
  const defs: [number[], RGB, number][] = [
    [[3, 2, 6, 7], sideColor, emissive], // +Z
    [[1, 0, 4, 5], sideColor, emissive], // -Z
    [[0, 3, 7, 4], sideColor, emissive], // -X
    [[2, 1, 5, 6], sideColor, emissive], // +X
    [[7, 6, 5, 4], topColor, topEmissive], // +Y
    [[0, 1, 2, 3], sideColor, emissive], // -Y
  ];

  for (const [idx, faceColor, faceEmissive] of defs) {
    faces.push({
      idx: idx.map((i) => base + i),
      color: faceColor,
      emissive: faceEmissive,
      alpha,
      edge,
    });
  }
}

/** Octahedron subdivided `depth` times — the cheapest convincing sphere. */
function pushSphere(
  verts: number[],
  faces: Face[],
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  depth: number,
  color: RGB,
  emissive: number,
  alpha = 1,
) {
  const base = verts.length / 3;
  const points: [number, number, number][] = [];
  const tris: number[][] = [];

  const seedPoints: [number, number, number][] = [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
    [0, 0, -1],
    [0, -1, 0],
  ];
  const seedTris = [
    [0, 1, 2],
    [0, 2, 3],
    [0, 3, 4],
    [0, 4, 1],
    [5, 2, 1],
    [5, 3, 2],
    [5, 4, 3],
    [5, 1, 4],
  ];
  points.push(...seedPoints);

  let current = seedTris;
  for (let level = 0; level < depth; level += 1) {
    const next: number[][] = [];
    const cache = new Map<string, number>();
    const midpoint = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const pa = points[a];
      const pb = points[b];
      const mx = (pa[0] + pb[0]) / 2;
      const my = (pa[1] + pb[1]) / 2;
      const mz = (pa[2] + pb[2]) / 2;
      const len = Math.hypot(mx, my, mz) || 1;
      points.push([mx / len, my / len, mz / len]);
      const index = points.length - 1;
      cache.set(key, index);
      return index;
    };
    for (const [a, b, c] of current) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    current = next;
  }
  tris.push(...current);

  for (const [px, py, pz] of points) {
    verts.push(cx + px * radius, cy + py * radius, cz + pz * radius);
  }
  for (const tri of tris) {
    faces.push({
      idx: tri.map((i) => base + i),
      color,
      emissive,
      alpha,
      edge: false,
    });
  }
}

function ring(radius: number, segments: number, tiltX: number, tiltZ: number, cx: number, cy: number, cz: number) {
  const points: number[] = [];
  const cosX = Math.cos(tiltX);
  const sinX = Math.sin(tiltX);
  const cosZ = Math.cos(tiltZ);
  const sinZ = Math.sin(tiltZ);
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    let x = Math.cos(a) * radius;
    let y = 0;
    let z = Math.sin(a) * radius;
    // rotate X
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    y = y1;
    z = z1;
    // rotate Z
    const x1 = x * cosZ - y * sinZ;
    const y2 = x * sinZ + y * cosZ;
    x = x1;
    y = y2;
    points.push(cx + x, cy + y, cz + z);
  }
  return new Float32Array(points);
}

function makeMesh(cluster: Cluster, layer: Layer, verts: number[], faces: Face[], spin?: Spin): Mesh {
  const base = new Float32Array(verts);
  return {
    cluster,
    layer,
    base,
    world: new Float32Array(base.length),
    screen: new Float32Array((base.length / 3) * 4),
    faces,
    spin,
  };
}

function makeLine(
  cluster: Cluster,
  layer: Layer,
  points: Float32Array,
  color: RGB,
  alpha: number,
  width: number,
  options: { closed?: boolean; additive?: boolean; spin?: Spin } = {},
): Polyline {
  return {
    cluster,
    layer,
    base: points,
    world: new Float32Array(points.length),
    screen: new Float32Array((points.length / 3) * 4),
    color,
    alpha,
    width,
    closed: options.closed ?? false,
    additive: options.additive ?? true,
    spin: options.spin,
  };
}

/* --------------------------------------------------- authored campus geometry */

/**
 * A triangle batch exported from the Blender campus scene, already merged by
 * (cluster, material) and welded. Produced by `tools/glb-to-scene.mjs`.
 */
export interface CampusGroup {
  cluster: Cluster;
  material: string;
  color: RGB;
  emissive: number;
  alpha: number;
  positions: number[];
  indices: number[];
}

export interface CampusData {
  triangles: number;
  groups: CampusGroup[];
}

/**
 * Groups that orbit or rotate. The authored geometry is static, so the few
 * pieces that should feel alive get their spin re-attached here rather than
 * being baked into the export.
 */
const CAMPUS_SPIN: Record<string, Spin> = {
  'hub|brand': { speed: 0.16, cx: 0, cy: 6.2, cz: 0 },
  'hub|aqua': { speed: -0.24, cx: 0, cy: 6.2, cz: 0 },
  'hub|rose': { speed: 0.19, cx: 0, cy: 6.2, cz: 0 },
};

/** Decorative dressing dropped first when the device cannot afford the full scene. */
const CAMPUS_OPTIONAL = new Set(['leaf', 'wood', 'gold', 'ink']);

/** Turns the exported batches into renderer meshes. */
export function buildCampusMeshes(data: CampusData, quality: Quality): Mesh[] {
  const meshes: Mesh[] = [];

  for (const group of data.groups) {
    if (quality === 'low' && group.cluster === 'base' && CAMPUS_OPTIONAL.has(group.material)) {
      continue;
    }

    const faces: Face[] = [];
    for (let i = 0; i < group.indices.length; i += 3) {
      faces.push({
        idx: [group.indices[i], group.indices[i + 1], group.indices[i + 2]],
        color: group.color,
        emissive: group.emissive,
        alpha: group.alpha,
        // Triangles from a modelled mesh share interior edges; stroking them
        // would draw a wireframe over every surface.
        edge: false,
      });
    }

    const base = Float32Array.from(group.positions);
    meshes.push({
      cluster: group.cluster,
      // The deck reads as ground so the floor grid draws on top of it.
      layer: group.cluster === 'base' && group.material.startsWith('deck') ? 'ground' : 'object',
      base,
      world: new Float32Array(base.length),
      screen: new Float32Array((base.length / 3) * 4),
      faces,
      spin: CAMPUS_SPIN[`${group.cluster}|${group.material}`],
    });
  }

  return meshes;
}

/** Fetches and validates the authored campus payload. Returns null on any failure. */
export async function loadCampus(url: string, signal?: AbortSignal): Promise<CampusData | null> {
  try {
    const response = await fetch(url, { signal, cache: 'force-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as CampusData;
    if (!Array.isArray(data?.groups) || data.groups.length === 0) throw new Error('empty payload');
    return data;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return null;
    // The procedural scene stays on screen — this is an upgrade, not a dependency.
    console.warn('[scene3d] Campus geometry unavailable, keeping the procedural scene.', error);
    return null;
  }
}

/* ------------------------------------------------------------ scene builder */

/**
 * Builds the "Vibrant Campus": a floating deck carrying a knowledge core (hub),
 * a row of workstations (desks) and an achievement/alumni constellation
 * (community). The three clusters are what the scroll camera travels between.
 *
 * Solid geometry comes from the Blender-authored export when `campus` is
 * supplied; the procedural version below is the fallback and the first-paint
 * scene while that file is still in flight. Lights, orbit rings, glows,
 * particles and the floor grid are procedural either way.
 */
export function createScene(quality: Quality, campus?: CampusData | null): Scene {
  const meshes: Mesh[] = [];
  const proceduralMeshes: Mesh[] = [];
  const lines: Polyline[] = [];
  const glows: Glow[] = [];
  const particles: Particle[] = [];

  const deskCount = quality === 'high' ? 3 : quality === 'medium' ? 2 : 1;
  const sphereDepth = quality === 'high' ? 2 : 1;
  const nodeCount = quality === 'high' ? 8 : quality === 'medium' ? 6 : 4;
  const particleCount = quality === 'high' ? 90 : quality === 'medium' ? 45 : 0;
  const ringSegments = quality === 'high' ? 72 : 40;

  /* ------------------------------------------------------------ the deck */
  {
    const verts: number[] = [];
    const faces: Face[] = [];
    pushBox(verts, faces, 0, -0.6, 0, 34, 1.2, 26, C.deck, {
      top: C.deckTop,
      side: C.deck,
      edge: true,
    });
    // A thinner under-plate reads as a machined bevel from low camera angles.
    pushBox(verts, faces, 0, -1.7, 0, 30, 1, 22, C.deckEdge, { edge: false, alpha: 0.9 });
    proceduralMeshes.push(makeMesh('base', 'ground', verts, faces));
  }

  // Floor grid: cheap, and it is what sells the perspective change during the orbit.
  {
    const half = 16;
    const step = 2;
    for (let i = -half; i <= half; i += step) {
      lines.push(
        makeLine('base', 'ground', new Float32Array([-half, 0.02, i, half, 0.02, i]), C.brand, 0.16, 1, {
          additive: false,
        }),
      );
      lines.push(
        makeLine('base', 'ground', new Float32Array([i, 0.02, -12, i, 0.02, 12]), C.brand, 0.16, 1, {
          additive: false,
        }),
      );
    }
  }

  /* -------------------------------------------------------- knowledge hub */
  {
    const verts: number[] = [];
    const faces: Face[] = [];
    pushSphere(verts, faces, 0, 6.2, 0, 2.1, sphereDepth, C.brand, 0.55, 0.92);
    proceduralMeshes.push(makeMesh('hub', 'object', verts, faces, { speed: 0.16, cx: 0, cy: 6.2, cz: 0 }));

    const innerVerts: number[] = [];
    const innerFaces: Face[] = [];
    pushSphere(innerVerts, innerFaces, 0, 6.2, 0, 1.15, 0, C.aqua, 1, 1);
    proceduralMeshes.push(makeMesh('hub', 'object', innerVerts, innerFaces, { speed: -0.42, cx: 0, cy: 6.2, cz: 0 }));

    glows.push({ cluster: 'hub', x: 0, y: 6.2, z: 0, radius: 260, color: C.brand, intensity: 0.9, pulse: 0.18 });

    // Orbit rings — the clearest read of the camera pivot as the scroll advances.
    lines.push(
      makeLine('hub', 'object', ring(4.4, ringSegments, 0.42, 0.18, 0, 6.2, 0), C.aqua, 0.75, 1.6, {
        closed: true,
        spin: { speed: 0.22, cx: 0, cy: 6.2, cz: 0 },
      }),
      makeLine('hub', 'object', ring(5.6, ringSegments, -0.55, 0.5, 0, 6.2, 0), C.brand, 0.6, 1.4, {
        closed: true,
        spin: { speed: -0.15, cx: 0, cy: 6.2, cz: 0 },
      }),
      makeLine('hub', 'object', ring(6.8, ringSegments, 0.2, -0.4, 0, 6.2, 0), C.rose, 0.4, 1.2, {
        closed: true,
        spin: { speed: 0.1, cx: 0, cy: 6.2, cz: 0 },
      }),
    );

    // Column carrying the core, plus a stack of books at its foot.
    const columnVerts: number[] = [];
    const columnFaces: Face[] = [];
    pushBox(columnVerts, columnFaces, 0, 1.9, 0, 1.1, 4.6, 1.1, C.panel, {
      top: C.panelLight,
      emissiveTop: 0.4,
    });
    const bookColors: RGB[] = [C.sun, C.aqua, C.rose, C.brand];
    for (let i = 0; i < 4; i += 1) {
      pushBox(columnVerts, columnFaces, 1.9, 0.22 + i * 0.34, 1.5, 2.2, 0.3, 1.5, bookColors[i], {
        rotY: i * 0.22,
        emissive: 0.18,
      });
    }
    proceduralMeshes.push(makeMesh('hub', 'object', columnVerts, columnFaces));
  }

  /* ------------------------------------------------------------ the desks */
  {
    const verts: number[] = [];
    const faces: Face[] = [];
    for (let i = 0; i < deskCount; i += 1) {
      const dx = -6.4;
      const dz = 4.6 - i * 3.9;
      const rot = 0.18 - i * 0.16;

      // Table top + two slab supports.
      pushBox(verts, faces, dx, 1.5, dz, 4.6, 0.18, 2.2, C.wood, { rotY: rot, top: [112, 96, 156] });
      pushBox(verts, faces, dx - 1.8, 0.75, dz, 0.22, 1.5, 1.9, C.panel, { rotY: rot });
      pushBox(verts, faces, dx + 1.8, 0.75, dz, 0.22, 1.5, 1.9, C.panel, { rotY: rot });

      // Laptop: base + a screen sheared backwards.
      pushBox(verts, faces, dx - 0.3, 1.66, dz, 1.5, 0.12, 1.05, C.panelLight, { rotY: rot });
      pushBox(verts, faces, dx - 0.3, 2.16, dz - 0.5, 1.5, 1.0, 0.1, C.panel, {
        rotY: rot,
        tiltX: 0,
        top: C.screen,
        emissiveTop: 0.2,
      });
      // The lit screen face itself, floated a hair in front to avoid z-fighting.
      pushBox(verts, faces, dx - 0.3, 2.16, dz - 0.44, 1.34, 0.86, 0.02, C.screen, {
        rotY: rot,
        emissive: 0.95,
        edge: false,
      });

      // Chair.
      pushBox(verts, faces, dx + 0.1, 0.95, dz + 1.9, 1.2, 0.14, 1.2, C.panelLight, { rotY: rot });
      pushBox(verts, faces, dx + 0.1, 1.5, dz + 2.4, 1.2, 1.1, 0.14, C.panel, { rotY: rot });

      // A mug of something, because the desks should look used.
      pushBox(verts, faces, dx + 1.4, 1.75, dz + 0.4, 0.32, 0.36, 0.32, C.sun, { rotY: rot, emissive: 0.3 });

      glows.push({
        cluster: 'desks',
        x: dx - 0.3,
        y: 2.16,
        z: dz - 0.5,
        radius: 90,
        color: C.screen,
        intensity: 0.55,
        pulse: 0.05,
      });
    }
    proceduralMeshes.push(makeMesh('desks', 'object', verts, faces));
  }

  /* -------------------------------------------------- community & outcomes */
  {
    const cx = 6.2;
    const cy = 4.6;
    const cz = -4.2;

    const verts: number[] = [];
    const faces: Face[] = [];

    // Plinth.
    pushBox(verts, faces, cx, 0.6, cz, 5, 1.2, 5, C.panel, { top: C.panelLight, emissiveTop: 0.25, rotY: 0.4 });

    // Graduation cap: a thin slab rotated 45° over a small block.
    pushBox(verts, faces, cx, cy - 0.4, cz, 1.5, 0.7, 1.5, C.brandDeep, { rotY: 0.45 });
    pushBox(verts, faces, cx, cy + 0.12, cz, 3.1, 0.16, 3.1, C.brand, {
      rotY: 0.45,
      top: C.aqua,
      emissiveTop: 0.5,
    });

    // Alumni nodes orbiting the cap.
    const nodes: [number, number, number][] = [];
    for (let i = 0; i < nodeCount; i += 1) {
      const a = (i / nodeCount) * Math.PI * 2;
      const r = 3.6;
      const nx = cx + Math.cos(a) * r;
      const ny = cy + 1.6 + Math.sin(a * 2) * 1.1;
      const nz = cz + Math.sin(a) * r;
      nodes.push([nx, ny, nz]);
      pushSphere(verts, faces, nx, ny, nz, 0.42, 0, i % 2 === 0 ? C.aqua : C.rose, 0.85);
      glows.push({
        cluster: 'community',
        x: nx,
        y: ny,
        z: nz,
        radius: 54,
        color: i % 2 === 0 ? C.aqua : C.rose,
        intensity: 0.5,
        pulse: 0.25,
      });
    }
    proceduralMeshes.push(
      makeMesh('community', 'object', verts, faces, undefined),
    );

    // Network edges from each node back to the cap — the "community" read.
    for (const [nx, ny, nz] of nodes) {
      lines.push(
        makeLine('community', 'object', new Float32Array([cx, cy + 0.2, cz, nx, ny, nz]), C.aqua, 0.4, 1, {
          spin: { speed: 0.12, cx, cy, cz },
        }),
      );
    }

    // Wireframe globe around the whole cluster.
    for (let i = 0; i < 6; i += 1) {
      lines.push(
        makeLine('community', 'object', ring(4.6, ringSegments, Math.PI / 2, (i / 6) * Math.PI, cx, cy + 1.2, cz), C.brand, 0.22, 1, {
          closed: true,
          spin: { speed: 0.09, cx, cy: cy + 1.2, cz },
        }),
      );
    }

    glows.push({ cluster: 'community', x: cx, y: cy, z: cz, radius: 200, color: C.aqua, intensity: 0.7, pulse: 0.12 });
  }

  /* ----------------------------------------------- back pillars for depth */
  {
    const verts: number[] = [];
    const faces: Face[] = [];
    const spots: [number, number, number][] = [
      [-11, 3.2, -8],
      [11.5, 4.4, 7.5],
      [-2.5, 2.4, -10.5],
      [8, 2.8, 9.5],
    ];
    for (const [px, ph, pz] of spots) {
      pushBox(verts, faces, px, ph / 2, pz, 1.1, ph, 1.1, C.deckEdge, {
        top: C.aqua,
        emissiveTop: 0.7,
        rotY: 0.4,
      });
      glows.push({ cluster: 'base', x: px, y: ph, z: pz, radius: 46, color: C.aqua, intensity: 0.35, pulse: 0.2 });
    }
    proceduralMeshes.push(makeMesh('base', 'object', verts, faces));
  }

  /* --------------------------------------------------------- dust motes */
  for (let i = 0; i < particleCount; i += 1) {
    particles.push({
      x: (Math.random() - 0.5) * 34,
      y: Math.random() * 14 + 0.5,
      z: (Math.random() - 0.5) * 26,
      size: Math.random() * 1.6 + 0.6,
      speed: Math.random() * 0.28 + 0.08,
      phase: Math.random() * Math.PI * 2,
      color: i % 3 === 0 ? C.aqua : i % 3 === 1 ? C.brand : C.sun,
    });
  }

  if (campus) {
    meshes.push(...buildCampusMeshes(campus, quality));
  } else {
    meshes.push(...proceduralMeshes);
  }

  return { meshes, lines, glows, particles, quality };
}

/* ---------------------------------------------------------------- renderer */

interface Basis {
  px: number;
  py: number;
  pz: number;
  rx: number;
  ry: number;
  rz: number;
  ux: number;
  uy: number;
  uz: number;
  fx: number;
  fy: number;
  fz: number;
  focal: number;
}

function computeBasis(cam: CameraState, height: number): Basis {
  const yaw = (cam.yaw + cam.parallaxYaw) * DEG;
  const pitch = Math.max(-78, Math.min(78, cam.pitch + cam.parallaxPitch)) * DEG;
  const cosPitch = Math.cos(pitch);

  const px = cam.targetX + cam.distance * cosPitch * Math.sin(yaw);
  const py = cam.targetY + cam.distance * Math.sin(pitch);
  const pz = cam.targetZ + cam.distance * cosPitch * Math.cos(yaw);

  let fx = cam.targetX - px;
  let fy = cam.targetY - py;
  let fz = cam.targetZ - pz;
  const flen = Math.hypot(fx, fy, fz) || 1;
  fx /= flen;
  fy /= flen;
  fz /= flen;

  // right = forward x worldUp, with worldUp = (0, 1, 0) folded in.
  let rx = -fz;
  let ry = 0;
  let rz = fx;
  const rlen = Math.hypot(rx, ry, rz) || 1;
  rx /= rlen;
  ry /= rlen;
  rz /= rlen;

  // up = right x forward
  let ux = ry * fz - rz * fy;
  let uy = rz * fx - rx * fz;
  let uz = rx * fy - ry * fx;

  // Apply roll by rotating the right/up pair around the forward axis.
  const roll = cam.roll * DEG;
  if (roll !== 0) {
    const c = Math.cos(roll);
    const s = Math.sin(roll);
    const nrx = rx * c + ux * s;
    const nry = ry * c + uy * s;
    const nrz = rz * c + uz * s;
    ux = ux * c - rx * s;
    uy = uy * c - ry * s;
    uz = uz * c - rz * s;
    rx = nrx;
    ry = nry;
    rz = nrz;
  }

  const focal = height / 2 / Math.tan((cam.fov * DEG) / 2);
  return { px, py, pz, rx, ry, rz, ux, uy, uz, fx, fy, fz, focal };
}

const NEAR = 0.35;

function projectBuffer(
  world: Float32Array,
  screen: Float32Array,
  basis: Basis,
  halfW: number,
  halfH: number,
) {
  const count = world.length / 3;
  for (let i = 0; i < count; i += 1) {
    const dx = world[i * 3] - basis.px;
    const dy = world[i * 3 + 1] - basis.py;
    const dz = world[i * 3 + 2] - basis.pz;
    const cz = dx * basis.fx + dy * basis.fy + dz * basis.fz;
    const o = i * 4;
    if (cz <= NEAR) {
      screen[o + 3] = 0;
      screen[o + 2] = cz;
      continue;
    }
    const cx = dx * basis.rx + dy * basis.ry + dz * basis.rz;
    const cy = dx * basis.ux + dy * basis.uy + dz * basis.uz;
    const inv = basis.focal / cz;
    screen[o] = halfW + cx * inv;
    screen[o + 1] = halfH - cy * inv;
    screen[o + 2] = cz;
    screen[o + 3] = 1;
  }
}

function applySpin(mesh: Mesh | Polyline, time: number) {
  const { base, world, spin } = mesh;
  if (!spin) {
    world.set(base);
    return;
  }
  const angle = time * spin.speed;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (let i = 0; i < base.length; i += 3) {
    const x = base[i] - spin.cx;
    const z = base[i + 2] - spin.cz;
    world[i] = spin.cx + x * c + z * s;
    world[i + 1] = base[i + 1];
    world[i + 2] = spin.cz + (-x * s + z * c);
  }
}

interface DrawFace {
  mesh: Mesh;
  face: Face;
  depth: number;
  shade: number;
  rim: number;
}

const FOG: RGB = [10, 13, 32];

function focusOf(cam: CameraState, cluster: Cluster): number {
  switch (cluster) {
    case 'hub':
      return cam.focusHub;
    case 'desks':
      return cam.focusDesks;
    case 'community':
      return cam.focusCommunity;
    default:
      return Math.max(cam.focusHub, cam.focusDesks, cam.focusCommunity) * 0.6 + 0.4;
  }
}

function mixChannel(value: number, target: number, amount: number) {
  return value + (target - value) * amount;
}

export interface RenderOptions {
  width: number;
  height: number;
  dpr: number;
  time: number;
  /** 0 = scene fully faded out (used while the hero is off-screen). */
  opacity: number;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  cam: CameraState,
  options: RenderOptions,
) {
  const { width, height, time, opacity } = options;
  const halfW = width / 2;
  const halfH = height / 2;
  const basis = computeBasis(cam, height);

  const lightAngle = cam.lightYaw * DEG;
  const lx = Math.sin(lightAngle) * 0.72;
  const ly = 0.66;
  const lz = Math.cos(lightAngle) * 0.72;
  const llen = Math.hypot(lx, ly, lz);
  const lightX = lx / llen;
  const lightY = ly / llen;
  const lightZ = lz / llen;

  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = 1;

  /* ---------------------------------------------------- atmospheric wash */
  const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
  skyGradient.addColorStop(0, 'rgba(12,15,38,0)');
  skyGradient.addColorStop(1, 'rgba(8,10,28,0.55)');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, height);

  const horizon = ctx.createRadialGradient(halfW, halfH * 1.15, 0, halfW, halfH * 1.15, Math.max(width, height) * 0.75);
  horizon.addColorStop(0, `rgba(109,91,255,${0.2 * opacity})`);
  horizon.addColorStop(0.55, `rgba(34,200,231,${0.06 * opacity})`);
  horizon.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, width, height);

  // Project everything once per frame.
  for (const mesh of scene.meshes) {
    applySpin(mesh, time);
    projectBuffer(mesh.world, mesh.screen, basis, halfW, halfH);
  }
  for (const line of scene.lines) {
    applySpin(line, time);
    projectBuffer(line.world, line.screen, basis, halfW, halfH);
  }

  const groundFaces: DrawFace[] = [];
  const objectFaces: DrawFace[] = [];

  for (const mesh of scene.meshes) {
    const { world, screen, faces } = mesh;
    for (const face of faces) {
      const [i0, i1, i2] = face.idx;
      // Any vertex behind the near plane -> skip the face (no clipping pass).
      let visible = true;
      let depth = 0;
      for (const index of face.idx) {
        if (screen[index * 4 + 3] === 0) {
          visible = false;
          break;
        }
        depth += screen[index * 4 + 2];
      }
      if (!visible) continue;
      depth /= face.idx.length;

      const ax = world[i0 * 3];
      const ay = world[i0 * 3 + 1];
      const az = world[i0 * 3 + 2];
      const e1x = world[i1 * 3] - ax;
      const e1y = world[i1 * 3 + 1] - ay;
      const e1z = world[i1 * 3 + 2] - az;
      const e2x = world[i2 * 3] - ax;
      const e2y = world[i2 * 3 + 1] - ay;
      const e2z = world[i2 * 3 + 2] - az;
      let nx = e1y * e2z - e1z * e2y;
      let ny = e1z * e2x - e1x * e2z;
      let nz = e1x * e2y - e1y * e2x;
      const nlen = Math.hypot(nx, ny, nz) || 1;
      nx /= nlen;
      ny /= nlen;
      nz /= nlen;

      // Backface cull against the camera position.
      const vx = basis.px - ax;
      const vy = basis.py - ay;
      const vz = basis.pz - az;
      const vlen = Math.hypot(vx, vy, vz) || 1;
      const facing = (nx * vx + ny * vy + nz * vz) / vlen;
      if (facing <= 0.001) continue;

      const diffuse = Math.max(0, nx * lightX + ny * lightY + nz * lightZ);
      const shade = 0.34 + 0.66 * diffuse;
      // Fresnel-ish rim: faces turned away from the viewer catch the edge light.
      const rim = Math.pow(1 - Math.min(1, facing), 3);

      const bucket = mesh.layer === 'ground' ? groundFaces : objectFaces;
      bucket.push({ mesh, face, depth, shade, rim });
    }
  }

  const byDepth = (a: DrawFace, b: DrawFace) => b.depth - a.depth;
  groundFaces.sort(byDepth);
  objectFaces.sort(byDepth);

  const drawFaces = (list: DrawFace[]) => {
    for (const item of list) {
      const { mesh, face, shade, rim, depth } = item;
      const focus = focusOf(cam, mesh.cluster);
      const attention = 0.34 + 0.66 * focus;
      const fog = Math.min(0.82, Math.max(0, (depth - 14) / 46)) * (1 - focus * 0.55);

      const lit = shade * cam.exposure * attention;
      const emissiveBoost = face.emissive * (0.55 + 0.75 * focus);
      const rimBoost = rim * 0.42 * focus;

      let r = face.color[0] * (lit * (1 - face.emissive) + emissiveBoost) + rimBoost * 120;
      let g = face.color[1] * (lit * (1 - face.emissive) + emissiveBoost) + rimBoost * 140;
      let b = face.color[2] * (lit * (1 - face.emissive) + emissiveBoost) + rimBoost * 200;

      r = mixChannel(r, FOG[0], fog);
      g = mixChannel(g, FOG[1], fog);
      b = mixChannel(b, FOG[2], fog);

      const alpha = face.alpha * opacity * (0.35 + 0.65 * focus);
      if (alpha <= 0.01) continue;

      const screen = mesh.screen;
      ctx.beginPath();
      for (let i = 0; i < face.idx.length; i += 1) {
        const o = face.idx[i] * 4;
        if (i === 0) ctx.moveTo(screen[o], screen[o + 1]);
        else ctx.lineTo(screen[o], screen[o + 1]);
      }
      ctx.closePath();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fill();

      if (face.edge) {
        ctx.globalAlpha = alpha * 0.5 * focus;
        ctx.strokeStyle = `rgb(${Math.min(255, (r + 60) | 0)},${Math.min(255, (g + 66) | 0)},${Math.min(255, (b + 90) | 0)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  };

  const drawLines = (layer: Layer) => {
    for (const line of scene.lines) {
      if (line.layer !== layer) continue;
      const focus = focusOf(cam, line.cluster);
      const alpha = line.alpha * opacity * (0.2 + 0.8 * focus);
      if (alpha <= 0.01) continue;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `rgb(${line.color[0]},${line.color[1]},${line.color[2]})`;
      ctx.lineWidth = line.width;
      ctx.globalCompositeOperation = line.additive ? 'lighter' : 'source-over';

      const screen = line.screen;
      const count = screen.length / 4;
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i < count; i += 1) {
        const o = i * 4;
        if (screen[o + 3] === 0) {
          drawing = false;
          continue;
        }
        if (!drawing) {
          ctx.moveTo(screen[o], screen[o + 1]);
          drawing = true;
        } else {
          ctx.lineTo(screen[o], screen[o + 1]);
        }
      }
      if (line.closed && drawing && screen[3] !== 0) ctx.lineTo(screen[0], screen[1]);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  drawFaces(groundFaces);
  drawLines('ground');
  drawFaces(objectFaces);
  drawLines('object');

  /* ------------------------------------------------------------- glows */
  ctx.globalCompositeOperation = 'lighter';
  for (const glow of scene.glows) {
    const dx = glow.x - basis.px;
    const dy = glow.y - basis.py;
    const dz = glow.z - basis.pz;
    const cz = dx * basis.fx + dy * basis.fy + dz * basis.fz;
    if (cz <= NEAR) continue;
    const cx = dx * basis.rx + dy * basis.ry + dz * basis.rz;
    const cy = dx * basis.ux + dy * basis.uy + dz * basis.uz;
    const inv = basis.focal / cz;
    const sx = halfW + cx * inv;
    const sy = halfH - cy * inv;

    const focus = focusOf(cam, glow.cluster);
    const pulse = 1 + Math.sin(time * 1.6 + glow.x + glow.z) * glow.pulse;
    const radius = Math.max(4, glow.radius * inv * 0.045 * pulse);
    const intensity = glow.intensity * opacity * (0.2 + 0.8 * focus) * cam.exposure;
    if (intensity <= 0.02 || radius < 1) continue;

    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    gradient.addColorStop(0, `rgba(${glow.color[0]},${glow.color[1]},${glow.color[2]},${Math.min(0.9, intensity)})`);
    gradient.addColorStop(0.4, `rgba(${glow.color[0]},${glow.color[1]},${glow.color[2]},${intensity * 0.28})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /* --------------------------------------------------------- particles */
  for (const particle of scene.particles) {
    const py = particle.y + Math.sin(time * particle.speed + particle.phase) * 1.4;
    const dx = particle.x - basis.px;
    const dy = py - basis.py;
    const dz = particle.z - basis.pz;
    const cz = dx * basis.fx + dy * basis.fy + dz * basis.fz;
    if (cz <= NEAR) continue;
    const cx = dx * basis.rx + dy * basis.ry + dz * basis.rz;
    const cy = dx * basis.ux + dy * basis.uy + dz * basis.uz;
    const inv = basis.focal / cz;
    const sx = halfW + cx * inv;
    const sy = halfH - cy * inv;
    const size = Math.max(0.4, particle.size * inv * 0.06);
    const twinkle = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(time * 2 + particle.phase));
    ctx.globalAlpha = twinkle * opacity * Math.min(1, 26 / cz);
    ctx.fillStyle = `rgb(${particle.color[0]},${particle.color[1]},${particle.color[2]})`;
    ctx.beginPath();
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

/** Turns a content keyframe into the flat, tweenable camera state. */
export function toCameraState(
  keyframe: {
    yaw: number;
    pitch: number;
    distance: number;
    target: { x: number; y: number; z: number };
    fov: number;
    roll: number;
    lightYaw: number;
    exposure: number;
    focus: { hub: number; desks: number; community: number };
  },
): CameraState {
  return {
    yaw: keyframe.yaw,
    pitch: keyframe.pitch,
    distance: keyframe.distance,
    targetX: keyframe.target.x,
    targetY: keyframe.target.y,
    targetZ: keyframe.target.z,
    fov: keyframe.fov,
    roll: keyframe.roll,
    lightYaw: keyframe.lightYaw,
    exposure: keyframe.exposure,
    focusHub: keyframe.focus.hub,
    focusDesks: keyframe.focus.desks,
    focusCommunity: keyframe.focus.community,
    parallaxYaw: 0,
    parallaxPitch: 0,
  };
}

/** Picks a render budget from the device's own hints. */
export function detectQuality(): Quality {
  if (typeof window === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const narrow = window.innerWidth < 768;
  if (narrow || cores <= 4 || memory <= 4) return cores <= 2 || memory <= 2 ? 'low' : 'medium';
  return 'high';
}
