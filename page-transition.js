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
    + '.opz-pfmark mask path{stroke-dasharray:1;stroke-dashoffset:1}'
    + '.opz-pfmark.draw mask path{transition:stroke-dashoffset ' + DRAW + 'ms ' + EASE_DRAW + ';stroke-dashoffset:0}';
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

  /* 標誌 = 原始 logo 的「實際輪廓」填色（從 PNG 描出來，IoU 0.9955＝逐像素相同），
     再用一條沿著中心線的粗筆刷當遮罩掃過去 → 看起來就是被一筆畫出來，但形狀 100% 是原 logo。
     筆刷 92（線寬 75、螺旋兩圈間隙 61 → 92 蓋得住線又碰不到隔壁圈）。
     畫完直接把遮罩拿掉，確保最終狀態是完整無缺的標誌。 */
  var D_SIL = 'M 1134 425 L 1131 425 L 1128 423 L 1122 422 L 1109 417 L 1105 417 L 1098 414 L 1047 404 L 1017 402 L 1016 401 L 968 401 L 967 402 L 944 403 L 943 404 L 925 406 L 900 411 L 867 420 L 833 433 L 801 449 L 798 452 L 791 455 L 788 458 L 779 463 L 748 487 L 722 512 L 702 535 L 680 567 L 668 589 L 651 628 L 651 631 L 645 646 L 645 650 L 640 666 L 640 671 L 638 675 L 637 685 L 635 690 L 633 710 L 632 711 L 632 735 L 631 736 L 632 774 L 633 775 L 635 796 L 637 801 L 638 812 L 651 856 L 657 871 L 671 898 L 690 926 L 704 943 L 720 959 L 744 979 L 768 995 L 806 1014 L 842 1026 L 846 1026 L 870 1032 L 876 1032 L 891 1035 L 954 1035 L 955 1036 L 938 1052 L 893 1101 L 867 1132 L 854 1149 L 851 1155 L 844 1163 L 822 1196 L 803 1228 L 803 1230 L 795 1243 L 784 1265 L 782 1272 L 778 1278 L 777 1283 L 775 1285 L 771 1297 L 766 1306 L 747 1362 L 747 1366 L 742 1382 L 742 1387 L 739 1396 L 731 1436 L 731 1444 L 730 1445 L 730 1451 L 727 1466 L 727 1476 L 725 1483 L 725 1497 L 724 1498 L 724 1511 L 723 1512 L 722 1600 L 796 1600 L 797 1515 L 798 1514 L 798 1505 L 799 1504 L 800 1481 L 801 1480 L 801 1473 L 802 1472 L 802 1465 L 803 1464 L 806 1439 L 811 1419 L 811 1415 L 813 1411 L 813 1407 L 815 1403 L 819 1384 L 826 1363 L 826 1360 L 844 1313 L 851 1300 L 851 1298 L 853 1296 L 853 1294 L 856 1290 L 865 1270 L 887 1233 L 892 1227 L 903 1209 L 933 1170 L 955 1144 L 991 1105 L 1102 996 L 1121 974 L 1145 941 L 1164 908 L 1176 880 L 1186 844 L 1189 819 L 1190 818 L 1190 810 L 1191 809 L 1191 767 L 1190 766 L 1186 736 L 1178 708 L 1174 701 L 1171 692 L 1156 666 L 1143 649 L 1119 625 L 1095 608 L 1078 599 L 1076 599 L 1074 597 L 1053 589 L 1034 584 L 1024 583 L 1018 581 L 991 580 L 990 581 L 973 581 L 936 588 L 916 595 L 900 603 L 885 612 L 871 623 L 858 635 L 842 655 L 833 669 L 825 685 L 820 699 L 815 719 L 815 728 L 814 729 L 814 738 L 813 739 L 813 756 L 814 757 L 815 775 L 817 780 L 818 788 L 823 802 L 830 816 L 843 834 L 859 850 L 877 863 L 892 870 L 903 874 L 922 878 L 952 878 L 975 873 L 997 863 L 1013 852 L 1027 838 L 1041 817 L 1045 808 L 1051 787 L 1051 778 L 1052 777 L 1051 760 L 1045 748 L 1037 740 L 1024 734 L 1004 734 L 993 739 L 985 746 L 980 754 L 976 768 L 976 775 L 972 787 L 962 797 L 955 801 L 945 804 L 926 803 L 918 800 L 908 794 L 900 786 L 891 770 L 888 758 L 888 737 L 894 715 L 898 706 L 905 695 L 922 678 L 935 669 L 961 658 L 982 654 L 1004 654 L 1005 655 L 1016 656 L 1037 662 L 1060 674 L 1073 684 L 1085 696 L 1100 717 L 1111 743 L 1117 773 L 1116 812 L 1112 831 L 1107 846 L 1099 864 L 1083 889 L 1057 916 L 1046 925 L 1024 938 L 1007 946 L 996 949 L 987 953 L 956 960 L 949 960 L 948 961 L 933 962 L 932 963 L 913 963 L 897 960 L 888 960 L 858 953 L 837 946 L 808 932 L 794 923 L 773 906 L 751 883 L 740 868 L 726 842 L 719 824 L 719 821 L 714 808 L 714 803 L 712 799 L 709 784 L 708 770 L 707 769 L 707 760 L 706 759 L 707 719 L 708 718 L 709 703 L 714 682 L 714 677 L 716 674 L 716 670 L 719 663 L 719 660 L 724 649 L 726 641 L 728 639 L 735 622 L 739 617 L 739 615 L 753 592 L 770 570 L 799 541 L 832 517 L 859 503 L 893 490 L 919 483 L 925 483 L 929 481 L 935 481 L 946 478 L 963 477 L 973 475 L 1014 475 L 1015 476 L 1041 478 L 1052 481 L 1057 481 L 1097 491 L 1136 506 L 1169 524 L 1194 541 L 1213 557 L 1233 577 L 1258 608 L 1269 625 L 1282 650 L 1291 672 L 1294 684 L 1296 687 L 1304 717 L 1304 723 L 1306 727 L 1306 733 L 1309 744 L 1309 755 L 1310 756 L 1311 776 L 1312 777 L 1312 822 L 1311 823 L 1311 833 L 1309 842 L 1309 855 L 1307 861 L 1306 872 L 1304 877 L 1304 883 L 1302 889 L 1301 899 L 1299 903 L 1299 907 L 1284 954 L 1279 964 L 1277 971 L 1274 975 L 1271 984 L 1265 995 L 1265 997 L 1244 1034 L 1241 1037 L 1226 1061 L 1211 1081 L 1204 1088 L 1199 1096 L 1164 1135 L 1159 1139 L 1131 1169 L 1092 1216 L 1072 1244 L 1054 1272 L 1026 1323 L 1026 1325 L 1021 1334 L 1021 1336 L 1019 1338 L 1008 1364 L 997 1399 L 995 1402 L 991 1420 L 989 1424 L 989 1429 L 987 1433 L 986 1443 L 981 1462 L 977 1495 L 976 1496 L 976 1506 L 975 1507 L 974 1527 L 973 1528 L 972 1600 L 1047 1600 L 1047 1546 L 1048 1545 L 1048 1529 L 1049 1528 L 1050 1508 L 1051 1507 L 1051 1499 L 1053 1490 L 1053 1481 L 1055 1476 L 1058 1457 L 1064 1437 L 1067 1421 L 1076 1395 L 1084 1378 L 1089 1364 L 1111 1322 L 1145 1270 L 1188 1218 L 1235 1169 L 1238 1164 L 1256 1145 L 1295 1093 L 1314 1063 L 1321 1049 L 1325 1044 L 1335 1024 L 1335 1022 L 1339 1016 L 1351 988 L 1352 983 L 1354 981 L 1357 969 L 1363 956 L 1369 931 L 1371 927 L 1371 922 L 1373 918 L 1373 913 L 1376 904 L 1380 877 L 1382 871 L 1384 844 L 1386 834 L 1387 779 L 1386 778 L 1386 762 L 1384 753 L 1382 728 L 1378 714 L 1378 708 L 1375 693 L 1373 689 L 1371 677 L 1369 673 L 1367 663 L 1365 660 L 1365 657 L 1363 654 L 1363 651 L 1351 622 L 1332 586 L 1313 557 L 1293 532 L 1261 500 L 1223 470 L 1199 455 L 1166 438 Z';
  var D_MAIN = 'M 990 1581 C 993 1578 1006 1577 1010 1563 C 1014 1549 1012 1516 1014 1496 C 1016 1476 1019 1460 1024 1440 C 1029 1420 1037 1393 1044 1374 C 1051 1355 1051 1352 1065 1328 C 1079 1304 1097 1271 1128 1231 C 1159 1191 1224 1125 1252 1089 C 1280 1053 1286 1036 1297 1016 C 1308 996 1312 986 1318 969 C 1324 952 1330 936 1335 914 C 1340 892 1345 861 1347 836 C 1349 811 1349 786 1347 763 C 1345 740 1342 717 1337 697 C 1332 677 1325 658 1319 643 C 1313 628 1307 617 1300 605 C 1293 593 1286 583 1277 571 C 1268 559 1262 550 1244 535 C 1226 520 1190 494 1171 482 C 1152 470 1146 469 1129 463 C 1112 457 1089 450 1069 446 C 1049 442 1029 440 1011 439 C 993 438 976 439 960 440 C 944 441 932 442 916 446 C 900 450 878 456 861 462 C 844 468 831 475 817 483 C 803 491 794 495 778 510 C 762 525 736 554 722 571 C 708 588 704 599 697 615 C 690 631 684 645 679 666 C 674 687 670 720 669 741 C 668 762 670 774 673 790 C 676 806 679 821 684 836 C 689 851 697 868 705 882 C 713 896 720 906 731 917 C 742 928 752 939 768 950 C 784 961 807 974 829 982 C 851 990 872 994 899 997 C 926 1000 975 996 992 997 C 1009 998 991 1009 1001 1005 C 1011 1001 1039 985 1054 975 C 1069 965 1081 954 1091 943 C 1101 932 1108 923 1116 912 C 1124 901 1131 888 1136 876 C 1141 864 1144 858 1147 843 C 1150 828 1153 805 1153 789 C 1153 773 1151 760 1149 749 C 1147 738 1146 730 1142 721 C 1138 712 1135 702 1128 692 C 1121 682 1109 667 1100 658 C 1091 649 1083 644 1074 639 C 1065 634 1056 629 1044 626 C 1032 623 1016 620 1003 619 C 990 618 978 619 966 621 C 954 623 943 626 933 629 C 923 632 917 635 908 642 C 899 649 886 658 878 669 C 870 680 862 694 858 707 C 854 720 851 733 852 748 C 853 763 856 782 862 795 C 868 808 878 817 885 823 C 892 829 893 830 901 832 C 909 834 920 838 932 838 C 944 838 962 836 973 832 C 984 828 991 824 998 814 C 1005 804 1011 782 1014 775';
  var D_STEM = 'M 747 1574 C 749 1572 756 1580 759 1563 C 762 1546 760 1501 764 1471 C 768 1441 772 1414 780 1384 C 788 1354 803 1315 814 1289 C 825 1263 835 1247 846 1228 C 857 1209 858 1205 880 1177 C 902 1149 961 1091 981 1062 C 1001 1033 997 1014 1000 1005';
  var VBOX = '611 381 796 1239';
  function mountMark() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', VBOX);
    svg.setAttribute('class', 'opz-pfmark');
    svg.setAttribute('aria-hidden', 'true');
    var defs = document.createElementNS(ns, 'defs');
    var mask = document.createElementNS(ns, 'mask');
    mask.setAttribute('id', 'opzPfMask');
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('x', '611'); mask.setAttribute('y', '381');
    mask.setAttribute('width', '796'); mask.setAttribute('height', '1239');
    [['opzPfA', D_MAIN], ['opzPfB', D_STEM]].forEach(function (p) {
      var el = document.createElementNS(ns, 'path');
      el.setAttribute('id', p[0]); el.setAttribute('d', p[1]);
      el.setAttribute('pathLength', '1');
      el.setAttribute('fill', 'none'); el.setAttribute('stroke', '#fff');
      el.setAttribute('stroke-width', '92');
      el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
      mask.appendChild(el);
    });
    defs.appendChild(mask); svg.appendChild(defs);
    var shape = document.createElementNS(ns, 'path');
    shape.setAttribute('id', 'opzPfShape');
    shape.setAttribute('d', D_SIL);
    shape.setAttribute('fill', '#fff');
    shape.setAttribute('mask', 'url(#opzPfMask)');
    svg.appendChild(shape);
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
    setTimeout(function () {                                               // 畫完拿掉遮罩＝完整標誌
      var sh = document.getElementById('opzPfShape');
      if (sh) sh.removeAttribute('mask');
    }, 120 + DRAW + 30);
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
