/**
 * Signed CloudFront URLs for the NYC photo originals (server-only).
 *
 * The bucket is private and the distribution only serves URLs signed with a
 * key in its trusted key group, so a guest can fetch an original only after
 * the photo API (which checks the session or gallery pass) hands them a URL,
 * and only until it expires. Uses a canned policy: one resource, one expiry.
 * https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-creating-signed-url-canned-policy.html
 *
 * Configured by three runtime env vars (Netlify, Functions scope). When any
 * is missing, originalsCdn() is null and downloads keep going through
 * /api/photos/{gallery}/{guid}/download, as before.
 *   NYC_PHOTOS_CDN_DOMAIN   the distribution's domain (d123.cloudfront.net)
 *   CLOUDFRONT_KEY_PAIR_ID  the public key's id in CloudFront
 *   CLOUDFRONT_PRIVATE_KEY  its PEM private key (a secret)
 */
import { createPrivateKey, createSign, type KeyObject } from 'node:crypto';
import { originalObjectKey } from './photo-originals';

/** How long a signed original URL works. The page asks again well before (its URL ttl is ~13 min). */
export const ORIGINAL_URL_LIFETIME_S = 60 * 60;

export interface OriginalsCdn {
  domain: string;
  keyPairId: string;
  privateKey: KeyObject;
}

let cached: { source: string; cdn: OriginalsCdn | null } | null = null;

/** The CDN config from the environment, or null when it isn't set up (or the key won't parse). */
export function originalsCdn(env: NodeJS.ProcessEnv = process.env): OriginalsCdn | null {
  const domain = env.NYC_PHOTOS_CDN_DOMAIN?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const keyPairId = env.CLOUDFRONT_KEY_PAIR_ID?.trim();
  // Dashboards sometimes store a pasted PEM with literal "\n" instead of newlines.
  const pem = env.CLOUDFRONT_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!domain || !keyPairId || !pem) return null;
  const source = `${domain}\u0000${keyPairId}\u0000${pem}`;
  if (cached?.source === source) return cached.cdn;
  let cdn: OriginalsCdn | null = null;
  try {
    cdn = { domain, keyPairId, privateKey: createPrivateKey(pem) };
  } catch {
    console.error('CLOUDFRONT_PRIVATE_KEY is not a valid PEM private key; serving originals from the site instead');
  }
  cached = { source, cdn };
  return cdn;
}

/** CloudFront's URL-safe base64: `+` → `-`, `=` → `_`, `/` → `~`. */
function cloudFrontBase64(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/=/g, '_').replace(/\//g, '~');
}

/** Sign `url` (no query string of its own) with a canned policy expiring at `expiresAt` (unix seconds). */
export function signCloudFrontUrl(url: string, cdn: Pick<OriginalsCdn, 'keyPairId' | 'privateKey'>, expiresAt: number): string {
  const policy = JSON.stringify({ Statement: [{ Resource: url, Condition: { DateLessThan: { 'AWS:EpochTime': expiresAt } } }] });
  const signature = createSign('RSA-SHA1').update(policy).sign(cdn.privateKey);
  return `${url}?Expires=${expiresAt}&Signature=${cloudFrontBase64(signature)}&Key-Pair-Id=${encodeURIComponent(cdn.keyPairId)}`;
}

/** A signed CloudFront URL for one photo's original. */
export function signedOriginalUrl(
  cdn: OriginalsCdn,
  gallery: string,
  photo: { guid: string; original: { checksum: string } },
  now: number = Date.now()
): string {
  const key = originalObjectKey(gallery, photo).split('/').map(encodeURIComponent).join('/');
  return signCloudFrontUrl(`https://${cdn.domain}/${key}`, cdn, Math.floor(now / 1000) + ORIGINAL_URL_LIFETIME_S);
}
