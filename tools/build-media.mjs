/*  Budadiri East — art-direction pipeline.
 *
 *  The constituency supplied four authentic visuals. Three of them carry
 *  burned-in poster typography, so every derivative below is a deliberate
 *  crop that removes the graphic furniture and keeps only the photograph.
 *  Five separately named vision concepts are generated editorial studies;
 *  the consuming markup labels them as illustrative, never as evidence.
 *  Nothing here is decorative resizing: each entry is a framing decision.
 *
 *  Run with: npm run media
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC = 'src/media/source';
const OUT = 'public/img';

const SHADOW = { r: 0x08, g: 0x1c, b: 0x15 };   // forest-black, floors the shadows
const HILITE = { r: 0xf7, g: 0xf2, b: 0xe6 };   // warm paper, keeps highlights off white

await fs.mkdir(OUT, { recursive: true });

/* Two halves of the same supplied composite. Cropped to an identical
   365px band so the today → tomorrow transition registers exactly. */
const BAND = { width: 780, height: 365 };

const plates = [
  {
    name: 'budadiri-today',
    file: 'budadiri-today.jpg',
    crop: { left: 10, top: 458, ...BAND },
    widths: [780, 1170, 1560],
  },
  {
    name: 'budadiri-tomorrow',
    file: 'budadiri-tomorrow.jpg',
    crop: { left: 10, top: 460, ...BAND },
    widths: [780, 1170, 1560],
  },
  /* Square-ish re-crops so the phone never gets a letterbox sliver. */
  {
    name: 'budadiri-today-portrait',
    file: 'budadiri-today.jpg',
    crop: { left: 150, top: 458, width: 487, height: 365 },
    widths: [487, 974],
  },
  {
    name: 'budadiri-tomorrow-portrait',
    file: 'budadiri-tomorrow.jpg',
    crop: { left: 180, top: 460, width: 487, height: 365 },
    widths: [487, 974],
  },
  /* Five detail crops, one per development pillar. Each is a real place
     inside the supplied constituency visual rather than a stock stand-in,
     held at a modest display size so the source resolution stays honest. */
  { name: 'pillar-productive', file: 'budadiri-today.jpg',
    crop: { left: 20, top: 480, width: 420, height: 280 }, widths: [420, 840] },
  { name: 'pillar-educated', file: 'budadiri-tomorrow.jpg',
    crop: { left: 470, top: 490, width: 330, height: 220 }, widths: [420, 840] },
  { name: 'pillar-connected', file: 'budadiri-today.jpg',
    crop: { left: 380, top: 520, width: 420, height: 280 }, widths: [420, 840] },
  { name: 'pillar-climate', file: 'budadiri-today.jpg',
    crop: { left: 280, top: 462, width: 420, height: 280 }, widths: [420, 840] },
  { name: 'pillar-inclusive', file: 'budadiri-tomorrow.jpg',
    crop: { left: 200, top: 560, width: 390, height: 260 }, widths: [420, 840] },

  /* High-resolution editorial vision studies. These are intentionally kept
     under a `vision-*-concept` name so they cannot be mistaken for project
     documentation when reused outside the pillar component. */
  { name: 'vision-productive-concept', file: 'vision-productive-concept.webp',
    crop: { left: 0, top: 0, width: 1536, height: 1024 }, widths: [640, 1280] },
  { name: 'vision-educated-concept', file: 'vision-educated-concept.webp',
    crop: { left: 0, top: 0, width: 1536, height: 1024 }, widths: [640, 1280] },
  { name: 'vision-connected-concept', file: 'vision-connected-concept.webp',
    crop: { left: 0, top: 0, width: 1536, height: 1024 }, widths: [640, 1280] },
  { name: 'vision-climate-concept', file: 'vision-climate-concept.webp',
    crop: { left: 0, top: 0, width: 1536, height: 1024 }, widths: [640, 1280] },
  { name: 'vision-inclusive-concept', file: 'vision-inclusive-concept.webp',
    crop: { left: 0, top: 0, width: 1536, height: 1024 }, widths: [640, 1280] },

  /* Generated studies of Hon. Julius Nakiyi. The homepage captions make the
     distinction explicit: these are art-directed illustrative concepts based
     on constituency-supplied reference photography, never event evidence. */
  { name: 'nakiyi-portrait-concept', file: 'nakiyi-portrait-concept.png',
    crop: { left: 0, top: 0, width: 1122, height: 1402 }, widths: [454, 680] },
  { name: 'nakiyi-listening-concept', file: 'nakiyi-listening-concept.png',
    crop: { left: 0, top: 0, width: 1536, height: 1024 }, widths: [768, 1280] },
  { name: 'nakiyi-working-concept', file: 'nakiyi-working-concept.png',
    crop: { left: 0, top: 0, width: 1536, height: 1024 }, widths: [768, 1280] },

  /* The official portrait, cropped to 4:5 with the eyes near the upper third. */
  {
    name: 'nakiyi-portrait',
    file: 'julius-nakiyi-headshot.jpg',
    crop: { left: 233, top: 8, width: 454, height: 568 },
    widths: [454, 680],
    duotone: true,
  },
  {
    name: 'nakiyi-portrait-plain',
    file: 'julius-nakiyi-headshot.jpg',
    crop: { left: 233, top: 8, width: 454, height: 568 },
    widths: [454, 680],
  },
  /* Landscape official portrait — the frame border trimmed off. */
  {
    name: 'nakiyi-official',
    file: 'julius-nakiyi-headshot.jpg',
    crop: { left: 14, top: 10, width: 852, height: 560 },
    widths: [560, 852],
  },
  /* Second portrait, lifted out of a 2021 campaign poster: the yellow
     banner, coat of arms and ballot symbol are all cropped away. */
  {
    name: 'nakiyi-portrait-alt',
    file: 'julius-nakiyi-campaign.jpg',
    crop: { left: 360, top: 130, width: 300, height: 454 },
    widths: [300, 450],
  },
];

/** shadows → forest-black, highlights → warm paper: out = S + (1-S)·H·grey.
 *  The source is a flat studio headshot, so the range is stretched first —
 *  otherwise nothing ever reaches the dark end of the ramp. */
function duotone(pipe, w, h) {
  return pipe
    .greyscale()
    .normalise()
    .linear(1.32, -44)
    .composite([
      { input: { create: { width: w, height: h, channels: 3, background: HILITE } }, blend: 'multiply' },
      { input: { create: { width: w, height: h, channels: 3, background: SHADOW } }, blend: 'screen' },
    ]);
}

const written = [];

for (const plate of plates) {
  for (const w of plate.widths) {
    const h = Math.round((plate.crop.height / plate.crop.width) * w);
    const upscaled = w > plate.crop.width;

    const base = () => {
      let p = sharp(path.join(SRC, plate.file))
        .extract(plate.crop)
        .resize(w, h, { kernel: 'lanczos3' });
      if (plate.duotone) p = duotone(p, w, h);
      /* Source material is a screen capture: a light unsharp mask pays for
         itself, more so where we are asking pixels to stretch. */
      return p.sharpen({ sigma: upscaled ? 1.1 : 0.6, m1: 0.4, m2: 0.9 });
    };

    const stem = `${OUT}/${plate.name}-${w}`;
    await base().avif({ quality: 58, effort: 4 }).toFile(`${stem}.avif`);
    await base().webp({ quality: 76 }).toFile(`${stem}.webp`);
    await base().jpeg({ quality: 82, mozjpeg: true }).toFile(`${stem}.jpg`);
    written.push(`${plate.name}-${w}`);
  }
}

/* The unmodified composite is kept whole for the credits page: it is the
   document the constituency actually circulated. */
await sharp(path.join(SRC, 'budadiri-future-concept.jpg'))
  .resize(1420, null, { kernel: 'lanczos3' })
  .sharpen({ sigma: 1 })
  .webp({ quality: 78 })
  .toFile(`${OUT}/budadiri-concept-full.webp`);

await sharp(path.join(SRC, 'budadiri-east-map-card.jpg'))
  .resize(1095)
  .webp({ quality: 78 })
  .toFile(`${OUT}/budadiri-map-card.webp`);

/* Social card: the constituency band, darkened, with the statement set on it. */
const ogBand = await sharp(path.join(SRC, 'budadiri-today.jpg'))
  .extract({ left: 10, top: 458, ...BAND })
  .resize(1200, 630, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
  .modulate({ brightness: 0.62, saturation: 0.72 })
  .toBuffer();

const ogText = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0B241A" fill-opacity="0.42"/>
  <text x="72" y="150" font-family="Montserrat, Helvetica, sans-serif" font-size="20"
        letter-spacing="6" fill="#C9A227">BUDADIRI COUNTY EAST &#183; SIRONKO</text>
  <text x="68" y="330" font-family="Montserrat, Helvetica, sans-serif" font-size="126"
        font-weight="800" letter-spacing="-5" fill="#F2EEE4">PROGRESS</text>
  <text x="68" y="446" font-family="Montserrat, Helvetica, sans-serif" font-size="126"
        font-weight="800" letter-spacing="-5" fill="#F2EEE4">YOU CAN SEE.</text>
  <rect x="72" y="516" width="120" height="2" fill="#C9A227"/>
  <text x="72" y="566" font-family="Montserrat, Helvetica, sans-serif" font-size="24"
        fill="#F2EEE4" fill-opacity="0.78">Office of Hon. Julius Nakiyi &#183; Member of Parliament</text>
</svg>`);

await sharp(ogBand).composite([{ input: ogText }]).jpeg({ quality: 86 }).toFile(`${OUT}/og-budadiri-east.jpg`);

/* The 873-image PDF archive moves from a 130 KB inline script to a fetched
   JSON document, so only the media page ever pays for it. */
const legacy = await fs.readFile('tools/media-manifest.js', 'utf8');
const records = JSON.parse(legacy.slice(legacy.indexOf('['), legacy.lastIndexOf(']') + 1));
const archive = records.map((r) => ({
  d: r.doc,
  s: r.src.replace('assets/', ''),
  t: r.thumb.replace('assets/', ''),
  w: r.w,
  h: r.h,
}));
/* Roughly a third of the extracted images are rule lines and page
   furniture. They stay in the archive — it is an evidence index, not a
   gallery — but the substantial figures are listed first so the reader
   does not open onto eight screens of decorative banners. */
const substantial = (r) =>
  (r.w >= 190 && r.h >= 150 && r.w / r.h > 0.5 && r.w / r.h < 2.4 ? 0 : 1);
archive.sort((a, b) => substantial(a) - substantial(b));

await fs.mkdir('public/data', { recursive: true });
await fs.writeFile('public/data/media-archive.json', JSON.stringify(archive));

console.log(`derivatives: ${written.length} plates × 3 formats`);
console.log(`media archive: ${archive.length} records`);
