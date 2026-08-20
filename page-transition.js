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
     再用兩條沿著中心線的粗筆刷當遮罩掃過去 → 看起來就是被畫出來，但形狀 100% 是原 logo。
     分工（Martin 定的）：**右線＝外圈**（底部 → 繞完外圈 → 停在「碰到左線」的轉角），
     **左線＝內圈**（底部 → 轉角 → 內圈 → 中心）。兩條加起來剛好蓋滿整個標誌，不重疊也不遺漏。
     兩條**同時開始、同 duration、同曲線** → 右線路程較長所以跑得快，
     **兩條同一格結束，而且結束的位置就是它們交會的轉角** → 動畫在「碰到」的瞬間收尾。
     （試過角度同步：直的莖幾乎不改角度、最裡面小捲角度暴衝，兩端都會卡，別再試。）
     筆刷 110：線寬 75 要蓋滿（92 在交會處會留下細縫），而從中心線到隔壁那圈的邊緣有 98px，
     所以 110 還碰不到隔壁圈。實測覆蓋原圖 99.98%%。
     畫完直接把遮罩拿掉，確保最終狀態是完整無缺的標誌。 */
  var D_SIL = 'M 1134 425 L 1131 425 L 1128 423 L 1122 422 L 1109 417 L 1105 417 L 1098 414 L 1047 404 L 1017 402 L 1016 401 L 968 401 L 967 402 L 944 403 L 943 404 L 925 406 L 900 411 L 867 420 L 833 433 L 801 449 L 798 452 L 791 455 L 788 458 L 779 463 L 748 487 L 722 512 L 702 535 L 680 567 L 668 589 L 651 628 L 651 631 L 645 646 L 645 650 L 640 666 L 640 671 L 638 675 L 637 685 L 635 690 L 633 710 L 632 711 L 632 735 L 631 736 L 632 774 L 633 775 L 635 796 L 637 801 L 638 812 L 651 856 L 657 871 L 671 898 L 690 926 L 704 943 L 720 959 L 744 979 L 768 995 L 806 1014 L 842 1026 L 846 1026 L 870 1032 L 876 1032 L 891 1035 L 954 1035 L 955 1036 L 938 1052 L 893 1101 L 867 1132 L 854 1149 L 851 1155 L 844 1163 L 822 1196 L 803 1228 L 803 1230 L 795 1243 L 784 1265 L 782 1272 L 778 1278 L 777 1283 L 775 1285 L 771 1297 L 766 1306 L 747 1362 L 747 1366 L 742 1382 L 742 1387 L 739 1396 L 731 1436 L 731 1444 L 730 1445 L 730 1451 L 727 1466 L 727 1476 L 725 1483 L 725 1497 L 724 1498 L 724 1511 L 723 1512 L 722 1600 L 796 1600 L 797 1515 L 798 1514 L 798 1505 L 799 1504 L 800 1481 L 801 1480 L 801 1473 L 802 1472 L 802 1465 L 803 1464 L 806 1439 L 811 1419 L 811 1415 L 813 1411 L 813 1407 L 815 1403 L 819 1384 L 826 1363 L 826 1360 L 844 1313 L 851 1300 L 851 1298 L 853 1296 L 853 1294 L 856 1290 L 865 1270 L 887 1233 L 892 1227 L 903 1209 L 933 1170 L 955 1144 L 991 1105 L 1102 996 L 1121 974 L 1145 941 L 1164 908 L 1176 880 L 1186 844 L 1189 819 L 1190 818 L 1190 810 L 1191 809 L 1191 767 L 1190 766 L 1186 736 L 1178 708 L 1174 701 L 1171 692 L 1156 666 L 1143 649 L 1119 625 L 1095 608 L 1078 599 L 1076 599 L 1074 597 L 1053 589 L 1034 584 L 1024 583 L 1018 581 L 991 580 L 990 581 L 973 581 L 936 588 L 916 595 L 900 603 L 885 612 L 871 623 L 858 635 L 842 655 L 833 669 L 825 685 L 820 699 L 815 719 L 815 728 L 814 729 L 814 738 L 813 739 L 813 756 L 814 757 L 815 775 L 817 780 L 818 788 L 823 802 L 830 816 L 843 834 L 859 850 L 877 863 L 892 870 L 903 874 L 922 878 L 952 878 L 975 873 L 997 863 L 1013 852 L 1027 838 L 1041 817 L 1045 808 L 1051 787 L 1051 778 L 1052 777 L 1051 760 L 1045 748 L 1037 740 L 1024 734 L 1004 734 L 993 739 L 985 746 L 980 754 L 976 768 L 976 775 L 972 787 L 962 797 L 955 801 L 945 804 L 926 803 L 918 800 L 908 794 L 900 786 L 891 770 L 888 758 L 888 737 L 894 715 L 898 706 L 905 695 L 922 678 L 935 669 L 961 658 L 982 654 L 1004 654 L 1005 655 L 1016 656 L 1037 662 L 1060 674 L 1073 684 L 1085 696 L 1100 717 L 1111 743 L 1117 773 L 1116 812 L 1112 831 L 1107 846 L 1099 864 L 1083 889 L 1057 916 L 1046 925 L 1024 938 L 1007 946 L 996 949 L 987 953 L 956 960 L 949 960 L 948 961 L 933 962 L 932 963 L 913 963 L 897 960 L 888 960 L 858 953 L 837 946 L 808 932 L 794 923 L 773 906 L 751 883 L 740 868 L 726 842 L 719 824 L 719 821 L 714 808 L 714 803 L 712 799 L 709 784 L 708 770 L 707 769 L 707 760 L 706 759 L 707 719 L 708 718 L 709 703 L 714 682 L 714 677 L 716 674 L 716 670 L 719 663 L 719 660 L 724 649 L 726 641 L 728 639 L 735 622 L 739 617 L 739 615 L 753 592 L 770 570 L 799 541 L 832 517 L 859 503 L 893 490 L 919 483 L 925 483 L 929 481 L 935 481 L 946 478 L 963 477 L 973 475 L 1014 475 L 1015 476 L 1041 478 L 1052 481 L 1057 481 L 1097 491 L 1136 506 L 1169 524 L 1194 541 L 1213 557 L 1233 577 L 1258 608 L 1269 625 L 1282 650 L 1291 672 L 1294 684 L 1296 687 L 1304 717 L 1304 723 L 1306 727 L 1306 733 L 1309 744 L 1309 755 L 1310 756 L 1311 776 L 1312 777 L 1312 822 L 1311 823 L 1311 833 L 1309 842 L 1309 855 L 1307 861 L 1306 872 L 1304 877 L 1304 883 L 1302 889 L 1301 899 L 1299 903 L 1299 907 L 1284 954 L 1279 964 L 1277 971 L 1274 975 L 1271 984 L 1265 995 L 1265 997 L 1244 1034 L 1241 1037 L 1226 1061 L 1211 1081 L 1204 1088 L 1199 1096 L 1164 1135 L 1159 1139 L 1131 1169 L 1092 1216 L 1072 1244 L 1054 1272 L 1026 1323 L 1026 1325 L 1021 1334 L 1021 1336 L 1019 1338 L 1008 1364 L 997 1399 L 995 1402 L 991 1420 L 989 1424 L 989 1429 L 987 1433 L 986 1443 L 981 1462 L 977 1495 L 976 1496 L 976 1506 L 975 1507 L 974 1527 L 973 1528 L 972 1600 L 1047 1600 L 1047 1546 L 1048 1545 L 1048 1529 L 1049 1528 L 1050 1508 L 1051 1507 L 1051 1499 L 1053 1490 L 1053 1481 L 1055 1476 L 1058 1457 L 1064 1437 L 1067 1421 L 1076 1395 L 1084 1378 L 1089 1364 L 1111 1322 L 1145 1270 L 1188 1218 L 1235 1169 L 1238 1164 L 1256 1145 L 1295 1093 L 1314 1063 L 1321 1049 L 1325 1044 L 1335 1024 L 1335 1022 L 1339 1016 L 1351 988 L 1352 983 L 1354 981 L 1357 969 L 1363 956 L 1369 931 L 1371 927 L 1371 922 L 1373 918 L 1373 913 L 1376 904 L 1380 877 L 1382 871 L 1384 844 L 1386 834 L 1387 779 L 1386 778 L 1386 762 L 1384 753 L 1382 728 L 1378 714 L 1378 708 L 1375 693 L 1373 689 L 1371 677 L 1369 673 L 1367 663 L 1365 660 L 1365 657 L 1363 654 L 1363 651 L 1351 622 L 1332 586 L 1313 557 L 1293 532 L 1261 500 L 1223 470 L 1199 455 L 1166 438 Z';
  var D_MAIN = 'M 990 1581 C 993 1578 1006 1577 1010 1563 C 1014 1549 1013 1508 1014 1496 C 1015 1484 1016 1494 1016 1491 C 1016 1488 1016 1486 1017 1477 C 1018 1468 1021 1453 1024 1440 C 1027 1427 1032 1411 1035 1400 C 1038 1389 1039 1386 1044 1374 C 1049 1362 1057 1343 1065 1328 C 1073 1313 1080 1299 1091 1283 C 1102 1267 1115 1248 1128 1231 C 1141 1214 1157 1197 1170 1182 C 1183 1167 1194 1158 1208 1143 C 1222 1128 1240 1106 1252 1089 C 1264 1072 1273 1059 1282 1043 C 1291 1027 1301 1007 1307 995 C 1313 983 1314 979 1318 969 C 1322 959 1326 945 1329 936 C 1332 927 1333 922 1335 914 C 1337 906 1338 895 1339 890 C 1340 885 1341 888 1341 886 C 1341 884 1340 879 1341 876 C 1342 873 1343 873 1344 866 C 1345 859 1346 850 1347 836 C 1348 822 1348 796 1348 780 C 1348 764 1347 757 1345 743 C 1343 729 1341 714 1337 697 C 1333 680 1324 657 1319 643 C 1314 629 1310 622 1304 612 C 1298 602 1291 591 1285 582 C 1279 573 1273 566 1266 558 C 1259 550 1252 542 1244 535 C 1236 528 1228 521 1220 514 C 1212 507 1201 500 1193 495 C 1185 490 1182 487 1171 482 C 1160 477 1143 468 1129 463 C 1115 458 1101 454 1087 450 C 1073 446 1059 444 1046 442 C 1033 440 1023 440 1011 439 C 999 438 986 438 974 439 C 962 440 950 441 940 442 C 930 443 926 444 916 446 C 906 448 887 453 878 456 C 869 459 871 458 861 462 C 851 466 828 477 817 483 C 806 489 802 493 794 498 C 786 503 780 508 772 515 C 764 522 750 536 744 543 C 738 550 739 549 734 555 C 729 561 722 570 716 580 C 710 590 702 606 697 615 C 692 624 691 627 688 637 C 685 647 680 665 677 675 C 674 685 674 686 673 697 C 672 708 669 728 669 744 C 669 760 672 782 673 790 C 674 798 674 790 675 794 C 676 798 676 808 678 815 C 680 822 681 828 684 836 C 687 844 692 856 696 865 C 700 874 705 882 710 890 C 715 898 719 903 725 910 C 731 917 740 926 746 932 C 752 938 758 942 764 947 C 770 952 774 954 781 959 C 788 964 801 970 809 974 C 817 978 820 979 829 982 C 838 985 850 989 860 991 C 870 993 877 995 888 996 C 899 997 914 998 927 999 C 940 1000 958 999 969 999 C 980 999 987 996 992 997 C 997 998 999 1004 1000 1005';
  var D_STEM = 'M 747 1574 C 749 1572 757 1572 759 1563 C 761 1554 760 1528 760 1519 C 760 1510 761 1517 762 1509 C 763 1501 762 1487 764 1471 C 766 1455 771 1424 773 1414 C 775 1404 774 1415 775 1410 C 776 1405 778 1391 780 1384 C 782 1377 784 1375 786 1368 C 788 1361 789 1352 792 1344 C 795 1336 796 1332 802 1317 C 808 1302 820 1274 830 1256 C 840 1238 850 1222 860 1206 C 870 1190 882 1175 893 1160 C 904 1145 913 1134 928 1118 C 943 1102 969 1080 981 1062 C 993 1044 995 1017 999 1007 C 1003 997 1001 1004 1003 1003 C 1005 1002 1004 1004 1010 1001 C 1016 998 1033 989 1042 983 C 1051 977 1058 973 1066 966 C 1074 959 1084 951 1091 943 C 1098 935 1105 927 1111 919 C 1117 911 1123 901 1127 894 C 1131 887 1133 883 1136 876 C 1139 869 1142 862 1144 854 C 1146 846 1148 842 1149 831 C 1150 820 1153 804 1153 789 C 1153 774 1150 753 1148 742 C 1146 731 1145 728 1142 721 C 1139 714 1136 706 1132 699 C 1128 692 1125 687 1120 680 C 1115 673 1108 665 1100 658 C 1092 651 1083 644 1074 639 C 1065 634 1053 629 1044 626 C 1035 623 1027 622 1020 621 C 1013 620 1009 619 1003 619 C 997 619 994 618 985 619 C 976 620 958 622 952 623 C 946 624 952 624 949 625 C 946 626 939 626 933 629 C 927 632 917 636 911 640 C 905 644 902 646 896 651 C 890 656 883 663 878 669 C 873 675 870 680 867 686 C 864 692 860 697 858 707 C 856 717 852 735 852 748 C 852 761 856 776 858 784 C 860 792 860 791 862 795 C 864 799 866 803 870 808 C 874 813 880 819 885 823 C 890 827 893 830 901 832 C 909 834 924 837 932 838 C 940 839 943 838 950 837 C 957 836 967 834 973 832 C 979 830 984 827 988 824 C 992 821 995 818 998 814 C 1001 810 1002 808 1004 803 C 1006 798 1008 789 1010 785 C 1012 781 1013 781 1014 779 C 1015 777 1014 776 1014 775';
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
      el.setAttribute('stroke-dashoffset', '1');
      el.setAttribute('fill', 'none'); el.setAttribute('stroke', '#fff');
      el.setAttribute('stroke-width', '110');
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
    }, 120 + DRAW + 40);
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
