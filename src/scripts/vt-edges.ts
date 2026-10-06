/**
 * Edge bars — keep the strips under iOS Safari's browser UI painted during
 * a page transition.
 *
 * On iOS the page draws edge to edge: the strip under the status bar and the
 * strip under the floating toolbar both show page content. During a view
 * transition, WebKit sizes the root snapshot to the *visible content rect*,
 * which excludes those obscured strips (WebKit's own FIXME: "Bug 285400 -
 * Correctly account for insets", in ViewTransition::containingBlockRect).
 * The live page is not painted while the root is captured, so for the length
 * of every transition the strips go blank and the content pops back in at
 * the end.
 *
 * Elements with their own view-transition-name are captured at their full
 * layer bounds rather than clipped to that rect, so they *do* paint into the
 * strips. Two fixed bars (.vt-edge in WireframeLayout) reach from the edges
 * of the visible area out past the screen edges. For each navigation they
 * take the color at that edge of the screen — sampled on the old page before
 * the old snapshot, and on the new page before the new one — and get a
 * view-transition-name, so each strip crossfades from the old page's edge
 * color to the new page's. They are hidden again once the transition ends.
 *
 * iOS/iPadOS only: other engines either include the strips in the snapshot
 * or have no strips, and there the bars would only add snapshot work.
 */

import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';

const IOS =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

type Edge = 'top' | 'bottom';
const EDGES: Edge[] = ['top', 'bottom'];

function isOpaque(color: string): boolean {
  return color !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(color);
}

/** The first opaque background at (x, y), walking up from the topmost element. */
function colorAt(x: number, y: number): string {
  for (let el = document.elementFromPoint(x, y); el; el = el.parentElement) {
    if (el.classList.contains('vt-edge')) continue;
    const bg = getComputedStyle(el).backgroundColor;
    if (isOpaque(bg)) return bg;
  }
  const body = getComputedStyle(document.body).backgroundColor;
  return isOpaque(body) ? body : getComputedStyle(document.documentElement).backgroundColor;
}

function bar(edge: Edge): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.vt-edge-${edge}`);
}

/** Paint both bars with the colors currently at the screen edges and name them. */
function showBars(): void {
  const x = window.innerWidth / 2;
  const y = { top: 1, bottom: window.innerHeight - 1 };
  // Where the visible area ends; the bottom bar starts here (see the CSS).
  document.documentElement.style.setProperty('--vt-edge-visible-h', `${window.innerHeight}px`);
  for (const edge of EDGES) {
    const el = bar(edge);
    if (!el) continue;
    el.style.backgroundColor = colorAt(x, y[edge]);
    el.hidden = false;
    el.style.setProperty('view-transition-name', `vt-edge-${edge}`);
  }
}

function hideBars(): void {
  for (const edge of EDGES) {
    const el = bar(edge);
    if (!el) continue;
    el.hidden = true;
    el.style.removeProperty('view-transition-name');
  }
  document.documentElement.style.removeProperty('--vt-edge-visible-h');
}

if (IOS) {
  let awaitingFinish = false;

  // Old page, before the old snapshot is taken.
  document.addEventListener('astro:before-preparation', showBars);

  // before-swap fires inside the update callback, after the old snapshot;
  // the transition object is only exposed here.
  document.addEventListener('astro:before-swap', (e) => {
    const transition = (e as TransitionBeforeSwapEvent).viewTransition;
    if (!transition) return;
    awaitingFinish = true;
    transition.finished.finally(() => {
      awaitingFinish = false;
      hideBars();
    });
  });

  // New page, swapped in and scrolled to its final position (Astro scrolls
  // before after-swap), before the new snapshot is taken.
  document.addEventListener('astro:after-swap', showBars);

  // A navigation that never ran a view transition (skipped, or a browser
  // without them) must not leave the bars up.
  document.addEventListener('astro:page-load', () => {
    if (!awaitingFinish) hideBars();
  });
}
