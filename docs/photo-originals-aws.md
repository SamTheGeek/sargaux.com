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
| Bucket, CloudFront distribution, signing key group, GitHub OIDC sync role | `infra/nyc-photo-originals.yml` (CloudFormation) |
| Object key `nyc/{gallery}/{guid}/{checksum}.jpg` | `src/lib/photo-originals.ts` |
| Signing (canned policy, RSA-SHA1, `node:crypto`) | `src/lib/cloudfront-sign.ts` |
| Upload new / delete 👎'd originals | `scripts/sync-nyc-photos.ts` + `scripts/lib/photo-originals-s3.ts` |
| Runs the sync daily and on demand, opens a PR | `.github/workflows/sync-nyc-photos.yml` |
| Prefetch / fallback in the browser | `src/components/PhotoLightbox.astro`, `src/scripts/photo-urls.ts` |

## How the sync gets AWS access

No AWS key is stored anywhere. The workflow asks GitHub for an OIDC token and
trades it for the stack's `SyncRole`, whose trust policy accepts only
workflow runs on **main** of this repo (never a pull request or another
branch), for at most an hour. The role can only list, read, write and delete
under the bucket's `nyc/` prefix.

AWS signs every request with the secret key itself, so a key can't be stored
as a Claude Code network secret (those add a fixed header). That's why the
sync runs in GitHub Actions rather than in a Claude session.

## One-time setup

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
   If it fails because the account already has a GitHub OIDC provider, find
   its ARN with `aws iam list-open-id-connect-providers` and add
   `ExistingGitHubOidcProviderArn=<that ARN>` to `--parameter-overrides`.
4. Read the outputs:
   ```bash
   aws cloudformation describe-stacks --stack-name sargaux-photo-originals --query "Stacks[0].Outputs" --output table
   ```

### 2. GitHub (the sync)

1. **Settings → Secrets and variables → Actions → Variables** tab →
   **New repository variable**, three times (these are not secrets):
   - `NYC_PHOTOS_SYNC_ROLE_ARN`: `SyncRoleArn`
   - `NYC_PHOTOS_BUCKET`: `BucketName`
   - `NYC_PHOTOS_AWS_REGION`: `BucketRegion`
2. **Settings → Actions → General → Workflow permissions**: tick
   **Allow GitHub Actions to create and approve pull requests**.
3. Once the workflow is on main: **Actions → Sync NYC Photos → Run workflow**.
   The first run uploads every original (~1.5 GB, roughly 10–20 minutes) and,
   if any manifest changed, opens a draft PR.

After that it runs daily at 11:43 UTC. Merge its PR to publish new or 👎'd
photos; the originals are already in place.

### 3. Netlify (the site's side)

After the first sync has uploaded the originals: Site configuration →
Environment variables → Add a variable. Scope each to **Functions**, with
values for **Production** and **Deploy Previews**:

| Variable | Value |
|---|---|
| `CLOUDFRONT_PRIVATE_KEY` | the whole of `cf-private.pem` (`cat cf-private.pem`), BEGIN/END lines included. Mark **Contains secret values**. |
| `CLOUDFRONT_KEY_PAIR_ID` | `SigningKeyId` output |
| `NYC_PHOTOS_CDN_DOMAIN` | `DistributionDomain` output |

Then delete the key files from CloudShell: `rm cf-private.pem cf-public.pem`.
The private key now lives only in Netlify; to rotate, make a new pair, update
the stack's `PublicKeyPem`, and replace the Netlify variables.

(Turned on before the first sync, photos without an object would fall back
to `/download` one by one, spending Netlify bandwidth again.)

### Running the sync elsewhere

The script reads `NYC_PHOTOS_BUCKET`, `AWS_REGION` and standard AWS
credentials from the environment (`AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`). Without them it warns
and only rewrites the manifests, so a local run (`node scripts/sync-nyc-photos.ts`)
still works for previews; let the workflow do the uploads.

## What a sync does

Per gallery: build the manifest from the album (👎 photos left out, as
before), **upload** every original the manifest needs that isn't in the bucket
yet (new photos, or a photo edited in Photos, whose checksum changed), write
the manifest, then **delete** every object under `nyc/{gallery}/` the
manifest no longer points at: photos with a 👎, photos removed from the
album, superseded edits. A failed upload leaves that gallery's manifest
unchanged. `--no-upload` skips the mirror on purpose; without the env vars the
sync warns and only rewrites manifests.

The workflow uploads and deletes when it runs, but the manifests only reach
the site when its PR is merged. In between, the live site may still list a
photo whose original was just deleted (a fresh 👎); that photo's download
falls back to `/download` until the merge.

A deleted object can still be served from a CloudFront edge cache to someone
holding a signed URL issued before the deletion, until that URL expires
(at most an hour). New URLs are never issued for it, since the photo is no
longer in the manifest.
