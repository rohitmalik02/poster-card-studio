# Poster Card Studio

A browser tool for making Instagram film-recommendation posts. Load a 2:3 poster and it builds a post around it:

- a blurred, colour-boosted backdrop taken from the poster
- the title, credits, a star rating and a short paragraph, all editable
- an accent colour pulled from the poster

## Features

- Post shapes: 3:4, 4:5, 1:1, 9:16 and 3:2
- Layouts: Stacked, Split and Triptych, each with a landscape and a portrait version
- Type styles: Criterion, Marquee, Arthouse and Zine (chrome lettering)
- Export as PNG or JPG at 1080, 1440 or 2160 px wide
- Everything runs in the browser. Images are never uploaded anywhere.

## Run locally

Open `public/index.html` in a browser. There's no build step. Fonts load from Google Fonts, so you need to be online.

## Deploy

The site is static, and `public/` is the whole thing.

- **Cloudflare Pages:** connect this repo, leave the build command empty and set the output directory to `public`.
- **Cloudflare Workers:** run `npx wrangler deploy`. It uses `wrangler.jsonc`.

`public/_headers` sets a strict Content-Security-Policy and other security headers.
