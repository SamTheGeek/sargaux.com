/**
 * Joy (withjoy.com) registry client.
 *
 * Fetches the couple's registry items from Joy's GraphQL endpoint. This is an
 * unofficial API (the same one the public registry page uses), so every
 * consumer must tolerate `null` — the registry page falls back to a link-out
 * card to the Joy-hosted registry when data is unavailable.
 *
 * JOY_EVENT_ID / JOY_EVENT_HANDLE are runtime env vars (Netlify Dashboard,
 * mirrored in .env.local); the data is public, but we keep them out of source.
 */

const JOY_GRAPHQL_URL = 'https://withjoy.com/graphql';
const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 15 * 60 * 1000;

export const JOY_REGISTRY_URL = `https://withjoy.com/${process.env.JOY_EVENT_HANDLE ?? 'sargaux'}/registry`;

/**
 * Deep link to a single registry item on Joy: opens the item's detail/buy
 * modal directly (verified live — Joy's own share links use the same param).
 */
export function joyItemUrl(itemId: string): string {
  return `${JOY_REGISTRY_URL}?pid=${itemId}`;
}

export interface JoyProduct {
  id: string;
  title: string;
  description: string | null;
  photoUrl: string | null;
  price: number | null;
  currencyCode: string | null;
  storeName: string | null;
  stillNeeded: number;
  totalRequested: number;
  mustHave: boolean;
  note: string | null;
}

export interface JoyFund {
  id: string;
  title: string;
  description: string | null;
  photoUrl: string | null;
  note: string | null;
}

export interface JoyRegistry {
  products: JoyProduct[];
  funds: JoyFund[];
}

const REGISTRY_QUERY = `
  query RegistryItems($id: ID!) {
    registryItemsByEventId(eventId: $id) {
      id stillNeeded alreadyPurchased totalRequested note isHidden mustHave
      storeName externallyOwned fpIndex
      productData {
        title description externalUrl
        price { floatingPointDecimalString currency { code } }
        photos { url }
      }
      donationFund { title fundType platform { name } goalMonetaryValue { floatingPointDecimalString } }
    }
  }
`;

interface JoyRawItem {
  id: string;
  stillNeeded: number | null;
  alreadyPurchased: number | null;
  totalRequested: number | null;
  note: string | null;
  isHidden: boolean | null;
  mustHave: boolean | null;
  storeName: string | null;
  externallyOwned: boolean | null;
  fpIndex: number | null;
  productData: {
    title: string | null;
    description: string | null;
    externalUrl: string | null;
    price: { floatingPointDecimalString: string | null; currency: { code: string | null } | null } | null;
    photos: Array<{ url: string | null }> | null;
  } | null;
  donationFund: { title: string | null; fundType: string | null } | null;
}

let cache: { registry: JoyRegistry; fetchedAt: number } | null = null;

function toRegistry(items: JoyRawItem[]): JoyRegistry {
  const visible = items
    .filter((item) => !item.isHidden)
    .sort((a, b) => (a.fpIndex ?? Number.MAX_SAFE_INTEGER) - (b.fpIndex ?? Number.MAX_SAFE_INTEGER));

  const products: JoyProduct[] = [];
  const funds: JoyFund[] = [];

  for (const item of visible) {
    const data = item.productData;
    const title = data?.title ?? item.donationFund?.title;
    if (!title) continue;

    const photoUrl = data?.photos?.find((photo) => photo.url)?.url ?? null;

    // Joy models group-gifted physical items as donation funds with
    // fundType "gift"; they carry a real product price and item-count
    // semantics, so only true cash funds ("cash") belong in the funds list.
    if (item.donationFund && item.donationFund.fundType !== 'gift') {
      funds.push({
        id: item.id,
        title,
        description: data?.description ?? null,
        photoUrl,
        note: item.note,
      });
      continue;
    }

    const priceString = data?.price?.floatingPointDecimalString;
    const price = priceString != null ? Number.parseFloat(priceString) : NaN;

    products.push({
      id: item.id,
      title,
      description: data?.description ?? null,
      photoUrl,
      price: Number.isFinite(price) ? price : null,
      currencyCode: data?.price?.currency?.code ?? null,
      storeName: item.storeName,
      stillNeeded: item.stillNeeded ?? 0,
      totalRequested: item.totalRequested ?? 0,
      mustHave: item.mustHave ?? false,
      note: item.note,
    });
  }

  return { products, funds };
}

/**
 * Fetch the registry from Joy, with a module-level 15-minute cache.
 * Returns `null` when JOY_EVENT_ID is unset or the fetch fails and no
 * previously fetched copy exists — never throws.
 */
export async function fetchJoyRegistry(): Promise<JoyRegistry | null> {
  const eventId = process.env.JOY_EVENT_ID;
  if (!eventId) return null;

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.registry;
  }

  try {
    const response = await fetch(JOY_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: REGISTRY_QUERY, variables: { id: eventId } }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Joy GraphQL error: ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: { registryItemsByEventId?: JoyRawItem[] };
      errors?: Array<{ message?: string }>;
    };

    const items = payload.data?.registryItemsByEventId;
    if (!items) {
      throw new Error(payload.errors?.[0]?.message ?? 'Joy GraphQL returned no registry data');
    }

    cache = { registry: toRegistry(items), fetchedAt: Date.now() };
    return cache.registry;
  } catch (error) {
    console.error('Joy registry fetch failed:', error);
    // Serve a stale copy over the fallback card if we ever had data.
    return cache?.registry ?? null;
  }
}
