import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import resolvePlugin from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';
import html from '@rollup/plugin-html';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import copy from 'rollup-plugin-copy';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dev = process.env.ROLLUP_WATCH === 'true';

/* We hand-wrote src/index.html, so instead of letting the html plugin
   generate markup from scratch we use our file as a template and let the
   plugin inject the hashed <script>/<link> tags into <head>. */
const template = readFileSync(resolve(__dirname, 'src/index.html'), 'utf8');

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
    html({
      fileName: 'index.html',
      template: ({ files }) => {
        const scripts = (files.js || [])
          .map((f) => `<script type="module" src="/${f.fileName}"></script>`)
          .join('\n  ');
        const links = (files.css || [])
          .map((f) => `<link rel="stylesheet" href="/${f.fileName}" />`)
          .join('\n  ');
        // strip the dev-only module script tag, inject built asset tags
        return template
          .replace(/\s*<script type="module" src="\/js\/main\.js"><\/script>/, '')
          .replace('</head>', `  ${links}\n</head>`)
          .replace('</body>', `  ${scripts}\n</body>`);
      },
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
