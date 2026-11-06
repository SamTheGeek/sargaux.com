/**
 * Pure helpers for reading an iCloud Photos shared album through its public
 * link (`https://photos.icloud.com/shared/album/{token}`). The API is
 * unofficial — it is what the photos.icloud.com web app itself calls.
 *
 * Shared by `scripts/sync-nyc-photos.ts` (which builds the committed photo
 * manifests) and `src/lib/icloud-photos.ts` (which resolves short-lived image
 * URLs at request time). It must stay free of relative imports and
 * non-erasable TypeScript syntax, because the sync script runs it under Node's
 * built-in type stripping rather than through Vite.
 *
 * How it works (CloudKit, container `com.apple.photos.cloud`):
 *   1. POST ckdatabasews.icloud.com/…/public/records/resolve with the link's
 *      token as a short GUID. The answer names the album's zone, its database
 *      partition host, and an anonymous access token (valid ~20 minutes). The
 *      answer also carries the album owner's identity — never persist it.
 *   2. POST {partition}/…/shared/records/query for
 *      `CPLAssetAndMasterByAssetDateWithoutHiddenOrDeleted` in that zone,
 *      following `continuationMarker`. Each photo is a `CPLAsset` (capture
 *      date, a reference to its master) plus a `CPLMaster` (the renditions).
 *   3. Each rendition carries a signed `downloadURL` on *.icloud-content.com
 *      that expires ~15 minutes after issue. Those URLs must never be stored —
 *      the manifest keeps asset ids and rendition checksums, and URLs are
 *      re-fetched on demand.
 */

export interface PhotoDerivative {
  checksum: string;
  width: number;
  height: number;
}

/** One photo as committed to `src/content/nycPhotos/{gallery}.json`. */
export interface ManifestPhoto {
  /** The CPLAsset record name (a UUID). */
  guid: string;
  /**
   * The photo's CPLMaster record name — an opaque id, not a name. Lets the
   * site fetch fresh URLs for one photo with a record lookup instead of
   * re-querying the whole album (see lookupRenditionUrls).
   */
  master: string;
  /** ISO capture time. Used only to sort the gallery oldest-first; never rendered. */
  takenAt: string;
  thumb: PhotoDerivative;
  full: PhotoDerivative;
  /** The best JPEG to hand a guest who downloads the photo (see pickOriginal). */
  original: PhotoDerivative;
  /** Shown in the gallery's preview on /nyc. */
  featured?: boolean;
}

/** A parsed photo plus the signed URLs that came with this particular fetch. */
export interface ResolvedPhoto extends ManifestPhoto {
  thumbUrl: string;
  fullUrl: string;
  originalUrl: string;
}

export interface ShareHandle {
  /** e.g. https://p121-ckdatabasews.icloud.com */
  partition: string;
  accessToken: string;
  zoneID: { zoneName: string; ownerRecordName: string; zoneType?: string };
}

/** How many photos the first sync features in a gallery's preview. */
export const DEFAULT_FEATURED_COUNT = 6;

const RESOLVE_HOST = 'https://ckdatabasews.icloud.com';
const DB_PATH = '/database/1/com.apple.photos.cloud/production';
const ASSET_QUERY = 'CPLAssetAndMasterByAssetDateWithoutHiddenOrDeleted';
const PAGE_SIZE = 500;
const MAX_PAGES = 20;

/** Share-link tokens are short URL-safe strings; reject anything else before it reaches a URL. */
export function isValidAlbumToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{6,64}$/.test(token);
}

/** Asset record names are UUIDs; accept only a conservative id shape. */
export function isValidPhotoGuid(guid: string): boolean {
  return /^[A-Za-z0-9-]{8,64}$/.test(guid);
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

async function postJson(fetchImpl: Fetch, url: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', Origin: 'https://photos.icloud.com' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw Object.assign(new Error(`iCloud ${new URL(url).pathname.split('/').pop()} returned ${res.status}`), {
      status: res.status,
    });
  }
  return res.json();
}

/** The HTTP status carried by an error from an iCloud call, if any. */
export function iCloudErrorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}

/** Accepts only a CloudKit partition origin, so a hostile answer can't redirect our queries. */
export function parseShareHandle(body: unknown): ShareHandle | null {
  const result = (body as { results?: unknown[] })?.results?.[0] as Record<string, any> | undefined;
  const access = result?.anonymousPublicAccess;
  const zoneID = result?.zoneID;
  if (!access || typeof access.token !== 'string' || typeof access.databasePartition !== 'string') return null;
  if (!zoneID || typeof zoneID.zoneName !== 'string' || typeof zoneID.ownerRecordName !== 'string') return null;
  let partition: URL;
  try {
    partition = new URL(access.databasePartition);
  } catch {
    return null;
  }
  if (partition.protocol !== 'https:' || !/^p\d+-ckdatabasews\.icloud\.com$/.test(partition.hostname)) return null;
  return {
    partition: `https://${partition.hostname}`,
    accessToken: access.token,
    // Copy only the zone fields; the resolve answer also names the owner.
    zoneID: { zoneName: zoneID.zoneName, ownerRecordName: zoneID.ownerRecordName, zoneType: zoneID.zoneType },
  };
}

export async function resolveShare(fetchImpl: Fetch, token: string, signal?: AbortSignal): Promise<ShareHandle> {
  const qs = new URLSearchParams({ sharing_url_key: token });
  const body = await postJson(
    fetchImpl,
    `${RESOLVE_HOST}${DB_PATH}/public/records/resolve?${qs}`,
    { shortGUIDs: [{ value: token }] },
    signal
  );
  const handle = parseShareHandle(body);
  if (!handle) throw new Error('iCloud share did not resolve to a public album');
  return handle;
}

/** Every asset and master record in the album, following pagination. */
export async function queryAlbumRecords(
  fetchImpl: Fetch,
  token: string,
  share: ShareHandle,
  signal?: AbortSignal
): Promise<unknown[]> {
  const qs = new URLSearchParams({
    remapEnums: 'true',
    sharing_url_key: token,
    publicAccessAuthToken: share.accessToken,
  });
  const url = `${share.partition}${DB_PATH}/shared/records/query?${qs}`;
  const records: unknown[] = [];
  let marker: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = (await postJson(
      fetchImpl,
      url,
      {
        query: {
          recordType: ASSET_QUERY,
          filterBy: [
            { fieldName: 'direction', comparator: 'EQUALS', fieldValue: { value: 'ASCENDING', type: 'STRING' } },
            { fieldName: 'startRank', comparator: 'EQUALS', fieldValue: { value: 0, type: 'INT64' } },
          ],
        },
        zoneID: share.zoneID,
        resultsLimit: PAGE_SIZE,
        ...(marker ? { continuationMarker: marker } : {}),
      },
      signal
    )) as { records?: unknown[]; continuationMarker?: string };
    const batch = Array.isArray(body.records) ? body.records : [];
    records.push(...batch);
    marker = typeof body.continuationMarker === 'string' ? body.continuationMarker : undefined;
    if (!marker || batch.length === 0) return records;
  }
  throw new Error('iCloud album query did not finish paginating');
}

/** The rendition fields that carry a signed `downloadURL`. */
export const RENDITION_KEYS = ['resJPEGThumbRes', 'resJPEGMedRes', 'resJPEGFullRes', 'resOriginalRes'] as const;

/**
 * Fresh signed URLs for specific records, by record name: one photo's asset
 * (which holds an edit's renditions) and master (the rest). A lookup like this
 * answers in well under a second, whereas querying a whole album costs ~5 s
 * per 100 photos — far too slow for a request path once a gallery has
 * hundreds of photos.
 */
export async function lookupRenditionUrls(
  fetchImpl: Fetch,
  token: string,
  share: ShareHandle,
  recordNames: string[],
  signal?: AbortSignal
): Promise<Map<string, string>> {
  const qs = new URLSearchParams({
    remapEnums: 'true',
    sharing_url_key: token,
    publicAccessAuthToken: share.accessToken,
  });
  const body = (await postJson(
    fetchImpl,
    `${share.partition}${DB_PATH}/shared/records/lookup?${qs}`,
    { records: recordNames.map((recordName) => ({ recordName })), zoneID: share.zoneID, desiredKeys: RENDITION_KEYS },
    signal
  )) as { records?: unknown[] };
  return renditionUrlsFromRecords(Array.isArray(body.records) ? body.records : []);
}

/** checksum → signed URL for every rendition field on the given records. */
export function renditionUrlsFromRecords(records: unknown[]): Map<string, string> {
  const urls = new Map<string, string>();
  for (const record of records as RawRecord[]) {
    for (const key of RENDITION_KEYS) {
      const res = record?.fields?.[key]?.value as { fileChecksum?: unknown; downloadURL?: unknown } | undefined;
      const url = buildAssetUrl(res?.downloadURL);
      if (res && typeof res.fileChecksum === 'string' && url) urls.set(res.fileChecksum, url);
    }
  }
  return urls;
}

/**
 * Every reaction record in the album. Reactions (`CPLReact`) never appear in
 * the asset query above — they are only reachable through the zone's change
 * feed. `desiredRecordTypes` narrows it server-side, but the type is checked
 * again here in case the server ignores the hint.
 */
export async function queryAlbumReactions(
  fetchImpl: Fetch,
  token: string,
  share: ShareHandle,
  signal?: AbortSignal
): Promise<unknown[]> {
  const qs = new URLSearchParams({
    remapEnums: 'true',
    sharing_url_key: token,
    publicAccessAuthToken: share.accessToken,
  });
  const url = `${share.partition}${DB_PATH}/shared/changes/zone?${qs}`;
  const records: unknown[] = [];
  let syncToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = (await postJson(
      fetchImpl,
      url,
      {
        zones: [{ zoneID: share.zoneID, desiredRecordTypes: ['CPLReact'], ...(syncToken ? { syncToken } : {}) }],
        resultsLimit: PAGE_SIZE,
      },
      signal
    )) as { zones?: Array<{ records?: unknown[]; syncToken?: string; moreComing?: boolean }> };
    const zone = body.zones?.[0];
    for (const r of zone?.records ?? []) {
      if ((r as RawRecord)?.recordType === 'CPLReact') records.push(r);
    }
    const next = typeof zone?.syncToken === 'string' ? zone.syncToken : undefined;
    if (!zone?.moreComing || !next || next === syncToken) return records;
    syncToken = next;
  }
  throw new Error('iCloud reaction feed did not finish paginating');
}

const THUMBS_DOWN = '\u{1F44E}';

/** 👎 with any skin tone or emoji-presentation selector reduces to the bare 👎. */
function normalizeEmoji(value: string): string {
  return value.replace(/[\u{FE0F}\u{1F3FB}-\u{1F3FF}]/gu, '').trim();
}

/**
 * Asset ids carrying at least one live 👎 from any album member. Tombstones
 * (a removed reaction) don't count, so taking a 👎 back restores the photo on
 * the next sync. Only the emoji and the asset reference are read — never
 * `created`/`modified`, which identify who reacted.
 */
export function thumbsDownAssetIds(records: unknown[]): Set<string> {
  const ids = new Set<string>();
  for (const raw of records as Array<RawRecord & { deleted?: unknown }>) {
    if (!raw || raw.recordType !== 'CPLReact' || raw.deleted === true || !raw.fields) continue;
    const emoji = raw.fields.emojiStringEnc?.value;
    if (typeof emoji !== 'string' || normalizeEmoji(emoji) !== THUMBS_DOWN) continue;
    const ref = (raw.fields.associatedAssetRef?.value as { recordName?: unknown } | undefined)?.recordName;
    if (typeof ref === 'string' && isValidPhotoGuid(ref)) ids.add(ref);
  }
  return ids;
}

/** One share resolve, then the photos and the set of thumbed-down asset ids. */
export async function fetchAlbumForSync(
  fetchImpl: Fetch,
  token: string,
  signal?: AbortSignal
): Promise<{ photos: ResolvedPhoto[]; thumbsDown: Set<string> }> {
  const share = await resolveShare(fetchImpl, token, signal);
  const [records, reactions] = await Promise.all([
    queryAlbumRecords(fetchImpl, token, share, signal),
    queryAlbumReactions(fetchImpl, token, share, signal),
  ]);
  return { photos: parseAlbumRecords(records), thumbsDown: thumbsDownAssetIds(reactions) };
}

interface RawRecord {
  recordName?: unknown;
  recordType?: unknown;
  fields?: Record<string, { value?: unknown } | undefined>;
}

const APPLE_CONTENT_HOST = /(^|\.)icloud-content\.com$/i;

/**
 * A rendition's signed URL with its `${f}` filename placeholder filled in.
 * Only https URLs on *.icloud-content.com pass, so a malformed or hostile
 * response can't turn the photo endpoint into an open redirect.
 */
export function buildAssetUrl(downloadURL: unknown, filename = 'photo.jpg'): string | null {
  if (typeof downloadURL !== 'string') return null;
  try {
    const url = new URL(downloadURL.replace('${f}', encodeURIComponent(filename)));
    if (url.protocol !== 'https:' || !APPLE_CONTENT_HOST.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function num(field: { value?: unknown } | undefined): number | null {
  const n = Number(field?.value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** One rendition (`resJPEGThumb`, `resJPEGMed`, …) of a record, with its signed URL. */
function rendition(
  fields: RawRecord['fields'],
  prefix: string
): (PhotoDerivative & { url: string }) | null {
  if (!fields) return null;
  const res = fields[`${prefix}Res`]?.value as { fileChecksum?: unknown; downloadURL?: unknown } | undefined;
  const width = num(fields[`${prefix}Width`]);
  const height = num(fields[`${prefix}Height`]);
  const url = buildAssetUrl(res?.downloadURL);
  if (!res || typeof res.fileChecksum !== 'string' || !width || !height || !url) return null;
  return { checksum: res.fileChecksum, width, height, url };
}

function strip({ url: _url, ...d }: PhotoDerivative & { url: string }): PhotoDerivative {
  void _url;
  return d;
}

/**
 * Pairs each CPLAsset with its CPLMaster and returns the photos oldest-first.
 * The grid uses the ~500px `resJPEGThumb`; the lightbox uses the ~2000px
 * `resJPEGMed` (the original can be several MB). An edited photo carries its
 * rendered edit on the asset record, which wins over the master's renditions.
 * Videos and anything without both JPEG renditions are skipped. Nothing
 * caption- or filename-like is copied — the repo is public.
 */
export function parseAlbumRecords(records: unknown[]): ResolvedPhoto[] {
  const masters = new Map<string, RawRecord>();
  const assets: RawRecord[] = [];
  for (const raw of records as RawRecord[]) {
    if (!raw || typeof raw.recordName !== 'string') continue;
    if (raw.recordType === 'CPLMaster') masters.set(raw.recordName, raw);
    else if (raw.recordType === 'CPLAsset') assets.push(raw);
  }

  const out: ResolvedPhoto[] = [];
  const seen = new Set<string>();
  for (const asset of assets) {
    const guid = asset.recordName as string;
    if (!isValidPhotoGuid(guid) || seen.has(guid)) continue;
    const masterName = (asset.fields?.masterRef?.value as { recordName?: unknown } | undefined)?.recordName;
    const master = typeof masterName === 'string' ? masters.get(masterName) : undefined;
    if (!master) continue;
    const itemType = String(master.fields?.itemType?.value ?? '');
    if (/movie|video|mpeg/i.test(itemType)) continue;

    const thumb = rendition(asset.fields, 'resJPEGThumb') ?? rendition(master.fields, 'resJPEGThumb');
    const full =
      rendition(asset.fields, 'resJPEGFull') ??
      rendition(asset.fields, 'resJPEGMed') ??
      rendition(master.fields, 'resJPEGMed');
    if (!thumb || !full) continue;
    const original = pickOriginal(asset.fields, master.fields) ?? full;

    const ms = Number(asset.fields?.assetDate?.value ?? master.fields?.originalCreationDate?.value);
    if (!Number.isFinite(ms)) continue;

    seen.add(guid);
    out.push({
      guid,
      master: masterName as string,
      takenAt: new Date(ms).toISOString(),
      thumb: strip(thumb),
      full: strip(full),
      original: strip(original),
      thumbUrl: thumb.url,
      fullUrl: full.url,
      originalUrl: original.url,
    });
  }
  return sortChronologically(out);
}

/**
 * The rendition a guest downloads: an edit if the photo has one (the rendered
 * edit lives on the asset), else the camera original — but only when it is a
 * JPEG, since an iPhone HEIC original won't open everywhere — else the largest
 * JPEG the album has.
 */
function pickOriginal(
  assetFields: RawRecord['fields'],
  masterFields: RawRecord['fields']
): (PhotoDerivative & { url: string }) | null {
  const edited = rendition(assetFields, 'resJPEGFull');
  if (edited) return edited;
  const type = String(masterFields?.resOriginalFileType?.value ?? '');
  if (/jpe?g/i.test(type)) {
    const original = rendition(masterFields, 'resOriginal');
    if (original) return original;
  }
  return rendition(masterFields, 'resJPEGFull') ?? rendition(masterFields, 'resJPEGMed');
}

/** Manifest entries (no URLs) from a fetch. */
export function toManifest(photos: ResolvedPhoto[]): ManifestPhoto[] {
  return photos.map(({ guid, master, takenAt, thumb, full, original }) => ({ guid, master, takenAt, thumb, full, original }));
}

/** rendition checksum → signed URL, for the photo endpoint. */
export function urlsByChecksum(photos: ResolvedPhoto[]): Map<string, string> {
  const urls = new Map<string, string>();
  for (const p of photos) {
    urls.set(p.thumb.checksum, p.thumbUrl);
    urls.set(p.full.checksum, p.fullUrl);
    urls.set(p.original.checksum, p.originalUrl);
  }
  return urls;
}

/** Oldest first; GUID breaks ties so reruns produce a stable order. */
export function sortChronologically<T extends { guid: string; takenAt: string }>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
    const diff = Date.parse(a.takenAt) - Date.parse(b.takenAt);
    if (diff !== 0) return diff;
    return a.guid < b.guid ? -1 : a.guid > b.guid ? 1 : 0;
  });
}

/**
 * Carries the `featured` choice across a resync. Existing flags are kept for
 * photos still in the album, so a hand-curated preview survives untouched.
 * When some featured photos dropped out (thumbed down or removed from the
 * album), the same number of replacements is drawn at random from the rest,
 * so the preview keeps its size. A first sync draws `count` at random.
 * `random` is injectable so tests are deterministic.
 */
export function applyFeatured(
  next: ManifestPhoto[],
  previous: ManifestPhoto[],
  count: number = DEFAULT_FEATURED_COUNT,
  random: () => number = Math.random
): ManifestPhoto[] {
  const previouslyFeatured = previous.filter((p) => p.featured).map((p) => p.guid);
  const kept = new Set(previouslyFeatured);
  const stillPresent = next.filter((p) => kept.has(p.guid)).map((p) => p.guid);
  // First sync (nothing featured before, or nothing left of it): a fresh draw.
  // Otherwise refill exactly the slots that were lost.
  const wanted = stillPresent.length === 0 ? count : previouslyFeatured.length;
  const chosen = new Set(stillPresent);
  // Partial Fisher–Yates over the rest: the first slots end up a uniform sample.
  const pool = next.map((p) => p.guid).filter((g) => !chosen.has(g));
  const n = Math.min(Math.max(0, wanted - chosen.size), pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    chosen.add(pool[i]);
  }
  return next.map(({ guid, master, takenAt, thumb, full, original }) =>
    chosen.has(guid)
      ? { guid, master, takenAt, thumb, full, original, featured: true }
      : { guid, master, takenAt, thumb, full, original }
  );
}
