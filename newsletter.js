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
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

function init() {
  // Match the newsletter forms (name="newsletter" or "newsletter-footer").
  document
    .querySelectorAll('form[name="newsletter"], form[name="newsletter-footer"]')
    .forEach(wire);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
