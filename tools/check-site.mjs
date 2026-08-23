import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dist = path.join(root, 'dist');
const pages = fs.readdirSync(dist).filter((name) => name.endsWith('.html')).sort();
const redirects = new Set(['impact.html', 'updates.html']);
const failures = [];
const documents = new Map(
  pages.map((page) => [page, fs.readFileSync(path.join(dist, page), 'utf8')]),
);

const report = (page, message) => failures.push(`${page}: ${message}`);
const localPath = (value) => value.split(/[?#]/)[0].replace(/^\//, '');

for (const [page, html] of documents) {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) report(page, `duplicate IDs ${duplicateIds.join(', ')}`);

  const images = [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
  if (images.some((tag) => !/\balt="[^"]*"/.test(tag))) report(page, 'image without alt text');

  if (!redirects.has(page)) {
    if (!html.includes('data-header')) report(page, 'missing shared header');
    if (!html.includes('data-mobile-dock')) report(page, 'missing mobile dock');
    if (!html.includes('<main')) report(page, 'missing main landmark');
  }

  for (const match of html.matchAll(/\b(?:src|href)="(\/[^"]+)"/g)) {
    const value = match[1];
    if (value.startsWith('//') || value === '/') continue;
    const target = path.join(dist, localPath(value));
    if (!fs.existsSync(target)) {
      report(page, `missing local target ${value}`);
      continue;
    }

    const hash = value.includes('#') ? value.split('#')[1] : '';
    if (hash && target.endsWith('.html')) {
      const targetHtml = fs.readFileSync(target, 'utf8');
      if (!targetHtml.includes(`id="${hash}"`)) report(page, `missing hash target ${value}`);
    }
  }

  for (const match of html.matchAll(/\bhref="#([^"]+)"/g)) {
    if (!html.includes(`id="${match[1]}"`)) report(page, `missing same-page hash #${match[1]}`);
  }

  for (const match of html.matchAll(/\bsrcset="([^"]+)"/g)) {
    const sources = match[1].split(',').map((source) => source.trim().split(/\s+/)[0]);
    for (const source of sources) {
      if (!source.startsWith('/') || source.startsWith('//')) continue;
      if (!fs.existsSync(path.join(dist, localPath(source)))) report(page, `missing srcset asset ${source}`);
    }
  }
}

const motionCss = fs.readFileSync(path.join(root, 'src/styles/motion.css'), 'utf8');
const environment = fs.readFileSync(path.join(root, 'src/js/env.js'), 'utf8');
const reveals = fs.readFileSync(path.join(root, 'src/js/reveal.js'), 'utf8');
const home = documents.get('index.html') || '';
const preloads = [...home.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)]
  .map((match) => match[1]);
const heavyPreloads = preloads.filter((asset) => /gsap|ScrollTrigger|lenis/i.test(asset));

if (heavyPreloads.length) report('index.html', `desktop libraries preloaded: ${heavyPreloads.join(', ')}`);
if (!motionCss.includes('@media (prefers-reduced-motion: reduce)')) report('motion.css', 'missing reduced-motion layer');
if (!environment.includes("return 'static'")) report('env.js', 'missing static motion tier');
if (!reveals.includes("env.tier !== 'desktop'")) report('reveal.js', 'mobile may load desktop line splitting');

console.log(JSON.stringify({
  pages: pages.length,
  failures,
  motion: {
    tiers: ['static', 'mobile', 'tablet', 'desktop'],
    desktopLibrariesPreloaded: heavyPreloads,
    mobileHeadlineSplittingSkipped: true,
    reducedMotionLayer: true,
  },
}, null, 2));

if (failures.length) process.exit(1);
