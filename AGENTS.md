# Agent Instructions

## Astro CSS And Transitions

- Do not `@import` shared site CSS like `src/styles/tokens.css` or `src/styles/base.css` inside inline Astro `<style>` blocks, especially in shared layouts.
- Import shared CSS at the module level instead, for example:
  `import '../styles/tokens.css';`
  `import '../styles/base.css';`
- Reason: during Astro client-side transitions, inline layout style blocks can be left behind as stale duplicates. This previously caused `/nyc/details -> /nyc` to render old typography values after transition even though direct page loads were correct.
- If a page is correct on direct load but wrong only after SPA navigation, inspect the live `<style data-vite-dev-id>` tags in the browser and look for duplicated stale route or layout styles before changing page-level CSS.
