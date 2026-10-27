// Builds the dark-mode twins of the navy ESC logos into images/dark/.
//
// Navy ink becomes soft white, California Gold stays gold, and any white
// background becomes transparent, so the logos sit cleanly on the dark theme.
// assets/js/theme/theme.js swaps them in when the bear toggle is on.
//
// Usage: npm run build:logos [-- file.png ...]   (names are relative to images/)
// Uses Playwright's Chromium (already a dev dependency) for the canvas work.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './site-pages.mjs';

export const LOGOS = [
  'main_nobckgnd.png',
  'MAIN_long_nobackground.png',
  'MAIN_nobackground.png',
  'esc_newton.png',
];

/** Recolour a PNG (as a data URL) inside the browser and return base64 PNG. */
function recolor(src) {
  return (async () => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const p = data.data;
    for (let i = 0; i < p.length; i += 4) {
      const [r, g, b, a] = [p[i], p[i + 1], p[i + 2], p[i + 3]];
      if (!a) continue;
      // Coverage comes from ink density, so white backgrounds and anti-aliased
      // edges turn transparent instead of leaving pale boxes.
      if (r > b + 40) {
        p[i + 3] = Math.round(a * Math.min(1, (255 - b) / 196));
        [p[i], p[i + 1], p[i + 2]] = [0xfb, 0xb0, 0x3b]; // gold
      } else {
        p[i + 3] = Math.round((a * (255 - g)) / 255);
        [p[i], p[i + 1], p[i + 2]] = [0xee, 0xf1, 0xfb]; // navy -> soft white
      }
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  })();
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : LOGOS;
  await mkdir(join(ROOT, 'images/dark'), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const name of names) {
    const source = await readFile(join(ROOT, 'images', name));
    const out = await page.evaluate(recolor, `data:image/png;base64,${source.toString('base64')}`);
    await writeFile(join(ROOT, 'images/dark', name), Buffer.from(out, 'base64'));
    console.log(`images/dark/${name}`);
  }
  await browser.close();
}
