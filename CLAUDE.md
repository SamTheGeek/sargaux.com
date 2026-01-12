# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the wedding website repository for Sam & Margaux (sargaux.com), built with Astro.

## License

The website source code (HTML, CSS, JavaScript) is licensed under **Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0)**:
- ✅ You may reuse and adapt the code for non-commercial purposes
- ✅ Attribution is required
- ❌ Commercial use is not permitted

**Important**: Website text, photos, and media are not licensed and remain © Sam Gross. Do not generate, include, or commit any placeholder content, images, or text without explicit user direction.

## Tech Stack

- **Framework**: Astro v5.16.8
- **Language**: TypeScript with strict mode enabled
- **Node.js**: v24.12.0 (LTS v22.x recommended)
- **Package Manager**: npm v11.6.2

## Development Commands

```bash
# Start development server (http://localhost:1213)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Project Structure

- `src/pages/` - Astro pages (file-based routing)
- `src/` - Source code (components, layouts, etc.)
- `public/` - Static assets (served at root)
- `astro.config.mjs` - Astro configuration
- `tsconfig.json` - TypeScript configuration (extends astro/tsconfigs/strict)

## Architecture Notes

- Uses Astro's minimal template as the base
- TypeScript strict mode is enabled for type safety
- File-based routing: pages in `src/pages/` become routes
- Static assets in `public/` are served at root path
