import './configurador.css';
import { FINISHES, PRESETS, SWATCHES, ZONES } from './config.js';
import { createViewer } from './viewer.js';

const $ = (id) => document.getElementById(id);
const finishById = Object.fromEntries(FINISHES.map((f) => [f.id, f]));

// Estado: color y acabado de cada zona, y la zona que se está editando.
const state = {
  zone: ZONES[0].id,
  zones: structuredClone(PRESETS[0].zones),
};

// La combinación queda en la URL (#cuerpo=d6f23a.mate&...) para compartirla.
function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  for (const { id } of ZONES) {
    const value = params.get(id);
    if (!value) continue;
    const [hex, finish] = value.split('.');
    if (/^[0-9a-f]{6}$/i.test(hex)) state.zones[id].color = `#${hex.toLowerCase()}`;
    if (finishById[finish]) state.zones[id].finish = finish;
  }
}
function writeHash() {
  const params = new URLSearchParams();
  for (const { id } of ZONES) params.set(id, `${state.zones[id].color.slice(1)}.${state.zones[id].finish}`);
  history.replaceState(null, '', `#${params}`);
}

function button(className, label, onClick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

let viewer;

function apply(zoneId) {
  viewer?.setZone(zoneId, {
    color: state.zones[zoneId].color,
    finish: finishById[state.zones[zoneId].finish],
  });
}

function render() {
  const current = state.zones[state.zone];
  for (const el of $('zones').children) {
    const active = el.dataset.zone === state.zone;
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', active);
    el.querySelector('i').style.background = state.zones[el.dataset.zone].color;
  }
  for (const el of $('swatches').children) {
    el.classList.toggle('active', el.dataset.hex === current.color);
  }
  for (const el of $('finishes').children) {
    const active = el.dataset.finish === current.finish;
    el.classList.toggle('active', active);
    el.setAttribute('aria-checked', active);
  }
  $('custom-color').value = current.color;
  for (const el of $('presets').children) {
    const preset = PRESETS[el.dataset.index];
    const same = ZONES.every(
      ({ id }) => preset.zones[id].color === state.zones[id].color && preset.zones[id].finish === state.zones[id].finish,
    );
    el.classList.toggle('active', same);
  }
}

function selectZone(zoneId, { flash = true } = {}) {
  state.zone = zoneId;
  if (flash) viewer?.flash(zoneId);
  render();
}

function setColor(hex) {
  state.zones[state.zone].color = hex;
  apply(state.zone);
  writeHash();
  render();
}

function setFinish(finishId) {
  state.zones[state.zone].finish = finishId;
  apply(state.zone);
  writeHash();
  render();
}

function applyAll(zones) {
  state.zones = structuredClone(zones);
  for (const { id } of ZONES) apply(id);
  writeHash();
  render();
}

function buildUI() {
  for (const [index, preset] of PRESETS.entries()) {
    const el = button('preset', '', () => applyAll(preset.zones));
    el.dataset.index = index;
    const dots = document.createElement('span');
    dots.className = 'preset-dots';
    for (const id of ['cuerpo', 'mediasuela', 'suela']) {
      const dot = document.createElement('i');
      dot.style.background = preset.zones[id].color;
      dots.append(dot);
    }
    el.append(dots, preset.name);
    $('presets').append(el);
  }

  for (const zone of ZONES) {
    const el = button('zone', '', () => selectZone(zone.id));
    el.dataset.zone = zone.id;
    el.setAttribute('role', 'tab');
    el.append(document.createElement('i'), zone.label);
    el.addEventListener('mouseenter', () => viewer?.setHighlight(zone.id));
    el.addEventListener('mouseleave', () => viewer?.setHighlight(null));
    $('zones').append(el);
  }

  for (const swatch of SWATCHES) {
    const el = button('swatch', '', () => setColor(swatch.hex));
    el.dataset.hex = swatch.hex;
    el.style.background = swatch.hex;
    el.title = swatch.name;
    el.setAttribute('aria-label', swatch.name);
    $('swatches').append(el);
  }
  $('custom-color').addEventListener('input', (e) => setColor(e.target.value));

  for (const finish of FINISHES) {
    const el = button('finish', finish.label, () => setFinish(finish.id));
    el.dataset.finish = finish.id;
    el.setAttribute('role', 'radio');
    $('finishes').append(el);
  }

  $('random').addEventListener('click', () => {
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const zones = {};
    for (const { id } of ZONES) {
      const finish = Math.random() < 0.15 ? 'metalico' : pick(['mate', 'satinado', 'brillante']);
      zones[id] = { color: pick(SWATCHES).hex, finish: id === 'cuerpo' || id === 'forro' ? 'mate' : finish };
    }
    applyAll(zones);
  });

  $('shoot').addEventListener('click', takePhoto);
  $('photo-close').addEventListener('click', () => ($('photo').hidden = true));
  $('photo').addEventListener('click', (e) => {
    if (e.target === $('photo')) $('photo').hidden = true;
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $('photo').hidden = true;
  });
}

async function takePhoto() {
  const btn = $('shoot');
  btn.disabled = true;
  btn.textContent = 'Renderizando…';
  try {
    const { url, seconds } = await viewer.photo();
    $('photo-img').src = url;
    $('photo-download').href = url;
    $('photo-meta').textContent = `Path tracing · ${seconds.toFixed(1)} s`;
    $('photo').hidden = false;
  } catch (error) {
    console.error(error);
    btn.textContent = 'No se pudo renderizar';
    await new Promise((r) => setTimeout(r, 1800));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Foto HD';
  }
}

async function start() {
  readHash();
  buildUI();
  render();
  try {
    viewer = await createViewer($('scene'), {
      onProgress: (value, text) => {
        $('loader-fill').style.transform = `scaleX(${value})`;
        $('loader-text').textContent = text;
      },
    });
  } catch (error) {
    console.error(error);
    $('loader-text').textContent = 'Tu navegador no pudo iniciar WebGL2. Prueba con Chrome, Edge o Safari actualizados.';
    return;
  }
  viewer.onPick = (zone) => selectZone(zone);
  viewer.onHover = (zone) => viewer.setHighlight(zone);
  for (const { id } of ZONES) apply(id);
  $('loader').classList.add('done');
  setTimeout(() => $('hint').classList.add('fade'), 5000);
  document.body.dataset.ready = 'true';
}

start();
