import { CrucibleRenderer, createEnvironmentMap } from '@codepawlhq/crucible';
import { loadGltf } from '@codepawlhq/crucible/addons/gltf';
import { createMeshQueryIndex } from '@codepawlhq/crucible/addons/mesh-query';
import { ZONES } from './config.js';

const MODEL_DIR = '/assets/nike_air_zoom_pegasus_36';
const BACKGROUND = [0.035, 0.035, 0.04];

// Hex sRGB (#rrggbb) a RGB lineal, que es lo que espera Crucible.
export function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
}

// Mapa de entorno de estudio hecho a mano: fondo oscuro con degradado y
// tres softboxes. Da los reflejos suaves de una foto de producto.
function studioEnvironment() {
  const width = 256;
  const height = 128;
  const data = new Float32Array(width * height * 3);
  const boxes = [
    // [centro u, centro v, ancho, alto, intensidad]
    [0.62, 0.3, 0.16, 0.2, 9],
    [0.12, 0.38, 0.1, 0.24, 3.5],
    [0.38, 0.12, 0.3, 0.08, 4],
  ];
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const base = 0.32 * (1 - v) ** 1.6 + 0.03;
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      let light = base;
      for (const [cu, cv, w, h, k] of boxes) {
        const dx = Math.max(0, Math.abs(u - cu) - w / 2) / 0.02;
        const dy = Math.max(0, Math.abs(v - cv) - h / 2) / 0.02;
        light += k * Math.exp(-(dx * dx + dy * dy));
      }
      const i = (y * width + x) * 3;
      data[i] = light;
      data[i + 1] = light;
      data[i + 2] = light * 1.03;
    }
  }
  return createEnvironmentMap({ width, height, data, intensity: 0.9 });
}

function bounds(geometry, m) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const p = geometry.positions;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i];
    const y = p[i + 1];
    const z = p[i + 2];
    const w = [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], w[k]);
      max[k] = Math.max(max[k], w[k]);
    }
  }
  return { min, max };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

export async function createViewer(canvas, { onProgress } = {}) {
  onProgress?.(0.1, 'Cargando modelo…');
  const [asset, zoneBytes] = await Promise.all([
    loadGltf(`${MODEL_DIR}/configurador.gltf`),
    fetch(`${MODEL_DIR}/zones.bin`).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar zones.bin (${r.status})`);
      return r.arrayBuffer();
    }),
  ]);
  onProgress?.(0.7, 'Preparando piezas…');

  const source = asset.parts[0];
  const zoneOfTriangle = new Uint8Array(zoneBytes);
  const indices = source.geometry.indices;

  // Una pieza por zona: comparten vértices y texturas, cambian los índices
  // y el material, así cada zona tiene su propio color y acabado.
  const parts = ZONES.map((zone, zi) => {
    let count = 0;
    for (let t = 0; t < zoneOfTriangle.length; t++) if (zoneOfTriangle[t] === zi) count++;
    const zoneIndices = new Uint32Array(count * 3);
    let j = 0;
    for (let t = 0; t < zoneOfTriangle.length; t++) {
      if (zoneOfTriangle[t] !== zi) continue;
      zoneIndices[j++] = indices[t * 3];
      zoneIndices[j++] = indices[t * 3 + 1];
      zoneIndices[j++] = indices[t * 3 + 2];
    }
    return {
      name: zone.id,
      geometry: { ...source.geometry, indices: zoneIndices },
      matrix: source.matrix,
      material: { ...source.material, emissiveColor: [1, 1, 1], emission: 0 },
    };
  });
  const partById = Object.fromEntries(parts.map((p) => [p.name, p]));

  const box = bounds(source.geometry, source.matrix);
  const center = box.min.map((v, i) => (v + box.max[i]) / 2);
  const radius = Math.hypot(...sub(box.max, box.min)) / 2;

  let environment = {
    keyIntensity: 0.55,
    fillIntensity: 0.25,
    ambientIntensity: 1,
    lightDirection: [-0.4, 0.9, 0.35],
  };
  const options = {
    ground: false,
    samples: 4,
    background: BACKGROUND,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  };
  let renderer;
  try {
    environment = { ...environment, map: studioEnvironment() };
    renderer = new CrucibleRenderer(canvas, parts, { ...options, environment });
  } catch (error) {
    // Sin EXT_color_buffer_float no hay mapa de entorno: se usa el estudio de serie.
    console.warn('Mapa de entorno no disponible, uso la luz de estudio por defecto.', error);
    delete environment.map;
    renderer = new CrucibleRenderer(canvas, parts, { ...options, environment });
  }

  // Índice para saber qué pieza hay bajo el puntero.
  const pickIndex = createMeshQueryIndex({ positions: source.geometry.positions, indices });

  // Cámara orbital con inercia.
  const fov = 30;
  // Distancia a la que la zapatilla entra entera, en horizontal o en vertical
  // según la forma del lienzo (en el celular es más alto que ancho).
  function fitDistance() {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight) || 1;
    const v = (fov * Math.PI) / 180;
    const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
    return (radius * 0.86) / Math.sin(Math.min(v, h) / 2);
  }
  let fit = fitDistance();
  const orbit = { yaw: 0.9, pitch: 0.28, distance: fit, vYaw: 0, vPitch: 0, targetDistance: fit };
  const limits = { minPitch: -0.35, maxPitch: 1.25, minDist: fit * 0.5, maxDist: fit * 1.6 };
  let autoRotate = true;
  let idleTimer = 0;
  let dirty = true;
  let disposed = false;
  let highlight = null;

  function frame() {
    const cp = Math.cos(orbit.pitch);
    const eye = [
      center[0] + orbit.distance * cp * Math.sin(orbit.yaw),
      center[1] + orbit.distance * Math.sin(orbit.pitch),
      center[2] + orbit.distance * cp * Math.cos(orbit.yaw),
    ];
    return { eye, target: center, fov };
  }

  function rayAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((clientY - rect.top) / rect.height) * 2;
    const { eye, target } = frame();
    const f = norm(sub(target, eye));
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    const t = Math.tan((fov * Math.PI) / 360);
    const a = rect.width / rect.height;
    const dir = [0, 1, 2].map((k) => f[k] + r[k] * x * t * a + u[k] * y * t);
    return { origin: eye, direction: norm(dir) };
  }

  function pick(clientX, clientY) {
    const hit = pickIndex.raycast(source.matrix, rayAt(clientX, clientY));
    return hit ? ZONES[zoneOfTriangle[hit.triangle]].id : null;
  }

  function wake() {
    autoRotate = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => (autoRotate = true), 6000);
  }

  // Arrastre con un dedo o el mouse, pellizco con dos dedos. Los eventos solo
  // acumulan el movimiento; el giro se aplica en el bucle de dibujo, una vez
  // por cuadro, y al soltar queda la inercia del último gesto.
  const ROTATE_SPEED = 0.008;
  const pointers = new Map();
  const drag = { dx: 0, dy: 0 };
  let pinchStart = 0;
  let moved = 0;
  let hoverAt = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    orbit.vYaw = 0;
    orbit.vPitch = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
    }
    canvas.style.cursor = 'grabbing';
    wake();
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === 'mouse') hoverAt = { x: e.clientX, y: e.clientY };
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 1) {
      drag.dx += dx;
      drag.dy += dy;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart && d > 0) orbit.targetDistance *= pinchStart / d;
      pinchStart = d;
    }
    wake();
  });
  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const wasTap = pointers.size === 1 && moved < 6;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    canvas.style.cursor = 'grab';
    if (wasTap && e.type === 'pointerup') {
      const zone = pick(e.clientX, e.clientY);
      if (zone) api.onPick?.(zone);
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    hoverAt = null;
    api.onHover?.(null);
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      orbit.targetDistance *= Math.exp(Math.max(-100, Math.min(100, e.deltaY)) * 0.0015);
      wake();
    },
    { passive: false },
  );

  new ResizeObserver(() => {
    const next = fitDistance();
    orbit.targetDistance *= next / fit;
    orbit.distance *= next / fit;
    limits.minDist = next * 0.5;
    limits.maxDist = next * 1.6;
    fit = next;
    renderer.resize();
    dirty = true;
  }).observe(canvas);

  // Brillo breve sobre una pieza (al elegirla) y brillo suave al pasar el mouse.
  let flash = null;
  function setEmission(part, value) {
    if (part.material.emission === value) return false;
    part.material.emission = value;
    return true;
  }
  function updateGlow(now) {
    const changed = [];
    for (const part of parts) {
      let value = part.name === highlight ? 0.05 : 0;
      if (flash && flash.zone === part.name) {
        const t = (now - flash.start) / 650;
        if (t < 1) value = Math.max(value, 0.22 * (1 - t) ** 2);
      }
      if (setEmission(part, value)) changed.push(part);
    }
    if (flash && now - flash.start > 650) flash = null;
    if (changed.length) {
      renderer.updateParts(changed);
      dirty = true;
    }
  }

  let autoSpeed = 0;
  let last = performance.now();
  function tick(now) {
    if (disposed) return;
    // Pasos normalizados a 60 cuadros por segundo, para que el giro y la
    // inercia se sientan igual en pantallas de 60 y de 120 Hz.
    const step = Math.min(3, (now - last) / (1000 / 60));
    last = now;
    let changed = false;

    if (pointers.size === 1) {
      const yaw = -drag.dx * ROTATE_SPEED;
      const pitch = drag.dy * ROTATE_SPEED * 0.8;
      orbit.yaw += yaw;
      orbit.pitch += pitch;
      // Velocidad suavizada del arrastre, para la inercia al soltar.
      orbit.vYaw = orbit.vYaw * 0.5 + (yaw / step) * 0.5;
      orbit.vPitch = orbit.vPitch * 0.5 + (pitch / step) * 0.5;
      changed = yaw !== 0 || pitch !== 0;
    } else if (!pointers.size) {
      const decay = Math.pow(0.92, step);
      orbit.vYaw *= decay;
      orbit.vPitch *= decay;
      if (Math.abs(orbit.vYaw) < 1e-5) orbit.vYaw = 0;
      if (Math.abs(orbit.vPitch) < 1e-5) orbit.vPitch = 0;
      orbit.yaw += orbit.vYaw * step;
      orbit.pitch += orbit.vPitch * step;
      changed = orbit.vYaw !== 0 || orbit.vPitch !== 0;
    }
    drag.dx = 0;
    drag.dy = 0;

    // Giro automático en reposo, que arranca y frena suave.
    autoSpeed += ((autoRotate && !pointers.size ? 0.0025 : 0) - autoSpeed) * Math.min(1, 0.04 * step);
    if (Math.abs(autoSpeed) > 1e-6) {
      orbit.yaw += autoSpeed * step;
      changed = true;
    }

    const pitch = Math.min(limits.maxPitch, Math.max(limits.minPitch, orbit.pitch));
    if (pitch !== orbit.pitch) {
      orbit.pitch = pitch;
      orbit.vPitch = 0;
    }
    orbit.targetDistance = Math.min(limits.maxDist, Math.max(limits.minDist, orbit.targetDistance));
    const dd = (orbit.targetDistance - orbit.distance) * Math.min(1, 0.2 * step);
    if (Math.abs(dd) > 1e-5) {
      orbit.distance += dd;
      changed = true;
    }

    // Una sola consulta de pieza bajo el mouse por cuadro.
    if (hoverAt && !pointers.size) {
      const zone = pick(hoverAt.x, hoverAt.y);
      canvas.style.cursor = zone ? 'pointer' : 'grab';
      api.onHover?.(zone);
      hoverAt = null;
    }

    updateGlow(now);
    if (changed || dirty) {
      renderer.render(frame());
      dirty = false;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  onProgress?.(1, 'Listo');

  const api = {
    onPick: null,
    onHover: null,
    zones: ZONES.map((z) => z.id),
    setZone(zoneId, { color, finish }) {
      const part = partById[zoneId];
      if (color) part.material.color = hexToLinear(color);
      if (finish) {
        part.material.roughness = finish.roughness;
        part.material.metallic = finish.metallic;
      }
      renderer.updateParts([part]);
      dirty = true;
    },
    flash(zoneId) {
      flash = { zone: zoneId, start: performance.now() };
    },
    setHighlight(zoneId) {
      highlight = zoneId;
    },
    // Foto con el path tracer de Crucible (Cook), desde el ángulo actual.
    async photo({ width = 1600, height = 1000, samples = 64 } = {}) {
      const { renderPathTracedImage } = await import('@codepawlhq/crucible/addons/path-tracer');
      const camera = frame();
      const scene = { parts, environment, camera };
      const settings = { width, height, samples, bounces: 6, denoise: true, maxSeconds: 45 };
      let result;
      const started = performance.now();
      try {
        result = await renderPathTracedImage(scene, { ...settings, backend: 'gpu' });
      } catch (error) {
        console.warn('Path tracer en GPU no disponible, uso la CPU.', error);
        result = await renderPathTracedImage(scene, {
          ...settings,
          samples: Math.min(samples, 32),
          backend: 'cpu',
          threads: Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1)),
        });
      }
      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const ctx = out.getContext('2d');
      const image = ctx.createImageData(width, height);
      image.data.set(result.rgba);
      ctx.putImageData(image, 0, 0);
      return { url: out.toDataURL('image/png'), seconds: (performance.now() - started) / 1000, report: result.report };
    },
    dispose() {
      disposed = true;
      pickIndex.dispose();
      renderer.dispose();
      asset.dispose?.();
    },
  };
  return api;
}
