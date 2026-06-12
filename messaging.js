/* ============================================================================
   OPUS.Z — Shared messaging engine (real Firestore)
   Loaded as <script type="module" src="messaging.js"> on any page that needs
   conversations. Exposes window.OPUSZ_MSG and fires `opusz-msg-ready` once the
   Firebase app + auth are initialised.

   Data model
     conversations/{convId}
       participants: [customerUid, musicianUid]   // for array-contains queries
       customerUid, musicianUid
       customerName, musicianName
       subject                                     // topic / first point of contact
       brief: {type,date,location,budget,notes}    // optional commission brief
       deal:  {kind,plan,planKey,price,feePct,     // the live "proposal" / escrow contract
               status,terms,funded,released,updatedAt}
              // kind: 'lesson'|'perf' ; price = the all-in public price the client pays
              // feePct: platform cut (lesson 10, perf 15) ; musician keeps price*(1-feePct/100)
              // status: 'pending'  → client quote draft, awaiting client confirm+pay
              //         'active'   → confirmed & funded into escrow, work in progress
              //         'completed'→ work done, awaiting release
              //         'released' → paid out to the musician
              //         'cancelled'
              // funded/released: amounts (numbers) — manually marked for now, money rail later
       lastMessage, lastSenderRole, updatedAt
       customerUnread, musicianUnread              // simple per-side unread counts
     conversations/{convId}/messages/{msgId}
       senderUid, senderRole ('customer'|'musician'), type ('msg'|'sys'),
       text, file {url,name} (optional), createdAt

   convId is deterministic per (customer, musician) pair so messaging the same
   musician again reuses one thread.
   ========================================================================== */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDe_1bECi6uRHqiUwIUb1hcJdixILUir4s",
  authDomain: "opusz-45280.firebaseapp.com",
  projectId: "opusz-45280",
  storageBucket: "opusz-45280.firebasestorage.app",
  messagingSenderId: "304745430147",
  appId: "1:304745430147:web:e2900cb48d5726e5c12fb6"
};

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

let _uid = null;
const _authCbs = [];

onAuthStateChanged(auth, function (user) {
  _uid = user ? user.uid : null;
  _authCbs.forEach(function (cb) { try { cb(_uid); } catch (e) {} });
});

function convIdFor(customerUid, musicianUid) {
  return 'c_' + customerUid + '__m_' + musicianUid;
}

const OPUSZ_MSG = {
  // ── identity ──
  currentUid: function () { return _uid; },
  onAuth: function (cb) { _authCbs.push(cb); if (_uid !== null) { try { cb(_uid); } catch (e) {} } },

  // ── create / open a conversation (idempotent per customer–musician pair) ──
  async startConversation(opts) {
    // opts: {customerUid, customerName, musicianUid, musicianName, subject, brief}
    const id  = convIdFor(opts.customerUid, opts.musicianUid);
    const ref = doc(db, 'conversations', id);
    // NOTE: a get() on a NON-EXISTENT conversation evaluates the read rule with
    // resource == null, so `uid in resource.data.participants` errors → permission
    // denied. That used to block creation entirely. Treat a failed/empty read as
    // "doesn't exist yet" and proceed to create.
    let exists = false, snap = null;
    try { snap = await getDoc(ref); exists = snap.exists(); } catch (e) { exists = false; }
    if (!exists) {
      await setDoc(ref, {
        participants:   [opts.customerUid, opts.musicianUid],
        customerUid:    opts.customerUid,
        musicianUid:    opts.musicianUid,
        customerName:   opts.customerName || '',
        musicianName:   opts.musicianName || '',
        subject:        opts.subject || '直接訊息',
        brief:          opts.brief || null,
        deal:           opts.deal  || null,
        lastMessage:    '',
        lastSenderRole: '',
        customerUnread: 0,
        musicianUnread: 0,
        updatedAt:      serverTimestamp()
      });
    } else if (opts.subject || opts.brief || opts.deal) {
      // refresh subject/brief if a richer context was provided
      const patch = {};
      if (opts.subject) patch.subject = opts.subject;
      if (opts.brief)   patch.brief   = opts.brief;
      if (opts.deal) {
        // Re-sending a booking refreshes the DRAFT quote, but never clobbers a deal
        // that's already been confirmed/paid/finished.
        const curDeal = (snap && snap.exists()) ? snap.data().deal : null;
        const locked  = curDeal && ['active','completed','released'].indexOf(curDeal.status) > -1;
        if (!locked) patch.deal = opts.deal;
      }
      if (Object.keys(patch).length) { try { await updateDoc(ref, patch); } catch (e) {} }
    }
    return id;
  },

  // ── live list of my conversations ──
  listConversations(uid, cb) {
    // No orderBy → avoids needing a composite index (array-contains + updatedAt).
    // We sort client-side instead.
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', uid)
    );
    return onSnapshot(q, function (snap) {
      const rows = [];
      snap.forEach(function (d) { rows.push(Object.assign({ id: d.id }, d.data())); });
      rows.sort(function (a, b) {
        var ta = (a.updatedAt && a.updatedAt.seconds) || 0, tb = (b.updatedAt && b.updatedAt.seconds) || 0;
        return tb - ta;
      });
      cb(rows);
    }, function (err) { console.warn('[messaging] listConversations:', err); cb([]); });
  },

  // ── live list of the public commissions (jobs) I posted ──
  listMyJobs(uid, cb) {
    if (!uid) { cb([]); return function(){}; }
    const q = query(collection(db, 'jobs'), where('uid', '==', uid));
    return onSnapshot(q, function (snap) {
      const rows = [];
      snap.forEach(function (d) { rows.push(Object.assign({ id: d.id }, d.data())); });
      rows.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
      cb(rows);
    }, function (err) { console.warn('[messaging] listMyJobs:', err); cb([]); });
  },

  // ── live messages within a conversation ──
  listenMessages(convId, cb) {
    const q = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, function (snap) {
      const rows = [];
      snap.forEach(function (d) { rows.push(Object.assign({ id: d.id }, d.data())); });
      cb(rows);
    }, function (err) { console.warn('[messaging] listenMessages:', err); cb([]); });
  },

  // ── send a message ──
  async sendMessage(convId, msg) {
    // msg: {text, file?, senderRole, type?}
    if (!_uid) throw new Error('not-signed-in');
    const role = msg.senderRole;
    await addDoc(collection(db, 'conversations', convId, 'messages'), {
      senderUid:  _uid,
      senderRole: role,
      type:       msg.type || 'msg',
      text:       msg.text || '',
      file:       msg.file || null,
      createdAt:  serverTimestamp()
    });
    const otherUnread = role === 'customer' ? 'musicianUnread' : 'customerUnread';
    const patch = {
      lastMessage:    (msg.type === 'sys') ? msg.text : (msg.text || (msg.file ? '📎 附件' : '')),
      lastSenderRole: role,
      updatedAt:      serverTimestamp()
    };
    patch[otherUnread] = increment(1);
    try { await updateDoc(doc(db, 'conversations', convId), patch); } catch (e) {}
  },

  // ── reset my unread counter on a conversation ──
  async markRead(convId, role) {
    const field = role === 'customer' ? 'customerUnread' : 'musicianUnread';
    const patch = {}; patch[field] = 0;
    try { await updateDoc(doc(db, 'conversations', convId), patch); } catch (e) {}
  },

  // ── update the deal / proposal on a conversation (merge patch into deal) ──
  // patch: partial deal fields, e.g. {status:'active'} or {plan,planKey,price,feePct}
  // opts:  {sysText?, fromRole?}  — when sysText is given, also posts a system message
  //        (which bumps the other side's unread + updatedAt) so both ends get notified.
  async setDeal(convId, patch, opts) {
    opts = opts || {};
    const ref = doc(db, 'conversations', convId);
    let cur = {};
    try { const s = await getDoc(ref); const dd = s.exists() && s.data().deal; if (dd) cur = dd; } catch (e) {}
    const deal = Object.assign({}, cur, patch, { updatedAt: new Date().toISOString() });
    try { await updateDoc(ref, { deal: deal, updatedAt: serverTimestamp() }); }
    catch (e) { console.warn('[messaging] setDeal:', e); return; }
    if (opts.sysText) {
      try { await this.sendMessage(convId, { text: opts.sysText, senderRole: opts.fromRole || 'customer', type: 'sys' }); } catch (e) {}
    }
  }
};

window.OPUSZ_MSG = OPUSZ_MSG;
window.dispatchEvent(new Event('opusz-msg-ready'));
