/**
 * Elastic page edges — one overscroll behavior for NYC and France.
 *
 * Top edge ("lampshade"): pulling past the top leaves the content where it is
 * and slides the sticky header down over it, its fill panel (.site-header::before
 * in base.css) growing above it, then springs back on release. Native elastic
 * overscroll can't do this: it moves the whole document, header and content
 * together. So while the page is in its top half, native overscroll is switched
 * off (`overscroll-behavior-y: none`) and the pull is driven here, from touch
 * drags, trackpad wheel events, and touch flings that hit the top.
 *
 * Bottom edge: native bounce, kept. While the page is in its bottom half,
 * overscroll is restored and the canvas (html background, which is what the
 * browser paints in the overscroll area) takes the color at the bottom edge of
 * the page, so the footer appears to extend into the bounce.
 *
 * Only platforms that rubber-band natively (Apple) get any of this, and only
 * browsers that honor overscroll-behavior. Everywhere else — and on pages with
 * no sticky header — the native behavior is left untouched, which is the
 * fallback: the header fill panel still covers a native top bounce.
 */

export {};

const ELASTIC_PLATFORM = /Macintosh|iPhone|iPad|iPod/.test(navigator.userAgent);
const SUPPORTED =
  ELASTIC_PLATFORM &&
  typeof CSS !== 'undefined' &&
  CSS.supports('overscroll-behavior-y', 'none');

/** iOS-style rubber-band: resistance grows with distance, never exceeds `dim`. */
function rubberBand(distance: number, dim: number): number {
  return (1 - 1 / ((distance * 0.55) / dim + 1)) * dim;
}

let header: HTMLElement | null = null;
let atBottomHalf: boolean | null = null;

/* ── Header offset ─────────────────────────────────────────────────────── */

let pull = 0; // raw (un-dampened) pull distance in px
let springFrame = 0;

/** Inverse of rubberBand(): the raw pull that displays as `offset`. */
function unRubberBand(offset: number, dim: number): number {
  return offset >= dim ? Infinity : (dim / 0.55) * (1 / (1 - offset / dim) - 1);
}

/**
 * Every frame of the header's motion — pull, spring-back and fling bounce —
 * goes through this one inline-transform write. Safari drops a sticky header
 * from the screen for the length of a CSS transition (or a Web Animation) on
 * its transform and paints it again at the end, so the motion is never handed
 * to the compositor: it is stepped from requestAnimationFrame instead, exactly
 * like the finger-driven pull that already rendered correctly.
 */
function paintOffset(offset: number): void {
  const el = header;
  if (!el) return;
  // Snap to device pixels: at a fractional offset the antialiased seam between
  // the fill panel and the header lets whatever is behind (the NYC disc) bleed
  // through as a hairline.
  const dpr = window.devicePixelRatio || 1;
  const snapped = Math.round(offset * dpr) / dpr;
  el.style.transform = snapped > 0 ? `translateY(${snapped}px)` : '';
}

function cancelSpring(): void {
  if (springFrame) cancelAnimationFrame(springFrame);
  springFrame = 0;
}

function setPull(raw: number): void {
  cancelSpring();
  pull = Math.max(0, raw);
  paintOffset(rubberBand(pull, window.innerHeight));
}

const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/**
 * Animate the displayed offset through `stops`, one eased segment per pair.
 * `pull` tracks the displayed offset each frame, so a new pull that interrupts
 * the animation picks the header up where it is rather than jumping.
 */
function animateOffset(stops: { to: number; ms: number; ease: (t: number) => number }[]): void {
  cancelSpring();
  const dim = window.innerHeight;
  let from = rubberBand(pull, dim);
  let segment = 0;
  let segmentStart = performance.now();

  const step = (now: number) => {
    const stop = stops[segment];
    // A rAF timestamp is the frame start, which can precede segmentStart.
    const t = Math.min(1, Math.max(0, (now - segmentStart) / stop.ms));
    const offset = from + (stop.to - from) * stop.ease(t);
    pull = unRubberBand(offset, dim);
    paintOffset(offset);
    if (t < 1) {
      springFrame = requestAnimationFrame(step);
    } else if (++segment < stops.length) {
      from = stop.to;
      segmentStart = now;
      springFrame = requestAnimationFrame(step);
    } else {
      pull = 0;
      springFrame = 0;
    }
  };
  springFrame = requestAnimationFrame(step);
}

function release(): void {
  if (pull > 0) animateOffset([{ to: 0, ms: 450, ease: easeOutQuart }]);
}

/* ── Edge state: which half of the page are we in? ─────────────────────── */

function isTransparent(color: string): boolean {
  return color === 'transparent' || /rgba\(.*,\s*0\)$/.test(color);
}

function inFlow(el: Element): boolean {
  const style = getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.position !== 'fixed' &&
    style.position !== 'absolute' &&
    el.getBoundingClientRect().height > 0
  );
}

function lastInFlowChild(el: Element): Element | null {
  for (let child = el.lastElementChild; child; child = child.previousElementSibling) {
    if (inFlow(child)) return child;
  }
  return null;
}

/**
 * The background color painted along the bottom edge of the document: the
 * innermost opaque background among the in-flow elements whose boxes reach
 * the bottom of their parent, starting from body.
 */
function bottomEdgeColor(): string {
  let color = getComputedStyle(document.body).backgroundColor;
  let el: Element | null = document.body;
  while (el) {
    const child = lastInFlowChild(el);
    if (!child) break;
    if (Math.abs(child.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom) > 2) break;
    const bg = getComputedStyle(child).backgroundColor;
    if (!isTransparent(bg)) color = bg;
    el = child;
  }
  return color;
}

function updateEdgeState(force = false): void {
  const root = document.documentElement;
  const maxScroll = root.scrollHeight - window.innerHeight;
  const bottomHalf = maxScroll > 0 && window.scrollY > maxScroll / 2;
  if (!force && bottomHalf === atBottomHalf) return;
  atBottomHalf = bottomHalf;

  if (bottomHalf) {
    root.style.overscrollBehaviorY = '';
    root.style.backgroundColor = bottomEdgeColor();
  } else {
    root.style.backgroundColor = '';
    root.style.overscrollBehaviorY = header ? 'none' : '';
  }
}

/* ── Touch: drag past the top ──────────────────────────────────────────── */

let touchActive = false;
let anchorY = 0;
let lastTouchEnd = 0;

function insideScrolledContainer(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return true;
  }
  return false;
}

function onTouchStart(e: TouchEvent): void {
  touchActive = e.touches.length === 1 && !insideScrolledContainer(e.target);
  // Catching the header mid-spring: carry on from where it is. A touch this
  // module ignores leaves the spring running, or the header would stay down.
  if (touchActive) cancelSpring();
  anchorY = (e.touches[0]?.clientY ?? 0) - pull;
}

function onTouchMove(e: TouchEvent): void {
  if (!touchActive || !header || e.touches.length !== 1) return;
  const y = e.touches[0].clientY;
  // Only from exactly the top. A negative scrollY means a native bounce is
  // already running; leave it alone rather than stacking a second one.
  if (window.scrollY !== 0) {
    anchorY = y;
    if (pull > 0) setPull(0);
    return;
  }
  const raw = y - anchorY;
  if (raw <= 0) {
    anchorY = y;
    if (pull > 0) setPull(0);
    return;
  }
  setPull(raw);
  if (e.cancelable) e.preventDefault();
}

function onTouchEnd(e: TouchEvent): void {
  if (e.touches.length > 0) return;
  touchActive = false;
  lastTouchEnd = performance.now();
  release();
}

/* ── Trackpad: wheel past the top ──────────────────────────────────────── */

let wheelReleaseTimer = 0;
let lastWheel = 0;

function onWheel(e: WheelEvent): void {
  lastWheel = performance.now();
  if (!header || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  // Ignore the near-zero tail of a momentum scroll so the shade springs back
  // promptly, the way a native bounce does, instead of hanging until it ends.
  if (Math.abs(e.deltaY) < 1) return;

  if (pull > 0 && e.deltaY > 0) {
    // Pushing back up: retract the shade before the page starts scrolling.
    setPull(pull - e.deltaY);
    e.preventDefault();
  } else if (window.scrollY === 0 && e.deltaY < 0) {
    setPull(pull - e.deltaY);
  } else {
    return;
  }
  window.clearTimeout(wheelReleaseTimer);
  wheelReleaseTimer = window.setTimeout(release, 90);
}

/* ── Touch fling that hits the top ─────────────────────────────────────── */

let lastScrollY = window.scrollY;
let lastScrollT = performance.now();

function onScroll(): void {
  const now = performance.now();
  const y = window.scrollY;
  const velocity = (y - lastScrollY) / Math.max(1, now - lastScrollT); // px/ms, negative = upward

  const flungIntoTop =
    y === 0 &&
    lastScrollY > 0 &&
    !touchActive &&
    pull === 0 &&
    now - lastTouchEnd < 3000 &&
    lastWheel < lastTouchEnd && // trackpad momentum is handled by onWheel
    velocity < -0.3;

  if (flungIntoTop) {
    const depth = Math.min(window.innerHeight * 0.12, -velocity * 40);
    animateOffset([
      { to: depth, ms: 180, ease: easeOutQuart },
      { to: 0, ms: 420, ease: easeInOutSine },
    ]);
  }

  lastScrollY = y;
  lastScrollT = now;
  updateEdgeState();
}

/* ── Lifecycle ─────────────────────────────────────────────────────────── */

function bindPage(): void {
  header = document.querySelector<HTMLElement>('.site-header');
  pull = 0;
  lastScrollY = window.scrollY;
  updateEdgeState(true);
}

if (SUPPORTED) {
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => updateEdgeState(true));
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => updateEdgeState(true));

  // A view transition must never snapshot a half-pulled header.
  document.addEventListener('astro:before-preparation', () => {
    window.clearTimeout(wheelReleaseTimer);
    setPull(0);
  });
  document.addEventListener('astro:page-load', bindPage);
}
