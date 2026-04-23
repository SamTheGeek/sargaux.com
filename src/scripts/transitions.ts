/**
 * Sargaux view-transition choreography.
 *
 * Extracted from WireframeLayout.astro <script> block so it can be bundled
 * once and shared across all layouts without inlining into every route's HTML.
 *
 * Architecture overview
 * ─────────────────────
 * In Astro 6, astro:after-preparation fires as a plain Event (no from/to/
 * newDocument). Navigation data is only available on astro:before-preparation
 * (TransitionBeforePreparationEvent) and astro:before-swap
 * (TransitionBeforeSwapEvent). We cache from/to on before-preparation and
 * use that cache in after-preparation.
 *
 * The disc (event-disc) FLIPs naturally above the root group unless a
 * route family explicitly suppresses that VT name. Content that must
 * render above an independently animating disc during transitions uses
 * its own VT group:
 *   - Landing page .hero-grid (landing-content) → z:3
 *   - Couple page .couple-grid (couple-content) → z:3
 *   - France page content wrappers              → z:3
 *
 * NYC index/sub-page navigations use a hybrid approach:
 *   - Forward (/nyc -> /nyc/*): leave the disc active on both documents
 *     so it FLIPs into the sub-page position while the incoming moss zone
 *     slides upward above it.
 *   - Backward (/nyc/* -> /nyc): restore event-disc on the OLD sub-page
 *     disc and leave the NEW /nyc disc active so the disc FLIPs back to
 *     the main page instead of crossfading.
 *   - Sibling (/nyc/* -> /nyc/*): suppress the disc on both sides.
 *
 * NYC index -> sub-page also TEMPORARILY gives the incoming sub-page hero
 * its own VT group so the entering headline block sits above the exiting
 * root snapshot. That VT name must be injected in before-swap and removed
 * on page-load; leaving it in the markup would keep the hero promoted
 * after the transition and break its normal z-index relationship with the
 * disc while scrolling.
 *
 * Header children (site-logo, event-toggle, nyc-rsvp-btn) have named VTs
 * only on /nyc/index, not on sub-pages. For any /nyc sub-page navigation
 * we suppress those names on BOTH the old page and the incoming document
 * to prevent one-sided orphaned VT groups that would fade independently.
 *
 * Any nav TO /nyc:
 *   before-swap injects view-transition-name "nyc-skyline" onto the
 *   incoming skyline element for its fade-in animation.
 *
 * Safari note
 * ───────────
 * Safari 18+ ships the View Transitions API, but the specific VT snapshot
 * path for `nyc-page-moss` triggers a clipping bug on the travel page when
 * the moss zone has `view-transition-name` set during the NYC→sub-page
 * transition. The `data-safari-vt-fallback` flag disables that VT name for
 * Safari and substitutes a CSS @keyframe DOM animation (.nyc-page-moss-entering)
 * that plays on the live element instead of the VT snapshot. Remove once
 * the clipping regression is confirmed fixed across Safari versions.
 */

declare global {
  interface Window {
    __sargauxDiscTransitionSetup?: boolean;
    __sargauxLangTransitionSetup?: boolean;
  }
}

// ── Disc & route transition setup ────────────────────────────────────────────

if (!window.__sargauxDiscTransitionSetup) {
  window.__sargauxDiscTransitionSetup = true;

  const isSafari =
    navigator.userAgent.includes('Safari') &&
    !navigator.userAgent.includes('Chrome') &&
    !navigator.userAgent.includes('Chromium') &&
    !navigator.userAgent.includes('CriOS') &&
    !navigator.userAgent.includes('FxiOS') &&
    !navigator.userAgent.includes('EdgiOS');

  if (isSafari) {
    document.documentElement.dataset.safariVtFallback = 'true';
  }

  let _navFrom: URL | null = null;
  let _navTo: URL | null   = null;

  const syncRootRouteAttributes = (sourceDocument: Document | null) => {
    const incomingRoot = sourceDocument?.documentElement;
    if (!incomingRoot) return;

    const currentRoot = document.documentElement;
    for (const attr of ['lang', 'data-event', 'data-page']) {
      const value = incomingRoot.getAttribute(attr);
      if (value === null) {
        currentRoot.removeAttribute(attr);
      } else {
        currentRoot.setAttribute(attr, value);
      }
    }
  };

  const suppress = (el: Element | null) =>
    (el as HTMLElement | null)?.style.setProperty('view-transition-name', 'none');

  document.addEventListener('astro:before-preparation', (e) => {
    _navFrom = (e as TransitionBeforePreparationEvent).from;
    _navTo   = (e as TransitionBeforePreparationEvent).to;
  });

  // Set VT name on the OLD page's moss zone so it gets its own VT group
  // (z:4) rather than being baked into the root screenshot (z:1). This
  // lets the disc (z:2) FLIP visibly below content during the transition.
  // The name is applied here (old page) and removed in astro:page-load
  // (new page) so it never persists between navigations — persistence
  // would promote the element to a compositor layer that bypasses CSS
  // z-index during scrolling.
  document.addEventListener('astro:after-preparation', () => {
    const from      = _navFrom?.pathname?.replace(/\/$/, '') ?? '';
    const to        = _navTo?.pathname?.replace(/\/$/, '')   ?? '';
    const fromDepth = from.split('/').length;
    const toDepth   = to.split('/').length;
    const isNycForwardNav      = toDepth > fromDepth && from.startsWith('/nyc');
    const isNycBackwardNav     = to === '/nyc' && from.startsWith('/nyc/');
    const isNycSiblingNav      = from.startsWith('/nyc/') && to.startsWith('/nyc/');
    const isNycIndexToSubpage  = from === '/nyc' && to.startsWith('/nyc/');
    const useSafariMossFallback = isSafari && isNycIndexToSubpage;

    // Give old-page moss its own VT group before the old snapshot.
    if (!useSafariMossFallback) {
      document.querySelector('.nyc-page-moss')?.style.setProperty('view-transition-name', 'nyc-page-moss');
    }

    const suppressHeader = () => {
      suppress(document.querySelector('.site-logo'));
      suppress(document.querySelector('.event-toggle'));
      suppress(document.querySelector('.nyc-rsvp-btn'));
    };

    if (isNycForwardNav) {
      suppressHeader();
      // Give the outgoing NYC index hero text its own VT group at z:3 so
      // the content renders above the disc (z:2) during the FLIP animation.
      // Only the /nyc index page has .nyc-hero-text; on sub-pages this is a no-op.
      if (isNycIndexToSubpage) {
        document.querySelector('.nyc-hero-text')?.style.setProperty('view-transition-name', 'nyc-hero-text');
      }
    } else if (isNycBackwardNav) {
      // Returning to /nyc must recreate a two-sided event-disc pair.
      document.querySelector('.nyc-disc')?.style.setProperty('view-transition-name', 'event-disc');
      suppressHeader();
    } else if (isNycSiblingNav) {
      suppressHeader();
      suppress(document.querySelector('.nyc-disc'));
    }
  });

  // Give the NEW page's moss its own VT group before the new snapshot,
  // and handle header suppression and skyline fade-in.
  // before-swap fires inside startViewTransition's callback — after the
  // old snapshot, before the new snapshot.
  document.addEventListener('astro:before-swap', (e) => {
    const event     = e as TransitionBeforeSwapEvent;
    const from      = event.from?.pathname?.replace(/\/$/, '') ?? '';
    const to        = event.to?.pathname?.replace(/\/$/, '')   ?? '';
    const fromDepth = from.split('/').length;
    const toDepth   = to.split('/').length;

    // Astro swaps the incoming body/head during SPA navigation, but the
    // live <html> element can momentarily keep the old route attributes.
    // Sync them before the new snapshot so event-scoped CSS variables and
    // selectors resolve against the incoming route immediately.
    syncRootRouteAttributes(event.newDocument);

    if (isSafari) {
      event.newDocument.documentElement.dataset.safariVtFallback = 'true';
    }

    const suppressOnDoc = (el: Element | null) =>
      (el as HTMLElement | null)?.style.setProperty('view-transition-name', 'none');
    const suppressHeaderOnDoc = (doc: Document) => {
      suppressOnDoc(doc.querySelector('.site-logo'));
      suppressOnDoc(doc.querySelector('.event-toggle'));
      suppressOnDoc(doc.querySelector('.nyc-rsvp-btn'));
    };

    const isNycForwardNav      = toDepth > fromDepth && from.startsWith('/nyc');
    const isNycBackwardNav     = to === '/nyc' && from.startsWith('/nyc/');
    const isNycSiblingNav      = from.startsWith('/nyc/') && to.startsWith('/nyc/');
    const isNycIndexToSubpage  = from === '/nyc' && to.startsWith('/nyc/');
    const useSafariMossFallback = isSafari && isNycIndexToSubpage;

    // Safari uses a DOM animation fallback for the incoming moss zone.
    // Leaving the VT name in place keeps the element in the compositor
    // snapshot path, which is the branch that clips on the travel page.
    if (!useSafariMossFallback) {
      event.newDocument.querySelector('.nyc-page-moss')?.style.setProperty('view-transition-name', 'nyc-page-moss');
    } else {
      (event.newDocument.querySelector('.nyc-page-moss') as HTMLElement | null)?.style.removeProperty('view-transition-name');
    }

    if (isNycForwardNav) {
      suppressHeaderOnDoc(event.newDocument);
    } else if (isNycBackwardNav) {
      suppressHeaderOnDoc(event.newDocument);
    } else if (isNycSiblingNav) {
      suppressHeaderOnDoc(event.newDocument);
      suppressOnDoc(event.newDocument.querySelector('.nyc-disc'));
    }

    if (isNycIndexToSubpage) {
      (event.newDocument.querySelector('.nyc-page-main') as HTMLElement | null)
        ?.style.setProperty('view-transition-name', 'nyc-subpage-hero');
    }

    if (useSafariMossFallback) {
      event.newDocument.querySelector('.nyc-page-moss')?.classList.add('nyc-page-moss-entering');
    }

    // Skyline fade-in when arriving at /nyc.
    if (to === '/nyc') {
      (event.newDocument.querySelector('.nyc-skyline-wrap') as HTMLElement | null)
        ?.style.setProperty('view-transition-name', 'nyc-skyline');
      event.viewTransition?.ready?.finally(() => {
        (document.querySelector('.nyc-skyline-wrap') as HTMLElement | null)
          ?.style.removeProperty('view-transition-name');
      });
    }
  });

  // Remove the moss VT name after each transition so the compositor-layer
  // promotion from view-transition-name doesn't persist to normal browsing.
  document.addEventListener('astro:page-load', () => {
    document.querySelector<HTMLElement>('.nyc-page-moss')?.style.removeProperty('view-transition-name');
    document.querySelector<HTMLElement>('.nyc-page-main')?.style.removeProperty('view-transition-name');
    document.querySelector<HTMLElement>('.nyc-disc')?.style.removeProperty('view-transition-name');
    document.querySelector<HTMLElement>('.rsvp-disc-m')?.style.removeProperty('view-transition-name');
    document.querySelector<HTMLElement>('.site-logo')?.style.removeProperty('view-transition-name');
    document.querySelector<HTMLElement>('.event-toggle')?.style.removeProperty('view-transition-name');
    document.querySelector<HTMLElement>('.nyc-rsvp-btn')?.style.removeProperty('view-transition-name');
    syncRootRouteAttributes(document);

    const enteringMoss = document.querySelector('.nyc-page-moss-entering');
    if (enteringMoss) {
      const cleanup = () => enteringMoss.classList.remove('nyc-page-moss-entering');
      enteringMoss.addEventListener('animationend', cleanup, { once: true });
      window.setTimeout(cleanup, 500);
    }
  });
}

// ── Language-switch transition setup ─────────────────────────────────────────

if (!window.__sargauxLangTransitionSetup) {
  window.__sargauxLangTransitionSetup = true;

  const normalizeSearch = (url: URL) => {
    const params = [...url.searchParams.entries()]
      .filter(([key]) => key !== 'lang')
      .sort(([aKey, aVal], [bKey, bVal]) => {
        if (aKey === bKey) return aVal.localeCompare(bVal);
        return aKey.localeCompare(bKey);
      });

    return new URLSearchParams(params).toString();
  };

  const isLanguageOnlyNavigation = (from: URL, to: URL) => {
    if (from.origin !== to.origin) return false;
    if (from.pathname !== to.pathname) return false;
    if (from.hash !== to.hash) return false;

    const fromLang = from.searchParams.get('lang') ?? 'en';
    const toLang   = to.searchParams.get('lang')   ?? 'en';
    if (fromLang === toLang) return false;

    return normalizeSearch(from) === normalizeSearch(to);
  };

  document.addEventListener('astro:before-swap', (e) => {
    const event = e as TransitionBeforeSwapEvent;
    if (!isLanguageOnlyNavigation(event.from, event.to)) return;
    event.viewTransition.skipTransition();
  });
}
