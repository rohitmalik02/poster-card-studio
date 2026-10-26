(() => {
"use strict";

/* ---------------- constants ---------------- */
const RATIOS = {
  "3:2":  { w: 1620, h: 1080, name: "Landscape" },
  "3:4":  { w: 1080, h: 1440, name: "Portrait" },
  "4:5":  { w: 1080, h: 1350, name: "Tall" },
  "1:1":  { w: 1080, h: 1080, name: "Square" },
  "9:16": { w: 1080, h: 1920, name: "Story" },
};
// Each layout has a landscape (3:2) and a portrait/square version; notes describe the one in use.
const LAYOUTS = {
  auto:     { name: "Auto",     wide: "best for shape",        tall: "best for shape" },
  stacked:  { name: "Stacked",  wide: "title · poster · text", tall: "title · poster · text" },
  split:    { name: "Split",    wide: "poster + text column",  tall: "title, poster + text side by side" },
  triptych: { name: "Triptych", wide: "title | poster | text", tall: "poster first, words below" },
};
const isWide = () => { const R = RATIOS[state.ratio]; return R.w > R.h * 1.15; };
const PRESETS = {
  criterion: {
    name: "Criterion", note: "quiet, literary",
    title: { family: "Instrument Serif", weight: 400, style: "normal", fb: "Georgia, serif", upper: false, lh: 1.0, max: 116, track: 0 },
    body:  { family: "Hanken Grotesk", weight: 400, style: "normal", fb: "system-ui, sans-serif", lh: 1.5, max: 31 },
    label: { family: "Hanken Grotesk", weight: 600, style: "normal", fb: "system-ui, sans-serif", track: 0.26 },
  },
  marquee: {
    name: "Marquee", note: "loud, blockbuster",
    title: { family: "Anton", weight: 400, style: "normal", fb: "Impact, sans-serif", upper: true, lh: 1.04, max: 120, track: 0.01 },
    body:  { family: "Barlow", weight: 500, style: "normal", fb: "system-ui, sans-serif", lh: 1.45, max: 31 },
    label: { family: "Barlow", weight: 600, style: "normal", fb: "system-ui, sans-serif", track: 0.28 },
  },
  arthouse: {
    name: "Arthouse", note: "romantic, italic",
    title: { family: "Fraunces", weight: 500, style: "italic", fb: "Georgia, serif", upper: false, lh: 1.02, max: 104, track: -0.01 },
    body:  { family: "Newsreader", weight: 400, style: "normal", fb: "Georgia, serif", lh: 1.45, max: 33 },
    label: { family: "DM Mono", weight: 500, style: "normal", fb: "monospace", track: 0.16 },
  },
  zine: {
    name: "Zine", note: "chrome, punchy",
    title: { family: "Bricolage Grotesque", weight: 800, style: "normal", fb: "system-ui, sans-serif", upper: true, lh: 1.04, max: 118, track: -0.01 },
    body:  { family: "DM Mono", weight: 400, style: "normal", fb: "monospace", lh: 1.55, max: 26 },
    label: { family: "DM Mono", weight: 500, style: "normal", fb: "monospace", track: 0.18 },
  },
};
const SAMPLES = {
  "before-sunrise": {
    title: "Before Sunrise", year: "1995", director: "Richard Linklater", cast: "Ethan Hawke, Julie Delpy", runtime: "1h 41m", genre: "Romance", rating: 4.5,
    kicker: "Tonight's pick",
    blurb: "Two strangers step off a train in Vienna with one night and nothing to lose. Linklater turns a long walk and a longer conversation into *the most romantic film about time running out.* Watch it late, with someone you'd miss.",
  },
  "the-lunchbox": {
    title: "The Lunchbox", year: "2013", director: "Ritesh Batra", cast: "Irrfan Khan, Nimrat Kaur", runtime: "1h 44m", genre: "Drama", rating: 4,
    kicker: "Comfort watch",
    blurb: "A misdelivered tiffin in Mumbai starts a correspondence between a lonely widower and a neglected wife. Irrfan says more with a pause than most actors say with a monologue. *Gentle, aching, and full of food you can almost smell.*",
  },
  "piku": {
    title: "Piku", year: "2015", director: "Shoojit Sircar", cast: "Deepika Padukone, Amitabh Bachchan, Irrfan Khan", runtime: "2h 3m", genre: "Comedy/Drama", rating: 4.5,
    kicker: "Weekend watch",
    blurb: "A road trip from Delhi to Kolkata, a father obsessed with his digestion, and a daughter at the end of her patience. Sircar finds *real tenderness in the bickering,* and Deepika, Amitabh and Irrfan make family exhaustion look a lot like love.",
  },
  "a-summers-tale": {
    title: "A Summer's Tale", year: "1996", director: "Éric Rohmer", cast: "Melvil Poupaud, Amanda Langlet", runtime: "1h 53m", genre: "Romance", rating: 3.5,
    kicker: "Hidden gem",
    blurb: "A shy musician waits in a Breton beach town for a girlfriend who may never show, and ends up juggling three women and his own indecision. Rohmer's summer is *all talk, sea air and gorgeous hesitation.* Pure holiday.",
  },
};
const LOOK_DEFAULTS = {
  ratio: "3:4", layout: "auto", preset: "criterion", chrome: false,
  bg: { zoom: 1.4, shift: 0, blur: 64, dark: 0.42, sat: 1.35, tint: 0.1, vignette: 0.6, grain: 0.07 },
  poster: { scale: 0.95, radius: 8, shadow: 0.85, glow: 0.35, border: true },
  export: { width: "1440", format: "png" },
};
const STORE_KEY = "poster-card-studio:v3";
const POSTER_KEY = "poster-card-studio:poster";

/* ---------------- state ---------------- */
const clone = o => JSON.parse(JSON.stringify(o));
let state = Object.assign(clone(LOOK_DEFAULTS), {
  sample: "before-sunrise",
  ...SAMPLES["before-sunrise"],
  handle: "@yourhandle", handlePos: "with", directorIn: "billing",
  show: { kicker: true, meta: true, stars: true, blurb: true, handle: true, cast: true },
  accent: "#e9b65a", palette: [],
});
let posterCanvas = null;   // 2:3 crop of the uploaded poster
let bgImage = null;        // optional separate backdrop image
let baseColor = "#141216";

try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  if (saved && typeof saved === "object") state = deepMerge(state, saved);
} catch (e) { /* storage unavailable: start fresh */ }

function deepMerge(a, b) {
  const out = Array.isArray(a) ? a.slice() : { ...a };
  for (const k in b) {
    if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object") out[k] = deepMerge(a[k], b[k]);
    else out[k] = b[k];
  }
  return out;
}
const getPath = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
function setPath(o, p, v) { const ks = p.split("."); const last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; }

/* ---------------- colour helpers ---------------- */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  const f = n => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return "#" + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, "0")).join("");
}
function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex || "#e9b65a"); return `rgba(${r},${g},${b},${a})`; };

function extractPalette(src) {
  const c = document.createElement("canvas"); c.width = 48; c.height = 72;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(src, 0, 0, 48, 72);
  const d = x.getImageData(0, 0, 48, 72).data;
  const N = 18, bins = Array.from({ length: N }, () => ({ r: 0, g: 0, b: 0, n: 0, score: 0 }));
  let ar = 0, ag = 0, ab = 0, an = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    ar += r; ag += g; ab += b; an++;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.22 || l < 0.12 || l > 0.93) continue;
    const bin = bins[Math.floor(h * N) % N];
    const w = s * (1 - Math.abs(l - 0.5));
    bin.r += r * w; bin.g += g * w; bin.b += b * w; bin.n += w; bin.score += w;
  }
  const accents = bins.filter(b => b.n > 2).sort((a, b) => b.score - a.score).slice(0, 5).map(b => {
    const [h, s, l] = rgbToHsl(b.r / b.n, b.g / b.n, b.b / b.n);
    return hslToHex(h, Math.min(0.9, Math.max(s, 0.55)), Math.min(0.76, Math.max(l, 0.64)));
  });
  accents.push("#f3ead8"); // warm paper white always available
  const [h, s, lum] = rgbToHsl(ar / an, ag / an, ab / an);
  return { accents, lum, base: hslToHex(h, Math.min(s, 0.35), 0.08) };
}

/* ---------------- image loading ---------------- */
const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function cropTo23(img) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  let sx = 0, sy = 0, sw = iw, sh = ih; const r = iw / ih;
  if (Math.abs(r - 2 / 3) > 0.01) {
    if (r > 2 / 3) { sw = ih * 2 / 3; sx = (iw - sw) / 2; } else { sh = iw * 1.5; sy = (ih - sh) / 2; }
  }
  const c = document.createElement("canvas"); c.width = Math.round(sw); c.height = Math.round(sh);
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

async function setPoster(src, { persist = true, keepAccent = false } = {}) {
  const img = await loadImage(src);
  posterCanvas = cropTo23(img);
  const pal = extractPalette(posterCanvas);
  baseColor = pal.base; state.palette = pal.accents;
  if (!keepAccent || !state.accent) {
    state.accent = pal.accents[0];
    // Dark posters sink into a dark backdrop, so give them more colour glow.
    state.poster.glow = pal.lum < 0.25 ? 0.8 : pal.lum < 0.4 ? 0.55 : 0.3;
    syncInputs();
  }
  if (persist) idbPut(`deck:${deck[cur].id}`, downsized(posterCanvas, 1400).toDataURL("image/jpeg", 0.92));
  renderSwatches(); schedule();
}

/* ---------------- carousel deck ----------------
   Each slide keeps its own words, poster, backdrop still and accent; the look is shared.
   The current slide's words live in `state` (so every control keeps working); the rest wait in `deck`. */
const DECK_KEY = "poster-card-studio:deck:v1";
const CONTENT_KEYS = ["sample", "kicker", "title", "year", "director", "cast", "runtime", "genre", "rating", "blurb", "accent", "palette"];
const uid = () => Math.random().toString(36).slice(2, 10);
const pick = o => Object.fromEntries(CONTENT_KEYS.map(k => [k, clone(o[k] ?? null)]));
let deck = [], cur = 0;
const imgs = new Map(); // slide id -> { poster, bg, base }

function stash() {
  if (!deck[cur]) return;
  deck[cur] = { id: deck[cur].id, ...pick(state) };
  imgs.set(deck[cur].id, { poster: posterCanvas, bg: bgImage, base: baseColor });
}
function loadSlide(i) {
  cur = i; const sl = deck[i];
  for (const k of CONTENT_KEYS) if (sl[k] !== undefined) state[k] = clone(sl[k]); else if (k === "cast") state.cast = ""; // slides saved before the cast field
  if (!state.accent) state.accent = "#e9b65a";
  if (!Array.isArray(state.palette)) state.palette = [];
  const im = imgs.get(sl.id) || {};
  posterCanvas = im.poster || null; bgImage = im.bg || null; baseColor = im.base || "#141216";
}
// Temporarily make slide i current (for thumbnails and export), then put everything back.
function withSlide(i, fn) {
  if (i === cur) return fn();
  stash(); const back = cur, keepLong = tooLong; loadSlide(i);
  try { return fn(); } finally { loadSlide(back); tooLong = keepLong; }
}
// The cover sits in front of slide 1 in Carousel mode; cover.js draws it.
let onCover = false;
const coverOn = () => document.body.dataset.mode === "carousel" && onCover && !!window.Cover?.enabled();
function syncCoverFlag() { if (coverOn()) document.body.dataset.cover = "1"; else delete document.body.dataset.cover; }
function selectCover() {
  if (!window.Cover?.enabled()) return;
  stash(); onCover = true; syncCoverFlag(); window.Cover.sync(); renderDeck(); schedule();
}
function selectSlide(i) {
  if (i < 0 || i >= deck.length) return;
  onCover = false; syncCoverFlag();
  stash(); loadSlide(i);
  document.getElementById("clearBg").hidden = !bgImage;
  syncInputs(); renderSamples(); renderSwatches(); renderDeck(); schedule();
}
function addSlide() {
  if (deck.length >= 20) { toast("Instagram carousels stop at 20 slides."); return; }
  stash();
  deck.splice(cur + 1, 0, { id: uid(), sample: null, kicker: state.kicker, title: "New film", year: "", director: "", runtime: "", genre: "",
    rating: 0, blurb: "Why it's worth watching, in one or two lines.", cast: "", accent: state.accent, palette: state.palette });
  selectSlide(cur + 1);
  toast("Slide added. Drop a poster on it.");
}
function deleteSlide(i) {
  if (deck.length <= 1) { toast("A carousel needs at least one slide."); return; }
  stash(); const [gone] = deck.splice(i, 1);
  imgs.delete(gone.id); idbPut(`deck:${gone.id}`, null); idbPut(`deck:${gone.id}:bg`, null);
  cur = Math.min(i === cur ? i : cur > i ? cur - 1 : cur, deck.length - 1); loadSlide(cur);
  document.getElementById("clearBg").hidden = !bgImage;
  syncInputs(); renderSamples(); renderSwatches(); renderDeck(); schedule();
  toast(`Deleted slide ${i + 1}.`);
}
function moveSlide(i, d) {
  const j = i + d; if (j < 0 || j >= deck.length) return;
  stash(); [deck[i], deck[j]] = [deck[j], deck[i]];
  if (cur === i) cur = j; else if (cur === j) cur = i;
  renderDeck(); schedule();
}
let thumbTimer = 0;
function renderDeck() {
  const box = document.getElementById("deck"); box.innerHTML = "";
  const mk = (txt, label, fn) => { const t = document.createElement("button"); t.type = "button"; t.className = "icon-btn"; t.textContent = txt; t.title = label; t.setAttribute("aria-label", label); t.addEventListener("click", fn); return t; };
  if (window.Cover?.enabled()) {
    const slot = document.createElement("div"); slot.className = "slot cover-slot";
    const b = document.createElement("button"); b.type = "button"; b.className = "thumb"; b.setAttribute("aria-current", String(onCover)); b.setAttribute("aria-label", "Cover");
    const c = document.createElement("canvas"); c.style.width = "72px"; c.dataset.i = "cover"; const tag = document.createElement("span"); tag.textContent = window.Cover.moving() ? "Cover ▶" : "Cover";
    b.append(c, tag); b.addEventListener("click", selectCover);
    const tools = document.createElement("div"); tools.className = "tools";
    tools.append(mk("✕", "Remove the cover", () => { window.Cover.setEnabled(false); if (onCover) selectSlide(cur); else renderDeck(); toast("Cover removed. Add it back from the strip."); }));
    slot.append(b, tools); box.append(slot);
  } else if (window.Cover) {
    const add = document.createElement("button"); add.type = "button"; add.className = "add"; add.textContent = "+ Cover";
    add.addEventListener("click", () => { window.Cover.setEnabled(true); selectCover(); });
    box.append(add);
  }
  deck.forEach((sl, i) => {
    const slot = document.createElement("div"); slot.className = "slot";
    const b = document.createElement("button"); b.type = "button"; b.className = "thumb";
    b.setAttribute("aria-current", String(i === cur && !onCover)); b.setAttribute("aria-label", `Slide ${i + 1}: ${i === cur ? state.title : sl.title}`);
    const c = document.createElement("canvas"); c.style.width = "72px"; c.dataset.i = String(i); const tag = document.createElement("span"); tag.textContent = String(i + 1);
    b.append(c, tag); b.addEventListener("click", () => selectSlide(i));
    const tools = document.createElement("div"); tools.className = "tools";
    tools.append(mk("←", `Move slide ${i + 1} left`, () => moveSlide(i, -1)), mk("→", `Move slide ${i + 1} right`, () => moveSlide(i, 1)), mk("✕", `Delete slide ${i + 1}`, () => deleteSlide(i)));
    slot.append(b, tools); box.append(slot);
  });
  const add = document.createElement("button"); add.type = "button"; add.className = "add"; add.textContent = "+ Add slide"; add.addEventListener("click", addSlide);
  box.append(add);
  window.Cover?.refresh();
  renderThumbs();
}
function renderThumbs() {
  if (document.body.dataset.mode !== "carousel") return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  document.querySelectorAll("#deck canvas").forEach(c => {
    if (c.dataset.i === "cover") window.Cover?.render(c, 72 * dpr);
    else if (deck[+c.dataset.i]) withSlide(+c.dataset.i, () => render(c, 72 * dpr));
  });
}
function saveDeck() {
  stash();
  try { localStorage.setItem(DECK_KEY, JSON.stringify({ cur, slides: deck })); } catch (e) { /* ignore */ }
}
async function imagesFor(sl) {
  const out = { poster: null, bg: null, base: "#141216" };
  const samples = window.SAMPLE_POSTERS || {};
  const src = sl.sample && samples[sl.sample] ? samples[sl.sample] : await idbGet(`deck:${sl.id}`);
  if (src) { try { out.poster = cropTo23(await loadImage(src)); out.base = extractPalette(out.poster).base; } catch (e) { /* ignore */ } }
  const bg = await idbGet(`deck:${sl.id}:bg`);
  if (bg) { try { out.bg = await loadImage(bg); } catch (e) { /* ignore */ } }
  return out;
}

/* IndexedDB: shared with Night Shift's poster store */
let dbp = null;
function idb() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open("poster-card-studio", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("posters");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function idbPut(key, val) {
  try {
    const d = await idb();
    await new Promise((res, rej) => { const tx = d.transaction("posters", "readwrite"); val == null ? tx.objectStore("posters").delete(key) : tx.objectStore("posters").put(val, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch (e) { /* storage unavailable: lasts until reload */ }
}
async function idbGet(key) {
  try { const d = await idb(); return await new Promise(res => { const rq = d.transaction("posters").objectStore("posters").get(key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }); }
  catch (e) { return null; }
}
async function idbClear() {
  const d = await idb();
  await new Promise((res, rej) => { const tx = d.transaction("posters", "readwrite"); tx.objectStore("posters").clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
function downsized(c, maxW) {
  if (c.width <= maxW) return c;
  const d = document.createElement("canvas"); d.width = maxW; d.height = Math.round(c.height * maxW / c.width);
  const x = d.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, d.width, d.height); return d;
}

function readFile(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
async function usePosterFile(file) {
  if (!file || !file.type.startsWith("image/")) { toast("That file isn't an image. Try a JPG, PNG or WebP."); return; }
  state.sample = null; renderSamples();
  await setPoster(await readFile(file));
  toast("Poster loaded. Colours updated to match.");
}

/* ---------------- canvas helpers ---------------- */
const FILTER_OK = (() => { const t = document.createElement("canvas").getContext("2d"); if (typeof t.filter !== "string") return false; t.filter = "blur(2px)"; return t.filter === "blur(2px)"; })();
let K = 1; // device px per layout px for the render in progress
let tooLong = false; // paragraph overflowed its space at the minimum readable size

function fontStr(f, size) { return `${f.style || "normal"} ${f.weight} ${size}px "${f.family}", ${f.fb}`; }
function capHeight(ctx) { const m = ctx.measureText("H"); return m.actualBoundingBoxAscent || parseFloat(ctx.font.match(/(\d+(\.\d+)?)px/)[1]) * 0.7; }

function trackedWidth(ctx, text, track, size) {
  if (!track) return ctx.measureText(text).width;
  let w = 0; for (const ch of text) w += ctx.measureText(ch).width + track * size; return w - track * size;
}
function drawTracked(ctx, text, x, y, track, size, align) {
  const w = trackedWidth(ctx, text, track, size);
  let sx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  ctx.textAlign = "left";
  if (!track) { ctx.fillText(text, sx, y); return; }
  for (const ch of text) { ctx.fillText(ch, sx, y); sx += ctx.measureText(ch).width + track * size; }
}
function setTitleTracking(ctx, f, size) { if ("letterSpacing" in ctx) ctx.letterSpacing = (f.track || 0) * size + "px"; }
function clearTracking(ctx) { if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"; }

function wrapPlain(ctx, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean); const lines = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width <= maxW || !line) line = t; else { lines.push(line); line = w; } }
  if (line) lines.push(line); return lines;
}
function fitTitle(ctx, text, maxW, maxLines, maxSize, minSize, f) {
  let last;
  for (let s = maxSize; s >= minSize; s -= 2) {
    ctx.font = fontStr(f, s); setTitleTracking(ctx, f, s);
    const lines = wrapPlain(ctx, text, maxW);
    last = { size: s, lines };
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) break;
  }
  clearTracking(ctx); return last;
}

// Rich blurb: *emphasis* toggles accent colour. A word is a list of parts, so "*phrase*." keeps
// its full stop attached (uncoloured) instead of becoming a separate word.
function parseRich(text) {
  const paras = text.replace(/\r/g, "").split("\n");
  return paras.map(p => {
    const words = []; let em = false, glue = false;
    p.split(/(\*)/).forEach(part => {
      if (part === "*") { em = !em; return; }
      part.split(/(\s+)/).forEach((t, i) => {
        if (!t) return;
        if (/^\s+$/.test(t)) { glue = false; return; }
        if (glue && i === 0 && words.length) words[words.length - 1].parts.push({ t, em });
        else words.push({ parts: [{ t, em }] });
        glue = true;
      });
    });
    return words;
  });
}
function wrapRich(ctx, paras, maxW) {
  const space = ctx.measureText(" ").width; const lines = [];
  for (const words of paras) {
    if (!words.length) { lines.push({ words: [], w: 0 }); continue; }
    let cur = [], w = 0;
    for (const word of words) {
      for (const pt of word.parts) pt.w = ctx.measureText(pt.t).width;
      const ww = word.parts.reduce((a, pt) => a + pt.w, 0); word.w = ww;
      const nw = cur.length ? w + space + ww : ww;
      if (nw > maxW && cur.length) { lines.push({ words: cur, w }); cur = [word]; w = ww; } else { cur.push(word); w = nw; }
    }
    lines.push({ words: cur, w });
  }
  return { lines, space };
}

function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function starPath(ctx, cx, cy, R) {
  const r = R * 0.43; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rad = i % 2 ? r : R; ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
  ctx.closePath();
}

let grainTile = null;
function getGrain() {
  if (grainTile) return grainTile;
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d");
  const id = x.createImageData(256, 256);
  // a fixed seed, so the same project renders the same grain on every load and in every export
  let seed = 0x9e3779b9; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (rnd() - 0.5) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  x.putImageData(id, 0, 0); return (grainTile = c);
}

/* ---------------- text blocks ---------------- */
const P = () => PRESETS[state.preset] || PRESETS.criterion;

function metaText() {
  const dir = state.directorIn === "top" ? state.director : "";
  return [state.year, dir, state.runtime, state.genre].map(s => (s || "").trim()).filter(Boolean).join("   ·   ");
}

// Billing block: the small credit lines under a film poster, DIR. and CAST, labels dimmer than the names.
// Names drop from the end (the type never shrinks) when a line runs wider than the column.
const BILL_SIZE = 17, BILL_GAP = 12;
function buildBilling(ctx, width) {
  const p = P(), items = []; let h = 0;
  const track = p.label.track * 0.55, sp = BILL_SIZE * 0.7;
  ctx.font = fontStr(p.label, BILL_SIZE);
  const line = (label, names) => {
    for (let n = names.length; n >= 1; n--) {
      const text = names.slice(0, n).join("  ·  ").toUpperCase();
      if (trackedWidth(ctx, label, track, BILL_SIZE) + sp + trackedWidth(ctx, text, track, BILL_SIZE) <= width || n === 1) return text;
    }
    return "";
  };
  const dir = state.directorIn !== "top" && (state.director || "").trim();
  const cast = state.show.cast ? (state.cast || "").split(/\s*(?:,|·|&|\band\b)\s*/i).map(s => s.trim()).filter(Boolean) : [];
  if (dir) { items.push({ kind: "bill", label: "DIR.", names: line("DIR.", [dir]), size: BILL_SIZE, track, sp, y: h }); h += BILL_SIZE; }
  if (cast.length) { if (h) h += BILL_GAP; items.push({ kind: "bill", label: "CAST", names: line("CAST", cast), size: BILL_SIZE, track, sp, y: h }); h += BILL_SIZE; }
  return { h, items };
}

function buildTop(ctx, width, { maxLines = 2, cap = 120, rule = false } = {}) {
  const p = P(); const items = []; let h = 0;
  const kick = state.show.kicker && (state.kicker || "").trim();
  if (kick) { items.push({ kind: "label", text: kick.toUpperCase(), size: 22, color: state.accent, track: p.label.track, y: h }); h += 22 + 26; }
  const raw = (state.title || "").trim() || "Untitled";
  const fit = fitTitle(ctx, p.title.upper ? raw.toUpperCase() : raw, width, maxLines, Math.min(p.title.max, cap), 34, p.title);
  const lh = fit.size * p.title.lh;
  items.push({ kind: "title", lines: fit.lines, size: fit.size, lh, y: h }); h += fit.lines.length * lh;
  const meta = state.show.meta && metaText();
  if (meta) {
    ctx.font = fontStr(p.label, 19);
    let txt = meta.toUpperCase(); const tr = p.label.track * 0.6;
    while (trackedWidth(ctx, txt, tr, 19) > width && txt.includes("·")) txt = txt.slice(0, txt.lastIndexOf("·")).trim();
    h += 24; items.push({ kind: "label", text: txt, size: 19, color: "rgba(255,255,255,0.72)", track: tr, y: h }); h += 19;
  }
  if (rule) { h += 34; items.push({ kind: "rule", y: h }); h += 3; }
  return { h, items };
}

function buildBottom(ctx, width, maxH, { billing = false } = {}) {
  const p = P(); const items = []; let h = 0;
  const bill = billing ? buildBilling(ctx, width) : { h: 0, items: [] };
  if (bill.h) maxH -= bill.h + 30;
  const hasStars = state.show.stars && +state.rating > 0;
  const handle = state.show.handle && state.handlePos === "with" && (state.handle || "").trim();
  if (hasStars) { items.push({ kind: "stars", size: 34, y: h }); h += 34; }
  const reserveHandle = handle ? 30 + 18 : 0;
  const blurb = state.show.blurb && (state.blurb || "").trim();
  if (blurb) {
    if (hasStars) h += 28;
    const avail = Math.max(60, maxH - h - reserveHandle);
    const paras = parseRich(blurb); let fit;
    const minSize = Math.round(p.body.max * 0.8); // below this it's unreadable on a phone
    for (let s = p.body.max; s >= minSize; s -= 1) {
      ctx.font = fontStr(p.body, s);
      const wr = wrapRich(ctx, paras, width); const bh = (wr.lines.length - 1) * s * p.body.lh + s;
      fit = { ...wr, size: s, lh: s * p.body.lh, bh };
      if (bh <= avail) break;
    }
    tooLong = fit.bh > avail;
    items.push({ kind: "blurb", ...fit, y: h }); h += fit.bh;
  }
  if (bill.h) { if (h) h += 30; for (const it of bill.items) items.push({ ...it, y: h + it.y }); h += bill.h; }
  if (handle) { if (h) h += 30; items.push({ kind: "label", text: handle, size: 18, color: "rgba(255,255,255,0.5)", track: P().label.track * 0.4, y: h, upper: false }); h += 18; }
  return { h, items };
}

function drawBlock(ctx, block, x, y, align) {
  const p = P();
  ctx.textBaseline = "alphabetic";
  for (const it of block.items) {
    const top = y + it.y;
    if (it.kind === "label") {
      ctx.font = fontStr(p.label, it.size); ctx.fillStyle = it.color;
      const base = top + it.size / 2 + capHeight(ctx) / 2;
      drawTracked(ctx, it.text, x, base, it.track, it.size, align);
    } else if (it.kind === "title") {
      ctx.save();
      ctx.font = fontStr(p.title, it.size); setTitleTracking(ctx, p.title, it.size);
      ctx.fillStyle = "#ffffff"; ctx.textAlign = align;
      ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 30 * K; ctx.shadowOffsetY = 4 * K;
      const ch = capHeight(ctx);
      it.lines.forEach((ln, i) => {
        const base = top + i * it.lh + it.lh / 2 + ch / 2;
        if (state.chrome) drawChromeText(ctx, ln, x, base, it.size, ch, align, i === 0);
        else ctx.fillText(ln, x, base);
      });
      ctx.restore(); clearTracking(ctx);
    } else if (it.kind === "bill") {
      ctx.font = fontStr(p.label, it.size);
      const lw = trackedWidth(ctx, it.label, it.track, it.size), total = lw + it.sp + trackedWidth(ctx, it.names, it.track, it.size);
      const sx = align === "center" ? x - total / 2 : align === "right" ? x - total : x, base = top + it.size / 2 + capHeight(ctx) / 2;
      ctx.fillStyle = "rgba(255,255,255,0.42)"; drawTracked(ctx, it.label, sx, base, it.track, it.size, "left");
      ctx.fillStyle = "rgba(255,255,255,0.8)"; drawTracked(ctx, it.names, sx + lw + it.sp, base, it.track, it.size, "left");
    } else if (it.kind === "rule") {
      ctx.fillStyle = state.accent; const w = 56;
      ctx.fillRect(align === "center" ? x - w / 2 : align === "right" ? x - w : x, top, w, 3);
    } else if (it.kind === "stars") {
      const s = it.size, gap = s * 0.3, total = 5 * s + 4 * gap;
      let sx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
      const r = +state.rating;
      for (let i = 0; i < 5; i++) {
        const cx = sx + s / 2, cy = top + s / 2 + 1;
        starPath(ctx, cx, cy, s / 2); ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fill();
        const fill = Math.max(0, Math.min(1, r - i));
        if (fill > 0) { ctx.save(); ctx.beginPath(); ctx.rect(sx - 2, top - 2, (s + 4) * fill, s + 6); ctx.clip(); starPath(ctx, cx, cy, s / 2); ctx.fillStyle = state.accent; ctx.fill(); ctx.restore(); }
        sx += s + gap;
      }
    } else if (it.kind === "blurb") {
      ctx.font = fontStr(p.body, it.size); ctx.textAlign = "left";
      it.lines.forEach((ln, i) => {
        const base = top + i * it.lh + it.size * 0.8;
        let sx = align === "center" ? x - ln.w / 2 : align === "right" ? x - ln.w : x;
        for (const w of ln.words) {
          for (const pt of w.parts) {
            ctx.fillStyle = pt.em ? state.accent : "rgba(255,255,255,0.9)";
            ctx.fillText(pt.t, sx, base); sx += pt.w;
          }
          sx += it.space;
        }
      });
    }
  }
}

/* ---------------- chrome title ---------------- */
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
// Polished-metal lettering: a dark drop shadow, a stepped 3D extrusion down-right, a mirror face whose
// "horizon" reflects the poster's accent colour, a bright bevel along the top edges, and one glint.
function drawChromeText(ctx, text, x, y, size, capH, align, glint) {
  const depth = Math.max(5, size * 0.085), steps = Math.ceil(depth / 0.9);
  const top = y - capH, acc = state.accent || "#9fb3c8";
  ctx.save();
  ctx.textAlign = align;
  // grounding shadow
  ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 36 * K; ctx.shadowOffsetY = 18 * K;
  ctx.fillStyle = "#000"; ctx.fillText(text, x + depth * 0.55, y + depth);
  ctx.shadowColor = "transparent";
  // extrusion, back to front; deeper layers darker
  for (let i = steps; i >= 1; i--) {
    const t = i / steps, ox = depth * t * 0.55, oy = depth * t;
    const g = ctx.createLinearGradient(0, top + oy, 0, y + oy);
    g.addColorStop(0, mixHex("#c4ccd3", "#1b1f24", t * 0.7));
    g.addColorStop(0.45, mixHex("#4a525a", "#0c0e11", t * 0.7));
    g.addColorStop(0.62, mixHex(mixHex("#d9dee2", acc, 0.35), "#15181c", t * 0.7));
    g.addColorStop(1, mixHex("#7d868e", "#0c0e11", t * 0.7));
    ctx.fillStyle = g; ctx.fillText(text, x + ox, y + oy);
  }
  // bevel: a bright copy nudged up-left peeks out along the top edges once the face covers it
  ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillText(text, x - size * 0.006, y - size * 0.014);
  // mirror face
  const f = ctx.createLinearGradient(0, top, 0, y + size * 0.04);
  f.addColorStop(0, "#ffffff");
  f.addColorStop(0.2, "#e3e8ec");
  f.addColorStop(0.44, "#8b959e");
  f.addColorStop(0.5, "#262b31");
  f.addColorStop(0.53, mixHex(acc, "#ffffff", 0.25));
  f.addColorStop(0.68, mixHex("#c9d0d6", acc, 0.18));
  f.addColorStop(0.86, "#f7f9fa");
  f.addColorStop(1, "#a7b0b8");
  ctx.fillStyle = f; ctx.fillText(text, x, y);
  // a single star glint near the first letter
  if (glint) {
    const w = ctx.measureText(text).width;
    const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    const gx = left + Math.min(w * 0.08, size * 0.35), gy = top + capH * 0.08, r = size * 0.32;
    ctx.globalCompositeOperation = "lighter";
    const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 0.35);
    rg.addColorStop(0, "rgba(255,255,255,0.9)"); rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(gx, gy, r * 0.35, 0, Math.PI * 2); ctx.fill();
    for (const [dx, dy, len] of [[1, 0, r], [0, 1, r * 0.7]]) {
      const lg = ctx.createLinearGradient(gx - dx * len, gy - dy * len, gx + dx * len, gy + dy * len);
      lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255,0.95)"); lg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(dx ? gx - len : gx - size * 0.008, dy ? gy - len : gy - size * 0.008, dx ? len * 2 : size * 0.016, dy ? len * 2 : size * 0.016);
    }
  }
  ctx.restore();
}

/* ---------------- poster + backdrop ---------------- */
function drawPoster(ctx, x, y, w, h) {
  const r = +state.poster.radius;
  ctx.save();
  if (+state.poster.glow > 0) {
    ctx.shadowColor = rgba(state.accent, 0.6 * state.poster.glow); ctx.shadowBlur = 150 * K; ctx.fillStyle = "#000";
    rrect(ctx, x, y, w, h, r); ctx.fill();
  }
  if (+state.poster.shadow > 0) {
    ctx.shadowColor = `rgba(0,0,0,${0.75 * state.poster.shadow})`; ctx.shadowBlur = 90 * K; ctx.shadowOffsetY = 34 * K; ctx.fillStyle = "#000";
    rrect(ctx, x, y, w, h, r); ctx.fill();
  }
  ctx.restore();
  ctx.save(); rrect(ctx, x, y, w, h, r); ctx.clip();
  if (posterCanvas) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(posterCanvas, x, y, w, h); }
  else { ctx.fillStyle = "#26232a"; ctx.fillRect(x, y, w, h); }
  ctx.restore();
  if (state.poster.border) { ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1.5; rrect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.max(0, r - 0.75)); ctx.stroke(); }
}

function drawBackdrop(ctx) {
  const Wd = ctx.canvas.width, Hd = ctx.canvas.height, b = state.bg;
  ctx.fillStyle = baseColor; ctx.fillRect(0, 0, Wd, Hd);
  const src = bgImage || posterCanvas; if (!src) return;
  // Blur at quarter resolution: same look, far faster, then upscale smoothly.
  const q = b.blur > 8 ? 0.25 : 1;
  const ow = Math.max(2, Math.round(Wd * q)), oh = Math.max(2, Math.round(Hd * q));
  const off = document.createElement("canvas"); off.width = ow; off.height = oh;
  const o = off.getContext("2d"); o.fillStyle = baseColor; o.fillRect(0, 0, ow, oh);
  const blurPx = b.blur * K * q, pad = blurPx * 2.4;
  const iw = src.width, ih = src.height;
  const s = Math.max((ow + pad * 2) / iw, (oh + pad * 2) / ih) * b.zoom;
  const dw = iw * s, dh = ih * s, dx = (ow - dw) / 2, dy = (oh - dh) / 2 + (+b.shift) * (dh - oh - pad * 2) / 2;
  o.imageSmoothingQuality = "high";
  if (FILTER_OK) { o.filter = `blur(${blurPx}px) saturate(${b.sat})`; o.drawImage(src, dx, dy, dw, dh); o.filter = "none"; }
  else {
    // fallback: progressive downsample blur
    const f = Math.max(1, blurPx / 2), tw = Math.max(4, Math.round(ow / f)), th = Math.max(4, Math.round(oh / f));
    const t = document.createElement("canvas"); t.width = tw; t.height = th; const tx = t.getContext("2d");
    tx.drawImage(src, dx / f, dy / f, dw / f, dh / f); o.imageSmoothingEnabled = true; o.drawImage(t, 0, 0, ow, oh);
  }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(off, 0, 0, Wd, Hd);
}

function drawShades(ctx, W, H, layout) {
  const b = state.bg;
  ctx.fillStyle = `rgba(6,5,8,${b.dark})`; ctx.fillRect(0, 0, W, H);
  if (+b.tint > 0) {
    ctx.save(); ctx.globalCompositeOperation = "soft-light"; ctx.globalAlpha = +b.tint * 1.6; ctx.fillStyle = state.accent; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  if (+b.vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2 * 1.05);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${0.85 * b.vignette})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (layout === "stacked") {
      const t = ctx.createLinearGradient(0, 0, 0, H * 0.3); t.addColorStop(0, `rgba(0,0,0,${0.5 * b.vignette})`); t.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = t; ctx.fillRect(0, 0, W, H * 0.3);
      const bt = ctx.createLinearGradient(0, H * 0.6, 0, H); bt.addColorStop(0, "rgba(0,0,0,0)"); bt.addColorStop(1, `rgba(0,0,0,${0.6 * b.vignette})`);
      ctx.fillStyle = bt; ctx.fillRect(0, H * 0.6, W, H * 0.4);
    } else {
      const side = ctx.createLinearGradient(0, 0, W, 0);
      side.addColorStop(0, `rgba(0,0,0,${0.25 * b.vignette})`); side.addColorStop(0.5, "rgba(0,0,0,0)"); side.addColorStop(1, `rgba(0,0,0,${0.45 * b.vignette})`);
      ctx.fillStyle = side; ctx.fillRect(0, 0, W, H);
    }
  }
}

function drawGrain(ctx) {
  if (!(+state.bg.grain > 0)) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = +state.bg.grain;
  ctx.fillStyle = ctx.createPattern(getGrain(), "repeat"); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/* ---------------- layouts ---------------- */
function resolveLayout(W, H) {
  if (state.layout !== "auto") return state.layout;
  return W > H ? "split" : "stacked";
}

function planLayout(ctx, W, H) {
  let layout = resolveLayout(W, H);
  const pad = Math.round(Math.min(W, H) * 0.075);
  const scale = +state.poster.scale;

  const wide = W > H * 1.15;

  if (layout === "split" && !wide) {
    // title across the top (left-aligned), then poster left with the paragraph beside it
    return { layout, shade: "stacked", draw: () => {
      const gap = Math.round(H * 0.035), gut = 52;
      const top = buildTop(ctx, W - 2 * pad, { maxLines: 2, cap: 112, rule: true });
      const rowH = H - 2 * pad - top.h - gap;
      let ph = rowH * scale, pw = ph * 2 / 3;
      const maxPw = (W - 2 * pad - gut) * 0.56;
      if (pw > maxPw) { pw = maxPw; ph = pw * 1.5; }
      const y0 = Math.max(pad, (H - (top.h + gap + ph)) / 2);
      const py = y0 + top.h + gap, cx = pad + pw + gut, colW = W - pad - cx;
      drawPoster(ctx, pad, py, pw, ph);
      drawBlock(ctx, top, pad, y0, "left");
      const bottom = buildBottom(ctx, colW, ph, { billing: true });
      drawBlock(ctx, bottom, cx, py + ph - bottom.h, "left");
    } };
  }

  if (layout === "triptych" && !wide) {
    // poster first, then title and paragraph underneath, like a festival programme card
    return { layout, shade: "stacked", draw: () => {
      const pad2 = Math.round(Math.min(W, H) * 0.065), gap = Math.round(H * 0.03), colW = Math.min(W - 2 * pad2, 940);
      const top = buildTop(ctx, colW, { maxLines: 2, cap: 100 });
      const bottom = buildBottom(ctx, Math.min(colW, 860), H * 0.24);
      const bill = buildBilling(ctx, colW), billH = bill.h ? bill.h + BILL_GAP * 2 : 0;
      const avail = H - 2 * pad2 - top.h - bottom.h - 2 * gap - billH;
      const ph = Math.min(avail, (W - 2 * pad2) * 1.5) * scale, pw = ph * 2 / 3;
      const py = pad2 + (avail - ph) / 2;
      drawPoster(ctx, W / 2 - pw / 2, py, pw, ph);
      if (bill.h) { drawBlock(ctx, bill, W / 2, py + ph + BILL_GAP * 2, "center"); }
      drawBlock(ctx, top, W / 2, py + ph + billH + gap, "center");
      drawBlock(ctx, bottom, W / 2, H - pad2 - bottom.h, "center");
    } };
  }

  if (layout === "triptych") {
    const ph = (H - 2 * pad) * scale, pw = ph * 2 / 3, gut = 60;
    const px = (W - pw) / 2, py = (H - ph) / 2;
    const leftW = px - gut - pad, rightW = W - (px + pw + gut) - pad;
    if (leftW >= 240) {
      return { layout, shade: "side", draw: () => {
        drawPoster(ctx, px, py, pw, ph);
        const top = buildTop(ctx, leftW, { maxLines: 4, cap: 92, rule: true });
        drawBlock(ctx, top, px - gut, py + 4, "right");
        const bottom = buildBottom(ctx, rightW, ph, { billing: true });
        drawBlock(ctx, bottom, px + pw + gut, py + ph - bottom.h, "left");
      } };
    }
    layout = "stacked";
  }

  if (layout === "split") {
    const ph = (H - 2 * pad) * scale, pw = ph * 2 / 3, gut = Math.round(Math.min(W, H) * 0.075);
    const colW = Math.min(W - 2 * pad - pw - gut, 780);
    if (colW >= 300) {
      const x0 = (W - (pw + gut + colW)) / 2, py = (H - ph) / 2, cx = x0 + pw + gut;
      return { layout, shade: "side", draw: () => {
        drawPoster(ctx, x0, py, pw, ph);
        const top = buildTop(ctx, colW, { maxLines: 3, cap: 116, rule: true });
        drawBlock(ctx, top, cx, py + 4, "left");
        const bottom = buildBottom(ctx, Math.min(colW, 700), ph - top.h - 70, { billing: true });
        drawBlock(ctx, bottom, cx, py + ph - bottom.h, "left");
      } };
    }
    layout = "stacked";
  }

  // stacked: slightly tighter margins so the poster gets the room
  return { layout: "stacked", shade: "stacked", draw: () => {
    const pad = Math.round(Math.min(W, H) * 0.065);
    const gap = Math.round(H * 0.03), colW = Math.min(W - 2 * pad, 940);
    const top = buildTop(ctx, colW, { maxLines: 2, cap: H / W > 1.5 ? 124 : 108 });
    const posterMin = H * (H / W > 1.5 ? 0.5 : 0.47);
    // with credits under the poster, the poster gives up a little height so the column can breathe
    const bill = buildBilling(ctx, colW), billH = bill.h ? bill.h + BILL_GAP * 2 + Math.round(H * 0.025) : 0;
    const bottom = buildBottom(ctx, Math.min(colW, 860), H - 2 * pad - top.h - 2 * gap - posterMin - billH);
    const avail = H - 2 * pad - top.h - bottom.h - 2 * gap - billH;
    const ph = Math.min(avail, (W - 2 * pad) * 1.5) * scale, pw = ph * 2 / 3;
    // Even rhythm: the same gap above the poster, between poster and credits, and below the credits.
    const free = H - 2 * pad - top.h - bottom.h - ph - bill.h;
    const b = bill.h ? free / 3 : 0;
    const above = bill.h ? free / 3 : free / 2;
    const py = pad + top.h + above;
    drawPoster(ctx, W / 2 - pw / 2, py, pw, ph);
    if (bill.h) drawBlock(ctx, bill, W / 2, py + ph + b, "center");
    drawBlock(ctx, top, W / 2, pad, "center");
    drawBlock(ctx, bottom, W / 2, H - pad - bottom.h, "center");
  } };
}

function render(canvas, outW) {
  const R = RATIOS[state.ratio] || RATIOS["3:4"]; const W = R.w, H = R.h;
  K = outW / W; tooLong = false;
  canvas.width = Math.round(W * K); canvas.height = Math.round(H * K);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackdrop(ctx);
  drawGrain(ctx);
  ctx.setTransform(K, 0, 0, K, 0, 0);
  const plan = planLayout(ctx, W, H);
  drawShades(ctx, W, H, plan.shade);
  plan.draw();
  drawCornerHandle(ctx, W, H);
  return plan.layout;
}
// Handle in a corner or edge centre, in the margin outside the text (which keeps a 6.5% inset).
const HANDLE_POS = { with: "With text", tl: "Top left", tc: "Top centre", tr: "Top right", bl: "Bottom left", bc: "Bottom centre", br: "Bottom right" };
function drawCornerHandle(ctx, W, H) {
  const pos = state.handlePos, text = state.show.handle && (state.handle || "").trim();
  if (!text || !HANDLE_POS[pos] || pos === "with") return;
  const m = Math.round(Math.min(W, H) * 0.035), size = 18;
  const align = pos[1] === "l" ? "left" : pos[1] === "r" ? "right" : "center";
  ctx.font = fontStr(P().label, size); ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.textBaseline = "alphabetic";
  const y = pos[0] === "t" ? m + capHeight(ctx) : H - m;
  drawTracked(ctx, text, align === "left" ? m : align === "right" ? W - m : W / 2, y, P().label.track * 0.4, size, align);
}

/* ---------------- preview ---------------- */
const preview = document.getElementById("preview"), wrap = document.getElementById("wrap");
let raf = 0, saveTimer = 0;
function schedule() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; renderPreview(); });
  clearTimeout(thumbTimer); thumbTimer = setTimeout(renderThumbs, 250);
  clearTimeout(saveTimer); saveTimer = setTimeout(save, 400);
}
function renderPreview() {
  const R = RATIOS[state.ratio]; const box = wrap.getBoundingClientRect();
  const s = Math.min((box.width - 40) / R.w, (box.height - 40) / R.h);
  const cw = Math.max(80, Math.floor(R.w * s)), dpr = Math.min(window.devicePixelRatio || 1, 2);
  preview.style.width = cw + "px"; preview.style.height = Math.round(cw * R.h / R.w) + "px";
  const ew = +state.export.width, eh = Math.round(ew * R.h / R.w);
  if (coverOn()) {
    window.Cover.render(preview, cw * dpr);
    const out = window.Cover.moving() ? `<b>1080 × ${Math.round(1080 * R.h / R.w)}</b> MP4, ${window.Cover.loopSec()} s loop` : `<b>${ew} × ${eh}</b>`;
    document.getElementById("specs").innerHTML = `<b>${state.ratio}</b> ${R.name} · Cover · ${window.Cover.designName()} · exports ${out}`;
    return;
  }
  const used = render(preview, cw * dpr);
  const slideInfo = document.body.dataset.mode === "carousel" ? ` · slide <b>${cur + 1}/${deck.length}</b>` : "";
  document.getElementById("specs").innerHTML =
    `<b>${state.ratio}</b> ${R.name} · ${LAYOUTS[used].name}${slideInfo} · exports <b>${ew} × ${eh}</b>`;
  document.documentElement.style.setProperty("--accent", state.accent || "#e9b65a");
  updateWordCount();
}
new ResizeObserver(() => schedule()).observe(wrap);

let frozen = false; // set while a project file replaces everything, so nothing old gets written back
function save() {
  if (frozen) return;
  saveDeck();
  try {
    const { palette, ...rest } = state;
    localStorage.setItem(STORE_KEY, JSON.stringify(rest));
  } catch (e) { /* ignore */ }
}

/* ---------------- controls ---------------- */
const FMT = {
  "bg.zoom": v => (+v).toFixed(2) + "×", "bg.shift": v => (v > 0 ? "+" : "") + Math.round(v * 100), "bg.blur": v => v + " px",
  "bg.dark": v => Math.round(v * 100) + "%", "bg.sat": v => Math.round(v * 100) + "%", "bg.tint": v => Math.round(v * 100) + "%",
  "bg.vignette": v => Math.round(v * 100) + "%", "bg.grain": v => Math.round(v * 100) + "%",
  "poster.scale": v => Math.round(v * 100) + "%", "poster.radius": v => v + " px", "poster.shadow": v => Math.round(v * 100) + "%", "poster.glow": v => Math.round(v * 100) + "%",
};
const starText = r => r <= 0 ? "none" : "★".repeat(Math.floor(r)) + (r % 1 ? "½" : "");

function syncInputs() {
  document.querySelectorAll("[data-k]").forEach(el => {
    const v = getPath(state, el.dataset.k);
    if (el.type === "checkbox") el.checked = !!v; else if (document.activeElement !== el) el.value = v ?? "";
  });
  document.querySelectorAll("output[data-for]").forEach(o => { o.textContent = FMT[o.dataset.for](getPath(state, o.dataset.for)); });
  document.getElementById("ratingOut").textContent = starText(+state.rating);
  updateWordCount();
  renderSegs();
}
function updateWordCount() {
  const n = (state.blurb || "").replace(/\*/g, "").split(/\s+/).filter(Boolean).length;
  const el = document.getElementById("wc");
  const hasEm = /\*[^*]+\*/.test(state.blurb || "");
  let note = n === 0 ? "" : tooLong ? "too long to fit, trim it" : n > 50 ? "aim for 30–50" : n < 20 ? "a bit short" : hasEm ? "good length" : "good length · no highlight yet";
  el.textContent = `${n} words` + (note ? ` · ${note}` : "");
  el.className = tooLong || n > 50 ? "warn" : "";
}

document.querySelectorAll("[data-k]").forEach(el => {
  el.addEventListener("input", () => {
    const k = el.dataset.k;
    let v = el.type === "checkbox" ? el.checked : el.type === "range" ? +el.value : el.value;
    setPath(state, k, v);
    // the cover panel and the slide panel share some fields (the handle); keep the twin in step
    document.querySelectorAll(`[data-k="${k}"]`).forEach(o => { if (o !== el) { if (o.type === "checkbox") o.checked = !!v; else o.value = v; } });
    if (el.type === "range") { const o = document.querySelector(`output[data-for="${k}"]`); if (o) o.textContent = FMT[k](v); }
    if (k === "rating") document.getElementById("ratingOut").textContent = starText(v);
    if (k === "blurb") updateWordCount();
    if (k !== "export.format") schedule(); else save();
  });
});

// Wraps the selected phrase in *asterisks* (accent colour). One highlight per post reads best, so old ones are cleared.
document.getElementById("highlight").addEventListener("click", () => {
  const ta = document.getElementById("blurb"); const { selectionStart: a, selectionEnd: b, value } = ta;
  if (a === b) { toast("Select a phrase in the paragraph first, then click Highlight."); ta.focus(); return; }
  const strip = t => t.replace(/\*/g, "");
  let pre = value.slice(0, a), mid = value.slice(a, b), post = value.slice(b);
  const lead = mid.match(/^\s*/)[0], trail = mid.match(/\s*$/)[0];
  mid = strip(mid).trim();
  pre = strip(pre); post = strip(post);
  state.blurb = `${pre}${lead}*${mid}*${trail}${post}`;
  ta.value = state.blurb; ta.focus();
  const start = pre.length + lead.length; ta.setSelectionRange(start, start + mid.length + 2);
  schedule();
});

function seg(containerId, entries, key, label) {
  const c = document.getElementById(containerId); c.innerHTML = "";
  for (const [id, meta] of entries) {
    const b = document.createElement("button"); b.type = "button";
    b.setAttribute("aria-pressed", String(state[key] === id));
    b.innerHTML = label(id, meta);
    b.addEventListener("click", () => { state[key] = id; renderSegs(); schedule(); });
    c.appendChild(b);
  }
}
function renderSegs() {
  seg("directorInSeg", [["billing", "Under the poster"], ["top", "Top line"]], "directorIn", (id, name) => name);
  seg("handlePosSeg", Object.entries(HANDLE_POS), "handlePos", (id, name) => name);
  seg("ratioSeg", Object.entries(RATIOS), "ratio", (id, m) => `${id}<small>${m.name}</small>`);
  seg("layoutSeg", Object.entries(LAYOUTS), "layout", (id, m) => `${m.name}<small>${isWide() ? m.wide : m.tall}</small>`);
  const g = document.getElementById("presetGrid"); g.innerHTML = "";
  for (const [id, p] of Object.entries(PRESETS)) {
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-pressed", String(state.preset === id));
    const sp = document.createElement("span");
    sp.style.font = `${p.title.style} ${p.title.weight} 24px "${p.title.family}", ${p.title.fb}`;
    if (p.title.upper) sp.style.textTransform = "uppercase";
    if (id === "zine") sp.className = "chrome-chip";
    sp.textContent = p.name;
    const sm = document.createElement("small"); sm.textContent = `${p.note} · ${p.body.family}`;
    b.append(sp, sm);
    b.addEventListener("click", () => { state.preset = id; state.chrome = id === "zine"; syncInputs(); schedule(); });
    g.appendChild(b);
  }
}

function renderSwatches() {
  const c = document.getElementById("swatches"); c.innerHTML = "";
  (state.palette || []).forEach(hex => {
    const b = document.createElement("button"); b.type = "button"; b.style.background = hex; b.title = hex; b.setAttribute("aria-label", `Accent ${hex}`);
    b.setAttribute("aria-pressed", String(hex === state.accent));
    b.addEventListener("click", () => { state.accent = hex; renderSwatches(); schedule(); });
    c.appendChild(b);
  });
  const pick = document.createElement("input"); pick.type = "color"; pick.id = "accentPick"; pick.title = "Custom accent"; pick.setAttribute("aria-label", "Custom accent colour");
  pick.value = state.accent || "#e9b65a";
  pick.addEventListener("input", () => { state.accent = pick.value; schedule(); });
  pick.addEventListener("change", renderSwatches);
  c.appendChild(pick);
}

function renderSamples() {
  const c = document.getElementById("samples"); c.innerHTML = "";
  const data = window.SAMPLE_POSTERS || {};
  for (const id of Object.keys(SAMPLES)) {
    if (!data[id]) continue;
    const b = document.createElement("button"); b.type = "button"; b.title = SAMPLES[id].title;
    b.setAttribute("aria-pressed", String(state.sample === id)); b.setAttribute("aria-label", `Load example: ${SAMPLES[id].title}`);
    const img = document.createElement("img"); img.src = data[id]; img.alt = "";
    b.appendChild(img);
    b.addEventListener("click", async () => {
      Object.assign(state, clone(SAMPLES[id])); state.sample = id;
      bgImage = null; document.getElementById("clearBg").hidden = true;
      renderSamples(); syncInputs();
      await setPoster(data[id], { persist: false });
      idbPut(`deck:${deck[cur].id}`, null); idbPut(`deck:${deck[cur].id}:bg`, null);
    });
    c.appendChild(b);
  }
}

/* ---------------- files, drop, paste ---------------- */
document.getElementById("posterFile").addEventListener("change", e => { usePosterFile(e.target.files[0]); e.target.value = ""; });
document.getElementById("bgFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  const url = await readFile(f); bgImage = await loadImage(url); document.getElementById("clearBg").hidden = false;
  idbPut(`deck:${deck[cur].id}:bg`, url);
  toast("Backdrop now uses your still. The poster stays in front."); schedule();
});
document.getElementById("clearBg").addEventListener("click", e => { bgImage = null; e.currentTarget.hidden = true; idbPut(`deck:${deck[cur].id}:bg`, null); schedule(); });

const veil = document.getElementById("veil"); let dragDepth = 0;
const takeImage = f => { if (isProjectFile(f)) openProject(f); else if (coverOn()) window.Cover.takeFile(f); else usePosterFile(f); };
window.addEventListener("dragenter", e => { if ([...e.dataTransfer.types].includes("Files")) { veil.textContent = coverOn() ? "Drop to use as the cover still" : "Drop to use as poster"; dragDepth++; veil.hidden = false; } });
window.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; veil.hidden = true; } });
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => { e.preventDefault(); dragDepth = 0; veil.hidden = true; if (e.dataTransfer.files[0]) takeImage(e.dataTransfer.files[0]); });
window.addEventListener("paste", e => {
  const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith("image/"));
  if (f) { e.preventDefault(); takeImage(f); }
});

/* ---------------- export ---------------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
// Minimal "stored" (uncompressed) zip; PNG/JPG are already compressed.
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(12, 33, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true);
    parts.push(lh, name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(14, 33, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(ch, name); offset += 30 + name.length + size;
  }
  const csize = central.reduce((a, p) => a + p.byteLength, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
const slug = s => (s || "post").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
let toastTimer;
function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.textContent = ""), 4000); }

function saveBlob(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const mb = n => (n / 1048576).toFixed(1) + " MB";
document.getElementById("download").addEventListener("click", async () => {
  const c = document.createElement("canvas"), cov = coverOn();
  if (cov && window.Cover.moving()) {
    const btn = document.getElementById("download"); btn.disabled = true;
    try {
      const blob = await window.Cover.video(f => { btn.textContent = `Rendering video ${Math.round(f * 100)}%`; });
      saveBlob(blob, `${slug(window.Cover.title() + "-cover")}-${state.ratio.replace(":", "x")}.mp4`);
      toast(`Saved a ${window.Cover.loopSec()} s looping MP4 (${mb(blob.size)}).`);
    } catch (e) { console.error(e); toast(`Video export failed: ${e?.message || e}`); }
    btn.disabled = false; btn.textContent = "Download post"; return;
  }
  if (cov) window.Cover.render(c, +state.export.width); else render(c, +state.export.width);
  const fmt = state.export.format === "jpeg" ? "image/jpeg" : "image/png";
  c.toBlob(blob => {
    if (!blob) { toast("Export failed. Try PNG, or a smaller export width."); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${slug(cov ? window.Cover.title() + "-cover" : state.title)}-${state.ratio.replace(":", "x")}.${fmt === "image/png" ? "png" : "jpg"}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast(`Saved ${c.width} × ${c.height} ${fmt === "image/png" ? "PNG" : "JPG"}.`);
  }, fmt, 0.95);
});

document.getElementById("downloadAll").addEventListener("click", async () => {
  const btn = document.getElementById("downloadAll"), fmt = state.export.format === "jpeg" ? "image/jpeg" : "image/png", ext = fmt === "image/png" ? "png" : "jpg";
  btn.disabled = true; const files = [];
  const withCover = !!window.Cover?.enabled(), total = deck.length + (withCover ? 1 : 0);
  const add = async (c, name) => {
    const blob = await new Promise(r => c.toBlob(r, fmt, 0.95)); if (!blob) throw new Error("render");
    files.push({ name: `${String(files.length + 1).padStart(2, "0")}-${name}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) });
  };
  try {
    if (withCover && window.Cover.moving()) {
      const blob = await window.Cover.video(f => { btn.textContent = `Rendering cover video ${Math.round(f * 100)}%`; });
      files.push({ name: "01-cover.mp4", data: new Uint8Array(await blob.arrayBuffer()) });
    } else if (withCover) { btn.textContent = `Rendering 1/${total}…`; const c = document.createElement("canvas"); window.Cover.render(c, +state.export.width); await add(c, "cover"); }
    for (let i = 0; i < deck.length; i++) {
      btn.textContent = `Rendering ${files.length + 1}/${total}…`;
      const c = document.createElement("canvas"); const title = withSlide(i, () => { render(c, +state.export.width); return state.title; });
      await add(c, slug(title));
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(makeZip(files)); a.download = `carousel-${state.ratio.replace(":", "x")}.zip`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(`Saved ${files.length} slides as a zip.`);
  } catch (e) {
    console.error(e);
    toast(withCover && window.Cover.moving() && !files.length ? `Cover video failed: ${e?.message || e}` : "Export failed. Try JPG, or a smaller export width.");
  }
  btn.disabled = false; btn.textContent = "Download all (.zip)";
});

document.getElementById("copyCaption").addEventListener("click", () => {
  const title = (state.title || "").trim(), plain = (state.blurb || "").replace(/\*/g, "").trim();
  const tag = slug(title).replace(/-/g, "");
  const lines = [
    `${title}${state.year ? ` (${state.year})` : ""}${+state.rating > 0 ? "  " + starText(+state.rating) : ""}`,
    "", plain, "",
    [state.director && `Dir. ${state.director}`, state.runtime, state.genre].filter(Boolean).join(" · "),
    (state.cast || "").trim() ? `Cast: ${(state.cast || "").trim()}` : "",
    "", `#${tag || "film"} #filmrecommendations #moviestowatch #letterboxd #cinephile`,
  ];
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  navigator.clipboard?.writeText(text).then(() => toast("Caption copied."), () => toast("Couldn't reach the clipboard. Copy from the Words fields instead."));
});

document.getElementById("resetLook").addEventListener("click", () => {
  Object.assign(state, clone(LOOK_DEFAULTS)); state.accent = state.palette[0] || state.accent;
  syncInputs(); renderSwatches(); schedule(); toast("Look reset.");
});

/* ---------------- project files ----------------
   One .json file holds the whole carousel: the look, every slide's words, the cover, and the images
   (posters, backdrop stills, cover still) as data URLs. Opening one replaces what this browser holds. */
const PROJECT_APP = "poster-card-studio", COVER_KEY = "poster-card-studio:cover:v1";
const isProjectFile = f => !!f && (/\.json$/i.test(f.name) || f.type === "application/json");
const readJSON = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };

async function saveProject() {
  save(); window.Cover?.flush();
  const look = readJSON(STORE_KEY), deckData = readJSON(DECK_KEY), cover = readJSON(COVER_KEY);
  if (!deckData) { toast("Couldn't read this browser's storage, so there's nothing to save."); return; }
  const images = {};
  const keys = [...deck.flatMap(sl => [`deck:${sl.id}`, `deck:${sl.id}:bg`]), "cover:still"];
  for (const k of keys) { const v = await idbGet(k); if (v) images[k] = v; }
  // Images that never reached storage (storage blocked) still go in, straight from memory.
  deck.forEach((sl, i) => {
    const p = i === cur ? posterCanvas : imgs.get(sl.id)?.poster;
    if (!sl.sample && p && !images[`deck:${sl.id}`]) images[`deck:${sl.id}`] = downsized(p, 1400).toDataURL("image/jpeg", 0.92);
  });
  const file = { app: PROJECT_APP, version: 1, savedAt: new Date().toISOString(), look, deck: deckData, cover, images };
  const name = cover?.enabled ? [cover.kicker, cover.title].filter(Boolean).join(" ") : (deck[0] && (cur === 0 ? state.title : deck[0].title));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
  a.download = `${slug(name || "carousel") || "carousel"}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`Project saved: ${deck.length} slide${deck.length === 1 ? "" : "s"}${cover?.enabled ? " and the cover" : ""}.`);
}

const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const IMAGE_KEY = /^(deck:[a-z0-9]{1,16}(:bg)?|cover:still)$/;
const DATA_IMAGE = /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i;
function checkProject(p) {
  if (!isObj(p) || p.app !== PROJECT_APP || typeof p.version !== "number") return "That isn't a Poster Card Studio project file.";
  if (p.version > 1) return "That project was saved by a newer version. Refresh the page and try again.";
  const slides = p.deck?.slides;
  if (!Array.isArray(slides) || !slides.length || slides.length > 20) return "That project has no readable slides.";
  if (!slides.every(sl => isObj(sl) && typeof sl.id === "string" && /^[a-z0-9]{1,16}$/.test(sl.id))) return "That project's slides are damaged.";
  if ((p.look != null && !isObj(p.look)) || (p.cover != null && !isObj(p.cover)) || !isObj(p.images)) return "That project file is damaged.";
  for (const [k, v] of Object.entries(p.images)) if (!IMAGE_KEY.test(k) || typeof v !== "string" || !DATA_IMAGE.test(v)) return "That project's images are damaged.";
  return null;
}
async function openProject(file) {
  if (!file) return;
  let p = null;
  try { p = JSON.parse(await file.text()); } catch (e) { toast("Couldn't read that file. Is it a project .json saved from here?"); return; }
  const problem = checkProject(p); if (problem) { toast(problem); return; }
  const n = p.deck.slides.length;
  if (!confirm(`Open "${file.name}" (${n} slide${n === 1 ? "" : "s"})?\n\nThis replaces the carousel you have open now. Save it as a project first if you want to keep it.`)) return;
  frozen = true; window.Cover?.hold(); clearTimeout(saveTimer);
  try {
    await idbClear();
    for (const [k, v] of Object.entries(p.images)) await idbPut(k, v);
    const at = Math.max(0, Math.min(+p.deck.cur || 0, n - 1));
    localStorage.setItem(DECK_KEY, JSON.stringify({ cur: at, slides: p.deck.slides }));
    if (p.look) localStorage.setItem(STORE_KEY, JSON.stringify(p.look)); else localStorage.removeItem(STORE_KEY);
    if (p.cover) localStorage.setItem(COVER_KEY, JSON.stringify(p.cover)); else localStorage.removeItem(COVER_KEY);
  } catch (e) { frozen = false; toast("This browser wouldn't store the project (private window or full storage?)."); return; }
  location.reload();
}
document.getElementById("saveProject").addEventListener("click", saveProject);
document.getElementById("openProject").addEventListener("click", () => document.getElementById("projectFile").click());
document.getElementById("projectFile").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; openProject(f); });

/* ---------------- boot ---------------- */
const MODE_KEY = "poster-card-studio:mode:v4";
function setMode(m) {
  document.body.dataset.mode = m === "carousel" ? "carousel" : "single";
  try { localStorage.setItem(MODE_KEY, document.body.dataset.mode); } catch (e) { /* ignore */ }
  document.querySelectorAll("#modeSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === document.body.dataset.mode)));
  syncCoverFlag(); if (coverOn()) window.Cover.sync();
  renderDeck(); schedule();
}
document.querySelectorAll("#modeSeg button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));

async function boot() {
  let mode = "carousel"; try { mode = localStorage.getItem(MODE_KEY) || "carousel"; } catch (e) { /* ignore */ }
  document.body.dataset.mode = mode;
  document.querySelectorAll("#modeSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  syncInputs(); renderSamples();
  // Make sure canvas fonts are ready before the first real render.
  const faces = [];
  for (const p of Object.values(PRESETS)) for (const f of [p.title, p.body, p.label]) faces.push(document.fonts.load(fontStr(f, 40)));
  const fontsReady = Promise.allSettled(faces);

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(DECK_KEY) || "null"); } catch (e) { /* ignore */ }
  if (saved && Array.isArray(saved.slides) && saved.slides.length) { deck = saved.slides; cur = Math.min(saved.cur || 0, deck.length - 1); }
  else {
    deck = [{ id: uid(), ...pick(state) }]; cur = 0;
    let old = null; try { old = localStorage.getItem(POSTER_KEY); } catch (e) { /* ignore */ }
    if (old && !state.sample) { await idbPut(`deck:${deck[0].id}`, old); try { localStorage.removeItem(POSTER_KEY); } catch (e) { /* ignore */ } }
    else if (!state.sample) { deck[0].sample = Object.keys(window.SAMPLE_POSTERS || {})[0] || null; }
  }
  // Put the current slide's words in place before the posters load: anything that draws thumbnails meanwhile
  // (the cover's own startup does) stashes state into deck[cur], and must not stash the previous look's words.
  loadSlide(cur);
  const loaded = await Promise.all(deck.map(imagesFor));
  deck.forEach((sl, i) => imgs.set(sl.id, loaded[i]));
  loadSlide(cur);
  document.getElementById("clearBg").hidden = !bgImage;
  syncInputs(); renderSamples(); renderSwatches(); renderDeck();
  window.addEventListener("keydown", e => {
    if (document.body.dataset.mode !== "carousel" || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
    if (e.key === "ArrowRight") { if (coverOn()) selectSlide(0); else selectSlide(cur + 1); e.preventDefault(); }
    if (e.key === "ArrowLeft") { if (!coverOn() && cur === 0) selectCover(); else if (!coverOn()) selectSlide(cur - 1); e.preventDefault(); }
  });
  await fontsReady; schedule();
  document.fonts.addEventListener?.("loadingdone", schedule);
}
boot();

// Shared with cover.js
const deckSlides = () => deck.map((sl, i) => ({ id: sl.id, title: i === cur ? state.title : sl.title, poster: (i === cur ? posterCanvas : imgs.get(sl.id)?.poster) || null }));
const deckPosters = () => deckSlides().map(s => s.poster).filter(Boolean);
window.PCS = {
  RATIOS, FILTER_OK, fontStr, wrapPlain, rrect, getGrain, loadImage, readFile, toast, slug,
  get state() { return state; }, preset: P, deckPosters, deckSlides, deckCount: () => deck.length,
  drawChromeText, setK: k => { K = k; }, capHeight, trackedWidth, drawTracked, setTitleTracking, clearTracking,
  extractPalette, rgbToHsl, hslToHex, idbPut, idbGet, downsized, schedule, renderDeck, selectCover, isCover: () => coverOn(), redraw: () => renderPreview(),
};
})();
