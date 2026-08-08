/**
 * Resize public/favicon.png into PWA / Apple touch icons.
 * Run: bun scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';

const src = 'public/favicon.png';
const outDir = 'public/icons';
mkdirSync(outDir, { recursive: true });

async function make(size, out, { maskable = false } = {}) {
  const scale = maskable ? 0.72 : 0.7;
  const inner = Math.round(size * scale);
  const resized = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const pad = Math.round((size - inner) / 2);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 37, g: 99, b: 235, alpha: 1 },
    },
  })
    .composite([
      maskable
        ? { input: resized, left: pad, top: pad }
        : { input: resized, gravity: 'centre' },
    ])
    .png()
    .toFile(out);
  console.log('wrote', out);
}

await make(192, `${outDir}/pwa-192.png`);
await make(512, `${outDir}/pwa-512.png`);
await make(512, `${outDir}/pwa-512-maskable.png`, { maskable: true });
await make(180, `${outDir}/apple-touch-icon.png`);
