// Renders the app icons (home screen, install prompt, Apple touch icon) from
// images/icons/esc-icon.svg. Run after editing the SVG:
//
//   npm run build:icons
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { ROOT } from './site-pages.mjs';

export const ICON_SIZES = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

const svg = await readFile(join(ROOT, 'images/icons/esc-icon.svg'), 'utf8');
const browser = await chromium.launch();
try {
  for (const { file, size } of ICON_SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({ path: join(ROOT, 'images/icons', file), omitBackground: false });
    await page.close();
    console.log(`images/icons/${file}`);
  }
} finally {
  await browser.close();
}
