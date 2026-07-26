# Image Asset Guide

Describes what images the site needs and where they live, under `public/images/`.

## Folder structure

```
images/
├── hero/           # Homepage hero images
├── couple/         # Photos of Sam & Margaux
├── nyc/            # NYC event photos (venue, city, etc.)
└── france/         # France event photos (Village De Sully, etc.)
```

## Required images

### Homepage (`/`)

| Placeholder | Folder | Suggested content |
|---|---|---|
| `hero-main` | `hero/` | Full-width couple photo — candid, engagement-style, or a favorite together photo. Warm and inviting. |

### NYC event pages (`/nyc/`)

| Placeholder | Folder | Suggested content |
|---|---|---|
| `nyc-hero` | `nyc/` | NYC skyline at dusk, or the venue exterior. Urban, elegant tone. |
| `nyc-venue` | `nyc/` | Dinner venue interior — cocktail atmosphere, table settings. |
| `nyc-dancing` | `nyc/` | Dancing venue interior, or a mood-board image (low lighting, celebration). |

### France event pages (`/france/`)

| Placeholder | Folder | Suggested content |
|---|---|---|
| `france-hero` | `france/` | Village de Sully exterior — grounds, main building, or scenic view. |
| `france-grounds` | `france/` | Gardens, walkways, outdoor gathering spaces. |
| `france-accommodation` | `france/` | Guest accommodation — room interior or building exterior. |
| `france-ceremony` | `france/` | Ceremony location, or a similar outdoor setting. |

### Shared pages

| Placeholder | Folder | Suggested content |
|---|---|---|
| `couple-about` | `couple/` | Casual couple photo for an "about us"/"our story" section. |
| `couple-registry` | `couple/` | Fun or playful couple photo for the registry page header. |

## Specifications

- Format: WebP preferred (JPEG/PNG accepted, converted on build).
- Hero images: minimum 1920px wide, 16:9 or 3:2 aspect ratio.
- Content images: minimum 800px wide.
- Keep file size under 500KB per image when possible.

## Naming convention

Use the placeholder name from the tables above, e.g. `hero-main.webp`, `nyc-hero.jpg`, `france-grounds.webp`. The site references images by these names.

> **Guest privacy note**: this page is about site imagery only. Never commit real guest photos, addresses, or PII to the repo — see [Guest Privacy & Security](Guest-Privacy-And-Security).
