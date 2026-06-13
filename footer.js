/* ============================================================================
 * footer.js — shared site footer (newsletter + link columns + big wordmark).
 * Mirrors the homepage (#site-footer) so Musicians / Recent Jobs / Lessons all
 * get the same footer. Auto-themes to the page's background (light/dark) so it
 * blends in. Add with:  <script type="module" src="footer.js?v=1"></script>
 * (The homepage keeps its own inline footer; this is for the other pages.)
 * ==========================================================================*/
(function () {
  if (document.getElementById('site-footer')) return;   // page already has one

  // ── Theme: match the page background; pick text colours by luminance ──
  function lum(rgb){
    var m = (rgb || '').match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return 1;                                   // assume light if unknown
    var r = +m[1], g = +m[2], b = +m[3];
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  var pageBg = '';
  try { pageBg = getComputedStyle(document.body).backgroundColor; } catch (e) {}
  if (!pageBg || pageBg === 'rgba(0, 0, 0, 0)' || pageBg === 'transparent') pageBg = '#ffffff';
  var dark = lum(pageBg) < 0.5;

  var t = dark ? {
    bg: pageBg, text: '#fff', link: 'rgba(255,255,255,.78)', muted: 'rgba(255,255,255,.45)',
    faint: 'rgba(255,255,255,.3)', border: 'rgba(255,255,255,.12)', inputBg: 'rgba(255,255,255,.06)',
    inputBd: 'rgba(255,255,255,.2)', inputText: '#fff', btnBg: '#fff', btnText: '#111', word: 'rgba(255,255,255,.92)'
  } : {
    bg: pageBg, text: '#000', link: '#000', muted: '#999',
    faint: '#bbb', border: 'rgba(0,0,0,.08)', inputBg: '#f8f8f8',
    inputBd: '#ddd', inputText: '#111', btnBg: '#111', btnText: '#fff', word: '#000'
  };

  var css = ''
    + '#site-footer{background:' + t.bg + ';border-top:1px solid ' + t.border + ';padding:80px 60px 0;overflow:visible;color:' + t.text + ';}'
    + '#site-footer .sf-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:100px;padding-bottom:48px;border-bottom:1px solid ' + t.border + ';}'
    + '#site-footer .sf-newsletter{flex:0 1 400px;min-width:280px;}'
    + '#site-footer .sf-nl-label{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:' + t.muted + ';margin-bottom:20px;}'
    + '#site-footer .sf-nl-title{font-size:clamp(28px,3.2vw,44px);font-weight:800;letter-spacing:-1.5px;line-height:1.05;margin-bottom:16px;}'
    + '#site-footer .sf-nl-body{font-size:15px;color:' + (dark ? 'rgba(255,255,255,.6)' : '#666') + ';line-height:1.7;margin-bottom:36px;}'
    + '#site-footer .sf-nl-form{display:flex;gap:0;max-width:480px;}'
    + '#site-footer .sf-nl-form input{flex:1;padding:14px 18px;border:1.5px solid ' + t.inputBd + ';border-right:none;font-size:14px;font-family:inherit;outline:none;background:' + t.inputBg + ';color:' + t.inputText + ';}'
    + '#site-footer .sf-nl-form button{padding:14px 28px;background:' + t.btnBg + ';color:' + t.btnText + ';border:none;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;font-family:inherit;white-space:nowrap;transition:opacity .2s;}'
    + '#site-footer .sf-nl-form button:hover{opacity:.85;}'
    + '#site-footer .sf-nl-note{font-size:11px;color:' + t.faint + ';margin-top:14px;}'
    + '#site-footer .sf-links{display:flex;flex-wrap:wrap;justify-content:space-between;gap:40px;flex:1 1 620px;min-width:300px;}'
    + '#site-footer .sf-col a{display:block;font-size:14px;color:' + t.link + ';text-decoration:none;margin-bottom:34px;opacity:.85;transition:opacity .2s;}'
    + '#site-footer .sf-col a:last-child{margin-bottom:0;}'
    + '#site-footer .sf-col a:hover{opacity:1;}'
    + '#site-footer .sf-copy-bar{display:flex;justify-content:space-between;align-items:center;padding:22px 0;font-size:12px;color:' + t.muted + ';border-bottom:1px solid ' + t.border + ';flex-wrap:wrap;gap:12px;}'
    + '#site-footer .sf-copy-right{display:flex;gap:28px;}'
    + '#site-footer .sf-copy-right a{color:' + t.muted + ';text-decoration:none;transition:color .2s;}'
    + '#site-footer .sf-copy-right a:hover{color:' + t.text + ';}'
    + '#site-footer .sf-brand{display:flex;justify-content:center;align-items:flex-end;gap:clamp(2px,1.2vw,20px);height:clamp(80px,32vw,640px);overflow:visible;user-select:none;margin-top:-2px;width:100%;}'
    + '#site-footer .sf-letter{display:block;font-family:"Roboto Flex","Inter",sans-serif;font-size:clamp(30px,27vw,560px);font-weight:220;line-height:.86;color:' + t.word + ';will-change:font-variation-settings;}'
    + '#site-footer .sf-dot{font-size:clamp(26px,23vw,480px);line-height:1;align-self:flex-end;}'
    // Mobile: lay the four link columns out as a 2×2 grid of groups. Tight
    // spacing *within* each group + generous gaps *between* groups makes the
    // categories read as distinct blocks — no divider lines, just whitespace.
    + '@media(max-width:760px){'
    +   '#site-footer{padding:48px 24px 0;}'
    +   '#site-footer .sf-top{gap:40px;}'
    +   '#site-footer .sf-links{display:grid;grid-template-columns:1fr 1fr;gap:36px 20px;justify-content:initial;flex:none;min-width:0;}'
    +   '#site-footer .sf-col a{margin-bottom:14px;}'
    + '}';

  var style = document.createElement('style');
  style.id = 'site-footer-css';
  style.textContent = css;
  document.head.appendChild(style);

  var html = ''
    + '<div class="sf-top">'
    +   '<div class="sf-newsletter">'
    +     '<p class="sf-nl-label" data-i18n="newsletter.label">Newsletter</p>'
    +     '<h2 class="sf-nl-title" data-i18n="newsletter.title">Stay close to the music.</h2>'
    +     '<p class="sf-nl-body" data-i18n="newsletter.body">Get exclusive updates on new musicians, upcoming shows, and industry insights from OPUS.Z — delivered to your inbox.</p>'
    +     '<form name="newsletter" method="POST" class="sf-nl-form">'
    +       '<input type="email" name="email" placeholder="Enter email" required data-i18n-ph="newsletter.email_ph">'
    +       '<button type="submit" data-i18n="newsletter.btn">SUBSCRIBE</button>'
    +     '</form>'
    +     '<p class="sf-nl-note" data-i18n="newsletter.note">No spam. Unsubscribe anytime.</p>'
    +   '</div>'
    +   '<div class="sf-links">'
    +     '<div class="sf-col">'
    +       '<a href="musician-platform.html" data-i18n="footer.link.home">Home</a>'
    +       '<a href="musician-platform.html#discover" data-i18n="footer.link.discover">Discover</a>'
    +       '<a href="musicians.html" data-i18n="footer.link.allmusicians">All Musicians</a>'
    +       '<a href="recent-jobs.html" data-i18n="footer.link.recentjobs">Recent Jobs</a>'
    +     '</div>'
    +     '<div class="sf-col">'
    +       '<a href="musicians.html?cat=strings" data-i18n="footer.link.strings">Strings</a>'
    +       '<a href="musicians.html?cat=piano" data-i18n="footer.link.piano">Piano</a>'
    +       '<a href="musicians.html?cat=woodwinds" data-i18n="footer.link.woodwinds">Woodwinds</a>'
    +       '<a href="musicians.html?cat=chamber" data-i18n="footer.link.chamber">Chamber Music</a>'
    +     '</div>'
    +     '<div class="sf-col">'
    +       '<a href="contact.html" data-i18n="footer.link.contact">Contact</a>'
    +       '<a href="about.html" data-i18n="footer.link.about">About</a>'
    +       '<a href="blog.html" data-i18n="footer.link.blog">Blog</a>'
    +       '<a href="musicians.html" data-i18n="footer.link.musicians">Musicians</a>'
    +     '</div>'
    +     '<div class="sf-col">'
    +       '<a href="#" data-i18n="footer.link.instagram">Instagram</a>'
    +       '<a href="#" data-i18n="footer.link.youtube">YouTube</a>'
    +       '<a href="#" data-i18n="footer.link.tiktok">TikTok</a>'
    +       '<a href="#" data-i18n="footer.link.facebook">Facebook</a>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="sf-copy-bar">'
    +   '<span data-i18n="footer.copy">© 2026 OPUS.Z. All rights reserved.</span>'
    +   '<div class="sf-copy-right">'
    +     '<a href="#" data-i18n="footer.privacy">Privacy Policy</a>'
    +     '<a href="#" data-i18n="footer.terms">Terms of Service</a>'
    +   '</div>'
    + '</div>'
    + '<div class="sf-brand" aria-hidden="true">'
    +   '<span class="sf-letter">O</span><span class="sf-letter">P</span><span class="sf-letter">U</span>'
    +   '<span class="sf-letter">S</span><span class="sf-letter sf-dot">.</span><span class="sf-letter">Z</span>'
    + '</div>';

  var footer = document.createElement('footer');
  footer.id = 'site-footer';
  footer.innerHTML = html;
  document.body.appendChild(footer);

  // Load the Roboto Flex variable font so the big wordmark renders thin (and can
  // animate its weight/width). Without it the letters fall back heavy/static.
  if (!document.querySelector('link[href*="Roboto+Flex"]')) {
    var fl = document.createElement('link');
    fl.rel = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,slnt,wdth,wght@8..144,-10..0,25..151,100..900&display=swap';
    document.head.appendChild(fl);
  }

  // Big "OPUS.Z" wordmark animation — letters thicken/widen/slant toward the
  // cursor (mirrors the homepage footer). Pointer-only; no-op on touch.
  (function(){
    var brand = footer.querySelector('.sf-brand');
    if(!brand) return;
    var letters = Array.prototype.slice.call(brand.querySelectorAll('.sf-letter'));
    var n = letters.length;
    var weights=new Array(n).fill(220), targets=new Array(n).fill(220);
    var widths=new Array(n).fill(60),  tWidths=new Array(n).fill(60);
    var slants=new Array(n).fill(0),   tSlants=new Array(n).fill(0);
    var raf=null;
    var BASE_W=220, MAX_W=720, BASE_D=60, MAX_D=151, BASE_S=0, MAX_S=-7;
    var RADIUS=Math.min(780, window.innerWidth*0.55);
    function onMove(e){
      var mx=e.clientX, my=e.clientY;
      letters.forEach(function(l,i){
        var r=l.getBoundingClientRect();
        var nearX=Math.max(r.left,Math.min(mx,r.right));
        var nearY=Math.max(r.top, Math.min(my,r.bottom));
        var dx=mx-nearX, dy=my-nearY, dist=Math.sqrt(dx*dx+dy*dy);
        var t=Math.max(0,1-dist/RADIUS), t2=t*t*t;
        targets[i]=BASE_W+(MAX_W-BASE_W)*t2;
        tWidths[i]=BASE_D+(MAX_D-BASE_D)*t2;
        tSlants[i]=BASE_S+(MAX_S-BASE_S)*t2;
      });
      if(!raf) raf=requestAnimationFrame(tick);
    }
    function tick(){
      raf=null; var more=false;
      letters.forEach(function(l,i){
        var dw=targets[i]-weights[i]; if(Math.abs(dw)>0.5){weights[i]+=dw*0.04;more=true;}else{weights[i]=targets[i];}
        var dd=tWidths[i]-widths[i];  if(Math.abs(dd)>0.1){widths[i]+=dd*0.04;more=true;}else{widths[i]=tWidths[i];}
        var ds=tSlants[i]-slants[i];  if(Math.abs(ds)>0.01){slants[i]+=ds*0.04;more=true;}else{slants[i]=tSlants[i];}
        var w=Math.round(weights[i]), d=Math.round(widths[i]), s=slants[i].toFixed(2);
        l.style.fontWeight=w;
        l.style.fontVariationSettings="'wght' "+w+", 'wdth' "+d+", 'slnt' "+s;
      });
      if(more) raf=requestAnimationFrame(tick);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', function(){
      targets.fill(BASE_W); tWidths.fill(BASE_D); tSlants.fill(BASE_S);
      if(!raf) raf=requestAnimationFrame(tick);
    });
  })();

  // ── Footer i18n: SELF-CONTAINED EN/中文 dictionary so the footer translates on
  //    every page — content pages' own dictionaries don't carry footer.* keys,
  //    so we must not rely on them. Applies on inject + on every language toggle. ──
  var FOOTER_I18N = {
    en: {
      'newsletter.label':'Newsletter',
      'newsletter.title':'Stay close to the music.',
      'newsletter.body':'Get exclusive updates on new musicians, upcoming shows, and industry insights from OPUS.Z — delivered to your inbox.',
      'newsletter.email_ph':'Enter email','newsletter.btn':'SUBSCRIBE','newsletter.note':'No spam. Unsubscribe anytime.',
      'footer.link.home':'Home','footer.link.discover':'Discover','footer.link.allmusicians':'All Musicians','footer.link.recentjobs':'Recent Jobs',
      'footer.link.strings':'Strings','footer.link.piano':'Piano','footer.link.woodwinds':'Woodwinds','footer.link.chamber':'Chamber Music',
      'footer.link.contact':'Contact','footer.link.about':'About','footer.link.blog':'Blog','footer.link.musicians':'Musicians',
      'footer.link.instagram':'Instagram','footer.link.youtube':'YouTube','footer.link.tiktok':'TikTok','footer.link.facebook':'Facebook',
      'footer.copy':'© 2026 OPUS.Z. All rights reserved.','footer.privacy':'Privacy Policy','footer.terms':'Terms of Service'
    },
    zh: {
      'newsletter.label':'電子報',
      'newsletter.title':'與音樂保持連結。',
      'newsletter.body':'訂閱 OPUS.Z，獲得最新音樂家、近期演出與產業洞察，直接送到你的信箱。',
      'newsletter.email_ph':'輸入電子郵件','newsletter.btn':'訂閱','newsletter.note':'不寄垃圾信，隨時可取消訂閱。',
      'footer.link.home':'首頁','footer.link.discover':'探索','footer.link.allmusicians':'所有音樂家','footer.link.recentjobs':'近期委託',
      'footer.link.strings':'弦樂','footer.link.piano':'鋼琴','footer.link.woodwinds':'木管','footer.link.chamber':'室內樂',
      'footer.link.contact':'聯絡','footer.link.about':'關於','footer.link.blog':'部落格','footer.link.musicians':'音樂家',
      'footer.link.instagram':'Instagram','footer.link.youtube':'YouTube','footer.link.tiktok':'TikTok','footer.link.facebook':'Facebook',
      'footer.copy':'© 2026 OPUS.Z. 版權所有。','footer.privacy':'隱私權政策','footer.terms':'服務條款'
    }
  };
  function footerLang(){
    var l = window._currentLang;
    if (l !== 'en' && l !== 'zh') { try { var s = localStorage.getItem('opusz_lang'); if (s === 'en' || s === 'zh') l = s; } catch (e) {} }
    if (l !== 'en' && l !== 'zh') { var nl = (navigator.language || navigator.userLanguage || 'en').toLowerCase(); l = nl.indexOf('zh') === 0 ? 'zh' : 'en'; }
    return l;
  }
  function footerApplyLang(lang){
    var d = FOOTER_I18N[lang] || FOOTER_I18N.en;
    footer.querySelectorAll('[data-i18n]').forEach(function(el){ var v = d[el.getAttribute('data-i18n')]; if (v !== undefined) el.textContent = v; });
    footer.querySelectorAll('[data-i18n-ph]').forEach(function(el){ var v = d[el.getAttribute('data-i18n-ph')]; if (v !== undefined) el.placeholder = v; });
  }
  footerApplyLang(footerLang());
  document.addEventListener('opusz:langchange', function(e){ footerApplyLang((e.detail && e.detail.lang) || footerLang()); });

  // Wire the newsletter form (subscribe → Firestore). newsletter.js auto-wires
  // any form[name=newsletter] on import; importing it now finds our injected form.
  try { import('./newsletter.js'); } catch (e) {}
})();
