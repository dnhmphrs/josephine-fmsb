import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import resolvePlugin from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';
import html from '@rollup/plugin-html';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';
import { terser } from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dev = process.env.ROLLUP_WATCH === 'true';

/* We hand-wrote our HTML pages, so instead of letting the html plugin generate
   markup we use each file as a template and inject the hashed asset tags. */
const indexTemplate = readFileSync(resolve(__dirname, 'src/index.html'), 'utf8');
const articleTemplate = readFileSync(resolve(__dirname, 'src/article.html'), 'utf8');

// shared helper: inject the built <link>/<script> tags into a hand-written page.
// `withScript` is false for static pages (like the article) that need no JS.
const injectAssets = (tpl, files, { withScript }) => {
  const links = (files.css || [])
    .map((f) => `<link rel="stylesheet" href="/${f.fileName}" />`)
    .join('\n  ');
  const scripts = withScript
    ? (files.js || [])
        .map((f) => `<script type="module" src="/${f.fileName}"></script>`)
        .join('\n  ')
    : '';
  return tpl
    // strip any dev-only module script tags we authored into the source files
    .replace(/\s*<script type="module" src="\/js\/main\.js"><\/script>/, '')
    .replace('</head>', `  ${links}\n</head>`)
    .replace('</body>', scripts ? `  ${scripts}\n</body>` : '</body>');
};

export default {
  input: 'src/js/main.js',
  output: {
    dir: 'dist',
    format: 'es',
    entryFileNames: 'assets/[name].[hash].js',
    assetFileNames: 'assets/[name].[hash][extname]',
    sourcemap: dev,
  },
  plugins: [
    resolvePlugin(),
    json(),
    postcss({
      extract: 'assets/styles.css', // pull CSS out into its own file
      minimize: !dev,
      sourceMap: dev,
    }),
    // home page — gets the stylesheet + the main.js module
    html({
      fileName: 'index.html',
      template: ({ files }) => injectAssets(indexTemplate, files, { withScript: true }),
    }),
    // article page — static, gets the shared stylesheet only (no script)
    html({
      fileName: 'article.html',
      template: ({ files }) => injectAssets(articleTemplate, files, { withScript: false }),
    }),
    // copy anything in /public (favicons, images, etc.) straight to dist
    copy({
      targets: [{ src: 'public/*', dest: 'dist' }],
      copyOnce: true,
    }),
    !dev && terser(),
    dev && serve({ contentBase: 'dist', port: 5173, historyApiFallback: true }),
    dev && livereload('dist'),
  ].filter(Boolean),
};
