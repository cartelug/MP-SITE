/* Builds the preloader's two registered layers from one shared crop box:
 *   1. src/partials/sketch.html         — an engraved line-portrait, as inline SVG
 *   2. public/img/preloader-portrait-*.webp — the same crop, background removed
 *
 * Both read the same CROP constant, so when the preloader lays the photo
 * under the sketch at the same box and cross-fades, the jaw, eyes and
 * shoulders line up exactly — the sketch is resolving into the photo
 * beneath it, not two unrelated images swapping.
 *
 * The photo layer is cut from nakiyi-portrait-concept-cutout.png, an
 * alpha-matted export (rembg, u2net_human_seg) of the same source the
 * sketch reads — see the note above SRC_CUTOUT for how to regenerate it.
 * With the background gone, the resolve reveals him standing on the
 * preloader's own forest ground rather than swapping in a photo's own
 * room and out-of-focus plant.
 *
 * Run: node tools/build-preloader-sketch.mjs
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, 'src/media/source/nakiyi-portrait-concept.png');
// Regenerate with:
//   python3 -c "
//   from rembg import remove, new_session
//   s = new_session('u2net_human_seg')
//   open('src/media/source/nakiyi-portrait-concept-cutout.png','wb').write(
//     remove(open('src/media/source/nakiyi-portrait-concept.png','rb').read(),
//            session=s, alpha_matting=True,
//            alpha_matting_foreground_threshold=240,
//            alpha_matting_background_threshold=10,
//            alpha_matting_erode_size=8))"
// (pip install rembg onnxruntime — first run downloads the ~176MB model)
const SRC_CUTOUT = path.join(root, 'src/media/source/nakiyi-portrait-concept-cutout.png');
const PARTIALS = path.join(root, 'src/partials');
const IMG_OUT = path.join(root, 'public/img');

// Shared crop box, in source-image pixels (source is 1122x1402). Chosen to
// hold head-to-chest and exclude the out-of-focus plant on the left.
const CROP = { left: 220, top: 140, width: 780, height: 1000 };

// ── sketch: engraved horizontal hatching ──────────────────────────────
// Classic tone-by-line-density printmaking (banknote/gazette portraits),
// not a generic filter: darkness is drawn as hatch density, not a filled
// shape, so the line count controls resolution rather than a blur radius.
const SK_W = 440;
const SK_H = Math.round(SK_W * CROP.height / CROP.width);
const ROW_SPACING = 3.4;
const ROWS = Math.round(SK_H / ROW_SPACING);
const STEP = 1.5;
const WOBBLE_AMP = 0.5;      // cosmetic hand-drawn waver, not tone-driven
const CONTRAST = 1.34;

// Grounded in this crop's real luminance histogram: background/shirt sit
// above 200, skin midtones spread 90-200, true shadow accents sit under
// 82, and the jacket forms a dense band near 90-109 that needs a lighter
// weight of its own so it never outweighs facial shadow.
const BANDS = [
  { max: 52,  w: 2.15, o: 1.00 }, // accents: pupils, nostrils, mouth line, hair crest
  { max: 82,  w: 1.5,  o: 0.88 }, // brows, eye sockets, under-nose, jaw shadow
  { max: 120, w: 0.95, o: 0.6 },  // face/neck modelling + jacket base
  { max: 165, w: 0.55, o: 0.34 }, // faint cheek/collar transitions
];

async function buildSketch() {
  if (!existsSync(SRC_CUTOUT)) {
    throw new Error(`missing ${SRC_CUTOUT} — see the regeneration note above SRC_CUTOUT`);
  }
  const { data, info } = await sharp(SRC)
    .extract(CROP)
    .resize(SK_W, SK_H, { fit: 'fill' })
    .greyscale()
    .blur(0.45)
    .raw()
    .toBuffer({ resolveWithObject: true });

  /* The source crop box is a rectangle, but the person isn't — it also
     catches a slice of whatever is behind him (in this source, part of
     a doorway/room edge at the left). Rather than hand-tune the crop to
     dodge it, hatching is masked to the same alpha silhouette the photo
     layer already uses, so anything that isn't him never gets a line —
     the sketch's outline is his outline, not the crop box's corners. */
  const { data: maskData } = await sharp(SRC_CUTOUT)
    .extract(CROP)
    .resize(SK_W, SK_H, { fit: 'fill' })
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const lum = (x, y) => {
    x = Math.max(0, Math.min(width - 1, Math.round(x)));
    y = Math.max(0, Math.min(height - 1, Math.round(y)));
    return data[(y * width + x) * channels];
  };
  const sample = (x, y) => {
    let v = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { v += lum(x + dx, y + dy); n++; }
    v /= n;
    return Math.max(0, Math.min(255, (v - 128) * CONTRAST + 128));
  };
  const covered = (x, y) => {
    x = Math.max(0, Math.min(width - 1, Math.round(x)));
    y = Math.max(0, Math.min(height - 1, Math.round(y)));
    return maskData[y * width + x] > 128;
  };
  const bandOf = (v) => BANDS.findIndex((b) => v < b.max);

  const rowPaths = [];
  for (let r = 0; r < ROWS; r++) {
    const baseY = (r + 0.5) * ROW_SPACING;
    const srcY = (baseY / SK_H) * height;
    const nSteps = Math.floor(SK_W / STEP);
    const segsByBand = BANDS.map(() => []);

    for (let band = 0; band < BANDS.length; band++) {
      let open = false, start = 0;
      const flush = (end) => { if (open) { segsByBand[band].push([start, end]); open = false; } };
      for (let s = 0; s <= nSteps; s++) {
        const x = s * STEP;
        const b = covered(x, srcY) ? bandOf(sample(x, srcY)) : -1;
        if (b === band && !open) { open = true; start = x; }
        else if (b !== band && open) flush(x);
      }
      flush(SK_W);
    }

    for (let band = 0; band < BANDS.length; band++) {
      const segs = segsByBand[band];
      if (!segs.length) continue;
      const wob = (x) => Math.sin(x * 0.11 + r * 1.7) * WOBBLE_AMP + Math.sin(x * 0.037 + r) * WOBBLE_AMP * 0.6;
      let d = '';
      for (const [a, b] of segs) {
        if (b - a < STEP * 0.8) continue;
        const mid = (a + b) / 2;
        d += `M ${a.toFixed(1)} ${(baseY + wob(a)).toFixed(2)} Q ${mid.toFixed(1)} ${(baseY + wob(mid)).toFixed(2)} ${b.toFixed(1)} ${(baseY + wob(b)).toFixed(2)} `;
      }
      if (!d) continue;
      rowPaths.push({ d: d.trim(), w: BANDS[band].w, o: BANDS[band].o, i: r });
    }
  }

  const svgPaths = rowPaths
    .map((p) => `<path pathLength="1" d="${p.d}" style="--i:${p.i};--w:${p.w};--o:${p.o}"/>`)
    .join('\n  ');
  const svg = `<svg class="sketch-portrait" viewBox="0 0 ${SK_W} ${SK_H}" fill="none" aria-hidden="true" focusable="false">
  ${svgPaths}
</svg>
`;
  writeFileSync(path.join(PARTIALS, 'sketch.html'), svg);
  console.log(`sketch.html — ${ROWS} rows, ${rowPaths.length} paths, viewBox ${SK_W} ${SK_H}`);
}

// ── photo: the same crop, background removed, at display resolution ───
// No jpeg output: jpeg has no alpha channel, and a flattened fallback
// would put a visible rectangle back — exactly what this cutout removes.
async function buildPhoto() {
  if (!existsSync(SRC_CUTOUT)) {
    throw new Error(`missing ${SRC_CUTOUT} — see the regeneration note above SRC_CUTOUT`);
  }
  mkdirSync(IMG_OUT, { recursive: true });
  for (const w of [340, 680]) {
    const h = Math.round(w * CROP.height / CROP.width);
    const stem = path.join(IMG_OUT, `preloader-portrait-${w}`);
    await sharp(SRC_CUTOUT).extract(CROP).resize(w, h, { fit: 'fill' })
      .sharpen({ sigma: 0.6, m1: 0.4, m2: 0.9 })
      .webp({ quality: 82 })
      .toFile(`${stem}.webp`);
    console.log(`preloader-portrait-${w}.webp — ${w}x${h}, background removed`);
  }
}

await buildSketch();
await buildPhoto();
