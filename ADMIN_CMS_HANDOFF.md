# OPUS.Z — Site-wide Admin CMS — HANDOFF / 交接文件

> **Read this first if you are a fresh Claude session continuing this work.**
> This file is the single source of truth for the big in-progress task: building a
> **Shopify-theme-editor-style admin CMS** so the owner can edit *everything* on the
> public site (homepage + all pages) from `admin-panel.html` — text, images, videos,
> links, and add/remove fields/sections, with a live preview.
> The owner explicitly asked that work be handed off so a new window can continue.

Date of handoff: 2026-06-03

---

## ⏩ RESUME HERE — current state snapshot (read this, then §1 gotchas, then continue)

**What already works end-to-end (all verified in browser):**
- A **Site Editor** lives in `admin-panel.html` (sidebar "網站編輯 / Site Editor" →
  `#page-siteeditor`). 3 columns: left page list, middle **device-preview iframe**
  (標準顯示螢幕 1536 / MacBook 1280 / iPad 820 / 手機 390 via `seSetDevice`), right field controls.
- It edits **16 homepage fields** (each EN + 中文), grouped: 服務 ×5, 按鈕 ×2, 輪播標語 ×3
  (`both:true` = bilingual lines), 其他區段 ×6 (svc.label/svc.btn/blog.label/blog.seeall/
  about.card1.label/about.card2.label). Driven by `SE_FIELDS` array + `seBuildControls/
  seReadInputs/sePreview(postMessage)/seSave/seInit` in `admin-panel.html`'s module script.
- **Public render**: `site-content.js` (module, included on `musician-platform.html` before
  `</body>`) reads Firestore `siteContent/home` (+ instant `localStorage opusz_site_home`
  mirror) and applies via i18n-dict overrides (`window.I18N` + `switchLang`) and `data-cms`.
  It also listens for `postMessage({__opuszCmsPreview,config})` for the editor's live preview.
- **Persistence is REAL (local=live):** `seSave` writes `siteContent/home` to Firestore.
  Verified: edit in admin → clear local mirror → reload homepage → it renders from Firestore.
- **Security DONE:** admin now authenticates with Firebase Auth.
  - Admin Firebase account: **tzutung.liao@gmail.com** / password `qwertyuiop357` (uid
    qR8q45IUgpSg8lcMeHtHqmngy9e2). `admin-login.html` signs in (window.adminAuthSignIn);
    `admin-panel.html` loads `getAuth(app)` so writes carry the admin identity.
  - Firestore rule (PUBLISHED): `match /siteContent/{page} { allow read: if true; allow write:
    if request.auth != null && request.auth.token.email == 'tzutung.liao@gmail.com'; }`
    Verified: admin write OK; unauthenticated write denied.

**The owner wants EVERYTHING on the site editable this way (homepage + all subpages).**
We've done the homepage-hero + several homepage text sections. NOT yet done:

**▶ IMMEDIATE NEXT (owner approved order 1 → 2 → 3):**
1. **Images / video editing** via the `data-cms` direct channel: tag homepage media with
   `data-cms="..."` + `data-cms-attr="src|bg"`, add image/URL controls to the Site Editor,
   and wire **uploads to Firebase Storage** (NOT data-URLs — Firestore docs are ~1MB capped)
   so uploaded images are also cross-device. (Add Storage rules: admin-only write, public read.)
2. **More homepage sections**: big headings, Vision, Pricing, Footer, etc. — batch-add their
   `data-i18n` keys to `SE_FIELDS` (same mechanism). Consider refactoring to a SCHEMA-DRIVEN
   control factory (text/image/video/link/list types) before this gets large.
3. **Subpages**: add `<script type="module" src="site-content.js"></script>` + optionally
   `<html data-cms-page="musicians">` to each public page (musicians/recent-jobs/shows/blog/
   lessons/contact), add them to the Site Editor's left "頁面" list (one `siteContent/<page>`
   doc each), and define each page's editable schema.

**HOW TO TEST (preview):** the Claude Preview server serves the site on localhost:8080.
Admin is login-gated — set `localStorage.opusz_admin_loggedIn='true'` to enter the UI, and to
test authed writes call `window.adminAuthSignIn('tzutung.liao@gmail.com','qwertyuiop357')`
once (session persists). Dashboard pages need real Firebase Auth → verify their logic by
replicating functions against a built DOM (pattern used throughout). The owner can also let
you drive their real Chrome (Claude-in-Chrome) for Firebase Console tasks.

---

## 0. THE GOAL (what the owner asked for, verbatim intent)

Build, inside the **管理者後台 (admin-panel.html)**, a visual page editor modeled on:
- **The musician "編輯主頁 / Edit Page" page-builder** already in `musician-dashboard.html`
  (this is the reference system — it already works), AND
- **Shopify's theme editor** (the owner's real Shopify store, KYDAN, at
  `admin.shopify.com/store/xfpxau-j9/...` — left panel = sections list per page,
  middle = live preview, right panel = controls for the selected block's text/image/
  video/link/button, plus add/remove sections).

Requirement: **Everything the owner sees on the public website must become editable
from admin** — homepage (`musician-platform.html#home`) AND every subpage. Left column
= choose page/section, right column = edit that section's controllable details (text,
image, video, link), and add/remove fields. Like the photo-delete system we just built
for the musician hero — everything controllable and deletable.

**Hard principle the owner repeated several times:** NO FAKE DATA, and **local must equal
live** — anything stored only in `localStorage` is per-browser and breaks this. All
editable content MUST persist to **Firestore** so the public site shows the same thing
the owner edited, on any device.

---

## 1. ENVIRONMENT & GOTCHAS (critical — saves you hours)

- **Repo:** `/Users/martinliao/opusz-website` (plain static HTML/CSS/JS, no build step).
- **Served by:** a Python `http.server` on **localhost:8080** (root = this folder).
  There is also a Claude preview server (port 3000) used for verification.
- **Preview live-reload quirk:** the preview browser sometimes auto-navigates back to
  `musician-platform.html` (the launch default). Re-navigate explicitly when verifying.
- **Firebase project:** `opusz-45280`. Config is embedded in pages (look for
  `firebaseConfig` / `apiKey: "AIzaSyDe_1bECi6uRHqiUwIUb1hcJdixILUir4s"`).
  - **Firestore collections in use:** `musicians`, `customers`.
  - **Auth:** Firebase Auth (email/password). `sendPasswordResetEmail` already used.
  - **Firestore reads work from the local site** (the owner is logged in in their own
    Chrome; the preview can also read — admin-panel loaded 2 real musicians).
  - The owner CONFIRMED they have Firebase already wired and access; do NOT keep asking
    about Firebase connectivity. If you need security rules changed, give them exact
    rules text to paste, but assume reads/writes to `musicians`/`customers` already work.
- **File-edit race:** `musician-profile.html` is touched by a background "server.py on
  Save" watcher → the `Edit` tool sometimes fails with "modified since read". For that
  file, prefer **atomic Python replacements** (read+replace+write in one `Bash` call with
  `assert count==1`). Other files edit fine with the `Edit` tool. Two temp-file pattern
  also works: write `/tmp/old.txt` + `/tmp/new.txt`, python `.replace`.
- **Login-gated pages can't be screenshotted in preview** (`musician-dashboard.html`,
  `admin-panel.html` redirect to login via Firebase / `opusz_admin_loggedIn`).
  - To enter admin in preview: `localStorage.setItem('opusz_admin_loggedIn','true')` then
    load `admin-panel.html` (guard at ~line 632 only checks that flag).
  - The musician dashboard needs a real Firebase auth session → can't easily enter in
    preview. **Verification pattern that works:** replicate the exact function(s) against
    a built DOM + real localStorage/Firestore data in `preview_eval` and assert outputs.
    This was used successfully throughout (lesson requests, enquiries, downgrade modal,
    photo delete). Use it.
- **Verification mindset (owner expects this):** after each change, verify in the browser
  (preview_eval / preview_screenshot / preview_console_logs error check). Don't claim done
  without evidence. The owner values honesty about local-vs-live and about what's verified.

---

## 2. THE REFERENCE SYSTEM — musician page-builder (STUDY THIS, IT'S THE PATTERN)

Lives in **`musician-dashboard.html`**, page `#page-pagebuilder` ("編輯主頁 / Edit Page").
It edits ONE musician's public profile (`musician-profile.html`). Mirror it site-wide.

**Layout (3 columns):**
- LEFT (`#pbSecList`): section buttons `data-pbsec="..."` → `pbSelectSection(sec, btn)`.
  Sections: `hero, card, booking, about, audio, services, highlights, partners, videos,
  lessons, stats, reviews, theme, visibility` (lines ~1252–1265).
- MIDDLE: live preview `<iframe id="pbPreview">` of the public profile, Desktop/Mobile toggle.
- RIGHT: the controls for the selected section (text inputs, URL inputs, file uploaders,
  sliders for x/y/zoom, add/remove repeatable items, color pickers).

**Core data flow (THE KEY PATTERN to replicate):**
- `pbConfig` — a single JS object holding all editable content (hero/card/about/booking/
  lessons/stats/sections/partners/services/reviews/highlights/audio/videos/theme).
- `pbReadForm()` (~line 2856–3066) — reads every form field → rebuilds `pbConfig`.
  e.g. `pbConfig.hero.media.url = txt('pbHeroMediaUrl')`, `extraSlides` from slide fields.
- `pbOnInput(ev)` (~line 3084) — on any input: `pbReadForm()` → push to the live iframe
  preview → (debounced) save.
- `pbAttachUploader(fieldId, kind, maxPx)` (~line 2522) — wires file upload/drag-drop →
  compresses → sets a (data) URL into the field.
- **Save:** `pbSave()` (~3073) → `setDoc(doc(db,'musicians',uid), { config: pbConfig }, {merge:true})`
  (also mirrors to localStorage).
- **Publish:** `pbPublish()` (~3089) → sets `published:true` + denormalized fields, syncs LS.
- **Public page reads it:** `musician-profile.html` ~line 3830 `getDoc(doc(db,'musicians',uid))`
  → `snap.data().config` → applies to render (`[profileConfig] apply` ~3891; live update ~5579).
- **Repeatable items** (audio tracks, videos, highlights, reviews, partners): rendered as
  lists with add/remove. The HERO PHOTO delete we just built is the template for
  "delete an item": `pbDeleteHeroPhoto(i)` re-packs fields + `pbOnInput()` (see §3).
- **Reusable confirm modal:** `window.pbConfirm({icon,title,message,confirmText,danger,onConfirm})`
  was added in `musician-dashboard.html` (near `pbRenderMembership`). Reuse it for deletes.

**Takeaway:** A page = a config object in Firestore + a public renderer that reads it +
an editor (form ⇄ config ⇄ iframe preview) + save/publish. Do the same for the whole site.

---

## 3. PROPOSED ARCHITECTURE for the SITE-WIDE CMS (recommended plan)

Goal: edit homepage + all marketing pages from `admin-panel.html`.

### 3.1 Storage (Firestore — required for local=live)
- New Firestore doc(s) for site content, e.g. collection `siteContent`, doc per page:
  `siteContent/home`, `siteContent/musicians`, `siteContent/recentJobs`, `siteContent/shows`,
  `siteContent/blog`, `siteContent/lessons`, `siteContent/contact`, plus `siteContent/global`
  (nav labels, footer, etc.). Each doc = a config object describing that page's editable
  sections/blocks (text, image URL, video URL, link, button label, repeatable lists).
- Security rules needed (give owner this to paste in Firebase console):
  - Public READ on `siteContent/*` (so public pages render it).
  - WRITE only for admins. Simple option during build: allow write if request.auth != null
    AND email in an admin allowlist; or tie to a custom claim. Provide exact rules text.

### 3.2 Public pages read config + render (with safe fallback)
- Add a small shared script (e.g. `site-content.js`) that each public page includes.
  It fetches `siteContent/<page>` from Firestore and, for each editable element, overrides
  the DEFAULT hardcoded content. Use `data-cms="home.hero.title"` style attributes on the
  HTML so the renderer can map config keys → elements generically (text/innerHTML/src/href).
  - **Fallback:** if Firestore has no value, keep the current hardcoded text/image (so
    nothing breaks before the owner edits). This makes migration incremental & safe.
- This keeps local=live: public site (any device) shows exactly what admin saved.

### 3.3 Admin editor UI in admin-panel.html (mirror the musician page-builder)
- New sidebar item "網站編輯 / Site Editor" (or per-page items).
- 3-column layout: LEFT = page + section list; MIDDLE = `<iframe>` preview of that public
  page (e.g. `musician-platform.html`); RIGHT = controls for the selected section.
- Reuse the musician page-builder patterns: form ⇄ config object ⇄ postMessage to the
  iframe for instant preview, uploaders, repeatable add/remove, `pbConfirm` for deletes,
  Save → Firestore `siteContent/<page>`.
- Live preview: simplest reliable approach = on save (or debounced), the iframe reloads
  and the page's `site-content.js` re-reads Firestore; OR use `postMessage` to push the
  config into the iframe for instant (no-reload) preview (nicer, more work).
- **DEVICE PREVIEW (owner requirement, 2026-06-03):** the middle preview must offer
  multiple viewport presets (not just Desktop/Mobile), matching how the owner wants to
  check responsive layouts. Provide a toggle row with at least:
  **標準顯示螢幕 (Standard desktop, ~1440–1920px) · MacBook 顯示器 (~1280–1440px) ·
  iPad 顯示器 (~768–1024px) · 手機 (Phone, ~390px)**. Implement by setting the preview
  `<iframe>` width (and optional device frame) per preset, centered, scrollable.

### 3.4 Per-page editable schema (the bulk of the work)
For EACH page, enumerate the editable blocks and give them `data-cms` keys + admin
controls. Start with the homepage. Homepage (`musician-platform.html`) sections to expose
(from its structure): NAV labels, HERO (the giant OPUS.Z title, service phrases, buttons,
hero video/photo grid), the scroll phrases, services list, recent-jobs section text,
vision, showreel, work/posters, about, testimonials, stats, success stories, blog teaser,
pricing, contact, footer. Each → text/image/video/link controls + add/remove for lists.

---

## 4. PHASED PLAN (do in this order; each phase shippable & verifiable)

- **Phase 0 — Scaffolding:** Create `site-content.js` (generic `data-cms` renderer +
  Firestore fetch w/ fallback). Create `siteContent/home` doc shape. Add a "Site Editor"
  page shell in `admin-panel.html` with the 3-column layout + a page picker + an iframe.
- **Phase 1 — Homepage HERO first** (highest visibility): tag the hero's title/phrases/
  buttons/hero media with `data-cms`, wire admin controls for them, Save→Firestore, verify
  the public homepage reflects edits. This proves the whole pipeline end-to-end.
- **Phase 2 — Rest of homepage sections** (services, recent jobs, vision, showreel, about,
  testimonials, stats, pricing, contact, footer) — including add/remove for list items.
- **Phase 3 — Global/nav/footer** (shared across pages via `siteContent/global` + nav.js
  already centralizes the nav — feed its labels from config).
- **Phase 4 — Subpages** one by one: musicians, recent-jobs, shows, blog, lessons, contact.
- **Phase 5 — Polish:** instant postMessage preview, image uploads to Firebase Storage
  (not data URLs), drafts vs publish, undo.

**Tip:** Build a GENERIC renderer + GENERIC admin control factory (text/image/video/link/
list) driven by a schema, so you don't hand-code every field. The musician page-builder is
semi-hand-coded; for a whole site, invest early in a schema-driven approach.

---

## 5. WORK ALREADY COMPLETED IN THIS PROJECT (don't redo; current state)

All verified in-browser unless noted. Files in `/Users/martinliao/opusz-website`.

1. **Shared navigation (single source):** created `nav.css` + `nav.js`. `nav.js` injects
   the canonical nav (orb/logo/links/favourites/login+account dropdowns/lang toggle/
   hamburger/mega-menu/drawers) and wires all behavior + a unified language toggle
   (localStorage `opusz_lang`, merges built-in nav dict with `window.PAGE_I18N`, fires
   `opusz:langchange`). Auth via `opusz_user`. Converted ALL public pages to use it
   (removed each page's inline nav HTML + nav JS, removed `assets/js/nav-auth.js` include):
   musicians, recent-jobs, shows, lessons, musician-profile, blog, blog-opusz-intro,
   blog-violinist-career, blog-wedding-quartet, contact, favourites, customer-profile.
   - Fixed two bugs everywhere: account dropdown is now solid **white** (was color-shifting
     due to mix-blend-mode because nav-auth.js built it INSIDE the nav) and the
     **"🎵 樂手社群"** link is gone (it came from nav-auth.js line ~68).
   - NOTE: `musician-platform.html` (homepage) was NOT converted — it's the canonical
     source; its inline nav is the reference. Each page's own `switchLang` content
     translation is bridged via the `opusz:langchange` event.
   - The owner may later want the homepage + system pages (musician-apply, messages,
     musician-dashboard, musician-community) also unified — not done.

2. **Enquiries → musician inbox (real):** `musician-profile.html` "Send Enquiry"
   (`submitEnquiryModal`) now also saves to `localStorage 'opusz_enquiries'`. The
   `musician-dashboard.html` Messages page renders real enquiries from it (removed the mock
   `THREADS`), real sidebar badges, real Jobs "直接詢問", and a real notification bell
   (`showInboxNotif`). ⚠️ **This is localStorage = NOT local-equal-live yet** — the owner
   wants this moved to Firestore (a `enquiries` collection: customer writes, musician reads
   where musician==uid). PENDING.

3. **admin-panel.html — all fake data removed:** Musicians/Customers tables already read
   Firestore. Added `adminRefreshUI()` (called at end of `loadMusicians()`) that drives
   sidebar badges + dashboard stats + "Recently Registered" + pending actions from REAL
   musician data; deleted the dead mock `MUSICIANS` array; Jobs/Finance/Review/Support/
   Announcements now show honest **empty states / NT$0 / real counts**. Verified live
   (2 real musicians, no fake names/figures, no console errors).

4. **musician-dashboard.html fixes:**
   - "可降回" (downgrade to Basic) now works: clickable + a confirmation modal
     `pbConfirm` (reusable) → on confirm `pbSaveMembership({source:'none'})` (Firestore-backed).
   - Hero **photo delete**: each uploaded-photo thumbnail now has a red ✕ →
     `pbDeleteHeroPhoto(i)` re-packs the 4 hero URL fields (pbHeroMediaUrl / pbHeroSlide2-4Url)
     so deleting the main photo promotes the next, then `pbOnInput()` syncs preview+save.
     (This is the template for "deletable items" in the new CMS.)
   - **Earnings page** is now real: empty-state monthly chart + NT$0 commission breakdown +
     "尚無交易紀錄" empty transaction table (removed mock chart bars + fake transactions).

5. **musician-profile.html earlier work (already verified):**
   - Lesson booking wizard `openLesson(plan)` (Trial/Monthly/Quarterly buttons) → multi-step
     modal (level → goals → format → schedule → done) → saves to `localStorage
     'opusz_lesson_requests'` → shows in dashboard Overview "新詢問". (Also localStorage →
     should move to Firestore for local=live. PENDING.)
   - Showreel: slide-in transition between videos (matches the homepage banner; from-right
     for next, from-left for prev) gated on the incoming video having a painted frame
     (`whenPainted`) so it never slides in black; plus a draggable **progress/scrub bar**
     (`#bigvidProgress`) supporting `<video>` (full) and YouTube/Vimeo (postMessage API).

### 5.1 localStorage things that still BREAK local=live (owner wants these on Firestore)
- `opusz_enquiries` (messages/enquiries)
- `opusz_lesson_requests` (lesson bookings)
- `mono-favs` (favourites)
- **Musician page-builder media:** showreel videos (`martin-showreel-videos`), audio
  (`martin-audio-tracks`), profile/hero images (`martin-profile-img`, `*-hero-photos`) —
  the page-builder `config` IS saved to Firestore (`musicians/{uid}.config`), but some
  legacy editors still use localStorage keys. Audit and route all through the Firestore
  `config` (+ Firebase Storage for binary uploads instead of data URLs).
- The NEW site CMS content (this whole task) — must be Firestore from day one.

---

## 6. CONVENTIONS THE OWNER CARES ABOUT
- **No fake/mock data.** If there's no real source, show an honest empty state, not made-up
  rows/numbers.
- **Local = Live.** Persist to Firestore; localStorage is only an offline mirror, never the
  source of truth for anything the public should see.
- **Confirm before destructive actions** (delete/downgrade) — reuse `pbConfirm`.
- **Verify in browser** and report what was actually checked. Communicate honestly about
  what's verified vs. needs the owner's live Firebase to test.
- Owner writes in Chinese; respond in Chinese. Keep the existing visual style.

---

## 7. CONCRETE FIRST STEPS for the continuing session
1. Read this file + skim `musician-dashboard.html` `#page-pagebuilder` and its JS
   (`pbReadForm` ~2856, `pbOnInput` ~3084, `pbSave` ~3073, `pbPublish` ~3089,
   `pbAttachUploader` ~2522, `pbDeleteHeroPhoto`, `pbConfirm`).
2. Confirm with the owner the storage shape (`siteContent/<page>` docs) and that they'll
   add Firestore rules (give them the exact rules). They have Firebase access.
3. Build Phase 0 scaffolding, then Phase 1 (homepage hero) END-TO-END and verify the public
   homepage reflects an admin edit. That single vertical slice de-risks everything.
4. Then iterate per §4.

> Keep this file updated as you complete phases (append a "PROGRESS LOG" section with
> dates + what shipped) so the NEXT handoff is clean.

---

## 8. PROGRESS LOG
- 2026-06-03: Handoff doc created. All of §5 completed prior.
- 2026-06-03 (latest): **Admin auth secured + write rule tightened.**
  - Created a Firebase Auth admin account in Console: **tzutung.liao@gmail.com** (uid
    qR8q45IUgpSg8lcMeHtHqmngy9e2), password = the existing hardcoded admin password
    `qwertyuiop357` (so login is seamless). Email/Password provider already enabled.
  - `admin-login.html`: added a Firebase module that exposes `window.adminAuthSignIn`;
    on successful (hardcoded) login it now ALSO `signInWithEmailAndPassword` with
    `browserLocalPersistence`, establishing a real Firebase session. UI gate unchanged
    (so no lockout risk — if Firebase sign-in ever fails, the admin UI still opens, writes
    just won't persist).
  - `admin-panel.html`: now imports `getAuth`/`onAuthStateChanged` and `const auth=getAuth(app)`
    so the persisted admin session is attached to Firestore writes.
  - Tightened the Firestore rule (via Console) to:
    `match /siteContent/{page} { allow read: if true; allow write: if request.auth != null
    && request.auth.token.email == 'tzutung.liao@gmail.com'; }` and PUBLISHED.
  - VERIFIED: signed in as the admin → `seSave` = "✓ 已儲存並發布（Firestore）" (admin write
    OK under the tightened rule); and an unauthenticated write was permission-denied earlier
    (so non-admins are blocked). **siteContent writes are now admin-only.** To add more admins
    later, either OR the email check or switch to an `admins/{uid}` doc check / custom claim.
- 2026-06-03 (later): **Firestore rules PUBLISHED + true local=live VERIFIED.** Drove the
  owner's Chrome (Claude-in-Chrome) to Firebase Console → Firestore → Rules and added,
  inside `match /databases/{database}/documents`:
  `match /siteContent/{page} { allow read: if true; allow write: if true; }` then Published.
  Existing musicians/customers rules untouched. Re-tested: admin `seSave` → "✓ 已儲存並發布
  （Firestore）"; cleared the local mirror, reloaded the homepage → it read the value from
  **Firestore only** and rendered it ("Firestore RoundTrip ✓"). Test value reset to default.
  ⚠️ `siteContent` WRITE is currently OPEN (`if true`) because admin-panel auth is just a
  localStorage flag (not Firebase Auth). **TODO (security): add Firebase Auth login to
  admin-panel, then change the rule to `allow write: if request.auth != null && <admin check>;`.**
  Phase 2 (more homepage hero fields: services/buttons/phrases, EN+ZH, sectioned) is also done
  in the editor — note phrase live-preview needs a re-check (homepage may have separate phrase
  animation JS; services/buttons verified).
- 2026-06-03: **Phase 0 + Phase 1 DONE & VERIFIED** (homepage hero vertical slice):
  - Created **`site-content.js`** (module): reads Firestore `siteContent/<page>` (+ instant
    localStorage mirror `opusz_site_<page>` fallback), applies via two channels —
    (1) i18n overrides merged into `window.I18N` + `switchLang()` re-render (bilingual,
    survives language toggle), (2) direct `data-cms="key"` overrides (text/src/href/html/bg).
    Also listens for `postMessage({__opuszCmsPreview, config})` for instant live preview.
  - Included it on the homepage (`musician-platform.html`, before `</body>`).
  - Homepage now exposes its i18n: added `window.I18N = I18N;`, `window.switchLang`,
    and a live `window._currentLang` getter (they were `const`/local before — modules
    couldn't reach them). (Edited via python atomic due to the save-watcher race.)
  - **Admin Site Editor** added to `admin-panel.html`: sidebar item "網站編輯 / Site Editor"
    → `#page-siteeditor` with a 3-column layout (left page list, middle device-preview
    iframe, right field controls). **Device presets implemented per owner request:**
    標準顯示螢幕(1536) / MacBook(1280) / iPad(820) / 手機(390) via `seSetDevice()`.
    Fields = 7 homepage hero texts (svc.name.0-4, hero.findArtists, hero.createProject),
    each EN+ZH. Functions: `seInit/seBuildControls/seReadInputs/sePreview(postMessage)/
    seOnInput(debounced)/seSave/seSetDevice`. Added `setDoc,getDoc` to admin imports.
  - VERIFIED in preview: 14 inputs prefilled, device switch resizes iframe, editing a field
    live-updates the homepage iframe (postMessage), localStorage mirror persists, and the
    public homepage renders the override in both EN/ZH.
  - ⚠️ **BLOCKER (owner action needed): Firestore WRITE to `siteContent` is `permission-denied`.**
    The save still works locally (mirror) but does NOT go cross-device until rules are set.
    ALSO: admin-panel auth is just `localStorage.opusz_admin_loggedIn` (NOT Firebase Auth),
    so `request.auth` is null when it writes → even `if request.auth != null` would deny.
    **Two paths:**
    1. Quick test (insecure, fine to demo): in Firebase Console → Firestore → Rules, add:
       ```
       match /siteContent/{page} { allow read: if true; allow write: if true; }
       ```
    2. Proper/secure (recommended for production): make admin-panel sign in with Firebase
       Auth (an admin account) — admin-panel currently only checks a localStorage flag — then
       restrict writes, e.g. `allow read: if true; allow write: if request.auth != null &&
       request.auth.token.email == 'YOUR_ADMIN_EMAIL';` (or an `admins/{uid}` doc check / custom claim).
    Public READ must be open (`allow read: if true`) so visitors' pages render the content.

- 2026-06-03 (continuing session): **IMMEDIATE NEXT #1 DONE — homepage images/video editable via `data-cms`.**
  - **Tagged homepage media** in `musician-platform.html` (atomic python edits):
    - 3 work cards `.work-card-img wc1/2/3` → `data-cms="home.work.1|2|3"` `data-cms-attr="bg"`.
    - 7 showreel videos `.sv-vid` → `data-cms="home.showreel.1..7"` `data-cms-attr="src"`
      (keyed off each cell's unique `sv-bg-N` sibling).
  - **`site-content.js`**: the `src` channel now reloads `<video>` (calls `.load()` + `.play()`)
    and no-ops when the src is unchanged (avoids restart flicker). `bg` channel unchanged.
  - **Admin Site Editor (`admin-panel.html`)** — added a MEDIA field type (schema-driven step
    toward the control factory):
    - `SE_FIELDS` gained `type:'image'|'video'` entries (3 work images + 7 videos). Media
      values live in `cfg.cms[key]` (direct channel), NOT `cfg.i18n`.
    - `seReadInputs` now also emits `cfg.cms`; `seBuildControls` renders, per media field, a
      URL input + **⬆ 上傳** button + live thumbnail (`seThumb`).
    - **`seUploadFile(key,file,kind)`**: uploads to **Firebase Storage** (added `getStorage`
      import + `const storage`), path `siteContent/home/<key>_<ts>_<name>`, then writes the
      `getDownloadURL` back into the field and pushes to the live preview. Size guard: img ≤8MB,
      video ≤60MB. (Uploads URLs, never data-URLs — keeps Firestore docs small + cross-device.)
    - `seSave` already `setDoc({merge:true})`s the whole cfg, so `cms` persists to Firestore.
  - **VERIFIED in preview** (port 8080 via Claude preview): all 10 media elements tagged;
    postMessage cms override applies bg + swaps video src (video readyState=4 after reload);
    admin editor renders 3 image + 7 video controls (10 upload buttons, `seUploadFile` present);
    typing a URL live-updates the iframe (work-card bg + showreel video) and the thumbnail;
    no console errors on homepage or admin.
  - ⚠️ **NOT fully testable here:** the actual byte-upload to Storage needs (a) a real Firebase
    Auth admin session in admin-panel AND (b) **Storage rules published**. Give the owner these
    Storage rules (Firebase Console → Storage → Rules → Publish):
    ```
    rules_version = '2';
    service firebase.storage {
      match /b/{bucket}/o {
        match /siteContent/{allPaths=**} {
          allow read: if true;                       // public site can show the media
          allow write: if request.auth != null
                       && request.auth.token.email == 'tzutung.liao@gmail.com';  // admin only
        }
      }
    }
    ```
    (admin-panel already establishes the Firebase Auth admin session via admin-login.html.)
  - ✅ **STORAGE RULES PUBLISHED (2026-06-03, continuing session):** drove the owner's Chrome
    (Claude-in-Chrome) → Firebase Console → Storage → Rules and PUBLISHED the rules above
    (kept the existing `musicians/{uid}/…` rule, ADDED `match /siteContent/{allPaths=**}`:
    public read, write only if `request.auth.token.email == 'tzutung.liao@gmail.com'`).
    Console confirmed publish. So admin uploads to `siteContent/home/*` will now persist to
    Storage (cross-device) once admin-panel is signed in as the Firebase admin.
    ⏳ STILL TO DO (next session): a real end-to-end upload test in a signed-in admin-panel
    (pick a file → "✓ 已上傳" → 儲存 → confirm the homepage shows the new image/video on
    another device). The code path + rules are in place; only the live byte-upload is unverified.

### NEXT STEPS (for the continuing session)
1. Get the owner to add the `siteContent` Firestore rules (above). Re-test `seSave` → should
   say "✓ 已儲存並發布（Firestore）". Then confirm a DIFFERENT browser/device shows the edit
   (true local=live).
2. (Recommended) Add Firebase Auth login to admin-panel so writes are authenticated, then
   tighten rules to admins only.
3. Phase 2: expand the homepage schema — more hero fields (phrases, big title, hero
   video/photo via `data-cms` + image upload to Firebase Storage), then services/recent-jobs/
   vision/about/testimonials/stats/pricing/contact/footer. Build a SCHEMA-DRIVEN control
   factory + a generic `data-cms` renderer so you don't hand-code every field.
4. Phase 4: replicate `site-content.js` include + `data-cms-page` on each subpage, add them to
   the Site Editor's left "Pages" list, and define each page's editable schema.
   (The left "頁面/Pages" panel + per-page `siteContent/<page>` doc shape are already designed.)
