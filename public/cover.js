/* Carousel cover: the first slide of a carousel.
   Two designs share one block of words (eyebrow, title, line, film count) in the deck's type style:
   - Film still: the user's still, framed to the post shape, with a shade that rises from the text edge.
   - Colour essence: the colours of every poster in the deck, swirled into one soft, glassy, sand-grain field. */
(() => {
"use strict";
const P = window.PCS;
const STORE = "poster-card-studio:cover:v1", STILL_KEY = "cover:still";
const DEFAULTS = {
  enabled: true, design: "essence",
  kicker: "PMR#1", title: "Dangers of the Night", line: "Films that only make sense after dark.", count: true,
  align: "left", vpos: "bottom", color: null, shade: 0.5,
  focusX: 0.5, focusY: 0.5, zoom: 1,
  swirl: 0.55, flow: 0.6, glass: 0.55, glitter: 0.5, seed: 7,
  source: "all", sourceId: null, // essence colours: every poster, or one film
};
let hero = { ...DEFAULTS };
try { Object.assign(hero, JSON.parse(localStorage.getItem(STORE) || "{}")); } catch (e) { /* storage unavailable */ }
let still = null, stillPal = null;
let saveT = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(hero)); } catch (e) { /* ignore */ } }, 300); };
const changed = () => { save(); P.schedule(); };

/* ---------------- colour helpers ---------------- */
const TAU = Math.PI * 2;
const lumOf = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const satOf = c => { const mx = Math.max(...c), mn = Math.min(...c); return mx === 0 ? 0 : (mx - mn) / mx; };
const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const toHex = c => "#" + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const fromHex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tint(rgb, l, maxS) { // same hue, new lightness, capped saturation
  const [h, s] = P.rgbToHsl(...rgb); return P.hslToHex(h, Math.min(s, maxS), l);
}

// A poster's colours: k-means by area (so dark posters stay dark), plus its two most vivid accents
// (so a sliver of neon still makes it into the mix).
const colourCache = new WeakMap();
function coloursOf(src) {
  if (colourCache.has(src)) return colourCache.get(src);
  const c = document.createElement("canvas"); c.width = 36; c.height = 54;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(src, 0, 0, 36, 54);
  const d = x.getImageData(0, 0, 36, 54).data, px = [];
  for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
  px.sort((a, b) => lumOf(a) - lumOf(b));
  const k = 6; let C = Array.from({ length: k }, (_, i) => px[Math.floor((i + 0.5) * px.length / k)].slice()), counts = [];
  for (let it = 0; it < 8; it++) {
    const sums = C.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let best = 0, bd = Infinity;
      for (let ci = 0; ci < k; ci++) { const dd = (p[0] - C[ci][0]) ** 2 + (p[1] - C[ci][1]) ** 2 + (p[2] - C[ci][2]) ** 2; if (dd < bd) { bd = dd; best = ci; } }
      const sm = sums[best]; sm[0] += p[0]; sm[1] += p[1]; sm[2] += p[2]; sm[3]++;
    }
    C = sums.map((sm, ci) => (sm[3] ? [sm[0] / sm[3], sm[1] / sm[3], sm[2] / sm[3]] : C[ci])); counts = sums.map(sm => sm[3]);
  }
  const out = C.map((rgb, i) => ({ rgb, w: counts[i] / px.length, accent: false })).filter(o => o.w > 0.015);
  for (const hex of P.extractPalette(src).accents.slice(0, 2)) if (hex !== "#f3ead8") out.push({ rgb: fromHex(hex), w: 0.05, accent: true });
  colourCache.set(src, out); return out;
}
const FALLBACK = [{ rgb: [16, 15, 22], w: 0.6 }, { rgb: [44, 40, 58], w: 0.28 }, { rgb: [128, 116, 150], w: 0.08 }, { rgb: [200, 170, 140], w: 0.04 }];
// Slides that have a poster, and the one the essence is currently drawn from (when source is "one").
function sourceSlides() { return P.deckSlides().map((s, i) => ({ ...s, n: i + 1 })).filter(s => s.poster); }
function sourceSlide() { const list = sourceSlides(); return list.find(s => s.id === hero.sourceId) || list[0] || null; }
function deckPalette() {
  const one = hero.source === "one" ? sourceSlide() : null;
  const posters = one ? [one.poster] : P.deckPosters(); if (!posters.length) return FALLBACK;
  const all = []; for (const p of posters) for (const c of coloursOf(p)) all.push({ ...c, w: c.w / posters.length });
  const merged = [];
  for (const c of all.sort((a, b) => b.w - a.w)) {
    const m = merged.find(o => dist(o.rgb, c.rgb) < 30 && o.accent === c.accent);
    if (m) { m.rgb = mixRgb(m.rgb, c.rgb, c.w / (m.w + c.w)); m.w += c.w; }
    else merged.push({ ...c, rgb: c.rgb.slice() });
  }
  return merged.slice(0, 14);
}

/* ---------------- colour essence field ---------------- */
function makeNoise(rnd) {
  const p = new Uint16Array(512), v = new Float32Array(256);
  for (let i = 0; i < 256; i++) { p[i] = i; v[i] = rnd(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a = v[p[p[X] + Y]], b = v[p[p[X + 1] + Y]], c = v[p[p[X] + Y + 1]], d = v[p[p[X + 1] + Y + 1]];
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
}
const fbm = (n, x, y) => n(x, y) * 0.55 + n(x * 2.1 + 5.2, y * 2.1 + 9.7) * 0.3 + n(x * 4.3 + 1.3, y * 4.3 + 3.1) * 0.15;

// Low-res colour field: a domain-warped log spiral. Each palette colour is an arm whose width follows how
// much of the posters it covers; vivid accents glow additively as thin ribbons.
let fieldCache = null;
function essenceField(pal, w, h) {
  const key = [w, h, hero.seed, hero.swirl, hero.flow, ...pal.map(c => toHex(c.rgb) + c.w.toFixed(3))].join("|");
  if (fieldCache && fieldCache.key === key) return fieldCache;
  const rnd = mulberry32(hero.seed * 7919 + 17), noise = makeNoise(rnd);
  const sorted = pal.slice().sort((a, b) => b.w - a.w);
  const darkest = pal.reduce((a, b) => (lumOf(a.rgb) < lumOf(b.rgb) ? a : b)).rgb;
  const base0 = mixRgb(sorted[0].rgb, darkest, 0.5), base1 = mixRgb(sorted[Math.min(1, sorted.length - 1)].rgb, darkest, 0.35);
  const cx = 0.38 + rnd() * 0.24, cy = 0.34 + rnd() * 0.3, aspect = w / h;
  const tight = 1 + hero.swirl * 5.5, warp = 0.06 + hero.flow * 0.55;
  const arms = sorted.map((c, k) => {
    const s = satOf(c.rgb), L = lumOf(c.rgb), glow = c.accent || (s > 0.5 && L > 0.3);
    return { rgb: c.rgb, glow, phase: k * 2.39996 + rnd() * 0.9, width: (glow ? 0.12 : 0.3) + 1.15 * Math.sqrt(c.w),
      r0: rnd() * 0.12, r1: 0.45 + rnd() * 0.7, str: glow ? 0.75 : 0.5 + 0.5 * Math.min(1, c.w * 5) };
  });
  const img = new ImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx = (x / w - cx) * aspect, ny = y / h - cy;
      const n1 = fbm(noise, nx * 1.7 + 11.3, ny * 1.7 + 3.7), n2 = fbm(noise, nx * 1.7 - 7.1, ny * 1.7 + 19.9);
      nx += (n1 - 0.5) * warp * 2; ny += (n2 - 0.5) * warp * 2;
      const r = Math.hypot(nx, ny), sp = Math.atan2(ny, nx) + tight * Math.log(r + 0.06);
      const tb = Math.max(0, Math.min(1, y / h * 0.75 + (n1 - 0.5) * 0.7 + 0.12));
      let R = base0[0] + (base1[0] - base0[0]) * tb, G = base0[1] + (base1[1] - base0[1]) * tb, B = base0[2] + (base1[2] - base0[2]) * tb;
      for (const a of arms) {
        let dl = (sp - a.phase) % TAU; if (dl < -Math.PI) dl += TAU; else if (dl > Math.PI) dl -= TAU;
        const f = Math.exp(-(dl * dl) / (a.width * a.width)) * a.str * smooth(a.r0, a.r0 + 0.18, r) * (1 - smooth(a.r1, a.r1 + 0.55, r)) * (0.45 + n2);
        if (f < 0.004) continue;
        if (a.glow) { R += a.rgb[0] * f * 0.7; G += a.rgb[1] * f * 0.7; B += a.rgb[2] * f * 0.7; }
        else { const t = Math.min(1, f * 0.85); R += (a.rgb[0] - R) * t; G += (a.rgb[1] - G) * t; B += (a.rgb[2] - B) * t; }
      }
      const i = (y * w + x) * 4; d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255;
    }
  }
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h; canvas.getContext("2d").putImageData(img, 0, 0);
  fieldCache = { key, canvas, data: d, w, h };
  return fieldCache;
}

function drawEssence(ctx, W, H) {
  const pal = deckPalette(), dev = ctx.canvas, dw = dev.width, dh = dev.height;
  const f = essenceField(pal, 200, Math.round(200 * H / W));
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  // soft, glassy: upscale the field through a blur, overscanned so the edges don't fade
  const blur = (4 + hero.glass * 34) * dw / 1080, os = blur * 2.5;
  ctx.fillStyle = toHex(pal.reduce((a, b) => (lumOf(a.rgb) < lumOf(b.rgb) ? a : b)).rgb); ctx.fillRect(0, 0, dw, dh);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  if (P.FILTER_OK) ctx.filter = `blur(${blur}px) saturate(1.12)`;
  ctx.drawImage(f.canvas, -os, -os, dw + os * 2, dh + os * 2); ctx.filter = "none";
  // glass: two faint diagonal reflections
  const g = ctx.createLinearGradient(0, 0, dw, dh);
  g.addColorStop(0.3, "rgba(255,255,255,0)"); g.addColorStop(0.4, `rgba(255,255,255,${0.04 + 0.06 * hero.glass})`);
  g.addColorStop(0.47, "rgba(255,255,255,0)"); g.addColorStop(0.6, `rgba(255,255,255,${0.02 + 0.04 * hero.glass})`); g.addColorStop(0.66, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, dw, dh);
  // sand: overlay grain at two scales
  const grain = P.getGrain();
  ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = 0.12 + hero.glitter * 0.14;
  ctx.fillStyle = ctx.createPattern(grain, "repeat"); ctx.fillRect(0, 0, dw, dh);
  ctx.globalCompositeOperation = "soft-light"; ctx.globalAlpha = 0.18 + hero.glitter * 0.12;
  const fine = ctx.createPattern(grain, "repeat"); fine.setTransform(new DOMMatrix().scale(0.5)); ctx.fillStyle = fine; ctx.fillRect(0, 0, dw, dh);
  // glitter: specks tinted by the colour underneath, a few with a star glint
  ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 1;
  const rnd = mulberry32(hero.seed * 104729 + 3), n = Math.round(hero.glitter * 3200 * (dw * dh) / (1440 * 1920)), unit = dw / 1440;
  for (let i = 0; i < n; i++) {
    const x = rnd() * dw, y = rnd() * dh;
    const fi = (Math.min(f.h - 1, Math.floor(y / dh * f.h)) * f.w + Math.min(f.w - 1, Math.floor(x / dw * f.w))) * 4;
    const c = mixRgb([f.data[fi], f.data[fi + 1], f.data[fi + 2]], [255, 250, 240], 0.55);
    const r = (0.45 + rnd() ** 3 * 2.2) * unit, a = 0.18 + rnd() * 0.55;
    ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (rnd() < 0.025) {
      const L = r * (5 + rnd() * 6);
      for (const [ax, ay] of [[1, 0], [0, 1]]) {
        const lg = ctx.createLinearGradient(x - ax * L, y - ay * L, x + ax * L, y + ay * L);
        lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, `rgba(255,255,255,${a})`); lg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = lg; ctx.fillRect(ax ? x - L : x - 0.6 * unit, ay ? y - L : y - 0.6 * unit, ax ? L * 2 : 1.2 * unit, ay ? L * 2 : 1.2 * unit);
      }
    }
  }
  ctx.restore();
}

/* ---------------- film still ---------------- */
function drawStill(ctx, W, H) {
  ctx.fillStyle = "#0c0b0e"; ctx.fillRect(0, 0, W, H);
  if (still) {
    const iw = still.width, ih = still.height, s = Math.max(W / iw, H / ih) * hero.zoom, dw = iw * s, dh = ih * s;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(still, (W - dw) * hero.focusX, (H - dh) * hero.focusY, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#2a2530"); g.addColorStop(1, "#0f0e12");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.font = P.fontStr({ family: "Hanken Grotesk", weight: 500, fb: "system-ui, sans-serif" }, 30);
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.textAlign = "center"; ctx.fillText("Upload or drop a film still", W / 2, H * 0.42);
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = 0.05;
  ctx.fillStyle = ctx.createPattern(P.getGrain(), "repeat"); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
}

// Shade rises from the edge the words sit on, so the rest of the image stays untouched.
function drawShade(ctx, W, H, strength) {
  if (strength <= 0) return;
  ctx.fillStyle = `rgba(0,0,0,${strength * 0.18})`; ctx.fillRect(0, 0, W, H);
  if (hero.vpos === "middle") { // a soft band behind the words instead of a rise from one edge
    const g = ctx.createLinearGradient(0, H * 0.18, 0, H * 0.82);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, `rgba(0,0,0,${strength * 0.72})`); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    const bottom = hero.vpos === "bottom", g = ctx.createLinearGradient(0, bottom ? H : 0, 0, bottom ? H * 0.3 : H * 0.7);
    g.addColorStop(0, `rgba(0,0,0,${strength * 0.92})`); g.addColorStop(0.45, `rgba(0,0,0,${strength * 0.5})`); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (hero.align !== "center") {
    const left = hero.align === "left", s = ctx.createLinearGradient(left ? 0 : W, 0, left ? W * 0.8 : W * 0.2, 0);
    s.addColorStop(0, `rgba(0,0,0,${strength * 0.38})`); s.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
  }
}

/* ---------------- text colours ---------------- */
// Light options that read on a shaded cover: white, warm paper, and pale tints of the cover's own colours.
function textOptions() {
  let src;
  if (hero.design === "still") src = still ? (stillPal ||= P.extractPalette(still)).accents.filter(h => h !== "#f3ead8").map(fromHex) : [];
  else src = deckPalette().slice().sort((a, b) => (satOf(b.rgb) * (b.w + 0.05)) - (satOf(a.rgb) * (a.w + 0.05))).map(c => c.rgb);
  const opts = ["#ffffff", "#f4ead7"];
  for (const rgb of src.slice(0, 4)) { const t = tint(rgb, 0.85, 0.55); if (!opts.includes(t)) opts.push(t); if (opts.length >= 5) break; }
  const vivid = src[0] ? tint(src[0], 0.7, 0.85) : "#e9b65a";
  if (!opts.includes(vivid)) opts.push(vivid);
  return { opts, vivid };
}

/* ---------------- words ---------------- */
function fitTitle(ctx, text, f, maxW, maxLines, maxSize, minSize) {
  let r;
  for (let s = maxSize; s >= minSize; s -= 2) {
    ctx.font = P.fontStr(f, s); P.setTitleTracking(ctx, f, s);
    const lines = P.wrapPlain(ctx, text, maxW); r = { size: s, lines };
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) break;
  }
  P.clearTracking(ctx); return r;
}
function drawWords(ctx, W, H, K) {
  const p = P.preset(), st = P.state, pad = Math.round(Math.min(W, H) * 0.08);
  const align = hero.align, maxW = align === "center" ? W - 2 * pad : (W - 2 * pad) * 0.86;
  const x = align === "left" ? pad : align === "right" ? W - pad : W / 2;
  const { opts, vivid } = textOptions(), color = hero.color || opts[0];
  const items = []; let h = 0;
  const kick = (hero.kicker || "").trim();
  if (kick) { items.push({ k: "label", text: kick.toUpperCase(), size: 26, color: vivid, track: p.label.track, y: h }); h += 26 + 30; }
  const raw = (hero.title || "").trim() || "Untitled";
  const t = fitTitle(ctx, p.title.upper ? raw.toUpperCase() : raw, p.title, maxW, 3, Math.round(p.title.max * 1.45), 60);
  const lh = t.size * p.title.lh; items.push({ k: "title", lines: t.lines, size: t.size, lh, y: h }); h += t.lines.length * lh;
  const line = (hero.line || "").trim();
  if (line) {
    let size = Math.round(p.body.max * 1.2), lines;
    for (; size >= 26; size--) { ctx.font = P.fontStr(p.body, size); lines = P.wrapPlain(ctx, line, Math.min(maxW, 820)); if (lines.length <= 3) break; }
    h += 30; items.push({ k: "line", lines, size, lh: size * p.body.lh, y: h }); h += (lines.length - 1) * size * p.body.lh + size;
  }
  const n = P.deckCount();
  if (hero.count && n) { h += 34; items.push({ k: "label", text: `${n} FILM${n === 1 ? "" : "S"} INSIDE   →`, size: 21, color: "rgba(255,255,255,0.78)", track: p.label.track * 0.7, y: h, tinted: true }); h += 21; }
  const top = hero.vpos === "bottom" ? H - pad - h : hero.vpos === "middle" ? (H - h) / 2 : pad + 40;
  ctx.textBaseline = "alphabetic";
  for (const it of items) {
    const y = top + it.y;
    if (it.k === "label") {
      ctx.font = P.fontStr(p.label, it.size); ctx.fillStyle = it.tinted ? color : it.color;
      ctx.globalAlpha = it.tinted ? 0.8 : 1;
      P.drawTracked(ctx, it.text, x, y + it.size / 2 + P.capHeight(ctx) / 2, it.track, it.size, align); ctx.globalAlpha = 1;
    } else if (it.k === "title") {
      ctx.save(); ctx.font = P.fontStr(p.title, it.size); P.setTitleTracking(ctx, p.title, it.size); ctx.textAlign = align;
      const ch = P.capHeight(ctx);
      it.lines.forEach((ln, i) => {
        const base = y + i * it.lh + it.lh / 2 + ch / 2;
        if (st.chrome) P.drawChromeText(ctx, ln, x, base, it.size, ch, align, i === 0);
        else { ctx.fillStyle = color; ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 40 * K; ctx.shadowOffsetY = 4 * K; ctx.fillText(ln, x, base); }
      });
      ctx.restore(); P.clearTracking(ctx);
    } else if (it.k === "line") {
      ctx.font = P.fontStr(p.body, it.size); ctx.fillStyle = color; ctx.globalAlpha = 0.9; ctx.textAlign = align;
      it.lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * it.lh + it.size * 0.8)); ctx.globalAlpha = 1;
    }
  }
  // handle on the opposite edge, same side
  const handle = (st.show?.handle && (st.handle || "").trim()) || "";
  if (handle) {
    ctx.font = P.fontStr(p.label, 19); ctx.fillStyle = color; ctx.globalAlpha = 0.7;
    const y = hero.vpos === "top" ? H - pad : pad + 19; // opposite edge; with middle text it sits at the top
    P.drawTracked(ctx, handle, x, y, p.label.track * 0.4, 19, align); ctx.globalAlpha = 1;
  }
}

/* ---------------- render ---------------- */
function render(canvas, outW) {
  const R = P.RATIOS[P.state.ratio] || P.RATIOS["3:4"], W = R.w, H = R.h, K = outW / W;
  P.setK(K);
  canvas.width = Math.round(W * K); canvas.height = Math.round(H * K);
  const ctx = canvas.getContext("2d"); ctx.setTransform(K, 0, 0, K, 0, 0);
  if (hero.design === "still") { drawStill(ctx, W, H); drawShade(ctx, W, H, hero.shade); }
  else { drawEssence(ctx, W, H); drawShade(ctx, W, H, hero.shade * 0.7); }
  drawWords(ctx, W, H, K);
}

/* ---------------- panel ---------------- */
const $ = id => document.getElementById(id);
const pct = v => Math.round(v * 100) + "%";
const FMT = { swirl: pct, flow: pct, glass: pct, glitter: pct, shade: pct, focusX: pct, focusY: pct, zoom: v => (+v).toFixed(2) + "×" };
function seg(id, key, after) {
  $(id).querySelectorAll("button").forEach(b => {
    b.setAttribute("aria-pressed", String(hero[key] === b.dataset.v));
    b.onclick = () => { hero[key] = b.dataset.v; if (after) after(); sync(); changed(); };
  });
}
function renderSwatches() {
  const box = $("cvSwatches"); box.innerHTML = "";
  const { opts } = textOptions(), current = hero.color || opts[0];
  for (const hex of opts) {
    const b = document.createElement("button"); b.type = "button"; b.style.background = hex; b.title = hex; b.setAttribute("aria-label", `Text colour ${hex}`);
    b.setAttribute("aria-pressed", String(hex === current));
    b.addEventListener("click", () => { hero.color = hex === opts[0] ? null : hex; renderSwatches(); changed(); });
    box.append(b);
  }
  const pick = document.createElement("input"); pick.type = "color"; pick.id = "cvColorPick"; pick.title = "Custom text colour"; pick.setAttribute("aria-label", "Custom text colour");
  pick.value = current; pick.addEventListener("input", () => { hero.color = pick.value; changed(); }); pick.addEventListener("change", renderSwatches);
  box.append(pick);
}
function sync() {
  document.querySelectorAll("[data-cv]").forEach(el => {
    const v = hero[el.dataset.cv];
    if (el.type === "checkbox") el.checked = !!v; else if (document.activeElement !== el) el.value = v ?? "";
  });
  document.querySelectorAll("output[data-cvo]").forEach(o => (o.textContent = FMT[o.dataset.cvo](hero[o.dataset.cvo])));
  seg("cvDesign", "design", () => { hero.color = null; }); seg("cvAlign", "align"); seg("cvPos", "vpos");
  $("cvEssenceCtl").hidden = hero.design !== "essence"; $("cvStillCtl").hidden = hero.design !== "still";
  seg("cvSource", "source", () => { if (!hero.sourceId) hero.sourceId = sourceSlide()?.id || null; });
  refresh();
}
// Updates the parts that depend on the deck (film picker label, text colours); called when slides change.
function refresh() {
  const one = hero.source === "one", list = sourceSlides(), s = sourceSlide();
  $("cvCycler").hidden = !one;
  if (one) {
    $("cvSourceName").textContent = s ? `Slide ${s.n} of ${P.deckCount()} · ${s.title || "Untitled"}` : "Add a poster to a slide first";
    $("cvPrev").disabled = $("cvNext").disabled = list.length < 2;
  }
  renderSwatches();
}
function cycle(d) {
  const list = sourceSlides(); if (!list.length) return;
  const i = Math.max(0, list.findIndex(s => s.id === sourceSlide()?.id));
  hero.sourceId = list[(i + d + list.length) % list.length].id; hero.color = null;
  refresh(); changed();
}
$("cvPrev").addEventListener("click", () => cycle(-1));
$("cvNext").addEventListener("click", () => cycle(1));
document.querySelectorAll("[data-cv]").forEach(el => el.addEventListener("input", () => {
  const k = el.dataset.cv; hero[k] = el.type === "checkbox" ? el.checked : el.type === "range" ? +el.value : el.value;
  const o = document.querySelector(`output[data-cvo="${k}"]`); if (o) o.textContent = FMT[k](hero[k]);
  if (k === "focusX" || k === "focusY" || k === "zoom") hero.design = "still";
  changed();
}));
$("cvShuffle").addEventListener("click", () => { hero.seed = (hero.seed * 48271 + 11) % 2147483647; changed(); });

async function setStill(url) {
  still = await P.loadImage(url); stillPal = null;
  if (!hero.color || hero.design !== "still") hero.color = null;
  hero.design = "still"; sync(); changed();
}
async function takeFile(file) {
  if (!file || !file.type.startsWith("image/")) { P.toast("That file isn't an image. Try a JPG, PNG or WebP."); return; }
  const img = await P.loadImage(await P.readFile(file));
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0);
  const url = P.downsized(c, 2400).toDataURL("image/jpeg", 0.92);
  P.idbPut(STILL_KEY, url); hero.focusX = 0.5; hero.focusY = 0.5; hero.zoom = 1;
  await setStill(url); P.toast("Cover still loaded. Use the framing sliders to choose what shows.");
}
$("cvStillFile").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; takeFile(f); });

window.Cover = {
  render, sync, takeFile, refresh,
  enabled: () => !!hero.enabled,
  setEnabled: v => { hero.enabled = !!v; changed(); },
  title: () => hero.title || "cover",
  designName: () => (hero.design === "still" ? "Film still" : "Colour essence"),
};

(async () => {
  const url = await P.idbGet(STILL_KEY);
  if (url) { try { still = await P.loadImage(url); } catch (e) { /* ignore */ } }
  sync(); P.renderDeck(); P.schedule();
})();
})();
