import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './galeria.css';

// Modelos de la galería. `configurator` agrega el botón al configurador.
const MODELS = [
  {
    id: 'pegasus',
    name: 'Pegasus 36',
    kind: 'Zapatilla de running',
    description: 'Modelo con texturas PBR de tejido, goma y espuma. Es la base del configurador 3D.',
    url: '/assets/nike_air_zoom_pegasus_36/scene.gltf',
    configurator: '/configurador.html',
    credit: { title: 'Nike Air Zoom Pegasus 36', author: 'quaz30', href: 'https://sketchfab.com/3d-models/nike-air-zoom-pegasus-36-00fd99e778c244c3bd3b65f99dad7cb2' },
  },
  {
    id: 'fake-jordan',
    name: 'Fake Jordan',
    kind: 'Zapatilla de básquet',
    description: 'Modelo de una sola pieza con textura horneada y mapas PBR.',
    url: '/assets/nike_air_jordan/scene.gltf',
    credit: { title: 'Nike Air Jordan', author: 'hzami', href: 'https://sketchfab.com/3d-models/nike-air-jordan-45cfc1f5e4e74c6da8317a93cd5815a9' },
  },
  {
    id: 'ricks-jordan',
    name: "Rick's Jordan",
    kind: 'Zapatilla de básquet',
    description: 'Captura 3D propia de una Jordan 1, en un solo archivo GLB.',
    url: '/assets/Ricks_Jordan.glb',
  },
  {
    id: 'hoodie',
    name: 'Hoodie',
    kind: 'Ropa deportiva',
    description: 'Buzo con capucha low poly, con mapas normales y cierre como pieza aparte.',
    url: '/assets/nike_hoodie/scene.gltf',
    credit: { title: 'Nike Hoodie', author: 'aabowschool', href: 'https://sketchfab.com/3d-models/nike-hoodie-959af9d4f1434ae3b024424e94b0eef2' },
  },
];

const $ = (id) => document.getElementById(id);
const canvas = $('scene');

// Escena: luz de estudio con reflejos (RoomEnvironment) y sombra de contacto.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(3, 5, 2);
scene.add(key);

const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.9;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;
controls.enablePan = false;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI / 2 + 0.05;

// Sombra suave bajo el modelo: un plano con degradado radial.
const shadowTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
})();
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
);
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);

// Todos los modelos se escalan a un tamaño común y se apoyan en el piso.
const SIZE = 2;
const loader = new GLTFLoader();
const cache = new Map();
let current = null;
let currentIndex = -1;
let loadToken = 0;

function normalize(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = SIZE / Math.max(size.x, size.y, size.z);
  root.scale.multiplyScalar(scale);
  const fitted = new THREE.Box3().setFromObject(root);
  const center = fitted.getCenter(new THREE.Vector3());
  root.position.sub(new THREE.Vector3(center.x, fitted.min.y, center.z));
  const wrapper = new THREE.Group();
  wrapper.add(root);
  const final = new THREE.Box3().setFromObject(wrapper);
  wrapper.userData.size = final.getSize(new THREE.Vector3());
  return wrapper;
}

function frame(model, { instant = false } = {}) {
  const size = model.userData.size;
  shadow.scale.set(size.x * 1.25, size.z * 1.25, 1);
  shadow.position.y = 0.002;
  const target = new THREE.Vector3(0, size.y * 0.45, 0);
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const radius = size.length() / 2;
  const distance = (radius * 0.92) / Math.sin(Math.min(vfov, hfov) / 2);
  const direction = new THREE.Vector3(1, 0.42, 1.25).normalize();
  controls.minDistance = distance * 0.45;
  controls.maxDistance = distance * 1.8;
  const to = target.clone().add(direction.multiplyScalar(distance));
  if (instant) {
    camera.position.copy(to);
    controls.target.copy(target);
    controls.update();
    return;
  }
  tween = { fromPos: camera.position.clone(), toPos: to, fromTarget: controls.target.clone(), toTarget: target, start: performance.now() };
}

let tween = null;
function updateTween(now) {
  if (!tween) return;
  const t = Math.min(1, (now - tween.start) / 700);
  const e = 1 - (1 - t) ** 3;
  camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
  controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
  if (t === 1) tween = null;
}

function setLoader(visible, progress = 0, text = '') {
  $('loader').hidden = !visible;
  $('loader-fill').style.transform = `scaleX(${progress})`;
  if (text) $('loader-text').textContent = text;
}

function loadModel(model) {
  if (cache.has(model.id)) return Promise.resolve(cache.get(model.id));
  return new Promise((resolve, reject) => {
    loader.load(
      model.url,
      (gltf) => {
        const wrapped = normalize(gltf.scene);
        cache.set(model.id, wrapped);
        resolve(wrapped);
      },
      (xhr) => {
        if (xhr.total) {
          const p = xhr.loaded / xhr.total;
          setLoader(true, p, `Cargando ${model.name} · ${Math.round(p * 100)}%`);
        }
      },
      reject,
    );
  });
}

function renderInfo(model, index) {
  $('model-kind').textContent = model.kind;
  $('model-name').textContent = model.name;
  $('model-description').textContent = model.description;
  $('counter').textContent = `${String(index + 1).padStart(2, '0')} / ${String(MODELS.length).padStart(2, '0')}`;

  const actions = $('model-actions');
  actions.replaceChildren();
  if (model.configurator) {
    const link = document.createElement('a');
    link.className = 'btn';
    link.href = model.configurator;
    link.innerHTML = 'Personalizar en el configurador <span aria-hidden="true">→</span>';
    actions.append(link);
  }

  const credits = $('credits');
  credits.replaceChildren();
  if (model.credit) {
    credits.append('Modelo ');
    const a = document.createElement('a');
    a.href = model.credit.href;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.textContent = `“${model.credit.title}”`;
    credits.append(a, ` de ${model.credit.author} · CC BY 4.0`);
  }

  for (const [i, tab] of [...$('tabs').children].entries()) {
    tab.classList.toggle('active', i === index);
    tab.setAttribute('aria-selected', i === index);
  }
}

async function show(index) {
  index = (index + MODELS.length) % MODELS.length;
  if (index === currentIndex) return;
  currentIndex = index;
  const model = MODELS[index];
  const token = ++loadToken;
  renderInfo(model, index);
  history.replaceState(null, '', `#${model.id}`);
  document.body.classList.add('switching');
  if (!cache.has(model.id)) setLoader(true, 0, `Cargando ${model.name}…`);
  try {
    const object = await loadModel(model);
    if (token !== loadToken) return;
    if (current) scene.remove(current);
    current = object;
    scene.add(current);
    frame(current, { instant: !document.body.dataset.ready });
    document.body.dataset.ready = 'true';
  } catch (error) {
    console.error(error);
    if (token === loadToken) setLoader(true, 0, `No se pudo cargar ${model.name}.`);
    return;
  }
  setLoader(false);
  document.body.classList.remove('switching');
}

// Pestañas, flechas y teclado.
for (const [i, model] of MODELS.entries()) {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'tab';
  tab.setAttribute('role', 'tab');
  tab.textContent = model.name;
  tab.addEventListener('click', () => show(i));
  $('tabs').append(tab);
}
$('prev').addEventListener('click', () => show(currentIndex - 1));
$('next').addEventListener('click', () => show(currentIndex + 1));
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowLeft') show(currentIndex - 1);
  if (e.key === 'ArrowRight') show(currentIndex + 1);
});

$('autorotate').addEventListener('click', (e) => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', on);
  controls.autoRotate = on;
});
$('reset').addEventListener('click', () => current && frame(current));

// El giro automático se pausa mientras el usuario mueve el modelo.
let resumeTimer = 0;
controls.addEventListener('start', () => {
  tween = null;
  controls.autoRotate = false;
  clearTimeout(resumeTimer);
});
controls.addEventListener('end', () => {
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    controls.autoRotate = $('autorotate').getAttribute('aria-pressed') === 'true';
  }, 4000);
});

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

renderer.setAnimationLoop((now) => {
  updateTween(now);
  controls.update();
  renderer.render(scene, camera);
});

const fromHash = MODELS.findIndex((m) => m.id === location.hash.slice(1));
show(fromHash >= 0 ? fromHash : 0);
