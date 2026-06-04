# OPUS.Z — 部署 / 線上化 / 資料同步 交接文件 (DEPLOY & SYNC HANDOFF)

> **給下一個 Claude 視窗：先讀這份，再讀 `ADMIN_CMS_HANDOFF.md`（CMS 細節）。**
> 這份專講「本地 ↔ 線上 怎麼接」：GitHub、Cloudflare、Firebase、網域、以及今天做的
> `media-sync.js`（把只存在瀏覽器的照片搬上線）。
> 業主（Martin / yoshino1590012）不是工程背景，回答請用中文、白話。

日期：2026-06-04

---

## ⏩ RESUME HERE — 現況快照

**整體架構（誰負責什麼）：**
| 角色 | 服務 | 說明 |
|---|---|---|
| 程式碼倉庫 / 備份 | **GitHub** `github.com/yoshino1590012/opusz-website`（branch `main`） | 所有 HTML/JS/CSS + 圖片檔 |
| 線上主機 | **Cloudflare Pages** 專案 `opusz-website` → `opusz-website.pages.dev` | **push 到 GitHub main 就自動重新部署** |
| 資料庫 / 帳號 / 檔案 | **Firebase** 專案 `opusz-45280` | Firestore（資料）+ Storage（圖片/影片檔）+ Auth（登入） |
| 網域 | **Porkbun** 註冊 `opuszmusic.com` | nameserver 已改成 Cloudflare |
| 舊主機 | ~~Netlify~~ | 已棄用（點數用光），網站已搬離 |

**目前可用：** 網站完整跑在 **https://opusz-website.pages.dev**（內容、照片都在）。

**✅ 今天完成的大事：**
1. **從 Netlify 搬到 Cloudflare Pages**（GitHub 連動、push 自動部署）。
2. **`media-sync.js`**：解決「照片只存在瀏覽器 localStorage、線上看不到」的根本問題。已把 10 張本地照片搬上 Firebase，線上頁面自動還原顯示（blog 已驗證 ✓）。
3. 後台「網站編輯」做成 **Shopify 式區段編輯器**（左清單 ↔ 右欄位 ↔ 中間藍框預覽）。
4. 修好：後台預覽寬度（=真實螢幕）、後台中文亂碼、樂手後台預覽會跳到別頁的問題。

**🔴 還沒做完（IMMEDIATE NEXT）：**
1. ~~**`opuszmusic.com` 網域綁定**~~ ✅ **2026-06-04 已完成**：Cloudflare Pages → `opusz-website` → Custom domains 已加入 `opuszmusic.com`（自動建 CNAME `@` → `opusz-website.pages.dev`）。DNS 已生效、SSL 已簽發，`https://opuszmusic.com` 正常跳轉到 `/musician-platform`。（綁定當下本機 DNS 緩存還是舊 NXDOMAIN，需 flush 或等緩存過期才會在原電腦看到；其他裝置已可開。）可選後續：加 `www.opuszmusic.com`、把 `pages.dev` 設跳轉到正式網域。
2. **逐頁驗證照片**：blog 已確認；還沒一一確認首頁、樂手檔案、音樂家列表、課程頁。
3. **影片連結還沒搬**：`media-sync` 的一次性搬家只處理了 `data:` 圖片。像 `martin-showreel-videos`、`lessons-hero-video`、`mono-hero-video` 這些是 **Cloudinary 網址**存在 localStorage，**還沒搬到雲端** → 那些頁的影片線上可能還看不到（見下方「待辦：影片」）。

---

## 1. 三個「本地 = 線上」的機制（核心觀念）

業主的鐵則：**本地看到的 = 線上看到的**。網站原本很多編輯器把資料存在瀏覽器
`localStorage`（只存在「那一台瀏覽器 + 那一個網址」），所以線上看不到。解法是把資料
搬到「共用空間」(Firebase)。目前有三套：

### (A) 首頁文字/媒體 CMS — `site-content.js` + `siteContent/home`
- 後台「網站編輯 / Site Editor」(`admin-panel.html` 的 `#page-siteeditor`) 編輯 → 存 Firestore `siteContent/home`。
- 公開頁 `musician-platform.html` 載入 `site-content.js` → 讀 `siteContent/home` → 套用
  （i18n 文字 + `data-cms="key"` 直接通道：text/src/href/bg）。
- 區段編輯器：主頁每個區段有 `data-cms-section="hero|services|work|showreel|about|blog|..."`；
  後台預覽用 `?cmsedit=1` 進入編輯模式 → 點區段畫藍框 + 回報選取。

### (B) 全站「舊編輯器的照片」— `media-sync.js` + `siteContent/media`  ★今天新增★
**問題**：blog、樂手檔案、客戶照、各服務圖…這些舊編輯器把圖存成 `data:` base64 放進
`localStorage`（每個網址各自獨立）→ 線上是空的。
**解法**（`media-sync.js`，已加在所有公開頁）：
1. **還原（所有人）**：載入時讀 Firestore `siteContent/media`（一個 `{localStorage key → 值}` 的對照表），把缺的 key 寫回 `localStorage` → 頁面原本的顯示程式就會顯示圖。若有寫入則自動 reload 一次（`sessionStorage` 旗標防無限重載）。
2. **自動發布（限管理者）**：攔截 `localStorage.setItem`，若值含 `data:image/video` → 上傳 Firebase Storage（`siteContent/media/<key>_<i>.<ext>`）→ 取得網址 → 把 localStorage 與 Firestore 對照表都換成網址。**以後換圖自動 local=live**。
3. **一次性搬家**：`window.opzMigrateMedia()`（要先以管理者登入）把現有 localStorage 裡所有 `data:` 圖片一次全搬。今天已跑過，10 張全上去。

> 重點：上傳/發布**只有管理者帳號**（Firebase auth = `tzutung.liao@gmail.com`）做得到，
> 因為 Storage/Firestore 規則限定。一般訪客只會「還原讀取」，不會上傳。

### (C) 樂手個人檔案 — `musicians/{uid}.config`（既有，非今天做）
- `musician-dashboard.html` 的「編輯主頁」存 `musicians/{uid}.config`（Firestore）；
  `musician-profile.html` 讀它。詳見 `ADMIN_CMS_HANDOFF.md` §2。

---

## 2. 部署流程（push → 自動上線）

- **改完程式 → 要上線 → `git push origin main`** → Cloudflare Pages 自動偵測、重新部署
  （約 1–2 分鐘）→ `opusz-website.pages.dev`（及綁定後的 `opuszmusic.com`）更新。
- **圖片/Firestore 資料不需要 push**：那些直接寫進 Firebase，是即時的、跨裝置的。
- 業主希望「改到一段落再統一上傳」→ 可考慮專開一個「上傳視窗」，要上線時在那邊喊
  「上傳」，它就 `git add -A && commit && push`（push 前先列出改了哪些檔讓他確認）。
- Cloudflare Pages 設定：framework=None、build command 空、output dir=根目錄。
- **`_redirects`**（Cloudflare Pages 用）：`/ → /musician-platform.html 200`（首頁）。

---

## 3. 帳號 / 存取（給接手者）

- **GitHub**：`github.com/yoshino1590012/opusz-website`，branch `main`。
- **Cloudflare**：帳號 `Yoshino1590012@gmail.com`；account id `a9c9efa2ee4f1d201b360e21f5c32bfa`；
  Pages 專案 `opusz-website`。
- **Firebase** 專案 `opusz-45280`：
  - 管理者帳號（有寫入權）：**`tzutung.liao@gmail.com`**，密碼 **[已移除 — 不寫在 repo 裡，請向業主索取]**（uid `qR8q45IUgpSg8lcMeHtHqmngy9e2`）。
  - 業主個人帳號：`yoshino1590012@gmail.com`（**沒有** siteContent 寫入權）。
  - 要上傳/發布前，務必在 `localhost:8080/admin-login.html` 用**管理者帳號**登入
    （它會 `signInWithEmailAndPassword` 建立 Firebase 管理者 session）。
- **Porkbun**：註冊商，管理 `opuszmusic.com`（nameserver 已指向 Cloudflare）。

### Firebase 安全規則（目前狀態，已發布）
- **Firestore**：`match /siteContent/{page} { allow read: if true; allow write: if request.auth != null && request.auth.token.email == 'tzutung.liao@gmail.com'; }`（`siteContent/home`、`siteContent/media` 都適用）。`musicians`/`customers` 既有規則未動。
- **Storage**：
  - `match /siteContent/{allPaths=**} { allow read: if true; allow write: if ...== 'tzutung.liao@gmail.com'; }` ← 上傳的媒體放這（`siteContent/media/*`）。
  - `match /musicians/{uid}/{allPaths=**} { allow read: if true; allow write: if request.auth.uid == uid; }`（既有）。
- 👉 因為媒體上傳走 `siteContent/media/*`、管理者是 tzutung，**不需要再改任何規則**。

---

## 4. 網域 `opuszmusic.com` 收尾（最重要的待辦）

現況：nameserver 已是 Cloudflare（`darl.ns.cloudflare.com` / `jamie.ns.cloudflare.com`），
zone 已 active，但**還沒在 Pages 綁定**，所以沒有指向紀錄 → NXDOMAIN。

**收尾步驟：**
1. Cloudflare 後台 → Workers & Pages → `opusz-website` → **Custom domains** 分頁
   → **Set up a custom domain** → 輸入 `opuszmusic.com` → Continue（zone 已在同帳號，會自動建 CNAME）。
2. 等 SSL 憑證簽發（約 5–30 分鐘）→ `opuszmusic.com` 就會指向網站。
3. （可選）也加 `www.opuszmusic.com`；或把 `pages.dev` 設跳轉到正式網域。

**踩過的雷：**
- nameserver 是 **`jamie`**（j-a-mie）不是 jemie——別打錯，Porkbun 會回「unable to assign（typo）」。
- 之前在 Cloudflare 已把舊 Netlify 的 A 紀錄刪掉、改 nameserver、Porkbun 存檔成功。

---

## 5. 重要雷區 / 為什麼有些事卡住（省下大量時間）

- **localStorage 是「每個網址各自獨立」**：`file://`、`localhost:8080`、`opusz-website.pages.dev`
  三個是**不同的儲存空間**。業主的照片在 **`localhost:8080`** 的 localStorage（不是 file://）。
  搬家/驗證都要在 `localhost:8080` 做。這也是 `media-sync.js` 存在的原因。
- **發布媒體要先用管理者登入**（Firebase = tzutung），否則 Storage/Firestore 寫入被拒。
  用 localStorage 旗標 `opusz_admin_loggedIn` 只是 UI 門禁，**不等於** Firebase 登入。
- **Cloudflare Pages 單檔 ≤ 25 MiB**：之前 build 失敗就是 repo 有 >25MB 的大影片
  （`assets/images/Video Exhibition/*`、`assets/videos/hero-scrub*.mp4`）。已 `git rm --cached`
  + 加進 `.gitignore`（本機保留、不上 repo；那些檔沒被網站引用，影片走 Cloudinary）。
- **大小寫敏感**：macOS 本機不分大小寫，Cloudflare(Linux) 分。路徑大小寫要對。
- **Cloudflare 儀表板有時超慢/轉圈圈**：不是壞掉，重整幾次或等一下。
- **用 Claude-in-Chrome 操作時的工具限制**（接手者注意）：
  - `javascript_tool`/`eval` 單次回傳有上限（幾 KB）→ **不能**用它把大圖 base64 讀出來。
  - 瀏覽器「自動下載多檔」會跳權限（在網址列，頁面層工具點不到）→ 不能靠連續下載搬圖。
  - 所以搬大量媒體要走 **瀏覽器直接上傳 Firebase**（`media-sync` 的做法），不要走 eval/下載。
  - 改 Firebase 安全規則 = 動「存取控制」，**業主不在時不要自己改**；今天靠「用管理者登入 +
    走既有規則允許的 `siteContent/*` 路徑」避開了改規則。

---

## 6. 今天改/加的關鍵檔案

- `media-sync.js`（**新**）：上述 (B) 機制；含 `window.opzMigrateMedia()`。已 include 在
  所有公開頁（`musician-platform / blog / blog-* / shows / musicians / lessons /
  musician-profile / customer-profile / recent-jobs / contact / favourites`）。
- `site-content.js`：加了 `data-cms` 的 `src` 對 `<video>` reload、編輯模式
  (`?cmsedit=1`) 的藍框 highlight + 點區段回報。
- `admin-panel.html`：Site Editor 區段選單（`SE_SECTIONS`/`seSelectSection`/`seHighlight`）、
  媒體欄位 + 上傳到 Firebase Storage、預覽寬度=真實螢幕、中文亂碼修正。
- `musician-platform.html`：區段加 `data-cms-section`、媒體加 `data-cms`（work bg / showreel src）。
- `musician-dashboard.html`：`pbLockPreviewNav()` 鎖住「編輯主頁」預覽不被點去別頁。
- `_redirects`（新，Cloudflare）、`.gitignore`（排除大檔）。

---

## 7. 待辦清單（建議順序）

1. **綁定 `opuszmusic.com`**（§4）→ 讓正式網域通。
2. **逐頁驗證照片**：開 `opusz-website.pages.dev` 的首頁/樂手檔案/音樂家/課程頁，確認 media-sync 還原的圖都在；缺的話檢查該頁 localStorage key 有沒有在 `siteContent/media`。
3. **搬「影片連結」**：`opzMigrateMedia()` 只搬了 `data:` 圖。影片是 Cloudinary 網址存在
   localStorage（`martin-showreel-videos`、`lessons-hero-video`、`mono-hero-video`、`mono-vid-*` 等）。
   要嘛擴充 `media-sync` 把這些「URL 值的 media key」也納入 `siteContent/media`，要嘛手動把
   它們的值寫進 `siteContent/media`。（值本身是可跨網域的網址，搬上去即可。）
4. **未轉 Firestore 的功能**（見 `ADMIN_CMS_HANDOFF.md` §5.1）：詢問訊息、課程預約、收藏等仍 localStorage。
5. 之後可考慮：把後台「網站編輯」擴到更多區段/子頁（schema-driven）。

---

## 8. 白話名詞解釋（給業主 Martin）

- **GitHub**：你網站程式碼的「雲端倉庫＋備份」，存每一版歷史。
- **push（推上去）**：把你電腦改好的檔案上傳到 GitHub。**Cloudflare 只看 GitHub 來產生線上網站**，所以沒 push＝線上不會更新。
- **Cloudflare Pages**：幫你把網站「放上網」的主機（取代 Netlify）。一收到 GitHub 更新就自動重做網站。
- **Firebase**：Google 的後端服務。三塊：**Firestore**＝資料庫（文字/設定）、**Storage**＝放圖片影片檔、**Auth**＝登入。
- **localStorage**：瀏覽器自己的小倉庫，**只存在「這台瀏覽器＋這個網址」**。所以本地設的圖，換到線上網址就看不到——這是今天問題的根源。
- **media-sync**：今天做的橋樑，把 localStorage 的圖自動搬到 Firebase，讓線上也看得到，以後換圖也自動同步。
- **nameserver / DNS**：網域的「總機」，決定 `opuszmusic.com` 指到哪台主機。已從 Netlify 改指到 Cloudflare。
- **NXDOMAIN**：瀏覽器說「找不到這個網域」。因為最後一步（在 Cloudflare 綁定）還沒做。

---

## 9. PROGRESS LOG
- 2026-06-04：搬到 Cloudflare Pages；建 `media-sync.js` 並把 10 張本地照片搬上 Firebase
  （blog 線上驗證 ✓）；Shopify 式區段編輯器；多項後台修正。
  待辦：opuszmusic.com 綁定、逐頁驗證、搬影片連結。
