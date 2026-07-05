/* ============================================================================
 * media-sync.js — makes owner-uploaded media truly local = live.
 * ----------------------------------------------------------------------------
 * The older editors (blog, shows, musician profile, services, etc.) save images
 * as data: URLs into localStorage, which is per-browser/per-origin — so they
 * never appear on the live site. This bridges that:
 *
 *   1) RESTORE (everyone): on load, pull the published media map from Firestore
 *      (siteContent/media) and write any missing entries back into localStorage,
 *      so the page's existing render code shows the images (incl. on the live site).
 *   2) AUTO-PUBLISH (admin only): when a data: URL is written to localStorage
 *      (i.e. the owner uploads a photo in an editor), upload it to Firebase
 *      Storage and record its public URL in Firestore — so it goes live everywhere.
 *   3) MIGRATE (admin, one-time): window.opzMigrateMedia() publishes everything
 *      already sitting in localStorage.
 *
 * Storage path siteContent/media/* and Firestore doc siteContent/media are both
 * writable by the admin under the existing security rules — no rule changes needed.
 *
 * Include on every page:  <script type="module" src="media-sync.js"></script>
 * ==========================================================================*/
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref as sRef, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDe_1bECi6uRHqiUwIUb1hcJdixILUir4s",
  authDomain: "opusz-45280.firebaseapp.com",
  projectId: "opusz-45280",
  storageBucket: "opusz-45280.firebasestorage.app",
  messagingSenderId: "304745430147",
  appId: "1:304745430147:web:e2900cb48d5726e5c12fb6"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const MEDIA_DOC = doc(db, 'siteContent', 'media');
// matches any base64 image/video data URL
const DATAURL_RE = /data:(?:image|video)\/[A-Za-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;
// Per-user / session state (login name, customer city/intro/avatar, bookings,
// language…) all use the `opusz_` prefix. These are NOT shared site media and
// must NEVER be synced to the global media doc or restored across devices/
// accounts — doing so leaked one customer's avatar/city onto everyone else.
const IS_USER_KEY = function(k){ return /^opusz_/.test(String(k)); };

// ── 1) RESTORE published media into localStorage so existing render code shows it ──
(async function restore(){
  try{
    const snap = await getDoc(MEDIA_DOC);
    if(!snap.exists()) return;
    const map = snap.data() || {};
    let changed = false;
    Object.keys(map).forEach(function(k){
      if(IS_USER_KEY(k)) return;   // never restore per-user/session state from the shared map
      try{ if(localStorage.getItem(k) == null){ localStorage.setItem(k, map[k]); changed = true; } }catch(e){}
    });
    // Pages render from localStorage at parse time, and this async restore finishes
    // AFTER that first paint. We used to `location.reload()` here so the render code
    // would pick up the just-filled media — but to a first-time visitor (empty
    // localStorage, e.g. scanning the QR on a new phone) that looked like the site
    // "refreshed itself" for no reason. Instead, re-render in place WITHOUT reloading:
    // fire an event pages can listen for, and call the known render hooks if present.
    if(changed){
      try { window.dispatchEvent(new CustomEvent('opusz-media-restored')); } catch(e){}
      ['opzRenderPartners','opzRenderAll','opzApplyContent','renderAll'].forEach(function(fn){
        try { if (typeof window[fn] === 'function') window[fn](); } catch(e){}
      });
    }
  }catch(e){ console.warn('[media-sync] restore failed:', e); }
})();

// ── 2)+3) PUBLISH: upload any data: URLs in a value, swap them for public URLs ──
let _mapCache = null;
async function loadMap(){
  if(_mapCache) return _mapCache;
  try{ const s = await getDoc(MEDIA_DOC); _mapCache = s.exists() ? (s.data()||{}) : {}; }
  catch(e){ _mapCache = {}; }
  return _mapCache;
}
async function publishValue(key, value){
  if(!auth.currentUser) return false;                 // only the signed-in admin can publish
  if(typeof value !== 'string') return false;
  const matches = value.match(DATAURL_RE);
  let out = value;
  if(matches){
    // Has embedded blob(s): upload each, swap data: URL → public Storage URL.
    for(let i=0;i<matches.length;i++){
      const dataUrl = matches[i];
      const ext = (dataUrl.slice(5).split(';')[0].split('/')[1] || 'bin').replace(/[^a-z0-9]/gi,'');
      const path = 'siteContent/media/' + key.replace(/[^\w.-]/g,'_') + '_' + i + '.' + ext;
      const r = sRef(storage, path);
      await uploadString(r, dataUrl, 'data_url');
      const url = await getDownloadURL(r);
      out = out.split(dataUrl).join(url);
    }
    try{ _origSet(key, out); }catch(e){}               // local now holds the URL, not the blob
  } else if(value.indexOf('data:') >= 0){
    return false;                                       // looks like a blob but no full match → skip (safety)
  }
  // Persist to the cloud map. This covers BOTH blob-swapped values AND
  // settings-only values (e.g. blog photo position/zoom with a public URL),
  // so framing changes reach live + other devices too.
  const map = await loadMap();
  map[key] = out;
  await setDoc(MEDIA_DOC, map, { merge:true });
  return true;
}

// ── auto-publish future edits: intercept localStorage writes that contain media ──
const _origSet = localStorage.setItem.bind(localStorage);
const _timers = {};
localStorage.setItem = function(k, v){
  _origSet(k, v);
  // Sync when the value carries media (data: URL) OR when it's a blog photo entry —
  // blog photos store {url,x,y,zoom}; position/zoom edits have no data: URL but still
  // need to reach the cloud so the live site and other devices stay in sync.
  if(typeof v === 'string' && !IS_USER_KEY(k) && ((v.indexOf('data:') >= 0 && /image|video/.test(v.slice(0,40))) || k.indexOf('blog-photo:')===0)){
    clearTimeout(_timers[k]);
    _timers[k] = setTimeout(function(){
      publishValue(k, v).catch(function(e){ console.warn('[media-sync] publish failed:', k, e); });
    }, 700);
  }
};

// ── one-time migration of everything already in localStorage (run as admin) ──
window.opzMigrateMedia = async function(){
  if(!auth.currentUser) return { error: 'NOT signed in as admin — log in first' };
  const keys = []; for(let i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
  const uploaded = [], failed = [];
  for(const k of keys){
    if(IS_USER_KEY(k)) continue;   // never migrate per-user/session state
    const v = localStorage.getItem(k) || '';
    if(v.indexOf('data:') >= 0 && /image|video/.test(v)){
      try{ await publishValue(k, v); uploaded.push(k); }
      catch(e){ failed.push(k + ': ' + (e.code||e.message)); }
    }
  }
  return { admin: auth.currentUser.email, uploaded, failed };
};
