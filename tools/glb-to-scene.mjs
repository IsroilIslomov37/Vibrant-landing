/**
 * Converts the Blender-authored campus GLB into the compact format the site's
 * canvas renderer consumes.
 *
 *   node tools/glb-to-scene.mjs tools/campus.glb public/scene/campus.json
 *
 * Why not parse GLB in the browser: the runtime only needs positions, triangle
 * indices and one base colour per material. Dropping normals, UVs and tangents
 * and merging every primitive that shares (cluster, colour) turns a 352 KB GLB
 * into a ~10x smaller payload and removes the need to ship a glTF parser.
 *
 * Faces are grouped by "cluster" so the hero's focus system (which brightens
 * whatever the camera is looking at and fogs the rest) keeps working on the
 * imported geometry.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , inputPath = 'tools/campus.glb', outputPath = 'public/scene/campus.json'] = process.argv;

/* -------------------------------------------------------------- GLB parsing */

function parseGlb(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error('Not a GLB file.');
  const version = buffer.readUInt32LE(4);
  if (version !== 2) throw new Error(`Unsupported glTF version ${version}.`);

  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    if (chunkType === 'JSON') json = JSON.parse(buffer.toString('utf8', start, start + chunkLength));
    else if (chunkType.startsWith('BIN')) bin = buffer.subarray(start, start + chunkLength);
    offset = start + chunkLength;
  }
  if (!json) throw new Error('GLB has no JSON chunk.');
  return { json, bin };
}

const COMPONENT_READERS = {
  5120: { size: 1, read: (b, o) => b.readInt8(o) },
  5121: { size: 1, read: (b, o) => b.readUInt8(o) },
  5122: { size: 2, read: (b, o) => b.readInt16LE(o) },
  5123: { size: 2, read: (b, o) => b.readUInt16LE(o) },
  5125: { size: 4, read: (b, o) => b.readUInt32LE(o) },
  5126: { size: 4, read: (b, o) => b.readFloatLE(o) },
};

const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(json, bin, index) {
  const accessor = json.accessors[index];
  const reader = COMPONENT_READERS[accessor.componentType];
  const components = TYPE_COMPONENTS[accessor.type];
  if (!reader || !components) throw new Error(`Unsupported accessor ${accessor.componentType}/${accessor.type}`);

  const view = json.bufferViews[accessor.bufferView];
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? reader.size * components;

  const out = new Float64Array(accessor.count * components);
  for (let i = 0; i < accessor.count; i += 1) {
    for (let c = 0; c < components; c += 1) {
      out[i * components + c] = reader.read(bin, base + i * stride + c * reader.size);
    }
  }
  return { data: out, components, count: accessor.count };
}

/* ------------------------------------------------------------- node matrices */

function multiply(a, b) {
  const out = new Float64Array(16);
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function nodeMatrix(node) {
  if (node.matrix) return Float64Array.from(node.matrix);

  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];

  // Quaternion -> column-major rotation, pre-scaled per column.
  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;

  return Float64Array.from([
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]);
}

function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/* ------------------------------------------------- cluster + material mapping */

/** Object-name prefix -> the hero cluster that owns it. */
const CLUSTER_RULES = [
  [/^(Hub_|Book_)/, 'hub'],
  [/^(Desk\d|Board_)/, 'desks'],
  [/^(Comm_|Cap_|Trophy_|Fig\d|Globe)/, 'community'],
  [/^(Deck_|Pillar|Bench|Shelf_|Plant)/, 'base'],
];

function clusterOf(name) {
  for (const [pattern, cluster] of CLUSTER_RULES) {
    if (pattern.test(name)) return cluster;
  }
  return 'base';
}

/**
 * Self-illumination per material, with `cluster|material` overrides.
 * The hub core has to read as a light source rather than a lit solid, so it
 * carries far more emission than the same colour does elsewhere on the deck.
 */
const EMISSIVE = {
  screen: 0.95,
  aqua: 0.68,
  sun: 0.28,
  rose: 0.22,
  gold: 0.3,
  brand: 0.32,
  leaf: 0.14,
};

const EMISSIVE_OVERRIDES = {
  'hub|brand': 0.62,
  'hub|aqua': 0.88,
  'hub|rose': 0.55,
  'hub|bone': 0.2,
  'base|aqua': 0.8,
  'community|aqua': 0.72,
  'community|gold': 0.42,
};

function emissiveFor(cluster, material) {
  return EMISSIVE_OVERRIDES[`${cluster}|${material}`] ?? EMISSIVE[material] ?? 0;
}

/* --------------------------------------------------------------- conversion */

const buffer = readFileSync(inputPath);
const { json, bin } = parseGlb(buffer);
if (!bin) throw new Error('GLB has no BIN chunk.');

const groups = new Map();
let totalTriangles = 0;
let skipped = 0;

function walk(nodeIndex, parentMatrix) {
  const node = json.nodes[nodeIndex];
  const world = multiply(parentMatrix, nodeMatrix(node));

  if (node.mesh !== undefined) {
    const cluster = clusterOf(node.name ?? '');
    for (const primitive of json.meshes[node.mesh].primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4) {
        skipped += 1;
        continue;
      }
      const positionIndex = primitive.attributes?.POSITION;
      if (positionIndex === undefined) {
        skipped += 1;
        continue;
      }

      const material = json.materials[primitive.material] ?? { name: 'default' };
      const factor = material.pbrMetallicRoughness?.baseColorFactor ?? [0.8, 0.8, 0.8, 1];
      const color = [
        Math.round(factor[0] * 255),
        Math.round(factor[1] * 255),
        Math.round(factor[2] * 255),
      ];
      const key = `${cluster}|${material.name}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          cluster,
          material: material.name,
          color,
          emissive: emissiveFor(cluster, material.name),
          alpha: factor[3] ?? 1,
          positions: [],
          indices: [],
          lookup: new Map(),
        };
        groups.set(key, group);
      }

      const positions = readAccessor(json, bin, positionIndex);
      const indices = primitive.indices !== undefined
        ? readAccessor(json, bin, primitive.indices).data
        : Float64Array.from({ length: positions.count }, (_, i) => i);

      // Weld vertices per group at 1cm precision — the scene is ~34 units wide,
      // so this is far below a visible threshold and roughly halves the payload.
      const push = (vertexIndex) => {
        const [wx, wy, wz] = transformPoint(
          world,
          positions.data[vertexIndex * 3],
          positions.data[vertexIndex * 3 + 1],
          positions.data[vertexIndex * 3 + 2],
        );
        const rx = Math.round(wx * 100) / 100;
        const ry = Math.round(wy * 100) / 100;
        const rz = Math.round(wz * 100) / 100;
        const hash = `${rx},${ry},${rz}`;
        let slot = group.lookup.get(hash);
        if (slot === undefined) {
          slot = group.positions.length / 3;
          group.positions.push(rx, ry, rz);
          group.lookup.set(hash, slot);
        }
        group.indices.push(slot);
      };

      for (let i = 0; i < indices.length; i += 3) {
        push(indices[i]);
        push(indices[i + 1]);
        push(indices[i + 2]);
        totalTriangles += 1;
      }
    }
  }

  for (const child of node.children ?? []) walk(child, world);
}

const identity = Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const sceneDef = json.scenes[json.scene ?? 0];
for (const root of sceneDef.nodes) walk(root, identity);

const payload = {
  source: 'Blender via Higgsfield 3D scene builder',
  generated: new Date().toISOString(),
  triangles: totalTriangles,
  groups: [...groups.values()]
    // Draw order within a depth bucket is stable; sorting by cluster keeps the
    // JSON diff readable between regenerations.
    .sort((a, b) => a.cluster.localeCompare(b.cluster) || a.material.localeCompare(b.material))
    .map(({ lookup, ...rest }) => rest),
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(payload));

const bytes = readFileSync(outputPath).length;
console.log(`triangles: ${totalTriangles}`);
console.log(`groups:    ${payload.groups.length}`);
console.log(`skipped:   ${skipped} primitive(s)`);
console.log(`vertices:  ${payload.groups.reduce((n, g) => n + g.positions.length / 3, 0)}`);
console.log(`output:    ${outputPath} (${(bytes / 1024).toFixed(1)} KB)`);
for (const group of payload.groups) {
  console.log(
    `  ${group.cluster.padEnd(10)} ${group.material.padEnd(11)} ` +
      `${String(group.indices.length / 3).padStart(5)} tris  rgb(${group.color.join(',')})`,
  );
}
