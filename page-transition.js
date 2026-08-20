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
  var DRAW = 1150;    // LOGO 一筆畫出來要多久(ms)
  var DRAW_HOLD = 120;// 畫完停一下
  var LOGO_FADE = 220;// 標誌淡出
  /* 兩條線用「同一個時間、同一條曲線」→ 一起起步、一起煞車、一起完成（同速度的話短的那條
     185ms 就畫完了，剩下長的自己跑，看起來會像兩件事分開發生）。 */
  /* 慢起步 → 加速 → 煞車。實際進度：時間 20%→畫 6%、40%→29%、50%→50%、60%→71%、80%→94%。
     （更誇張的 .78,0,.22,1 前 25% 只畫 5%，看起來會像卡住，所以收斂到這條。） */
  var EASE_DRAW = 'cubic-bezier(.55,0,.45,1)';
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
    + 'height:min(38vmin,320px);width:auto;opacity:1;transition:opacity ' + LOGO_FADE + 'ms ease}'
    + '.opz-pfmark.gone{opacity:0}'
    + '.opz-pfmark #opzPfA,.opz-pfmark #opzPfB{stroke-dasharray:1}'
    + '.opz-pfmark.draw #opzPfA,.opz-pfmark.draw #opzPfB{transition:stroke-dashoffset ' + DRAW + 'ms ' + EASE_DRAW + ';stroke-dashoffset:0}';
  (document.head || document.documentElement).appendChild(st);

  /* 掛在 <html> 底下，body 還沒解析出來就能存在＝新頁第一幀就蓋著，不會閃 */
  var fade = document.createElement('div');
  fade.className = 'opz-pagefade';
  fade.setAttribute('aria-hidden', 'true');
  function ss(k, v) { try { return v === undefined ? sessionStorage.getItem(k) : sessionStorage.setItem(k, v); } catch (e) { return null; } }
  var covered = !reduce && ss('opz_pf') === '1';        // 站內點連結過來的
  var intro = !reduce && !covered;   // 只要不是站內點連結過來的（＝直接進站/重新整理）就播 LOGO 進場
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

  /* 標誌動畫（v12，重做）：**就是兩條線，一起畫到完。沒有遮罩、沒有換圖、沒有補件。**
     右線＝底部→繞完外圈→停在碰到左線的那一點（多跨 35 讓交會處自然填滿）。
     左線＝底部→穿過交會處→內圈→中心。中間不停、不斷、不換東西。
     兩條同時開始、同 duration、同曲線 → 右線較長所以快，兩條同一格結束。
     線寬 75＝原 logo 的線寬；中心線經過「重新對正帶子中央」校正（IoU 0.968）。
     底端刻意延長到 y=1615、viewBox 切在 1600 → 端點是平口（跟原圖一樣），
     而且線是「從畫面下緣長出來」的。 */
  var D_RIGHT = 'M 992.8 1611.7 C 993.2 1610.1 993.2 1604.5 995.5 1602.1 C 997.8 1599.7 1004.3 1598.6 1006.6 1597.3 C 1008.9 1596.1 1008.6 1605.6 1009.3 1594.7 C 1010.0 1583.8 1009.3 1552.4 1010.7 1532.0 C 1012.1 1511.5 1014.7 1490.1 1017.7 1471.9 C 1020.7 1453.8 1024.7 1437.0 1028.5 1423.0 C 1032.2 1409.0 1035.8 1399.4 1040.0 1388.0 C 1044.1 1376.7 1049.5 1364.1 1053.4 1355.1 C 1057.2 1346.1 1059.0 1342.4 1063.2 1334.1 C 1067.5 1325.8 1070.7 1318.9 1079.0 1305.2 C 1087.4 1291.6 1102.9 1267.0 1113.2 1252.1 C 1123.6 1237.3 1132.3 1227.1 1141.4 1216.2 C 1150.4 1205.2 1157.1 1197.7 1167.6 1186.3 C 1178.1 1174.9 1191.4 1162.0 1204.1 1147.7 C 1216.8 1133.4 1232.1 1115.4 1243.6 1100.6 C 1255.0 1085.8 1264.0 1072.6 1272.9 1058.6 C 1281.9 1044.6 1289.6 1031.7 1297.2 1016.7 C 1304.8 1001.6 1313.4 981.2 1318.6 968.5 C 1323.9 955.8 1325.5 950.2 1328.5 940.5 C 1331.5 930.8 1333.7 924.4 1336.6 910.4 C 1339.6 896.3 1344.3 870.1 1346.4 856.2 C 1348.4 842.4 1348.6 838.9 1349.2 827.1 C 1349.8 815.4 1350.7 800.3 1350.1 785.9 C 1349.6 771.5 1347.8 754.1 1346.0 740.7 C 1344.3 727.3 1342.3 717.7 1339.5 705.7 C 1336.7 693.6 1333.2 680.4 1329.2 668.6 C 1325.2 656.7 1320.5 645.2 1315.6 634.5 C 1310.6 623.8 1305.4 614.2 1299.6 604.5 C 1293.8 594.9 1288.0 586.0 1280.8 576.5 C 1273.6 567.1 1264.7 556.6 1256.4 547.8 C 1248.2 539.1 1240.7 531.9 1231.4 524.0 C 1222.0 516.2 1210.7 507.6 1200.2 500.5 C 1189.6 493.4 1178.0 486.6 1168.1 481.2 C 1158.3 475.9 1152.4 473.0 1141.1 468.5 C 1129.8 463.9 1114.6 458.2 1100.1 454.0 C 1085.6 449.9 1067.6 446.0 1054.1 443.6 C 1040.6 441.1 1031.3 440.1 1019.1 439.3 C 1006.9 438.5 993.5 438.1 981.0 438.5 C 968.4 438.9 955.8 440.2 943.9 441.8 C 932.1 443.3 920.8 445.6 909.9 448.0 C 899.1 450.5 889.4 453.0 878.9 456.5 C 868.4 459.9 856.6 464.6 847.0 468.8 C 837.3 473.0 829.3 477.1 821.0 481.9 C 812.6 486.6 804.6 491.7 797.0 497.1 C 789.3 502.5 782.5 507.8 775.1 514.2 C 767.8 520.6 760.0 527.9 752.9 535.3 C 745.7 542.8 738.0 551.7 732.2 559.0 C 726.4 566.3 722.9 571.3 718.1 579.0 C 713.2 586.7 708.1 594.9 703.1 605.0 C 698.0 615.2 691.5 630.3 687.7 639.9 C 683.9 649.5 682.8 653.9 680.4 662.9 C 678.1 671.9 675.3 684.4 673.5 693.9 C 671.8 703.4 670.6 710.9 669.9 719.9 C 669.1 728.9 669.0 740.0 669.0 748.0 C 669.0 756.1 669.3 761.4 670.0 768.1 C 670.6 774.8 671.3 780.5 672.7 788.2 C 674.0 795.8 675.8 805.3 678.1 814.2 C 680.4 823.0 683.5 833.2 686.3 841.3 C 689.1 849.3 691.2 854.7 695.0 862.4 C 698.8 870.1 704.2 879.9 709.0 887.4 C 713.7 894.9 718.3 901.0 723.4 907.4 C 728.6 913.9 733.3 919.4 739.9 925.9 C 746.6 932.4 756.3 940.7 763.4 946.3 C 770.5 951.9 776.2 955.7 782.4 959.7 C 788.6 963.6 793.9 966.7 800.4 970.0 C 806.9 973.4 813.9 976.7 821.4 979.8 C 828.9 982.8 837.8 985.8 845.5 988.1 C 853.2 990.4 857.2 991.9 867.6 993.7 C 878.0 995.6 896.6 998.3 907.8 999.2 C 919.1 1000.1 926.6 999.6 935.1 999.3 C 943.5 999.0 953.8 997.4 958.5 997.3 C 963.2 997.2 961.5 997.8 963.3 998.8 C 965.1 999.9 966.9 1003.4 969.4 1003.7 C 971.9 1003.9 975.7 1001.0 978.2 1000.4 C 980.7 999.8 976.2 998.1 984.4 1000.2 C 992.6 1002.3 1020.3 1010.9 1027.5 1013.1';
  var D_LEFT = 'M 748.1 1611.0 C 748.3 1609.7 748.2 1605.3 749.7 1603.1 C 751.2 1600.9 755.5 1598.9 757.1 1597.5 C 758.6 1596.0 758.3 1607.8 758.9 1594.4 C 759.4 1581.0 759.5 1535.6 760.2 1517.0 C 760.8 1498.4 760.9 1498.7 762.8 1483.0 C 764.8 1467.3 768.3 1441.4 771.8 1423.0 C 775.4 1404.7 780.6 1386.4 784.2 1373.1 C 787.8 1359.7 789.2 1355.0 793.5 1343.1 C 797.8 1331.1 804.4 1313.9 809.9 1301.1 C 815.3 1288.3 819.1 1279.8 826.3 1266.2 C 833.4 1252.5 842.4 1235.7 852.8 1219.2 C 863.2 1202.7 876.6 1183.4 888.7 1167.2 C 900.8 1151.0 910.7 1139.1 925.6 1122.2 C 940.5 1105.2 968.5 1077.4 978.2 1065.3 C 988.0 1053.3 982.1 1053.5 984.3 1049.7 C 986.4 1045.9 989.9 1045.5 991.3 1042.5 C 992.7 1039.6 991.6 1035.1 992.8 1031.9 C 993.9 1028.7 991.7 1029.8 998.3 1023.2 C 1004.8 1016.7 1022.9 1000.1 1031.9 992.6 C 1040.9 985.1 1044.5 984.3 1052.3 978.1 C 1060.1 972.0 1072.0 962.0 1078.8 955.8 C 1085.6 949.6 1087.3 947.5 1093.1 940.8 C 1098.9 934.1 1107.6 923.8 1113.4 915.8 C 1119.2 907.8 1123.5 900.7 1127.9 892.7 C 1132.3 884.6 1136.4 876.3 1139.8 867.6 C 1143.2 858.9 1146.3 848.7 1148.4 840.5 C 1150.6 832.3 1151.6 826.1 1152.6 818.3 C 1153.6 810.6 1154.3 803.0 1154.4 794.1 C 1154.5 785.1 1154.4 774.6 1153.2 764.7 C 1152.0 754.7 1149.6 743.3 1147.1 734.3 C 1144.7 725.4 1141.8 718.6 1138.4 711.2 C 1135.0 703.9 1131.6 697.2 1126.8 690.1 C 1122.1 683.1 1115.9 675.2 1110.0 668.7 C 1104.1 662.3 1098.5 657.0 1091.4 651.5 C 1084.4 646.1 1075.9 640.4 1067.6 636.0 C 1059.3 631.6 1050.2 628.0 1041.5 625.2 C 1032.7 622.4 1023.7 620.3 1015.3 619.1 C 1006.9 617.9 999.2 617.7 991.0 617.9 C 982.7 618.1 974.3 618.9 965.8 620.5 C 957.2 622.0 947.6 624.3 939.6 627.1 C 931.6 629.9 924.5 633.2 917.5 637.2 C 910.5 641.2 904.3 645.4 897.8 651.0 C 891.3 656.6 883.6 664.4 878.4 670.6 C 873.1 676.9 870.0 681.9 866.4 688.4 C 862.9 694.9 859.6 702.2 857.2 709.4 C 854.8 716.6 853.2 724.1 852.2 731.7 C 851.3 739.3 851.1 748.0 851.4 755.2 C 851.8 762.4 852.7 768.6 854.2 774.8 C 855.8 780.9 857.8 786.4 860.6 792.1 C 863.5 797.8 867.3 803.7 871.4 808.8 C 875.4 813.8 879.9 818.5 884.9 822.6 C 890.0 826.7 895.4 830.4 901.6 833.3 C 907.8 836.3 914.8 838.8 922.3 840.1 C 929.7 841.4 939.5 841.5 946.5 841.1 C 953.5 840.6 958.2 839.6 964.3 837.3 C 970.5 835.1 977.9 831.3 983.4 827.6 C 988.9 823.9 993.4 819.9 997.4 815.2 C 1001.5 810.5 1005.3 805.0 1007.9 799.4 C 1010.6 793.8 1012.4 784.4 1013.3 781.4';
  var VBOX = '611 381 796 1219';
  function mountMark() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', VBOX);
    svg.setAttribute('class', 'opz-pfmark');
    svg.setAttribute('aria-hidden', 'true');
    var g = document.createElementNS(ns, 'g');
    g.setAttribute('fill', 'none'); g.setAttribute('stroke', '#fff');
    g.setAttribute('stroke-width', '75');
    g.setAttribute('stroke-linecap', 'round'); g.setAttribute('stroke-linejoin', 'round');
    [['opzPfA', D_RIGHT], ['opzPfB', D_LEFT]].forEach(function (p) {
      var el = document.createElementNS(ns, 'path');
      el.setAttribute('id', p[0]); el.setAttribute('d', p[1]);
      el.setAttribute('pathLength', '1');
      el.setAttribute('stroke-dashoffset', '1');
      g.appendChild(el);
    });
    svg.appendChild(g);
    fade.appendChild(svg);
    return svg;
  }

  /* ── 直接進站/重新整理：黑幕上把標誌一筆畫出來，畫完才掀開 ── */
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
