// Neon Tide Cover Studio — editor wiring.
//
// Loads the person's own photos (file picker, or the two bundled samples),
// keeps three poster panels of framing state (zoom + focal point each),
// renders the live preview through poster.js's single render function, and
// exports a full-size PNG. Photos are read as local object URLs and drawn
// on this machine only; nothing is uploaded anywhere.
//
// Screenshot mode: opened with ?shot=cover or ?shot=editor (plus optional
// photo=pier|boulevard and caption=...), the page sets itself up with a
// sample photo and the given caption, then raises window.__shotReady once
// the poster on screen is final, so a screenshot tool knows when to fire.

import { panelLayout, renderPoster } from './poster.js';

const SAMPLES = {
  pier: 'samples/pier.jpg',
  boulevard: 'samples/boulevard.jpg',
};

const PANEL_NAMES = ['Hero panel', 'Detail panel A', 'Detail panel B'];

const state = {
  caption: 'Neon Tide Run',
  size: [1080, 1080],
  selected: 0,
  allPanels: false,
  panels: [
    { img: null, zoom: 1.15, fx: 0.5, fy: 0.45, seed: 11 },
    { img: null, zoom: 1.3, fx: 0.5, fy: 0.5, seed: 23 },
    { img: null, zoom: 1.3, fx: 0.5, fy: 0.5, seed: 35 },
  ],
};

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const previewCtx = preview.getContext('2d');

// ---------------------------------------------------------------------------
// Rendering

// The preview canvas keeps the export size's aspect; the poster core draws
// at whatever resolution the canvas holds, so preview and export match.
function renderPreview() {
  const [w, h] = state.size;
  const scale = Math.min(1, 620 / w);
  preview.width = Math.round(w * scale);
  preview.height = Math.round(h * scale);
  renderPoster(previewCtx, preview.width, preview.height, state);
}

function exportPng() {
  const [w, h] = state.size;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  renderPoster(canvas.getContext('2d'), w, h, state);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-tide-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

// ---------------------------------------------------------------------------
// Photos

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Puts a photo into the selected panel — or into every panel when the
// one-photo mode is on — then repaints.
function placePhoto(img) {
  if (state.allPanels) {
    for (const panel of state.panels) panel.img = img;
  } else {
    state.panels[state.selected].img = img;
  }
  refreshPanelChips();
  renderPreview();
}

// Several picked files fill the panels in turn, starting at the selected
// one; a single file respects the one-photo mode.
async function onFilesPicked(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  if (list.length === 1 || state.allPanels) {
    placePhoto(await loadImage(URL.createObjectURL(list[0])));
    return;
  }
  for (let i = 0; i < list.length && i < state.panels.length; i++) {
    const img = await loadImage(URL.createObjectURL(list[i]));
    state.panels[(state.selected + i) % state.panels.length].img = img;
  }
  refreshPanelChips();
  renderPreview();
}

async function onSamplePicked(name) {
  placePhoto(await loadImage(SAMPLES[name]));
}

// ---------------------------------------------------------------------------
// Panel selection and framing controls

function buildPanelChips() {
  const list = $('panel-list');
  list.innerHTML = '';
  PANEL_NAMES.forEach((name, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'panel-chip';
    chip.id = `panel-chip-${i}`;
    chip.setAttribute('role', 'option');
    chip.addEventListener('click', () => selectPanel(i));
    list.appendChild(chip);
  });
  refreshPanelChips();
}

function refreshPanelChips() {
  PANEL_NAMES.forEach((name, i) => {
    const chip = $(`panel-chip-${i}`);
    if (!chip) return;
    chip.textContent = state.panels[i].img ? `${name} · photo` : `${name} · scene`;
    chip.setAttribute('aria-selected', String(i === state.selected));
  });
}

function selectPanel(i) {
  state.selected = i;
  const panel = state.panels[i];
  $('zoom').value = panel.zoom;
  $('focal-x').value = panel.fx;
  $('focal-y').value = panel.fy;
  refreshPanelChips();
}

// Clicking the poster selects the panel under the click (the foot strip
// keeps the current selection).
function onPreviewClick(event) {
  const rect = preview.getBoundingClientRect();
  const px = (event.clientX - rect.left) * (preview.width / rect.width);
  const py = (event.clientY - rect.top) * (preview.height / rect.height);
  const { panels } = panelLayout(preview.width, preview.height);
  const hit = panels.findIndex(
    (p) => px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h,
  );
  if (hit >= 0) selectPanel(hit);
}

function bindControls() {
  $('photo-file').addEventListener('change', (e) => {
    onFilesPicked(e.target.files);
    e.target.value = '';
  });
  $('sample-pier').addEventListener('click', () => onSamplePicked('pier'));
  $('sample-boulevard').addEventListener('click', () => onSamplePicked('boulevard'));
  $('all-panels').addEventListener('change', (e) => { state.allPanels = e.target.checked; });
  $('zoom').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    renderPreview();
  });
  $('focal-x').addEventListener('input', (e) => {
    state.panels[state.selected].fx = Number(e.target.value);
    renderPreview();
  });
  $('focal-y').addEventListener('input', (e) => {
    state.panels[state.selected].fy = Number(e.target.value);
    renderPreview();
  });
  $('clear-panel').addEventListener('click', () => {
    state.panels[state.selected].img = null;
    refreshPanelChips();
    renderPreview();
  });
  $('caption').addEventListener('input', (e) => {
    state.caption = e.target.value;
    renderPreview();
  });
  $('size').addEventListener('change', (e) => {
    state.size = e.target.value.split('x').map(Number);
    renderPreview();
  });
  $('export').addEventListener('click', exportPng);
  preview.addEventListener('click', onPreviewClick);
}

// ---------------------------------------------------------------------------
// Screenshot mode

// Sets the studio up from the query string for a screenshot: a sample
// photo in the panels and the requested caption. In cover mode the chrome
// hides (see style.css) and the poster takes the window's aspect, so the
// shot is the exported cover itself; in editor mode the whole studio
// shows with the photo loaded.
async function applyShotMode(query) {
  const mode = query.get('shot');
  document.body.classList.add(mode === 'cover' ? 'shot-cover' : 'shot-editor');
  const caption = query.get('caption');
  if (caption) {
    state.caption = caption;
    $('caption').value = caption;
  }
  if (mode === 'cover') {
    const wide = Math.max(320, window.innerWidth);
    const high = Math.max(320, window.innerHeight);
    const scale = 1280 / Math.max(wide, high);
    state.size = [Math.round(wide * scale), Math.round(high * scale)];
  }
  const photo = SAMPLES[query.get('photo')] ? query.get('photo') : 'pier';
  const img = await loadImage(SAMPLES[photo]);
  if (mode === 'cover') {
    for (const panel of state.panels) panel.img = img;
  } else {
    state.panels[0].img = img;
    state.panels[1].img = img;
  }
  refreshPanelChips();
  renderPreview();
  window.__shotReady = true;
}

// ---------------------------------------------------------------------------

buildPanelChips();
bindControls();
selectPanel(0);
renderPreview();

const query = new URLSearchParams(window.location.search);
if (query.has('shot')) {
  applyShotMode(query).catch(() => { window.__shotReady = true; });
}
