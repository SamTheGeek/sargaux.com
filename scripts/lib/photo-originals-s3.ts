/**
 * Mirrors the NYC gallery originals into the S3 bucket that CloudFront serves
 * them from (infra/nyc-photo-originals.yml, docs/photo-originals-aws.md).
 * Used by scripts/sync-nyc-photos.ts, which runs it under Node's type
 * stripping: erasable TypeScript only, and relative imports with `.ts`.
 *
 * Requests are signed with aws4fetch on top of fetch, so in a cloud session
 * they go through the same egress proxy as the iCloud calls (with
 * NODE_USE_ENV_PROXY=1).
 *
 * Configured by env vars; when the bucket or keys are missing, s3FromEnv()
 * returns null and the sync only rewrites the manifests, as before:
 *   NYC_PHOTOS_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   (and AWS_SESSION_TOKEN for temporary credentials).
 */
import { AwsClient } from 'aws4fetch';
import { galleryPrefix, originalObjectKey } from '../../src/lib/photo-originals.ts';

export interface S3Target {
  bucket: string;
  region: string;
  client: AwsClient;
}

export function s3FromEnv(env: NodeJS.ProcessEnv = process.env): S3Target | null {
  const bucket = env.NYC_PHOTOS_BUCKET?.trim();
  const region = env.AWS_REGION?.trim() || env.AWS_DEFAULT_REGION?.trim();
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null;
  const sessionToken = env.AWS_SESSION_TOKEN?.trim() || undefined;
  return { bucket, region, client: new AwsClient({ accessKeyId, secretAccessKey, sessionToken, service: 's3', region }) };
}

/** Which env vars are missing, for a helpful message. */
export function missingS3Env(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing: string[] = [];
  if (!env.NYC_PHOTOS_BUCKET?.trim()) missing.push('NYC_PHOTOS_BUCKET');
  if (!env.AWS_REGION?.trim() && !env.AWS_DEFAULT_REGION?.trim()) missing.push('AWS_REGION');
  if (!env.AWS_ACCESS_KEY_ID?.trim()) missing.push('AWS_ACCESS_KEY_ID');
  if (!env.AWS_SECRET_ACCESS_KEY?.trim()) missing.push('AWS_SECRET_ACCESS_KEY');
  return missing;
}

const objectUrl = (t: S3Target, key: string) =>
  `https://${t.bucket}.s3.${t.region}.amazonaws.com/${key.split('/').map(encodeURIComponent).join('/')}`;

async function s3Error(res: Response, what: string): Promise<Error> {
  const body = await res.text().catch(() => '');
  const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
  return new Error(`S3 ${what} failed: ${res.status}${code ? ` ${code}` : ''}`);
}

const xmlUnescape = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Every key under `prefix` (ListObjectsV2, paginated). */
export async function listKeys(t: S3Target, prefix: string): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | undefined;
  do {
    const qs = new URLSearchParams({ 'list-type': '2', prefix });
    if (token) qs.set('continuation-token', token);
    const res = await t.client.fetch(`https://${t.bucket}.s3.${t.region}.amazonaws.com/?${qs}`);
    if (!res.ok) throw await s3Error(res, `listing ${prefix}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.add(xmlUnescape(m[1]));
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? (/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] ?? undefined)
      : undefined;
    if (token) token = xmlUnescape(token);
  } while (token);
  return keys;
}

export async function putOriginal(t: S3Target, key: string, body: Uint8Array<ArrayBuffer>): Promise<void> {
  const res = await t.client.fetch(objectUrl(t, key), {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': 'image/jpeg',
      // The key carries the checksum, so its bytes never change.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
  if (!res.ok) throw await s3Error(res, `uploading ${key}`);
  await res.body?.cancel();
}

export async function deleteObject(t: S3Target, key: string): Promise<void> {
  const res = await t.client.fetch(objectUrl(t, key), { method: 'DELETE' });
  // 204 normally; a key that's already gone is fine too.
  if (!res.ok && res.status !== 404) throw await s3Error(res, `deleting ${key}`);
  await res.body?.cancel();
}

export interface MirrorPlan {
  /** Manifest photos with no object yet: new photos, or an edit with a new checksum. */
  upload: string[];
  /**
   * Objects no manifest photo points at any more: photos hidden by a 👎,
   * removed from the album, or replaced by an edit. Only keys under the
   * gallery's prefix are ever considered.
   */
  remove: string[];
}

export function planMirror(gallery: string, desired: Iterable<string>, existing: Iterable<string>): MirrorPlan {
  const prefix = galleryPrefix(gallery);
  const want = new Set(desired);
  const have = new Set([...existing].filter((k) => k.startsWith(prefix)));
  return {
    upload: [...want].filter((k) => !have.has(k)),
    remove: [...have].filter((k) => !want.has(k)),
  };
}

/** Run `work` over `items`, `limit` at a time; the first failure rejects (the rest still settle). */
export async function eachLimit<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failure: unknown = null;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !failure) {
      const item = items[next++];
      try {
        await work(item);
      } catch (err) {
        failure ??= err;
      }
    }
  });
  await Promise.all(runners);
  if (failure) throw failure;
}

export { originalObjectKey, galleryPrefix };
