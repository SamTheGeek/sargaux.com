# Image Guide

This document describes what images are needed and where they should be placed.

## Folder Structure

```
images/
├── hero/           # Homepage hero images
├── couple/         # Photos of Sam & Margaux
├── nyc/            # NYC event photos (venue, city, etc.)
└── france/         # France event photos (Village De Sully, etc.)
```

## Required Images

### Homepage (`/`)

| Placeholder | Folder | Suggested Content |
|-------------|--------|-------------------|
| `hero-main` | `hero/` | Full-width couple photo — candid moment, engagement-style, or favorite photo together. Should feel warm and inviting. |

### NYC Event Pages (`/nyc/`)

| Placeholder | Folder | Suggested Content |
|-------------|--------|-------------------|
| `nyc-hero` | `nyc/` | NYC skyline at dusk, or the venue exterior if available. Sets the urban, elegant tone. |
| `nyc-venue` | `nyc/` | Interior of the dinner venue — cocktail atmosphere, table settings, or similar aesthetic. |
| `nyc-dancing` | `nyc/` | Dancing venue interior, or a mood-board style image showing the vibe (low lighting, celebration). |

### France Event Pages (`/france/`)

| Placeholder | Folder | Suggested Content |
|-------------|--------|-------------------|
| `france-hero` | `france/` | Village De Sully exterior — the grounds, main building, or scenic view of the property. |
| `france-grounds` | `france/` | The village grounds — gardens, walkways, outdoor spaces where guests will gather. |
| `france-accommodation` | `france/` | Guest accommodation at the village — room interior or building exterior. |
| `france-ceremony` | `france/` | Ceremony location on the property, or similar outdoor ceremony setting. |

### Shared Pages

| Placeholder | Folder | Suggested Content |
|-------------|--------|-------------------|
| `couple-about` | `couple/` | Casual couple photo for any "about us" or "our story" section. |
| `couple-registry` | `couple/` | Fun or playful couple photo for the registry page header. |

## Image Specifications

- **Format**: WebP preferred, JPEG/PNG accepted (will be converted on build)
- **Hero images**: Minimum 1920px wide, 16:9 or 3:2 aspect ratio
- **Content images**: Minimum 800px wide
- **File size**: Keep under 500KB per image when possible

## Naming Convention

Use the placeholder name from the table above:
- `hero-main.webp`
- `nyc-hero.jpg`
- `france-grounds.webp`

The site will reference images by these names.
