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

// Hero elements the owner can freely reposition (Canva-style) from the editor.
// Offsets live in cfg.heroPos = { key:{x,y} } in CARD-pixels and are applied via
// the INDEPENDENT CSS `translate` property — separate from `transform`, so the
// reveal / card-scale ANIMATIONS (which use transform) are completely untouched.
var HERO_DRAG = { headline:'.hco-headline', sub:'.hco-sub', btnFind:'.hco-btn-pri', btnProject:'.hco-btn-out', brand:'.hco-brand' };
// Ensure the right number of OPUS.Z brand copies (1–4) exist in the DOM.
function ensureBrandCopies(count){
  count = Math.max(1, Math.min(8, parseInt(count,10) || 1));
  var first = document.querySelector('.hco-brand'); if(!first) return;
  if(!first.getAttribute('data-bk')) first.setAttribute('data-bk','brand');
  var parent = first.parentNode;
  for(var i = parent.querySelectorAll('.hco-brand').length; i < count; i++){
    var clone = first.cloneNode(true);
    clone.setAttribute('data-bk', 'brand' + (i+1));
    clone.setAttribute('data-bcopy', '1');
    clone.style.translate = ''; clone.style.scale = ''; clone.style.outline = '';
    parent.appendChild(clone);
  }
  var list = Array.prototype.slice.call(parent.querySelectorAll('.hco-brand'));
  while(list.length > count){
    var last = list[list.length - 1];
    if(last.getAttribute('data-bcopy')){ last.remove(); list.pop(); } else break;
  }
}
function applyHeroPos(map){
  map = map || {};
  ensureBrandCopies(map._brandCount || 1);   // make the brand copies first
  Object.keys(HERO_DRAG).forEach(function(k){
    if(k === 'brand') return;   // every brand copy handled below
    var el = document.querySelector(HERO_DRAG[k]); if(!el) return;
    var p = map[k] || {};
    // Position via independent `translate` (separate from `transform`, so animations
    // stay intact). PREFER viewport-fraction (xPct/yPct → vw/vh) so the offset is the
    // SAME relative position at any screen width; fall back to legacy px (x/y).
    var has = (p.xPct != null || p.yPct != null || p.x || p.y);
    var tx = (p.xPct != null) ? ('calc(' + p.xPct + ' * 100vw)') : ((p.x || 0) + 'px');
    var ty = (p.yPct != null) ? ('calc(' + p.yPct + ' * 100vh)') : ((p.y || 0) + 'px');
    el.style.translate = has ? (tx + ' ' + ty) : '';
    el.style.scale     = (p.s && p.s !== 1) ? String(p.s) : '';
  });
  // Rotating phrases share ONE position (the `phrases` key), applied to ALL three
  // .hp-phrase blocks so they never drift apart.
  (function(){
    var p = map.phrases || {};
    var has = (p.xPct != null || p.yPct != null || p.x || p.y);
    var tx = (p.xPct != null) ? ('calc(' + p.xPct + ' * 100vw)') : ((p.x || 0) + 'px');
    var ty = (p.yPct != null) ? ('calc(' + p.yPct + ' * 100vh)') : ((p.y || 0) + 'px');
    var els = document.querySelectorAll('.hp-phrase');
    for (var i = 0; i < els.length; i++){
      els[i].style.translate = has ? (tx + ' ' + ty) : '';
      els[i].style.scale     = (p.s && p.s !== 1) ? String(p.s) : '';
    }
  })();
  // Brand copies: each positioned by its own key (brand / brand2 / …) but they ALL
  // SHARE one size (map.brand.s), so the size slider moves them together.
  var brandScale = (map.brand && map.brand.s && map.brand.s !== 1) ? String(map.brand.s) : '';
  Array.prototype.forEach.call(document.querySelectorAll('.hco-brand'), function(el){
    var bp = map[el.getAttribute('data-bk') || 'brand'] || {};
    var bHas = (bp.xPct != null || bp.yPct != null || bp.x || bp.y);
    var btx = (bp.xPct != null) ? ('calc(' + bp.xPct + ' * 100vw)') : ((bp.x || 0) + 'px');
    var bty = (bp.yPct != null) ? ('calc(' + bp.yPct + ' * 100vh)') : ((bp.y || 0) + 'px');
    el.style.translate = bHas ? (btx + ' ' + bty) : '';
    el.style.scale = brandScale;
  });
  // Re-wire drag so freshly-created copies become grabbable in editor mode.
  if (window.__opzWireHeroDrag) window.__opzWireHeroDrag();
}
// Phrase alignment (left/center/right) + line-wrap. cfg.heroPhrase = {align, wrap}.
// Shared by all three rotating phrases. align changes the anchor edge so center/
// right actually shift the block; wrap toggles auto-wrapping of long lines.
function applyHeroPhrase(s){
  s = s || {};
  var align = s.align;
  var ws = s.wrap ? 'pre-line' : 'pre';
  var els = document.querySelectorAll('.hp-phrase');
  for (var i = 0; i < els.length; i++){
    var el = els[i];
    el.style.whiteSpace = ws;
    if (align === 'center'){
      el.style.left = '0'; el.style.right = '0'; el.style.width = 'auto';
      el.style.maxWidth = 'none';
      el.style.paddingLeft = 'clamp(16px,5vw,40px)'; el.style.paddingRight = 'clamp(16px,5vw,40px)';
      el.style.textAlign = 'center';
    } else if (align === 'right'){
      el.style.left = 'auto'; el.style.right = 'clamp(20px,6vw,60px)'; el.style.width = 'auto';
      el.style.maxWidth = ''; el.style.paddingLeft = ''; el.style.paddingRight = '';
      el.style.textAlign = 'right';
    } else { // left / default — clear inline overrides, fall back to CSS base anchor
      el.style.left = ''; el.style.right = ''; el.style.width = '';
      el.style.maxWidth = ''; el.style.paddingLeft = ''; el.style.paddingRight = '';
      el.style.textAlign = (align === 'left') ? 'left' : '';
    }
  }
}

// Brand wordmark colour: 'auto' (or empty) = CSS default (white + mix-blend-mode
// difference → auto black/white against the background); any CSS colour string
// (e.g. '#e11d48') = that solid colour.
// Pick the per-device hero position map by viewport and apply it.
function applyHeroPosResponsive(cfg){
  cfg = cfg || window.__opzHeroCfg || {};
  // THREE layouts by viewport width: phone / tablet / computer.
  // ALL computers (laptop + desktop) now SHARE one config — cfg.heroPos, the
  // "標準顯示螢幕" set. Combined with the hero's uniform scaling (see updateHeroDims
  // in musician-platform.html) this means a SINGLE design scales proportionally to
  // every computer width: nothing clips, nothing jumps, you only tune it once.
  // Phone & iPad keep their own layouts (genuinely different shapes).
  // NOTE: legacy cfg.heroPosMacbook is intentionally no longer read — editing the
  // "標準顯示螢幕" tab is now the single source of truth for all computers.
  var w = window.innerWidth || 9999;
  var map = (w <= 700  && cfg.heroPosPhone)   ? cfg.heroPosPhone
          : (w <= 1024 && cfg.heroPosIpad)    ? cfg.heroPosIpad
          : (cfg.heroPos || {});
  applyHeroPos(map);
  // Phrase align/wrap + line-height are ALSO per-device. Prefer the picked map's
  // _phrase/_type, fall back to the desktop set, then the legacy global config.
  var _ph = (map && map._phrase) || (cfg.heroPos && cfg.heroPos._phrase) || cfg.heroPhrase || {};
  var _ty = (map && map._type)   || (cfg.heroPos && cfg.heroPos._type)   || cfg.heroType   || {};
  try { applyHeroPhrase(_ph); } catch(e){}
  try { applyHeroType(_ty); } catch(e){}
  // Button width (per device). Empty → fall back to the CSS default min-width.
  var _bw = (map && map._btnW) || (cfg.heroPos && cfg.heroPos._btnW) || null;
  var _btns = document.querySelectorAll('.hco-btn-pri, .hco-btn-out');
  for (var _bi = 0; _bi < _btns.length; _bi++){
    _btns[_bi].style.minWidth = _bw ? ('calc(var(--k) * ' + _bw + 'px)') : '';
  }
  // Brand wordmark colour + button styling (colours / shape / glass) are ALSO
  // per-device now. Resolve from the picked map; if this device hasn't set its
  // own, fall back to the desktop map, then to the legacy global cfg keys. This
  // keeps existing designs identical while letting phone/iPad diverge on demand.
  var _desk = cfg.heroPos || {};
  function _pick(prop, legacy){
    if (map && map[prop] != null) return map[prop];
    if (_desk[prop] != null) return _desk[prop];
    return legacy;
  }
  var _brand = _pick('_brandColor', cfg.heroBrandColor);
  if (_brand != null) { try { applyBrandColor(_brand); } catch(e){} }
  var _btnStyle = _pick('_btn', cfg.heroBtn);
  if (_btnStyle != null) { try { applyHeroBtns(_btnStyle); } catch(e){} }
  var _btnShape = _pick('_btnShape', cfg.heroBtnShape);
  if (_btnShape != null) { try { applyHeroBtnShape(_btnShape); } catch(e){} }
  // Glass last (it overrides the colour controls when on).
  var _glass = _pick('_btnGlass', cfg.heroBtnGlass);
  try { applyHeroBtnGlass(!!_glass); } catch(e){}
}
// Re-apply when crossing the phone breakpoint (debounced).
(function(){
  var t;
  window.addEventListener('resize', function(){
    if (!window.__opzHeroCfg) return;
    clearTimeout(t); t = setTimeout(function(){ try { applyHeroPosResponsive(window.__opzHeroCfg); } catch(e){} }, 150);
  });
})();

// Headline / subtitle line-height (行距). cfg.heroType = { headline:{lh}, sub:{lh} }.
// Empty / missing → leave the CSS default in place.
function applyHeroType(map){
  map = map || {};
  var SEL = { headline:'.hco-headline', sub:'.hco-sub' };
  Object.keys(SEL).forEach(function(k){
    var el = document.querySelector(SEL[k]); if(!el) return;
    var t = map[k] || {};
    el.style.lineHeight = (t.lh != null && t.lh !== '') ? String(t.lh) : '';
  });
}

function applyBrandColor(val){
  Array.prototype.forEach.call(document.querySelectorAll('.hco-brand'), function(el){
    if (!val || val === 'auto') { el.style.color = ''; el.style.mixBlendMode = ''; }
    else { el.style.color = val; el.style.mixBlendMode = 'normal'; }
  });
}

// Hero button styling: per-button background colour, text colour, and BACKGROUND
// opacity. Opacity only fades the background fill (via rgba) — the text stays
// fully opaque and the border stays solid/visible. cfg.heroBtn =
// { find:{bg,fg,op}, project:{bg,fg,op} }. Empty values fall back to CSS.
function _hexToRgba(hex, a){
  hex = String(hex || '').trim().replace('#','');
  if (hex.length === 3) hex = hex.split('').map(function(c){return c+c;}).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  var n = parseInt(hex, 16);
  return 'rgba(' + ((n>>16)&255) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')';
}
// Button SHAPE (shared by both buttons): corner radius + border width. Sizes use
// calc(var(--k)*Npx) to match the hero's scale system (so they stay crisp).
function applyHeroBtnShape(s){
  s = s || {};
  ['.hco-btn-pri','.hco-btn-out'].forEach(function(sel){
    var el = document.querySelector(sel); if(!el) return;
    if (s.radius === 'pill') el.style.borderRadius = '999px';
    else if (s.radius != null && s.radius !== '') el.style.borderRadius = 'calc(var(--k) * ' + Number(s.radius) + 'px)';
    else el.style.borderRadius = '';
    el.style.borderWidth = (s.bw != null && s.bw !== '') ? ('calc(var(--k) * ' + Number(s.bw) + 'px)') : '';
    el.style.borderStyle = (s.bw != null && s.bw !== '') ? 'solid' : '';
  });
}
// Liquid-glass look on both hero buttons (toggles the .lg-glass class).
function applyHeroBtnGlass(on){
  ['.hco-btn-pri','.hco-btn-out'].forEach(function(sel){
    var el = document.querySelector(sel); if(!el) return;
    el.classList.toggle('lg-glass', !!on);
  });
}
function applyHeroBtns(map){
  map = map || {};
  var SEL = { find:'.hco-btn-pri', project:'.hco-btn-out' };
  var DEF = { find:'#0a0a0a', project:'#ffffff' };   // each button's default bg colour
  Object.keys(SEL).forEach(function(k){
    var el = document.querySelector(SEL[k]); if(!el) return;
    var b = map[k] || {};
    var op = (b.op != null && b.op !== '') ? Number(b.op) : 1;
    el.style.background = '';            // clear any stale shorthand
    el.style.opacity = '';              // never fade the whole button (text/border)
    el.style.color = b.fg || '';        // text stays fully opaque
    el.style.borderColor = b.bd || '';  // independent border colour ('' = CSS default), always solid
    // Background fill: apply chosen colour + opacity (rgba). Opacity also fades the
    // DEFAULT colour when no custom colour is picked.
    if (op < 1) {
      var rgba = _hexToRgba(b.bg || DEF[k], op);
      el.style.backgroundColor = rgba || (b.bg || '');
    } else {
      el.style.backgroundColor = b.bg || '';
    }
  });
}

// Per-element Hero fonts (Canva-style font editor). cfg.heroFonts[key] =
// { fontEn, fontZh, weight, color }. We build a font-family fallback CHAIN
// ('English font', 'Chinese font', sans-serif) so Latin glyphs use the English
// face and CJK glyphs automatically fall through to the Chinese face — no
// language detection needed. brand colour stays owned by applyBrandColor.
function applyHeroFonts(map){
  if(!map || typeof map !== 'object') return;
  Object.keys(HERO_DRAG).forEach(function(k){
    var f = map[k]; if(!f || typeof f !== 'object') return;
    var els = document.querySelectorAll(HERO_DRAG[k]);   // brand may be several copies
    var fam = [];
    if(f.fontEn) fam.push("'" + f.fontEn + "'");
    if(f.fontZh) fam.push("'" + f.fontZh + "'");
    var famStr = fam.length ? (fam.join(',') + ',sans-serif') : '';
    for(var i=0;i<els.length;i++){
      var el = els[i];
      if(famStr) el.style.fontFamily = famStr;
      if(f.weight) el.style.fontWeight = f.weight;
      if(f.color && k !== 'brand') el.style.color = f.color;   // brand colour via applyBrandColor
    }
  });
}

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

  // 0) Musicians page: hero (title/sub/video/photo/position) + filter labels are
  // applied by a page-provided hook (the page owns its dynamic hero rendering).
  if ((cfg.musHero || cfg.musFilters) && typeof window.opzMusApply === 'function') {
    try { window.opzMusApply(cfg); } catch(e){}
  }
  // 0b) Lessons page: hero background video/photo + position, same pattern as
  // Musicians — the page exposes window.opzLesApply to apply its own hero media.
  if (cfg.lesHero && typeof window.opzLesApply === 'function') {
    try { window.opzLesApply(cfg); } catch(e){}
  }

  // 1) i18n dictionary overrides → re-render in the current language
  if (cfg.i18n && window.I18N) {
    ['en','zh'].forEach(function(l){
      if (cfg.i18n[l]) { window.I18N[l] = window.I18N[l] || {}; Object.assign(window.I18N[l], cfg.i18n[l]); }
    });
    if (typeof window.switchLang === 'function') {
      try { window.switchLang(window._currentLang || 'en'); } catch(e){}
    }
  }

  // 1b) partner marquee — a plain list of names rendered by the page
  if (Array.isArray(cfg.partners) && typeof window.opzRenderPartners === 'function') {
    try { window.opzRenderPartners(cfg.partners); } catch(e){}
  }

  // 1c) hero element drag-offsets (Canva-style positioning), PER DEVICE: phones
  // (<=700px) use cfg.heroPosPhone when present; otherwise fall back to the desktop
  // set cfg.heroPos. Re-applied on resize so it switches at the breakpoint.
  // applyHeroPosResponsive now also applies the per-device brand colour + button
  // styling (colour / shape / glass), so trigger it whenever ANY hero style key
  // is present — not just the position/phrase/type keys.
  if ('heroPos' in cfg || 'heroPosPhone' in cfg || 'heroPosMacbook' in cfg || 'heroPosIpad' in cfg || 'heroPhrase' in cfg || 'heroType' in cfg || 'heroBrandColor' in cfg || 'heroBtn' in cfg || 'heroBtnShape' in cfg || 'heroBtnGlass' in cfg) {
    window.__opzHeroCfg = cfg;
    // applyHeroPosResponsive also applies the per-device phrase align + line-height,
    // brand wordmark colour, and button colour/shape/glass (with desktop fallback).
    try { applyHeroPosResponsive(cfg); } catch(e){}
  }

  // 1c-2) per-element Hero fonts (font-family / weight / colour). Runs AFTER the
  // pos/colour block so the chosen font wins; font-family isn't touched by
  // applyHeroPos, so a later resize re-apply won't clear it.
  if ('heroFonts' in cfg) { try { applyHeroFonts(cfg.heroFonts); } catch(e){} }

  // 1h) shows-page posters — count + per-poster frame (x/y/scale/blur/bgX/bgY) +
  //     image URLs. Drives the shows engine so add/remove/position done in the
  //     admin shows up on the LIVE site (no server.py needed). Waits for the
  //     engine to finish its own boot before applying.
  if (Array.isArray(cfg.posters)) {
    (function applyPosters(n){
      if (window.opzShows && window.__opzShowsReady && typeof window.opzShows.applyConfig === 'function') {
        try { window.opzShows.applyConfig(cfg.posters); } catch(e){}
      } else if ((n || 0) < 50) { setTimeout(function(){ applyPosters((n || 0) + 1); }, 150); }
    })(0);
  }

  // homepage "Work" posters — image URLs + captions + count, driven from Firebase
  // so they're editable on the LIVE site (no server.py needed).
  if (Array.isArray(cfg.homePosters)) {
    (function applyHomePosters(n){
      if (window.opzEdit && typeof window.opzEdit.applyPosterConfig === 'function') {
        try { window.opzEdit.applyPosterConfig(cfg.homePosters); } catch(e){}
      } else if ((n || 0) < 50) { setTimeout(function(){ applyHomePosters((n || 0) + 1); }, 150); }
    })(0);
  }

  // homepage background photos (Hero 照片牆 / 分類 / 服務) — image URLs + framing,
  // driven from Firebase so they're editable on the LIVE site (no server.py needed).
  // Additive + fail-safe: if absent or the engine isn't ready yet, the existing
  // file-based photos (site-data.json) stay in place. Each entry: {group,cls,url,x,y,zoom}.
  if (Array.isArray(cfg.homePhotos) && cfg.homePhotos.length) {
    (function applyHomePhotos(n){
      if (window.opzEdit && typeof window.opzEdit.setImageUrl === 'function') {
        cfg.homePhotos.forEach(function(p){
          if (!p || !p.cls || !p.url) return;
          try { window.opzEdit.setImageUrl(p.group, p.cls, p.url); } catch(e){}
          if (p.x != null || p.y != null || p.zoom != null) {
            try { window.opzEdit.setFrame(p.group, p.cls, { x:p.x, y:p.y, zoom:p.zoom }); } catch(e){}
          }
        });
      } else if ((n || 0) < 50) { setTimeout(function(){ applyHomePhotos((n || 0) + 1); }, 150); }
    })(0);
  }

  // 2) direct data-cms overrides (non-i18n text / images / links)
  if (cfg.cms) {
    var cms = cfg.cms;
    Object.keys(cms).forEach(function(key){
      // Companion keys (key + '.pos' / '.zoom') are framing data, applied alongside
      // their base media key below — skip them as standalone keys.
      if (/\.(pos|zoom)$/.test(key)) return;
      var v = cms[key];
      if (v == null) return;
      var pos  = cms[key + '.pos'];    // focal point, e.g. "50% 30%"
      var zoom = cms[key + '.zoom'];   // scale multiplier, e.g. 1.4
      document.querySelectorAll('[data-cms="' + key + '"]').forEach(function(el){
        var attr = el.getAttribute('data-cms-attr');
        if (attr === 'src') {
          if (el.getAttribute('src') !== v) {
            el.src = v;
            // <video> needs an explicit reload to pick up a new src and resume playback
            if (el.tagName === 'VIDEO') {
              try { if (window._svPlayMuted) { window._svPlayMuted(el); } else { el.muted = true; el.setAttribute('playsinline',''); el.setAttribute('webkit-playsinline',''); el.load(); var p = el.play(); if (p && p.catch) p.catch(function(){}); } } catch(e){}
            }
          }
          applyFraming(el, 'media', pos, zoom);
        }
        else if (attr === 'href') el.setAttribute('href', v);
        else if (attr === 'html') el.innerHTML = v;
        else if (attr === 'bg')   { el.style.backgroundImage = "url('" + v + "')"; applyFraming(el, 'bg', pos, zoom); }
        else                      el.textContent = v;
      });
    });
  }

  // 3) generic per-section overrides — lets the editor make ANY image / video /
  // link on a page editable WITHOUT hand-tagging each element. Each entry targets
  // the Nth <img>/<video>/<a> inside a [data-cms-section]. Keyed by DOM order.
  if (Array.isArray(cfg.auto)) {
    cfg.auto.forEach(function(o){
      if (!o || !o.sec) return;
      var secEl = document.querySelector('[data-cms-section="' + o.sec + '"]');
      if (!secEl) return;
      var tag = o.kind === 'href' ? 'a' : (o.kind === 'video' ? 'video' : (o.kind === 'img' ? 'img' : null));
      if (!tag) return;
      var el = secEl.querySelectorAll(tag)[o.idx | 0];
      if (!el) return;
      if (o.kind === 'href') { if (o.v != null) el.setAttribute('href', o.v); return; }
      // img / video src
      if (o.v != null && el.getAttribute('src') !== o.v) {
        el.src = o.v;
        if (el.tagName === 'VIDEO') { try { if (window._svPlayMuted) { window._svPlayMuted(el); } else { el.muted = true; el.setAttribute('playsinline',''); el.setAttribute('webkit-playsinline',''); el.load(); var p = el.play(); if (p && p.catch) p.catch(function(){}); } } catch(e){} }
      }
      applyFraming(el, 'media', o.pos, o.zoom);
    });
  }
}

// Apply owner-chosen framing (focal point + zoom) to a media element.
// Only touches CSS when framing actually exists, so untouched images stay as-is.
function applyFraming(el, mode, pos, zoom){
  if (pos == null && zoom == null) return;
  var p = pos || '50% 50%';
  var z = parseFloat(zoom); if (!(z > 0)) z = 1;
  if (mode === 'bg') {
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = p;
    el.style.backgroundSize = z > 1 ? (z * 100) + '%' : 'cover';
  } else {
    // <img>/<video>: cover the box, shift focal point, zoom via scale (parent clips)
    if (!el.style.objectFit) el.style.objectFit = 'cover';
    el.style.objectPosition = p;
    el.style.transformOrigin = p;
    el.style.transform = z !== 1 ? ('scale(' + z + ')') : '';
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

  // Preview should behave EXACTLY like the live site: navigation, login, every
  // control works. We no longer block link clicks. Internal page links keep
  // ?cmsedit=1 so the page you navigate to also stays in editor mode. Clicking an
  // EMPTY area of a section (not a link/button) still selects it in the editor.
  document.addEventListener('click', function(e){
    var t = e.target;
    var interactive = t && t.closest
      ? t.closest('a,button,input,select,textarea,label,[role="button"],[onclick]')
      : null;
    if (interactive){
      var a = (interactive.tagName === 'A') ? interactive
            : (interactive.closest ? interactive.closest('a') : null);
      if (a){
        var href = a.getAttribute('href') || '';
        var internal = href && href.charAt(0) !== '#' &&
          (a.hostname === location.hostname || !/^[a-z][a-z0-9+.\-]*:/i.test(href));
        if (internal){
          try { var u = new URL(a.href, location.href); u.searchParams.set('cmsedit','1'); a.href = u.href; } catch(_){}
        }
      }
      return;   // let it work exactly like the front-end — no blocking, no select
    }
    var sec = t && t.closest ? t.closest('[data-cms-section]') : null;
    if (sec){ try { parent.postMessage({ __opuszCmsSelect:true, key: sec.getAttribute('data-cms-section') }, '*'); } catch(_){} }
  }, true);

  // ── Canva-style drag for hero elements (editor preview only) ───────────────
  // Drag headline / subtitle / buttons / OPUS.Z to any position. We change the
  // independent `translate` property (not `transform`), so animations are intact.
  // Drag delta is divided by the card's current scale so 1 screen-px = 1 card-px,
  // and the offset is reported to the parent editor to be saved.
  function cardScale(){
    var c = document.getElementById('heroCard'); if(!c) return 1;
    var t = getComputedStyle(c).transform;
    var m = t && t.match(/matrix\(([^)]+)\)/);
    return m ? (parseFloat(m[1].split(',')[0]) || 1) : 1;
  }
  function curOffset(el){
    var tr = el.style.translate; if(!tr) return {x:0,y:0};
    var p = tr.split(/\s+/); return {x:parseFloat(p[0])||0, y:parseFloat(p[1])||0};
  }
  function wireDragOn(el, key){
    if(!el || el.__opzDrag) return;
    el.__opzDrag = true;
    el.style.cursor = 'move';
    el.style.pointerEvents = 'auto';   // brand is aria-hidden; ensure it's grabbable
    el.title = '拖曳調整位置';
    var on=false, sx=0, sy=0, ox=0, oy=0, moved=false;
    el.addEventListener('pointerdown', function(e){
      on=true; moved=false; var o=curOffset(el); ox=o.x; oy=o.y; sx=e.clientX; sy=e.clientY;
      try{ el.setPointerCapture(e.pointerId); }catch(_){}
      el.style.outline='2px solid #2563eb'; el.style.outlineOffset='2px';
      e.preventDefault(); e.stopPropagation();
    });
    el.addEventListener('pointermove', function(e){
      if(!on) return;
      var s = cardScale() || 1;
      var nx = ox + (e.clientX - sx)/s, ny = oy + (e.clientY - sy)/s;
      el.style.translate = Math.round(nx)+'px '+Math.round(ny)+'px';
      if(Math.abs(e.clientX-sx)>2 || Math.abs(e.clientY-sy)>2) moved=true;
      e.preventDefault(); e.stopPropagation();
    });
    function end(){
      if(!on) return; on=false; el.style.outline='';
      var o = curOffset(el);
      var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
      // report BOTH px (legacy) and viewport-fraction (width-independent, preferred)
      try{ parent.postMessage({__opuszHeroPos:true, key:key,
        x:Math.round(o.x), y:Math.round(o.y),
        xPct:+(o.x/vw).toFixed(5), yPct:+(o.y/vh).toFixed(5) }, '*'); }catch(_){}
      // A click without drag = SELECT this element → editor opens its font panel.
      // brand copies all share one font, so normalise brand2/3… → 'brand'.
      if(!moved){
        var pk = (key.indexOf('brand') === 0) ? 'brand' : key;
        try{ parent.postMessage({__opuszPick:true, key:pk}, '*'); }catch(_){}
      }
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // swallow the click that follows a real drag (so buttons/links don't fire)
    el.addEventListener('click', function(e){ if(moved){ e.preventDefault(); e.stopPropagation(); } }, true);
  }
  // Exposed so applyHeroPos can re-wire newly-created brand copies.
  window.__opzWireHeroDrag = function(){ try{ wireHeroDrag(); }catch(e){} };
  function wireHeroDrag(){
    Object.keys(HERO_DRAG).forEach(function(key){
      if(key==='brand') return;   // brand copies handled below (each its own key)
      wireDragOn(document.querySelector(HERO_DRAG[key]), key);
    });
    // Brand copies: every .hco-brand is draggable and reports its own data-bk key.
    Array.prototype.forEach.call(document.querySelectorAll('.hco-brand'), function(el){
      wireDragOn(el, el.getAttribute('data-bk') || 'brand');
    });

    // Phrases: grab ANY one phrase and all three move together (shared position),
    // saved under the single key 'phrases'.
    var phraseEls = document.querySelectorAll('.hp-phrase');
    Array.prototype.forEach.call(phraseEls, function(el){
      if(el.__opzDrag) return; el.__opzDrag = true;
      el.style.cursor = 'move';
      el.style.pointerEvents = 'auto';   // overlay is pointer-events:none; make the phrase grabbable
      el.title = '拖曳調整位置（三句一起移動）';
      var on=false, sx=0, sy=0, ox=0, oy=0, moved=false;
      el.addEventListener('pointerdown', function(e){
        on=true; moved=false; var o=curOffset(el); ox=o.x; oy=o.y; sx=e.clientX; sy=e.clientY;
        try{ el.setPointerCapture(e.pointerId); }catch(_){}
        Array.prototype.forEach.call(phraseEls, function(p){ p.style.outline='2px solid #2563eb'; p.style.outlineOffset='2px'; });
        e.preventDefault(); e.stopPropagation();
      });
      el.addEventListener('pointermove', function(e){
        if(!on) return;
        var s = cardScale() || 1;
        var nx = ox + (e.clientX - sx)/s, ny = oy + (e.clientY - sy)/s;
        var tv = Math.round(nx)+'px '+Math.round(ny)+'px';
        Array.prototype.forEach.call(phraseEls, function(p){ p.style.translate = tv; });
        if(Math.abs(e.clientX-sx)>2 || Math.abs(e.clientY-sy)>2) moved=true;
        e.preventDefault(); e.stopPropagation();
      });
      function endP(){
        if(!on) return; on=false;
        Array.prototype.forEach.call(phraseEls, function(p){ p.style.outline=''; });
        var o = curOffset(el);
        var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
        try{ parent.postMessage({__opuszHeroPos:true, key:'phrases',
          x:Math.round(o.x), y:Math.round(o.y),
          xPct:+(o.x/vw).toFixed(5), yPct:+(o.y/vh).toFixed(5) }, '*'); }catch(_){}
      }
      el.addEventListener('pointerup', endP);
      el.addEventListener('pointercancel', endP);
      el.addEventListener('click', function(e){ if(moved){ e.preventDefault(); e.stopPropagation(); } }, true);
    });
  }
  // Elements exist in static HTML; wire now and retry a couple times in case of late layout.
  // The phrases keep their EXACT live animation/timing — no forced reveal. They're
  // grabbable only when they naturally appear (the owner scrolls to that point and
  // drags, or uses the X/Y sliders). Nothing pins or flashes them.
  wireHeroDrag(); setTimeout(wireHeroDrag, 600); setTimeout(wireHeroDrag, 1500);
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
