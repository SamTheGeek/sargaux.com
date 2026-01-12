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

# Run all tests (accessibility, best practices, and performance)
npm test

# Run specific test suites
npx playwright test tests/accessibility.spec.ts
npx playwright test tests/best-practices.spec.ts
npx playwright test tests/performance.spec.ts

# Install Playwright browsers (required for testing)
npm run test:install
```

## Testing

The project includes comprehensive automated testing that runs on every PR:

### Test Suites (run in parallel)

1. **Accessibility Tests** (`.github/workflows/accessibility-tests.yml`)
   - WCAG 2.0/2.1 AA compliance
   - Proper document structure (h1, lang, meta tags)
   - Color contrast requirements
   - Keyboard navigation support
   - Semantic HTML structure

2. **Performance Tests** (`.github/workflows/performance-tests.yml`)
   - Core Web Vitals (LCP, FCP, CLS)
   - Time to Interactive (TTI)
   - DOM Content Loaded timing
   - Total page size limits
   - JavaScript execution time
   - Resource loading efficiency
   - Server response time
   - Font loading optimization

Both test suites run simultaneously in CI to provide faster feedback.

## Git Workflow

**IMPORTANT**: Direct pushes to the `main` branch are not allowed. All code changes must go through the following process:

1. Create a new branch for your changes
2. Make commits to your branch
3. Push your branch and create a pull request **in draft mode**
4. Only humans should mark PRs as "Ready for review" via the GitHub website
5. Wait for automated tests to pass (accessibility, best practices, and performance run in parallel)
6. Merge via pull request after approval

**Note**: Always open PRs as drafts initially. This prevents running tests excessively and allows for review of changes before triggering the full test suite.

**Test Skipping**: Automated tests are automatically skipped for PRs that only modify:
- Markdown files (`*.md`)
- YAML files (`*.yml`, `*.yaml`) - CI/CD and configuration
- LICENSE file
- `.gitignore`
- `playwright.config.ts` - test configuration

These changes are build configuration and documentation that don't affect the website's accessibility or functionality.

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
