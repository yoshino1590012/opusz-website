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
     全部畫完覆蓋原圖 99.97%。中途露出來的筆尖是圓的＝像筆在寫。
     兩條中心線的做法見下方 v13 說明（合併區丟點→法線取中心→單一平滑曲線→兩端外插）。
     右線＝底部→外圈→停在碰到左線處；左線＝底部→穿過交會→內圈→中心。同時開始、同時結束。 */
  var D_SIL = 'M 1134 425 L 1131 425 L 1128 423 L 1122 422 L 1109 417 L 1105 417 L 1098 414 L 1047 404 L 1017 402 L 1016 401 L 968 401 L 967 402 L 944 403 L 943 404 L 925 406 L 900 411 L 867 420 L 833 433 L 801 449 L 798 452 L 791 455 L 788 458 L 779 463 L 748 487 L 722 512 L 702 535 L 680 567 L 668 589 L 651 628 L 651 631 L 645 646 L 645 650 L 640 666 L 640 671 L 638 675 L 637 685 L 635 690 L 633 710 L 632 711 L 632 735 L 631 736 L 632 774 L 633 775 L 635 796 L 637 801 L 638 812 L 651 856 L 657 871 L 671 898 L 690 926 L 704 943 L 720 959 L 744 979 L 768 995 L 806 1014 L 842 1026 L 846 1026 L 870 1032 L 876 1032 L 891 1035 L 954 1035 L 955 1036 L 938 1052 L 893 1101 L 867 1132 L 854 1149 L 851 1155 L 844 1163 L 822 1196 L 803 1228 L 803 1230 L 795 1243 L 784 1265 L 782 1272 L 778 1278 L 777 1283 L 775 1285 L 771 1297 L 766 1306 L 747 1362 L 747 1366 L 742 1382 L 742 1387 L 739 1396 L 731 1436 L 731 1444 L 730 1445 L 730 1451 L 727 1466 L 727 1476 L 725 1483 L 725 1497 L 724 1498 L 724 1511 L 723 1512 L 722 1600 L 796 1600 L 797 1515 L 798 1514 L 798 1505 L 799 1504 L 800 1481 L 801 1480 L 801 1473 L 802 1472 L 802 1465 L 803 1464 L 806 1439 L 811 1419 L 811 1415 L 813 1411 L 813 1407 L 815 1403 L 819 1384 L 826 1363 L 826 1360 L 844 1313 L 851 1300 L 851 1298 L 853 1296 L 853 1294 L 856 1290 L 865 1270 L 887 1233 L 892 1227 L 903 1209 L 933 1170 L 955 1144 L 991 1105 L 1102 996 L 1121 974 L 1145 941 L 1164 908 L 1176 880 L 1186 844 L 1189 819 L 1190 818 L 1190 810 L 1191 809 L 1191 767 L 1190 766 L 1186 736 L 1178 708 L 1174 701 L 1171 692 L 1156 666 L 1143 649 L 1119 625 L 1095 608 L 1078 599 L 1076 599 L 1074 597 L 1053 589 L 1034 584 L 1024 583 L 1018 581 L 991 580 L 990 581 L 973 581 L 936 588 L 916 595 L 900 603 L 885 612 L 871 623 L 858 635 L 842 655 L 833 669 L 825 685 L 820 699 L 815 719 L 815 728 L 814 729 L 814 738 L 813 739 L 813 756 L 814 757 L 815 775 L 817 780 L 818 788 L 823 802 L 830 816 L 843 834 L 859 850 L 877 863 L 892 870 L 903 874 L 922 878 L 952 878 L 975 873 L 997 863 L 1013 852 L 1027 838 L 1041 817 L 1045 808 L 1051 787 L 1051 778 L 1052 777 L 1051 760 L 1045 748 L 1037 740 L 1024 734 L 1004 734 L 993 739 L 985 746 L 980 754 L 976 768 L 976 775 L 972 787 L 962 797 L 955 801 L 945 804 L 926 803 L 918 800 L 908 794 L 900 786 L 891 770 L 888 758 L 888 737 L 894 715 L 898 706 L 905 695 L 922 678 L 935 669 L 961 658 L 982 654 L 1004 654 L 1005 655 L 1016 656 L 1037 662 L 1060 674 L 1073 684 L 1085 696 L 1100 717 L 1111 743 L 1117 773 L 1116 812 L 1112 831 L 1107 846 L 1099 864 L 1083 889 L 1057 916 L 1046 925 L 1024 938 L 1007 946 L 996 949 L 987 953 L 956 960 L 949 960 L 948 961 L 933 962 L 932 963 L 913 963 L 897 960 L 888 960 L 858 953 L 837 946 L 808 932 L 794 923 L 773 906 L 751 883 L 740 868 L 726 842 L 719 824 L 719 821 L 714 808 L 714 803 L 712 799 L 709 784 L 708 770 L 707 769 L 707 760 L 706 759 L 707 719 L 708 718 L 709 703 L 714 682 L 714 677 L 716 674 L 716 670 L 719 663 L 719 660 L 724 649 L 726 641 L 728 639 L 735 622 L 739 617 L 739 615 L 753 592 L 770 570 L 799 541 L 832 517 L 859 503 L 893 490 L 919 483 L 925 483 L 929 481 L 935 481 L 946 478 L 963 477 L 973 475 L 1014 475 L 1015 476 L 1041 478 L 1052 481 L 1057 481 L 1097 491 L 1136 506 L 1169 524 L 1194 541 L 1213 557 L 1233 577 L 1258 608 L 1269 625 L 1282 650 L 1291 672 L 1294 684 L 1296 687 L 1304 717 L 1304 723 L 1306 727 L 1306 733 L 1309 744 L 1309 755 L 1310 756 L 1311 776 L 1312 777 L 1312 822 L 1311 823 L 1311 833 L 1309 842 L 1309 855 L 1307 861 L 1306 872 L 1304 877 L 1304 883 L 1302 889 L 1301 899 L 1299 903 L 1299 907 L 1284 954 L 1279 964 L 1277 971 L 1274 975 L 1271 984 L 1265 995 L 1265 997 L 1244 1034 L 1241 1037 L 1226 1061 L 1211 1081 L 1204 1088 L 1199 1096 L 1164 1135 L 1159 1139 L 1131 1169 L 1092 1216 L 1072 1244 L 1054 1272 L 1026 1323 L 1026 1325 L 1021 1334 L 1021 1336 L 1019 1338 L 1008 1364 L 997 1399 L 995 1402 L 991 1420 L 989 1424 L 989 1429 L 987 1433 L 986 1443 L 981 1462 L 977 1495 L 976 1496 L 976 1506 L 975 1507 L 974 1527 L 973 1528 L 972 1600 L 1047 1600 L 1047 1546 L 1048 1545 L 1048 1529 L 1049 1528 L 1050 1508 L 1051 1507 L 1051 1499 L 1053 1490 L 1053 1481 L 1055 1476 L 1058 1457 L 1064 1437 L 1067 1421 L 1076 1395 L 1084 1378 L 1089 1364 L 1111 1322 L 1145 1270 L 1188 1218 L 1235 1169 L 1238 1164 L 1256 1145 L 1295 1093 L 1314 1063 L 1321 1049 L 1325 1044 L 1335 1024 L 1335 1022 L 1339 1016 L 1351 988 L 1352 983 L 1354 981 L 1357 969 L 1363 956 L 1369 931 L 1371 927 L 1371 922 L 1373 918 L 1373 913 L 1376 904 L 1380 877 L 1382 871 L 1384 844 L 1386 834 L 1387 779 L 1386 778 L 1386 762 L 1384 753 L 1382 728 L 1378 714 L 1378 708 L 1375 693 L 1373 689 L 1371 677 L 1369 673 L 1367 663 L 1365 660 L 1365 657 L 1363 654 L 1363 651 L 1351 622 L 1332 586 L 1313 557 L 1293 532 L 1261 500 L 1223 470 L 1199 455 L 1166 438 Z';
  var D_RIGHT = 'M 1005.4 1649.9 C 1005.4 1643.1 1005.1 1622.6 1005.3 1609.0 C 1005.4 1595.5 1005.9 1581.7 1006.6 1568.7 C 1007.3 1555.8 1008.2 1543.2 1009.4 1531.1 C 1010.6 1519.0 1011.9 1507.7 1013.6 1496.2 C 1015.3 1484.6 1017.3 1472.9 1019.5 1461.9 C 1021.7 1450.9 1024.0 1440.7 1026.7 1430.3 C 1029.4 1419.9 1032.3 1409.6 1035.6 1399.4 C 1038.8 1389.3 1042.7 1378.7 1046.3 1369.4 C 1049.9 1360.1 1053.4 1352.1 1057.4 1343.6 C 1061.3 1335.2 1065.7 1326.6 1070.0 1318.6 C 1074.4 1310.7 1078.5 1303.7 1083.3 1295.9 C 1088.2 1288.2 1090.4 1284.1 1099.1 1272.3 C 1107.8 1260.6 1116.4 1248.2 1135.4 1225.3 C 1154.5 1202.4 1195.0 1156.6 1213.3 1134.9 C 1231.6 1113.3 1235.1 1108.9 1245.3 1095.5 C 1255.5 1082.1 1265.8 1067.9 1274.5 1054.4 C 1283.2 1040.9 1291.7 1025.5 1297.6 1014.5 C 1303.6 1003.5 1306.1 997.6 1310.0 988.5 C 1314.0 979.4 1317.9 969.6 1321.4 960.0 C 1324.9 950.4 1328.1 940.7 1330.9 930.9 C 1333.7 921.1 1336.3 911.2 1338.4 901.3 C 1340.6 891.3 1342.5 881.3 1344.0 871.2 C 1345.6 861.1 1346.8 851.0 1347.6 840.8 C 1348.5 830.6 1349.0 820.1 1349.2 810.2 C 1349.4 800.3 1349.5 793.0 1348.8 781.5 C 1348.1 770.0 1346.9 754.3 1345.1 741.3 C 1343.3 728.3 1340.9 715.7 1338.1 703.6 C 1335.2 691.4 1331.9 680.0 1328.0 668.6 C 1324.1 657.1 1319.6 645.8 1314.5 634.8 C 1309.4 623.8 1303.6 613.0 1297.4 602.6 C 1291.1 592.2 1284.3 582.1 1276.9 572.4 C 1269.6 562.8 1261.5 553.2 1253.4 544.6 C 1245.3 536.0 1237.4 528.5 1228.4 520.9 C 1219.4 513.2 1209.5 505.6 1199.4 498.8 C 1189.4 492.0 1178.9 485.8 1168.1 480.1 C 1157.4 474.4 1146.2 469.3 1134.9 464.7 C 1123.6 460.2 1111.9 456.2 1100.1 452.8 C 1088.4 449.4 1076.7 446.5 1064.3 444.3 C 1051.9 442.0 1038.7 440.1 1025.8 439.1 C 1012.9 438.0 999.6 437.6 987.0 437.8 C 974.5 438.0 961.9 438.9 950.4 440.2 C 938.9 441.5 928.4 443.3 918.0 445.4 C 907.7 447.6 898.3 449.9 888.2 453.0 C 878.2 456.1 867.3 459.9 857.6 463.9 C 847.9 467.9 839.0 472.1 830.0 476.8 C 821.0 481.6 812.2 486.8 803.7 492.4 C 795.3 498.0 787.0 504.0 779.2 510.5 C 771.3 516.9 763.5 524.0 756.5 530.9 C 749.5 537.8 743.4 544.4 737.2 552.1 C 730.9 559.7 724.4 568.4 718.9 576.6 C 713.3 584.8 708.6 592.8 704.1 601.2 C 699.5 609.7 695.5 618.1 691.7 627.3 C 688.0 636.5 684.4 646.6 681.4 656.4 C 678.5 666.3 676.0 676.4 674.1 686.5 C 672.2 696.6 670.8 706.9 669.9 717.1 C 669.0 727.4 668.7 738.0 668.8 748.0 C 668.9 757.9 669.5 766.9 670.7 776.7 C 671.8 786.5 673.5 796.9 675.8 806.8 C 678.1 816.7 681.1 826.8 684.3 836.0 C 687.6 845.2 691.2 853.7 695.4 862.2 C 699.6 870.7 704.3 879.0 709.5 886.9 C 714.7 894.9 720.2 902.3 726.5 909.9 C 732.9 917.4 740.1 925.2 747.5 932.1 C 755.0 939.1 763.2 945.9 771.2 951.8 C 779.1 957.7 787.0 962.7 795.3 967.5 C 803.7 972.3 812.4 976.6 821.2 980.3 C 830.1 984.1 839.2 987.4 848.4 990.1 C 857.7 992.7 867.5 994.9 876.8 996.3 C 886.0 997.8 894.8 998.6 903.9 998.9 C 913.0 999.2 922.3 998.9 931.5 998.0 C 940.7 997.1 950.0 995.7 959.3 993.5 C 968.5 991.3 978.2 988.4 987.0 985.1 C 995.9 981.8 1008.3 975.6 1012.6 973.6';
  var D_LEFT = 'M 755.7 1635.2 C 755.8 1625.8 755.7 1596.9 756.2 1578.9 C 756.8 1560.8 757.6 1543.5 758.8 1526.9 C 760.1 1510.2 761.6 1494.5 763.5 1479.0 C 765.4 1463.4 767.7 1448.4 770.4 1433.7 C 773.0 1419.0 776.0 1404.9 779.4 1390.8 C 782.9 1376.7 786.9 1362.4 791.2 1349.1 C 795.4 1335.7 799.8 1323.4 804.8 1310.8 C 809.8 1298.2 815.8 1284.8 821.2 1273.5 C 826.7 1262.2 831.6 1252.9 837.4 1242.8 C 843.1 1232.6 849.0 1223.0 855.7 1212.7 C 862.4 1202.5 869.9 1191.7 877.6 1181.2 C 885.3 1170.7 889.5 1164.7 902.1 1149.6 C 914.8 1134.4 926.8 1119.5 953.6 1090.4 C 980.4 1061.3 1040.5 999.3 1063.1 975.0 C 1085.7 950.6 1081.7 953.8 1089.3 944.5 C 1097.0 935.2 1103.0 927.7 1109.2 919.0 C 1115.3 910.4 1121.3 901.4 1126.2 892.7 C 1131.2 884.0 1135.3 875.5 1138.9 866.8 C 1142.5 858.2 1145.5 849.7 1147.8 840.8 C 1150.2 832.0 1152.1 823.0 1153.2 813.9 C 1154.3 804.8 1154.8 795.6 1154.6 786.4 C 1154.4 777.3 1153.5 768.0 1152.0 759.0 C 1150.5 749.9 1148.4 740.9 1145.6 732.2 C 1142.8 723.5 1139.3 714.7 1135.4 706.8 C 1131.6 698.8 1127.3 691.5 1122.3 684.4 C 1117.4 677.4 1112.0 670.6 1106.0 664.4 C 1100.0 658.3 1093.3 652.4 1086.5 647.4 C 1079.7 642.4 1072.8 638.3 1065.2 634.5 C 1057.5 630.6 1049.2 627.1 1040.5 624.4 C 1031.9 621.7 1022.4 619.5 1013.1 618.2 C 1003.9 616.9 994.2 616.3 985.1 616.5 C 976.1 616.7 967.2 617.8 958.8 619.5 C 950.4 621.2 942.6 623.5 934.9 626.6 C 927.2 629.7 919.7 633.6 912.8 638.2 C 905.8 642.7 899.2 648.2 893.1 654.0 C 887.1 659.9 881.4 666.7 876.5 673.4 C 871.7 680.1 867.6 687.2 864.2 694.2 C 860.7 701.1 858.0 708.0 855.9 715.1 C 853.8 722.2 852.2 729.5 851.3 736.7 C 850.5 743.8 850.4 751.3 850.9 758.1 C 851.5 764.9 852.8 771.5 854.7 777.6 C 856.6 783.6 859.0 789.2 862.2 794.6 C 865.3 800.0 869.3 805.3 873.7 810.1 C 878.2 814.8 883.0 819.2 888.9 823.2 C 894.8 827.3 902.4 831.6 909.2 834.4 C 916.1 837.3 923.3 839.3 930.0 840.4 C 936.8 841.5 943.3 841.7 949.8 841.0 C 956.2 840.4 964.0 837.9 968.7 836.3 C 973.5 834.7 975.1 833.4 978.1 831.6 C 981.1 829.9 983.1 829.1 986.8 825.6 C 990.6 822.2 997.4 814.9 1000.6 810.9 C 1003.9 806.9 1004.7 804.5 1006.4 801.4 C 1008.0 798.3 1008.9 797.2 1010.3 792.3 C 1011.7 787.4 1013.9 775.3 1014.6 771.9';
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
    [['opzPfA', D_RIGHT], ['opzPfB', D_LEFT]].forEach(function (p) {
      var el = document.createElementNS(ns, 'path');
      el.setAttribute('id', p[0]); el.setAttribute('d', p[1]);
      el.setAttribute('pathLength', '1');
      el.setAttribute('stroke-dashoffset', '1');
      el.setAttribute('fill', 'none'); el.setAttribute('stroke', '#fff');
      el.setAttribute('stroke-width', '86');
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
