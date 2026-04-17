/**
 * Batch-converts lookbook JPG images to WebP using Sharp.
 *
 * Processes:
 *   public/images/nyc/lookbook/*.jpg
 *   public/images/france/lookbook/*.jpg  (when images exist)
 *
 * Skips files that already have a matching .webp alongside them.
 *
 * Usage: npm run gen:lookbook-webp
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const DIRS = [
  'public/images/nyc/lookbook',
  'public/images/france/lookbook',
];

const WEBP_QUALITY = 82;

async function processDir(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    console.log(`Skipping ${dir} (directory not found)`);
    return;
  }

  const jpgFiles = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg)$/i.test(f)).sort();

  if (jpgFiles.length === 0) {
    console.log(`No JPG files found in ${dir}`);
    return;
  }

  console.log(`\nProcessing ${jpgFiles.length} files in ${dir}...`);

  let skipped = 0;
  let generated = 0;

  for (const file of jpgFiles) {
    const srcPath = path.join(dir, file);
    const outPath = path.join(dir, file.replace(/\.(jpg|jpeg)$/i, '.webp'));

    if (fs.existsSync(outPath)) {
      skipped++;
      continue;
    }

    await sharp(srcPath).webp({ quality: WEBP_QUALITY }).toFile(outPath);
    console.log(`  ✓ ${path.relative('.', outPath)}`);
    generated++;
  }

  console.log(`  ${generated} generated, ${skipped} already existed`);
}

async function main(): Promise<void> {
  console.log('Lookbook WebP generator');
  console.log(`Quality: ${WEBP_QUALITY}`);

  for (const dir of DIRS) {
    await processDir(dir);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
