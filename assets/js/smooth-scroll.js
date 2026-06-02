/* ─────────────────────────────────────────────────────────────
   OPUS.Z — Global lerp-damped smooth scroll
   Matches the inertial feel from musician-platform.html.
   Drop-in: <script src="assets/js/smooth-scroll.js" defer></script>

   Skipped automatically when:
   - prefers-reduced-motion is set
   - body has [data-no-smooth-scroll]
   - the page already opted-in to its own scroll lerp
     (sets window.__opuszScrollTo before this loads)
   ───────────────────────────────────────────────────────────── */
(function () {
  // Respect reduced motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Opt-out hook
  if (document.body && document.body.hasAttribute('data-no-smooth-scroll')) return;
  // Don't double-install (musician-platform.html runs its own lerp)
  if (typeof window.__opuszScrollTo === 'function') return;

  // Tuning — same feel as musician-platform.html
  var LERP        = 0.058;  // lower = heavier glide
  var STOP_EPSILON = 0.3;

  var targetY  = window.scrollY || window.pageYOffset || 0;
  var currentY = targetY;
  var rafId    = null;
  var maxY     = function () {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  };

  function tick() {
    currentY += (targetY - currentY) * LERP;
    window.scrollTo(0, currentY);
    if (Math.abs(targetY - currentY) < STOP_EPSILON) {
      window.scrollTo(0, targetY);
      currentY = targetY;
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }
  function nudge() { if (!rafId) rafId = requestAnimationFrame(tick); }

  // Don't hijack scroll when the wheel happens inside a horizontal scroller
  // (e.g. .gallery-viewport carousels) — let the browser handle those natively.
  function isInsideHorizontalScroller(el) {
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth + 1) {
        var ov = getComputedStyle(el).overflowX;
        if (ov === 'auto' || ov === 'scroll') return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  window.addEventListener('wheel', function (e) {
    // Pinch-zoom or modifier — skip
    if (e.ctrlKey) return;
    // Mostly horizontal trackpad swipe → let native handle horizontal scrollers
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (isInsideHorizontalScroller(e.target)) return;

    e.preventDefault();
    targetY = Math.max(0, Math.min(maxY(), targetY + e.deltaY));
    nudge();
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    // Don't hijack when user is typing in inputs
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    var m = maxY();
    var step = {
      ArrowDown: 80,
      ArrowUp:  -80,
      PageDown:  window.innerHeight * 0.88,
      PageUp:   -window.innerHeight * 0.88,
      Space:     window.innerHeight * 0.88,
      Home:     -1e9,
      End:       1e9
    };
    var key = e.key === ' ' ? 'Space' : e.key;
    if (!(key in step)) return;
    e.preventDefault();
    targetY = Math.max(0, Math.min(m, targetY + step[key]));
    nudge();
  });

  // If something outside our lerp scrolls the window (anchor clicks, etc.),
  // re-sync target so the next wheel event doesn't snap back.
  window.addEventListener('scroll', function () {
    if (rafId) return; // mid-lerp → we're driving it
    targetY = window.scrollY;
    currentY = targetY;
  }, { passive: true });

  // Expose a programmatic jump that participates in the lerp
  window.__opuszScrollTo = function (y) {
    targetY = Math.max(0, Math.min(maxY(), y));
    nudge();
  };

  // Anchor links → smooth-lerp to target
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var hash = a.getAttribute('href');
    if (hash.length < 2) return;
    var t = document.querySelector(hash);
    if (!t) return;
    e.preventDefault();
    var rect = t.getBoundingClientRect();
    window.__opuszScrollTo(window.scrollY + rect.top - 20);
  });
})();
