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
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        participants:   [opts.customerUid, opts.musicianUid],
        customerUid:    opts.customerUid,
        musicianUid:    opts.musicianUid,
        customerName:   opts.customerName || '',
        musicianName:   opts.musicianName || '',
        subject:        opts.subject || '直接訊息',
        brief:          opts.brief || null,
        lastMessage:    '',
        lastSenderRole: '',
        customerUnread: 0,
        musicianUnread: 0,
        updatedAt:      serverTimestamp()
      });
    } else if (opts.subject || opts.brief) {
      // refresh subject/brief if a richer context was provided
      const patch = {};
      if (opts.subject) patch.subject = opts.subject;
      if (opts.brief)   patch.brief   = opts.brief;
      if (Object.keys(patch).length) { try { await updateDoc(ref, patch); } catch (e) {} }
    }
    return id;
  },

  // ── live list of my conversations ──
  listConversations(uid, cb) {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', uid),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, function (snap) {
      const rows = [];
      snap.forEach(function (d) { rows.push(Object.assign({ id: d.id }, d.data())); });
      cb(rows);
    }, function (err) { console.warn('[messaging] listConversations:', err); cb([]); });
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
  }
};

window.OPUSZ_MSG = OPUSZ_MSG;
window.dispatchEvent(new Event('opusz-msg-ready'));
