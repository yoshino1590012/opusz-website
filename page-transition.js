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

   另外：每個分頁「第一次進站」會播 LOGO 進場（仿 pedestal.com）——黑幕上用
   stroke-dashoffset 把標誌一筆畫出來，畫完才掀開。站內點來點去不會重播（sessionStorage 記著）。
   路徑是從 opusz-logo-cropped.png 抽中心線重建的（線寬固定 75、IoU 0.96），
   同一份也存成 assets/images/LOGO/opusz-logo.svg。
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.top !== window.self) return;              // iframe 內不做（後台預覽會嵌公開頁）
  if (window.__opzPF) return; window.__opzPF = true;

  var COVER = 420;    // 蓋上去(ms)
  var REVEAL = 780;   // 掀開(ms)
  var HOLD_MAX = 700; // 新頁最多等多久才開始掀（等它畫好，但不無限等）
  var DRAW = 1000;    // LOGO 一筆畫出來要多久(ms)
  var DRAW_HOLD = 120;// 畫完停一下
  var LOGO_FADE = 220;// 標誌淡出
  var STEM_RATIO = 0.185;  // 短的那條線長度 ≈ 主線的 18.5% → 同速度所以時間也照比例
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
    + '.opz-pagefade.pf-out{transition:transform ' + REVEAL + 'ms ' + EASE_OUT + '}'
    + '.opz-pfmark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
    + 'width:min(28vmin,230px);height:auto;opacity:1;transition:opacity ' + LOGO_FADE + 'ms ease}'
    + '.opz-pfmark.gone{opacity:0}'
    + '.opz-pfmark path{stroke-dasharray:1;stroke-dashoffset:1}'
    + '.opz-pfmark.draw #opzPfA{transition:stroke-dashoffset ' + DRAW + 'ms cubic-bezier(.62,.02,.3,1);stroke-dashoffset:0}'
    + '.opz-pfmark.draw #opzPfB{transition:stroke-dashoffset ' + Math.round(DRAW * STEM_RATIO) + 'ms cubic-bezier(.62,.02,.3,1);stroke-dashoffset:0}';
  (document.head || document.documentElement).appendChild(st);

  /* 掛在 <html> 底下，body 還沒解析出來就能存在＝新頁第一幀就蓋著，不會閃 */
  var fade = document.createElement('div');
  fade.className = 'opz-pagefade';
  fade.setAttribute('aria-hidden', 'true');
  function ss(k, v) { try { return v === undefined ? sessionStorage.getItem(k) : sessionStorage.setItem(k, v); } catch (e) { return null; } }
  var covered = !reduce && ss('opz_pf') === '1';        // 站內點連結過來的
  var intro = !reduce && !covered && !ss('opz_seen');   // 這個分頁第一次進站 → 播 LOGO 進場
  ss('opz_seen', '1');
  if (covered || intro) fade.classList.add('pf-cover'); // 一出生就蓋滿（無動畫）
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

  /* 標誌：兩條路徑都是「從底部往上→捲進螺旋」，所以 stroke-dashoffset 由 1→0
     看起來就是被一筆畫出來。pathLength=1 讓 dash 數學不用管實際長度。 */
  var D_MAIN = 'M 990.0 1581.0 C 993.3 1578.0 1006.0 1577.2 1010.0 1563.0 C 1014.0 1548.8 1011.7 1516.5 1014.0 1496.0 C 1016.3 1475.5 1019.0 1460.3 1024.0 1440.0 C 1029.0 1419.7 1037.2 1392.7 1044.0 1374.0 C 1050.8 1355.3 1057.2 1343.2 1065.0 1328.0 C 1072.8 1312.8 1080.5 1299.2 1091.0 1283.0 C 1101.5 1266.8 1114.8 1247.8 1128.0 1231.0 C 1141.2 1214.2 1156.7 1196.7 1170.0 1182.0 C 1183.3 1167.3 1194.3 1158.5 1208.0 1143.0 C 1221.7 1127.5 1237.2 1110.2 1252.0 1089.0 C 1266.8 1067.8 1286.0 1036.0 1297.0 1016.0 C 1308.0 996.0 1311.7 986.0 1318.0 969.0 C 1324.3 952.0 1331.2 927.8 1335.0 914.0 C 1338.8 900.2 1339.0 899.0 1341.0 886.0 C 1343.0 873.0 1346.0 856.5 1347.0 836.0 C 1348.0 815.5 1348.7 786.2 1347.0 763.0 C 1345.3 739.8 1341.7 717.0 1337.0 697.0 C 1332.3 677.0 1325.2 658.3 1319.0 643.0 C 1312.8 627.7 1307.0 617.0 1300.0 605.0 C 1293.0 593.0 1286.3 582.7 1277.0 571.0 C 1267.7 559.3 1256.0 546.3 1244.0 535.0 C 1232.0 523.7 1217.2 511.8 1205.0 503.0 C 1192.8 494.2 1183.7 488.7 1171.0 482.0 C 1158.3 475.3 1146.0 469.0 1129.0 463.0 C 1112.0 457.0 1088.7 450.0 1069.0 446.0 C 1049.3 442.0 1029.2 440.0 1011.0 439.0 C 992.8 438.0 975.8 438.8 960.0 440.0 C 944.2 441.2 932.5 442.3 916.0 446.0 C 899.5 449.7 877.5 455.8 861.0 462.0 C 844.5 468.2 830.8 475.0 817.0 483.0 C 803.2 491.0 790.2 500.0 778.0 510.0 C 765.8 520.0 753.3 532.8 744.0 543.0 C 734.7 553.2 729.8 559.0 722.0 571.0 C 714.2 583.0 704.2 599.2 697.0 615.0 C 689.8 630.8 683.0 652.3 679.0 666.0 C 675.0 679.7 674.7 684.5 673.0 697.0 C 671.3 709.5 669.0 725.5 669.0 741.0 C 669.0 756.5 670.5 774.2 673.0 790.0 C 675.5 805.8 678.7 820.7 684.0 836.0 C 689.3 851.3 697.2 868.5 705.0 882.0 C 712.8 895.5 720.5 905.7 731.0 917.0 C 741.5 928.3 757.7 941.8 768.0 950.0 C 778.3 958.2 782.8 960.7 793.0 966.0 C 803.2 971.3 817.8 977.8 829.0 982.0 C 840.2 986.2 848.3 988.5 860.0 991.0 C 871.7 993.5 887.8 995.7 899.0 997.0 C 910.2 998.3 911.5 999.0 927.0 999.0 C 942.5 999.0 979.7 996.0 992.0 997.0 C 1004.3 998.0 990.7 1008.7 1001.0 1005.0 C 1011.3 1001.3 1039.0 985.3 1054.0 975.0 C 1069.0 964.7 1080.7 953.5 1091.0 943.0 C 1101.3 932.5 1108.5 923.2 1116.0 912.0 C 1123.5 900.8 1130.8 887.5 1136.0 876.0 C 1141.2 864.5 1144.2 857.5 1147.0 843.0 C 1149.8 828.5 1152.7 804.7 1153.0 789.0 C 1153.3 773.3 1150.8 760.3 1149.0 749.0 C 1147.2 737.7 1145.5 730.5 1142.0 721.0 C 1138.5 711.5 1135.0 702.5 1128.0 692.0 C 1121.0 681.5 1109.0 666.8 1100.0 658.0 C 1091.0 649.2 1083.3 644.3 1074.0 639.0 C 1064.7 633.7 1055.8 629.3 1044.0 626.0 C 1032.2 622.7 1016.0 619.8 1003.0 619.0 C 990.0 618.2 977.7 619.3 966.0 621.0 C 954.3 622.7 942.7 625.5 933.0 629.0 C 923.3 632.5 917.2 635.3 908.0 642.0 C 898.8 648.7 884.8 661.7 878.0 669.0 C 871.2 676.3 870.3 679.7 867.0 686.0 C 863.7 692.3 860.5 696.7 858.0 707.0 C 855.5 717.3 852.0 735.2 852.0 748.0 C 852.0 760.8 856.3 776.2 858.0 784.0 C 859.7 791.8 860.0 791.0 862.0 795.0 C 864.0 799.0 866.2 803.3 870.0 808.0 C 873.8 812.7 879.8 819.0 885.0 823.0 C 890.2 827.0 893.2 829.5 901.0 832.0 C 908.8 834.5 923.8 837.2 932.0 838.0 C 940.2 838.8 943.2 838.0 950.0 837.0 C 956.8 836.0 966.7 834.2 973.0 832.0 C 979.3 829.8 983.8 827.0 988.0 824.0 C 992.2 821.0 993.7 821.5 998.0 814.0 C 1002.3 806.5 1011.3 785.5 1014.0 779.0 C 1016.7 772.5 1014.0 775.7 1014.0 775.0';
  var D_STEM = 'M 747.0 1574.0 C 749.0 1572.2 756.2 1580.2 759.0 1563.0 C 761.8 1545.8 760.5 1500.8 764.0 1471.0 C 767.5 1441.2 775.3 1405.2 780.0 1384.0 C 784.7 1362.8 786.3 1359.8 792.0 1344.0 C 797.7 1328.2 805.0 1308.3 814.0 1289.0 C 823.0 1269.7 835.0 1246.7 846.0 1228.0 C 857.0 1209.3 866.3 1195.3 880.0 1177.0 C 893.7 1158.7 911.2 1137.2 928.0 1118.0 C 944.8 1098.8 969.0 1080.8 981.0 1062.0 C 993.0 1043.2 996.8 1014.5 1000.0 1005.0';
  function mountMark() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 2000 2000');
    svg.setAttribute('class', 'opz-pfmark');
    svg.setAttribute('aria-hidden', 'true');
    var g = document.createElementNS(ns, 'g');
    g.setAttribute('fill', 'none'); g.setAttribute('stroke', '#fff');
    g.setAttribute('stroke-width', '75');
    g.setAttribute('stroke-linecap', 'round'); g.setAttribute('stroke-linejoin', 'round');
    [['opzPfA', D_MAIN], ['opzPfB', D_STEM]].forEach(function (p) {
      var el = document.createElementNS(ns, 'path');
      el.setAttribute('id', p[0]); el.setAttribute('d', p[1]);
      el.setAttribute('pathLength', '1');
      g.appendChild(el);
    });
    svg.appendChild(g); fade.appendChild(svg);
    return svg;
  }

  /* ── 第一次進站：黑幕上把標誌一筆畫出來，畫完才掀開 ── */
  if (intro) {
    var mark = mountMark();
    var lifted = false;
    var lift = function () {
      if (lifted) return; lifted = true;
      mark.classList.add('gone');
      setTimeout(function () {
        sync();
        fade.classList.add('pf-out');
        void fade.offsetWidth;
        fade.classList.remove('pf-cover');
        fade.classList.add('pf-up');
        setTimeout(function () { fade.className = 'opz-pagefade'; if (mark.parentNode) mark.parentNode.removeChild(mark); }, REVEAL + 120);
      }, LOGO_FADE - 60);
    };
    setTimeout(function () { mark.classList.add('draw'); }, 120);          // 開始畫
    var afterDraw = 120 + DRAW + DRAW_HOLD;
    if (document.readyState === 'complete') setTimeout(lift, afterDraw);
    else {
      window.addEventListener('load', function () { setTimeout(lift, 80); }, { once: true });
      setTimeout(lift, afterDraw);                                          // 畫完就走，不等超慢的資源
    }
    setTimeout(lift, afterDraw + 1500);                                     // 最後保險
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
