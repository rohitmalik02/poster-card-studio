/* One H.264 encoder (the same minih264 build the page uses) in its own thread. The kit splits a reel into a few
   runs of frames and gives each run to one of these, so the runs encode side by side; kit.js joins the pieces.
   Messages in:  { type: "start", opts }  · { type: "frame", buf } (RGBA, width × height × 4) · { type: "end" }
   Messages out: { type: "done" } per frame · { type: "mp4", out } · { type: "error", message } */
importScripts("vendor/mp4-h264.js", "vendor/mp4-h264.wasm.js");
/* global Mp4H264, MP4_H264_WASM */
const ready = Mp4H264({ wasmBinary: Uint8Array.from(atob(MP4_H264_WASM), ch => ch.charCodeAt(0)) });
let enc = null;
onmessage = async ({ data: d }) => {
  try {
    const M = await ready;
    if (d.type === "start") enc = M.create(d.opts);
    else if (d.type === "frame") { enc.encodeRGB(new Uint8Array(d.buf)); postMessage({ type: "done" }); }
    else if (d.type === "end") { const out = enc.end(); enc = null; postMessage({ type: "mp4", out }, [out.buffer]); }
  } catch (e) {
    postMessage({ type: "error", message: String((e && e.message) || e) });
  }
};
