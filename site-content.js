/* ============================================================================
 * site-content.js — Public-site CMS renderer (Phase 1)
 * ----------------------------------------------------------------------------
 * Makes public pages render editable content saved by the admin Site Editor.
 * Source of truth = Firestore `siteContent/<page>`; a localStorage mirror
 * (`opusz_site_<page>`) is applied instantly to avoid a flash and as offline
 * fallback. If neither exists, the page keeps its built-in default content.
 *
 * Two override channels:
 *   1) i18n overrides — cfg.i18n.{en,zh} merged into window.I18N then re-applied
 *      via the page's switchLang(). Use for any text that has a data-i18n key.
 *   2) direct overrides — cfg.cms[key] applied to elements tagged
 *      data-cms="key" (text by default; data-cms-attr="src|href|html" for others).
 *
 * Include on a public page:  <script type="module" src="site-content.js"></script>
 * Page id defaults to 'home'; override with <html data-cms-page="musicians"> etc.
 * ==========================================================================*/
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDe_1bECi6uRHqiUwIUb1hcJdixILUir4s",
  authDomain: "opusz-45280.firebaseapp.com",
  projectId: "opusz-45280",
  storageBucket: "opusz-45280.firebasestorage.app",
  messagingSenderId: "304745430147",
  appId: "1:304745430147:web:e2900cb48d5726e5c12fb6"
};

const PAGE = (document.documentElement.getAttribute('data-cms-page') || 'home').trim();

function waitForI18N(cb){
  // Run cb once the page's i18n engine exists (or there are data-cms targets), with a cap.
  if (window.I18N || document.querySelector('[data-cms]')) { cb(); return; }
  let n = 0;
  const t = setInterval(function(){
    if (window.I18N || ++n > 30) { clearInterval(t); cb(); }
  }, 100);
}

function applyConfig(cfg){
  if (!cfg || typeof cfg !== 'object') return;

  // 1) i18n dictionary overrides → re-render in the current language
  if (cfg.i18n && window.I18N) {
    ['en','zh'].forEach(function(l){
      if (cfg.i18n[l]) { window.I18N[l] = window.I18N[l] || {}; Object.assign(window.I18N[l], cfg.i18n[l]); }
    });
    if (typeof window.switchLang === 'function') {
      try { window.switchLang(window._currentLang || 'en'); } catch(e){}
    }
  }

  // 2) direct data-cms overrides (non-i18n text / images / links)
  if (cfg.cms) {
    Object.keys(cfg.cms).forEach(function(key){
      var v = cfg.cms[key];
      if (v == null) return;
      document.querySelectorAll('[data-cms="' + key + '"]').forEach(function(el){
        var attr = el.getAttribute('data-cms-attr');
        if (attr === 'src') {
          if (el.getAttribute('src') === v) return;   // no-op if unchanged (avoids restart flicker)
          el.src = v;
          // <video> needs an explicit reload to pick up a new src and resume playback
          if (el.tagName === 'VIDEO') {
            try { el.load(); var p = el.play(); if (p && p.catch) p.catch(function(){}); } catch(e){}
          }
        }
        else if (attr === 'href') el.setAttribute('href', v);
        else if (attr === 'html') el.innerHTML = v;
        else if (attr === 'bg')   el.style.backgroundImage = "url('" + v + "')";
        else                      el.textContent = v;
      });
    });
  }
}

// (A) instant paint from the localStorage mirror — no flash, works offline.
try {
  var mirror = JSON.parse(localStorage.getItem('opusz_site_' + PAGE) || 'null');
  if (mirror) waitForI18N(function(){ applyConfig(mirror); });
} catch(e){}

// (B) source of truth: Firestore siteContent/<page>
try {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  getDoc(doc(db, 'siteContent', PAGE)).then(function(snap){
    if (snap.exists()) {
      var cfg = snap.data();
      try { localStorage.setItem('opusz_site_' + PAGE, JSON.stringify(cfg)); } catch(e){}
      waitForI18N(function(){ applyConfig(cfg); });
    }
  }).catch(function(e){ console.warn('[site-content] Firestore read failed:', e); });
} catch(e){ console.warn('[site-content] init failed:', e); }

// Live preview channel: the admin Site Editor postMessages a config to apply instantly
// (same-origin iframe). Lets the owner see edits without saving/reloading.
window.addEventListener('message', function(e){
  if (e && e.data && e.data.__opuszCmsPreview) {
    waitForI18N(function(){ applyConfig(e.data.config); });
  }
});

// ── EDITOR MODE (admin Site Editor preview only — gated by ?cmsedit=1) ───────
// Adds Shopify-style: blue highlight of a section on request, click-a-section to
// select it (reports back to the editor), and locks navigation so the preview
// can't wander off the page. None of this runs for real public visitors.
(function(){
  var isEdit = false;
  try { isEdit = new URLSearchParams(location.search).get('cmsedit') === '1'; } catch(e){}
  if (!isEdit) return;

  var hl = null, hlTarget = null;
  function ensureHl(){
    if (hl) return hl;
    hl = document.createElement('div');
    hl.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:3px solid #2563eb;'
      + 'border-radius:8px;box-shadow:0 0 0 3px rgba(37,99,235,.25);transition:all .12s ease;display:none;';
    document.documentElement.appendChild(hl);
    window.addEventListener('scroll', positionHl, true);
    window.addEventListener('resize', positionHl);
    return hl;
  }
  function positionHl(){
    if (!hl || !hlTarget) return;
    var r = hlTarget.getBoundingClientRect();
    hl.style.display = 'block';
    hl.style.left = r.left + 'px'; hl.style.top = r.top + 'px';
    hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px';
  }
  function highlight(key){
    ensureHl();
    var el = document.querySelector('[data-cms-section="' + key + '"]');
    if (!el){ hl.style.display = 'none'; hlTarget = null; return; }
    hlTarget = el;
    // This page cancels smooth scrolls (scroll-animation handlers), so jump instantly.
    var y = el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0) - 60;
    window.scrollTo(0, Math.max(0, y));
    positionHl();
    setTimeout(positionHl, 120);   // re-measure after any layout settle
  }

  // Editor → preview: highlight a section
  window.addEventListener('message', function(e){
    if (e && e.data && e.data.__opuszCmsHighlight) highlight(e.data.key);
  });

  // Preview → editor: clicking a section selects it; also block real navigation
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a){ var href = a.getAttribute('href') || ''; if (href && href.charAt(0) !== '#'){ e.preventDefault(); e.stopPropagation(); } }
    var sec = e.target && e.target.closest ? e.target.closest('[data-cms-section]') : null;
    if (sec){ try { parent.postMessage({ __opuszCmsSelect:true, key: sec.getAttribute('data-cms-section') }, '*'); } catch(_){} }
  }, true);

  // pointer affordance over selectable sections
  document.addEventListener('mouseover', function(e){
    var sec = e.target && e.target.closest ? e.target.closest('[data-cms-section]') : null;
    if (sec) sec.style.cursor = 'pointer';
  }, true);
})();

// Re-apply i18n overrides after any later language switch (in case switchLang re-clobbers).
document.addEventListener('opusz:langchange', function(){
  try {
    var m = JSON.parse(localStorage.getItem('opusz_site_' + PAGE) || 'null');
    if (m && m.i18n && window.I18N) {
      ['en','zh'].forEach(function(l){ if (m.i18n[l]) Object.assign(window.I18N[l] = window.I18N[l]||{}, m.i18n[l]); });
    }
  } catch(e){}
});
