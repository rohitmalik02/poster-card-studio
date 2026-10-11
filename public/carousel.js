/* Carousel mode: "The Night Shift" — a departure-board carousel for themed lists.
   Every slide is timestamped; the clock runs from dusk to dawn as you swipe. Repeated
   jokes are rubber stamps; an escalating stamp keeps a tally that gets louder each time. */
(() => {
"use strict";
const { FILTER_OK, wrapPlain, rrect, getGrain, loadImage, cropTo23, readFile, slug } = window.PCS;

/* ---------------- look ---------------- */
const SHAPES = { "3:4": { w: 1080, h: 1440 }, "4:5": { w: 1080, h: 1350 }, "1:1": { w: 1080, h: 1080 } };
const C = {
  bg: "#07090f", bg2: "#10162a",
  amber: "#ffb21a",              // LED board
  cream: "#f4ead7",
  ink: "#ff4b3a",                // stamp ink
  dawnInk: "#2a1630",
};
const F = {
  dot: '"Doto", "DotGothic16", ui-monospace, monospace',
  sign: '"Anton", Impact, "Arial Narrow", sans-serif',
  stamp: '"Special Elite", "Courier New", monospace',
  body: '"Barlow", system-ui, sans-serif',
  hindi: '"Tiro Devanagari Hindi", "Noto Serif Devanagari", serif',
};
const font = (fam, size, weight = 400, style = "normal") => `${style} ${weight} ${size}px ${fam}`;
const DEG = Math.PI / 180;
const TYPE_NAMES = { cover: "Cover", legend: "Legend", film: "Film", grid: "Grid", climax: "Climax", sunrise: "Sunrise" };
let K = 1; // device px per layout px for the render in progress

/* ---------------- default content: PMR#1 ---------------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const film = (time, platform, title, meta, line, stamp) => ({ id: uid(), type: "film", time, platform, title, meta, line, stamp });
const items = titles => titles.map(title => ({ id: uid(), title }));
function defaultCarousel() {
  return {
    ratio: "3:4", series: "PMR#1", title: "Dangers of the Night", hindi: "रात के ख़तरे", genre: "A Night Odyssey", handle: "@yourhandle",
    export: { width: "1440", format: "png" },
    stamps: [
      { id: "home", text: "Should've stayed home", short: "DO NOT BOARD", meaning: "I regret stepping out at night.", escalates: true },
      { id: "city", text: "The city changes shifts", short: "NIGHT SERVICE", meaning: "The world is different, and dangerous, at night.", escalates: false },
      { id: "dawn", text: "Waiting for sunrise", short: "TILL DAWN", meaning: "Survive the night. Pray the dawn comes.", escalates: false },
    ],
    slides: [
      { id: uid(), type: "cover", time: "9:47 PM" },
      { id: uid(), type: "legend", time: "10:00 PM", line: "Keep count. It gets worse." },
      film("10:15 PM", "1", "Good Time", "2017 · Safdie brothers", "Shit goes down at night. Robert Pattinson personally sees to it.", ""),
      film("10:40 PM", "1", "Taxi Driver", "1976 · Martin Scorsese", "The city changes shifts at night. So does Travis.", "city"),
      film("11:05 PM", "1", "Victoria", "2015 · Sebastian Schipper", "One night. One take. No pause button. Pray for dawn.", "dawn"),
      film("11:30 PM", "1", "After Hours", "1985 · Martin Scorsese", "Went downtown for a date.", "home"),
      film("11:55 PM", "1", "Coherence", "2013 · James Ward Byrkit", "A dinner party, a comet, and slightly too many of everyone.", ""),
      film("12:20 AM", "1", "Drive", "2011 · Nicolas Winding Refn", "Toothpick in. Scorpion jacket on. The city's yours till 5 AM.", "city"),
      film("12:50 AM", "1", "Collateral", "2004 · Michael Mann", "Took one cab ride.", "home"),
      film("1:15 AM", "1", "Sinners", "2025 · Ryan Coogler", "Survive the night. The vampires have a better band.", "dawn"),
      film("1:40 AM", "1", "Ek Chaalis Ki Last Local", "2007 · Sanjay Khanduri", "The last local leaves. Your problems don't.", "dawn"),
      { id: uid(), type: "grid", time: "2:05 AM", platform: "2", title: "Delayed services", line: "Same night. Later trains.", stamp: "",
        items: items(["36 China Town", "Last Night in Soho", "Nightcrawler", "Akira"]) },
      film("2:12 AM", "3", "Superbad", "2007 · Greg Mottola", "Went out for booze. Came back with a night odyssey.", "home"),
      { id: uid(), type: "grid", time: "2:20 AM", platform: "3", title: "Rich kids should've stayed home", line: "Plus one very bad Airbnb.", stamp: "home",
        items: items(["Y2K", "Bodies Bodies Bodies", "I Know What You Did Last Summer", "It's What's Inside", "Booksmart", "Barbarian"]) },
      { id: uid(), type: "climax", time: "2:30 AM", platform: "1", title: "Climax", meta: "2018 · Gaspar Noé",
        line: "Danced all night. Didn't check the punch.", stamp: "home", spike: "…and this sangria tastes funny" },
      { id: uid(), type: "sunrise", time: "6:12 AM", title: "You survived.", kicker: "Barely.", line: "Send this to the friend who says “just one drink.”" },
    ],
  };
}
const BLANK = {
  film: () => film("3:00 AM", "1", "New film", "", "One line about why it belongs here.", ""),
  grid: () => ({ id: uid(), type: "grid", time: "3:00 AM", platform: "2", title: "More services", line: "", stamp: "", items: items(["Film one", "Film two", "Film three", "Film four"]) }),
  climax: () => ({ id: uid(), type: "climax", time: "2:30 AM", platform: "1", title: "Climax", meta: "", line: "The one that one-ups the theme.", stamp: "", spike: "…and then it got worse" }),
  cover: () => ({ id: uid(), type: "cover", time: "9:30 PM" }),
  legend: () => ({ id: uid(), type: "legend", time: "9:45 PM", line: "Keep count." }),
  sunrise: () => ({ id: uid(), type: "sunrise", time: "6:00 AM", title: "You survived.", kicker: "Barely.", line: "" }),
};

/* ---------------- state + storage ---------------- */
const STORE = "poster-card-studio:carousel:v1", MODE = "poster-card-studio:mode";
let cs = null, sel = 0;
try { cs = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) { cs = null; }
if (!cs || !Array.isArray(cs.slides) || !cs.slides.length) cs = defaultCarousel();
cs.export = cs.export || { width: "1440", format: "png" };
let saveT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(cs)); } catch (e) { /* ignore */ } }, 300); }

// Posters live in IndexedDB (too big for localStorage), cached here as 2:3 canvases.
const posters = new Map();
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
  } catch (e) { /* storage unavailable: poster lasts until reload */ }
}
async function loadPosters() {
  try {
    const d = await idb(); const pending = [];
    await new Promise(res => {
      const rq = d.transaction("posters").objectStore("posters").openCursor();
      rq.onsuccess = () => { const c = rq.result; if (!c) return res(); const k = c.key; pending.push(loadImage(c.value).then(img => posters.set(k, cropTo23(img)))); c.continue(); };
      rq.onerror = () => res();
    });
    await Promise.allSettled(pending);
  } catch (e) { /* ignore */ }
}
async function setPoster(key, file) {
  if (!file || !file.type.startsWith("image/")) { toast("That file isn't an image. Try a JPG, PNG or WebP."); return; }
  const img = await loadImage(await readFile(file));
  let c = cropTo23(img);
  if (c.width > 1000) { const d = document.createElement("canvas"); d.width = 1000; d.height = 1500; const x = d.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, 1000, 1500); c = d; }
  posters.set(key, c); idbPut(key, c.toDataURL("image/jpeg", 0.9));
  changed(true);
}
function clearPoster(key) { posters.delete(key); idbPut(key, null); changed(true); }

/* ---------------- placeholder posters ---------------- */
const phCache = new Map();
function placeholder(title) {
  if (phCache.has(title)) return phCache.get(title);
  const c = document.createElement("canvas"); c.width = 600; c.height = 900; const x = c.getContext("2d");
  let h = 7; for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const g = x.createLinearGradient(0, 0, 600, 900);
  g.addColorStop(0, `hsl(${hue},55%,30%)`); g.addColorStop(1, `hsl(${(hue + 60) % 360},65%,9%)`);
  x.fillStyle = g; x.fillRect(0, 0, 600, 900);
  const rg = x.createRadialGradient(430, 250, 10, 430, 250, 420);
  rg.addColorStop(0, `hsla(${(hue + 25) % 360},95%,62%,.55)`); rg.addColorStop(1, "hsla(0,0%,0%,0)");
  x.fillStyle = rg; x.fillRect(0, 0, 600, 900);
  x.fillStyle = "rgba(255,255,255,.07)";
  for (let i = 0; i < 9; i++) x.fillRect(0, 520 + i * 26, 600, 2);
  let size = 120, lines;
  for (; size >= 44; size -= 4) { x.font = font(F.sign, size); lines = wrapPlain(x, title.toUpperCase(), 520); if (lines.length <= 4 && lines.every(l => x.measureText(l).width <= 520)) break; }
  x.fillStyle = "#fff4e2"; x.textBaseline = "alphabetic";
  lines.forEach((l, i) => x.fillText(l, 40, 860 - (lines.length - 1 - i) * size * 1.02));
  x.font = font(F.dot, 24, 800); x.fillStyle = "rgba(255,244,226,.6)"; x.fillText("POSTER GOES HERE", 40, 64);
  phCache.set(title, c); return c;
}
const posterFor = (key, title) => posters.get(key) || placeholder(title || "Untitled");

/* ---------------- drawing helpers ---------------- */
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hashStr = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const pad2 = n => String(n).padStart(2, "0");

function fitLines(ctx, text, fam, weight, maxW, maxLines, maxSize, minSize, step = 2) {
  let r;
  for (let s = maxSize; s >= minSize; s -= step) {
    ctx.font = font(fam, s, weight); const lines = wrapPlain(ctx, text, maxW); r = { size: s, lines };
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) break;
  }
  return r;
}
function fitBlock(ctx, text, fam, weight, maxW, maxH, maxSize, minSize, lh) {
  let r;
  for (let s = maxSize; s >= minSize; s -= 1) {
    ctx.font = font(fam, s, weight); const lines = wrapPlain(ctx, text, maxW); r = { size: s, lines, lh: s * lh };
    if (lines.length * s * lh <= maxH) break;
  }
  return r;
}
function ellipsize(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length > 1 && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
  return text.trimEnd() + "…";
}
function glowText(ctx, text, x, y, color, blur = 18) {
  ctx.save(); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = blur * K;
  ctx.fillText(text, x, y); ctx.shadowBlur = 0; ctx.fillText(text, x, y); ctx.restore();
}
// red/cyan double vision: draw(color) paints the element; null = its normal colour
function chroma(ctx, draw, off = 5) {
  ctx.save(); ctx.globalCompositeOperation = "screen";
  ctx.save(); ctx.translate(-off, 0); draw("rgba(255,40,70,0.9)"); ctx.restore();
  ctx.save(); ctx.translate(off, 0); draw("rgba(40,220,255,0.9)"); ctx.restore();
  ctx.restore(); draw(null);
}
function dottedLine(ctx, x1, y, x2, color, alpha = 0.5, step = 12, r = 2.2) {
  ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha;
  for (let x = x1; x <= x2; x += step) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function dotGrid(ctx, color, step = 12) {
  const t = document.createElement("canvas"); const s = Math.max(3, Math.round(step * K)); t.width = t.height = s;
  const x = t.getContext("2d"); x.fillStyle = color; x.beginPath(); x.arc(s / 2, s / 2, Math.max(0.7, s * 0.13), 0, Math.PI * 2); x.fill();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = ctx.createPattern(t, "repeat"); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
}
function grain(ctx, alpha) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = alpha;
  ctx.fillStyle = ctx.createPattern(getGrain(), "repeat"); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
}
function scanlines(ctx, W, H) {
  ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.22)"; for (let y = 0; y < H; y += 5) ctx.fillRect(0, y, W, 2); ctx.restore();
}

function drawNight(ctx, L, wash, { tint = null } = {}) {
  const { W, H } = L;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.bg2); g.addColorStop(1, C.bg);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (wash) { // the poster's colours, blurred into the night
    const q = 0.25, ow = Math.max(2, Math.round(W * K * q)), oh = Math.max(2, Math.round(H * K * q));
    const off = document.createElement("canvas"); off.width = ow; off.height = oh; const o = off.getContext("2d");
    const s = Math.max(ow / wash.width, oh / wash.height) * 1.6, dw = wash.width * s, dh = wash.height * s;
    if (FILTER_OK) o.filter = `blur(${46 * K * q}px) saturate(1.5)`;
    o.drawImage(wash, (ow - dw) / 2, (oh - dh) / 2, dw, dh);
    ctx.save(); ctx.globalAlpha = 0.4; ctx.imageSmoothingQuality = "high"; ctx.drawImage(off, 0, 0, W, H); ctx.restore();
    ctx.fillStyle = "rgba(7,9,15,0.4)"; ctx.fillRect(0, 0, W, H);
  }
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
  dotGrid(ctx, "rgba(255,178,26,0.075)");
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) / 2);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)"); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  grain(ctx, 0.06);
}

function drawHeader(ctx, L, { platform, fg = C.amber, sub = C.cream, glitch = false } = {}) {
  const { W, pad, slide } = L, top = pad;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.font = font(F.dot, 84, 900);
  const t = (slide.time || "").toUpperCase();
  if (glitch) chroma(ctx, c => { ctx.fillStyle = c || fg; ctx.fillText(t, pad, top + 70); }, 6);
  else glowText(ctx, t, pad, top + 70, fg);
  ctx.textAlign = "right";
  ctx.font = font(F.dot, 30, 900);
  glowText(ctx, platform || (slide.platform ? `● PLATFORM ${slide.platform}` : "●"), W - pad, top + 26, fg, 10);
  ctx.save(); ctx.fillStyle = sub; ctx.globalAlpha = 0.72;
  ctx.font = font(F.dot, 22, 800); ctx.fillText(ellipsize(ctx, `${cs.series} · ${cs.title}`.toUpperCase(), W * 0.5), W - pad, top + 60);
  if (cs.hindi) { ctx.font = font(F.hindi, 26); ctx.fillText(cs.hindi, W - pad, top + 96); }
  ctx.restore();
  const y = top + 124; dottedLine(ctx, pad, y, W - pad, fg, 0.45);
  return y;
}

function nightProgress(time) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(time || ""); if (!m) return 0;
  let h = +m[1] % 24; const mins = +(m[2] || 0), ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
  const rel = ((h * 60 + mins) - 21 * 60 + 1440) % 1440;
  return Math.max(0, Math.min(1, rel / (9.5 * 60)));
}
function drawFooter(ctx, L, { fg = C.amber, sub = C.cream } = {}) {
  const { W, H, pad, i, n, slide } = L, y = H - pad;
  const g = ctx.createLinearGradient(pad, 0, W - pad, 0);
  g.addColorStop(0, "#26338a"); g.addColorStop(0.55, "#7b3f9c"); g.addColorStop(1, "#ffa07a");
  ctx.fillStyle = g; rrect(ctx, pad, y - 7, W - 2 * pad, 7, 3.5); ctx.fill();
  const mx = pad + (W - 2 * pad) * nightProgress(slide.time);
  ctx.save(); ctx.fillStyle = fg; ctx.shadowColor = fg; ctx.shadowBlur = 18 * K; ctx.beginPath(); ctx.arc(mx, y - 3.5, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.font = font(F.dot, 21, 800); ctx.fillStyle = sub; ctx.globalAlpha = 0.7; ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left"; ctx.fillText(`STOP ${pad2(i + 1)}/${pad2(n)}`, pad, y - 30);
  ctx.textAlign = "center"; ctx.fillText((cs.handle || "").toUpperCase(), W / 2, y - 30);
  ctx.textAlign = "right"; ctx.fillText(i < n - 1 ? "SWIPE →" : "END OF LINE", W - pad, y - 30);
  ctx.restore();
  return y - 64;
}

function drawPoster(ctx, src, x, y, w, h, rot = 0) {
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.65)"; ctx.shadowBlur = 60 * K; ctx.shadowOffsetY = 26 * K; ctx.fillStyle = "#000"; rrect(ctx, 0, 0, w, h, 6); ctx.fill(); ctx.restore();
  ctx.save(); rrect(ctx, 0, 0, w, h, 6); ctx.clip(); ctx.imageSmoothingQuality = "high"; ctx.drawImage(src, 0, 0, w, h); ctx.restore();
  ctx.strokeStyle = "rgba(255,178,26,0.35)"; ctx.lineWidth = 2; rrect(ctx, 1, 1, w - 2, h - 2, 6); ctx.stroke();
  ctx.restore();
}

/* ---------------- stamps ---------------- */
let distress = null;
function distressTile() {
  if (distress) return distress;
  const c = document.createElement("canvas"); c.width = c.height = 160; const x = c.getContext("2d");
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.9})`; const r = Math.random() * 2.4 + 0.3; x.beginPath(); x.arc(Math.random() * 160, Math.random() * 160, r, 0, Math.PI * 2); x.fill(); }
  for (let i = 0; i < 14; i++) { x.fillStyle = "rgba(0,0,0,0.5)"; x.fillRect(Math.random() * 160, Math.random() * 160, Math.random() * 40 + 10, 1.2); }
  return (distress = c);
}
// Draws a rubber stamp centred on (cx, cy). Returns its unrotated box size.
function drawStamp(ctx, { text, color = C.ink, cx, cy, scale = 1, rot = 0, tally = "", alpha = 0.92, maxChars = 15, badgeLeft = false }) {
  const size = 46 * scale, padX = 28 * scale, padY = 22 * scale, lh = size * 1.1;
  const m = document.createElement("canvas").getContext("2d"); m.font = font(F.stamp, size);
  const words = (text || "").toUpperCase().split(/\s+/).filter(Boolean); const lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (t.length > maxChars && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  const tw = Math.max(1, ...lines.map(l => m.measureText(l).width));
  const bw = tw + padX * 2, bh = (lines.length - 1) * lh + size + padY * 2, mg = 12 * scale;
  const c = document.createElement("canvas"); c.width = Math.ceil((bw + mg * 2) * K); c.height = Math.ceil((bh + mg * 2) * K);
  const x = c.getContext("2d"); x.scale(K, K); x.translate(mg, mg);
  x.strokeStyle = color; x.fillStyle = color;
  x.lineWidth = 6 * scale; rrect(x, 0, 0, bw, bh, 8 * scale); x.stroke();
  x.lineWidth = 2 * scale; rrect(x, 9 * scale, 9 * scale, bw - 18 * scale, bh - 18 * scale, 4 * scale); x.stroke();
  x.font = font(F.stamp, size); x.textAlign = "center"; x.textBaseline = "alphabetic";
  lines.forEach((l, k) => x.fillText(l, bw / 2, padY + size * 0.8 + k * lh));
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "destination-out";
  x.fillStyle = x.createPattern(distressTile(), "repeat"); x.fillRect(0, 0, c.width, c.height);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.globalAlpha = alpha;
  ctx.drawImage(c, -(bw / 2 + mg), -(bh / 2 + mg), bw + mg * 2, bh + mg * 2);
  if (tally) {
    const r = 40 * scale + (tally.length > 2 ? 8 * scale : 0), bx = badgeLeft ? -bw / 2 + 4 * scale : bw / 2 - 4 * scale, by = -bh / 2 - 2 * scale;
    ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#14090a"; ctx.font = font(F.sign, 40 * scale); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(tally, bx, by + 2 * scale); ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  return { bw, bh };
}
const stampById = id => cs.stamps.find(s => s.id === id);
function tallies() {
  const seen = {}, out = {};
  for (const s of cs.slides) if (s.stamp && (s.type === "film" || s.type === "grid" || s.type === "climax")) { seen[s.stamp] = (seen[s.stamp] || 0) + 1; out[s.id] = seen[s.stamp]; }
  return out;
}
// Escalation: same spot every time, but louder: ×1 neat, ×2 bigger and crooked, ×3 falls off the slide, ×4+ gets annoyed.
function stampPose(st, n, ax, ay, L) {
  if (!st.escalates) return { cx: ax, cy: ay, scale: 0.92, rot: -5 * DEG, tally: "" };
  const p = [null, { s: 0.88, r: -4 }, { s: 1.12, r: -10 }, { s: 1.42, r: 13 }, { s: 1.15, r: -7 }][Math.min(n, 4)];
  return { cx: n === 3 ? L.W - 40 : ax, cy: ay - (n === 3 ? 30 : 0), scale: p.s, rot: p.r * DEG, tally: `×${n}`, badgeLeft: n === 3 };
}

/* ---------------- slides ---------------- */
function titleBlock(ctx, L, text, y, { maxLines = 2, max = 124, min = 56, color = C.cream } = {}) {
  const maxW = L.W - 2 * L.pad;
  const f = fitLines(ctx, (text || "").toUpperCase(), F.sign, 400, maxW, maxLines, max, min);
  ctx.font = font(F.sign, f.size); ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  f.lines.forEach(ln => { y += f.size * 1.02; ctx.fillText(ln, L.pad, y); });
  return y;
}

function drawFilm(ctx, L) {
  const s = L.slide, src = posterFor(s.id, s.title), { W, pad } = L;
  drawNight(ctx, L, src);
  const hb = drawHeader(ctx, L), ft = drawFooter(ctx, L);
  let y = titleBlock(ctx, L, s.title, hb + 26);
  if (s.meta) { y += 46; ctx.font = font(F.dot, 26, 900); ctx.textAlign = "left"; glowText(ctx, s.meta.toUpperCase(), pad, y, C.amber, 8); }
  const rowTop = y + 38, rowH = ft - rowTop;
  let ph = rowH, pw = ph * 2 / 3; const maxPw = (W - 2 * pad) * 0.54;
  if (pw > maxPw) { pw = maxPw; ph = pw * 1.5; }
  drawPoster(ctx, src, pad, rowTop, pw, ph);
  const colX = pad + pw + 44, colW = W - pad - colX;
  ctx.font = font(F.sign, 160); ctx.fillStyle = C.amber; ctx.textAlign = "left"; ctx.fillText("“", colX - 4, rowTop + 118);
  const b = fitBlock(ctx, s.line || "", F.body, 500, colW, ph * 0.52, 48, 28, 1.25);
  ctx.font = font(F.body, b.size, 500); ctx.fillStyle = C.cream;
  b.lines.forEach((ln, k) => ctx.fillText(ln, colX, rowTop + 150 + b.size + k * b.lh));
  const st = stampById(s.stamp);
  if (st) { const p = stampPose(st, L.counts[s.id], pad + pw + 20, rowTop + ph - 120, L); drawStamp(ctx, { text: st.text, ...p }); }
}

function drawGrid(ctx, L) {
  const s = L.slide, list = (s.items || []).slice(0, 6), { W, pad } = L;
  drawNight(ctx, L, list[0] ? posterFor(`${s.id}:${list[0].id}`, list[0].title) : null);
  const hb = drawHeader(ctx, L), ft = drawFooter(ctx, L);
  let y = titleBlock(ctx, L, s.title, hb + 26, { max: 104 });
  if (s.line) { y += 48; ctx.font = font(F.body, 34, 500, "italic"); ctx.fillStyle = "rgba(244,234,215,0.82)"; ctx.textAlign = "left"; ctx.fillText(s.line, pad, y); }
  const st = stampById(s.stamp), band = st ? 230 : 0;
  const top = y + 36, availH = ft - top - band, maxW = W - 2 * pad;
  const n = list.length || 1, cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), gap = 26, cap = 42;
  let cw = (maxW - gap * (cols - 1)) / cols;
  if (rows * (cw * 1.5 + cap) + gap * (rows - 1) > availH) cw = ((availH - gap * (rows - 1)) / rows - cap) / 1.5;
  const gw = cols * cw + gap * (cols - 1), x0 = (W - gw) / 2;
  list.forEach((it, k) => {
    const cx = x0 + (k % cols) * (cw + gap), cy = top + Math.floor(k / cols) * (cw * 1.5 + cap + gap);
    drawPoster(ctx, posterFor(`${s.id}:${it.id}`, it.title), cx, cy, cw, cw * 1.5);
    ctx.font = font(F.dot, cols === 3 ? 19 : 22, 900); ctx.fillStyle = C.cream; ctx.textAlign = "center";
    ctx.fillText(ellipsize(ctx, (it.title || "").toUpperCase(), cw), cx + cw / 2, cy + cw * 1.5 + 32);
  });
  if (st) {
    const n2 = L.counts[s.id], gh = rows * (cw * 1.5 + cap) + gap * (rows - 1), sy = top + gh + band * 0.5;
    const p = st.escalates ? { cx: W / 2 + 20, cy: sy, scale: 1.15, rot: -6 * DEG, tally: `×${n2}` } : stampPose(st, n2, W / 2, sy, L);
    const { bw, bh } = drawStamp(ctx, { text: st.text, ...p });
    if (st.escalates && n2 >= 4) { // tally marks and a tired note
      ctx.save(); ctx.translate(p.cx - bw / 2 - 120, p.cy - 30); ctx.rotate(-6 * DEG);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = "round";
      for (let i = 0; i < Math.min(n2, 4); i++) { ctx.beginPath(); ctx.moveTo(i * 18, 0); ctx.lineTo(i * 18 + 3, 62); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-10, 46); ctx.lineTo(70, 12); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.translate(p.cx + bw / 2 + 95, p.cy + 40); ctx.rotate(-10 * DEG);
      ctx.font = font(F.stamp, 44); ctx.fillStyle = C.ink; ctx.textAlign = "center"; ctx.fillText("again??", 0, 0); ctx.restore();
    }
  }
}

function drawClimax(ctx, L) {
  const s = L.slide, src = posterFor(s.id, s.title), { W, pad } = L;
  drawNight(ctx, L, src, { tint: "rgba(235,30,50,0.17)" });
  scanlines(ctx, L.W, L.H);
  const hb = drawHeader(ctx, L, { glitch: true }), ft = drawFooter(ctx, L);
  const rnd = mulberry32(hashStr((s.title || "") + (s.time || "")));
  // title: letters come loose
  const t = (s.title || "").toUpperCase(), maxW = W - 2 * pad; let size = 190;
  const spacing = () => size * 0.16;
  const width = () => { ctx.font = font(F.sign, size); return [...t].reduce((a, ch) => a + ctx.measureText(ch).width + spacing(), -spacing()); };
  while (size > 60 && width() > maxW) size -= 6;
  ctx.font = font(F.sign, size); let x = pad; const base = hb + 30 + size * 0.95;
  for (const ch of t) {
    const w = ctx.measureText(ch).width, r = (rnd() - 0.5) * 0.42, dy = (rnd() - 0.5) * 34;
    ctx.save(); ctx.translate(x + w / 2, base + dy); ctx.rotate(r);
    chroma(ctx, c => { ctx.fillStyle = c || C.cream; ctx.textAlign = "center"; ctx.fillText(ch, 0, 0); }, 7);
    ctx.restore(); x += w + spacing();
  }
  let y = base + 30;
  if (s.meta) { y += 42; ctx.font = font(F.dot, 26, 900); ctx.textAlign = "left"; chroma(ctx, c => { ctx.fillStyle = c || C.amber; ctx.fillText(s.meta.toUpperCase(), pad, y); }, 3); }
  // the spiked line at the bottom
  const spike = (s.spike || "").toUpperCase();
  const sp = fitLines(ctx, spike, F.stamp, 400, maxW, 2, 54, 30);
  const spikeH = sp.lines.length * sp.size * 1.35 + 30;
  const rowTop = y + 40, rowH = ft - rowTop - spikeH;
  let ph = rowH, pw = ph * 2 / 3; const maxPw = maxW * 0.5;
  if (pw > maxPw) { pw = maxPw; ph = pw * 1.5; }
  drawPoster(ctx, src, pad + 10, rowTop, pw, ph, 5 * DEG);
  const colX = pad + pw + 60, colW = W - pad - colX;
  ctx.save(); ctx.translate(colX, rowTop + 40); ctx.rotate(-2.5 * DEG);
  const b = fitBlock(ctx, s.line || "", F.body, 500, colW, ph * 0.5, 46, 28, 1.25);
  ctx.font = font(F.body, b.size, 500); ctx.textAlign = "left";
  b.lines.forEach((ln, k) => chroma(ctx, c => { ctx.fillStyle = c || C.cream; ctx.fillText(ln, 0, b.size + k * b.lh); }, 2.5));
  ctx.restore();
  const st = stampById(s.stamp);
  if (st) drawStamp(ctx, { text: st.text, cx: pad + pw * 0.95, cy: rowTop + ph * 0.62, scale: 1.32, rot: 11 * DEG, tally: st.escalates ? "×∞" : "" });
  // wobbling letters, double vision
  let sy = ft - spikeH + sp.size + 18; ctx.font = font(F.stamp, sp.size); ctx.textAlign = "left";
  sp.lines.forEach((ln, li) => {
    const lw = ctx.measureText(ln).width; let lx = (W - lw) / 2; let k = 0;
    for (const ch of ln) {
      const w = ctx.measureText(ch).width, dy = Math.sin(k * 0.55 + li) * 12, r = Math.cos(k * 0.7) * 0.14;
      ctx.save(); ctx.translate(lx + w / 2, sy + dy); ctx.rotate(r);
      chroma(ctx, c => { ctx.fillStyle = c || "#ff6a5c"; ctx.textAlign = "center"; ctx.fillText(ch, 0, 0); }, 4);
      ctx.restore(); lx += w; k++;
    }
    sy += sp.size * 1.35;
  });
}

function drawCover(ctx, L) {
  const { W, pad } = L;
  drawNight(ctx, L, null);
  const hb = drawHeader(ctx, L, { platform: "● ALL PLATFORMS" }), ft = drawFooter(ctx, L);
  let y = hb + 30;
  ctx.textAlign = "left"; ctx.font = font(F.dot, 150, 900); glowText(ctx, cs.series.toUpperCase(), pad - 6, y + 130, C.amber, 26);
  if (cs.genre) drawStamp(ctx, { text: cs.genre, color: C.amber, cx: W - pad - 150, cy: y + 78, scale: 0.72, rot: -7 * DEG, maxChars: 9 });
  y = titleBlock(ctx, L, cs.title, y + 160, { max: 150, min: 70 });
  if (cs.hindi) { y += 70; ctx.font = font(F.hindi, 58); ctx.fillStyle = C.amber; ctx.globalAlpha = 0.9; ctx.fillText(cs.hindi, pad, y); ctx.globalAlpha = 1; }
  // departure board
  const top = y + 44, bh = ft - top - 10, rowH = 46;
  ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.42)"; rrect(ctx, pad - 18, top, W - 2 * pad + 36, bh, 10); ctx.fill();
  ctx.strokeStyle = "rgba(255,178,26,0.28)"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  const cTime = pad + 4, cSvc = pad + 196, cStat = W - pad - 4;
  ctx.font = font(F.dot, 20, 900); ctx.fillStyle = "rgba(244,234,215,0.5)"; ctx.textAlign = "left";
  ctx.fillText("TIME", cTime, top + 38); ctx.fillText("SERVICE", cSvc, top + 38); ctx.textAlign = "right"; ctx.fillText("STATUS", cStat, top + 38);
  dottedLine(ctx, pad, top + 54, W - pad, C.amber, 0.3, 10, 1.6);
  const rows = cs.slides.filter(s => s.type === "film" || s.type === "grid" || s.type === "climax");
  const fit = Math.max(1, Math.floor((bh - 70) / rowH)); const shown = rows.length > fit ? rows.slice(0, fit - 1) : rows;
  let ry = top + 54 + rowH - 12;
  const statW = 250;
  for (const r of shown) {
    const st = stampById(r.stamp), climax = r.type === "climax";
    ctx.font = font(F.dot, 25, 900); ctx.textAlign = "left"; glowText(ctx, (r.time || "").toUpperCase(), cTime, ry, C.amber, 6);
    ctx.fillStyle = C.cream; ctx.fillText(ellipsize(ctx, (r.title || "").toUpperCase(), cStat - statW - cSvc), cSvc, ry);
    ctx.textAlign = "right"; ctx.font = font(F.dot, 22, 900);
    const status = climax ? "??????" : st ? st.short.toUpperCase() : r.type === "grid" ? "DELAYED" : "ON TIME";
    if (climax) chroma(ctx, c => { ctx.fillStyle = c || C.ink; ctx.fillText(status, cStat, ry); }, 3);
    else { ctx.fillStyle = st ? C.ink : "rgba(244,234,215,0.65)"; ctx.fillText(status, cStat, ry); }
    ry += rowH;
  }
  if (rows.length > shown.length) { ctx.font = font(F.dot, 22, 900); ctx.textAlign = "left"; ctx.fillStyle = C.amber; ctx.fillText(`+ ${rows.length - shown.length} MORE SERVICES TONIGHT · SWIPE →`, cSvc, ry); }
}

function drawLegend(ctx, L) {
  const s = L.slide, { W, pad } = L;
  drawNight(ctx, L, null);
  const hb = drawHeader(ctx, L, { platform: "● INFO" }), ft = drawFooter(ctx, L);
  const y = titleBlock(ctx, L, "What the stamps mean", hb + 26, { max: 120 });
  const noteH = s.line ? 90 : 0, top = y + 40, area = ft - top - noteH, n = cs.stamps.length || 1, rowH = area / n;
  cs.stamps.forEach((st, k) => {
    const cy = top + rowH * (k + 0.5);
    drawStamp(ctx, { text: st.text, cx: pad + 180, cy, scale: Math.min(0.78, rowH / 260), rot: (k % 2 ? 4 : -5) * DEG, maxChars: 12 });
    const tx = pad + 410, tw = W - pad - tx;
    const b = fitBlock(ctx, "= " + (st.meaning || ""), F.body, 500, tw, rowH * 0.6, 38, 24, 1.22);
    ctx.font = font(F.body, b.size, 500, "italic"); ctx.fillStyle = C.cream; ctx.textAlign = "left";
    const by = cy - (b.lines.length * b.lh) / 2 + b.size * 0.8;
    b.lines.forEach((ln, i) => ctx.fillText(ln, tx, by + i * b.lh));
    ctx.font = font(F.dot, 20, 900); ctx.fillStyle = C.amber;
    ctx.fillText(st.escalates ? "STATUS: " + st.short.toUpperCase() + " · ESCALATES" : "STATUS: " + st.short.toUpperCase(), tx, by + b.lines.length * b.lh + 12);
  });
  if (s.line) {
    ctx.save(); ctx.translate(W / 2, ft - 26); ctx.rotate(-2 * DEG);
    ctx.font = font(F.stamp, 40); ctx.fillStyle = C.ink; ctx.textAlign = "center"; ctx.fillText(s.line, 0, 0); ctx.restore();
  }
}

function drawSunrise(ctx, L) {
  const s = L.slide, { W, H, pad } = L;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#151634"); sky.addColorStop(0.38, "#5d3474"); sky.addColorStop(0.62, "#f07a6a"); sky.addColorStop(0.78, "#ffc89a");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const hz = H * 0.74;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hz); ctx.clip();
  const sun = ctx.createRadialGradient(W / 2, hz + 30, 0, W / 2, hz + 30, W * 0.3);
  sun.addColorStop(0, "#fff6d6"); sun.addColorStop(0.7, "#ffd27a"); sun.addColorStop(1, "#ffb15e");
  ctx.shadowColor = "#ffd9a0"; ctx.shadowBlur = 120 * K; ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(W / 2, hz + 30, W * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#1a1530"; ctx.fillRect(0, hz, W, H - hz);           // the platform
  ctx.fillStyle = "#ffcf3f"; for (let x = 0; x < W; x += 34) ctx.fillRect(x, hz, 20, 9); // safety edge
  dotGrid(ctx, "rgba(42,22,48,0.08)");
  grain(ctx, 0.06);
  const hb = drawHeader(ctx, L, { platform: "● LAST STOP" }); drawFooter(ctx, L);
  let y = titleBlock(ctx, L, s.title || "", hb + 60, { max: 170, min: 80 });
  if (s.kicker) drawStamp(ctx, { text: s.kicker, cx: W - pad - 170, cy: y + 70, scale: 1.25, rot: -9 * DEG });
  if (s.line) {
    const b = fitBlock(ctx, s.line, F.body, 500, (W - 2 * pad) * 0.72, 220, 46, 30, 1.25);
    ctx.font = font(F.body, b.size, 500); ctx.fillStyle = C.cream; ctx.textAlign = "left";
    b.lines.forEach((ln, i) => ctx.fillText(ln, pad, y + 170 + b.size + i * b.lh));
  }
}

const DRAW = { cover: drawCover, legend: drawLegend, film: drawFilm, grid: drawGrid, climax: drawClimax, sunrise: drawSunrise };
function renderSlide(canvas, i, outW) {
  const S = SHAPES[cs.ratio] || SHAPES["3:4"], W = S.w, H = S.h;
  K = outW / W; canvas.width = Math.round(W * K); canvas.height = Math.round(H * K);
  const ctx = canvas.getContext("2d"); ctx.setTransform(K, 0, 0, K, 0, 0);
  const slide = cs.slides[i];
  (DRAW[slide.type] || drawFilm)(ctx, { W, H, pad: 72, i, n: cs.slides.length, slide, counts: tallies() });
}

/* ---------------- editor UI ---------------- */
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
let toastT = 0;
function toast(msg) { const t = $("cToast"); t.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => (t.textContent = ""), 4000); }

function field(label, obj, key, { kind = "text", options = null, rows = 3, id, onInput = null } = {}) {
  const wrap = el("div", "field"); const lab = el("label", null, label); lab.htmlFor = id; let inp;
  if (options) { inp = el("select"); for (const [v, t] of options) { const o = el("option", null, t); o.value = v; inp.append(o); } }
  else if (kind === "textarea") { inp = el("textarea"); inp.rows = rows; inp.style.minHeight = "0"; }
  else { inp = el("input"); inp.type = "text"; }
  inp.id = id; inp.value = obj[key] ?? "";
  inp.addEventListener("input", () => { obj[key] = inp.value; onInput && onInput(); changed(false); });
  wrap.append(lab, inp); return wrap;
}
function check(label, obj, key, id) {
  const lab = el("label"); const inp = el("input"); inp.type = "checkbox"; inp.id = id; inp.checked = !!obj[key];
  inp.addEventListener("input", () => { obj[key] = inp.checked; changed(false); });
  lab.append(inp, document.createTextNode(" " + label)); const t = el("div", "toggles"); t.append(lab); return t;
}
function section(title, open, ...kids) {
  const d = el("details"); d.open = open; d.append(el("summary", null, title));
  const sec = el("div", "sec"); sec.append(...kids); d.append(sec); return d;
}
function iconBtn(txt, label, fn) { const b = el("button", "icon-btn", txt); b.type = "button"; b.title = label; b.setAttribute("aria-label", label); b.addEventListener("click", fn); return b; }
function posterRow(key, title) {
  const row = el("div", "poster-row"); const id = "cp-" + key.replace(/[^a-z0-9]/gi, "");
  const inp = el("input"); inp.type = "file"; inp.accept = "image/*"; inp.hidden = true; inp.id = id;
  inp.addEventListener("change", () => { const f = inp.files[0]; inp.value = ""; if (f) setPoster(key, f); });
  const up = el("label", "btn", posters.has(key) ? "Replace poster" : "Upload poster"); up.htmlFor = id;
  row.append(inp, up);
  if (posters.has(key)) row.append(iconBtn("✕", `Remove poster for ${title}`, () => clearPoster(key)));
  else row.append(el("span", "state", "Using a placeholder"));
  return row;
}
const labelOf = s => s.type === "cover" ? `${cs.series} · ${cs.title}` : s.type === "legend" ? "What the stamps mean" : s.title || TYPE_NAMES[s.type];
const stampOptions = () => [["", "No stamp"], ...cs.stamps.map(s => [s.id, s.text])];

function buildRail() {
  const r = $("cRailScroll"), keepOpen = {};
  r.querySelectorAll("details").forEach(d => (keepOpen[d.querySelector("summary").textContent] = d.open));
  const open = (t, dflt) => (t in keepOpen ? keepOpen[t] : dflt);
  r.innerHTML = "";
  // slides list
  const list = el("ol", "slide-list");
  cs.slides.forEach((s, i) => {
    const li = el("li"); li.setAttribute("aria-current", String(i === sel));
    const b = el("button", "slide-pick"); b.type = "button";
    b.append(el("span", "t", pad2(i + 1)), el("span", "k", TYPE_NAMES[s.type]), el("span", "n", labelOf(s)));
    b.addEventListener("click", () => select(i));
    li.append(b, iconBtn("↑", "Move slide up", () => move(i, -1)), iconBtn("↓", "Move slide down", () => move(i, 1)), iconBtn("✕", "Delete slide", () => remove(i)));
    list.append(li);
  });
  const add = el("div", "addrow"); const typeSel = el("select"); typeSel.id = "cAddType"; typeSel.setAttribute("aria-label", "Slide type");
  for (const t of ["film", "grid", "climax", "legend", "cover", "sunrise"]) { const o = el("option", null, TYPE_NAMES[t]); o.value = t; typeSel.append(o); }
  const addBtn = el("button", "btn", "Add after selected"); addBtn.type = "button";
  addBtn.addEventListener("click", () => { cs.slides.splice(sel + 1, 0, BLANK[typeSel.value]()); select(sel + 1, true); });
  add.append(typeSel, addBtn);
  const n = cs.slides.length;
  const listSec = section(`Slides (${n}${n > 20 ? " · Instagram allows 20" : ""})`, open(`Slides (${n})`, true), list, add);

  // selected slide editor
  const s = cs.slides[sel], f = [], sid = s.id;
  const relabel = () => { const n2 = document.querySelector(`.slide-list li:nth-child(${sel + 1}) .n`); if (n2) n2.textContent = labelOf(s); };
  f.push(field("Time on the board", s, "time", { id: "cs-time" }));
  if (s.platform !== undefined) f.push(field("Platform (tier)", s, "platform", { id: "cs-platform" }));
  if (s.title !== undefined) f.push(field(s.type === "sunrise" ? "Headline" : "Title", s, "title", { id: "cs-title", onInput: relabel }));
  if (s.meta !== undefined) f.push(field("Year · director", s, "meta", { id: "cs-meta" }));
  if (s.line !== undefined) f.push(field(s.type === "legend" ? "Note at the bottom" : s.type === "grid" ? "Subheading" : "One-liner", s, "line", { kind: "textarea", rows: 2, id: "cs-line" }));
  if (s.kicker !== undefined) f.push(field("Stamp under the headline", s, "kicker", { id: "cs-kicker" }));
  if (s.spike !== undefined) f.push(field("The one-up (wobbly line)", s, "spike", { id: "cs-spike" }));
  if (s.stamp !== undefined) f.push(field("Stamp", s, "stamp", { options: stampOptions(), id: "cs-stamp", onInput: () => buildRail() }));
  if (s.type === "film" || s.type === "climax") f.push(posterRow(sid, s.title));
  if (s.type === "grid") {
    (s.items || []).forEach((it, k) => {
      const card = el("div", "subcard"); const head = el("div", "subcard-head"); head.append(el("span", null, `Poster ${k + 1}`),
        iconBtn("✕", `Remove ${it.title}`, () => { s.items.splice(k, 1); clearPoster(`${sid}:${it.id}`); buildRail(); }));
      card.append(head, field("Title", it, "title", { id: `cs-it-${k}` }), posterRow(`${sid}:${it.id}`, it.title)); f.push(card);
    });
    if ((s.items || []).length < 6) { const b = el("button", "btn", "Add a film to the grid"); b.type = "button"; b.addEventListener("click", () => { s.items.push({ id: uid(), title: "New film" }); changed(true); }); f.push(b); }
  }
  if (s.type === "cover" || s.type === "legend") f.push(el("p", "hint", s.type === "cover" ? "The board lists every film, grid and climax slide automatically, with each stamp's status." : "Lists every stamp below with its meaning. Edit them under Stamps."));
  const slideSec = section(`Slide ${pad2(sel + 1)} · ${TYPE_NAMES[s.type]}`, true, ...f);

  // series
  const shape = el("div", "seg"); shape.id = "cShape";
  for (const r2 of Object.keys(SHAPES)) { const b = el("button", null, r2); b.type = "button"; b.setAttribute("aria-pressed", String(cs.ratio === r2)); b.addEventListener("click", () => { cs.ratio = r2; changed(true); }); shape.append(b); }
  const shapeField = el("div", "field"); shapeField.append(el("span", "lbl", "Slide shape"), shape);
  const seriesSec = section("Series", open("Series", false),
    shapeField,
    field("Series number", cs, "series", { id: "cs-series" }), field("Title", cs, "title", { id: "cs-stitle" }),
    field("Second-language line", cs, "hindi", { id: "cs-hindi" }), field("Genre label (cover stamp)", cs, "genre", { id: "cs-genre" }),
    field("Handle", cs, "handle", { id: "cs-handle" }));

  // stamps
  const stampKids = cs.stamps.map((st, k) => {
    const card = el("div", "subcard"); const head = el("div", "subcard-head");
    head.append(el("span", null, `Stamp ${k + 1}`), iconBtn("✕", `Delete stamp ${st.text}`, () => {
      cs.stamps.splice(k, 1); cs.slides.forEach(sl => { if (sl.stamp === st.id) sl.stamp = ""; }); changed(true);
    }));
    card.append(head, field("Stamp text", st, "text", { id: `cs-st-${k}-t` }), field("Board status", st, "short", { id: `cs-st-${k}-s` }),
      field("What it means (legend)", st, "meaning", { id: `cs-st-${k}-m` }), check("Escalates with a tally each time", st, "escalates", `cs-st-${k}-e`));
    return card;
  });
  const addSt = el("button", "btn", "Add a stamp"); addSt.type = "button";
  addSt.addEventListener("click", () => { cs.stamps.push({ id: uid(), text: "New running joke", short: "STATUS", meaning: "What the joke means.", escalates: false }); changed(true); });
  const stampSec = section("Stamps (running jokes)", open("Stamps (running jokes)", false), ...stampKids, addSt);

  const reset = el("button", "btn", "Reset to the PMR#1 example"); reset.type = "button";
  reset.addEventListener("click", () => {
    if (reset.dataset.armed) { cs = defaultCarousel(); sel = 0; changed(true); toast("Carousel reset to the example."); return; }
    reset.dataset.armed = "1"; reset.textContent = "Click again to replace everything"; setTimeout(() => { if (reset.isConnected) { delete reset.dataset.armed; reset.textContent = "Reset to the PMR#1 example"; } }, 4000);
  });
  const resetSec = section("Start over", false, el("p", "hint", "Replaces every slide and stamp with the example. Uploaded posters stay saved but go unused."), reset);

  r.append(listSec, slideSec, seriesSec, stampSec, resetSec);
  $("cExportW").value = cs.export.width; $("cExportFmt").value = cs.export.format;
}

function buildStrip() {
  const st = $("strip"); st.innerHTML = "";
  cs.slides.forEach((s, i) => {
    const b = el("button"); b.type = "button"; b.setAttribute("aria-current", String(i === sel)); b.setAttribute("aria-label", `Slide ${i + 1}: ${labelOf(s)}`);
    const c = el("canvas"); c.style.width = "84px"; b.append(c, el("span", null, pad2(i + 1)));
    b.addEventListener("click", () => select(i)); st.append(b);
  });
}
function renderThumbs() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  $("strip").querySelectorAll("canvas").forEach((c, i) => { if (cs.slides[i]) renderSlide(c, i, 84 * dpr); });
}
function renderMain() {
  if (document.body.dataset.mode !== "carousel") return;
  const S = SHAPES[cs.ratio] || SHAPES["3:4"], box = $("cWrap").getBoundingClientRect();
  const s = Math.min((box.width - 40) / S.w, (box.height - 40) / S.h);
  const cw = Math.max(80, Math.floor(S.w * s)), dpr = Math.min(window.devicePixelRatio || 1, 2), c = $("cPreview");
  c.style.width = cw + "px"; c.style.height = Math.round(cw * S.h / S.w) + "px";
  renderSlide(c, sel, cw * dpr);
  const ew = +cs.export.width;
  $("specs").innerHTML = `<b>${cs.ratio}</b> carousel · slide <b>${sel + 1}/${cs.slides.length}</b> · ${TYPE_NAMES[cs.slides[sel].type]} · exports <b>${ew} × ${Math.round(ew * S.h / S.w)}</b>`;
}
let raf = 0, thumbT = 0;
function schedule() {
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderMain(); });
  clearTimeout(thumbT); thumbT = setTimeout(renderThumbs, 220);
}
function changed(structural) { save(); if (structural) { buildRail(); buildStrip(); } schedule(); }
function select(i, structural = false) {
  sel = Math.max(0, Math.min(cs.slides.length - 1, i));
  if (structural) { changed(true); return; }
  buildRail();
  $("strip").querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-current", String(k === sel)));
  $("strip").children[sel]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  schedule();
}
function move(i, d) {
  const j = i + d; if (j < 0 || j >= cs.slides.length) return;
  [cs.slides[i], cs.slides[j]] = [cs.slides[j], cs.slides[i]]; sel = j; changed(true);
}
function remove(i) {
  if (cs.slides.length <= 1) { toast("A carousel needs at least one slide."); return; }
  const [gone] = cs.slides.splice(i, 1);
  if (gone.type === "grid") (gone.items || []).forEach(it => posters.has(`${gone.id}:${it.id}`) && clearPoster(`${gone.id}:${it.id}`));
  else if (posters.has(gone.id)) clearPoster(gone.id);
  sel = Math.min(sel, cs.slides.length - 1); changed(true);
  toast(`Deleted slide ${i + 1}.`);
}

/* ---------------- export ---------------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
// Minimal "stored" (uncompressed) zip; PNG/JPG are already compressed.
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(10, 0, true); lh.setUint16(12, 33, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true);
    parts.push(lh, name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(14, 33, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(ch, name);
    offset += 30 + name.length + size;
  }
  const csize = central.reduce((a, p) => a + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
function slideBlob(i) {
  const c = document.createElement("canvas"); renderSlide(c, i, +cs.export.width);
  return new Promise(res => c.toBlob(res, cs.export.format === "jpeg" ? "image/jpeg" : "image/png", 0.95));
}
const ext = () => (cs.export.format === "jpeg" ? "jpg" : "png");
const fileName = i => `${slug(cs.series)}-${pad2(i + 1)}-${slug(labelOf(cs.slides[i])).slice(0, 40)}.${ext()}`;
function saveBlob(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$("cDownloadOne").addEventListener("click", async () => { const b = await slideBlob(sel); if (!b) return toast("Export failed. Try JPG or 1080 px."); saveBlob(b, fileName(sel)); toast(`Saved slide ${sel + 1}.`); });
$("cDownloadAll").addEventListener("click", async () => {
  const btn = $("cDownloadAll"); btn.disabled = true; const files = [];
  try {
    for (let i = 0; i < cs.slides.length; i++) {
      btn.textContent = `Rendering ${i + 1}/${cs.slides.length}…`;
      const b = await slideBlob(i); if (!b) throw new Error("render");
      files.push({ name: fileName(i), data: new Uint8Array(await b.arrayBuffer()) });
      await new Promise(r => setTimeout(r, 0));
    }
    saveBlob(makeZip(files), `${slug(cs.series)}-${slug(cs.title)}.zip`);
    toast(`Saved ${files.length} slides as a zip.`);
  } catch (e) { toast("Export failed. Try JPG or 1080 px."); }
  btn.disabled = false; btn.textContent = "Download all (.zip)";
});
$("cExportW").addEventListener("input", e => { cs.export.width = e.target.value; save(); schedule(); });
$("cExportFmt").addEventListener("input", e => { cs.export.format = e.target.value; save(); });

/* ---------------- mode, drop, keys ---------------- */
function setMode(m) {
  document.body.dataset.mode = m;
  try { localStorage.setItem(MODE, m); } catch (e) { /* ignore */ }
  $("modeSeg").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  if (m === "carousel") { buildRail(); buildStrip(); schedule(); }
  else window.dispatchEvent(new Event("resize"));
}
$("modeSeg").querySelectorAll("button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));

function dropTarget() {
  const s = cs.slides[sel];
  if (s.type === "film" || s.type === "climax") return s.id;
  if (s.type === "grid" && s.items?.length) { const it = s.items.find(it => !posters.has(`${s.id}:${it.id}`)) || s.items[0]; return `${s.id}:${it.id}`; }
  return null;
}
function takeFile(f) {
  if (document.body.dataset.mode !== "carousel" || !f) return;
  const key = dropTarget();
  if (!key) { toast("Select a film, grid or climax slide first, then drop the poster."); return; }
  setPoster(key, f);
}
window.addEventListener("drop", e => takeFile(e.dataTransfer?.files?.[0]));
window.addEventListener("paste", e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith("image/")); if (f && document.body.dataset.mode === "carousel") { e.preventDefault(); takeFile(f); } });
window.addEventListener("keydown", e => {
  if (document.body.dataset.mode !== "carousel" || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
  if (e.key === "ArrowRight") { select(sel + 1); e.preventDefault(); }
  if (e.key === "ArrowLeft") { select(sel - 1); e.preventDefault(); }
});
new ResizeObserver(() => schedule()).observe($("cWrap"));

/* ---------------- boot ---------------- */
(async () => {
  let mode = "single"; try { mode = localStorage.getItem(MODE) || "single"; } catch (e) { /* ignore */ }
  const faces = [font(F.dot, 40, 900), font(F.dot, 40, 800), font(F.sign, 40), font(F.stamp, 40), font(F.body, 40, 500), font(F.body, 40, 500, "italic")]
    .map(f => document.fonts.load(f)).concat(document.fonts.load(font(F.hindi, 40), "रात के ख़तरे"));
  setMode(mode);
  await Promise.allSettled([loadPosters(), ...faces]);
  phCache.clear(); distress = null;
  if (document.body.dataset.mode === "carousel") { buildRail(); buildStrip(); }
  schedule();
})();
})();
