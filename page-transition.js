/* ═══════════════════════════════════════════════════════════════════
   OPUS.Z 全站跳頁轉場  page-transition v2  (2026-08-19)

   參數來源：實測 x8.adencys.com（Martin 指定的範本）。
   量到的事實：那個站是 SPA（不換頁），所以它的黑幕
     ① 蓋上＝瞬間（沒有動畫）② 全黑停留約 1.0s ③ 掀開約 1.1s、指數型 ease-out。
   我們是多頁式（會真的換頁），照抄「瞬間蓋上」會很突兀，所以：
     蓋上 = ease-IN（慢慢起步→加速，收在最高速）→ 速度最快的瞬間換頁
     掀開 = ease-OUT（延續那個速度→長長地減速）＝ 範本那條曲線
     兩段接起來就是「一道連續的黑幕掃過去」，不是兩段。

   零閃爍的關鍵：這支要放在 <head>，新頁「第一次繪製」就已經是黑的。
   放到 </body> 前會先畫出頁面才蓋黑幕 → 就是會閃一下的原因。
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.top !== window.self) return;              // iframe 內不做（後台預覽會嵌公開頁）
  if (window.__opzPF) return; window.__opzPF = true;

  var COVER = 420;    // 蓋上去(ms)
  var REVEAL = 780;   // 掀開(ms)
  var HOLD_MAX = 700; // 新頁最多等多久才開始掀（等它畫好，但不無限等）
  var EASE_IN = 'cubic-bezier(.5,0,.9,.35)';    // 慢起步→加速，結尾不減速
  var EASE_OUT = 'cubic-bezier(.16,1,.3,1)';    // 延續高速→長長地減速（仿範本的指數衰減）

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var st = document.createElement('style');
  st.textContent =
    '.opz-pagefade{position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483000;'
    + 'background:#000;transform:translateY(100%);pointer-events:none;will-change:transform;'
    + 'backface-visibility:hidden}'
    + '.opz-pagefade.pf-cover{transform:translateY(0)}'
    + '.opz-pagefade.pf-up{transform:translateY(-100%)}'
    + '.opz-pagefade.pf-in{transition:transform ' + COVER + 'ms ' + EASE_IN + '}'
    + '.opz-pagefade.pf-out{transition:transform ' + REVEAL + 'ms ' + EASE_OUT + '}';
  (document.head || document.documentElement).appendChild(st);

  /* 掛在 <html> 底下，body 還沒解析出來就能存在＝新頁第一幀就蓋著，不會閃 */
  var fade = document.createElement('div');
  fade.className = 'opz-pagefade';
  fade.setAttribute('aria-hidden', 'true');
  var covered = !reduce && (function () { try { return sessionStorage.getItem('opz_pf') === '1'; } catch (e) { return false; } })();
  if (covered) fade.classList.add('pf-cover');          // 一出生就蓋滿（無動畫）
  document.documentElement.appendChild(fade);
  try { sessionStorage.removeItem('opz_pf'); } catch (e) {}

  /* 祖先有 transform/filter/will-change 時 position:fixed 會改以那個元素為基準
     （首頁曾經對 <html> 加 transform，黑幕就變成整份文件那麼高）。動畫前量一次，
     不對就改用 absolute + 目前捲動位置；轉場期間畫面不會捲，所以一定準。 */
  function sync() {
    fade.style.position = ''; fade.style.left = ''; fade.style.top = '';
    fade.style.width = ''; fade.style.height = '';
    var r = fade.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    if (Math.abs(r.width - vw) > 1 || Math.abs(r.height - vh) > 1 || Math.abs(r.left) > 1) {
      fade.style.position = 'absolute';
      fade.style.left = (window.pageXOffset || 0) + 'px';
      fade.style.top = (window.pageYOffset || 0) + 'px';
      fade.style.width = vw + 'px';
      fade.style.height = vh + 'px';
    }
  }

  /* ── 進場：黑幕已經蓋著 → 等頁面畫好（最多 HOLD_MAX）→ 往上掀開 ── */
  if (covered) {
    var revealed = false;
    var reveal = function () {
      if (revealed) return; revealed = true;
      sync();
      fade.classList.add('pf-out');
      void fade.offsetWidth;
      fade.classList.remove('pf-cover');
      fade.classList.add('pf-up');
      setTimeout(function () { fade.className = 'opz-pagefade'; }, REVEAL + 120);
    };
    var kick = function () { setTimeout(reveal, 40); };
    if (document.readyState === 'complete') kick();
    else window.addEventListener('load', kick, { once: true });
    setTimeout(reveal, HOLD_MAX);                        // 保險：頁面再慢也不會一直黑著
  }

  /* ── 離場：蓋滿的「同一瞬間」換頁，中間不留空檔 ── */
  var navigating = false;
  function go(url) {
    if (navigating) return; navigating = true;
    if (reduce) { location.href = url; return; }
    sync();
    fade.classList.remove('pf-up', 'pf-out');
    fade.classList.add('pf-in');
    void fade.offsetWidth;
    fade.classList.add('pf-cover');
    try { sessionStorage.setItem('opz_pf', '1'); } catch (e) {}
    var went = false, jump = function () { if (went) return; went = true; location.href = url; };
    fade.addEventListener('transitionend', jump, { once: true });
    setTimeout(jump, COVER + 80);                        // 保險：transitionend 沒來也一定跳
  }
  window.opzGoWithTransition = go;

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-no-pf')) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#') return;
    if (/^(mailto:|tel:|javascript:|blob:|data:)/i.test(href)) return;
    var url; try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;                                        // 只處理站內
    if (url.pathname === location.pathname && url.search === location.search) return;  // 同一頁
    e.preventDefault();
    go(a.href);
  }, true);

  /* 上一頁回來（bfcache）：清掉殘留黑幕 */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      navigating = false;
      try { sessionStorage.removeItem('opz_pf'); } catch (err) {}
      fade.className = 'opz-pagefade';
      fade.style.cssText = '';
    }
  });
})();
