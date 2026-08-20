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
    + '.opz-pfmark mask path{stroke-dasharray:1}'
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

  /* 標誌動畫（v15）：**畫的是原圖本身** —— 一整塊精確輪廓（IoU 0.9955），
     用兩支「跟線差不多寬」的筆刷當遮罩掃出來。所以**輪廓永遠是 logo 自己的輪廓**：
     不會有圓頭端點頂出來的凸包，也不會有兩條線交叉造出來的折角（那是 v13/v14 純描線的毛病）。
     筆刷 86：比線寬 75 略寬，交會處才不會留下小 V；隔壁那圈的邊緣在 98px 外，碰不到。
     全部畫完覆蓋原圖 99.91%，交會處只差 65px。中途露出來的筆尖是圓的＝像筆在寫。
     兩條中心線的做法見下方 v13 說明（合併區丟點→法線取中心→單一平滑曲線→兩端外插）。
     右線＝底部→外圈→停在碰到左線處；左線＝底部→穿過交會→內圈→中心。同時開始、同時結束。 */
  var D_SIL = 'M 1134 425 L 1131 425 L 1128 423 L 1122 422 L 1109 417 L 1105 417 L 1098 414 L 1047 404 L 1017 402 L 1016 401 L 968 401 L 967 402 L 944 403 L 943 404 L 925 406 L 900 411 L 867 420 L 833 433 L 801 449 L 798 452 L 791 455 L 788 458 L 779 463 L 748 487 L 722 512 L 702 535 L 680 567 L 668 589 L 651 628 L 651 631 L 645 646 L 645 650 L 640 666 L 640 671 L 638 675 L 637 685 L 635 690 L 633 710 L 632 711 L 632 735 L 631 736 L 632 774 L 633 775 L 635 796 L 637 801 L 638 812 L 651 856 L 657 871 L 671 898 L 690 926 L 704 943 L 720 959 L 744 979 L 768 995 L 806 1014 L 842 1026 L 846 1026 L 870 1032 L 876 1032 L 891 1035 L 954 1035 L 955 1036 L 938 1052 L 893 1101 L 867 1132 L 854 1149 L 851 1155 L 844 1163 L 822 1196 L 803 1228 L 803 1230 L 795 1243 L 784 1265 L 782 1272 L 778 1278 L 777 1283 L 775 1285 L 771 1297 L 766 1306 L 747 1362 L 747 1366 L 742 1382 L 742 1387 L 739 1396 L 731 1436 L 731 1444 L 730 1445 L 730 1451 L 727 1466 L 727 1476 L 725 1483 L 725 1497 L 724 1498 L 724 1511 L 723 1512 L 722 1600 L 796 1600 L 797 1515 L 798 1514 L 798 1505 L 799 1504 L 800 1481 L 801 1480 L 801 1473 L 802 1472 L 802 1465 L 803 1464 L 806 1439 L 811 1419 L 811 1415 L 813 1411 L 813 1407 L 815 1403 L 819 1384 L 826 1363 L 826 1360 L 844 1313 L 851 1300 L 851 1298 L 853 1296 L 853 1294 L 856 1290 L 865 1270 L 887 1233 L 892 1227 L 903 1209 L 933 1170 L 955 1144 L 991 1105 L 1102 996 L 1121 974 L 1145 941 L 1164 908 L 1176 880 L 1186 844 L 1189 819 L 1190 818 L 1190 810 L 1191 809 L 1191 767 L 1190 766 L 1186 736 L 1178 708 L 1174 701 L 1171 692 L 1156 666 L 1143 649 L 1119 625 L 1095 608 L 1078 599 L 1076 599 L 1074 597 L 1053 589 L 1034 584 L 1024 583 L 1018 581 L 991 580 L 990 581 L 973 581 L 936 588 L 916 595 L 900 603 L 885 612 L 871 623 L 858 635 L 842 655 L 833 669 L 825 685 L 820 699 L 815 719 L 815 728 L 814 729 L 814 738 L 813 739 L 813 756 L 814 757 L 815 775 L 817 780 L 818 788 L 823 802 L 830 816 L 843 834 L 859 850 L 877 863 L 892 870 L 903 874 L 922 878 L 952 878 L 975 873 L 997 863 L 1013 852 L 1027 838 L 1041 817 L 1045 808 L 1051 787 L 1051 778 L 1052 777 L 1051 760 L 1045 748 L 1037 740 L 1024 734 L 1004 734 L 993 739 L 985 746 L 980 754 L 976 768 L 976 775 L 972 787 L 962 797 L 955 801 L 945 804 L 926 803 L 918 800 L 908 794 L 900 786 L 891 770 L 888 758 L 888 737 L 894 715 L 898 706 L 905 695 L 922 678 L 935 669 L 961 658 L 982 654 L 1004 654 L 1005 655 L 1016 656 L 1037 662 L 1060 674 L 1073 684 L 1085 696 L 1100 717 L 1111 743 L 1117 773 L 1116 812 L 1112 831 L 1107 846 L 1099 864 L 1083 889 L 1057 916 L 1046 925 L 1024 938 L 1007 946 L 996 949 L 987 953 L 956 960 L 949 960 L 948 961 L 933 962 L 932 963 L 913 963 L 897 960 L 888 960 L 858 953 L 837 946 L 808 932 L 794 923 L 773 906 L 751 883 L 740 868 L 726 842 L 719 824 L 719 821 L 714 808 L 714 803 L 712 799 L 709 784 L 708 770 L 707 769 L 707 760 L 706 759 L 707 719 L 708 718 L 709 703 L 714 682 L 714 677 L 716 674 L 716 670 L 719 663 L 719 660 L 724 649 L 726 641 L 728 639 L 735 622 L 739 617 L 739 615 L 753 592 L 770 570 L 799 541 L 832 517 L 859 503 L 893 490 L 919 483 L 925 483 L 929 481 L 935 481 L 946 478 L 963 477 L 973 475 L 1014 475 L 1015 476 L 1041 478 L 1052 481 L 1057 481 L 1097 491 L 1136 506 L 1169 524 L 1194 541 L 1213 557 L 1233 577 L 1258 608 L 1269 625 L 1282 650 L 1291 672 L 1294 684 L 1296 687 L 1304 717 L 1304 723 L 1306 727 L 1306 733 L 1309 744 L 1309 755 L 1310 756 L 1311 776 L 1312 777 L 1312 822 L 1311 823 L 1311 833 L 1309 842 L 1309 855 L 1307 861 L 1306 872 L 1304 877 L 1304 883 L 1302 889 L 1301 899 L 1299 903 L 1299 907 L 1284 954 L 1279 964 L 1277 971 L 1274 975 L 1271 984 L 1265 995 L 1265 997 L 1244 1034 L 1241 1037 L 1226 1061 L 1211 1081 L 1204 1088 L 1199 1096 L 1164 1135 L 1159 1139 L 1131 1169 L 1092 1216 L 1072 1244 L 1054 1272 L 1026 1323 L 1026 1325 L 1021 1334 L 1021 1336 L 1019 1338 L 1008 1364 L 997 1399 L 995 1402 L 991 1420 L 989 1424 L 989 1429 L 987 1433 L 986 1443 L 981 1462 L 977 1495 L 976 1496 L 976 1506 L 975 1507 L 974 1527 L 973 1528 L 972 1600 L 1047 1600 L 1047 1546 L 1048 1545 L 1048 1529 L 1049 1528 L 1050 1508 L 1051 1507 L 1051 1499 L 1053 1490 L 1053 1481 L 1055 1476 L 1058 1457 L 1064 1437 L 1067 1421 L 1076 1395 L 1084 1378 L 1089 1364 L 1111 1322 L 1145 1270 L 1188 1218 L 1235 1169 L 1238 1164 L 1256 1145 L 1295 1093 L 1314 1063 L 1321 1049 L 1325 1044 L 1335 1024 L 1335 1022 L 1339 1016 L 1351 988 L 1352 983 L 1354 981 L 1357 969 L 1363 956 L 1369 931 L 1371 927 L 1371 922 L 1373 918 L 1373 913 L 1376 904 L 1380 877 L 1382 871 L 1384 844 L 1386 834 L 1387 779 L 1386 778 L 1386 762 L 1384 753 L 1382 728 L 1378 714 L 1378 708 L 1375 693 L 1373 689 L 1371 677 L 1369 673 L 1367 663 L 1365 660 L 1365 657 L 1363 654 L 1363 651 L 1351 622 L 1332 586 L 1313 557 L 1293 532 L 1261 500 L 1223 470 L 1199 455 L 1166 438 Z';
  var D_RIGHT = 'M 1009.3 1644.4 C 1009.5 1628.2 1009.7 1567.9 1010.1 1547.1 C 1010.5 1526.2 1010.7 1530.6 1011.7 1519.5 C 1012.7 1508.5 1014.1 1493.9 1016.1 1480.9 C 1018.1 1467.8 1021.8 1451.0 1023.8 1441.3 C 1025.9 1431.7 1026.3 1430.5 1028.4 1422.9 C 1030.5 1415.3 1033.9 1403.8 1036.5 1395.8 C 1039.2 1387.8 1040.8 1383.3 1044.4 1374.7 C 1047.9 1366.0 1053.1 1353.7 1057.8 1343.8 C 1062.5 1334.0 1066.4 1326.3 1072.4 1315.6 C 1078.4 1305.0 1086.6 1290.9 1093.5 1280.0 C 1100.4 1269.0 1108.3 1257.8 1113.8 1249.9 C 1119.4 1242.1 1119.3 1242.1 1126.7 1233.1 C 1134.0 1224.0 1145.3 1209.9 1157.9 1195.8 C 1170.5 1181.7 1190.9 1160.9 1202.2 1148.7 C 1213.5 1136.4 1218.9 1129.9 1225.5 1122.1 C 1232.0 1114.4 1235.9 1109.6 1241.4 1102.4 C 1247.0 1095.2 1252.7 1087.7 1258.8 1078.9 C 1264.8 1070.1 1271.7 1059.9 1277.8 1049.7 C 1284.0 1039.6 1290.9 1026.9 1295.7 1017.8 C 1300.5 1008.8 1302.9 1003.9 1306.7 995.4 C 1310.5 987.0 1315.1 976.1 1318.6 967.1 C 1322.0 958.2 1324.8 950.4 1327.5 941.9 C 1330.2 933.4 1332.6 924.4 1334.6 916.1 C 1336.7 907.7 1338.1 901.5 1339.9 891.8 C 1341.8 882.1 1344.2 869.3 1345.6 857.9 C 1347.1 846.5 1348.1 835.4 1348.8 823.6 C 1349.5 811.8 1350.1 800.9 1349.6 787.2 C 1349.1 773.5 1347.3 754.3 1345.6 741.2 C 1344.0 728.2 1342.2 720.0 1339.8 709.1 C 1337.4 698.1 1335.0 687.5 1331.1 675.6 C 1327.3 663.7 1321.4 648.5 1316.9 637.9 C 1312.3 627.3 1307.7 619.2 1303.9 612.1 C 1300.1 605.1 1297.5 601.0 1294.0 595.6 C 1290.6 590.2 1288.1 586.4 1283.1 579.8 C 1278.0 573.2 1270.9 563.7 1263.8 555.9 C 1256.8 548.0 1250.0 540.8 1241.0 532.6 C 1232.0 524.5 1220.5 514.8 1210.0 507.0 C 1199.5 499.3 1187.2 491.8 1177.9 486.3 C 1168.5 480.7 1163.4 478.1 1154.0 473.8 C 1144.7 469.6 1133.8 464.7 1122.0 460.6 C 1110.2 456.5 1095.6 452.4 1083.1 449.2 C 1070.6 446.1 1059.4 443.8 1047.0 441.9 C 1034.5 440.0 1020.3 438.6 1008.4 438.0 C 996.5 437.3 986.1 437.5 975.4 438.1 C 964.8 438.6 956.1 439.4 944.6 441.1 C 933.2 442.8 917.7 445.7 906.8 448.1 C 895.9 450.6 888.7 452.6 879.1 455.8 C 869.4 459.0 857.7 463.4 848.7 467.3 C 839.6 471.2 833.0 474.4 824.6 479.0 C 816.3 483.6 806.7 489.4 798.6 495.0 C 790.5 500.5 783.8 505.6 775.8 512.4 C 767.9 519.3 758.2 528.6 750.9 536.2 C 743.7 543.8 738.1 550.3 732.2 557.9 C 726.3 565.4 720.8 573.3 715.7 581.4 C 710.6 589.5 706.4 596.3 701.5 606.4 C 696.7 616.5 690.3 631.3 686.4 641.8 C 682.5 652.3 680.4 660.2 678.1 669.5 C 675.7 678.9 673.7 690.0 672.3 698.0 C 670.9 705.9 670.4 710.4 669.8 717.1 C 669.2 723.9 668.7 730.9 668.6 738.3 C 668.5 745.7 668.5 752.2 669.2 761.4 C 670.0 770.6 671.2 783.1 673.2 793.7 C 675.1 804.4 677.6 814.9 680.7 825.2 C 683.7 835.5 688.0 847.2 691.5 855.6 C 695.1 864.1 697.3 868.3 701.8 876.0 C 706.3 883.6 712.4 893.4 718.6 901.5 C 724.7 909.7 731.5 917.5 738.7 924.7 C 745.9 932.0 754.0 939.0 761.8 945.1 C 769.6 951.2 777.9 956.8 785.5 961.5 C 793.1 966.2 799.4 969.5 807.5 973.3 C 815.6 977.1 824.5 981.0 834.1 984.2 C 843.8 987.5 854.6 990.6 865.6 992.9 C 876.6 995.2 889.1 997.1 900.1 998.1 C 911.1 999.1 922.0 999.1 931.6 998.8 C 941.3 998.6 949.5 998.2 957.8 996.7 C 966.1 995.3 973.3 993.1 981.6 990.2 C 989.9 987.3 1003.3 981.3 1007.7 979.5';
  var D_LEFT = 'M 758.6 1631.3 C 758.7 1618.5 758.7 1569.7 758.9 1554.2 C 759.1 1538.6 759.8 1543.7 760.0 1537.8 C 760.2 1531.9 759.6 1526.9 759.9 1518.9 C 760.3 1510.8 760.8 1502.7 762.3 1489.5 C 763.7 1476.4 765.7 1456.8 768.5 1439.9 C 771.4 1423.1 776.1 1402.8 779.6 1388.2 C 783.1 1373.6 786.0 1364.1 789.6 1352.6 C 793.3 1341.1 796.5 1331.4 801.5 1319.0 C 806.5 1306.7 813.8 1290.4 819.5 1278.3 C 825.2 1266.2 829.7 1257.5 835.9 1246.4 C 842.1 1235.3 850.4 1221.8 856.7 1211.8 C 863.0 1201.8 865.6 1197.4 873.6 1186.5 C 881.5 1175.6 893.1 1159.9 904.3 1146.2 C 915.6 1132.4 927.1 1119.1 941.0 1104.0 C 955.0 1088.8 967.7 1077.7 987.8 1055.4 C 1007.9 1033.1 1044.6 989.0 1061.6 970.3 C 1078.6 951.7 1081.4 952.8 1090.1 943.5 C 1098.8 934.1 1107.1 923.6 1113.7 914.3 C 1120.4 904.9 1125.6 895.6 1130.1 887.3 C 1134.5 879.0 1137.2 873.0 1140.3 864.6 C 1143.4 856.2 1146.6 845.2 1148.7 837.0 C 1150.7 828.8 1151.7 821.0 1152.6 815.1 C 1153.4 809.3 1153.7 809.3 1153.9 802.1 C 1154.1 795.0 1154.0 779.2 1153.7 772.0 C 1153.4 764.8 1153.5 766.0 1152.1 758.9 C 1150.7 751.9 1148.4 738.8 1145.4 729.5 C 1142.4 720.2 1137.3 709.7 1134.2 703.0 C 1131.0 696.4 1130.1 694.8 1126.5 689.4 C 1122.9 684.1 1116.5 675.9 1112.3 670.9 C 1108.1 666.0 1106.3 664.1 1101.5 659.8 C 1096.6 655.5 1089.2 649.5 1083.2 645.3 C 1077.1 641.0 1072.2 637.9 1065.1 634.5 C 1058.0 631.0 1049.4 627.2 1040.5 624.4 C 1031.6 621.7 1019.5 619.4 1011.8 618.2 C 1004.1 616.9 999.8 617.2 994.5 617.2 C 989.2 617.1 986.6 616.9 979.9 617.7 C 973.2 618.6 962.1 620.3 954.1 622.2 C 946.0 624.1 939.0 626.4 931.8 629.4 C 924.6 632.4 917.4 636.1 910.9 640.2 C 904.5 644.3 897.5 650.3 893.1 654.0 C 888.6 657.7 887.3 659.3 884.4 662.4 C 881.4 665.6 878.8 668.1 875.5 672.7 C 872.3 677.3 867.4 685.2 864.7 689.9 C 862.1 694.6 861.2 697.0 859.6 700.9 C 858.0 704.9 856.6 707.8 855.2 713.5 C 853.8 719.3 851.8 727.9 851.1 735.3 C 850.4 742.7 850.4 750.8 851.0 758.1 C 851.6 765.3 853.2 772.9 854.8 778.8 C 856.5 784.8 858.2 788.4 861.2 793.8 C 864.2 799.1 868.7 806.1 872.8 811.0 C 876.8 815.9 880.6 819.5 885.5 823.3 C 890.4 827.0 897.1 831.0 902.1 833.5 C 907.0 835.9 911.2 837.0 915.1 838.2 C 919.1 839.4 920.3 840.1 925.9 840.5 C 931.4 840.9 941.9 841.2 948.4 840.6 C 954.9 840.0 960.2 838.1 964.7 836.7 C 969.2 835.2 972.3 833.5 975.3 832.0 C 978.4 830.4 980.6 829.0 983.2 827.3 C 985.7 825.6 988.2 823.8 990.5 821.7 C 992.9 819.7 994.9 817.6 997.1 815.0 C 999.3 812.5 1001.7 809.1 1003.6 806.2 C 1005.5 803.3 1006.6 802.6 1008.3 797.6 C 1009.9 792.5 1012.8 779.6 1013.7 776.0';
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
    /* 兩條的筆刷寬度差很多，都是量出來的：
       **左線 77**＝線寬 75 + 對中誤差 2×0.75。筆刷只要比線寬明顯大，經過兩帶交會處時
       露出來的寬度就會從 75 變成筆刷寬 → 邊緣出現一小段「斷層」（v16 用 82 就是這個毛病）。
       77 讓露出寬度全程維持 73~78 ＝ 等寬。
       **右線 180**＝它只在最後一刻才抵達交會處，那裡原圖本來就寬到 127，
       筆刷要夠寬才能把接口完全填滿（實測未填只剩 1px；用 95 會留 375px 的小缺口）。
       在抵達交會處之前它露出的寬度都 ≤82，不會變胖，也碰不到隔壁那圈。 */
    [['opzPfA', D_RIGHT, '180'], ['opzPfB', D_LEFT, '77']].forEach(function (p) {
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
