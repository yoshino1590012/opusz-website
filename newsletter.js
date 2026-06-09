/**
 * OPUS.Z — newsletter subscription capture.
 * Replaces the old (dead) Netlify form handling. Intercepts any newsletter
 * form on the page and writes the email into Firestore `subscribers`, keyed by
 * the lowercased email so re-subscribing never creates duplicates.
 * Anonymous auth (same pattern as inquiries/jobs). Self-contained: inits its
 * own Firebase app only if one isn't already present on the page.
 */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDe_1bECi6uRHqiUwIUb1hcJdixILUir4s",
  authDomain: "opusz-45280.firebaseapp.com",
  projectId: "opusz-45280",
  storageBucket: "opusz-45280.firebasestorage.app",
  messagingSenderId: "304745430147",
  appId: "1:304745430147:web:e2900cb48d5726e5c12fb6",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Use the email itself as the document id (slashes are the only forbidden char
// in Firestore ids and emails can't contain them) → automatic de-duplication.
function emailKey(email) {
  return email.trim().toLowerCase();
}

async function subscribe(email, source) {
  if (!auth.currentUser) await signInAnonymously(auth);
  const key = emailKey(email);
  await setDoc(
    doc(db, "subscribers", key),
    {
      email: key,
      source: source || (location.pathname || "/"),
      lang: (document.documentElement.lang || "").toLowerCase().startsWith("zh") ? "zh" : "en",
      createdAt: new Date().toISOString(),
      status: "subscribed",
    },
    { merge: true }
  );
}

function wire(form) {
  if (!form || form.__opzWired) return;
  form.__opzWired = true;
  form.setAttribute("novalidate", "novalidate");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"], input[name="email"]');
    const email = input && input.value ? input.value.trim() : "";
    if (!email || email.indexOf("@") < 1) {
      if (input) { input.focus(); }
      return;
    }
    const btn = form.querySelector('button[type="submit"], button, .submit-btn');
    const prev = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.dataset.prev = prev; btn.textContent = "…"; }
    try {
      await subscribe(email, form.getAttribute("name") || "");
      // Keep the existing success-page UX.
      window.location.href = "/newsletter-success.html";
    } catch (err) {
      console.error("subscribe failed:", err);
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.prev || prev || "SUBSCRIBE"; }
      alert("訂閱失敗，請稍後再試一次。\nSubscription failed, please try again.");
    }
  });
}

// ── Contact "Contact Us" form → Firestore `inquiries` (kind:contact) ──────────
// A Cloud Function emails the company inbox (info@opuszmusic.com) on create.
async function sendContact(fields) {
  if (!auth.currentUser) await signInAnonymously(auth);
  await addDoc(collection(db, "inquiries"), {
    kind: "contact",
    name: fields.name || "",
    email: fields.email || "",
    subject: fields.subject || "",
    category: fields.category || "",
    message: fields.message || "",
    source: location.pathname || "/",
    createdAt: new Date().toISOString(),
    read: false,
  });
}

function wireContact(form) {
  if (!form || form.__opzWired) return;
  form.__opzWired = true;
  form.setAttribute("novalidate", "novalidate");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const get = (n) => { const el = form.querySelector('[name="' + n + '"]'); return el && el.value ? el.value.trim() : ""; };
    const name = get("name"), email = get("email");
    if (!name) { const el = form.querySelector('[name="name"]'); if (el) el.focus(); return; }
    if (!email || email.indexOf("@") < 1) { const el = form.querySelector('[name="email"]'); if (el) el.focus(); return; }
    const btn = form.querySelector('button[type="submit"], button');
    const prev = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.dataset.prev = prev; btn.textContent = "傳送中… / Sending…"; }
    try {
      await sendContact({ name, email, subject: get("subject"), category: get("category"), message: get("message") });
      const succ = form.querySelector(".cp-success") || document.getElementById("cpSuccess");
      if (succ) { succ.style.display = "block"; succ.classList.add("show"); }
      form.reset();
      if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.prev || prev; }
      if (!succ) alert("✓ 訊息已送出，我們會盡快回覆。\nMessage sent — we'll get back to you soon.");
    } catch (err) {
      console.error("contact send failed:", err);
      if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.prev || prev; }
      alert("傳送失敗，請稍後再試。\nFailed to send, please try again.");
    }
  });
}

function init() {
  // Newsletter subscribe forms.
  document
    .querySelectorAll('form[name="newsletter"], form[name="newsletter-footer"]')
    .forEach(wire);
  // "Contact Us" forms.
  document.querySelectorAll('form[name="contact"]').forEach(wireContact);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
