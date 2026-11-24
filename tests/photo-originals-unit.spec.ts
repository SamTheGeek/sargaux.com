import { createVerify, generateKeyPairSync } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { originalObjectKey, galleryPrefix } from '../src/lib/photo-originals';
import { originalsCdn, signCloudFrontUrl, signedOriginalUrl, ORIGINAL_URL_LIFETIME_S } from '../src/lib/cloudfront-sign';
import { eachLimit, missingS3Env, planMirror, s3FromEnv } from '../scripts/lib/photo-originals-s3';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const photo = { guid: 'f6526fe9-6133-4027-a5f3-4dfa55f69269', original: { checksum: 'AT+b/Cd9=' } };

test.describe('originalObjectKey', () => {
  test('nests under nyc/{gallery}/{guid}/ with a URL-safe checksum', () => {
    expect(originalObjectKey('afterparty', photo)).toBe('nyc/afterparty/f6526fe9-6133-4027-a5f3-4dfa55f69269/AT-b_Cd9.jpg');
    expect(originalObjectKey('afterparty', photo).startsWith(galleryPrefix('afterparty'))).toBe(true);
  });

  test('an edit (new checksum) is a new key', () => {
    expect(originalObjectKey('afterparty', { ...photo, original: { checksum: 'XYZ' } })).not.toBe(
      originalObjectKey('afterparty', photo)
    );
  });
});

test.describe('CloudFront signed URLs', () => {
  const env = {
    NYC_PHOTOS_CDN_DOMAIN: 'https://d111111abcdef8.cloudfront.net/',
    CLOUDFRONT_KEY_PAIR_ID: 'K2JCJMDEHXQW5F',
    CLOUDFRONT_PRIVATE_KEY: privateKey,
  } as NodeJS.ProcessEnv;

  test('is off unless all three variables are set', () => {
    expect(originalsCdn({} as NodeJS.ProcessEnv)).toBeNull();
    expect(originalsCdn({ ...env, CLOUDFRONT_PRIVATE_KEY: '' })).toBeNull();
    expect(originalsCdn({ ...env, CLOUDFRONT_KEY_PAIR_ID: undefined })).toBeNull();
    expect(originalsCdn(env)?.domain).toBe('d111111abcdef8.cloudfront.net');
  });

  test('accepts a key pasted with literal \\n and rejects one that is not a key', () => {
    expect(originalsCdn({ ...env, CLOUDFRONT_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n') })).not.toBeNull();
    expect(originalsCdn({ ...env, CLOUDFRONT_PRIVATE_KEY: 'not a key' })).toBeNull();
  });

  test('a canned-policy signature that verifies against the public key', () => {
    const cdn = originalsCdn(env)!;
    const signed = signCloudFrontUrl('https://d111111abcdef8.cloudfront.net/nyc/a/b.jpg', cdn, 1_900_000_000);
    const u = new URL(signed);
    expect(u.searchParams.get('Expires')).toBe('1900000000');
    expect(u.searchParams.get('Key-Pair-Id')).toBe('K2JCJMDEHXQW5F');
    const sig = u.searchParams.get('Signature')!;
    expect(sig).not.toMatch(/[+=/]/);
    const policy = JSON.stringify({
      Statement: [{ Resource: 'https://d111111abcdef8.cloudfront.net/nyc/a/b.jpg', Condition: { DateLessThan: { 'AWS:EpochTime': 1_900_000_000 } } }],
    });
    const raw = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '=').replace(/~/g, '/'), 'base64');
    expect(createVerify('RSA-SHA1').update(policy).verify(publicKey, raw)).toBe(true);
  });

  test('an original URL points at the object key and expires an hour out', () => {
    const now = Date.UTC(2026, 10, 24);
    const u = new URL(signedOriginalUrl(originalsCdn(env)!, 'afterparty', photo, now));
    expect(u.origin + u.pathname).toBe(`https://d111111abcdef8.cloudfront.net/${originalObjectKey('afterparty', photo)}`);
    expect(Number(u.searchParams.get('Expires'))).toBe(now / 1000 + ORIGINAL_URL_LIFETIME_S);
  });
});

test.describe('S3 mirror plan', () => {
  test('uploads what is missing and deletes what no photo points at, within the gallery only', () => {
    const plan = planMirror(
      'afterparty',
      ['nyc/afterparty/a/1.jpg', 'nyc/afterparty/b/2.jpg'],
      ['nyc/afterparty/a/1.jpg', 'nyc/afterparty/c/3.jpg', 'nyc/afterparty/b/old.jpg', 'nyc/celebration/z/9.jpg']
    );
    expect(plan.upload).toEqual(['nyc/afterparty/b/2.jpg']);
    expect(plan.remove.sort()).toEqual(['nyc/afterparty/b/old.jpg', 'nyc/afterparty/c/3.jpg']);
  });

  test('is off, and names what is missing, without the bucket and keys', () => {
    expect(s3FromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    expect(missingS3Env({ AWS_REGION: 'us-east-1' } as NodeJS.ProcessEnv)).toEqual([
      'NYC_PHOTOS_BUCKET',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
    ]);
    expect(
      s3FromEnv({ NYC_PHOTOS_BUCKET: 'b', AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'k', AWS_SECRET_ACCESS_KEY: 's' } as NodeJS.ProcessEnv)
    ).not.toBeNull();
  });

  test('eachLimit runs at most `limit` at once and surfaces a failure', async () => {
    let running = 0;
    let peak = 0;
    await eachLimit([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
    });
    expect(peak).toBe(3);
    await expect(eachLimit([1, 2], 2, async (n) => { if (n === 2) throw new Error('boom'); })).rejects.toThrow('boom');
  });
});
