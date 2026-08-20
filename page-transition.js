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
  var DRAW_HOLD = 160;// 畫完停一下
  var LOGO_FADE = 560;// 標誌＋毛玻璃一起淡出（要同一個數字才會像「一起消失」）
  /* 進場「電視開機」：黑幕從中間裂開一條縫、往上下撐開，露出**模糊化的頁面本身**。 */
  var TV_OPEN = 720;  // 縫撐開到滿版要多久(ms)
  var DRAW_IN = 460;  // 縫開始撐開後多久才動筆（刻意重疊，不要變成兩件事）
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
    + '.opz-pfmark mask path{stroke-dasharray:1}'
    + '.opz-pfmark.draw mask path{transition:stroke-dashoffset ' + DRAW + 'ms ' + EASE_DRAW + ';stroke-dashoffset:0}'
    /* ── 電視開機 ── 上下兩塊黑各佔 51%（多的 1% 是重疊，避免視窗高度是奇數時中線露白）。
       scaleY 往外側收＝縫從正中間往上下撐開。黑幕自己的底色這時要變透明，
       否則毛玻璃拿去糊的「背景」會是那塊黑色，糊出來還是全黑。 */
    + '.opz-pagefade.pf-tv{background:transparent}'
    + '.opz-tv{position:absolute;left:0;width:100%;height:51%;background:#000;'
    + 'will-change:transform;backface-visibility:hidden}'
    + '.opz-tv-t{top:0;transform-origin:50% 0}'
    + '.opz-tv-b{bottom:0;transform-origin:50% 100%}'
    + '.opz-pagefade.pf-open .opz-tv{transform:scaleY(0);transition:transform ' + TV_OPEN + 'ms ' + EASE_OUT + '}'
    /* 毛玻璃：糊的是**頁面本身**（backdrop-filter），不是一張圖。壓暗是為了讓白色標誌有對比。 */
    + '.opz-glass{position:absolute;left:0;top:0;width:100%;height:100%;opacity:1;'
    + 'background:rgba(0,0,0,.20);will-change:opacity;'
    + '-webkit-backdrop-filter:blur(30px) brightness(.42) saturate(.9);'
    + 'backdrop-filter:blur(30px) brightness(.42) saturate(.9);'
    + 'transition:opacity ' + LOGO_FADE + 'ms ease}'
    + '@supports not ((backdrop-filter:blur(2px)) or (-webkit-backdrop-filter:blur(2px)))'
    + '{.opz-glass{background:rgba(0,0,0,.72)}}'      // 不支援毛玻璃就只壓暗，不會壞掉
    + '.opz-glass.gone{opacity:0}';
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

  /* 標誌動畫（v18）：**畫的是原圖本身** —— 一整塊精確輪廓（IoU 0.9955），
     用兩支「跟線差不多寬」的筆刷當遮罩掃出來。所以**輪廓永遠是 logo 自己的輪廓**。

     v18 重做了兩條軌道，解掉 Martin 指出的兩個毛病（筆尖不圓潤、交會處有瑕疵）：
     ① **軌道本身是平滑曲線，不是描出來的**。原圖骨架（medial axis）先量出來，
        但**交會點半徑 110 以內、以及底部切邊 y>1545 的骨架點全部丟掉**（那兩處骨架會被
        分岔和平切端拉歪＝以前中間會歪掉的元凶），剩下的乾淨點才拿去擬合一條平滑樣條，
        交會區靠曲線自己內插過去。結果：整條線曲率變號只有 1 次（＝只有一個該有的反曲點），
        曲率抖動 dk_rms 從 2.7e-3 降到 7e-5，等於「軌道就是圓的，不會為了遷就形狀而扭」。
     ② **筆刷收窄成 86/82（原本 180/77）**。180 的圓頭直徑是線寬的 2.4 倍，筆尖在 75 寬的
        線裡會露成一大塊平頭（＝Martin 看到的「突出去」），交會處還會鼓一包。
        86/82 只比線寬 75 大一點點，筆尖全程是圓的。
     ③ **交會處完全填滿**：右線穿過交會點後再往前延伸 180（沿著自己的曲率走的圓弧，
        G2 接上去，不會有折角），把接口那塊填完。兩端也各往畫面外多走一小段，
        底部平切端的角落不會缺。實測畫完只差 10px（原圖 314,247px）＝ 肉眼零瑕疵。

     右線＝底部→外圈→穿過交會處補滿接口；左線＝底部→穿過交會→內圈→中心。同時開始、同時結束。 */
  var D_SIL = 'M 1134 425 L 1131 425 L 1128 423 L 1122 422 L 1109 417 L 1105 417 L 1098 414 L 1047 404 L 1017 402 L 1016 401 L 968 401 L 967 402 L 944 403 L 943 404 L 925 406 L 900 411 L 867 420 L 833 433 L 801 449 L 798 452 L 791 455 L 788 458 L 779 463 L 748 487 L 722 512 L 702 535 L 680 567 L 668 589 L 651 628 L 651 631 L 645 646 L 645 650 L 640 666 L 640 671 L 638 675 L 637 685 L 635 690 L 633 710 L 632 711 L 632 735 L 631 736 L 632 774 L 633 775 L 635 796 L 637 801 L 638 812 L 651 856 L 657 871 L 671 898 L 690 926 L 704 943 L 720 959 L 744 979 L 768 995 L 806 1014 L 842 1026 L 846 1026 L 870 1032 L 876 1032 L 891 1035 L 954 1035 L 955 1036 L 938 1052 L 893 1101 L 867 1132 L 854 1149 L 851 1155 L 844 1163 L 822 1196 L 803 1228 L 803 1230 L 795 1243 L 784 1265 L 782 1272 L 778 1278 L 777 1283 L 775 1285 L 771 1297 L 766 1306 L 747 1362 L 747 1366 L 742 1382 L 742 1387 L 739 1396 L 731 1436 L 731 1444 L 730 1445 L 730 1451 L 727 1466 L 727 1476 L 725 1483 L 725 1497 L 724 1498 L 724 1511 L 723 1512 L 722 1600 L 796 1600 L 797 1515 L 798 1514 L 798 1505 L 799 1504 L 800 1481 L 801 1480 L 801 1473 L 802 1472 L 802 1465 L 803 1464 L 806 1439 L 811 1419 L 811 1415 L 813 1411 L 813 1407 L 815 1403 L 819 1384 L 826 1363 L 826 1360 L 844 1313 L 851 1300 L 851 1298 L 853 1296 L 853 1294 L 856 1290 L 865 1270 L 887 1233 L 892 1227 L 903 1209 L 933 1170 L 955 1144 L 991 1105 L 1102 996 L 1121 974 L 1145 941 L 1164 908 L 1176 880 L 1186 844 L 1189 819 L 1190 818 L 1190 810 L 1191 809 L 1191 767 L 1190 766 L 1186 736 L 1178 708 L 1174 701 L 1171 692 L 1156 666 L 1143 649 L 1119 625 L 1095 608 L 1078 599 L 1076 599 L 1074 597 L 1053 589 L 1034 584 L 1024 583 L 1018 581 L 991 580 L 990 581 L 973 581 L 936 588 L 916 595 L 900 603 L 885 612 L 871 623 L 858 635 L 842 655 L 833 669 L 825 685 L 820 699 L 815 719 L 815 728 L 814 729 L 814 738 L 813 739 L 813 756 L 814 757 L 815 775 L 817 780 L 818 788 L 823 802 L 830 816 L 843 834 L 859 850 L 877 863 L 892 870 L 903 874 L 922 878 L 952 878 L 975 873 L 997 863 L 1013 852 L 1027 838 L 1041 817 L 1045 808 L 1051 787 L 1051 778 L 1052 777 L 1051 760 L 1045 748 L 1037 740 L 1024 734 L 1004 734 L 993 739 L 985 746 L 980 754 L 976 768 L 976 775 L 972 787 L 962 797 L 955 801 L 945 804 L 926 803 L 918 800 L 908 794 L 900 786 L 891 770 L 888 758 L 888 737 L 894 715 L 898 706 L 905 695 L 922 678 L 935 669 L 961 658 L 982 654 L 1004 654 L 1005 655 L 1016 656 L 1037 662 L 1060 674 L 1073 684 L 1085 696 L 1100 717 L 1111 743 L 1117 773 L 1116 812 L 1112 831 L 1107 846 L 1099 864 L 1083 889 L 1057 916 L 1046 925 L 1024 938 L 1007 946 L 996 949 L 987 953 L 956 960 L 949 960 L 948 961 L 933 962 L 932 963 L 913 963 L 897 960 L 888 960 L 858 953 L 837 946 L 808 932 L 794 923 L 773 906 L 751 883 L 740 868 L 726 842 L 719 824 L 719 821 L 714 808 L 714 803 L 712 799 L 709 784 L 708 770 L 707 769 L 707 760 L 706 759 L 707 719 L 708 718 L 709 703 L 714 682 L 714 677 L 716 674 L 716 670 L 719 663 L 719 660 L 724 649 L 726 641 L 728 639 L 735 622 L 739 617 L 739 615 L 753 592 L 770 570 L 799 541 L 832 517 L 859 503 L 893 490 L 919 483 L 925 483 L 929 481 L 935 481 L 946 478 L 963 477 L 973 475 L 1014 475 L 1015 476 L 1041 478 L 1052 481 L 1057 481 L 1097 491 L 1136 506 L 1169 524 L 1194 541 L 1213 557 L 1233 577 L 1258 608 L 1269 625 L 1282 650 L 1291 672 L 1294 684 L 1296 687 L 1304 717 L 1304 723 L 1306 727 L 1306 733 L 1309 744 L 1309 755 L 1310 756 L 1311 776 L 1312 777 L 1312 822 L 1311 823 L 1311 833 L 1309 842 L 1309 855 L 1307 861 L 1306 872 L 1304 877 L 1304 883 L 1302 889 L 1301 899 L 1299 903 L 1299 907 L 1284 954 L 1279 964 L 1277 971 L 1274 975 L 1271 984 L 1265 995 L 1265 997 L 1244 1034 L 1241 1037 L 1226 1061 L 1211 1081 L 1204 1088 L 1199 1096 L 1164 1135 L 1159 1139 L 1131 1169 L 1092 1216 L 1072 1244 L 1054 1272 L 1026 1323 L 1026 1325 L 1021 1334 L 1021 1336 L 1019 1338 L 1008 1364 L 997 1399 L 995 1402 L 991 1420 L 989 1424 L 989 1429 L 987 1433 L 986 1443 L 981 1462 L 977 1495 L 976 1496 L 976 1506 L 975 1507 L 974 1527 L 973 1528 L 972 1600 L 1047 1600 L 1047 1546 L 1048 1545 L 1048 1529 L 1049 1528 L 1050 1508 L 1051 1507 L 1051 1499 L 1053 1490 L 1053 1481 L 1055 1476 L 1058 1457 L 1064 1437 L 1067 1421 L 1076 1395 L 1084 1378 L 1089 1364 L 1111 1322 L 1145 1270 L 1188 1218 L 1235 1169 L 1238 1164 L 1256 1145 L 1295 1093 L 1314 1063 L 1321 1049 L 1325 1044 L 1335 1024 L 1335 1022 L 1339 1016 L 1351 988 L 1352 983 L 1354 981 L 1357 969 L 1363 956 L 1369 931 L 1371 927 L 1371 922 L 1373 918 L 1373 913 L 1376 904 L 1380 877 L 1382 871 L 1384 844 L 1386 834 L 1387 779 L 1386 778 L 1386 762 L 1384 753 L 1382 728 L 1378 714 L 1378 708 L 1375 693 L 1373 689 L 1371 677 L 1369 673 L 1367 663 L 1365 660 L 1365 657 L 1363 654 L 1363 651 L 1351 622 L 1332 586 L 1313 557 L 1293 532 L 1261 500 L 1223 470 L 1199 455 L 1166 438 Z';
  var D_RIGHT = 'M 1017.0 1605.5 C 1015.3 1595.6 1013.8 1585.7 1012.9 1575.8 C 1012.0 1565.8 1011.5 1555.8 1011.4 1545.8 C 1011.4 1535.8 1011.8 1525.8 1012.6 1515.8 C 1013.3 1505.9 1014.5 1495.9 1016.0 1486.0 C 1017.4 1476.1 1019.2 1466.3 1021.3 1456.5 C 1023.3 1446.7 1025.6 1437.0 1028.2 1427.3 C 1030.7 1417.6 1033.6 1408.0 1036.6 1398.5 C 1039.7 1389.0 1043.0 1379.5 1046.6 1370.2 C 1050.2 1360.9 1054.1 1351.6 1058.2 1342.5 C 1062.4 1333.4 1066.8 1324.5 1071.5 1315.6 C 1076.1 1307.1 1081.0 1298.7 1086.1 1290.5 C 1091.3 1282.0 1096.9 1273.7 1102.7 1265.6 C 1108.5 1257.4 1114.6 1249.5 1120.8 1241.6 C 1127.0 1233.8 1133.5 1226.1 1140.0 1218.6 C 1146.5 1211.0 1153.1 1203.5 1159.8 1196.0 C 1166.5 1188.6 1173.2 1181.2 1179.9 1173.7 C 1186.6 1166.3 1193.3 1158.9 1199.9 1151.3 C 1206.5 1143.8 1213.0 1136.2 1219.4 1128.5 C 1225.7 1120.8 1232.0 1113.0 1238.1 1105.1 C 1244.2 1097.2 1250.1 1089.1 1255.9 1080.9 C 1261.4 1073.0 1266.8 1065.0 1272.0 1056.8 C 1277.3 1048.3 1282.5 1039.7 1287.3 1031.0 C 1292.2 1022.3 1296.9 1013.4 1301.2 1004.4 C 1305.6 995.4 1309.7 986.3 1313.5 977.0 C 1317.4 967.8 1320.9 958.4 1324.1 949.0 C 1327.4 939.5 1330.3 929.9 1333.0 920.3 C 1335.6 910.6 1337.9 900.9 1339.9 891.1 C 1341.9 881.3 1343.6 871.4 1344.9 861.5 C 1346.3 851.6 1347.3 841.6 1347.9 831.7 C 1348.6 821.7 1349.0 811.7 1348.9 801.7 C 1348.9 791.7 1348.6 781.7 1347.9 771.7 C 1347.2 762.0 1346.2 752.4 1344.8 742.8 C 1343.4 732.9 1341.7 723.1 1339.6 713.3 C 1337.4 703.5 1334.9 693.8 1332.1 684.3 C 1329.2 674.7 1326.0 665.2 1322.3 655.9 C 1318.7 646.6 1314.7 637.4 1310.3 628.4 C 1305.9 619.4 1301.1 610.6 1296.0 602.0 C 1290.8 593.5 1285.3 585.1 1279.4 577.0 C 1273.5 569.0 1267.2 561.2 1260.6 553.7 C 1253.9 546.2 1247.0 539.0 1239.7 532.1 C 1232.4 525.3 1224.8 518.8 1216.9 512.6 C 1209.3 506.7 1201.4 501.1 1193.3 495.8 C 1184.9 490.4 1176.2 485.3 1167.4 480.7 C 1158.5 476.0 1149.5 471.7 1140.3 467.8 C 1131.0 463.9 1121.7 460.4 1112.1 457.3 C 1102.6 454.2 1093.0 451.5 1083.3 449.2 C 1073.6 446.8 1063.7 444.9 1053.9 443.3 C 1044.0 441.7 1034.0 440.6 1024.1 439.8 C 1014.1 439.0 1004.1 438.6 994.1 438.6 C 984.1 438.6 974.1 438.9 964.1 439.7 C 954.1 440.5 944.2 441.6 934.3 443.2 C 924.4 444.8 914.6 446.8 904.9 449.2 C 895.5 451.5 886.2 454.2 877.1 457.3 C 867.6 460.5 858.3 464.2 849.1 468.2 C 840.0 472.3 831.0 476.8 822.3 481.7 C 813.6 486.6 805.1 491.9 796.9 497.7 C 788.7 503.4 780.8 509.5 773.2 516.1 C 765.7 522.6 758.4 529.5 751.5 536.8 C 744.6 544.0 738.1 551.6 732.0 559.6 C 725.9 567.5 720.2 575.7 714.9 584.2 C 709.6 592.7 704.8 601.4 700.3 610.4 C 695.9 619.4 691.9 628.6 688.4 638.0 C 685.0 647.0 682.1 656.2 679.6 665.6 C 677.0 675.2 674.8 685.0 673.2 694.9 C 671.6 704.7 670.4 714.7 669.8 724.7 C 669.2 734.7 669.0 744.7 669.4 754.7 C 669.8 764.7 670.8 774.7 672.2 784.5 C 673.7 794.4 675.7 804.3 678.2 813.9 C 680.8 823.6 683.8 833.2 687.5 842.5 C 691.1 851.8 695.3 860.9 700.0 869.7 C 704.7 878.5 710.0 887.1 715.7 895.3 C 721.5 903.4 727.7 911.3 734.5 918.7 C 741.2 926.0 748.4 933.0 756.1 939.5 C 763.4 945.7 771.2 951.5 779.3 956.8 C 787.6 962.3 796.4 967.3 805.4 971.6 C 814.4 976.0 823.6 979.8 833.1 983.0 C 842.6 986.3 852.3 988.9 862.0 990.9 C 871.8 993.0 881.8 994.4 891.7 995.2 C 901.7 996.1 911.7 996.3 921.7 995.9 C 931.7 995.6 941.7 994.6 951.6 993.0 C 961.4 991.5 971.2 989.3 980.8 986.6 C 990.5 983.8 999.9 980.5 1009.1 976.6 C 1018.3 972.7 1027.3 968.3 1036.0 963.3 C 1044.4 958.5 1052.4 953.1 1060.3 947.4';
  var D_LEFT = 'M 757.2 1605.8 C 757.4 1595.8 757.7 1585.8 758.1 1575.8 C 758.4 1565.8 758.8 1555.8 759.3 1545.8 C 759.8 1535.9 760.3 1525.9 760.9 1515.9 C 761.6 1505.9 762.3 1495.9 763.3 1486.0 C 764.2 1476.4 765.3 1466.8 766.6 1457.2 C 767.9 1447.3 769.4 1437.4 771.2 1427.5 C 773.0 1417.7 775.1 1407.9 777.4 1398.2 C 779.7 1388.5 782.2 1378.8 785.0 1369.2 C 787.7 1359.9 790.6 1350.7 793.8 1341.5 C 797.0 1332.1 800.5 1322.7 804.2 1313.4 C 808.0 1304.1 811.9 1294.9 816.1 1285.8 C 820.2 1276.8 824.6 1267.8 829.2 1258.9 C 833.7 1250.3 838.3 1241.8 843.2 1233.5 C 848.2 1224.8 853.5 1216.3 858.9 1207.9 C 864.4 1199.5 870.0 1191.3 875.9 1183.2 C 881.7 1175.1 887.8 1167.1 894.0 1159.3 C 900.3 1151.5 906.7 1143.8 913.3 1136.3 C 919.6 1129.0 926.1 1121.8 932.7 1114.7 C 939.5 1107.4 946.4 1100.2 953.4 1093.1 C 960.5 1086.0 967.5 1078.9 974.7 1071.9 C 981.8 1064.9 988.9 1057.9 996.1 1050.9 C 1003.0 1044.1 1009.9 1037.4 1016.7 1030.5 C 1023.8 1023.5 1030.9 1016.4 1037.8 1009.1 C 1044.7 1001.9 1051.5 994.6 1058.2 987.2 C 1064.9 979.7 1071.4 972.1 1077.7 964.4 C 1083.8 956.9 1089.7 949.2 1095.4 941.4 C 1101.2 933.3 1106.8 925.0 1112.1 916.5 C 1117.3 908.0 1122.2 899.2 1126.6 890.3 C 1131.1 881.3 1135.1 872.1 1138.6 862.7 C 1142.0 853.4 1145.0 843.8 1147.2 834.0 C 1149.4 824.6 1151.0 815.1 1151.9 805.4 C 1152.8 795.5 1153.0 785.4 1152.3 775.5 C 1151.7 765.5 1150.2 755.6 1148.0 745.8 C 1145.7 736.1 1142.6 726.5 1138.7 717.3 C 1134.9 708.4 1130.4 699.8 1125.2 691.7 C 1119.8 683.3 1113.7 675.3 1106.9 668.0 C 1100.1 660.7 1092.6 654.0 1084.5 648.0 C 1076.5 642.1 1067.9 636.9 1058.9 632.6 C 1050.2 628.5 1041.0 625.1 1031.7 622.7 C 1022.0 620.2 1012.1 618.6 1002.1 618.0 C 992.1 617.4 982.0 617.9 972.2 619.3 C 962.3 620.7 952.5 623.1 943.1 626.4 C 933.7 629.7 924.5 634.0 916.0 639.2 C 907.7 644.2 899.9 650.1 892.9 656.6 C 885.6 663.4 878.9 671.1 873.3 679.3 C 867.7 687.6 863.1 696.5 859.6 705.9 C 856.2 715.3 854.0 725.2 853.1 735.1 C 852.3 744.7 852.8 754.5 854.6 764.0 C 856.5 773.8 859.8 783.4 864.5 792.2 C 869.1 801.0 875.2 809.2 882.4 816.1 C 889.5 823.0 898.0 828.8 907.2 832.7 C 916.0 836.5 925.7 838.6 935.3 838.8 C 945.3 838.9 955.4 837.0 964.7 833.4 C 973.9 829.9 982.7 824.5 990.1 817.9 C 997.5 811.2 1003.7 802.9 1007.6 793.8 C 1011.3 784.9 1012.6 775.1 1013.4 765.5';
  var VBOX = '611 381 796 1219';
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
    mask.setAttribute('width', '796'); mask.setAttribute('height', '1219');
    /* 筆刷寬度：線寬 75，軌道對中誤差 ≤4，所以 82 就一定蓋得滿；右線多 4（86）是因為
       交會處原圖本來就寬到 110，要把接口吃乾淨。**兩支都不能再加寬**：
       筆刷半徑一超過 48，筆尖在 75 寬的線裡就會露成平頭而不是圓頭（v15 的 180 就是這樣）；
       而且隔壁那圈的邊緣只在 98px 外，太寬會啃到隔壁。 */
    [['opzPfA', D_RIGHT, '86'], ['opzPfB', D_LEFT, '82']].forEach(function (p) {
      var el = document.createElementNS(ns, 'path');
      el.setAttribute('id', p[0]); el.setAttribute('d', p[1]);
      el.setAttribute('pathLength', '1');
      el.setAttribute('stroke-dashoffset', '1');
      el.setAttribute('fill', 'none'); el.setAttribute('stroke', '#fff');
      el.setAttribute('stroke-width', p[2]);
      el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
      mask.appendChild(el);
    });
    defs.appendChild(mask); svg.appendChild(defs);
    var shape = document.createElementNS(ns, 'path');
    shape.setAttribute('d', D_SIL);
    shape.setAttribute('fill', '#fff');
    shape.setAttribute('mask', 'url(#opzPfMask)');
    svg.appendChild(shape);
    fade.appendChild(svg);
    return svg;
  }

  /* ── 直接進站/重新整理：電視開機 → 模糊背景上把標誌一筆畫出來 → 標誌和毛玻璃一起淡出 ──
     順序（仿 pedestal.com）：
       ① 全黑（第一幀就黑，不會閃）
       ② 中間裂一條縫、往上下撐開 → 露出的是**這一頁自己**，但被毛玻璃糊掉＋壓暗
       ③ 縫快撐滿時開始動筆，標誌畫在毛玻璃上
       ④ 畫完停一下 → **標誌和毛玻璃同時淡出**，頁面就地變清晰（不再往上掀黑幕）
     ②之前會先等頁面畫好（最多 HOLD_MAX），因為毛玻璃糊的是頁面本身，
     頁面還沒畫出來就開，會糊到一片空白。 */
  if (intro) {
    var glass = document.createElement('div'); glass.className = 'opz-glass';
    var tvT = document.createElement('div'); tvT.className = 'opz-tv opz-tv-t';
    var tvB = document.createElement('div'); tvB.className = 'opz-tv opz-tv-b';
    fade.appendChild(glass); fade.appendChild(tvT); fade.appendChild(tvB);
    fade.classList.add('pf-tv');       // 黑幕自己的底色交給上下兩塊，本體透明
    var mark = mountMark();            // 標誌疊在最上層

    var done = false;
    var finish = function () {         // ④ 標誌 + 毛玻璃一起走
      if (done) return; done = true;
      mark.classList.add('gone');
      glass.classList.add('gone');
      setTimeout(function () {
        fade.className = 'opz-pagefade';                 // 復位，之後的跳頁轉場照常用
        while (fade.firstChild) fade.removeChild(fade.firstChild);
      }, LOGO_FADE + 80);
    };

    var opened = false;
    var openTv = function () {         // ② 撐開 → ③ 動筆
      if (opened) return; opened = true;
      try { window.__opzHoldCurtain = false; } catch (e) {}
      sync();
      fade.classList.add('pf-open');
      setTimeout(function () { mark.classList.add('draw'); }, DRAW_IN);
      setTimeout(finish, DRAW_IN + DRAW + DRAW_HOLD);
    };

    /* 某些頁會自己壓住開場（__opzHoldCurtain），準備好再叫 __opzRevealCurtain() */
    window.__opzRevealCurtain = openTv;
    var autoOpen = function () { if (!window.__opzHoldCurtain) openTv(); };
    if (document.readyState === 'complete') setTimeout(autoOpen, 60);
    else window.addEventListener('load', function () { setTimeout(autoOpen, 40); }, { once: true });
    setTimeout(autoOpen, HOLD_MAX);    // 一般保險：頁面太慢就先開
    setTimeout(openTv, 3000);          // 絕對保險：永遠不會黑超過 3 秒
  }

  /* ── 進場：黑幕已經蓋著 → 等頁面畫好（最多 HOLD_MAX）→ 往上掀開 ── */
  if (covered) {
    var revealed = false;
    var reveal = function () {
      if (revealed) return; revealed = true;
      try { window.__opzHoldCurtain = false; } catch (e) {}
      sync();
      fade.classList.add('pf-out');
      void fade.offsetWidth;
      fade.classList.remove('pf-cover');
      fade.classList.add('pf-up');
      setTimeout(function () { fade.className = 'opz-pagefade'; }, REVEAL + 120);
    };
    /* A page can DEFER the lift until its own content is ready — e.g. the musician
       profile waits for the hero photo + name so the curtain never opens onto a grey,
       name-less hero. It sets window.__opzHoldCurtain=true (before this file runs) and
       calls window.__opzRevealCurtain() the instant it's ready. */
    window.__opzRevealCurtain = reveal;
    var auto = function () { if (!window.__opzHoldCurtain) reveal(); };   // skip while a page is holding
    var kick = function () { setTimeout(auto, 40); };
    if (document.readyState === 'complete') kick();
    else window.addEventListener('load', kick, { once: true });
    setTimeout(auto, HOLD_MAX);      // normal safety — only fires if nobody is holding
    setTimeout(reveal, 4000);        // ABSOLUTE safety: never stay black > 4s, even if a holder never releases
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
