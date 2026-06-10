# OPUS.Z — 精簡守則卡（新視窗先讀這份就好）

> 業主 Martin 非工程背景 → **回答一律中文、白話、給可執行步驟**。
> 細節在 `HANDOFF_DEPLOY_SYNC.md`（很大，**只在需要深挖某功能時才讀**，別每次整份讀）。

---

## 1. 平台在幹嘛
**OPUS.Z** = 媒合「台灣頂尖古典音樂家」與「工作機會（演出＋教學）」的平台。
正式站 = **opuszmusic.com**（首頁＝`musician-platform.html`）。品牌調性：菁英、嚴選、頂尖。

## 2. 架構（誰負責什麼）
| 東西 | 在哪 |
|---|---|
| 程式碼 | GitHub `yoshino1590012/opusz-website`（branch `main`）|
| 主機 | Cloudflare Pages → **push 到 main 就自動上線**（約 30 秒～2 分）|
| 資料/帳號/檔案 | Firebase `opusz-45280`（Firestore＋Storage＋Auth）|
| 本機編輯器 | `python server.py 8080`（存圖到檔案、寫 `*-data.json`、一鍵 git-push）|

## 3. 🧠 最重要觀念：兩種「存檔模型」（搞懂這個，90% 困惑解開）
- **模型 A（Firebase 雲端）**：文字、Hero 樣式、演出頁海報「設定」→ **線上後台就能改、即時生效**（要用管理者帳號 `tzutung.liao@gmail.com` 登入 Firebase）。
- **模型 B（檔案型）**：首頁照片、`site-data.json`/`shows-data.json` → **只能在 `localhost:8080` 改完按發佈**（線上沒有 server.py，存不進去）。

> 「我明明改了，線上卻沒變」→ 99% 是搞錯這兩個模型。

## 4. 上線方式
- 改程式碼 → `git push origin main` → Cloudflare 自動重建。
- 改 Firebase 資料（文字/海報設定/音樂家檔案）→ 即時生效，不用 push。
- 改檔案型內容（首頁照片）→ `localhost:8080` 編 → 按發佈。

---

## 5. 🔴 改東西的鐵則（每次都要遵守）

1. **多視窗協作**：業主同時開多個 Claude 視窗。動工前 `git fetch && git status`，確認沒人在改同一個檔。改好直接 push（已授權），但**同一個檔一次只給一個視窗改**。
2. **commit 只 `git add <你改的特定檔>`，絕不 `git add -A`**（會把別人未提交的工作一起蓋掉）。push 前先 `git -c rebase.autoStash=true pull --rebase`。
3. **改外部腳本要 bump 版本號**：`nav.js`/`nav.css`/`media-sync.js`/`messaging.js` 等 `<script src>` 改了不 bump `?v=N`，瀏覽器會吃舊快取＝白改。（看各檔當前值再 +1。）
4. **首頁有自己一套 inline nav，不吃 `nav.js`** → 改 nav 行為要**首頁＋nav.js 兩邊都改**。
5. **base64 圖片不能寫進 Firestore**：圖要先上傳 Storage 變小網址再存設定。
6. **驗證**：沒有 node；用 `jsc` 做語法檢查。動畫/拖曳/版面類自己測不準 → **請業主在真站確認**。
7. 回業主一律中文白話＋可執行步驟。

## 6. 🔒 安全守則（最重要，踩過大雷）

1. **規則發布＝業主保留批准權**：Firestore/Storage 規則不在 repo、push 不會更新。流程＝Claude 改 `firestore.rules`/`storage.rules` 兩個檔 → 跟業主說「準備好了，要發布嗎」→ **業主口頭說「好」** → Claude 才跑 `firebase deploy --only firestore:rules,storage`。**沒拿到當次口頭同意，絕不代發。**
2. **個資別存「全域 localStorage key」**：`media-sync.js` 會把沒有 uid 區隔的 key 散佈到**所有帳號**（曾兩度把某人頭貼/城市漏給全站）。顯示在公開/他人頁的資料，只存「該帳號自己的 Firestore config（含 uid）」。
3. **不要在 `nav.css` 加 `#navAccountBtn{display:none}`**（會害登入後「My Account」永遠出不來）。
4. 密碼/金鑰**永不寫進 repo**（管理者密碼、ZeptoMail token 都向業主索取）。

---

## 7. 關鍵檔案速查
- `musician-platform.html` 首頁（含自己的 inline nav、首頁照片引擎 `opzEdit`）
- `shows.html` 演出頁（海報引擎 `opzShows`）
- `admin-panel.html` 管理者後台（Site Editor）
- `musician-dashboard.html` / `musician-profile.html` 音樂家後台/公開檔
- `site-content.js` 公開頁渲染器（讀 Firebase 套用）
- `messaging.js` 雙向訊息（`conversations`）
- `firestore.rules` / `storage.rules` 安全規則可貼版
- `functions/index.js` Cloud Functions（自動寄信通知，走 ZeptoMail）
- `server.py` 本機編輯伺服器

## 8. 常踩的雷（快速版）
- **後台「Failed to load customers」**＝Firebase 登入過期 → 清 `opusz_admin_loggedIn` → 去 `admin-login.html` 重新登入。
- **訊息查詢**：列對話一定用 `where('participants','array-contains',uid)`，用 `musicianUid==` 會被規則整個拒絕。
- **curl 測線上 HTML 加 `-L`**（Cloudflare 會 308 轉址）。

---
最後更新：2026-06-10
