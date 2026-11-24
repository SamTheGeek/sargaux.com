# NYC photo originals on AWS (S3 + CloudFront)

The NYC galleries' thumbnails and lightbox images load straight from iCloud.
The **download originals** (~3 MB each) can't: the browser has to fetch the
bytes itself to name the file and hand it to the share sheet, and iCloud sends
no CORS headers. They used to stream through `/api/photos/{gallery}/{guid}/download`,
which spends Netlify bandwidth on every byte.

With this set up, the originals live in a private S3 bucket and are served by
CloudFront, only to **signed URLs** that the photo API hands out (after its
usual session / gallery-pass check), valid for an hour. The batch endpoint
(`/api/photos/{gallery}/urls`) adds an `original` URL to each photo, and the
lightbox:

- **on phones**, fetches the open photo's original after a 600 ms pause, so a
  tap on ⤓ opens the share sheet at once (no second tap);
- **on desktop**, fetches it on click and saves it as `sargaux-nyc-{gallery}-{NNN}.jpg`;
- falls back to `/download` if the CDN fails, and works exactly as before when
  the CDN isn't configured.

CloudFront's always-free tier covers 1 TB of transfer a month; S3 storage for
~500 photos is a few cents.

## Pieces

| Piece | Where |
|---|---|
| Bucket, CloudFront distribution, signing key group, sync IAM user | `infra/nyc-photo-originals.yml` (CloudFormation) |
| Object key `nyc/{gallery}/{guid}/{checksum}.jpg` | `src/lib/photo-originals.ts` |
| Signing (canned policy, RSA-SHA1, `node:crypto`) | `src/lib/cloudfront-sign.ts` |
| Upload new / delete 👎'd originals | `scripts/sync-nyc-photos.ts` + `scripts/lib/photo-originals-s3.ts` |
| Prefetch / fallback in the browser | `src/components/PhotoLightbox.astro`, `src/scripts/photo-urls.ts` |

## One-time setup

You need an AWS account; nothing here needs your root/admin keys outside
your own browser.

### 1. Create the stack (AWS CloudShell)

1. Sign in to the AWS console, pick **us-east-1** in the region menu, and open
   **CloudShell** (the `>_` icon in the top bar).
2. Make the signing key pair:
   ```bash
   openssl genrsa -out cf-private.pem 2048 && openssl rsa -pubout -in cf-private.pem -out cf-public.pem
   ```
3. Get the template and deploy it (takes a few minutes):
   ```bash
   curl -sO https://raw.githubusercontent.com/SamTheGeek/sargaux.com/main/infra/nyc-photo-originals.yml
   aws cloudformation deploy --stack-name sargaux-photo-originals --template-file nyc-photo-originals.yml --capabilities CAPABILITY_IAM --parameter-overrides "PublicKeyPem=$(cat cf-public.pem)"
   ```
4. Read the outputs:
   ```bash
   aws cloudformation describe-stacks --stack-name sargaux-photo-originals --query "Stacks[0].Outputs" --output table
   ```
5. Make an access key for the sync user (this looks up `SyncUserName` from the stack):
   ```bash
   aws iam create-access-key --user-name "$(aws cloudformation describe-stacks --stack-name sargaux-photo-originals --query "Stacks[0].Outputs[?OutputKey=='SyncUserName'].OutputValue" --output text)"
   ```

### 2. Netlify (the site's side)

Site configuration → Environment variables → Add a variable. Scope each to
**Functions**, with values for **Production** and **Deploy Previews**:

| Variable | Value |
|---|---|
| `CLOUDFRONT_PRIVATE_KEY` | the whole of `cf-private.pem` (`cat cf-private.pem`), BEGIN/END lines included. Mark **Contains secret values**. |
| `CLOUDFRONT_KEY_PAIR_ID` | `SigningKeyId` output |
| `NYC_PHOTOS_CDN_DOMAIN` | `DistributionDomain` output |

Then delete the key files from CloudShell: `rm cf-private.pem cf-public.pem`.
The private key now lives only in Netlify; to rotate, make a new pair, update
the stack's `PublicKeyPem`, and replace the Netlify variables.

Turn these on **after** the first sync has uploaded the originals; until
then, photos without an object would fail over to `/download` one by one.

### 3. Wherever the sync runs

The sync reads `NYC_PHOTOS_BUCKET` (`BucketName`), `AWS_REGION`
(`BucketRegion`), `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (step 5).

- **On the Mac**: add them to `.env.local` and run
  `node --env-file-if-exists=.env.local scripts/sync-nyc-photos.ts`.
- **In a Claude Code cloud session**: add them as environment variables in
  the environment's settings (a new session picks them up), allow the host
  `{BucketName}.s3.{region}.amazonaws.com`, and run with
  `NODE_USE_ENV_PROXY=1`.

The IAM user can only list, read, write and delete under the bucket's `nyc/`
prefix, nothing else in the account.

## What a sync does

Per gallery: build the manifest from the album (👎 photos left out, as
before), **upload** every original the manifest needs that isn't in the bucket
yet (new photos, or a photo edited in Photos, whose checksum changed), write
the manifest, then **delete** every object under `nyc/{gallery}/` the
manifest no longer points at: photos with a 👎, photos removed from the
album, superseded edits. A failed upload leaves that gallery's manifest
unchanged. `--no-upload` skips the mirror on purpose; without the env vars the
sync warns and only rewrites manifests.

A deleted object can still be served from a CloudFront edge cache to someone
holding a signed URL issued before the deletion, until that URL expires
(at most an hour). New URLs are never issued for it, since the photo is no
longer in the manifest.
