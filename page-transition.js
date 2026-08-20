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
     線寬 75＝原 logo 的線寬。中心線的做法（v13，這是關鍵）：
     ① 逐點量原圖局部寬度，**只採信「寬度正常(<95)」的點**——兩帶合併處的骨架會歪掉，直接丟掉不用；
     ② 可信點沿法線掃到原圖兩側邊緣取中點＝真正的帶子中心；
     ③ 用這些點擬一條平滑曲線(UnivariateSpline)，合併區被「跨過去」→ **整條線不會扭折**；
     ④ 兩端用同一條曲線**外插**延伸（不是接直線，接直線會在接點產生 16° 折角＝之前底部那隻「小腳」）。
     驗收數字：全線最大轉折 右 7.7°／左 15.2°(內圈本來的曲率)、起點段 3.1°／1.3°、與原圖 IoU 0.972，
     底端 x 落在 1005／756（原圖是 1007／757）。viewBox 切在 y=1600 → 平口、從畫面下緣長出來。 */
  var D_RIGHT = 'M 1005.4 1649.9 C 1005.4 1643.1 1005.1 1622.0 1005.3 1608.6 C 1005.4 1595.3 1005.8 1582.8 1006.5 1570.0 C 1007.2 1557.2 1008.1 1544.2 1009.3 1532.0 C 1010.5 1519.8 1011.9 1508.0 1013.5 1496.7 C 1015.2 1485.4 1017.0 1474.8 1019.1 1464.0 C 1021.2 1453.2 1023.6 1442.6 1026.2 1432.0 C 1028.9 1421.5 1032.0 1410.8 1035.1 1400.8 C 1038.3 1390.9 1041.7 1381.4 1045.2 1372.3 C 1048.7 1363.2 1052.3 1354.8 1056.2 1346.2 C 1060.1 1337.6 1064.5 1328.9 1068.8 1320.8 C 1073.1 1312.8 1077.3 1305.7 1082.1 1297.9 C 1087.0 1290.1 1089.2 1285.9 1097.9 1274.0 C 1106.6 1262.1 1115.1 1249.8 1134.5 1226.4 C 1153.9 1203.0 1195.7 1155.8 1214.3 1133.7 C 1233.0 1111.6 1236.1 1107.7 1246.6 1093.9 C 1257.0 1080.0 1267.9 1064.9 1276.9 1050.7 C 1285.9 1036.4 1294.6 1020.2 1300.7 1008.4 C 1306.8 996.7 1309.5 990.0 1313.6 980.2 C 1317.6 970.4 1321.6 959.8 1325.1 949.4 C 1328.6 939.1 1331.8 928.2 1334.4 918.0 C 1337.1 907.7 1339.2 898.3 1341.2 887.8 C 1343.1 877.4 1344.9 865.9 1346.1 855.4 C 1347.4 844.9 1348.2 834.9 1348.7 824.6 C 1349.2 814.3 1349.4 804.0 1349.2 793.7 C 1349.0 783.4 1348.7 774.6 1347.5 762.7 C 1346.3 750.8 1344.5 735.7 1342.0 722.4 C 1339.5 709.1 1336.3 695.5 1332.6 682.8 C 1328.8 670.1 1324.4 658.0 1319.6 646.4 C 1314.8 634.8 1309.7 624.3 1303.6 613.3 C 1297.4 602.3 1290.2 590.8 1282.9 580.5 C 1275.6 570.3 1268.3 561.1 1260.0 551.8 C 1251.6 542.4 1241.9 532.8 1232.5 524.5 C 1223.2 516.1 1214.0 508.9 1203.7 501.7 C 1193.4 494.6 1182.3 487.7 1170.7 481.5 C 1159.0 475.2 1146.0 469.2 1133.6 464.2 C 1121.3 459.3 1109.5 455.3 1096.6 451.8 C 1083.8 448.2 1070.0 445.1 1056.5 442.9 C 1043.0 440.6 1028.9 439.1 1015.6 438.3 C 1002.2 437.5 989.8 437.5 976.4 438.1 C 963.1 438.7 948.8 440.2 935.7 442.2 C 922.6 444.2 909.0 447.4 897.7 450.3 C 886.5 453.2 877.6 456.3 868.3 459.8 C 858.9 463.2 850.6 466.7 841.6 471.0 C 832.7 475.3 823.0 480.5 814.5 485.6 C 806.0 490.7 798.5 495.7 790.5 501.6 C 782.6 507.6 774.1 514.5 766.7 521.2 C 759.3 527.8 752.9 534.2 746.3 541.6 C 739.6 549.0 732.6 557.5 726.7 565.5 C 720.7 573.5 715.6 581.3 710.6 589.6 C 705.7 597.9 701.1 606.5 697.0 615.3 C 692.9 624.1 689.2 633.1 686.0 642.3 C 682.8 651.5 680.0 660.6 677.6 670.4 C 675.3 680.2 673.1 691.1 671.7 701.0 C 670.3 711.0 669.5 720.5 669.0 730.2 C 668.6 739.9 668.6 749.7 669.2 759.3 C 669.7 769.0 670.7 778.7 672.2 788.2 C 673.7 797.7 675.7 807.2 678.2 816.4 C 680.7 825.7 683.7 834.8 687.2 843.7 C 690.7 852.6 694.8 861.3 699.3 869.7 C 703.8 878.2 708.9 886.4 714.5 894.2 C 720.0 902.0 726.1 909.6 732.5 916.8 C 738.9 923.9 745.8 930.8 753.1 937.2 C 760.3 943.6 768.0 949.6 775.9 955.2 C 783.9 960.7 792.2 965.9 800.7 970.5 C 809.3 975.1 818.1 979.2 827.1 982.8 C 836.2 986.3 845.8 989.4 854.9 991.8 C 864.0 994.2 872.7 995.9 881.8 997.1 C 890.8 998.3 900.4 998.9 909.3 999.0 C 918.2 999.1 926.5 998.6 935.2 997.6 C 943.9 996.6 952.6 995.1 961.3 993.0 C 969.9 990.9 978.6 988.3 987.3 985.0 C 995.9 981.7 1004.8 977.7 1013.0 973.4 C 1021.2 969.1 1032.5 961.7 1036.4 959.3';
  var D_LEFT = 'M 755.7 1635.2 C 755.8 1625.8 755.7 1596.9 756.2 1578.9 C 756.8 1560.8 757.6 1543.5 758.8 1526.9 C 760.1 1510.2 761.6 1494.5 763.5 1479.0 C 765.4 1463.4 767.7 1448.4 770.4 1433.7 C 773.0 1419.0 776.0 1404.9 779.4 1390.8 C 782.9 1376.7 786.9 1362.4 791.2 1349.1 C 795.4 1335.7 799.8 1323.4 804.8 1310.8 C 809.8 1298.2 815.8 1284.8 821.2 1273.5 C 826.7 1262.2 831.6 1252.9 837.4 1242.8 C 843.1 1232.6 849.0 1223.0 855.7 1212.7 C 862.4 1202.5 869.9 1191.7 877.6 1181.2 C 885.3 1170.7 889.5 1164.7 902.1 1149.6 C 914.8 1134.4 926.8 1119.5 953.6 1090.4 C 980.4 1061.3 1040.5 999.3 1063.1 975.0 C 1085.7 950.6 1081.7 953.8 1089.3 944.5 C 1097.0 935.2 1103.0 927.7 1109.2 919.0 C 1115.3 910.4 1121.3 901.4 1126.2 892.7 C 1131.2 884.0 1135.3 875.5 1138.9 866.8 C 1142.5 858.2 1145.5 849.7 1147.8 840.8 C 1150.2 832.0 1152.1 823.0 1153.2 813.9 C 1154.3 804.8 1154.8 795.6 1154.6 786.4 C 1154.4 777.3 1153.5 768.0 1152.0 759.0 C 1150.5 749.9 1148.4 740.9 1145.6 732.2 C 1142.8 723.5 1139.3 714.7 1135.4 706.8 C 1131.6 698.8 1127.3 691.5 1122.3 684.4 C 1117.4 677.4 1112.0 670.6 1106.0 664.4 C 1100.0 658.3 1093.3 652.4 1086.5 647.4 C 1079.7 642.4 1072.8 638.3 1065.2 634.5 C 1057.5 630.6 1049.2 627.1 1040.5 624.4 C 1031.9 621.7 1022.4 619.5 1013.1 618.2 C 1003.9 616.9 994.2 616.3 985.1 616.5 C 976.1 616.7 967.2 617.8 958.8 619.5 C 950.4 621.2 942.6 623.5 934.9 626.6 C 927.2 629.7 919.7 633.6 912.8 638.2 C 905.8 642.7 899.2 648.2 893.1 654.0 C 887.1 659.9 881.4 666.7 876.5 673.4 C 871.7 680.1 867.6 687.2 864.2 694.2 C 860.7 701.1 858.0 708.0 855.9 715.1 C 853.8 722.2 852.2 729.5 851.3 736.7 C 850.5 743.8 850.4 751.3 850.9 758.1 C 851.5 764.9 852.8 771.5 854.7 777.6 C 856.6 783.6 859.0 789.2 862.2 794.6 C 865.3 800.0 869.3 805.3 873.7 810.1 C 878.2 814.8 883.0 819.2 888.9 823.2 C 894.8 827.3 902.4 831.6 909.2 834.4 C 916.1 837.3 923.3 839.3 930.0 840.4 C 936.8 841.5 943.3 841.7 949.8 841.0 C 956.2 840.4 964.0 837.9 968.7 836.3 C 973.5 834.7 975.1 833.4 978.1 831.6 C 981.1 829.9 983.1 829.1 986.8 825.6 C 990.6 822.2 997.4 814.9 1000.6 810.9 C 1003.9 806.9 1004.7 804.5 1006.4 801.4 C 1008.0 798.3 1008.9 797.2 1010.3 792.3 C 1011.7 787.4 1013.9 775.3 1014.6 771.9';
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
