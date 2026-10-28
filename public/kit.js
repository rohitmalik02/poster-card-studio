/* Kit (experimental): turns the carousel project into the assets that point back to it.
   Spotlight reels (one film each), a recap reel (every film, cut to a tempo), a story set, captions,
   alt text, a Letterboxd import file and a week plan, all drawn here at 1080 × 1920 and zipped.
   Nothing is uploaded: video goes through the same in-browser encoder as the cover. */
(() => {
"use strict";
const P = window.PCS, C = window.Cover;
if (!P || !C) return;

const KEY = "poster-card-studio:kit:v1";
const DEFAULTS = { spotlight: null, bpm: 104, transition: "static", pairA: null, pairB: null, storyVideo: true, reelTitle: "" };
let kit = { ...DEFAULTS };
try { Object.assign(kit, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* storage unavailable */ }
let saveT = 0;
const flush = () => { clearTimeout(saveT); try { localStorage.setItem(KEY, JSON.stringify(kit)); } catch (e) { /* ignore */ } };
const save = () => { clearTimeout(saveT); saveT = setTimeout(flush, 300); };

const W = 1080, H = 1920, FPS = C.FPS || 30, SPOT = 21;
// Reels safe area: Instagram's header covers the top, caption/audio the bottom ~380 px, buttons the right edge.
const SAFE = { top: 210, bottom: H - 400, left: 110, right: W - 110 }; // equal side margins keep things on the centre line
const MID = H * 0.47; // optical middle for full-screen text cards: a touch above centre, clear of the caption
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
function drawCard(ctx, cd, cx, top, scale = 1, alpha = 1, tilt = 0) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(cx, top + cd.h / 2); ctx.rotate(tilt); ctx.scale(scale, scale);
  ctx.drawImage(cd.canvas, -cd.w / 2 - cd.m, -cd.h / 2 - cd.m); ctx.restore();
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

/* ---------------- spotlight reel (one film, then the whole list, 21 s) ----------------
   0-2.2 reel title · 2.2-12.6 the film (poster, title and reel line, then three reasons) ·
   12.6-14.4 "want to watch more like this?" · 14.4-18.4 every poster drops into a grid · 18.4-21 where the full list is */
function drawSpotlight(ctx, t, f, idx, n) {
  const acc = accentOf(f), list = films(), cx = W / 2;
  drawBackdrop(ctx, backdrop(f.poster, f.id, acc), 1.04 + 0.05 * (t / SPOT));
  // 1. the reel's title
  const ti = span(t, 0.1, 2.3, 0.35);
  if (ti > 0) {
    const r = fit(ctx, reelTitle(), "title", SAFE.right - SAFE.left, 4, 150, 80), h = r.size * (0.8 + (r.lines.length - 1) * pre().title.lh);
    const y = MID - h / 2 + (1 - ease(fade(t, 0.1, 0.5))) * 40;
    label(ctx, info().kicker, cx, y - 70, 34, acc, "center", ti);
    lines(ctx, r, "title", cx, y, pre().title.lh, "center", "#fff", ti);
  }
  // 2. the film: poster, title and reel line start full size and centred, then shrink together and rise
  //    above the centre line to make room for the reasons underneath
  const film = Math.min(ease(fade(t, 2.2, 0.55)), 1 - fade(t, 12.25, 0.35));
  if (film > 0) {
    const pw = 640, cd = card(f, pw), maxW = SAFE.right - SAFE.left, gap = 46;
    const tr = fit(ctx, f.title, "title", maxW, 2, 112, 60), th = tr.size * (0.8 + (tr.lines.length - 1) * pre().title.lh) + tr.size * 0.25;
    const hook = (f.reelLine || "").trim(), hr = hook ? fit(ctx, hook, "body", maxW, 2, 54, 40) : null;
    const hh = hr ? 26 + hr.size * (0.8 + (hr.lines.length - 1) * pre().body.lh) : 0;
    const hA = cd.h + gap + th + hh, hB = cd.h + gap + th, sB = 0.56;
    const k = ease(fade(t, 4.0, 0.7)); // 0 = full size and centred, 1 = small and up top
    const s = 1 + (sB - 1) * k, top = (MID - hA / 2) + ((SAFE.top + 10) - (MID - hA / 2)) * k;
    const pop = 0.9 + 0.1 * ease(fade(t, 2.2, 0.7));
    ctx.save(); ctx.translate(cx, top); ctx.scale(s * pop, s * pop);
    drawCard(ctx, cd, 0, 0, 1, film);
    lines(ctx, tr, "title", 0, cd.h + gap, pre().title.lh, "center", "#fff", film * fade(t, 2.6, 0.35));
    if (hr) lines(ctx, hr, "body", 0, cd.h + gap + th + 26, pre().body.lh, "center", "rgba(255,255,255,0.9)", film * fade(t, 2.9, 0.35) * (1 - k));
    else label(ctx, [f.year, f.director].filter(Boolean).join("  ·  "), 0, cd.h + gap + th + 40, 28, "rgba(255,255,255,0.8)", "center", film * fade(t, 2.9, 0.35) * (1 - k));
    ctx.restore();
    // reasons rise into the space the shrink opened up
    const below = SAFE.top + 10 + hB * sB + 50;
    const rs = reasonsOf(f), d = 7.6 / Math.max(1, rs.length);
    rs.forEach((txt, i) => {
      const a = span(t, 4.6 + i * d, 4.6 + (i + 1) * d, 0.3) * film; if (a <= 0) return;
      const r = fit(ctx, txt, "body", maxW - 90, 5, 62, 40), rh = r.size * (0.8 + (r.lines.length - 1) * pre().body.lh);
      const bh = Math.min(rh + 120, SAFE.bottom - below), by = below + (1 - ease(fade(t, 4.6 + i * d, 0.35))) * 50;
      ctx.save(); ctx.globalAlpha = a * 0.66; ctx.fillStyle = "#000"; rr(ctx, SAFE.left - 20, by, maxW + 40, bh, 26); ctx.fill();
      ctx.globalAlpha = a; ctx.fillStyle = acc; rr(ctx, SAFE.left - 20, by, 10, bh, 5); ctx.fill(); ctx.restore();
      label(ctx, `Why watch  ·  ${i + 1}/${rs.length}`, SAFE.left + 30, by + 48, 26, acc, "left", a);
      lines(ctx, r, "body", SAFE.left + 30, by + 72, pre().body.lh, "left", "#fff", a);
    });
  }
  // 3. want more?
  const more = span(t, 12.6, 14.5, 0.3);
  if (more > 0) {
    const r = fit(ctx, "Want to watch more like this?", "title", SAFE.right - SAFE.left, 3, 140, 80), h = r.size * (0.8 + (r.lines.length - 1) * pre().title.lh);
    lines(ctx, r, "title", cx, MID - h / 2, pre().title.lh, "center", "#fff", more);
  }
  // 4. the whole list drops into a grid, and stays dimmed behind the bridge
  if (t >= 14.3) {
    const cols = list.length > 12 ? 5 : list.length > 6 ? 4 : 3, rows = Math.ceil(list.length / cols), gap = 18;
    const gridTop = SAFE.top + 120, gridW = SAFE.right - SAFE.left, availH = SAFE.bottom - gridTop - 20;
    const tw = Math.floor(Math.min((gridW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows / 1.5));
    const x0 = cx - (cols * tw + (cols - 1) * gap) / 2, dim = 1 - 0.9 * fade(t, 18.3, 0.4);
    label(ctx, [info().kicker, reelTitle()].filter(Boolean).join("  ·  "), cx, SAFE.top + 60, 28, acc, "center", fade(t, 14.3, 0.3) * dim);
    list.forEach((g, i) => {
      const a = ease(fade(t, 14.4 + i * 0.14, 0.3)); if (a <= 0) return;
      const gx = x0 + (i % cols) * (tw + gap) + tw / 2, gy = gridTop + Math.floor(i / cols) * (tw * 1.5 + gap);
      drawCard(ctx, card(g, tw), gx, gy + (1 - a) * 40, 0.92 + 0.08 * a, a * dim);
      if (g.id === f.id) { ctx.save(); ctx.globalAlpha = a * dim; ctx.strokeStyle = acc; ctx.lineWidth = 8; rr(ctx, gx - tw / 2 - 6, gy - 6, tw + 12, tw * 1.5 + 12, 12); ctx.stroke(); ctx.restore(); }
    });
  }
  // 5. where the full list lives
  const br = ease(fade(t, 18.4, 0.45));
  if (br > 0) {
    ctx.save(); ctx.globalAlpha = 0.45 * br; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); ctx.restore();
    const r = fit(ctx, "The full list is pinned on our profile", "title", SAFE.right - SAFE.left, 3, 120, 70), h = r.size * (0.8 + (r.lines.length - 1) * pre().title.lh);
    const y = MID - h / 2 - 60;
    lines(ctx, r, "title", cx, y, pre().title.lh, "center", "#fff", br);
    label(ctx, handle(), cx, y + h + 90, 36, acc, "center", br);
    label(ctx, "Tap our name to see all " + list.length, cx, y + h + 160, 26, "rgba(255,255,255,0.85)", "center", fade(t, 18.9, 0.4));
  }
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
    const b = fit(ctx, "The full list, with the why-watch for every film, is pinned on our profile.", "body", 820, 3, 46, 32);
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
      kind: "video", seconds: SPOT, draw: (ctx, t) => drawSpotlight(ctx, t, f, i + 1, n) });
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
      `${f.title}${f.year ? ` (${f.year})` : ""}${f.director ? `, directed by ${f.director}` : ""}. No. ${i + 1} of ${n} in ${kick}: ${reelTitle()}. The full list is pinned on our profile.`, "",
      [CORE_TAGS[0], CORE_TAGS[1], tagOf(f.title)].join(" "), "");
  });
  out.push("=== RECAP REEL ===", `${n} films in ${Math.round(recapLen(n))} seconds. The full list, with the why-watch for every one, is pinned on our profile.`, "", CORE_TAGS.slice(0, 3).join(" "), "");
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
- Pin the carousel to the top of your profile (post menu > Pin to your profile). Every reel ends on "the full list is pinned on our profile".
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
function stillTime(a) { return a.id.startsWith("spot:") ? 7 : a.id === "recap" ? HOOK + 0.6 : 0; }
function showCurrent() { const a = assets().find(x => x.id === $("kitAsset").value) || assets()[0]; current = a; if (a && !playing) draw(a, stillTime(a)); $("kitPlay").disabled = !a || a.kind !== "video"; }
function loop() {
  raf = 0; if (!playing || !current) return;
  const t = (performance.now() - t0) / 1000;
  if (t > current.seconds) { playing = false; $("kitPlay").textContent = "Play"; draw(current, stillTime(current)); return; }
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
        const blob = await C.encodeVideo(W, H, frames, (ctx, i) => { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); a.draw(ctx, i / FPS, i); },
          f => { status.textContent = `${step} · ${a.name} · ${Math.round(f * 100)}%`; });
        files.push({ name: a.file + ".mp4", data: new Uint8Array(await blob.arrayBuffer()) });
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

window.Kit = { flush, hold: () => clearTimeout(saveT), refresh, assets, captions, letterboxd };
setTimeout(refresh, 600);
})();
