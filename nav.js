/* ============================================================================
 * nav.js — Shared OPUS.Z navigation component (single-file, no build step)
 * ----------------------------------------------------------------------------
 * Injects the global nav (orb, logo, nav-links, favourites, login/account,
 * language toggle, hamburger drawer, sub-drawer, mega menu) into any page and
 * wires ALL of its behaviour. The markup + logic are ported verbatim from the
 * homepage musician-platform.html (lines 2102–2341, plus the i18n / favourites
 * / drawer / mega-menu / login-account-auth sections) so every page shares one
 * identical nav.
 *
 * HOW TO INCLUDE on a content page
 * --------------------------------
 *   1. In <head>:   <link rel="stylesheet" href="nav.css">
 *   2. (optional) BEFORE nav.js, define the page's own content dictionary:
 *          <script>window.PAGE_I18N = { en:{...}, zh:{...} };</script>
 *      Each value keyed by the data-i18n / data-i18n-html / data-i18n-ph token.
 *   3. Right after <body>, load this file with a PLAIN (non-defer) tag:
 *          <body>
 *          <script src="nav.js"></script>
 *
 * nav.js owns language switching for the whole page: it merges its built-in
 * NAV-only dictionary with window.PAGE_I18N and applies both, persists the
 * chosen language in localStorage('opusz_lang'), exposes window._currentLang
 * and window.applyLang(lang), and fires a CustomEvent('opusz:langchange') on
 * document so pages can react if they need to re-render anything custom.
 *
 * Auth localStorage keys (preserved exactly from homepage):
 *   opusz_user        — display name when a customer is logged in
 *   opusz_user_email  — that customer's email
 * Favourites localStorage key:
 *   mono-favs         — JSON array; its .length drives the heart badge count
 * ==========================================================================*/
(function () {
  'use strict';

  /* ── Guard against double-injection ───────────────────────────────────── */
  if (document.getElementById('navOrbFixed')) return;

  /* ── Nav markup (musician-platform.html lines 2102–2341) ──────────────────
     Only change vs. source: the four Home links point to
     "musician-platform.html#home" instead of "#home" so Home works on every
     page. All other links are unchanged. ────────────────────────────────── */
  var NAV_HTML = [
'<!-- Orb: no blend mode, stays red -->',
'<a href="musician-platform.html#home" id="navOrbFixed" aria-hidden="true" tabindex="-1">',
'  <div class="orb"></div>',
'</a>',
'<!-- Logo text: own stacking context with mix-blend-mode:difference -->',
'<a href="musician-platform.html#home" id="navLogoFixed">',
'  <div class="nav-logo-text">',
'    <span class="nav-logo-name" data-tid="nav-logo">OPUS.Z</span>',
'    <span class="nav-logo-sub">MUSIC</span>',
'  </div>',
'</a>',
'',
'<!-- NAV -->',
'<nav class="nav-on-light">',
'  <span class="nav-logo-spacer"></span>',
'  <ul class="nav-links">',
'    <li><a href="musician-platform.html#home" data-i18n="nav.home">Home</a></li>',
'    <li><a href="blog.html" data-i18n="nav.discover">Blog</a></li>',
'    <li id="artists-nav-item"><a href="musicians.html" data-i18n="nav.artists">Musicians</a></li>',
'    <li><a href="recent-jobs.html" data-i18n="nav.jobs">Recent Jobs</a></li>',
'    <li><a href="shows.html"   data-i18n="nav.news">Shows</a></li>',
'    <li><a href="lessons.html" data-i18n="nav.lessons">Lessons</a></li>',
'  </ul>',
'',
'  <div class="nav-right">',
'    <!-- Favourites Button -->',
'    <button class="nav-fav-btn" id="navFavBtn" aria-label="Favourites" title="My Favourites">',
'      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
'    </button>',
'    <!-- Login Button (shown when logged out) -->',
'    <button class="nav-login-btn" id="navLoginBtn" aria-label="Log in">',
'      <span class="login-label">Log in</span>',
'      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>',
'    </button>',
'    <!-- My Account Button (shown when logged in) -->',
'    <button class="nav-login-btn nav-account-btn" id="navAccountBtn" aria-label="My Account" style="display:none">',
'      <span class="account-name" id="navAccountName" data-i18n="nav.account">My Account</span>',
'      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>',
'    </button>',
'    <button class="lang-toggle" id="langToggle" aria-label="Switch language">',
'      <span class="lt-opt active" data-l="en">EN</span>',
'      <span class="lt-sep">/</span>',
'      <span class="lt-opt" data-l="zh">中文</span>',
'    </button>',
'    <div class="hamburger" id="hamburgerBtn"><span></span><span></span></div>',
'  </div>',
'</nav>',
'',
'<!-- Fav count badge — outside nav to escape mix-blend-mode -->',
'<span id="navFavBadge" style="display:none">0</span>',
'',
'  <!-- Login Dropdown (outside nav to escape mix-blend-mode) -->',
'  <div class="nav-login-dropdown" id="loginDropdown">',
'    <a href="customer-login.html" id="openCustomerLogin" data-i18n="login.customer">Customer login</a>',
'    <div class="nav-login-vsep"></div>',
'    <a href="musician-login.html" id="openMusicianLogin" data-i18n="login.musician">Musician login</a>',
'  </div>',
'',
'  <!-- My Account Dropdown (outside nav to escape mix-blend-mode) -->',
'  <div class="nav-login-dropdown acc-menu" id="accountDropdown">',
'    <div id="navAccEmail" style="padding:9px 14px 9px;font-size:12px;color:#999;border-bottom:1px solid #eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;"></div>',
'    <a href="musician-dashboard.html" class="acct-mus" data-i18n="acct.dashboard" style="display:none;font-weight:700;">Go to Dashboard</a>',
'    <div class="nav-login-vsep acct-mus" style="display:none"></div>',
'    <a href="customer-profile.html#messages" class="acct-cust" style="font-weight:700;"><span data-i18n="acct.messages">Messages</span> <span class="nav-msg-badge" id="dropMsgBadge" style="display:none;background:#e05;color:#fff;border-radius:50px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:auto;">0</span></a>',
'    <div class="nav-login-vsep acct-cust"></div>',
'    <a href="customer-profile.html#bookings" class="acct-cust" data-i18n="acct.bookings">My Bookings</a>',
'    <div class="nav-login-vsep acct-cust"></div>',
'    <a href="customer-profile.html" class="acct-cust" data-i18n="acct.profile">My Profile</a>',
'    <div class="nav-login-vsep acct-cust"></div>',
'    <a href="#" id="navLogoutBtn" style="color:#c00" data-i18n="acct.logout">Log Out</a>',
'  </div>',
'',
'  <!-- MEGA MENU -->',
'  <div class="mega-menu" id="artistsMegaMenu">',
'    <div class="mega-col">',
'      <a class="mega-col-title" href="musicians.html?cat=strings" data-i18n="menu.strings">Strings</a>',
'      <ul>',
'        <li><a href="musicians.html?cat=violin"     data-i18n="menu.violin">Violin</a></li>',
'        <li><a href="musicians.html?cat=viola"      data-i18n="menu.viola">Viola</a></li>',
'        <li><a href="musicians.html?cat=cello"      data-i18n="menu.cello">Cello</a></li>',
'        <li><a href="musicians.html?cat=doublebass" data-i18n="menu.doublebass">Double Bass</a></li>',
'        <li><a href="musicians.html?cat=harp"       data-i18n="menu.harp">Harp</a></li>',
'      </ul>',
'    </div>',
'    <div class="mega-col">',
'      <a class="mega-col-title" href="musicians.html?cat=woodwinds" data-i18n="menu.woodwinds">Woodwinds</a>',
'      <ul>',
'        <li><a href="musicians.html?cat=flute"      data-i18n="menu.flute">Flute</a></li>',
'        <li><a href="musicians.html?cat=piccolo"    data-i18n="menu.piccolo">Piccolo</a></li>',
'        <li><a href="musicians.html?cat=oboe"       data-i18n="menu.oboe">Oboe</a></li>',
'        <li><a href="musicians.html?cat=clarinet"   data-i18n="menu.clarinet">Clarinet</a></li>',
'        <li><a href="musicians.html?cat=saxophone"  data-i18n="menu.saxophone">Saxophone</a></li>',
'        <li><a href="musicians.html?cat=bassoon"    data-i18n="menu.bassoon">Bassoon</a></li>',
'      </ul>',
'    </div>',
'    <div class="mega-col">',
'      <a class="mega-col-title" href="musicians.html?cat=brass" data-i18n="menu.brass">Brass</a>',
'      <ul>',
'        <li><a href="musicians.html?cat=frenchhorn" data-i18n="menu.frenchhorn">French Horn</a></li>',
'        <li><a href="musicians.html?cat=trumpet"    data-i18n="menu.trumpet">Trumpet</a></li>',
'        <li><a href="musicians.html?cat=trombone"   data-i18n="menu.trombone">Trombone</a></li>',
'        <li><a href="musicians.html?cat=euphonium"  data-i18n="menu.euphonium">Euphonium</a></li>',
'        <li><a href="musicians.html?cat=tuba"       data-i18n="menu.tuba">Tuba</a></li>',
'      </ul>',
'    </div>',
'    <div class="mega-col">',
'      <a class="mega-col-title" href="musicians.html?cat=percussion" data-i18n="menu.percussion">Percussion</a>',
'      <ul>',
'        <li><a href="musicians.html?cat=timpani"    data-i18n="menu.timpani">Timpani</a></li>',
'        <li><a href="musicians.html?cat=marimba"    data-i18n="menu.marimba">Marimba</a></li>',
'        <li><a href="musicians.html?cat=vibraphone" data-i18n="menu.vibraphone">Vibraphone</a></li>',
'        <li><a href="musicians.html?cat=xylophone"  data-i18n="menu.xylophone">Xylophone</a></li>',
'      </ul>',
'    </div>',
'    <div class="mega-col">',
'      <a class="mega-col-title" href="musicians.html?cat=keyboard" data-i18n="menu.keyboard">Keyboard</a>',
'      <ul>',
'        <li><a href="musicians.html?cat=piano"      data-i18n="menu.piano">Piano</a></li>',
'        <li><a href="musicians.html?cat=collabpiano" data-i18n="menu.collabpiano">Collaborative Piano</a></li>',
'        <li><a href="musicians.html?cat=pipeorgan"  data-i18n="menu.pipeorgan">Pipe Organ</a></li>',
'      </ul>',
'    </div>',
'    <div class="mega-col">',
'      <a class="mega-col-title" href="musicians.html?cat=voice" data-i18n="menu.voice">Voice</a>',
'      <ul>',
'        <li><a href="musicians.html?cat=soprano"      data-i18n="menu.soprano">Soprano</a></li>',
'        <li><a href="musicians.html?cat=mezzosoprano" data-i18n="menu.mezzosoprano">Mezzo-soprano</a></li>',
'        <li><a href="musicians.html?cat=tenor"        data-i18n="menu.tenor">Tenor</a></li>',
'        <li><a href="musicians.html?cat=baritone"     data-i18n="menu.baritone">Baritone</a></li>',
'        <li><a href="musicians.html?cat=choral"       data-i18n="menu.choral">Choral</a></li>',
'      </ul>',
'    </div>',
'    <div class="mega-col">',
'      <a class="mega-col-title" href="musicians.html?cat=chamber" data-i18n="menu.chamber">Chamber</a>',
'      <ul>',
'        <li><a href="musicians.html?cat=stringquartet" data-i18n="menu.stringquartet">String Quartet</a></li>',
'        <li><a href="musicians.html?cat=pianotrio"     data-i18n="menu.pianotrio">Piano Trio</a></li>',
'        <li><a href="musicians.html?cat=stringtrio"    data-i18n="menu.stringtrio">String Trio</a></li>',
'        <li><a href="musicians.html?cat=windquintet"   data-i18n="menu.windquintet">Wind Quintet</a></li>',
'        <li><a href="musicians.html?cat=brassquintet"  data-i18n="menu.brassquintet">Brass Quintet</a></li>',
'        <li><a href="musicians.html?cat=pianoquintet"  data-i18n="menu.pianoquintet">Piano Quintet</a></li>',
'      </ul>',
'    </div>',
'    <div class="mega-col">',
'      <a class="mega-col-title" href="musicians.html" data-i18n="menu.all">All</a>',
'      <ul>',
'        <li><a href="musicians.html"                    data-i18n="menu.allmusicians">All Musicians</a></li>',
'        <li><a href="musicians.html?cat=strings"        data-i18n="menu.strings">Strings</a></li>',
'        <li><a href="musicians.html?cat=woodwinds"      data-i18n="menu.woodwinds">Woodwinds</a></li>',
'        <li><a href="musicians.html?cat=brass"          data-i18n="menu.brass">Brass</a></li>',
'        <li><a href="musicians.html?cat=voice"          data-i18n="menu.voice">Voice</a></li>',
'        <li><a href="musicians.html?cat=chamber"        data-i18n="menu.chamber">Chamber</a></li>',
'        <li><a href="musicians.html?cat=conductor"      data-i18n="menu.conductor">Conductor</a></li><li><a href="musicians.html?cat=tuner" data-i18n="menu.tuner">Tuner</a></li>',
'      </ul>',
'    </div>',
'  </div>',
'',
'<!-- Slide-in nav drawer -->',
'<div class="nav-drawer" id="navDrawer">',
'  <a href="musician-platform.html#home" data-i18n="nav.home">Home</a>',
'  <a href="blog.html" data-i18n="nav.discover">Blog</a>',
'  <button class="nd-musicians-btn" id="ndMusiciansBtn">',
'    <span data-i18n="nav.artists">Musicians</span>',
'    <span class="nd-arrow">›</span>',
'  </button>',
'  <a href="recent-jobs.html" data-i18n="nav.jobs">Recent Jobs</a>',
'  <a href="shows.html" data-i18n="nav.news">Shows</a>',
'  <a href="lessons.html" data-i18n="nav.lessons">Lessons</a>',
'</div>',
'',
'<!-- Musicians sub-drawer -->',
'<div class="nav-sub-drawer" id="navSubDrawer">',
'  <div class="nsd-head">',
'    <button class="nsd-back" id="nsdBack">‹</button>',
'    <div class="nsd-title" data-i18n="nav.artists">Musicians</div>',
'  </div>',
'  <div class="nsd-body">',
'    <div class="nsd-group">',
'      <div class="nsd-group-title" data-i18n="menu.strings">Strings</div>',
'      <a href="musicians.html?cat=violin"      data-i18n="menu.violin">Violin</a>',
'      <a href="musicians.html?cat=viola"       data-i18n="menu.viola">Viola</a>',
'      <a href="musicians.html?cat=cello"       data-i18n="menu.cello">Cello</a>',
'      <a href="musicians.html?cat=doublebass"  data-i18n="menu.doublebass">Double Bass</a>',
'      <a href="musicians.html?cat=harp"        data-i18n="menu.harp">Harp</a>',
'    </div>',
'    <div class="nsd-group">',
'      <div class="nsd-group-title" data-i18n="menu.woodwinds">Woodwinds</div>',
'      <a href="musicians.html?cat=flute"       data-i18n="menu.flute">Flute</a>',
'      <a href="musicians.html?cat=piccolo"     data-i18n="menu.piccolo">Piccolo</a>',
'      <a href="musicians.html?cat=oboe"        data-i18n="menu.oboe">Oboe</a>',
'      <a href="musicians.html?cat=clarinet"    data-i18n="menu.clarinet">Clarinet</a>',
'      <a href="musicians.html?cat=saxophone"   data-i18n="menu.saxophone">Saxophone</a>',
'      <a href="musicians.html?cat=bassoon"     data-i18n="menu.bassoon">Bassoon</a>',
'    </div>',
'    <div class="nsd-group">',
'      <div class="nsd-group-title" data-i18n="menu.brass">Brass</div>',
'      <a href="musicians.html?cat=frenchhorn"  data-i18n="menu.frenchhorn">French Horn</a>',
'      <a href="musicians.html?cat=trumpet"     data-i18n="menu.trumpet">Trumpet</a>',
'      <a href="musicians.html?cat=trombone"    data-i18n="menu.trombone">Trombone</a>',
'      <a href="musicians.html?cat=euphonium"   data-i18n="menu.euphonium">Euphonium</a>',
'      <a href="musicians.html?cat=tuba"        data-i18n="menu.tuba">Tuba</a>',
'    </div>',
'    <div class="nsd-group">',
'      <div class="nsd-group-title" data-i18n="menu.percussion">Percussion</div>',
'      <a href="musicians.html?cat=timpani"     data-i18n="menu.timpani">Timpani</a>',
'      <a href="musicians.html?cat=marimba"     data-i18n="menu.marimba">Marimba</a>',
'      <a href="musicians.html?cat=vibraphone"  data-i18n="menu.vibraphone">Vibraphone</a>',
'      <a href="musicians.html?cat=xylophone"   data-i18n="menu.xylophone">Xylophone</a>',
'    </div>',
'    <div class="nsd-group">',
'      <div class="nsd-group-title" data-i18n="menu.keyboard">Keyboard</div>',
'      <a href="musicians.html?cat=piano"       data-i18n="menu.piano">Piano</a>',
'      <a href="musicians.html?cat=collabpiano" data-i18n="menu.collabpiano">Collaborative Piano</a>',
'      <a href="musicians.html?cat=pipeorgan"   data-i18n="menu.pipeorgan">Pipe Organ</a>',
'    </div>',
'    <div class="nsd-group">',
'      <div class="nsd-group-title" data-i18n="menu.voice">Voice</div>',
'      <a href="musicians.html?cat=soprano"     data-i18n="menu.soprano">Soprano</a>',
'      <a href="musicians.html?cat=mezzosoprano"data-i18n="menu.mezzosoprano">Mezzo-soprano</a>',
'      <a href="musicians.html?cat=tenor"       data-i18n="menu.tenor">Tenor</a>',
'      <a href="musicians.html?cat=baritone"    data-i18n="menu.baritone">Baritone</a>',
'      <a href="musicians.html?cat=choral"      data-i18n="menu.choral">Choral</a>',
'    </div>',
'    <div class="nsd-group">',
'      <div class="nsd-group-title" data-i18n="menu.chamber">Chamber</div>',
'      <a href="musicians.html?cat=stringquartet" data-i18n="menu.stringquartet">String Quartet</a>',
'      <a href="musicians.html?cat=pianotrio"      data-i18n="menu.pianotrio">Piano Trio</a>',
'      <a href="musicians.html?cat=stringtrio"     data-i18n="menu.stringtrio">String Trio</a>',
'      <a href="musicians.html?cat=windquintet"    data-i18n="menu.windquintet">Wind Quintet</a>',
'      <a href="musicians.html?cat=brassquintet"   data-i18n="menu.brassquintet">Brass Quintet</a>',
'      <a href="musicians.html?cat=pianoquintet"   data-i18n="menu.pianoquintet">Piano Quintet</a>',
'    </div>',
'    <div class="nsd-group">',
'      <div class="nsd-group-title" data-i18n="menu.all">All</div>',
'      <a href="musicians.html"                    data-i18n="menu.allmusicians">All Musicians</a>',
'      <a href="musicians.html?cat=conductor"      data-i18n="menu.conductor">Conductor</a>',
'      <a href="musicians.html?cat=tuner"          data-i18n="menu.tuner">Tuner</a>',
'    </div>',
'  </div>',
'</div>'
  ].join('\n');

  /* ── NAV-ONLY i18n dictionary (extracted from homepage I18N, ~2952) ────────
     Contains only nav.* / menu.* / login.* keys used by the shared nav. ───── */
  var NAV_I18N = {
    en: {
      'nav.home':'Home','nav.discover':'Blog','nav.artists':'Musicians',
      'nav.artists_short':'Musicians','nav.news':'Shows','nav.contact':'Contact','nav.lessons':'Lessons',
      'nav.jobs':'Recent Jobs','nav.account':'My Account',
      'acct.messages':'Messages','acct.bookings':'My Bookings','acct.profile':'My Profile','acct.logout':'Log Out','acct.dashboard':'Go to Dashboard',
      'login.customer':'Customer login','login.musician':'Musician login',
      'login.email':'Email','login.password':'Password',
      'login.btn':'Log in','login.noAccount':'No account?','login.signup':'Sign up →',
      'menu.strings':'Strings','menu.woodwinds':'Woodwinds','menu.brass':'Brass',
      'menu.percussion':'Percussion','menu.keyboard':'Keyboard','menu.voice':'Voice',
      'menu.chamber':'Chamber','menu.all':'All','menu.allmusicians':'All Musicians',
      'menu.violin':'Violin','menu.viola':'Viola','menu.cello':'Cello',
      'menu.doublebass':'Double Bass','menu.harp':'Harp',
      'menu.flute':'Flute','menu.piccolo':'Piccolo','menu.oboe':'Oboe',
      'menu.clarinet':'Clarinet','menu.saxophone':'Saxophone','menu.bassoon':'Bassoon',
      'menu.frenchhorn':'French Horn','menu.trumpet':'Trumpet','menu.trombone':'Trombone',
      'menu.euphonium':'Euphonium','menu.tuba':'Tuba',
      'menu.timpani':'Timpani','menu.marimba':'Marimba','menu.vibraphone':'Vibraphone','menu.xylophone':'Xylophone',
      'menu.piano':'Piano','menu.collabpiano':'Collaborative Piano','menu.pipeorgan':'Pipe Organ',
      'menu.soprano':'Soprano','menu.mezzosoprano':'Mezzo-soprano','menu.tenor':'Tenor',
      'menu.baritone':'Baritone','menu.choral':'Choral','menu.conductor':'Conductor','menu.tuner':'Tuner',
      'menu.stringquartet':'String Quartet','menu.pianotrio':'Piano Trio','menu.stringtrio':'String Trio',
      'menu.windquintet':'Wind Quintet','menu.brassquintet':'Brass Quintet','menu.pianoquintet':'Piano Quintet'
    },
    zh: {
      'nav.home':'首頁','nav.discover':'部落格','nav.artists':'音樂家',
      'nav.artists_short':'音樂家','nav.news':'近期演出','nav.contact':'聯絡我們','nav.lessons':'音樂老師',
      'nav.jobs':'近期委託','nav.account':'我的帳號',
      'acct.messages':'訊息','acct.bookings':'我的委託','acct.profile':'我的檔案','acct.logout':'登出','acct.dashboard':'前往後台',
      'login.customer':'客戶登入','login.musician':'樂手登入',
      'login.email':'電郵地址','login.password':'密碼',
      'login.btn':'登入','login.noAccount':'還沒有帳號？','login.signup':'立即註冊 →',
      'menu.strings':'弦樂','menu.woodwinds':'木管','menu.brass':'銅管',
      'menu.percussion':'打擊樂','menu.keyboard':'鍵盤','menu.voice':'聲樂',
      'menu.chamber':'室內樂','menu.all':'全部','menu.allmusicians':'所有音樂家',
      'menu.violin':'小提琴','menu.viola':'中提琴','menu.cello':'大提琴',
      'menu.doublebass':'低音大提琴','menu.harp':'豎琴',
      'menu.flute':'長笛','menu.piccolo':'短笛','menu.oboe':'雙簧管',
      'menu.clarinet':'單簧管','menu.saxophone':'薩克斯風','menu.bassoon':'巴松管',
      'menu.frenchhorn':'法國號','menu.trumpet':'小號','menu.trombone':'長號',
      'menu.euphonium':'上低音號','menu.tuba':'大號',
      'menu.timpani':'定音鼓','menu.marimba':'馬林巴','menu.vibraphone':'顫音琴','menu.xylophone':'木琴',
      'menu.piano':'鋼琴','menu.collabpiano':'合作鋼琴','menu.pipeorgan':'管風琴',
      'menu.soprano':'女高音','menu.mezzosoprano':'次女高音','menu.tenor':'男高音',
      'menu.baritone':'男中音','menu.choral':'合唱','menu.conductor':'指揮','menu.tuner':'調音師',
      'menu.stringquartet':'弦樂四重奏','menu.pianotrio':'鋼琴三重奏','menu.stringtrio':'弦樂三重奏',
      'menu.windquintet':'木管五重奏','menu.brassquintet':'銅管五重奏','menu.pianoquintet':'鋼琴五重奏'
    }
  };

  /* ── i18n engine (ported from homepage switchLang ~3159 + toggle ~3233) ──
     Merges NAV_I18N with per-page window.PAGE_I18N (may be undefined). ────── */
  function buildDict(lang) {
    var merged = {};
    var base = NAV_I18N[lang] || NAV_I18N.en;
    for (var k in base) { if (base.hasOwnProperty(k)) merged[k] = base[k]; }
    var page = (window.PAGE_I18N && window.PAGE_I18N[lang]) ? window.PAGE_I18N[lang] : null;
    if (page) { for (var k2 in page) { if (page.hasOwnProperty(k2)) merged[k2] = page[k2]; } }
    return merged;
  }

  function applyLang(lang) {
    if (lang !== 'en' && lang !== 'zh') lang = 'en';
    try { localStorage.setItem('opusz_lang', lang); } catch (e) {}
    window._currentLang = lang;

    var dict = buildDict(lang);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n')];
      if (v !== undefined) el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n-html')];
      if (v !== undefined) el.innerHTML = v;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n-ph')];
      if (v !== undefined) el.placeholder = v;
    });

    document.querySelectorAll('#langToggle .lt-opt').forEach(function (o) {
      o.classList.toggle('active', o.dataset.l === lang);
    });
    document.documentElement.lang = lang === 'zh' ? 'zh-TW' : 'en';

    try {
      document.dispatchEvent(new CustomEvent('opusz:langchange', { detail: { lang: lang } }));
    } catch (e) {}
  }
  // Expose globally so pages can call/override.
  window.applyLang = applyLang;

  /* ── Favourites badge + navigation (homepage ~3199) ───────────────────── */
  function wireFavourites() {
    var count = JSON.parse(localStorage.getItem('mono-favs') || '[]').length;
    var badge = document.getElementById('navFavBadge');
    var btn   = document.getElementById('navFavBtn');

    function positionBadge() {
      if (!badge || !btn) return;
      var r = btn.getBoundingClientRect();
      badge.style.top  = (r.top + 1) + 'px';
      badge.style.left = (r.right - 16) + 'px';
    }

    if (badge) {
      badge.textContent = count;
      badge.style.display = count ? 'flex' : 'none';
      positionBadge();
      window.addEventListener('resize', positionBadge);
      window.addEventListener('scroll', positionBadge, { passive: true });
    }

    if (btn) btn.addEventListener('click', function () {
      if (!localStorage.getItem('opusz_user')) {
        var overlay = document.getElementById('loginRequiredModal');
        if (overlay) { overlay.style.display = 'flex'; return; }
        if (confirm('請先登入才能查看最愛清單。\n\n前往登入頁面？')) window.location.href = 'musician-login.html';
        return;
      }
      window.location.href = 'favourites.html';
    });
  }

  /* ── Lang toggle (homepage ~3233) ─────────────────────────────────────── */
  function wireLangToggle() {
    var toggle = document.getElementById('langToggle');
    if (!toggle) return;
    toggle.addEventListener('click', function (e) {
      var opt = e.target.closest('[data-l]');
      var next = opt ? opt.dataset.l : ((window._currentLang === 'en') ? 'zh' : 'en');
      applyLang(next);
    });
  }

  /* ── Login dropdown (homepage ~3238) ──────────────────────────────────── */
  function wireLoginDropdown() {
    var loginBtn  = document.getElementById('navLoginBtn');
    var loginDrop = document.getElementById('loginDropdown');
    if (!loginBtn || !loginDrop) return;
    var loginLeaveTimer;
    var navEl = document.querySelector('nav');

    function positionLoginDrop() {
      var r = loginBtn.getBoundingClientRect();
      // Touch the button (no dead-zone gap) so the cursor can never fall
      // between the button and the menu and trigger an accidental close.
      loginDrop.style.top   = r.bottom + 'px';
      loginDrop.style.right = (window.innerWidth - r.right) + 'px';
      loginDrop.style.left  = 'auto';
      loginDrop.style.minWidth = Math.max(r.width, 160) + 'px';
    }
    function openLoginDrop() {
      clearTimeout(loginLeaveTimer);
      loginBtn.classList.add('open');
      positionLoginDrop();
      loginDrop.classList.add('open');
      if (navEl) {
        navEl.classList.add('login-drop-open');
        if (window.__opuszUpdateNavColors) window.__opuszUpdateNavColors();
      }
    }
    function closeLoginDrop() {
      loginLeaveTimer = setTimeout(function () {
        loginBtn.classList.remove('open');
        loginDrop.classList.remove('open');
        if (navEl) {
          navEl.classList.remove('login-drop-open');
          if (window.__opuszUpdateNavColors) window.__opuszUpdateNavColors();
        }
      }, 300);
    }

    loginBtn.addEventListener('mouseenter', openLoginDrop);
    loginBtn.addEventListener('mouseleave', closeLoginDrop);
    loginDrop.addEventListener('mouseenter', function () { clearTimeout(loginLeaveTimer); });
    loginDrop.addEventListener('mouseleave', closeLoginDrop);
    loginBtn.addEventListener('click', function () {
      if (loginDrop.classList.contains('open')) {
        loginDrop.classList.remove('open');
        loginBtn.classList.remove('open');
        if (navEl) navEl.classList.remove('login-drop-open');
      } else {
        openLoginDrop();
      }
    });
    document.addEventListener('click', function (e) {
      if (!loginBtn.contains(e.target) && !loginDrop.contains(e.target)) {
        loginDrop.classList.remove('open');
        loginBtn.classList.remove('open');
        if (navEl) navEl.classList.remove('login-drop-open');
      }
    });
  }

  /* ── Hamburger drawer + sub-drawer (homepage ~3296) ───────────────────── */
  function wireDrawer() {
    var hamburgerBtn = document.getElementById('hamburgerBtn');
    var navDrawer    = document.getElementById('navDrawer');
    var navSubDrawer = document.getElementById('navSubDrawer');
    if (!hamburgerBtn || !navDrawer) return;
    var drawerTimeout;

    function openDrawer() {
      clearTimeout(drawerTimeout);
      navDrawer.classList.add('nd-visible');
    }
    // The login / account dropdowns live OUTSIDE the drawer, so moving the cursor
    // onto them fires the drawer's mouseleave. Keep the drawer open while either
    // menu is showing, so they appear together (not one replacing the other).
    function menuOpen() {
      var ld = document.getElementById('loginDropdown');
      var ad = document.getElementById('accountDropdown');
      return (ld && ld.classList.contains('open')) || (ad && ad.classList.contains('open'));
    }
    function closeDrawer() {
      if (navSubDrawer && navSubDrawer.classList.contains('ns-visible')) return;
      if (menuOpen()) return;
      drawerTimeout = setTimeout(function () {
        navDrawer.classList.remove('nd-visible');
        if (navSubDrawer) navSubDrawer.classList.remove('ns-visible');
      }, 120);
    }
    function closeBoth() {
      if (menuOpen()) return;
      drawerTimeout = setTimeout(function () {
        navDrawer.classList.remove('nd-visible');
        if (navSubDrawer) navSubDrawer.classList.remove('ns-visible');
      }, 120);
    }

    hamburgerBtn.addEventListener('mouseenter', openDrawer);
    hamburgerBtn.addEventListener('mouseleave', closeDrawer);
    navDrawer.addEventListener('mouseenter', openDrawer);
    navDrawer.addEventListener('mouseleave', closeDrawer);

    /* ── Mobile: relocate favourites / account / language INTO the drawer ──
       Moves the REAL controls (keeps all wiring) on ≤900px so the top bar shows
       only logo + hamburger; restores them on desktop. */
    (function(){
      var box = document.getElementById('navDrawerExtra');
      if(!box){ box = document.createElement('div'); box.id='navDrawerExtra'; navDrawer.appendChild(box); }
      var ids = ['navFavBtn','navLoginBtn','navAccountBtn','langToggle'];
      ids.forEach(function(id){ var el=document.getElementById(id); if(el && !el.__navHome) el.__navHome={parent:el.parentNode, next:el.nextSibling}; });
      var mq = window.matchMedia('(max-width: 900px)');
      function apply(){
        ids.forEach(function(id){
          var el=document.getElementById(id); if(!el) return;
          if(mq.matches){ if(el.parentNode!==box) box.appendChild(el); }
          else if(el.__navHome && el.parentNode===box){ el.__navHome.parent.insertBefore(el, el.__navHome.next); }
        });
      }
      apply();
      if(mq.addEventListener) mq.addEventListener('change', apply); else if(mq.addListener) mq.addListener(apply);
    })();

    if (navSubDrawer) {
      navSubDrawer.addEventListener('mouseenter', function () { clearTimeout(drawerTimeout); });
      navSubDrawer.addEventListener('mouseleave', closeBoth);

      navSubDrawer.addEventListener('wheel', function (e) {
        var body = this.querySelector('.nsd-body');
        if (!body) return;
        var atTop    = body.scrollTop === 0;
        var atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
        if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
          e.preventDefault();
        } else {
          e.stopPropagation();
          body.scrollTop += e.deltaY;
          e.preventDefault();
        }
      }, { passive: false });
    }

    var ndMusiciansBtn = document.getElementById('ndMusiciansBtn');
    var nsdBack        = document.getElementById('nsdBack');
    if (ndMusiciansBtn && navSubDrawer) {
      ndMusiciansBtn.addEventListener('click', function () {
        clearTimeout(drawerTimeout);
        navSubDrawer.classList.add('ns-visible');
      });
      if (nsdBack) nsdBack.addEventListener('click', function () {
        navSubDrawer.classList.remove('ns-visible');
      });
    }
  }

  /* ── Mega menu (homepage ~3360) ───────────────────────────────────────── */
  function wireMegaMenu() {
    var artistsTrigger = document.getElementById('artists-nav-item');
    var megaMenu       = document.getElementById('artistsMegaMenu');
    if (!artistsTrigger || !megaMenu) return;
    var artistsLink = artistsTrigger.querySelector('a');
    var navEl2      = document.querySelector('nav');
    var mmTimeout;

    function openMega() {
      clearTimeout(mmTimeout);
      megaMenu.classList.add('mm-visible');
      if (artistsLink) artistsLink.classList.add('mm-active');
      if (navEl2) navEl2.classList.add('mega-open');
      applyNavBlendColors();   // flip nav controls to black over the white mega panel
    }
    function closeMega() {
      mmTimeout = setTimeout(function () {
        megaMenu.classList.add('mm-closing');
        megaMenu.classList.remove('mm-visible');
        if (artistsLink) artistsLink.classList.remove('mm-active');
        setTimeout(function () {
          megaMenu.classList.remove('mm-closing');
          if (navEl2) navEl2.classList.remove('mega-open');
          applyNavBlendColors();   // restore white nav after the panel closes
        }, 520);
      }, 200);
    }

    artistsTrigger.addEventListener('mouseenter', openMega);
    artistsTrigger.addEventListener('mouseleave', closeMega);
    megaMenu.addEventListener('mouseenter', openMega);
    megaMenu.addEventListener('mouseleave', closeMega);
  }

  /* ── Nav auth state + account dropdown + logout (homepage ~6726) ──────────
     Auth keys: opusz_user (display name), opusz_user_email. ──────────────── */
  function wireAuth() {
    var loginBtn   = document.getElementById('navLoginBtn');
    var accountBtn = document.getElementById('navAccountBtn');
    var logoutBtn  = document.getElementById('navLogoutBtn');
    var accDrop    = document.getElementById('accountDropdown');

    // Show EXACTLY one of Log in / My Account. The drawer CSS marks .nav-login-btn
    // display:inline-flex !important (and the account button also carries that
    // class), so hide with setProperty('important') to win, and show by removing
    // the inline override so the stylesheet takes over.
    function showBtn(el){ if(el) el.style.removeProperty('display'); }
    function hideBtn(el){ if(el) el.style.setProperty('display', 'none', 'important'); }
    function updateNavAuth() {
      var user = localStorage.getItem('opusz_user');
      if (user) {
        hideBtn(loginBtn);
        showBtn(accountBtn);
        var emailEl = document.getElementById('navAccEmail');
        if (emailEl) emailEl.textContent = localStorage.getItem('opusz_user_email') || user;
        // Account-type split: a musician browsing the front-end only gets
        // "Go to Dashboard" + "Log Out"; customers keep the full menu.
        if (accDrop) {
          var isMus = localStorage.getItem('opusz_role') === 'musician';
          accDrop.querySelectorAll('.acct-mus').forEach(function(el){ el.style.display = isMus ? '' : 'none'; });
          accDrop.querySelectorAll('.acct-cust').forEach(function(el){ el.style.display = isMus ? 'none' : ''; });
        }
      } else {
        showBtn(loginBtn);
        if (accountBtn) { hideBtn(accountBtn); accountBtn.classList.remove('open'); }
        if (accDrop)    accDrop.classList.remove('open');
      }
    }
    updateNavAuth();

    if (accountBtn && accDrop) {
      var accTimer;
      function openAccDrop() {
        clearTimeout(accTimer);
        var r = accountBtn.getBoundingClientRect();
        accDrop.style.top   = (r.bottom + 10) + 'px';
        accDrop.style.right = (window.innerWidth - r.right) + 'px';
        accDrop.style.left  = 'auto';
        accDrop.classList.add('open');
        accountBtn.classList.add('open');
      }
      function closeAccDrop() {
        accTimer = setTimeout(function () {
          accDrop.classList.remove('open');
          accountBtn.classList.remove('open');
        }, 160);
      }
      accountBtn.addEventListener('mouseenter', openAccDrop);
      accountBtn.addEventListener('mouseleave', closeAccDrop);
      accDrop.addEventListener('mouseenter', function () { clearTimeout(accTimer); });
      accDrop.addEventListener('mouseleave', closeAccDrop);
      accountBtn.addEventListener('click', function () {
        if (accountBtn.classList.contains('open')) closeAccDrop();
        else openAccDrop();
      });
      document.addEventListener('click', function (e) {
        if (!accountBtn.contains(e.target) && !accDrop.contains(e.target)) {
          accDrop.classList.remove('open');
          accountBtn.classList.remove('open');
        }
      });
    }

    function doLogout(e) {
      if (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      localStorage.removeItem('opusz_user');
      localStorage.removeItem('opusz_user_email');
      updateNavAuth();
      if (accDrop) accDrop.classList.remove('open');
      if (accountBtn) accountBtn.classList.remove('open');
    }
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout, true);
  }

  /* ── Nav-link hover underline ──────────────────────────────────────────────
     A line that grows left→right under a link on hover and retracts right→left
     on leave. Implemented as a CSS ::after pseudo-element (NOT a child <span>)
     so it survives the homepage's per-character re-split (which rewrites each
     link's innerHTML and would wipe a child element). background:currentColor
     means it inherits the link's colour — and since every nav uses
     mix-blend-mode:difference, a white-ish line auto-contrasts on any background.
     Injected here so it appears identically on EVERY page. */
  function injectNavUnderlineCSS() {
    if (document.getElementById('nav-ul-css')) return;
    var st = document.createElement('style');
    st.id = 'nav-ul-css';
    st.textContent =
      '.nav-links a{position:relative;}' +
      '.nav-links a::after{content:"";position:absolute;left:10px;right:10px;bottom:3px;' +
        'height:1px;background:#fff;transform:scaleX(0);transform-origin:right center;' +
        'transition:transform .4s cubic-bezier(.25,.46,.45,.94);pointer-events:none;}' +
      '.nav-links a:hover::after{transform:scaleX(1);transform-origin:left center;}' +
      // When the mega-menu turns the nav into a solid white bar, switch to a dark line.
      'nav.mega-open .nav-links a:hover::after{background:#000;}';
    (document.head || document.documentElement).appendChild(st);
  }

  /* ── Boot: inject markup, then wire everything ────────────────────────── */
  function inject() {
    if (document.getElementById('navOrbFixed')) return; // re-check (race safety)
    var holder = document.createElement('div');
    holder.innerHTML = NAV_HTML;
    // Prepend each top-level node to <body> in source order.
    var frag = document.createDocumentFragment();
    while (holder.firstChild) frag.appendChild(holder.firstChild);
    document.body.insertBefore(frag, document.body.firstChild);
  }

  /* ── Force nav elements white on mix-blend-mode pages (matches homepage) ──
     The homepage's inline nav forces every control to #fff so mix-blend-mode:
     difference auto-contrasts it on any background. Injected-nav pages were
     missing that, so controls fell back to --nav-fg:#000 (black) → invisible
     under the blend, and unsplit link text stayed `color:transparent`.
     This restores identical, always-visible nav styling on every page.       */
  function applyNavBlendColors() {
    var nav = document.querySelector('nav');
    if (!nav) return;
    if (getComputedStyle(nav).mixBlendMode !== 'difference') return; // solid-bar pages keep their own colours
    var mega = nav.classList.contains('mega-open');
    var c  = mega ? '#000' : '#fff';
    var bd = mega ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.5)';
    nav.querySelectorAll('.nav-links a').forEach(function (a) { a.style.color = c; });
    nav.querySelectorAll('.nav-links .nc-char').forEach(function (s) { s.style.color = c; });
    ['.nav-fav-btn', '.lang-toggle'].forEach(function (sel) {
      var el = nav.querySelector(sel); if (el) el.style.color = c;
    });
    nav.querySelectorAll('.nav-login-btn').forEach(function (el) {
      el.style.color = c; el.style.borderColor = bd;
    });
    nav.querySelectorAll('.hamburger span').forEach(function (s) { s.style.background = c; });
    nav.classList.toggle('nav-on-dark', !mega);
    nav.classList.toggle('nav-on-light', mega);
  }
  window.__applyNavBlendColors = applyNavBlendColors;

  function boot() {
    injectNavUnderlineCSS();   // global CSS → safe even on pages with their own inline nav
    inject();
    // Wire behaviours against the freshly injected elements.
    wireFavourites();
    wireLangToggle();
    wireLoginDropdown();
    wireDrawer();
    wireMegaMenu();
    wireAuth();
    // Apply persisted language (translates injected nav + any page content).
    var saved = 'en';
    try { saved = localStorage.getItem('opusz_lang') || 'en'; } catch (e) {}
    applyLang(saved);
    // Make the nav visible (white) on mix-blend pages — consistent with homepage.
    applyNavBlendColors();
  }

  if (document.body) {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
