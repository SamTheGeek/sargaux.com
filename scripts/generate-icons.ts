/**
 * Generates apple-touch-icon.png and apple-touch-icon-precomposed.png
 * from public/favicon.svg at build time.
 *
 * Run via: tsx scripts/generate-icons.ts
 * Automatically runs as prebuild hook.
 */

import sharp from 'sharp';
import { copyFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const input = join(root, 'public', 'favicon.svg');
const output = join(root, 'public', 'apple-touch-icon.png');
const outputPrecomposed = join(root, 'public', 'apple-touch-icon-precomposed.png');

await sharp(input)
  .resize(180, 180)
  .png()
  .toFile(output);

await copyFile(output, outputPrecomposed);

console.log('Generated apple-touch-icon.png (180×180)');
