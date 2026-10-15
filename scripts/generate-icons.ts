/**
 * Generates apple-touch-icon.png and apple-touch-icon-precomposed.png
 * from src/assets/common/favicon.svg at build time.
 *
 * Run via: node scripts/generate-icons.ts (or npm run icons)
 * Automatically runs as prebuild hook. Node 24 strips the types natively, so
 * this stays free of relative imports and non-erasable TypeScript syntax.
 */

import sharp from 'sharp';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

const input = join(root, 'src', 'assets', 'common', 'favicon.svg');
const output = join(root, 'public', 'apple-touch-icon.png');
const outputPrecomposed = join(root, 'public', 'apple-touch-icon-precomposed.png');

await sharp(input)
  .resize(180, 180)
  .png()
  .toFile(output);

await copyFile(output, outputPrecomposed);

console.log('Generated apple-touch-icon.png (180×180)');
