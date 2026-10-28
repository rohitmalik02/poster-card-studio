/* Kit (experimental): turns the carousel project into the assets that point back to it.
   Spotlight reels (one film each), a recap reel (every film, cut to a tempo), a story set, captions,
   alt text, a Letterboxd import file and a week plan, all drawn here at 1080 × 1920 and zipped.
   Nothing is uploaded: video goes through the same in-browser encoder as the cover. */
(() => {
"use strict";
const P = window.PCS, C = window.Cover;
if (!P || !C) return;

const KEY = "poster-card-studio:kit:v1";
const DEFAULTS = { spotlight: null, bpm: 104, transition: "static", pairA: null, pairB: null, storyVideo: true, reelTitle: "", spotLength: "30", recapStyle: "grid" };
let kit = { ...DEFAULTS };
try { Object.assign(kit, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* storage unavailable */ }
let saveT = 0;
const flush = () => { clearTimeout(saveT); try { localStorage.setItem(KEY, JSON.stringify(kit)); } catch (e) { /* ignore */ } };
const save = () => { clearTimeout(saveT); saveT = setTimeout(flush, 300); };

const W = 1080, H = 1920, FPS = C.FPS || 30;
const spotLen = () => (kit.spotLength === "60" ? 60 : 30);
// Reels safe area: Instagram's header covers the top, caption/audio the bottom ~380 px, buttons the right edge.
// Reels safe area (no official spec; between Meta's ad guidance and the common 1080x1420 rule): clear of the header
// (top 250), the caption, audio and username (bottom 420) and the like/comment/share column (equal 130 side margins).
const SAFE = { top: 250, bottom: H - 420, left: 130, right: W - 130 };
const MID = (SAFE.top + SAFE.bottom) / 2; // full-screen text cards centre in the safe area
const reelTitle = () => (kit.reelTitle || "").trim() || info().title || "Our latest list";
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => 1 - Math.pow(1 - clamp(x), 3);
const fade = (t, a, d) => clamp((t - a) / d);
const span = (t, a, b, f = 0.3) => Math.min(fade(t, a, f), 1 - fade(t, b - f, f)); // fade in at a, out by b
const plain = s => (s || "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
const sentences = s => (plain(s).match(/[^.!?]+[.!?]+["')]*/g) || [plain(s)]).map(x => x.trim()).filter(Boolean);
const pad2 = n => String(n).padStart(2, "0");
const tagOf = s => "#" + plain(s).toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
function rng(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------- data ---------------- */
const films = () => P.deckData().filter(f => (f.title || "").trim());
const info = () => C.info();
const handle = () => (P.state.handle || "").trim();
const accentOf = f => f.accent || P.state.accent || "#e9b65a";
const hookOf = f => (f.reelLine || "").trim() || `Have you seen ${f.title}?`;
function reasonsOf(f) {
  const r = (f.reasons || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
  return (r.length ? r : sentences(f.blurb)).slice(0, 3);
}
function nextKicker() {
  const k = info().kicker; const m = k.match(/^(.*?)(\d+)\s*$/);
  return m ? `${m[1]}${+m[2] + 1}` : "The next list";
}
function spotlightIds(list = films()) {
  const ids = Array.isArray(kit.spotlight) ? kit.spotlight.filter(id => list.some(f => f.id === id)) : list.slice(0, 3).map(f => f.id);
  return ids;
}

/* ---------------- drawing helpers ---------------- */
const pre = () => P.preset();
const font = (kind, size) => P.fontStr(pre()[kind], size);
function fit(ctx, text, kind, maxW, maxLines, maxSize, minSize) {
  const f = pre()[kind], t = kind === "title" && f.upper ? text.toUpperCase() : text; let r;
  for (let s = maxSize; s >= minSize; s -= 2) {
    ctx.font = font(kind, s); if (kind === "title") P.setTitleTracking(ctx, f, s);
    const lines = P.wrapPlain(ctx, t, maxW); r = { size: s, lines };
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) break;
  }
  P.clearTracking(ctx); return r;
}
function lines(ctx, r, kind, x, y, lh, align, color, alpha = 1) {
  if (!r || alpha <= 0) return 0;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = font(kind, r.size); if (kind === "title") P.setTitleTracking(ctx, pre().title, r.size);
  ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillStyle = color;
  if (kind === "title") { ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 4; }
  r.lines.forEach((l, i) => ctx.fillText(l, x, y + r.size * 0.8 + i * r.size * lh));
  ctx.restore(); P.clearTracking(ctx);
  return r.size * 0.8 + (r.lines.length - 1) * r.size * lh + r.size * 0.25;
}
function label(ctx, text, x, y, size, color, align = "center", alpha = 1, track = 1) {
  if (alpha <= 0 || !text) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = font("label", size); ctx.fillStyle = color; ctx.textBaseline = "alphabetic";
  P.drawTracked(ctx, text.toUpperCase(), x, y, pre().label.track * track, size, align); ctx.restore();
}
const rr = (ctx, x, y, w, h, r) => P.rrect(ctx, x, y, w, h, r);

// Blurred, darkened, glowing backdrop from a poster (or the cover). Built once per image: the blur is the slow part.
const bgCache = new Map();
function backdrop(img, key, accent) {
  const k = key + "|" + (img ? img.width + "x" + img.height : "none") + "|" + accent;
  if (bgCache.has(k)) return bgCache.get(k);
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = "#0b0a0d"; x.fillRect(0, 0, W, H);
  if (img) {
    const s = Math.max(W / img.width, H / img.height) * 1.35, dw = img.width * s, dh = img.height * s;
    if (P.FILTER_OK) x.filter = "blur(70px) saturate(1.4)";
    x.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh); x.filter = "none";
  }
  x.fillStyle = "rgba(0,0,0,0.42)"; x.fillRect(0, 0, W, H);
  const v = x.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, H * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.6)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "soft-light"; x.globalAlpha = 0.18; x.fillStyle = accent; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "overlay"; x.globalAlpha = 0.09; x.fillStyle = x.createPattern(P.getGrain(), "repeat"); x.fillRect(0, 0, W, H);
  bgCache.set(k, c); return c;
}
function drawBackdrop(ctx, b, zoom = 1) {
  const dw = W * zoom, dh = H * zoom; ctx.drawImage(b, (W - dw) / 2, (H - dh) / 2, dw, dh);
}
// A poster with rounded corners and a soft shadow, pre-rendered at a given width.
const cardCache = new Map();
function card(f, w) {
  const k = f.id + "|" + w + "|" + (f.poster ? f.poster.width : 0);
  if (cardCache.has(k)) return cardCache.get(k);
  const h = Math.round(w * 1.5), m = Math.round(w * 0.2);
  const c = document.createElement("canvas"); c.width = w + 2 * m; c.height = h + 2 * m; const x = c.getContext("2d");
  x.shadowColor = "rgba(0,0,0,0.6)"; x.shadowBlur = m * 0.8; x.shadowOffsetY = m * 0.25; x.fillStyle = "#000";
  rr(x, m, m, w, h, Math.round(w * 0.018)); x.fill(); x.shadowColor = "transparent";
  x.save(); rr(x, m, m, w, h, Math.round(w * 0.018)); x.clip();
  if (f.poster) { x.imageSmoothingQuality = "high"; x.drawImage(f.poster, m, m, w, h); }
  else {
    x.fillStyle = "#26232a"; x.fillRect(m, m, w, h);
    x.font = font("title", Math.round(w * 0.11)); x.fillStyle = "rgba(255,255,255,0.7)"; x.textAlign = "center";
    P.wrapPlain(x, f.title, w * 0.8).forEach((l, i) => x.fillText(l, m + w / 2, m + h * 0.45 + i * w * 0.13));
  }
  x.restore();
  const r = { canvas: c, m, w, h }; cardCache.set(k, r); return r;
}
function drawCard(ctx, cd, cx, top, scale = 1, alpha = 1, tilt = 0, outline = null) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(cx, top + cd.h / 2); ctx.rotate(tilt); ctx.scale(scale, scale);
  ctx.drawImage(cd.canvas, -cd.w / 2 - cd.m, -cd.h / 2 - cd.m);
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 8 / scale; rr(ctx, -cd.w / 2 - 6, -cd.h / 2 - 6, cd.w + 12, cd.h + 12, 12); ctx.stroke(); }
  ctx.restore();
}
// The cover, rendered once (3:4) for the bridge card and the "new list" story.
let coverCache = null;
function coverImage(w = 720) {
  if (coverCache && coverCache.width === w) return coverCache;
  const c = document.createElement("canvas"); C.render(c, w, null); coverCache = c; return c;
}
function staticNoise(ctx, seed, alpha) {
  if (alpha <= 0) return;
  const r = rng(seed), pat = ctx.createPattern(P.getGrain(), "repeat");
  pat.setTransform(new DOMMatrix().translate(r() * 256, r() * 256).scale(9 + r() * 4)); // blocky grain: reads as static, compresses well
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "#7a7a7a"; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "hard-light"; ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = alpha * 0.5;
  for (let i = 0; i < 6; i++) { ctx.fillStyle = r() < 0.5 ? "#fff" : "#111"; ctx.fillRect(0, r() * H, W, 4 + r() * 30); }
  ctx.restore();
}

/* ---------------- spotlight reel (one film, then the whole list; 30 s or 1 min) ----------------
   reel title · the film (poster, title and reel line, then three reasons) · "want to watch more like this?" ·
   the whole list lands (grid or scatter), then a sweep lifts each poster with its title · follow call */
// Timing follows the words: each reason stays up for a reading pace (by word count), the list moment scales with
// the number of films, and the whole reel is capped (Quick 30 s, Long 1 min); long text gets compressed to fit.
function timeline(f) {
  const long = kit.spotLength === "60", cap = long ? 60 : 30, n = Math.max(1, films().length);
  const words = f ? reasonsOf(f).map(r => plain(r).split(/\s+/).filter(Boolean).length) : [];
  let reasons = words.map(w => (long ? 1.1 : 0.7) + w * (long ? 0.3 : 0.22));
  const d = { title: long ? 2.8 : 2.2, intro: long ? 3.4 : 2.2, more: long ? 2.4 : 1.8, list: long ? 3 + n * 1.2 : 2.2 + n * 0.7, follow: long ? 4 : 3 };
  const fixed = () => d.title + d.intro + 0.9 + d.more + d.list + d.follow;
  const sum = a => a.reduce((x, y) => x + y, 0);
  if (!long && reasons.length) { // Quick: linger on the list a little longer, paid for by the reason boxes
    const extra = 0.4 + n * 0.25, rs = sum(reasons);
    reasons = reasons.map(r => Math.max(1.5, r - extra * r / rs)); d.list += extra;
  }
  if (fixed() + sum(reasons) > cap) { // squeeze the reasons first (never below 1.6 s each), then the list moment
    const k = Math.max(0, (cap - fixed()) / Math.max(0.01, sum(reasons)));
    reasons = reasons.map(r => Math.max(1.5, r * k));
    const over = fixed() + sum(reasons) - cap; if (over > 0) d.list = Math.max(2 + n * 0.5, d.list - over);
  }
  const c = f && clipOf(f);
  if (c && reasons.length) {
    // the film section lasts as long as the trimmed clip, but no shorter than the words need (the clip loops then)
    // and no longer than the cap allows (the clip is cut off then); the reasons share the time by word count
    const need = d.intro + 0.9 + reasons.length * 1.5, room = cap - (d.title + d.more + d.list + d.follow);
    const filmLen = clamp(clipRange(f.id).len, need, Math.max(need, room));
    const total = filmLen - d.intro - 0.9, w = words.map(x => x + 3), ws = sum(w);
    reasons = w.map(x => total * x / ws);
  }
  const film = d.title - 0.2, shrink = film + d.intro, reasonsFrom = shrink + 0.6;
  const filmEnd = reasonsFrom + sum(reasons) + 0.3, more = filmEnd + 0.35, list = more + d.more - 0.2, end = list + d.list;
  return { L: Math.min(cap, end + d.follow), title: d.title, film, shrink, reasonsFrom, reasonDur: reasons, filmEnd, more, list, end };
}
// Where each poster sits in the list moment. Grid: the column count that gives the biggest posters, centred.
// Scatter: the same slots, jittered, tilted and resized like prints tossed on a table (seeded, so it's repeatable).
function listLayout(list, featuredId) {
  const gap = 20, head = 80, areaTop = SAFE.top + head, areaW = SAFE.right - SAFE.left, areaH = SAFE.bottom - areaTop, cx = W / 2;
  let best = null;
  for (let cols = 2; cols <= 5; cols++) {
    const rows = Math.ceil(list.length / cols);
    const tw = Math.floor(Math.min((areaW - gap * (cols - 1)) / cols, (areaH - gap * (rows - 1)) / rows / 1.5));
    if (!best || tw > best.tw) best = { cols, rows, tw };
  }
  const { cols, rows, tw } = best, th = tw * 1.5, gridH = rows * th + (rows - 1) * gap, gy0 = areaTop + (areaH - gridH) / 2;
  const r = rng(list.length * 7919 + 17), scatter = kit.recapStyle === "scatter";
  const slots = list.map((g, i) => {
    const row = Math.floor(i / cols), inRow = row === rows - 1 ? list.length - row * cols : cols;
    const rowW = inRow * tw + (inRow - 1) * gap, col = i - row * cols;
    let x = cx - rowW / 2 + col * (tw + gap) + tw / 2, y = gy0 + row * (th + gap), tilt = 0, scale = 1;
    if (scatter) {
      scale = 1.08 + r() * 0.22; tilt = (r() - 0.5) * 0.36;
      x += (r() - 0.5) * tw * 0.45; y += (r() - 0.5) * th * 0.3;
      const hw = tw * scale / 2, hh = th * scale / 2; // keep each poster's box inside the safe area
      x = clamp(x, SAFE.left + hw, SAFE.right - hw); y = clamp(y + th / 2, areaTop + hh, SAFE.bottom - hh) - th / 2;
    }
    return { g, x, y, tilt, scale, z: scatter ? r() : i };
  });
  if (scatter) slots.forEach(sl => { if (sl.g.id === featuredId) sl.z = 2; }); // the featured film lands on top
  return { slots, tw, th, gy0, areaTop };
}
/* ---------------- clips: a video per film, kept in this browser (too big for project files) ---------------- */
const clips = new Map(); // slide id -> { video, url, dur, ready }
function attachClip(id, blob) {
  const old = clips.get(id); if (old) { old.video.removeAttribute("src"); URL.revokeObjectURL(old.url); }
  const url = URL.createObjectURL(blob), v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  const c = { video: v, url, blob, dur: 0, ready: false }; clips.set(id, c);
  v.addEventListener("loadedmetadata", () => { c.dur = v.duration || 0; });
  v.addEventListener("loadeddata", () => { c.ready = true; syncClipUI(); soon(); });
  return c;
}
async function loadClip(id) { if (clips.has(id)) return; const b = await P.idbGet("clip:" + id); if (b) attachClip(id, b); }
const clipOf = f => { const c = clips.get(f.id); return c && c.ready ? c : null; };
const clipStart = id => +((kit.clipStart || {})[id] || 0);
const clipFrame = id => ({ x: 0.5, y: 0.5, z: 1, ...((kit.clipFrame || {})[id] || {}) });
// Where the clip sits in a w × h frame: cover-fitted, zoomed, and shifted by the framing (x, y 0..1)
function clipRect(v, w, h, fr) {
  const vw = v.videoWidth || 16, vh = v.videoHeight || 9, s = Math.max(w / vw, h / vh) * fr.z, dw = vw * s, dh = vh * s;
  return { x: (w - dw) * fr.x, y: (h - dh) * fr.y, w: dw, h: dh };
}
// The trimmed part of a clip: start..end (end defaults to the clip's end), at least half a second long
function clipRange(id) {
  const c = clips.get(id), dur = c ? c.dur : 0, st = clamp(clipStart(id), 0, Math.max(0, dur - 0.5));
  const en = clamp(+((kit.clipEnd || {})[id] ?? dur) || dur, st + 0.5, dur);
  return { start: st, end: en, len: Math.max(0.5, en - st), dur };
}
// Clip time for reel time t: plays the trimmed part from the start of the film section, looping if the section
// runs longer than the trim (so a short clip never freezes)
function clipTime(f, t) {
  const c = clipOf(f), TL = timeline(f); if (!c) return 0;
  const r = clipRange(f.id), local = clamp(t - TL.film, 0, TL.filmEnd - TL.film);
  return Math.min(r.start + (local % r.len), Math.max(0, c.dur - 0.05));
}
function seekTo(v, time) {
  if (Math.abs(v.currentTime - time) < 0.01) return Promise.resolve();
  return new Promise(res => { let done = false; const fin = () => { if (done) return; done = true; v.removeEventListener("seeked", fin); res(); };
    v.addEventListener("seeked", fin); v.currentTime = time; setTimeout(fin, 3000); });
}
// The clip, cover-fitted to the frame; `blur` 0..1 mixes in a soft version (drawn small and scaled up, which is cheap)
const blurBuf = document.createElement("canvas"); blurBuf.width = 270; blurBuf.height = 480;
function drawClip(ctx, v, blur = 0, fr = { x: 0.5, y: 0.5, z: 1 }) {
  const r = clipRect(v, W, H, fr); ctx.drawImage(v, r.x, r.y, r.w, r.h);
  if (blur > 0) {
    const b = blurBuf.getContext("2d"), q = clipRect(v, 270, 480, fr);
    if (P.FILTER_OK) b.filter = "blur(5px)";
    b.drawImage(v, q.x, q.y, q.w, q.h); b.filter = "none";
    ctx.save(); ctx.globalAlpha = blur; ctx.imageSmoothingQuality = "high"; ctx.drawImage(blurBuf, -40, -70, W + 80, H + 140);
    ctx.globalAlpha = 0.4 * blur; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}

// Shared by both modes: the opening reel title, "more like this?", the list moment and the follow call.
function drawReelTitle(ctx, t, TL, acc) {
  const ti = span(t, 0.1, TL.title + 0.1, 0.35); if (ti <= 0) return;
  const r = fit(ctx, reelTitle(), "title", SAFE.right - SAFE.left, 4, 150, 80), h = r.size * (0.8 + (r.lines.length - 1) * pre().title.lh);
  const y = MID - h / 2 + (1 - ease(fade(t, 0.1, 0.5))) * 40;
  label(ctx, info().kicker, W / 2, y - 70, 34, acc, "center", ti);
  lines(ctx, r, "title", W / 2, y, pre().title.lh, "center", "#fff", ti);
}
function drawMore(ctx, t, TL) {
  const more = span(t, TL.more, TL.list + 0.2, 0.3); if (more <= 0) return;
  const r = fit(ctx, "Want to watch more like this?", "title", SAFE.right - SAFE.left, 3, 140, 80), h = r.size * (0.8 + (r.lines.length - 1) * pre().title.lh);
  lines(ctx, r, "title", W / 2, MID - h / 2, pre().title.lh, "center", "#fff", more);
}
function drawListMoment(ctx, t, TL, list, acc) {
  if (t < TL.list) return;
  const cx = W / 2, lay = listLayout(list, null), dim = 1 - 0.9 * fade(t, TL.end - 0.1, 0.4);
  const stagger = Math.min(0.16, 1.8 / list.length), landed = TL.list + 0.2 + stagger * list.length + 0.4;
  const sweepEnd = TL.end - 0.5, per = (sweepEnd - landed) / list.length;
  const cur = t >= landed && t < sweepEnd ? Math.floor((t - landed) / per) : -1, cu = cur >= 0 ? (t - landed - cur * per) / per : 0;
  const lift = cur >= 0 ? Math.min(ease(cu / 0.25), 1 - ease((cu - 0.8) / 0.2)) : 0;
  const headY = kit.recapStyle === "scatter" ? lay.areaTop - 40 : lay.gy0 - 34;
  label(ctx, [info().kicker, reelTitle()].filter(Boolean).join("  ·  "), cx, headY, 28, acc, "center", fade(t, TL.list, 0.3) * dim);
  const order = lay.slots.map((sl, i) => ({ ...sl, i })).sort((a, b) => (a.i === cur) - (b.i === cur) || a.z - b.z);
  for (const sl of order) {
    const a = ease(fade(t, TL.list + 0.2 + sl.i * stagger, 0.3)); if (a <= 0) continue;
    const on = sl.i === cur, up = on ? lift : 0, others = cur >= 0 && !on ? 1 - 0.45 * lift : 1;
    drawCard(ctx, card(sl.g, lay.tw), sl.x, sl.y + (1 - a) * 40 - up * 20, sl.scale * (0.92 + 0.08 * a) * (1 + 0.16 * up), a * dim * others, sl.tilt * (1 - up));
  }
  if (cur >= 0 && lift > 0) { // the title under the lifted poster
    const sl = lay.slots[cur], r = fit(ctx, sl.g.title, "title", SAFE.right - SAFE.left - 60, 2, 64, 40);
    ctx.font = font("title", r.size);
    const lw = Math.min(SAFE.right - SAFE.left, Math.max(...r.lines.map(l => ctx.measureText(l).width)) + 70), lh = r.size * (0.8 + (r.lines.length - 1) * pre().title.lh) + 44;
    const ly = clamp(sl.y + lay.th * sl.scale * 1.16 - 10, SAFE.top, SAFE.bottom - lh), lx = clamp(sl.x, SAFE.left + lw / 2, SAFE.right - lw / 2);
    ctx.save(); ctx.globalAlpha = lift * dim * 0.82; ctx.fillStyle = "#000"; rr(ctx, lx - lw / 2, ly, lw, lh, 20); ctx.fill(); ctx.restore();
    lines(ctx, r, "title", lx, ly + 20, pre().title.lh, "center", "#fff", lift * dim);
  }
}
function drawFollow(ctx, t, TL, acc) {
  const br = ease(fade(t, TL.end, 0.45)); if (br <= 0) return;
  ctx.save(); ctx.globalAlpha = 0.45 * br; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); ctx.restore();
  const r = fit(ctx, "Want more recommendations?", "title", SAFE.right - SAFE.left, 3, 124, 72), h = r.size * (0.8 + (r.lines.length - 1) * pre().title.lh);
  const y = MID - h / 2 - 60;
  lines(ctx, r, "title", W / 2, y, pre().title.lh, "center", "#fff", br);
  label(ctx, handle() ? "Follow " + handle() : "Follow us", W / 2, y + h + 96, 38, acc, "center", fade(t, TL.end + 0.3, 0.4), 0.5);
  label(ctx, "for more lists like this", W / 2, y + h + 166, 26, "rgba(255,255,255,0.85)", "center", fade(t, TL.end + 0.6, 0.4));
}
// Reasons: one font size and one box height for all of them (sized for the longest), so nothing jumps or spills.
// One text size for all reasons (no more than maxSize, smaller if the longest won't fit boxMax); each box then
// hugs its own text (hs[i]); h is the tallest, which the layout reserves so nothing moves between reasons.
function reasonBox(ctx, f, maxW, boxMax, maxSize = 56) {
  const rs = reasonsOf(f), PADX = 40, PADT = 34, PADB = 30, textW = maxW - PADX * 2 + 20;
  let size = Math.max(30, Math.round(maxSize)), fits = [], hs = [];
  for (; size >= 30; size -= 2) {
    fits = rs.map(txt => { ctx.font = font("body", size); return P.wrapPlain(ctx, txt, textW); });
    hs = fits.map(l => Math.round(PADT + size * (0.8 + (l.length - 1) * pre().body.lh) + size * 0.3 + PADB));
    if (Math.max(0, ...hs) <= boxMax) break;
  }
  return { rs, fits, size, PADX, PADT, hs, h: Math.max(0, ...hs) };
}
function drawReasons(ctx, t, rb, x, y, w, TL, alpha, acc, shadow) {
  let start = TL.reasonsFrom;
  rb.rs.forEach((txt, i) => {
    const s0 = start, s1 = start + (TL.reasonDur[i] || 2); start = s1;
    const a = span(t, s0, s1, 0.3) * alpha; if (a <= 0) return;
    const by = y + (1 - ease(fade(t, s0, 0.35))) * 40;
    const bh = rb.hs[i] || rb.h, bt = shadow ? by + rb.h - bh : by; // overlays sit on the bottom edge, the rest hang from the top
    ctx.save(); ctx.globalAlpha = a * (shadow ? 0.6 : 0.68); ctx.fillStyle = "#000";
    if (shadow) { ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 12; }
    rr(ctx, x, bt, w, bh, 24); ctx.fill(); ctx.shadowColor = "transparent";
    ctx.globalAlpha = a; ctx.fillStyle = acc; rr(ctx, x, bt, 10, bh, 5); ctx.fill(); ctx.restore();
    lines(ctx, { size: rb.size, lines: rb.fits[i] }, "body", x + rb.PADX, (shadow ? by + rb.h - bh : by) + rb.PADT, pre().body.lh, "left", "#fff", a);
  });
}
// The opening lines under the title: year · director, then the cast, then the reel line
function introBits(ctx, f, maxW) {
  const meta = [f.year, f.director].filter(Boolean).join("  ·  "), cast = (f.cast || "").split(/\s*,\s*/).filter(Boolean).slice(0, 3).join("  ·  ");
  const hook = (f.reelLine || "").trim(), hr = hook ? fit(ctx, hook, "body", maxW, 2, 54, 40) : null;
  const h = (meta ? 52 : 0) + (cast ? 46 : 0) + (hr ? 30 + hr.size * (0.8 + (hr.lines.length - 1) * pre().body.lh) + hr.size * 0.25 : 0);
  return { meta, cast, hr, h };
}
function drawIntroBits(ctx, b, x, y, alphaMeta, alphaHook) {
  let yy = y;
  if (b.meta) { yy += 34; label(ctx, b.meta, x, yy, 28, "rgba(255,255,255,0.85)", "center", alphaMeta); yy += 18; }
  if (b.cast) { yy += 32; label(ctx, b.cast, x, yy, 24, "rgba(255,255,255,0.7)", "center", alphaMeta, 0.6); yy += 14; }
  if (b.hr) lines(ctx, b.hr, "body", x, yy + 30, pre().body.lh, "center", "rgba(255,255,255,0.92)", alphaHook);
}

function drawSpotlight(ctx, t, f, idx, n) {
  const acc = accentOf(f), list = films(), cx = W / 2, TL = timeline(f), clip = clipOf(f);
  if (clip) return drawSpotlightClip(ctx, t, f, clip, TL, list, acc);
  drawBackdrop(ctx, backdrop(f.poster, f.id, acc), 1.04 + 0.05 * (t / TL.L));
  drawReelTitle(ctx, t, TL, acc);
  // the film: full size and centred (title, year · director, cast, reel line), then the poster and title
  // shrink and rise to make room for the reasons underneath
  const F = TL.film, film = Math.min(ease(fade(t, F, 0.55)), 1 - fade(t, TL.filmEnd - 0.35, 0.35));
  if (film > 0) {
    const pw = 640, cd = card(f, pw), maxW = SAFE.right - SAFE.left, gap = 46, avail = SAFE.bottom - SAFE.top;
    const tr = fit(ctx, f.title, "title", maxW, 2, 112, 60), th = tr.size * (0.8 + (tr.lines.length - 1) * pre().title.lh) + tr.size * 0.25;
    const bits = introBits(ctx, f, maxW), hA = cd.h + gap + th + bits.h, hB = cd.h + gap + th;
    // breathing room between the title and the box: at least 96 px, and spare height goes here first (up to 190)
    // reason text sits just under the shrunk title's size: size it for a first guess at the shrink, then refit
    const boxMax = Math.round(avail * 0.44), minGap = 96;
    let rb = reasonBox(ctx, f, maxW, boxMax, tr.size * 0.8 * 0.8);
    let sB = Math.min(0.8, (avail - rb.h - minGap) / hB);
    rb = reasonBox(ctx, f, maxW, boxMax, Math.min(rb.size, tr.size * sB * 0.8));
    sB = Math.min(0.8, (avail - rb.h - minGap) / hB);
    const spare = Math.max(0, avail - (hB * sB + minGap + rb.h));
    const gapB = minGap + Math.min(spare, 94), stackH = hB * sB + gapB + rb.h, sA = Math.min(1, avail / hA);
    const topB = SAFE.top + Math.max(0, (avail - stackH) / 2), topA = MID - hA * sA / 2;
    const shrink = TL.shrink, k = ease(fade(t, shrink, 0.7));
    const s = sA + (sB - sA) * k, top = topA + (topB - topA) * k, pop = 0.9 + 0.1 * ease(fade(t, F, 0.7));
    ctx.save(); ctx.translate(cx, top); ctx.scale(s * pop, s * pop);
    drawCard(ctx, cd, 0, 0, 1, film);
    lines(ctx, tr, "title", 0, cd.h + gap, pre().title.lh, "center", "#fff", film * fade(t, F + 0.4, 0.35));
    drawIntroBits(ctx, bits, 0, cd.h + gap + th, film * fade(t, F + 0.6, 0.35) * (1 - k), film * fade(t, F + 0.8, 0.35) * (1 - k));
    ctx.restore();
    drawReasons(ctx, t, rb, SAFE.left, topB + hB * sB + gapB, maxW, TL, film, acc, false);
  }
  drawMore(ctx, t, TL); drawListMoment(ctx, t, TL, list, acc); drawFollow(ctx, t, TL, acc);
}

// Clip mode: the clip fills the screen. The reel title sits on a blurred freeze of it; the blur clears as the clip
// plays; the film's title and then the reasons come up at the bottom with shadows (no blur); when it ends, the
// picture blurs again under the list moment and the follow call.
function drawSpotlightClip(ctx, t, f, clip, TL, list, acc) {
  const F = TL.film, blur = t < F + 0.9 ? 1 - fade(t, F, 0.9) : fade(t, TL.filmEnd - 0.7, 0.7);
  drawClip(ctx, clip.video, blur, clipFrame(f.id));
  drawReelTitle(ctx, t, TL, acc);
  const film = Math.min(fade(t, F + 0.5, 0.4), 1 - fade(t, TL.filmEnd - 0.5, 0.4));
  if (film > 0) {
    // a soft shadow rising from the bottom, so white text reads on any footage
    const g = ctx.createLinearGradient(0, SAFE.bottom - 760, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.55, "rgba(0,0,0,0.45)"); g.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.save(); ctx.globalAlpha = film; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    const maxW = SAFE.right - SAFE.left, cx = W / 2, introEnd = TL.reasonsFrom;
    // the film's title, credits, cast and reel line, sitting on the bottom of the safe area
    const ia = Math.min(fade(t, F + 0.6, 0.4), 1 - fade(t, introEnd - 0.4, 0.4));
    if (ia > 0) {
      const tr = fit(ctx, f.title, "title", maxW, 2, 120, 64), th = tr.size * (0.8 + (tr.lines.length - 1) * pre().title.lh) + tr.size * 0.25;
      const bits = introBits(ctx, f, maxW), y = SAFE.bottom - th - bits.h;
      lines(ctx, tr, "title", cx, y, pre().title.lh, "center", "#fff", ia);
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 24; drawIntroBits(ctx, bits, cx, y + th, ia, ia); ctx.restore();
    }
    const rb = reasonBox(ctx, f, maxW, Math.round((SAFE.bottom - SAFE.top) * 0.34), 50);
    drawReasons(ctx, t, rb, SAFE.left, SAFE.bottom - rb.h, maxW, TL, film, accentOf(f), true);
  }
  drawMore(ctx, t, TL); drawListMoment(ctx, t, TL, list, acc); drawFollow(ctx, t, TL, acc);
}

/* ---------------- recap reel (every film, cut to the tempo) ---------------- */
const HOOK = 2.2, OUTRO = 2.8;
const beatLen = () => 4 * 60 / (+kit.bpm || 104); // four beats per film
const recapLen = n => HOOK + n * beatLen() + OUTRO;
function drawRecapFilm(ctx, f, i, n, u, alpha = 1) {
  const acc = accentOf(f), bl = beatLen();
  ctx.save(); ctx.globalAlpha = alpha;
  drawBackdrop(ctx, backdrop(f.poster, f.id, acc), 1.02 + 0.04 * (u / bl));
  const pop = ease(fade(u, 0, 0.28)), cd = card(f, 640);
  drawCard(ctx, cd, W / 2, 330, 0.94 + 0.06 * pop, 1, (1 - pop) * 0.02);
  label(ctx, `${pad2(i + 1)} / ${pad2(n)}`, 90, 190, 34, acc, "left");
  const r = fit(ctx, f.title, "title", 940, 2, 100, 56);
  const y = 330 + cd.h + 70;
  const h = lines(ctx, r, "title", W / 2, y, pre().title.lh, "center", "#fff", ease(fade(u, 0.08, 0.25)));
  const line = (f.reelLine || "").trim();
  if (line) { const lr = fit(ctx, line, "body", 860, 2, 44, 32); lines(ctx, lr, "body", W / 2, y + h + 30, pre().body.lh, "center", "rgba(255,255,255,0.88)", fade(u, 0.2, 0.25)); }
  else label(ctx, [f.year, f.director].filter(Boolean).join("  ·  "), W / 2, y + h + 56, 24, "rgba(255,255,255,0.75)", "center", fade(u, 0.2, 0.25));
  ctx.restore();
}
function drawRecap(ctx, t, list, frame) {
  const n = list.length, bl = beatLen(), end = HOOK + n * bl, ci = info();
  if (t < HOOK) {
    const cv = coverImage(720), z = 1 + 0.04 * (t / HOOK);
    drawBackdrop(ctx, backdrop(cv, "cover", P.state.accent || "#e9b65a"), 1.05);
    const w = 820 * z, h = w * cv.height / cv.width;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 80; ctx.drawImage(cv, (W - w) / 2, (H - h) / 2 - 80, w, h); ctx.restore();
    label(ctx, `${n} films  ·  ${Math.round(recapLen(n))} seconds`, W / 2, (H + h) / 2 + 20, 30, "#fff", "center", fade(t, 0.3, 0.4));
  } else if (t < end) {
    const i = Math.min(n - 1, Math.floor((t - HOOK) / bl)), u = t - HOOK - i * bl;
    drawRecapFilm(ctx, list[i], i, n, u);
    if (kit.transition === "dissolve" && u < 0.45) {
      if (i > 0) drawRecapFilm(ctx, list[i - 1], i - 1, n, bl, 1 - u / 0.45);
      else { ctx.save(); ctx.globalAlpha = 1 - u / 0.45; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    }
    if (kit.transition === "static" && u < 0.17) staticNoise(ctx, frame, 0.85 * (1 - u / 0.17));
    if (kit.transition === "flash" && u < 0.2) { ctx.save(); ctx.globalAlpha = 0.85 * (1 - u / 0.2); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  } else {
    const u = t - end;
    ctx.fillStyle = "#0b0a0d"; ctx.fillRect(0, 0, W, H);
    if (kit.transition === "static" && u < 0.17) staticNoise(ctx, frame, 0.85 * (1 - u / 0.17));
    const a = fade(u, 0.15, 0.4);
    label(ctx, ci.kicker, W / 2, 700, 28, P.state.accent || "#e9b65a", "center", a);
    const r = fit(ctx, "That's the list.", "title", 920, 2, 120, 70);
    const h = lines(ctx, r, "title", W / 2, 760, pre().title.lh, "center", "#fff", a);
    const b = fit(ctx, handle() ? `Follow ${handle()} for more lists like this.` : "Follow us for more lists like this.", "body", 820, 3, 46, 32);
    lines(ctx, b, "body", W / 2, 760 + h + 40, pre().body.lh, "center", "rgba(255,255,255,0.85)", fade(u, 0.5, 0.4));
    label(ctx, handle(), W / 2, 1260, 28, "rgba(255,255,255,0.8)", "center", fade(u, 0.8, 0.4));
  }
}

/* ---------------- stories (static, sticker space left at the bottom) ---------------- */
function storyBase(ctx, img, key, acc) { drawBackdrop(ctx, backdrop(img, key, acc), 1.05); }
function drawStoryNew(ctx, t = null) {
  const acc = P.state.accent || "#e9b65a", cv = coverImage(720);
  storyBase(ctx, cv, "cover", acc);
  label(ctx, "New list", W / 2, 200, 34, acc);
  const w = 860, h = Math.min(w * cv.height / cv.width, 1180), y = 270;
  let img = cv;
  if (t !== null) { img = drawStoryNew.frame || (drawStoryNew.frame = document.createElement("canvas")); C.render(img, w, t); }
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.65)"; ctx.shadowBlur = 90; ctx.shadowOffsetY = 30; ctx.drawImage(img, (W - w) / 2, y, w, h); ctx.restore();
  const r = fit(ctx, `All ${films().length} films are in the post`, "body", 880, 2, 46, 34);
  lines(ctx, r, "body", W / 2, y + h + 70, pre().body.lh, "center", "#fff");
  label(ctx, "Tap the sticker  ↓", W / 2, y + h + 190, 22, "rgba(255,255,255,0.7)");
}
function drawStorySeen(ctx) {
  const list = films(), n = list.length, acc = P.state.accent || "#e9b65a";
  storyBase(ctx, coverImage(720), "cover", acc);
  const r = fit(ctx, "How many of these have you seen?", "title", 940, 3, 104, 60);
  const th = lines(ctx, r, "title", W / 2, 150, pre().title.lh, "center", "#fff");
  const cols = 5, rows = Math.ceil(n / cols), gap = 18, tw = Math.floor((940 - gap * (cols - 1)) / cols);
  const maxGridH = 1450 - (170 + th + 40), thw = Math.min(tw, Math.floor((maxGridH - gap * (rows - 1)) / rows / 1.5));
  const gw = cols * thw + (cols - 1) * gap, x0 = (W - gw) / 2, y0 = 170 + th + 40;
  list.forEach((f, i) => {
    const cd = card(f, thw), cx = x0 + (i % cols) * (thw + gap) + thw / 2, y = y0 + Math.floor(i / cols) * (thw * 1.5 + gap);
    drawCard(ctx, cd, cx, y);
    label(ctx, String(i + 1), cx - thw / 2 + 10, y + 34, 22, "#fff", "left");
  });
  label(ctx, "Slide to give yourself a score  ↓", W / 2, 1560, 24, "rgba(255,255,255,0.8)");
  label(ctx, info().kicker, W / 2, 1610, 22, acc);
}
function pairFilms() {
  const list = films(); const a = list.find(f => f.id === kit.pairA) || list[0], b = list.find(f => f.id === kit.pairB && f.id !== a?.id) || list.find(f => f !== a);
  return [a, b];
}
function drawStoryPair(ctx) {
  const [a, b] = pairFilms(), acc = P.state.accent || "#e9b65a";
  storyBase(ctx, coverImage(720), "cover", acc);
  if (!a || !b) return;
  const r = fit(ctx, "Pick one for tonight", "title", 940, 2, 110, 64);
  lines(ctx, r, "title", W / 2, 170, pre().title.lh, "center", "#fff");
  [[a, 290], [b, 790]].forEach(([f, cx], k) => {
    const cd = card(f, 430); drawCard(ctx, cd, cx, 470, 1, 1, k ? 0.02 : -0.02);
    const tr = fit(ctx, f.title, "title", 440, 3, 56, 34); lines(ctx, tr, "title", cx, 470 + cd.h + 50, pre().title.lh, "center", "#fff");
  });
  ctx.save(); ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(W / 2, 470 + 322, 64, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  label(ctx, "or", W / 2, 470 + 334, 34, "#111");
  label(ctx, "Vote in the poll  ↓", W / 2, 1560, 24, "rgba(255,255,255,0.8)");
}
function drawStoryTrivia(ctx, f) {
  const acc = accentOf(f);
  ctx.fillStyle = "#0b0a0d"; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H * 0.4, H * 0.7); g.addColorStop(0, acc + "55"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  staticNoise(ctx, 7, 0.08);
  label(ctx, "Guess the film", W / 2, 420, 34, acc);
  const r = fit(ctx, f.trivia, "title", 920, 7, 96, 50);
  lines(ctx, r, "title", W / 2, 500, pre().title.lh, "center", "#fff");
  label(ctx, `It's one of the ${films().length} in ${info().kicker || "our latest list"}`, W / 2, 1420, 24, "rgba(255,255,255,0.75)");
  label(ctx, "Answer in the quiz  ↓", W / 2, 1480, 24, "rgba(255,255,255,0.85)");
}
function drawStoryNext(ctx) {
  const acc = P.state.accent || "#e9b65a";
  storyBase(ctx, coverImage(720), "cover", acc);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H);
  label(ctx, "Coming soon", W / 2, 640, 30, acc);
  const r = fit(ctx, `${nextKicker()} drops soon`, "title", 920, 3, 140, 80);
  const h = lines(ctx, r, "title", W / 2, 700, pre().title.lh, "center", "#fff");
  const b = fit(ctx, "Set a reminder so you don't miss it.", "body", 820, 2, 46, 34);
  lines(ctx, b, "body", W / 2, 700 + h + 40, pre().body.lh, "center", "rgba(255,255,255,0.85)");
  label(ctx, handle(), W / 2, 1560, 26, "rgba(255,255,255,0.8)");
}

/* ---------------- the asset list ---------------- */
function assets() {
  const list = films(), n = list.length, out = [];
  out.push({ id: "story-new", name: "Story · new list", day: 0, file: "day0-story-new-list", kind: C.moving() && kit.storyVideo ? "video" : "image",
    seconds: C.loopSec(), draw: (ctx, t) => drawStoryNew(ctx, C.moving() && kit.storyVideo ? t / C.loopSec() : null) });
  const spot = spotlightIds(list), days = [1, 3, 5];
  spot.forEach((id, k) => {
    const i = list.findIndex(f => f.id === id), f = list[i];
    out.push({ id: "spot:" + id, name: `Spotlight reel · ${f.title}`, day: days[k] ?? 8 + k, file: `${days[k] !== undefined ? "day" + days[k] : "extra"}-spotlight-${P.slug(f.title)}`,
      kind: "video", seconds: timeline(f).L, still: timeline(f).reasonsFrom + 0.8, draw: (ctx, t) => drawSpotlight(ctx, t, f, i + 1, n),
      prepare: clipOf(f) ? t => seekTo(clips.get(f.id).video, clipTime(f, t)) : null, clipFor: f });
  });
  out.push({ id: "story-seen", name: "Story · how many have you seen?", day: 2, file: "day2-story-how-many-seen", kind: "image", draw: ctx => drawStorySeen(ctx) });
  out.push({ id: "story-pair", name: "Story · this or that", day: 4, file: "day4-story-this-or-that", kind: "image", draw: ctx => drawStoryPair(ctx) });
  list.filter(f => (f.trivia || "").trim()).forEach(f => out.push({ id: "trivia:" + f.id, name: `Story · guess the film (${f.title})`, day: 4,
    file: `day4-story-guess-the-film-${P.slug(f.title)}`, kind: "image", draw: ctx => drawStoryTrivia(ctx, f) }));
  out.push({ id: "recap", name: "Recap reel · every film", day: 6, file: "day6-recap-reel", kind: "video", seconds: recapLen(n),
    draw: (ctx, t, frame) => drawRecap(ctx, t, list, frame) });
  out.push({ id: "story-next", name: "Story · next list soon", day: 7, file: "day7-story-next-list", kind: "image", draw: ctx => drawStoryNext(ctx) });
  return out;
}

/* ---------------- words: captions, alt text, Letterboxd, plan ---------------- */
const CORE_TAGS = ["#movierecommendations", "#moviestowatch", "#filmrecommendations", "#letterboxd", "#cinephile"];
function captions(list = films()) {
  const ci = info(), n = list.length, kick = ci.kicker || "this list", line = plain(ci.line).replace(/^[.…]+\s*/, "");
  const titles = list.map((f, i) => `${pad2(i + 1)} ${f.title}`).join("\n");
  const extra = [...new Set([...list.map(f => tagOf(f.title)), ...list.map(f => tagOf(f.director || ""))])].filter(t => t.length > 2);
  const out = [];
  out.push("=== POST CAPTION ===",
    `${n} films. ${ci.title}${line ? ". " + line[0].toUpperCase() + line.slice(1) : ""}`.replace(/\.\./g, "."), "",
    titles, "", "Which one are you starting with?", "", "The why-watch for every film is in the slides.", "", CORE_TAGS.join(" "), "");
  out.push("=== PINNED COMMENT ===", `Which one are you starting with? Every film has its own why-watch in the slides.`, "");
  out.push("=== MORE HASHTAGS (first comment) ===", [...CORE_TAGS, ...extra].join(" "), "");
  spotlightIds(list).forEach(id => {
    const i = list.findIndex(f => f.id === id), f = list[i];
    out.push(`=== SPOTLIGHT REEL: ${f.title} ===`, hookOf(f), "",
      `${f.title}${f.year ? ` (${f.year})` : ""}${f.director ? `, directed by ${f.director}` : ""}. No. ${i + 1} of ${n} in ${kick}: ${reelTitle()}. Want more recommendations? Follow ${handle() || "us"} for more lists like this.`, "",
      [CORE_TAGS[0], CORE_TAGS[1], tagOf(f.title)].join(" "), "");
  });
  out.push("=== RECAP REEL ===", `${n} films in ${Math.round(recapLen(n))} seconds. Want more recommendations? Follow ${handle() || "us"} for more lists like this.`, "", CORE_TAGS.slice(0, 3).join(" "), "");
  out.push("=== ALT TEXT (one per slide) ===", `Cover: ${ci.kicker} ${ci.title}. ${plain(ci.line)}`.trim());
  list.forEach((f, i) => out.push(`${i + 1}. Poster for ${f.title}${f.year ? ` (${f.year})` : ""}${f.director ? `, directed by ${f.director}` : ""}, with a short recommendation: ${plain(f.blurb)}`));
  return out.join("\n") + "\n";
}
function letterboxd(list = films()) {
  const q = s => `"${String(s ?? "").replace(/"/g, '""')}"`;
  return ["Position,Title,Year,Directors,Review", ...list.map((f, i) => [i + 1, q(f.title), f.year || "", q(f.director), q(plain(f.blurb))].join(","))].join("\n") + "\n";
}
function plan(files) {
  const by = d => files.filter(f => f.day === d).map(f => "   - " + f.name).join("\n") || "   - (nothing generated for this day)";
  const ci = info();
  return `${ci.kicker} ${ci.title}: one week of posts
${"=".repeat(40)}

Day 0  Post the carousel. Then the "new list" story with a link sticker to the post.
${by(0)}
Day 1  Spotlight reel. Pin the comment from captions.txt.
${by(1)}
Day 2  Story: "how many have you seen?" Add a slider sticker.
${by(2)}
Day 3  Spotlight reel.
${by(3)}
Day 4  Stories: this or that (poll sticker), guess the film (quiz sticker).
${by(4)}
Day 5  Spotlight reel. Try it as a trial reel (shown to non-followers first).
${by(5)}
Day 6  Recap reel.
${by(6)}
Day 7  Story: next list soon (countdown sticker). Save the week's stories as a highlight.
${by(7)}

Getting people from a reel to the post
- Pin the carousel to the top of your profile (post menu > Pin to your profile), so anyone who follows from a reel sees the full list first.
- Chain the spotlights with "Link a reel" (share screen, or the reel's ... menu): spotlight 1 > 2 > 3 > recap. Titles max 15 characters, e.g. "Next pick".
- If you edit in Edits, try adding a tappable link to your profile inside the video.
- Stories are the only place a post link works: share the carousel to your story, and keep it in a highlight.

Tips
- Add music in Instagram. The reels are silent on purpose, so any track works and nothing gets muted.
- Every reel ends by pointing at the post, so keep the post's cover as the first thing people see on your grid.
- letterboxd.csv: Letterboxd > Lists > New list > Import. It matches films by title and year.
`;
}

/* ---------------- panel ---------------- */
const $ = id => document.getElementById(id);
const pc = $("kitCanvas"); if (!pc) return;
const PREV_SCALE = 0.5; pc.width = W * PREV_SCALE; pc.height = H * PREV_SCALE;
let current = null, playing = false, t0 = 0, raf = 0;
function draw(a, t, frame = 0) {
  const ctx = pc.getContext("2d"); ctx.setTransform(PREV_SCALE, 0, 0, PREV_SCALE, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  a.draw(ctx, t, frame);
}
function stillTime(a) { return a.still ?? (a.id === "recap" ? HOOK + 0.6 : 0); }
function showCurrent() {
  const a = assets().find(x => x.id === $("kitAsset").value) || assets()[0]; current = a;
  if (a && !playing) { const t = stillTime(a); draw(a, t); if (a.prepare) a.prepare(t).then(() => { if (!playing && current === a) draw(a, t); }); }
  $("kitPlay").disabled = !a || a.kind !== "video";
}
function loop() {
  raf = 0; if (!playing || !current) return;
  const t = (performance.now() - t0) / 1000;
  if (t > current.seconds) { playing = false; $("kitPlay").textContent = "Play"; draw(current, stillTime(current)); return; }
  const f = current.clipFor, c = f && clipOf(f);
  if (c) { const want = clipTime(f, t); if (Math.abs(c.video.currentTime - want) > 0.08) c.video.currentTime = want; }
  draw(current, t, Math.floor(t * FPS)); raf = requestAnimationFrame(loop);
}
$("kitPlay").addEventListener("click", () => {
  if (!current || current.kind !== "video") return;
  playing = !playing; $("kitPlay").textContent = playing ? "Stop" : "Play";
  if (playing) { coverCache = null; t0 = performance.now(); raf = requestAnimationFrame(loop); } else showCurrent();
});
$("kitAsset").addEventListener("change", () => { playing = false; $("kitPlay").textContent = "Play"; showCurrent(); });

function refresh() {
  const list = films(), sel = $("kitAsset"), keep = sel.value;
  sel.innerHTML = ""; for (const a of assets()) { const o = document.createElement("option"); o.value = a.id; o.textContent = a.name; sel.append(o); }
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
  const box = $("kitFilms"); box.innerHTML = ""; const spot = spotlightIds(list);
  list.forEach((f, i) => {
    const l = document.createElement("label"), c = document.createElement("input"); c.type = "checkbox"; c.checked = spot.includes(f.id);
    c.addEventListener("change", () => {
      const cur = spotlightIds(); kit.spotlight = c.checked ? list.map(x => x.id).filter(id => id === f.id || cur.includes(id)) : cur.filter(id => id !== f.id);
      save(); refresh();
    });
    const s = document.createElement("span"); s.textContent = `${i + 1}. ${f.title}${(f.reelLine || "").trim() ? "" : "  (no reel line yet)"}`;
    l.append(c, s); box.append(l);
  });
  for (const [id, key] of [["kitPairA", "pairA"], ["kitPairB", "pairB"]]) {
    const s = $(id); s.innerHTML = ""; list.forEach(f => { const o = document.createElement("option"); o.value = f.id; o.textContent = f.title; s.append(o); });
    const [a, b] = pairFilms(); s.value = (key === "pairA" ? a : b)?.id || "";
  }
  $("kitBpm").value = kit.bpm; $("kitBpmOut").textContent = `${kit.bpm} bpm · ${beatLen().toFixed(1)} s a film`;
  $("kitTransition").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(kit.transition === b.dataset.v)));
  $("kitStoryVideo").checked = !!kit.storyVideo;
  if (document.activeElement !== $("kitReelTitle")) $("kitReelTitle").value = kit.reelTitle || "";
  for (const [id, key] of [["kitSpotLength", "spotLength"], ["kitRecapStyle", "recapStyle"]])
    $(id).querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(kit[key] === b.dataset.v)));
  bgCache.clear(); cardCache.clear(); coverCache = null;
  if (!playing) showCurrent();
}
let refreshT = 0;
const soon = () => { clearTimeout(refreshT); refreshT = setTimeout(refresh, 250); };
$("kitBpm").addEventListener("input", e => { kit.bpm = +e.target.value; save(); $("kitBpmOut").textContent = `${kit.bpm} bpm · ${beatLen().toFixed(1)} s a film`; soon(); });
$("kitTransition").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { kit.transition = b.dataset.v; save(); refresh(); }));
$("kitPairA").addEventListener("change", e => { kit.pairA = e.target.value; save(); soon(); });
$("kitPairB").addEventListener("change", e => { kit.pairB = e.target.value; save(); soon(); });
$("kitStoryVideo").addEventListener("change", e => { kit.storyVideo = e.target.checked; save(); refresh(); });
$("kitReelTitle").addEventListener("input", e => { kit.reelTitle = e.target.value; save(); soon(); });
document.querySelectorAll("#kitSpotLength button, #reasons").forEach(el => el.addEventListener(el.tagName === "BUTTON" ? "click" : "input", () => setTimeout(syncClipUI, 30)));
for (const [id, key] of [["kitSpotLength", "spotLength"], ["kitRecapStyle", "recapStyle"]])
  $(id).querySelectorAll("button").forEach(b => b.addEventListener("click", () => { kit[key] = b.dataset.v; save(); refresh(); }));
P.onDeckChange(soon);
// words typed into the kit fields (or anywhere) change what the kit draws
document.querySelectorAll("[data-k]").forEach(el => el.addEventListener("input", soon));
$("kitPanel").addEventListener("toggle", () => { if ($("kitPanel").open) refresh(); });

/* ---------------- export ---------------- */
async function exportKit() {
  const btn = $("kitExport"), status = $("kitStatus"); btn.disabled = true; playing = false;
  const files = [], list = films(), enc = new TextEncoder();
  if (!list.length) { status.textContent = "Add some films first."; btn.disabled = false; return; }
  bgCache.clear(); cardCache.clear(); coverCache = null;
  const all = assets(), made = [];
  try {
    for (let k = 0; k < all.length; k++) {
      const a = all[k], step = `${k + 1}/${all.length}`;
      if (a.kind === "video") {
        const frames = Math.round(a.seconds * FPS);
        const blob = await C.encodeVideo(W, H, frames, async (ctx, i) => { if (a.prepare) await a.prepare(i / FPS); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); a.draw(ctx, i / FPS, i); },
          f => { status.textContent = `${step} · ${a.name} · ${Math.round(f * 100)}%`; });
        let out = blob;
        if (a.clipFor && clipOf(a.clipFor) && keepSound(a.clipFor.id)) {
          status.textContent = `${step} · ${a.name} · adding the clip's sound`;
          try { out = await withClipSound(blob, a.clipFor, a.seconds); }
          catch (e) { console.error(e); P.toast(`${a.clipFor.title}: saved without sound (${e.message || e}).`); }
        }
        files.push({ name: a.file + ".mp4", data: new Uint8Array(await out.arrayBuffer()) });
      } else {
        status.textContent = `${step} · ${a.name}`;
        const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d");
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); a.draw(ctx, 0, 0);
        const blob = await new Promise(r => c.toBlob(r, "image/png"));
        files.push({ name: a.file + ".png", data: new Uint8Array(await blob.arrayBuffer()) });
        await new Promise(r => setTimeout(r, 0));
      }
      made.push({ day: a.day, name: files[files.length - 1].name });
    }
    files.push({ name: "captions.txt", data: enc.encode(captions(list)) });
    files.push({ name: "letterboxd.csv", data: enc.encode(letterboxd(list)) });
    files.push({ name: "PLAN.txt", data: enc.encode(plan(made)) });
    const a = document.createElement("a"); a.href = URL.createObjectURL(P.makeZip(files));
    a.download = `${P.slug([info().kicker, info().title].filter(Boolean).join(" ") || "list")}-kit.zip`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    const mb = files.reduce((s, f) => s + f.data.length, 0) / 1048576;
    status.textContent = `Kit saved: ${files.length} files, ${mb.toFixed(1)} MB.`;
  } catch (e) {
    console.error(e); status.textContent = `Kit export failed: ${e?.message || e}`;
  }
  btn.disabled = false;
}
$("kitExport").addEventListener("click", exportKit);

/* ---------------- clip sound: decoded, laid under the clip's part of the reel, AAC, packaged with the video ---------------- */
const keepSound = id => ((kit.clipAudio || {})[id] ?? true) !== false;
async function clipAudio(c) {
  if (c.audio !== undefined) return c.audio;
  try { c.audio = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(await c.blob.arrayBuffer()); }
  catch (e) { c.audio = null; } // no audio track, or a format the browser can't decode
  return c.audio;
}
// The reel's soundtrack: silent except under the clip's section, which follows the same trim and looping as the
// picture, with 0.3 s fades at its edges and tiny ones at loop seams so nothing clicks.
function soundtrack(f, L, buf) {
  const TL = timeline(f), sr = buf.sampleRate, n = Math.ceil(L * sr), chs = Math.min(2, buf.numberOfChannels);
  const out = Array.from({ length: chs }, () => new Float32Array(n)), src = Array.from({ length: chs }, (_, i) => buf.getChannelData(i));
  const r = clipRange(f.id), st = Math.floor(r.start * sr), lenS = Math.max(1, Math.floor(r.len * sr));
  const a0 = Math.floor(TL.film * sr), a1 = Math.min(n, Math.floor(TL.filmEnd * sr)), fade = Math.floor(0.3 * sr), seam = Math.floor(0.012 * sr);
  for (let i = a0; i < a1; i++) {
    const local = i - a0, pos = local % lenS, si = st + pos; if (si >= src[0].length) continue;
    let g = Math.min(1, local / fade, (a1 - i) / fade);
    if (local >= lenS && pos < seam) g *= pos / seam;
    if (lenS - pos < seam && local + (lenS - pos) < a1 - a0) g *= (lenS - pos) / seam;
    for (let c = 0; c < chs; c++) out[c][i] = src[c][si] * g;
  }
  return { sr, chs, out, n };
}
// AAC first (what Instagram expects; Chrome and Edge on Windows and Mac use the system's encoder), Opus as a
// fallback where AAC isn't available (Linux builds, Firefox).
async function encodeAAC(track) {
  if (typeof AudioEncoder === "undefined") throw new Error("this browser can't encode audio (try Chrome or Edge)");
  let cfg = null;
  for (const codec of ["mp4a.40.2", "opus"]) {
    const c = { codec, sampleRate: track.sr, numberOfChannels: track.chs, bitrate: 160000 };
    try { if ((await AudioEncoder.isConfigSupported(c)).supported) { cfg = c; break; } } catch (e) { /* try the next */ }
  }
  if (!cfg) throw new Error("this browser can't encode audio (try Chrome or Edge)");
  const chunks = []; let failed = null;
  const enc = new AudioEncoder({ output: (chunk, meta) => chunks.push({ chunk, meta }), error: e => { failed = e; } });
  enc.configure(cfg);
  for (let i = 0; i < track.n; i += 1024) {
    const m = Math.min(1024, track.n - i), data = new Float32Array(m * track.chs);
    for (let c = 0; c < track.chs; c++) data.set(track.out[c].subarray(i, i + m), c * m);
    const ad = new AudioData({ format: "f32-planar", sampleRate: track.sr, numberOfFrames: m, numberOfChannels: track.chs, timestamp: Math.round(i / track.sr * 1e6), data });
    enc.encode(ad); ad.close();
  }
  await enc.flush(); enc.close(); if (failed) throw failed;
  return { chunks, cfg };
}
// Read the H.264 samples back out of the video encoder's MP4 (it writes video only), to package them with audio.
function readMp4Video(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), u32 = o => dv.getUint32(o), typ = o => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  const find = (start, end, path) => {
    for (let o = start; o < end;) {
      let size = u32(o), hdr = 8; const t = typ(o + 4);
      if (size === 1) { size = Number(dv.getBigUint64(o + 8)); hdr = 16; } else if (size === 0) size = end - o;
      if (t === path[0]) return path.length === 1 ? { o, body: o + hdr, end: o + size } : find(o + hdr, o + size, path.slice(1));
      o += size;
    }
    return null;
  };
  const stbl = find(0, u8.length, ["moov", "trak", "mdia", "minf", "stbl"]); if (!stbl) throw new Error("couldn't read the video back");
  const box = n => find(stbl.body, stbl.end, [n]);
  const stsd = box("stsd"), avc1 = stsd.body + 8, width = dv.getUint16(avc1 + 8 + 24), height = dv.getUint16(avc1 + 8 + 26);
  const avcC = find(avc1 + 8 + 78, u8.length, ["avcC"]), desc = u8.slice(avcC.body, avcC.end);
  const stsz = box("stsz"), fixed = u32(stsz.body + 4), count = u32(stsz.body + 8), sizes = [];
  for (let i = 0; i < count; i++) sizes.push(fixed || u32(stsz.body + 12 + i * 4));
  const co = box("stco") || box("co64"), co64 = typ(co.o + 4) === "co64", nch = u32(co.body + 4), offs = [];
  for (let i = 0; i < nch; i++) offs.push(co64 ? Number(dv.getBigUint64(co.body + 8 + i * 8)) : u32(co.body + 8 + i * 4));
  const stsc = box("stsc"), ne = u32(stsc.body + 4), ents = [];
  for (let i = 0; i < ne; i++) ents.push([u32(stsc.body + 8 + i * 12), u32(stsc.body + 12 + i * 12)]);
  const stss = box("stss"), keys = new Set();
  if (stss) { const k = u32(stss.body + 4); for (let i = 0; i < k; i++) keys.add(u32(stss.body + 8 + i * 4) - 1); } else for (let i = 0; i < count; i++) keys.add(i);
  const samples = []; let si = 0;
  for (let ch = 0; ch < nch && si < count; ch++) {
    let per = 1; for (const [first, spc] of ents) if (ch + 1 >= first) per = spc;
    let off = offs[ch];
    for (let k = 0; k < per && si < count; k++, si++) { samples.push({ data: u8.subarray(off, off + sizes[si]), key: keys.has(si) }); off += sizes[si]; }
  }
  const hex = b => b.toString(16).padStart(2, "0");
  return { width, height, desc, codec: `avc1.${hex(desc[1])}${hex(desc[2])}${hex(desc[3])}`, samples };
}
let muxerP = null;
function loadMuxer() {
  return (muxerP ||= new Promise((res, rej) => {
    const sc = document.createElement("script"); sc.src = "vendor/mp4-muxer.js";
    sc.onload = () => res(window.Mp4Muxer); sc.onerror = () => { muxerP = null; sc.remove(); rej(new Error("couldn't load the audio packager")); };
    document.head.append(sc);
  }));
}
// Returns the reel with the clip's sound added, or the silent video if there's nothing to add.
async function withClipSound(videoBlob, f, L) {
  const c = clipOf(f); if (!c || !keepSound(f.id)) return videoBlob;
  const buf = await clipAudio(c); if (!buf) return videoBlob;
  const [M, aac] = await Promise.all([loadMuxer(), encodeAAC(soundtrack(f, L, buf))]);
  const v = readMp4Video(new Uint8Array(await videoBlob.arrayBuffer()));
  const muxer = new M.Muxer({ target: new M.ArrayBufferTarget(), fastStart: "in-memory", firstTimestampBehavior: "offset",
    video: { codec: "avc", width: v.width, height: v.height, frameRate: FPS },
    audio: { codec: aac.cfg.codec === "opus" ? "opus" : "aac", numberOfChannels: aac.cfg.numberOfChannels, sampleRate: aac.cfg.sampleRate } });
  const fd = 1e6 / FPS;
  v.samples.forEach((sm, i) => muxer.addVideoChunkRaw(sm.data, sm.key ? "key" : "delta", Math.round(i * fd), Math.round(fd),
    i === 0 ? { decoderConfig: { codec: v.codec, codedWidth: v.width, codedHeight: v.height, description: v.desc } } : undefined));
  aac.chunks.forEach(({ chunk, meta }) => muxer.addAudioChunk(chunk, meta));
  muxer.finalize();
  if (aac.cfg.codec === "opus") P.toast("This browser saved the clip's sound as Opus, which Instagram may not accept. Export from Chrome or Edge on Windows or Mac for AAC.");
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}

/* ---------------- clip controls (Words panel, current slide) ---------------- */
function layoutPreview() {
  const id = P.currentSlideId(), pv = $("clipPreview"), box = $("clipPhone"); if (!id || !pv.videoWidth) return;
  const r = clipRect(pv, box.clientWidth, box.clientHeight, clipFrame(id));
  Object.assign(pv.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
}
function setFrame(patch) {
  const id = P.currentSlideId(); if (!id) return;
  kit.clipFrame = { ...(kit.clipFrame || {}), [id]: { ...clipFrame(id), ...patch } }; save(); syncClipUI(); soon();
}
// drag inside the phone preview to frame the clip
(() => {
  const box = $("clipPhone"); let drag = null;
  box.addEventListener("pointerdown", e => { const pv = $("clipPreview"); if (!pv.videoWidth) return; box.setPointerCapture(e.pointerId);
    const r = clipRect(pv, box.clientWidth, box.clientHeight, clipFrame(P.currentSlideId())); drag = { x: e.clientX, y: e.clientY, fr: clipFrame(P.currentSlideId()), ox: box.clientWidth - r.w, oy: box.clientHeight - r.h }; });
  box.addEventListener("pointermove", e => { if (!drag) return;
    const nx = drag.ox < -0.5 ? clamp(drag.fr.x + (e.clientX - drag.x) / drag.ox, 0, 1) : drag.fr.x;
    const ny = drag.oy < -0.5 ? clamp(drag.fr.y + (e.clientY - drag.y) / drag.oy, 0, 1) : drag.fr.y;
    setFrame({ x: nx, y: ny }); });
  const end = () => { drag = null; };
  box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
})();
for (const [el, key] of [["clipX", "x"], ["clipY", "y"], ["clipZoom", "z"]]) $(el).addEventListener("input", e => setFrame({ [key]: +e.target.value }));
$("clipAudio").addEventListener("change", e => { const id = P.currentSlideId(); kit.clipAudio = { ...(kit.clipAudio || {}), [id]: e.target.checked }; save(); });
function syncSoundUI(id) { const cb = $("clipAudio"); if (cb) cb.checked = keepSound(id); }
function syncClipUI() {
  const id = P.currentSlideId(), c = id && clips.get(id), info2 = $("clipInfo"); if (!info2) return;
  const has = !!(c && c.ready), pv = $("clipPreview");
  $("clipClear").hidden = !has; $("clipStartRow").hidden = !has;
  if (!has) { pv.removeAttribute("src"); info2.textContent = c ? "Loading the clip…" : "No clip. The reel uses the poster."; return; }
  if (pv.dataset.url !== c.url) { pv.src = c.url; pv.dataset.url = c.url; pv.addEventListener("loadedmetadata", () => layoutPreview(), { once: true }); }
  layoutPreview(); syncSoundUI(id);
  const fr = clipFrame(id);
  for (const [el, v, txt] of [["clipX", fr.x, Math.round(fr.x * 100) + "%"], ["clipY", fr.y, Math.round(fr.y * 100) + "%"], ["clipZoom", fr.z, fr.z.toFixed(2) + "×"]]) {
    if (document.activeElement !== $(el)) $(el).value = v; $(el + "Out").textContent = txt;
  }
  const r = clipRange(id), mx = Math.floor(c.dur * 10) / 10;
  for (const el of [$("clipStart"), $("clipEnd")]) el.max = mx;
  if (document.activeElement !== $("clipStart")) $("clipStart").value = r.start;
  if (document.activeElement !== $("clipEnd")) $("clipEnd").value = r.end;
  $("clipStartOut").textContent = `${r.start.toFixed(1)} s`; $("clipEndOut").textContent = `${r.end.toFixed(1)} s · keeps ${r.len.toFixed(1)} s`;
  const f = films().find(x => x.id === id), TL = f && timeline(f), used = TL ? TL.filmEnd - TL.film : r.len;
  info2.textContent = !TL ? "" : used < r.len - 0.2 ? `The reel has room for ${used.toFixed(1)} s, so the last ${(r.len - used).toFixed(1)} s of your trim is cut off. Try Long, or trim it shorter.`
    : used > r.len + 0.2 ? `Your words need ${used.toFixed(1)} s, so the ${r.len.toFixed(1)} s trim loops to fill it.`
    : `The whole ${r.len.toFixed(1)} s trim plays. The reel runs ${TL.L.toFixed(0)} s.`;
}
$("clipFile").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = ""; const id = P.currentSlideId(); if (!file || !id) return;
  if (!file.type.startsWith("video/")) { P.toast("That isn't a video file. Try an MP4 or MOV."); return; }
  attachClip(id, file); await P.idbPut("clip:" + id, file); syncClipUI();
  P.toast("Clip added. It's kept in this browser, not in the project file.");
});
$("clipClear").addEventListener("click", async () => {
  const id = P.currentSlideId(), c = clips.get(id); if (!c) return;
  c.video.removeAttribute("src"); URL.revokeObjectURL(c.url); clips.delete(id); await P.idbPut("clip:" + id, null);
  for (const k of ["clipStart", "clipEnd", "clipFrame", "clipAudio"]) if (kit[k]) delete kit[k][id]; save(); syncClipUI(); soon();
});
for (const [el, key] of [["clipStart", "clipStart"], ["clipEnd", "clipEnd"]]) $(el).addEventListener("input", e => {
  const id = P.currentSlideId(), v = +e.target.value; kit[key] = { ...(kit[key] || {}), [id]: v }; save();
  const pv = $("clipPreview"); if (pv.src) pv.currentTime = v; // show the frame you're trimming to
  syncClipUI(); soon();
});
P.onDeckChange(() => { films().forEach(f => loadClip(f.id)); setTimeout(syncClipUI, 50); });

window.Kit = { flush, hold: () => clearTimeout(saveT), refresh, assets, captions, letterboxd, withClipSound };
setTimeout(() => { films().forEach(f => loadClip(f.id)); refresh(); syncClipUI(); }, 600);
})();
