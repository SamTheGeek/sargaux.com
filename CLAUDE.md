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

# Run tests (accessibility & best practices)
npm test

# Install Playwright browsers (required for testing)
npm run test:install
```

## Git Workflow

**IMPORTANT**: Direct pushes to the `main` branch are not allowed. All code changes must go through the following process:

1. Create a new branch for your changes
2. Make commits to your branch
3. Push your branch and create a pull request **in draft mode**
4. Only humans should mark PRs as "Ready for review" via the GitHub website
5. Wait for automated tests to pass (accessibility & best practices)
6. Merge via pull request after approval

**Note**: Always open PRs as drafts initially. This prevents running tests excessively and allows for review of changes before triggering the full test suite.

Example workflow:
```bash
git checkout -b feature/my-changes
# Make your changes and commit
git push -u origin feature/my-changes
# Create DRAFT PR on GitHub using gh CLI:
gh pr create --draft --title "Your title" --body "Your description"
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
