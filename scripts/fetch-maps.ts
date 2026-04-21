/**
 * Downloads Google Maps Static API tiles at build time and saves them to
 * public/assets/maps/ so they're served as static assets (no API key in HTML).
 *
 * Run via: tsx scripts/fetch-maps.ts
 * Automatically runs as part of the prebuild hook.
 */

import { writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'assets', 'maps');

const MAPS_KEY = process.env.GOOGLE_MAPS_STATIC_API_KEY;

if (!MAPS_KEY) {
  console.log('fetch-maps: GOOGLE_MAPS_STATIC_API_KEY not set — skipping map tile download');
  process.exit(0);
}

interface MapSpec {
  name: string;
  lat: number;
  lng: number;
  zoom: number;
}

const maps: MapSpec[] = [
  { name: 'dinner', lat: 40.72235, lng: -73.95709, zoom: 15 },
  { name: 'dancing', lat: 40.7131,  lng: -73.9620,  zoom: 14 },
];

function buildUrl(spec: MapSpec): string {
  const u = new URL('https://maps.googleapis.com/maps/api/staticmap');
  u.searchParams.set('center', `${spec.lat},${spec.lng}`);
  u.searchParams.set('zoom', String(spec.zoom));
  u.searchParams.set('size', '600x280');
  u.searchParams.set('scale', '2');
  u.searchParams.set('maptype', 'roadmap');
  u.searchParams.set('markers', `color:0xD96A1E|${spec.lat},${spec.lng}`);
  u.searchParams.set('key', MAPS_KEY!);
  return u.toString();
}

await mkdir(outDir, { recursive: true });

for (const spec of maps) {
  const url = buildUrl(spec);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`fetch-maps: failed to fetch ${spec.name} map (${res.status} ${res.statusText})`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = join(outDir, `${spec.name}.png`);
  await writeFile(dest, buf);
  console.log(`fetch-maps: saved ${spec.name}.png (${buf.length} bytes)`);
}
