/* ============================================================================
   OPUS.Z — Global in-page notification toasts
   Loaded on every front-end page (injected by nav.js; added directly on the
   homepage which has no nav.js). Shows a slide-in toast — top-right on desktop,
   drops down from the top on mobile (Line-style) — whenever, WHILE you browse:
     • someone sends you a private message      (conversations)
     • the platform posts an announcement        (siteContent/announcements)
     • a musician posts in the community          (posts)        — musicians only
     • a new public commission is posted          (jobs)         — musicians only

   Design notes
     - Only real signed-in users (not anonymous job-poster sessions) get toasts.
     - The FIRST snapshot of every feed is treated as a baseline (no toast) so we
       never "storm" you with everything that already existed when the page loaded.
     - Items are de-duplicated across reloads via small localStorage seen-sets,
       so refreshing the page does not re-show the same notification.
     - Every read here is permitted by firestore.rules for any signed-in user, so
       no permission errors; failures are swallowed and simply yield no toast.
   ========================================================================== */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, query, where, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Guard: a page might both load nav.js (which injects this) and embed it directly.
if (!window.__opuszNotifyLoaded) {
  window.__opuszNotifyLoaded = true;

  const firebaseConfig = {
    apiKey: "AIzaSyDe_1bECi6uRHqiUwIUb1hcJdixILUir4s",
    authDomain: "opusz-45280.firebaseapp.com",
    projectId: "opusz-45280",
    storageBucket: "opusz-45280.firebasestorage.app",
    messagingSenderId: "304745430147",
    appId: "1:304745430147:web:e2900cb48d5726e5c12fb6"
  };
  const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  // Page-session epoch (seconds). Used to ignore anything older than "now" so a
  // toast only fires for things that genuinely arrive while you're on the page.
  const SESSION_START = Math.floor(Date.now() / 1000);

  /* ── tiny helpers ─────────────────────────────────────────────────────── */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function loadSeen(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveSeen(key, set) {
    try {
      // Cap growth: keep only the most-recent 60 ids.
      const arr = Array.from(set).slice(-60);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
  }

  /* ── toast UI ─────────────────────────────────────────────────────────── */
  function injectStyle() {
    if (document.getElementById('opuszNotifyStyle')) return;
    const st = document.createElement('style');
    st.id = 'opuszNotifyStyle';
    st.textContent = [
      '#opuszNotifyWrap{position:fixed;z-index:2147482000;top:16px;right:16px;',
        'display:flex;flex-direction:column;gap:10px;width:360px;max-width:calc(100vw - 32px);',
        'pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif;}',
      '@media(max-width:600px){#opuszNotifyWrap{top:10px;left:50%;right:auto;',
        'transform:translateX(-50%);width:calc(100vw - 20px);}}',
      '.opusz-toast{pointer-events:auto;position:relative;display:flex;gap:11px;align-items:flex-start;',
        'background:#fff;color:#111;border-radius:14px;padding:13px 14px 13px 14px;cursor:pointer;',
        'box-shadow:0 12px 42px rgba(0,0,0,.20),0 0 0 1px rgba(0,0,0,.05);',
        'opacity:0;transform:translateX(120%);',
        'transition:opacity .42s cubic-bezier(.2,.8,.2,1),transform .42s cubic-bezier(.2,.8,.2,1);}',
      '@media(max-width:600px){.opusz-toast{transform:translateY(-160%);}}',
      '.opusz-toast.in{opacity:1;transform:translateX(0);}',
      '@media(max-width:600px){.opusz-toast.in{transform:translateY(0);}}',
      '.opusz-toast.out{opacity:0;transform:translateX(120%);}',
      '@media(max-width:600px){.opusz-toast.out{transform:translateY(-160%);}}',
      '.opusz-toast-icon{flex:none;width:30px;height:30px;border-radius:9px;display:flex;',
        'align-items:center;justify-content:center;font-size:16px;background:#f4f4f5;}',
      '.opusz-toast-body{flex:1;min-width:0;}',
      '.opusz-toast-title{font-size:13.5px;font-weight:700;color:#111;line-height:1.35;',
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.opusz-toast-text{font-size:12.5px;color:#555;line-height:1.45;margin-top:2px;',
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.opusz-toast-kind{font-size:11px;color:#999;font-weight:600;margin-top:4px;}',
      '.opusz-toast-x{flex:none;border:none;background:transparent;color:#bbb;cursor:pointer;',
        'font-size:16px;line-height:1;padding:0 0 0 4px;align-self:flex-start;}',
      '.opusz-toast-x:hover{color:#666;}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  function wrapEl() {
    let w = document.getElementById('opuszNotifyWrap');
    if (!w) {
      w = document.createElement('div');
      w.id = 'opuszNotifyWrap';
      (document.body || document.documentElement).appendChild(w);
    }
    return w;
  }

  // opts: { icon, title, text, kind, href }
  function toast(opts) {
    injectStyle();
    const wrap = wrapEl();
    const el = document.createElement('div');
    el.className = 'opusz-toast';
    el.innerHTML =
      '<div class="opusz-toast-icon">' + (opts.icon || '🔔') + '</div>' +
      '<div class="opusz-toast-body">' +
        '<div class="opusz-toast-title">' + esc(opts.title || '通知') + '</div>' +
        (opts.text ? '<div class="opusz-toast-text">' + esc(opts.text) + '</div>' : '') +
        (opts.kind ? '<div class="opusz-toast-kind">' + esc(opts.kind) + '</div>' : '') +
      '</div>' +
      '<button class="opusz-toast-x" aria-label="關閉">&times;</button>';

    let dismissed = false;
    let hideTimer;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      clearTimeout(hideTimer);
      el.classList.add('out');
      el.classList.remove('in');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 460);
    }
    function startTimer() { hideTimer = setTimeout(dismiss, 6500); }

    el.querySelector('.opusz-toast-x').addEventListener('click', function (e) {
      e.stopPropagation();
      dismiss();
    });
    el.addEventListener('click', function () {
      if (opts.href && opts.href !== '#') window.location.href = opts.href;
      dismiss();
    });
    // Pause auto-dismiss on hover so you can read / click.
    el.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
    el.addEventListener('mouseleave', startTimer);

    wrap.appendChild(el);
    // Keep at most 4 visible; drop the oldest.
    while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('in'); });
    });
    startTimer();
  }
  // Expose for manual testing from the console: window.__opuszToast({...})
  window.__opuszToast = toast;

  /* ── feeds ────────────────────────────────────────────────────────────── */

  // 1) Private messages — fires when the OTHER party sends into a conversation.
  function startMessages(uid) {
    let first = true;
    const lastUpd = {}; // convId -> last updatedAt.seconds we've already accounted for
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid));
    onSnapshot(q, function (snap) {
      snap.docChanges().forEach(function (ch) {
        if (ch.type === 'removed') return;
        const c   = ch.doc.data();
        const id  = ch.doc.id;
        const upd = (c.updatedAt && c.updatedAt.seconds) || 0;
        if (first) { lastUpd[id] = upd; return; }              // baseline only
        if (upd <= (lastUpd[id] || 0)) return;                  // nothing newer
        lastUpd[id] = upd;
        if (upd < SESSION_START - 2) return;                    // predates this visit
        const myRole = (c.customerUid === uid) ? 'customer' : 'musician';
        if (!c.lastSenderRole || c.lastSenderRole === myRole) return; // I sent it
        const isPeer   = (c.peer === true || c.kind === 'peer' || c.subject === '樂手私訊');
        const fromName = myRole === 'customer'
          ? (c.musicianName || '音樂家')
          : (c.customerName || '客戶');
        toast({
          icon: '💬',
          title: fromName,
          text: c.lastMessage || '傳來一則新訊息',
          kind: isPeer ? '樂手社群私訊' : '新訊息',
          href: isPeer
            ? 'musician-community.html'
            : (myRole === 'customer' ? 'customer-profile.html#messages' : 'musician-dashboard.html')
        });
      });
      first = false;
    }, function (err) { console.warn('[notify] messages:', err && err.code); });
  }

  // 2) Platform announcements — siteContent/announcements.items[]
  function startAnnouncements() {
    const KEY = 'opusz_notify_seen_ann';
    let seen = loadSeen(KEY);
    let first = true;
    onSnapshot(doc(db, 'siteContent', 'announcements'), function (snap) {
      const items = (snap.exists() && Array.isArray(snap.data().items)) ? snap.data().items : [];
      if (first) {
        // Baseline: remember everything that already exists, toast none of it.
        items.forEach(function (a) { if (a && a.id) seen.add(a.id); });
        saveSeen(KEY, seen);
        first = false;
        return;
      }
      items.forEach(function (a) {
        if (!a || !a.id || seen.has(a.id)) return;
        seen.add(a.id);
        const icon = a.urgency === 'urgent' ? '🔴' : (a.urgency === 'important' ? '⚠️' : '📢');
        toast({ icon: icon, title: a.title || '平台公告', text: a.body || '', kind: '平台公告', href: '#' });
      });
      saveSeen(KEY, seen);
    }, function (err) { console.warn('[notify] announcements:', err && err.code); });
  }

  // 3) Community posts — new posts by other musicians (musicians only)
  function startPosts(uid) {
    const KEY = 'opusz_notify_seen_post';
    let seen = loadSeen(KEY);
    let first = true;
    const q = query(collection(db, 'posts'), orderBy('ts', 'desc'), limit(8));
    onSnapshot(q, function (snap) {
      if (first) {
        snap.forEach(function (d) { seen.add(d.id); });
        saveSeen(KEY, seen);
        first = false;
        return;
      }
      snap.docChanges().forEach(function (ch) {
        if (ch.type !== 'added') return;
        const id = ch.doc.id;
        if (seen.has(id)) return;
        seen.add(id);
        const p  = ch.doc.data();
        if (p.authorUid === uid) return;                         // my own post
        const ts = (p.ts && p.ts.seconds) || 0;
        if (ts && ts < SESSION_START - 2) return;                // predates this visit
        toast({
          icon: '🎵',
          title: (p.authorName || '樂手') + ' 在社群發文',
          text: p.content || '',
          kind: p.isOfficial ? '社群官方公告' : '樂手社群',
          href: 'musician-community.html'
        });
      });
      saveSeen(KEY, seen);
    }, function (err) { console.warn('[notify] posts:', err && err.code); });
  }

  // 4) Public commissions — new open jobs (musicians only)
  function startJobs(uid) {
    const KEY = 'opusz_notify_seen_job';
    let seen = loadSeen(KEY);
    let first = true;
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'), limit(8));
    onSnapshot(q, function (snap) {
      if (first) {
        snap.forEach(function (d) { seen.add(d.id); });
        saveSeen(KEY, seen);
        first = false;
        return;
      }
      snap.docChanges().forEach(function (ch) {
        if (ch.type !== 'added') return;
        const id = ch.doc.id;
        if (seen.has(id)) return;
        seen.add(id);
        const j = ch.doc.data();
        if (j.uid === uid) return;                               // my own posting
        const t = Date.parse(j.createdAt || '');
        if (t && Math.floor(t / 1000) < SESSION_START - 2) return;
        const title = j.ensemble || j.type || '新的演出需求';
        toast({
          icon: '💼',
          title: '新的公開接案',
          text: title + (j.location ? ' · ' + j.location : ''),
          kind: '公開委託',
          href: 'recent-jobs.html'
        });
      });
      saveSeen(KEY, seen);
    }, function (err) { console.warn('[notify] jobs:', err && err.code); });
  }

  /* ── boot once auth resolves ──────────────────────────────────────────── */
  onAuthStateChanged(auth, async function (user) {
    if (!user || user.isAnonymous) return;          // ignore logged-out / anon job sessions
    if (window.__opuszNotifyStarted) return;
    window.__opuszNotifyStarted = true;
    const uid = user.uid;

    // Everyone (customer + musician) gets messages + platform announcements.
    startMessages(uid);
    startAnnouncements();

    // Community + job-board notifications are relevant to musicians only.
    let isMusician = false;
    try {
      const m = await getDoc(doc(db, 'musicians', uid));
      isMusician = m.exists();
    } catch (e) { /* default: not a musician */ }
    if (isMusician) {
      startPosts(uid);
      startJobs(uid);
    }
  });
}
