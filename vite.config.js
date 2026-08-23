import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const partialsDir = path.join(root, 'src/partials');

/*  This site does not care where it is served from.
 *
 *  Every page sits at the top level and every asset in a folder beside
 *  them, so relative URLs are unambiguous: the same build works at a
 *  domain root, under /<repo>/ on GitHub Pages, or in a subfolder on
 *  someone's shared hosting. Nothing has to be configured, and there is
 *  no build flag left to get wrong.
 */
const base = './';

/*  A 40-line include step instead of a template dependency.
 *
 *      <!--@ header nav="vision" -->
 *
 *  pulls src/partials/header.html and substitutes {{nav}}. Partials hold
 *  markup only — every asset reference lives in the page or in /public —
 *  so this can run ahead of Vite's own HTML pass without fighting it.
 */
function partials() {
  const read = (name) => fs.readFileSync(path.join(partialsDir, `${name}.html`), 'utf8');

  const render = (html, depth = 0) => {
    if (depth > 4) throw new Error('partial recursion too deep');
    return html.replace(/<!--@\s*([\w-]+)([\s\S]*?)-->/g, (_, name, rawArgs) => {
      const args = {};
      for (const m of rawArgs.matchAll(/([\w-]+)="([^"]*)"/g)) args[m[1]] = m[2];
      const body = read(name).replace(/\{\{\s*([\w-]+)(?:::(\w+))?\s*\}\}/g, (__, key, filter) => {
        const value = args[key] ?? '';
        /* `items="a|b|c"` with `{{items::li}}` becomes a real list. */
        if (filter === 'li') return value.split('|').map((item) => `<li>${item}</li>`).join('');
        if (filter === 'tag') return value.split('|').map((item) => `<span class="tag">${item}</span>`).join('');
        return value;
      });
      return render(body, depth + 1);
    });
  };

  return {
    name: 'budadiri-partials',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => render(html),
    },
    configureServer(server) {
      server.watcher.add(partialsDir);
      server.watcher.on('change', (file) => {
        if (file.startsWith(partialsDir)) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

/*  Vite makes its own assets relative, but not the two kinds of URL this
 *  site uses most: files served verbatim from public/, and links from one
 *  page to another. This runs after Vite's own pass and turns anything
 *  still rooted at / into a relative path — including every candidate
 *  inside a srcset.
 */
function rebaseAbsoluteUrls() {
  const needsPrefix = (url) => url.startsWith('/') && !url.startsWith('//');
  /* Pages sit at the top level, so dropping the leading slash is enough. */
  const prefix = (url) => url.slice(1);

  const rewriteHtml = (html) =>
    html
      .replace(/\b(href|src|content)="([^"]+)"/g, (whole, attr, url) =>
        (needsPrefix(url) ? `${attr}="${prefix(url)}"` : whole))
      /* <meta http-equiv="refresh" content="0; url=/news.html"> */
      .replace(/\bcontent="(\d+;\s*url=)([^"]+)"/gi, (whole, lead, url) =>
        (needsPrefix(url) ? `content="${lead}${prefix(url)}"` : whole))
      .replace(/\bsrcset="([^"]+)"/g, (whole, set) => {
        const rebased = set
          .split(',')
          .map((candidate) => {
            const [url, ...rest] = candidate.trim().split(/\s+/);
            return [needsPrefix(url) ? prefix(url) : url, ...rest].join(' ');
          })
          .join(', ');
        return `srcset="${rebased}"`;
      });

  return {
    name: 'budadiri-rebase',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: rewriteHtml },

    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (!file.fileName.endsWith('.css') || file.type !== 'asset') continue;
        /* Stylesheets are emitted into assets/, so they climb one level
           to reach the fonts and images sitting beside it. */
        const up = '../'.repeat(file.fileName.split('/').length - 1);
        file.source = String(file.source).replace(
          /url\((['"]?)(\/[^)'"]+)\1\)/g,
          (whole, quote, url) => (needsPrefix(url) ? `url(${quote}${up}${url.slice(1)}${quote})` : whole),
        );
      }
    },
  };
}

const pages = [
  'index', 'vision', 'development', 'progress', 'parliament',
  'community', 'news', 'about', 'resources', 'media', 'admin',
  '404', 'impact', 'updates',
];

export default defineConfig({
  base,
  plugins: [partials(), rebaseAbsoluteUrls()],
  appType: 'mpa',
  build: {
    target: 'es2020',
    cssTarget: 'chrome90',
    assetsInlineLimit: 2048,
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, path.resolve(root, `${p}.html`)])),
    },
  },
  server: { host: true, port: 5173 },
});
