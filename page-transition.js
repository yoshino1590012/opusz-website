/* ═══════════════════════════════════════════════════════════════════
   OPUS.Z 全站跳頁轉場  page-transition v1  (2026-08-19)
   行為（照京典官網那套、原型是 x8.adencys.com）：
     點站內連結 → 黑幕從下往上「蓋滿」→ 才真的跳頁
     新頁載入 → 黑幕已蓋滿 → 往上「掀開」露出新頁
   不觸發：錨點(#)、外部連結、新分頁、下載、mailto/tel、Cmd/Ctrl 點擊、
          iframe 內（後台的即時預覽會嵌入公開頁，不能被黑幕蓋到）、
          以及系統設定「減少動態效果」時。
   要讓某個連結不吃轉場：加 data-no-pf 屬性。
   程式裡想跳頁又要有轉場：window.opzGoWithTransition('xxx.html')
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.top !== window.self) return;              // iframe 內不做（後台預覽）
  if (window.__opzPF) return; window.__opzPF = true;

  var DUR = 740;                                        // 蓋滿/掀開各花多久(ms)，跟 CSS 對齊
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var css = '.opz-pagefade{position:fixed;inset:0;z-index:2147483000;background:#000;'
          + 'transform:translateY(100%);pointer-events:none;will-change:transform}'
          + '.opz-pagefade.pf-anim{transition:transform .74s cubic-bezier(.76,0,.24,1)}'
          + '.opz-pagefade.pf-cover{transform:translateY(0)}'        /* 蓋滿 */
          + '.opz-pagefade.pf-up{transform:translateY(-100%)}';      /* 往上掀開 */
  var st = document.createElement('style'); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  var fade;
  function mount() {
    if (fade) return;
    fade = document.createElement('div');
    fade.className = 'opz-pagefade';
    fade.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fade);
  }

  /* 防呆：只要有祖先元素帶 transform/filter/will-change，position:fixed 就會改以那個元素為基準
     （首頁曾經對 <html> 加 transform，黑幕就變成整份文件那麼高、位置也跑掉）。
     這裡量一次，發現沒有貼齊視窗就改用 absolute + 目前捲動位置，尺寸直接寫死成視窗大小。
     轉場期間畫面不會捲動，所以這樣一定準。 */
  function sync() {
    if (!fade) return;
    fade.style.position = ''; fade.style.left = ''; fade.style.top = '';
    fade.style.width = ''; fade.style.height = '';
    var r = fade.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    if (Math.abs(r.width - vw) > 1 || Math.abs(r.height - vh) > 1 || Math.abs(r.left) > 1) {
      fade.style.position = 'absolute';
      fade.style.left = (window.pageXOffset || 0) + 'px';
      fade.style.top = (window.pageYOffset || 0) + 'px';
      fade.style.width = vw + 'px';
      fade.style.height = vh + 'px';
    }
  }

  /* ── 進場：從轉場連結過來的話，黑幕先蓋滿，再掀開 ── */
  function enter() {
    mount();
    if (sessionStorage.getItem('opz_pf') !== '1') return;
    sessionStorage.removeItem('opz_pf');
    if (reduce) return;
    sync();
    fade.classList.add('pf-cover');                      // 先蓋滿（不帶動畫）
    var done = false;
    setTimeout(function () {                             // 用 timeout 不用 rAF：分頁沒在前景時 rAF 會凍住 → 黑幕卡住
      if (done) return; done = true;
      fade.classList.add('pf-anim');
      void fade.offsetWidth;                             // 強制重排，確保從「蓋滿」起跑
      fade.classList.remove('pf-cover');
      fade.classList.add('pf-up');
      setTimeout(function () { fade.className = 'opz-pagefade'; sync(); }, DUR + 160);
    }, 60);
  }

  /* ── 離場：蓋滿後才跳頁 ── */
  var navigating = false;
  function go(url) {
    if (navigating) return; navigating = true;
    if (reduce) { location.href = url; return; }
    mount();
    sync();
    fade.classList.add('pf-anim');
    void fade.offsetWidth;
    fade.classList.add('pf-cover');
    sessionStorage.setItem('opz_pf', '1');
    var went = false, jump = function () { if (went) return; went = true; location.href = url; };
    fade.addEventListener('transitionend', jump, { once: true });
    setTimeout(jump, DUR + 120);                         // 保險：transitionend 沒來也一定跳
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
    if (url.origin !== location.origin) return;                       // 只處理站內
    if (url.pathname === location.pathname && url.search === location.search) return;   // 同一頁（含純錨點）
    e.preventDefault();
    go(a.href);
  }, true);

  /* 上一頁回來（bfcache）時清掉殘留黑幕 */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      navigating = false;
      sessionStorage.removeItem('opz_pf');
      if (fade) fade.className = 'opz-pagefade';
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enter);
  else enter();
})();
