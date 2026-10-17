# Poster Card Studio

A browser tool for making Instagram film-recommendation posts. Load a 2:3 poster and it builds a post around it:

- a blurred, colour-boosted backdrop taken from the poster
- the title, credits, a star rating and a short paragraph, all editable
- an accent colour pulled from the poster

## Modes

- **Single post:** one postcard.
- **Carousel:** a cover followed by up to 20 postcards. Each postcard has its own poster and words, and the look is shared across the deck. The cover is either a film still or a "colour essence": a swirl made from the colours of every poster in the deck. Exports as a zip.

## Features

- Post shapes: 3:4, 4:5, 1:1, 9:16 and 3:2
- Layouts: Stacked, Split and Triptych, each with a landscape and a portrait version
- Type styles: Criterion, Marquee, Arthouse and Zine (chrome lettering)
- Export as PNG or JPG at 1080, 1440 or 2160 px wide
- Everything runs in the browser. Images are never uploaded anywhere.
- Motion (colour essence cover): the colours drift, swirl and breathe while the grain and glitter stay put, easing to a held breath at the loop point. It exports a seamless 1080 px H.264 MP4 loop (5, 8 or 12 s) using a vendored WebAssembly encoder, [mp4-h264](https://github.com/mattdesl/mp4-h264) (MIT; minih264 and minimp4, CC0), at a constant quality, so every browser makes the same file. The vendored glue is patched to avoid `new Function`, so the CSP only adds `'wasm-unsafe-eval'`.
- Work autosaves in the browser (localStorage for words and settings, IndexedDB for images).
- **Save project** downloads the whole carousel as one `.json` file: slides, posters, backdrops, cover and look. **Open project** (or dropping the file on the page) loads it back, replacing what's open. Use it for backups, for moving between devices, and for keeping one file per carousel.

## Run locally

Open `public/index.html` in a browser. There's no build step. Fonts load from Google Fonts, so you need to be online.

## Deploy

The site is static, and `public/` is the whole thing.

- **Cloudflare Pages:** connect this repo, leave the build command empty and set the output directory to `public`.
- **Cloudflare Workers:** run `npx wrangler deploy`. It uses `wrangler.jsonc`.

`public/_headers` sets a strict Content-Security-Policy and other security headers.
