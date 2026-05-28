import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';
import copy from 'rollup-plugin-copy';

/* ---------------------------------------------------------------------------
   Build
   ---------------------------------------------------------------------------
   Entry is src/js/main.js. It imports content.json (bundled by @rollup/plugin-json)
   and the two stylesheets (main.css then article.css), which rollup-plugin-postcss
   extracts and concatenates into a single dist/assets/styles.css. The HTML pages,
   the content folder, and anything in public/ are copied across verbatim.

   index.html links  /js/main.js  (the bundle)  →  pulls in styles.css.
   article.html links /assets/styles.css directly (it has no JS of its own).
   --------------------------------------------------------------------------- */

export default {
  input: 'src/js/main.js',
  output: {
    file: 'dist/js/main.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [
    nodeResolve(),
    json(),
    postcss({
      extract: 'assets/styles.css',   // → dist/assets/styles.css
      minimize: true,
    }),
    copy({
      targets: [
        { src: 'src/index.html',   dest: 'dist' },
        { src: 'src/article.html', dest: 'dist' },
        { src: 'src/404.html',     dest: 'dist' },   // Vercel serves this for not-found routes
        { src: 'src/content',      dest: 'dist' },   // content.json shipped for reference/edits
        { src: 'public/*',         dest: 'dist' },   // favicon, square.png, etc.
      ],
    }),
  ],
};
