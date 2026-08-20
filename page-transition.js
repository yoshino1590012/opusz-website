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
     圖形切成兩塊（合起來等於原圖）：**左塊＝離左中心線 38px 以內的等寬帶**、右塊＝其餘。
     ⚠️ 兩條帶子在交會處是「相切合併」的，骨架在那一小段會偏離左帶的真正中心（跑到合併塊中間），
     中心線因此有個 S 形抖動 → 帶子跟著抖 → 動畫中看起來就像線斷掉又接上一塊。
     解法：中心線先做 Gaussian 平滑(sigma=15) 再切帶子，左線才會是乾淨的等寬帶。
     每一塊各自被自己那條線的粗筆刷掃出來 → 一條線只會畫自己那半，不會去碰到另一條。
     分工（Martin 定的）：**右線＝外圈**（底部 → 繞完外圈 → 停在「碰到左線」的轉角），
     **左線＝內圈**（底部 → 轉角 → 內圈 → 中心）。兩條加起來剛好蓋滿整個標誌，不重疊也不遺漏。
     兩條**同時開始、同 duration、同曲線** → 右線路程較長所以跑得快，
     **兩條同一格結束，而且結束的位置就是它們交會的轉角** → 動畫在「碰到」的瞬間收尾。
     （試過角度同步：直的莖幾乎不改角度、最裡面小捲角度暴衝，兩端都會卡，別再試。）
     筆刷 110：線寬 75 要蓋滿（92 在交會處會留下細縫），而從中心線到隔壁那圈的邊緣有 98px，
     所以 110 還碰不到隔壁圈。實測覆蓋原圖 99.98%%。
     畫完直接把遮罩拿掉，確保最終狀態是完整無缺的標誌。 */
  var D_SIL_R = 'M 796 1549 L 795 1549 L 792 1568 L 788 1580 L 783 1590 L 777 1597 L 776 1600 L 796 1600 Z M 818 1390 L 817 1390 L 815 1400 Z M 977 763 L 978 764 L 980 758 L 986 750 L 997 741 L 1010 738 L 1018 738 L 1031 741 L 1042 750 L 1048 758 L 1051 775 L 1052 775 L 1051 760 L 1045 748 L 1037 740 L 1024 734 L 1004 734 L 993 739 L 982 750 Z M 825 685 L 820 699 L 815 719 L 815 728 L 814 729 L 814 738 L 813 739 L 813 756 L 814 757 L 815 775 L 821 797 L 830 816 L 843 834 L 859 850 L 877 863 L 903 874 L 922 878 L 952 878 L 975 873 L 997 863 L 1013 852 L 1027 838 L 1042 815 L 1049 795 L 1051 782 L 1050 782 L 1048 794 L 1044 800 L 1043 805 L 1041 807 L 1037 817 L 1024 836 L 1010 850 L 999 858 L 987 864 L 975 868 L 944 874 L 929 874 L 928 873 L 922 873 L 902 869 L 886 864 L 874 858 L 850 839 L 838 824 L 827 805 L 821 786 L 816 761 L 816 750 L 815 749 L 816 731 L 817 730 L 821 704 L 827 684 L 834 670 L 834 668 L 837 665 L 837 663 Z M 850 645 L 840 659 L 844 655 L 844 653 L 847 651 L 847 649 L 850 647 Z M 1138 644 L 1138 646 L 1143 651 L 1159 673 L 1169 691 L 1180 721 L 1181 730 L 1186 750 L 1188 775 L 1189 776 L 1189 804 L 1188 805 L 1188 815 L 1187 816 L 1185 835 L 1178 867 L 1164 903 L 1133 950 L 1115 971 L 1082 1004 L 1057 1024 L 1032 1041 L 1026 1047 L 1012 1077 L 997 1097 L 997 1099 L 1102 996 L 1121 974 L 1145 941 L 1156 923 L 1165 906 L 1179 871 L 1180 864 L 1183 856 L 1183 852 L 1186 844 L 1189 819 L 1190 818 L 1190 810 L 1191 809 L 1191 767 L 1190 766 L 1188 746 L 1186 741 L 1186 736 L 1183 728 L 1182 720 L 1171 692 L 1156 666 Z M 1107 617 L 1111 621 L 1113 621 L 1115 624 L 1117 624 L 1121 629 L 1123 629 Z M 1100 612 L 1103 615 L 1105 615 Z M 888 611 L 885 612 L 874 621 L 876 621 L 878 618 L 880 618 L 882 615 L 884 615 Z M 986 581 L 973 581 L 949 586 L 944 586 L 921 593 L 913 597 L 941 588 L 967 583 L 986 582 Z M 990 581 L 1025 584 L 1045 589 L 1049 589 L 1075 598 L 1056 590 L 1034 584 L 1024 583 L 1018 581 L 1000 581 L 999 580 L 991 580 Z M 968 401 L 967 402 L 944 403 L 931 406 L 925 406 L 884 415 L 845 428 L 818 441 L 816 441 L 814 443 L 801 449 L 798 452 L 791 455 L 760 477 L 737 497 L 712 523 L 691 550 L 672 581 L 663 602 L 659 608 L 657 616 L 651 628 L 651 631 L 645 646 L 645 650 L 640 666 L 640 671 L 638 675 L 637 685 L 635 690 L 633 710 L 632 711 L 632 735 L 631 736 L 632 774 L 633 775 L 635 796 L 637 801 L 638 812 L 643 827 L 645 838 L 657 871 L 671 898 L 690 926 L 704 943 L 728 966 L 744 979 L 768 995 L 795 1009 L 797 1009 L 799 1011 L 825 1021 L 859 1030 L 890 1034 L 891 1035 L 948 1035 L 956 1016 L 972 994 L 984 983 L 1000 971 L 1016 961 L 1032 948 L 1068 911 L 1081 893 L 1081 891 L 1057 916 L 1046 925 L 1018 941 L 1016 941 L 1007 946 L 976 956 L 956 960 L 933 962 L 932 963 L 913 963 L 897 960 L 888 960 L 858 953 L 837 946 L 808 932 L 794 923 L 773 906 L 758 891 L 745 875 L 734 858 L 726 842 L 714 808 L 714 803 L 712 799 L 709 784 L 707 760 L 706 759 L 706 730 L 707 729 L 709 703 L 714 682 L 714 677 L 716 674 L 716 670 L 719 663 L 719 660 L 724 649 L 726 641 L 728 639 L 735 622 L 739 617 L 739 615 L 749 598 L 765 576 L 805 536 L 832 517 L 866 500 L 884 493 L 907 486 L 946 478 L 963 477 L 973 475 L 1014 475 L 1015 476 L 1041 478 L 1052 481 L 1057 481 L 1097 491 L 1127 502 L 1152 514 L 1154 516 L 1156 516 L 1190 538 L 1213 557 L 1233 577 L 1250 597 L 1273 632 L 1287 662 L 1299 697 L 1299 701 L 1304 717 L 1304 723 L 1306 727 L 1306 733 L 1309 744 L 1309 755 L 1310 756 L 1311 776 L 1312 777 L 1312 822 L 1311 823 L 1311 833 L 1309 842 L 1309 855 L 1307 861 L 1306 872 L 1304 877 L 1304 883 L 1302 889 L 1301 899 L 1299 903 L 1299 907 L 1284 954 L 1279 964 L 1277 971 L 1274 975 L 1271 984 L 1265 995 L 1265 997 L 1244 1034 L 1241 1037 L 1226 1061 L 1186 1111 L 1131 1169 L 1102 1203 L 1064 1256 L 1033 1309 L 1021 1334 L 1021 1336 L 1019 1338 L 1003 1378 L 989 1424 L 989 1429 L 987 1433 L 987 1438 L 979 1474 L 979 1481 L 976 1496 L 975 1515 L 974 1516 L 973 1559 L 972 1560 L 972 1600 L 1047 1600 L 1047 1546 L 1048 1545 L 1048 1529 L 1049 1528 L 1050 1508 L 1051 1507 L 1051 1499 L 1053 1490 L 1053 1481 L 1055 1476 L 1058 1457 L 1064 1437 L 1067 1421 L 1076 1395 L 1084 1378 L 1089 1364 L 1111 1322 L 1145 1270 L 1188 1218 L 1235 1169 L 1238 1164 L 1256 1145 L 1295 1093 L 1314 1063 L 1321 1049 L 1325 1044 L 1335 1024 L 1335 1022 L 1339 1016 L 1351 988 L 1352 983 L 1354 981 L 1357 969 L 1363 956 L 1369 931 L 1371 927 L 1371 922 L 1373 918 L 1373 913 L 1376 904 L 1380 877 L 1382 871 L 1384 844 L 1386 834 L 1386 815 L 1387 814 L 1386 762 L 1384 753 L 1382 728 L 1378 714 L 1378 708 L 1375 693 L 1373 689 L 1371 677 L 1369 673 L 1367 663 L 1365 660 L 1365 657 L 1363 654 L 1363 651 L 1351 622 L 1340 600 L 1326 576 L 1304 545 L 1281 519 L 1253 493 L 1223 470 L 1188 449 L 1157 434 L 1147 431 L 1134 425 L 1122 422 L 1119 420 L 1085 411 L 1060 406 L 1041 404 L 1040 403 L 1029 403 L 1028 402 L 1017 402 L 1016 401 Z';
  var D_SIL_L = 'M 1053 589 L 1021 582 L 991 580 L 990 581 L 973 581 L 949 586 L 944 586 L 916 595 L 885 612 L 858 635 L 836 664 L 825 685 L 822 694 L 815 729 L 814 751 L 815 752 L 815 763 L 820 788 L 826 807 L 831 817 L 843 834 L 857 848 L 872 859 L 884 865 L 900 870 L 920 874 L 926 874 L 927 875 L 953 874 L 973 870 L 989 865 L 1004 857 L 1012 851 L 1025 838 L 1038 819 L 1042 809 L 1044 807 L 1045 802 L 1048 798 L 1051 787 L 1051 778 L 1052 777 L 1052 769 L 1049 756 L 1043 748 L 1033 740 L 1015 736 L 995 740 L 985 748 L 978 759 L 976 768 L 976 775 L 972 787 L 965 795 L 955 801 L 945 804 L 930 804 L 923 802 L 908 794 L 900 786 L 891 770 L 888 758 L 888 737 L 891 727 L 891 723 L 898 706 L 905 695 L 922 678 L 935 669 L 961 658 L 982 654 L 1004 654 L 1005 655 L 1016 656 L 1028 659 L 1044 665 L 1060 674 L 1073 684 L 1085 696 L 1095 709 L 1097 714 L 1100 717 L 1109 737 L 1114 754 L 1116 772 L 1117 773 L 1117 803 L 1116 804 L 1116 812 L 1114 818 L 1114 823 L 1107 846 L 1099 864 L 1083 889 L 1076 896 L 1067 909 L 1030 947 L 1014 960 L 998 970 L 982 982 L 966 998 L 955 1014 L 951 1025 L 946 1035 L 954 1035 L 955 1036 L 938 1052 L 908 1084 L 876 1121 L 854 1149 L 853 1152 L 844 1163 L 811 1214 L 784 1265 L 782 1272 L 778 1278 L 777 1283 L 775 1285 L 771 1297 L 766 1306 L 747 1362 L 747 1366 L 742 1382 L 742 1387 L 739 1396 L 731 1436 L 731 1444 L 730 1445 L 730 1451 L 727 1466 L 727 1476 L 725 1483 L 725 1497 L 724 1498 L 724 1511 L 723 1512 L 722 1600 L 778 1600 L 784 1592 L 789 1582 L 793 1570 L 796 1555 L 797 1515 L 798 1514 L 800 1481 L 801 1480 L 802 1465 L 804 1457 L 804 1450 L 811 1415 L 813 1411 L 813 1407 L 815 1403 L 819 1384 L 827 1357 L 844 1313 L 851 1300 L 851 1298 L 853 1296 L 854 1292 L 857 1288 L 859 1282 L 861 1280 L 862 1276 L 864 1274 L 865 1270 L 887 1233 L 892 1227 L 903 1209 L 933 1170 L 975 1122 L 1004 1092 L 1013 1079 L 1027 1049 L 1034 1042 L 1059 1025 L 1084 1005 L 1116 973 L 1130 957 L 1140 944 L 1140 942 L 1146 935 L 1165 905 L 1179 869 L 1186 837 L 1188 818 L 1189 817 L 1190 774 L 1189 773 L 1187 748 L 1182 728 L 1181 719 L 1171 692 L 1160 672 L 1148 655 L 1129 634 L 1119 625 L 1104 614 L 1086 603 L 1084 603 L 1074 597 Z';
  var D_MAIN = 'M 990 1581 C 992 1579 999 1572 1002 1567 C 1005 1562 1006 1568 1009 1551 C 1012 1534 1015 1489 1020 1465 C 1024 1441 1030 1421 1035 1404 C 1039 1387 1043 1378 1049 1364 C 1055 1350 1062 1335 1070 1320 C 1078 1305 1087 1290 1096 1276 C 1106 1262 1116 1248 1127 1234 C 1137 1220 1144 1212 1159 1195 C 1175 1178 1204 1147 1219 1129 C 1235 1111 1241 1103 1251 1089 C 1261 1075 1271 1060 1281 1044 C 1290 1028 1299 1012 1306 996 C 1313 980 1319 966 1324 950 C 1329 934 1333 918 1337 901 C 1341 884 1343 866 1345 849 C 1347 832 1348 812 1348 796 C 1348 780 1347 769 1346 756 C 1344 743 1342 729 1340 717 C 1338 705 1336 695 1333 684 C 1329 673 1326 662 1321 651 C 1317 640 1312 630 1307 620 C 1302 610 1297 600 1290 591 C 1284 582 1277 572 1269 563 C 1262 554 1254 546 1246 538 C 1237 530 1228 522 1219 515 C 1210 507 1201 501 1191 495 C 1181 488 1170 482 1160 477 C 1150 472 1139 468 1128 464 C 1117 459 1104 455 1092 452 C 1080 449 1068 446 1055 444 C 1042 442 1030 441 1017 440 C 1004 439 992 439 980 439 C 968 440 958 441 947 442 C 936 443 926 445 916 447 C 906 449 894 452 884 455 C 874 458 864 461 855 465 C 846 469 836 474 827 478 C 818 483 810 488 802 494 C 794 499 786 505 778 511 C 770 518 763 524 756 531 C 749 538 742 546 736 554 C 730 562 723 571 718 579 C 712 587 708 595 703 604 C 699 613 695 622 691 631 C 688 640 684 650 682 660 C 679 670 677 678 675 689 C 673 700 672 712 671 723 C 670 734 670 742 670 752 C 671 762 672 773 673 783 C 674 793 676 803 678 812 C 680 821 683 830 686 839 C 689 848 693 856 697 864 C 700 872 705 880 709 887 C 714 894 719 901 725 908 C 730 915 737 922 743 928 C 750 934 757 940 764 946 C 771 951 778 956 785 960 C 792 964 799 968 806 971 C 813 975 822 979 830 981 C 838 984 842 986 854 989 C 866 991 884 995 905 997 C 926 999 967 998 982 999 C 998 1000 995 1002 998 1003 C 1001 1004 1000 1005 1000 1005';
  var D_STEM = 'M 747 1574 C 748 1572 752 1567 754 1563 C 756 1559 756 1566 758 1549 C 760 1531 764 1481 766 1459 C 769 1437 771 1431 773 1418 C 776 1405 776 1400 781 1383 C 786 1366 793 1341 802 1319 C 811 1297 823 1271 833 1253 C 842 1235 848 1226 857 1212 C 866 1198 876 1184 886 1170 C 896 1156 903 1148 918 1131 C 932 1114 960 1085 974 1067 C 987 1049 992 1032 998 1023 C 1004 1014 1002 1018 1009 1012 C 1017 1007 1034 995 1042 989 C 1051 982 1054 980 1061 972 C 1069 965 1080 954 1088 945 C 1096 936 1104 927 1110 919 C 1116 911 1120 904 1124 897 C 1128 890 1132 882 1136 874 C 1139 866 1142 858 1144 850 C 1146 842 1148 834 1149 825 C 1150 816 1151 805 1151 795 C 1152 785 1151 775 1150 766 C 1149 757 1148 748 1146 739 C 1144 730 1141 722 1138 714 C 1134 706 1130 698 1126 691 C 1121 684 1116 677 1110 670 C 1104 664 1098 658 1092 653 C 1085 648 1079 643 1071 639 C 1063 635 1055 631 1046 628 C 1037 625 1027 623 1018 622 C 1009 620 1000 620 990 620 C 980 620 969 621 960 623 C 951 625 943 627 935 630 C 927 633 920 636 913 641 C 906 645 899 651 893 656 C 886 662 880 669 876 675 C 871 681 868 687 865 693 C 862 699 860 705 858 712 C 857 719 855 728 854 735 C 854 742 854 749 854 756 C 855 763 856 771 858 777 C 860 783 862 789 865 795 C 868 800 871 806 875 810 C 879 815 883 819 888 822 C 894 826 900 829 906 831 C 912 834 920 835 927 836 C 934 837 941 837 948 836 C 955 835 963 833 969 831 C 975 829 979 827 983 823 C 988 820 992 816 995 812 C 999 808 1002 804 1005 797 C 1008 791 1012 779 1014 775';
  var VBOX = '611 381 796 1239';
  function mountMark() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', VBOX);
    svg.setAttribute('class', 'opz-pfmark');
    svg.setAttribute('aria-hidden', 'true');
    var defs = document.createElementNS(ns, 'defs');
    /* 兩塊各有自己的遮罩：右線只能畫右半、左線只能畫左半。
       （共用一個遮罩的話，左線經過交會處時筆刷會順便把外圈的根部露出來，
         看起來就像線斷掉又接上一塊 —— Martin 抓到的就是這個。） */
    [['opzPfMaskA', 'opzPfA', D_MAIN], ['opzPfMaskB', 'opzPfB', D_STEM]].forEach(function (m) {
      var mask = document.createElementNS(ns, 'mask');
      mask.setAttribute('id', m[0]);
      mask.setAttribute('maskUnits', 'userSpaceOnUse');
      mask.setAttribute('x', '611'); mask.setAttribute('y', '381');
      mask.setAttribute('width', '796'); mask.setAttribute('height', '1239');
      var el = document.createElementNS(ns, 'path');
      el.setAttribute('id', m[1]); el.setAttribute('d', m[2]);
      el.setAttribute('pathLength', '1');
      el.setAttribute('stroke-dashoffset', '1');
      el.setAttribute('fill', 'none'); el.setAttribute('stroke', '#fff');
      el.setAttribute('stroke-width', '110');
      el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
      mask.appendChild(el); defs.appendChild(mask);
    });
    svg.appendChild(defs);
    [['opzPfShapeA', D_SIL_R, 'opzPfMaskA'], ['opzPfShapeB', D_SIL_L, 'opzPfMaskB']].forEach(function (sp) {
      var shape = document.createElementNS(ns, 'path');
      shape.setAttribute('id', sp[0]);
      shape.setAttribute('d', sp[1]);
      shape.setAttribute('fill', '#fff');
      shape.setAttribute('mask', 'url(#' + sp[2] + ')');
      svg.appendChild(shape);
    });
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
      ['opzPfShapeA', 'opzPfShapeB'].forEach(function (id) {
        var sh = document.getElementById(id); if (sh) sh.removeAttribute('mask');
      });
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
