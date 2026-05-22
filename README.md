# Josephine Shen — personal site

A bilingual (English / 中文) single-page site, built with **Rollup** and
deployable to **Vercel**. All text content lives in one JSON file so it can be
edited without touching code.

## Project structure

```
josephine-site/
├── package.json          # dependencies + scripts (yarn)
├── rollup.config.mjs     # build config
├── vercel.json           # Vercel deploy config
├── src/
│   ├── index.html        # page markup (no inline styles/scripts)
│   ├── content/
│   │   └── content.json  # ← ALL TEXT lives here (the file for Josie)
│   ├── styles/
│   │   └── main.css      # all styling
│   └── js/
│       └── main.js       # all behaviour (language toggle, accordion, etc.)
└── public/               # static files copied as-is (favicons, images…)
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- [Yarn](https://yarnpkg.com/) — if you don't have it: `npm install -g yarn`

## Local development

```bash
yarn install      # install dependencies (first time only)
yarn dev          # start dev server with live reload at http://localhost:5173
```

Edit any file in `src/` and the browser reloads automatically.

## Build for production

```bash
yarn build        # outputs the finished site to dist/
yarn preview      # optional: serve dist/ locally to check the build
```

## Editing the text (for Josie)

**You only need to touch one file: `src/content/content.json`.**

- Every piece of text has an English (`en`) and Chinese (`zh`) version. Keep
  both filled in.
- Edit the text on the **right** of the colon, inside the quotes. Don't rename
  the labels on the left.
- You can use a little HTML: `<br/>` makes a line break, `&amp;` is the `&`
  symbol.
- The `work` section is a list — each `{ ... }` block is one entry. Copy a whole
  block (including the surrounding braces and the comma) to add another.
- Contact details (email, LinkedIn, city, year) are in the `contact` block near
  the top.
- After saving, redeploy (see below) for the changes to go live.

Tip: paste the file into a JSON checker (e.g. jsonlint.com) before deploying to
catch a missing comma or quote.

## Deploying to Vercel

### Option A — GitHub (recommended)

1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) → **Add New… → Project** → import the
   repo.
3. Vercel reads `vercel.json` automatically:
   - Build command: `yarn build`
   - Output directory: `dist`
   - Install command: `yarn install`
4. Click **Deploy**. Every future `git push` redeploys automatically.

### Option B — Vercel CLI

```bash
npm install -g vercel
vercel            # first run links the project and deploys a preview
vercel --prod     # deploy to production
```

## How it fits together

- `index.html` is plain markup. Elements tagged `data-i18n="key"` get their text
  from the matching key in `content.json`; elements tagged `data-email`,
  `data-city`, etc. get filled from the `contact` block.
- `main.js` loads `content.json`, swaps text when the language toggle is
  clicked, builds the Work accordion, runs the hero animation, and handles the
  scroll-reveal effects.
- Rollup bundles `main.js`, extracts the CSS into its own file, hashes the
  filenames for cache-busting, and injects the right `<script>`/`<link>` tags
  into `index.html`, writing the result to `dist/`.
