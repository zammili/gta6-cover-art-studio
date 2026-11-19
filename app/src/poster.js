// Neon Tide Cover Studio — poster renderer.
//
// One pure drawing core: renderPoster(ctx, width, height, state) paints a
// multi-panel cover (a big hero panel, two stacked or side-by-side detail
// panels and a caption foot strip, all divided by warm-white frames) onto
// any 2D context. The editor preview and the PNG export call the same
// function, so what you see is exactly what you share.
//
// Everything is drawn by hand on the canvas: the sunset backdrop, the
// slatted sun, the skyline and palm silhouettes and the little fallback
// scenes for panels that hold no photo yet. No artwork, logo or font file
// comes from any game; lettering uses a condensed system font stack.

// ---------------------------------------------------------------------------
// Small helpers

// Deterministic pseudo-random generator so a panel's backdrop and fallback
// scene look the same on every render, preview and export alike.
function seededRandom(seed) {
  let a = seed >>> 0 || 1;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

// ---------------------------------------------------------------------------
// Layout

// The poster's panel geometry for a canvas of width x height. The foot
// strip always runs along the bottom and carries the caption; above it the
// hero panel takes the large share and the two detail panels split the
// rest — side by side under the hero on portrait and square canvases, in a
// column beside it on landscape ones.
export function panelLayout(width, height) {
  const frame = Math.max(8, Math.round(Math.min(width, height) * 0.018));
  const gap = Math.max(5, Math.round(frame * 0.62));
  const footH = Math.round(height * (width >= height ? 0.17 : 0.145));
  const foot = { x: 0, y: height - footH, w: width, h: footH, role: 'foot' };
  const top = frame;
  const bodyH = foot.y - gap - top;
  const innerW = width - frame * 2;
  const panels = [];
  if (width >= height) {
    const heroW = Math.round((innerW - gap) * 0.615);
    const colX = frame + heroW + gap;
    const colW = innerW - heroW - gap;
    const halfH = Math.round((bodyH - gap) / 2);
    panels.push({ x: frame, y: top, w: heroW, h: bodyH, role: 'hero' });
    panels.push({ x: colX, y: top, w: colW, h: halfH, role: 'detail' });
    panels.push({ x: colX, y: top + halfH + gap, w: colW, h: bodyH - halfH - gap, role: 'detail' });
  } else {
    const heroH = Math.round((bodyH - gap) * 0.60);
    const rowY = top + heroH + gap;
    const rowH = bodyH - heroH - gap;
    const halfW = Math.round((innerW - gap) / 2);
    panels.push({ x: frame, y: top, w: innerW, h: heroH, role: 'hero' });
    panels.push({ x: frame, y: rowY, w: halfW, h: rowH, role: 'detail' });
    panels.push({ x: frame + halfW + gap, y: rowY, w: innerW - halfW - gap, h: rowH, role: 'detail' });
  }
  return { panels, foot, frame, gap };
}

// ---------------------------------------------------------------------------
// The hand-drawn sunset backdrop

const SKY_STOPS = [
  [0.0, '#22104a'],
  [0.42, '#6d1e63'],
  [0.68, '#c92a5e'],
  [0.86, '#f2622e'],
  [1.0, '#ffab4a'],
];

function skyGradient(ctx, x, y, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [at, colour] of SKY_STOPS) g.addColorStop(at, colour);
  return g;
}

// A palm silhouette: a leaning trunk drawn as a tapering curve and a crown
// of fronds swept as arcs. `flip` mirrors it; `scale` is its height.
function drawPalm(ctx, baseX, baseY, scale, flip, lean) {
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.scale(flip, 1);
  ctx.strokeStyle = '#170829';
  ctx.fillStyle = '#170829';
  ctx.lineCap = 'round';
  // Trunk: a quadratic curve thick at the foot, thin at the crown.
  const topX = lean * scale, topY = -scale;
  const trunkX = (t) => 2 * (1 - t) * t * topX; // quadratic lean curve
  const trunkY = (t) => t * t * topY; // eased rise toward the crown
  for (let i = 0; i < 5; i++) {
    const t0 = i / 5, t1 = (i + 1) / 5;
    ctx.lineWidth = Math.max(1.4, scale * 0.045 * (1 - t0 * 0.7));
    ctx.beginPath();
    ctx.moveTo(trunkX(t0), trunkY(t0));
    ctx.lineTo(trunkX(t1), trunkY(t1));
    ctx.stroke();
  }
  // Fronds: seven arcs drooping from the crown.
  const crownX = topX, crownY = topY;
  ctx.lineWidth = Math.max(1.2, scale * 0.02);
  for (let i = 0; i < 7; i++) {
    const ang = Math.PI * (0.08 + (i / 6) * 0.84);
    const len = scale * (0.34 + (i % 3) * 0.05);
    const ex = crownX + Math.cos(ang) * len * (i < 3 ? -1 : 1) * (i === 3 ? 0.2 : 1);
    const ey = crownY - Math.sin(ang) * len * 0.42 + len * 0.30;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(
      crownX + (ex - crownX) * 0.5, crownY - len * 0.22,
      ex, ey,
    );
    ctx.stroke();
  }
  // A pair of coconuts at the crown.
  ctx.beginPath();
  ctx.arc(crownX - scale * 0.03, crownY + scale * 0.03, scale * 0.035, 0, Math.PI * 2);
  ctx.arc(crownX + scale * 0.045, crownY + scale * 0.045, scale * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A low city skyline silhouette with a scatter of lit windows.
function drawSkyline(ctx, x, y, w, horizonY, rng) {
  ctx.fillStyle = '#1a0733';
  let bx = x - 4;
  while (bx < x + w + 4) {
    const bw = w * (0.05 + rng() * 0.09);
    const bh = (horizonY - y) * (0.10 + rng() * 0.30);
    ctx.fillRect(bx, horizonY - bh, bw, bh);
    if (rng() > 0.55) ctx.fillRect(bx + bw * 0.3, horizonY - bh - 4, bw * 0.4, 4); // rooftop block
    ctx.fillStyle = 'rgba(255, 205, 110, 0.85)';
    const rows = Math.floor(bh / 11);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < Math.floor(bw / 9); c++) {
        if (rng() > 0.62) ctx.fillRect(bx + 3 + c * 9, horizonY - bh + 4 + r * 11, 3.4, 4.6);
      }
    }
    ctx.fillStyle = '#1a0733';
    bx += bw + w * 0.012;
  }
}

// The full backdrop: graded sky, slatted sun sinking to the horizon,
// skyline along the waterline and palms framing the sides.
export function drawSunsetBackdrop(ctx, rect, seed) {
  const { x, y, w, h } = rect;
  const rng = seededRandom(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const sky = skyGradient(ctx, x, y, h);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);

  // Stars fading in near the top.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < Math.floor(w / 26); i++) {
    const sx = x + rng() * w, sy = y + rng() * h * 0.3;
    ctx.globalAlpha = 0.25 + rng() * 0.5;
    ctx.fillRect(sx, sy, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;

  // The slatted sun: a warm disc whose lower half is cut by sky-coloured
  // slats of growing thickness — filled with the same sky gradient, so the
  // cuts read as clean horizontal gaps.
  const sunR = Math.min(w, h) * 0.30;
  const sunX = x + w * (0.34 + rng() * 0.3);
  const sunY = y + h * 0.60;
  const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sunGrad.addColorStop(0, '#ffd94d');
  sunGrad.addColorStop(0.55, '#ff8a3d');
  sunGrad.addColorStop(1, '#ff2e63');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = sky;
  let slatY = sunY + sunR * 0.08, slatH = sunR * 0.045;
  while (slatY < sunY + sunR) {
    ctx.fillRect(sunX - sunR - 1, slatY, sunR * 2 + 2, slatH);
    slatY += slatH + sunR * 0.14;
    slatH *= 1.45;
  }

  // Water at the foot of the sky, with the sun's broken reflection.
  const waterY = y + h * 0.80;
  const water = ctx.createLinearGradient(0, waterY, 0, y + h);
  water.addColorStop(0, '#57164f');
  water.addColorStop(1, '#12041f');
  ctx.fillStyle = water;
  ctx.fillRect(x, waterY, w, y + h - waterY);
  ctx.fillStyle = 'rgba(255, 150, 80, 0.5)';
  for (let i = 0; i < 9; i++) {
    const rw = sunR * (0.9 - i * 0.08) * (0.7 + rng() * 0.5);
    ctx.fillRect(sunX - rw / 2, waterY + 3 + i * (h * 0.021), rw, 2.2);
  }

  drawSkyline(ctx, x, y, w, waterY, rng);
  const palmH = h * (0.34 + rng() * 0.14);
  drawPalm(ctx, x + w * 0.06, y + h * 0.99, palmH, 1, 0.24 + rng() * 0.1);
  drawPalm(ctx, x + w * 0.95, y + h * 0.99, palmH * 0.8, -1, 0.2 + rng() * 0.12);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Fallback scenes for panels with no photo yet

// A low, wide car silhouette with neon underglow, parked at the kerb.
function drawCarSilhouette(ctx, rect, rng) {
  const { x, y, w, h } = rect;
  const cw = w * 0.62, ch = h * 0.16;
  const cx = x + w * (0.14 + rng() * 0.2), cy = y + h * 0.80 - ch;
  ctx.fillStyle = 'rgba(25, 227, 210, 0.35)';
  ctx.fillRect(cx + cw * 0.06, cy + ch * 1.02, cw * 0.88, 3);
  ctx.fillStyle = '#14041f';
  ctx.beginPath();
  ctx.moveTo(cx, cy + ch);
  ctx.lineTo(cx + cw * 0.04, cy + ch * 0.45);
  ctx.lineTo(cx + cw * 0.24, cy + ch * 0.38);
  ctx.lineTo(cx + cw * 0.36, cy);
  ctx.lineTo(cx + cw * 0.62, cy);
  ctx.lineTo(cx + cw * 0.76, cy + ch * 0.36);
  ctx.lineTo(cx + cw * 0.95, cy + ch * 0.44);
  ctx.lineTo(cx + cw, cy + ch);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(140, 220, 255, 0.55)';
  ctx.beginPath();
  ctx.moveTo(cx + cw * 0.38, cy + ch * 0.10);
  ctx.lineTo(cx + cw * 0.60, cy + ch * 0.10);
  ctx.lineTo(cx + cw * 0.70, cy + ch * 0.34);
  ctx.lineTo(cx + cw * 0.30, cy + ch * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0a0214';
  for (const wx of [0.22, 0.78]) {
    ctx.beginPath();
    ctx.arc(cx + cw * wx, cy + ch, ch * 0.30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d2b52';
    ctx.beginPath();
    ctx.arc(cx + cw * wx, cy + ch, ch * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0214';
  }
}

// A pier railing and lamp posts marching into the water.
function drawPierSilhouette(ctx, rect, rng) {
  const { x, y, w, h } = rect;
  const deckY = y + h * 0.78;
  ctx.strokeStyle = '#170829';
  ctx.fillStyle = '#170829';
  ctx.lineWidth = Math.max(2, h * 0.012);
  ctx.beginPath();
  ctx.moveTo(x, deckY);
  ctx.lineTo(x + w, deckY - h * 0.05);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const px = x + (i / 5) * w * 0.96;
    const py = deckY - (i / 5) * h * 0.05;
    ctx.fillRect(px, py, Math.max(2, w * 0.008), h * 0.2);
    if (i % 2 === 0) {
      ctx.fillRect(px - 1, py - h * 0.16, Math.max(2.4, w * 0.01), h * 0.16);
      ctx.fillStyle = 'rgba(255, 190, 90, 0.9)';
      ctx.beginPath();
      ctx.arc(px, py - h * 0.175, Math.max(2.4, w * 0.012), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#170829';
    }
  }
  void rng;
}

// Paints a panel that holds no photo: the sunset backdrop plus one
// foreground silhouette chosen by the panel's seed.
export function drawFallbackScene(ctx, rect, seed) {
  drawSunsetBackdrop(ctx, rect, seed);
  const rng = seededRandom(seed * 7 + 3);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (seed % 3 === 1) drawCarSilhouette(ctx, rect, rng);
  else if (seed % 3 === 2) drawPierSilhouette(ctx, rect, rng);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Photos: cover-crop and the sunset / neon grade

// Draws `img` so it covers the panel, scaled by the panel's zoom and
// centred on its focal point (fx, fy in 0..1), clamped so the panel is
// always fully covered.
export function drawPhotoCover(ctx, img, rect, panel) {
  const zoom = clamp(panel.zoom || 1, 1, 3.5);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale, dh = ih * scale;
  const fx = clamp(panel.fx ?? 0.5, 0, 1);
  const fy = clamp(panel.fy ?? 0.5, 0, 1);
  const dx = rect.x + clamp(rect.w / 2 - fx * dw, rect.w - dw, 0);
  const dy = rect.y + clamp(rect.h / 2 - fy * dh, rect.h - dh, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// The teal-to-pink sunset grade: cool teal shadows rising from the lower
// left, hot pink highlights from the upper right, blended in overlay, a
// warm soft-light wash, and a gentle vignette to seat the panel.
export function applySunsetGrade(ctx, rect) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const diag = ctx.createLinearGradient(x, y + h, x + w, y);
  diag.addColorStop(0, '#0b5563');
  diag.addColorStop(0.5, '#7a4a8c');
  diag.addColorStop(1, '#ff5e8a');
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.52;
  ctx.fillStyle = diag;
  ctx.fillRect(x, y, w, h);
  const warm = ctx.createLinearGradient(0, y, 0, y + h);
  warm.addColorStop(0, '#ffb347');
  warm.addColorStop(1, '#26104d');
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = warm;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const vig = ctx.createRadialGradient(
    x + w / 2, y + h / 2, Math.min(w, h) * 0.42,
    x + w / 2, y + h / 2, Math.max(w, h) * 0.78,
  );
  vig.addColorStop(0, 'rgba(10, 0, 24, 0)');
  vig.addColorStop(1, 'rgba(10, 0, 24, 0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Caption lettering and the foot strip

const CAPTION_FONT_STACK =
  '"Arial Narrow", "Liberation Sans Narrow", Impact, Haettenschweiler, "Franklin Gothic Medium", sans-serif';

// Fits `text` in the condensed stack at the largest size that fits `maxW`,
// then paints it with a dark keyline and a two-colour neon offset shadow.
export function drawCaption(ctx, text, cx, cy, maxW, baseSize) {
  const label = (text || '').trim().toUpperCase() || 'YOUR NAME HERE';
  let size = baseSize;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const setFont = (s) => { ctx.font = `900 ${s}px ${CAPTION_FONT_STACK}`; };
  setFont(size);
  try { ctx.letterSpacing = `${Math.round(size * 0.04)}px`; } catch { /* older canvas */ }
  while (size > 10 && ctx.measureText(label).width > maxW) {
    size -= 2;
    setFont(size);
  }
  const off = Math.max(2, size * 0.055);
  ctx.fillStyle = '#12c9b8';
  ctx.fillText(label, cx - off, cy + off * 0.8);
  ctx.fillStyle = '#ff2e88';
  ctx.fillText(label, cx + off, cy + off * 0.8);
  ctx.lineWidth = Math.max(2, size / 8);
  ctx.strokeStyle = '#150326';
  ctx.lineJoin = 'round';
  ctx.strokeText(label, cx, cy);
  ctx.fillStyle = '#fff6df';
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

// The foot strip: deep plum, a teal-to-pink rule along its top edge, the
// caption centred, and the studio's own small credit at the right.
function drawFootStrip(ctx, foot, caption) {
  const { x, y, w, h } = foot;
  ctx.fillStyle = '#160429';
  ctx.fillRect(x, y, w, h);
  const rule = ctx.createLinearGradient(x, 0, x + w, 0);
  rule.addColorStop(0, '#12c9b8');
  rule.addColorStop(0.5, '#b45cff');
  rule.addColorStop(1, '#ff2e88');
  ctx.fillStyle = rule;
  ctx.fillRect(x, y, w, Math.max(3, h * 0.045));
  drawCaption(ctx, caption, x + w / 2, y + h * 0.56, w * 0.86, h * 0.52);
  ctx.save();
  ctx.font = `600 ${Math.max(9, h * 0.11)}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255, 246, 223, 0.38)';
  ctx.fillText('NEON TIDE COVER STUDIO', x + w - h * 0.22, y + h * 0.88);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The whole poster

// state: { caption, panels: [{ img, zoom, fx, fy, seed } x3] } — a panel
// with no img paints its fallback scene instead.
export function renderPoster(ctx, width, height, state) {
  ctx.save();
  ctx.fillStyle = '#f6efdd';
  ctx.fillRect(0, 0, width, height);
  const { panels, foot } = panelLayout(width, height);
  panels.forEach((rect, i) => {
    const panel = state.panels[i] || {};
    if (panel.img) {
      drawPhotoCover(ctx, panel.img, rect, panel);
      applySunsetGrade(ctx, rect);
    } else {
      drawFallbackScene(ctx, rect, panel.seed || 11 + i * 12);
      applySunsetGrade(ctx, rect);
    }
    ctx.strokeStyle = 'rgba(21, 3, 38, 0.22)';
    ctx.lineWidth = Math.max(1, width * 0.0016);
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  });
  drawFootStrip(ctx, foot, state.caption);
  ctx.restore();
}
