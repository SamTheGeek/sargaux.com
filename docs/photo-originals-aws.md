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
| Rebuilds the manifests on every deploy (no uploads) | `netlify.toml` build command (`--build`) |
| Keeps S3 in step on every push to main, daily and on demand | `.github/workflows/sync-nyc-photos.yml` |
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

### 2. Roll the album links (once, when they move out of the repo)

The album tokens used to be committed in `src/content/nycGalleryConfig.ts`,
and git history keeps them forever. Anyone holding one can browse that whole
album on icloud.com, 👎'd photos included, so each public link is replaced:
in Photos, open each of the three shared albums, open its sharing options,
turn **Public Website** off, then on again. Copy the new link; its token is
the last part, after `/shared/album/`. Don't paste tokens into chats, issues
or the repo.

### 3. GitHub (the S3 sync)

**Settings → Secrets and variables → Actions**:

- **Variables** tab (not secret):
  - `NYC_PHOTOS_SYNC_ROLE_ARN`: `SyncRoleArn`
  - `NYC_PHOTOS_BUCKET`: `BucketName`
  - `NYC_PHOTOS_AWS_REGION`: `BucketRegion`
- **Secrets** tab:
  - `NYC_ALBUM_TOKEN_CELEBRATION`, `NYC_ALBUM_TOKEN_PREPARATION`,
    `NYC_ALBUM_TOKEN_AFTERPARTY`: the new tokens
  - `NETLIFY_BUILD_HOOK_URL` (optional): a build hook from Netlify (Site
    configuration → Build & deploy → Build hooks). With it, the daily run
    starts a deploy when the albums changed, so new photos don't wait for
    the next merge.

The workflow runs on every push to main, daily at 11:43 UTC, and from
**Actions → Sync NYC Photo Originals → Run workflow**. The first run uploads
every original (~1.5 GB, roughly 10–20 minutes). It never commits anything.

### 4. Netlify (the site's side)

Site configuration → Environment variables → Add a variable, with values for
**Production** and **Deploy Previews**.

The album tokens, **before merging** the change that moved them out of the
repo (without them the galleries are hidden). Scope: **Builds** and
**Functions**; mark each **Contains secret values**:

| Variable | Value |
|---|---|
| `NYC_ALBUM_TOKEN_CELEBRATION` | new Celebration token |
| `NYC_ALBUM_TOKEN_PREPARATION` | new Preparation token |
| `NYC_ALBUM_TOKEN_AFTERPARTY` | new Afterparty token |

The CDN, **after the first S3 sync** has uploaded the originals. Scope:
**Functions**:

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

The script reads the album tokens (`NYC_ALBUM_TOKEN_*`), `NYC_PHOTOS_BUCKET`,
`AWS_REGION` and standard AWS credentials (`AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`) from the environment.
Without AWS credentials it warns and only rewrites the manifests, so a local
run (`node --env-file-if-exists=.env.local scripts/sync-nyc-photos.ts`, with
the tokens in `.env.local`) works for checking an album; let the workflow do
the uploads. Committing the refreshed manifests is optional: they are only
the fallback for a build that can't reach iCloud.

## What a sync does

Per gallery: build the manifest from the album (👎 photos left out, as
before), **upload** every original the manifest needs that isn't in the bucket
yet (new photos, or a photo edited in Photos, whose checksum changed), write
the manifest, then **delete** every object under `nyc/{gallery}/` the
manifest no longer points at: photos with a 👎, photos removed from the
album, superseded edits. A failed upload leaves that gallery's manifest
unchanged. `--no-upload` skips the mirror on purpose; without the env vars the
sync warns and only rewrites manifests.

Every Netlify build runs the same sync with `--build` (no uploads, never
fails) before `astro build`, so the deployed manifests always reflect the
albums at deploy time, and the workflow, triggered by the same push, brings
the bucket in line within a minute or two. Between a 👎 and the next deploy,
the live site still lists the photo but its original is already gone from S3
(after a daily run); its download falls back to `/download`. A photo added
to an album shows up at the next deploy, or the next daily run with the build
hook set.

A deleted object can still be served from a CloudFront edge cache to someone
holding a signed URL issued before the deletion, until that URL expires
(at most an hour). New URLs are never issued for it, since the photo is no
longer in the manifest.
