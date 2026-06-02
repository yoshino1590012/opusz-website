/**
 * nav-auth.js — shared login state for all OPUS.Z pages
 * When logged in, transforms the existing navLoginBtn in-place into "My Account"
 * so it inherits each page's nav layout, animations, and colour changes automatically.
 */
(function() {
  function init() {
    var user  = localStorage.getItem('opusz_user');
    var email = localStorage.getItem('opusz_user_email') || '';

    var loginBtn = document.getElementById('navLoginBtn') ||
                   document.querySelector('.nav-login-btn, .nav-btn-login, [data-role="login-btn"]');

    if (!user) {
      // Not logged in — ensure login btn shows
      if (loginBtn) loginBtn.style.display = '';
      return;
    }

    // Pages that manage their own account UI — skip entirely
    if (document.getElementById('navAccountFixed')) return;
    if (document.getElementById('navInlineAccount')) return;

    // ── INLINE TRANSFORMATION ──────────────────────────────────────────
    // If there's a navLoginBtn inside a .nav-right flex container,
    // transform it in-place so it inherits the page's nav animations,
    // colour changes, scroll behaviour, etc.
    if (loginBtn && loginBtn.closest('.nav-right, nav')) {
      // Change label text
      var label = loginBtn.querySelector('.login-label');
      if (label) label.textContent = 'My Account';

      // Replace dropdown content (keeps .nav-login-dropdown class so page CSS still applies)
      var drop = loginBtn.querySelector('.nav-login-dropdown');
      if (!drop) {
        drop = document.createElement('div');
        drop.className = 'nav-login-dropdown';
        loginBtn.appendChild(drop);
      }

      drop.innerHTML =
        '<div style="padding:10px 14px 8px;border-bottom:1px solid rgba(0,0,0,.08);margin-bottom:2px;pointer-events:none">' +
          '<div style="font-size:13px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + user + '</div>' +
          '<div style="font-size:11px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + email + '</div>' +
        '</div>' +
        '<a href="messages.html" style="display:flex;align-items:center;font-weight:700;">Messages' +
          '<span id="sharedMsgBadge" style="background:#e05;color:#fff;border-radius:50px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:auto;display:none">0</span>' +
        '</a>' +
        '<a href="musician-community.html" style="font-weight:700;">🎵 樂手社群</a>' +
        '<a href="customer-profile.html#bookings">My Bookings</a>' +
        '<a href="customer-profile.html">My Profile</a>' +
        '<div style="border-top:1px solid rgba(0,0,0,.08);margin:3px 0"></div>' +
        '<a href="#" id="sharedLogoutBtn" style="color:#c00;font-weight:600;">Log Out</a>';

      // If page's JS hasn't set up hover open/close yet, add it ourselves
      if (!loginBtn._authHooked) {
        loginBtn._authHooked = true;
        var leaveTimer;
        loginBtn.addEventListener('mouseenter', function() {
          clearTimeout(leaveTimer); loginBtn.classList.add('open');
        });
        loginBtn.addEventListener('mouseleave', function() {
          leaveTimer = setTimeout(function(){ loginBtn.classList.remove('open'); }, 180);
        });
        drop.addEventListener('mouseenter', function() { clearTimeout(leaveTimer); });
        drop.addEventListener('mouseleave', function() {
          leaveTimer = setTimeout(function(){ loginBtn.classList.remove('open'); }, 120);
        });
      }

      // Unread badge + logout (slight delay so DOM is settled)
      setTimeout(function() {
        var convs = JSON.parse(localStorage.getItem('opusz_convs') || 'null');
        var unread = convs
          ? convs.filter(function(c){ return !c.archived && c.unread > 0; })
                 .reduce(function(s,c){ return s + c.unread; }, 0)
          : 2;
        var badge = document.getElementById('sharedMsgBadge');
        if (badge && unread > 0) { badge.textContent = unread; badge.style.display = 'inline'; }

        var logoutEl = document.getElementById('sharedLogoutBtn');
        if (logoutEl) logoutEl.addEventListener('click', function(e) {
          e.preventDefault();
          localStorage.removeItem('opusz_user');
          localStorage.removeItem('opusz_user_email');
          window.location.reload();
        });
      }, 80);

      return; // done — no fixed-position button needed
    }

    // ── FALLBACK: fixed-position button (pages without .nav-right navLoginBtn) ──
    if (loginBtn) loginBtn.style.display = 'none';

    var favBtn  = document.getElementById('navFavBtn');
    var langBtn = document.getElementById('langToggle');
    var ref = favBtn || langBtn;
    if (!ref) return;

    if (!document.getElementById('navAuthStyle')) {
      var style = document.createElement('style');
      style.id = 'navAuthStyle';
      style.textContent = [
        '#sharedAccountBtn{position:fixed;z-index:201;display:inline-flex;align-items:center;gap:5px;',
          'background:transparent;color:#fff;border:none;padding:6px 2px;font-size:14px;font-weight:700;',
          'font-family:inherit;white-space:nowrap;line-height:1;cursor:pointer;mix-blend-mode:difference;}',
        '#sharedAccountBtn:hover{opacity:.65}',
        '#sharedAccountBtn svg{width:12px;height:12px;transition:transform .2s;flex-shrink:0}',
        '#sharedAccountBtn.drop-open svg{transform:rotate(180deg)}',
        '#sharedAccountDrop{position:fixed;z-index:9999;background:#fff;border-radius:16px;padding:8px;min-width:220px;',
          'box-shadow:0 8px 40px rgba(0,0,0,.13),0 0 0 1px rgba(0,0,0,.06);opacity:0;pointer-events:none;',
          'transform:translateY(-6px) scale(.97);transform-origin:top right;transition:opacity .18s,transform .18s;font-family:inherit}',
        '#sharedAccountDrop.open{opacity:1;pointer-events:auto;transform:translateY(0) scale(1)}'
      ].join('');
      document.head.appendChild(style);
    }

    var btn = document.createElement('button');
    btn.id = 'sharedAccountBtn';
    btn.setAttribute('aria-label', 'My Account');
    btn.innerHTML =
      '<span>My Account</span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';

    var drop2 = document.createElement('div');
    drop2.id = 'sharedAccountDrop';
    drop2.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px 10px;border-bottom:1px solid #f0f0f0;margin-bottom:4px">' +
        '<div style="width:38px;height:38px;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:1px;overflow:hidden">' +
          '<div style="font-size:13.5px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + user + '</div>' +
          '<div style="font-size:11.5px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + email + '</div>' +
        '</div>' +
      '</div>' +
      '<a href="messages.html" style="display:flex;align-items:center;gap:10px;padding:10px 12px;font-size:13px;font-weight:700;color:#111;text-decoration:none;border-radius:10px;transition:background .13s" onmouseover="this.style.background=\'#f4f4f4\'" onmouseout="this.style.background=\'\'">Messages <span id="sharedMsgBadge" style="background:#e05;color:#fff;border-radius:50px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:auto;display:none">0</span></a>' +
      '<a href="customer-profile.html#bookings" style="display:flex;align-items:center;gap:10px;padding:10px 12px;font-size:13px;font-weight:600;color:#111;text-decoration:none;border-radius:10px;transition:background .13s" onmouseover="this.style.background=\'#f4f4f4\'" onmouseout="this.style.background=\'\'">My Bookings</a>' +
      '<a href="customer-profile.html" style="display:flex;align-items:center;gap:10px;padding:10px 12px;font-size:13px;font-weight:600;color:#111;text-decoration:none;border-radius:10px;transition:background .13s" onmouseover="this.style.background=\'#f4f4f4\'" onmouseout="this.style.background=\'\'">My Profile</a>' +
      '<div style="height:1px;background:#f0f0f0;margin:4px 8px"></div>' +
      '<a href="#" id="sharedLogoutBtn" style="display:flex;align-items:center;gap:10px;padding:10px 12px;font-size:13px;font-weight:600;color:#c00;text-decoration:none;border-radius:10px;transition:background .13s" onmouseover="this.style.background=\'#fff0f0\'" onmouseout="this.style.background=\'\'">Log Out</a>';

    document.body.appendChild(btn);
    document.body.appendChild(drop2);

    function positionAll() {
      var favEl = document.getElementById('navFavBtn');
      var nav   = document.querySelector('nav');
      if (!nav || !favEl) return;
      var navR  = nav.getBoundingClientRect();
      var favR  = favEl.getBoundingClientRect();
      var btnH  = btn.offsetHeight || 30;
      var midY  = navR.top + navR.height / 2;
      btn.style.top  = (midY - btnH / 2) + 'px';
      btn.style.left = (favR.right + 14) + 'px';
      btn.style.right = 'auto';
    }
    positionAll();
    window.addEventListener('resize', positionAll);

    var timer2;
    function openDrop2() {
      clearTimeout(timer2);
      var r2 = btn.getBoundingClientRect();
      drop2.style.top   = (r2.bottom + 10) + 'px';
      drop2.style.right = (window.innerWidth - r2.right) + 'px';
      drop2.style.left  = 'auto';
      drop2.classList.add('open');
      btn.classList.add('drop-open');
    }
    function closeDrop2() {
      timer2 = setTimeout(function() {
        drop2.classList.remove('open');
        btn.classList.remove('drop-open');
      }, 160);
    }
    btn.addEventListener('mouseenter', openDrop2);
    btn.addEventListener('mouseleave', closeDrop2);
    drop2.addEventListener('mouseenter', function(){ clearTimeout(timer2); });
    drop2.addEventListener('mouseleave', closeDrop2);
    btn.addEventListener('click', function() {
      if (drop2.classList.contains('open')) closeDrop2(); else openDrop2();
    });
    document.addEventListener('click', function(e) {
      if (!btn.contains(e.target) && !drop2.contains(e.target)) closeDrop2();
    });

    setTimeout(function() {
      var convs = JSON.parse(localStorage.getItem('opusz_convs') || 'null');
      var unread = convs
        ? convs.filter(function(c){ return !c.archived && c.unread > 0; }).reduce(function(s,c){ return s + c.unread; }, 0)
        : 2;
      var msgBadge = document.getElementById('sharedMsgBadge');
      if (msgBadge && unread > 0) { msgBadge.textContent = unread; msgBadge.style.display = 'inline-flex'; }
    }, 50);

    setTimeout(function() {
      var logoutEl = document.getElementById('sharedLogoutBtn');
      if (logoutEl) logoutEl.addEventListener('click', function(e) {
        e.preventDefault();
        localStorage.removeItem('opusz_user');
        localStorage.removeItem('opusz_user_email');
        window.location.reload();
      });
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
