# Agent Instructions

## Astro CSS And Transitions

- Do not `@import` shared site CSS like `src/styles/tokens.css` or `src/styles/base.css` inside inline Astro `<style>` blocks, especially in shared layouts.
- Import shared CSS at the module level instead, for example:
  `import '../styles/tokens.css';`
  `import '../styles/base.css';`
- Reason: during Astro client-side transitions, inline layout style blocks can be left behind as stale duplicates. This previously caused `/nyc/details -> /nyc` to render old typography values after transition even though direct page loads were correct.
- If a page is correct on direct load but wrong only after SPA navigation, inspect the live `<style data-vite-dev-id>` tags in the browser and look for duplicated stale route or layout styles before changing page-level CSS.
- If a transition fix works only on the first navigation but fails on repeated back/forward or sibling navigations, move the transition-critical override out of the layout's inline `<style>` block and into a module-level shared stylesheet imported by the layout. This fixed the France Travel dark-mode info boxes on repeated `/france <-> /france/travel` navigations.
- For repeated-navigation debugging, compare the count/order of `style[data-vite-dev-id]` tags for the page stylesheet versus the shared stylesheet after the first and second visit. A stable shared fix should remain mounted once across navigations even when the route stylesheet is duplicated or replaced.
