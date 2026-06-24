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

## 5. 🔁 交接規則（業主第二次貼上這份守則卡 = 交接信號）

當業主在同一個視窗**第二次貼上這份守則卡**，代表要交接給下一個視窗。
當前視窗**立刻用條列式、最簡短**的方式回覆：
- 本次改了哪些檔（檔名 + 一句話說改了什麼）
- 有沒有未完成或要注意的事（安全規則、待 bump 版本、未解問題）
- 沒有特別事項就回「本次無遺留事項」

> 不要長篇大論，讓下一個視窗 30 秒內掌握即可。守則卡本身**不要**因為交接而新增內容。

---

## 6. 🔴 改東西的鐵則（每次都要遵守）

1. **多視窗協作**：業主同時開多個 Claude 視窗。動工前 `git fetch && git status`，確認沒人在改同一個檔。改好直接 push（已授權），但**同一個檔一次只給一個視窗改**。
2. **commit 只 `git add <你改的特定檔>`，絕不 `git add -A`**（會把別人未提交的工作一起蓋掉）。push 前先 `git -c rebase.autoStash=true pull --rebase`。
3. **改外部腳本要 bump 版本號**：`nav.js`/`nav.css`/`media-sync.js`/`messaging.js` 等 `<script src>` 改了不 bump `?v=N`，瀏覽器會吃舊快取＝白改。（看各檔當前值再 +1。）
4. **首頁有自己一套 inline nav，不吃 `nav.js`** → 改 nav 行為要**首頁＋nav.js 兩邊都改**。
5. **base64 圖片不能寫進 Firestore**：圖要先上傳 Storage 變小網址再存設定。
6. **驗證**：沒有 node；用 `jsc` 做語法檢查。動畫/拖曳/版面類自己測不準 → **請業主在真站確認**。
7. 回業主一律中文白話＋可執行步驟。

## 7. 🔒 安全守則（最重要，踩過大雷）

1. **規則發布＝業主保留批准權**：Firestore/Storage 規則不在 repo、push 不會更新。流程＝Claude 改 `firestore.rules`/`storage.rules` 兩個檔 → 跟業主說「準備好了，要發布嗎」→ **業主口頭說「好」** → Claude 才跑 `firebase deploy --only firestore:rules,storage`。**沒拿到當次口頭同意，絕不代發。**
2. **個資別存「全域 localStorage key」**：`media-sync.js` 會把沒有 uid 區隔的 key 散佈到**所有帳號**（曾兩度把某人頭貼/城市漏給全站）。顯示在公開/他人頁的資料，只存「該帳號自己的 Firestore config（含 uid）」。
3. **不要在 `nav.css` 加 `#navAccountBtn{display:none}`**（會害登入後「My Account」永遠出不來）。
4. 密碼/金鑰**永不寫進 repo**（管理者密碼、ZeptoMail token 都向業主索取）。

---

## 8. 關鍵檔案速查
- `musician-platform.html` 首頁（含自己的 inline nav、首頁照片引擎 `opzEdit`）
- `shows.html` 演出頁（海報引擎 `opzShows`）
- `admin-panel.html` 管理者後台（Site Editor）
- `musician-dashboard.html` 音樂家後台（含 i18n、pagebuilder、平台規範頁）
- `musician-community.html` 音樂家社群（含 i18n、貼文 CRUD）
- `musician-profile.html` 公開檔案頁
- `site-content.js` 公開頁渲染器（讀 Firebase 套用）
- `messaging.js` 雙向訊息（`conversations`）
- `firestore.rules` / `storage.rules` 安全規則可貼版
- `functions/index.js` Cloud Functions（自動寄信通知，走 ZeptoMail）
- `server.py` 本機編輯伺服器

## 9. 音樂家後台 & 社群 — EN/中 語言切換（2026-06-11）

### 共用機制
- 語言狀態：`localStorage('opusz_dash_lang')` 值 `'zh'`（預設）或 `'en'`
- 兩個頁面共用同一個 key → 切語言會同步到兩頁

### musician-dashboard.html
| 東西 | 說明 |
|---|---|
| 翻譯物件 | `DASH_LANG = { zh:{...}, en:{...} }` |
| 讀翻譯 | `t('key')` |
| 套用靜態 HTML | `applyI18n()` — 處理 `data-i18n`（text）與 `data-i18n-ph`（placeholder）|
| 切換按鈕 | `langToggleBtn`（右上角）→ 呼叫 `window.setLang(lang)` |
| 動態 JS 字串 | pagebuilder `pbBuildBannerRow()`/`pbBuildVideoRow()` 裡直接用 `t('key')` |
| 平台規範 | `window.loadPolicy()` / `window.renderPolicyAck()`（**必須是 window global** — 從另一個 script block 的 `applyI18n()` 叫它）|
| Firestore 英文規範 | 每個 section 加 `titleEn` / `bodyEn` 欄位，沒加就 fallback 中文 |

### musician-community.html
| 東西 | 說明 |
|---|---|
| 翻譯物件 | `COMM_LANG = { zh:{...}, en:{...} }` |
| 讀翻譯 | `window.tc('key')` |
| 套用靜態 HTML | `applyCommI18n()` — 處理 `data-ci18n`（**注意是 ci18n，不是 i18n**）|
| 切換按鈕 | `commLangBtn`（頂列）→ 呼叫 `window.setCommLang(lang)` |
| 頻道標題 | `CHANNEL_TITLES_ZH` / `CHANNEL_TITLES_EN` 分開定義；`setCommLang()` 切換時重新指派 `CHANNEL_TITLES` |
| 成員人數 | `updateCommMemberCount(n)` — 中文「N 位成員」/ 英文「N members」|

### 社群貼文 CRUD（musician-community.html）
- **發文**：`opuszPublishPost(content, extras)` — extras 可帶 `{photoUrl, linkUrl}`
- **圖片上傳**：`opuszUploadCommunityPhoto(file, uid)` → 上傳到 `musicians/{uid}/community/{timestamp}.ext`（在現有 Storage rules 範圍內，不需改規則）
- **刪除**：`opuszDeletePost(postId)` — `deleteDoc`，`onSnapshot` 即時更新
- **編輯**：`opuszSavePostEdit(postId, newContent)` — `updateDoc`
- **···選單**：只對 `window.opuszMyUid === post.authorUid` 的貼文顯示
- **儲存模組** import：`deleteDoc`（Firestore）、`getStorage/ref/uploadBytes/getDownloadURL`（Storage）

## 10. 常踩的雷（快速版）
- **後台「Failed to load customers」**＝Firebase 登入過期 → 清 `opusz_admin_loggedIn` → 去 `admin-login.html` 重新登入。
- **訊息查詢**：列對話一定用 `where('participants','array-contains',uid)`，用 `musicianUid==` 會被規則整個拒絕。
- **curl 測線上 HTML 加 `-L`**（Cloudflare 會 308 轉址）。
- **平台規範英文**：要在 Firestore `siteContent/policy` 每個 section 手動加 `titleEn`/`bodyEn` 欄位，否則英文版仍顯示中文（fallback 設計，不會爆錯）。

## 11. 本次更新（2026-06-11 下午）

**新功能（都已上線）**
- 鍵盤分類新增「合作鋼琴 / Collaborative Piano」。
- 課程方案：可選 1～3 個、名稱/副標/單位/特色/時程中英分版、按鈕固定「預約課程 / Book a lesson」自動翻譯。
- 「我的資料」可直接改樂器與地區（存檔同時寫**頂層＋config**，公開頁/列表/社群卡片全同步）。
- 申請填的簡介/學歷/經歷會自動帶進公開檔案「關於」；舊樂手用後台 **申請審核 →「把申請資料補進個人檔案」** 按鈕一鍵補搬。
- 演出頁「People also viewed」改成真實已發佈音樂家。

**新雷區（一定要記住）**
- **前台語言** = 已存選擇 > 裝置語言（`navigator.language`），且跨頁固定。**頁面頂部別寫死 `var _currentLang='en'`**（全域變數會洗掉 nav.js 設好的語言→鎖英文）；新內頁要解析 saved/device。`switchLang` 要 persist `opusz_lang`。
- **footer 翻譯**靠 `footer.js` 自帶中英字典；**改 footer.js 要 bump `footer.js?v`**（目前 v=3，用在 lessons/musicians/recent-jobs 三頁）。
- **Retina 圖變糊**：被 `clip-path`/`transform` 父層包住的高解析圖，瀏覽器會點陣化成 1x→放大變糊。圖要加 `translate3d(x,y,0)＋backface-visibility:hidden＋will-change:transform`（見 shows.html 海報）。

## 12. SEO / Google 搜尋（2026-06-12）

業主在意「Google 搜尋看起來不專業」（地球 icon、沒品牌卡、沒子連結）。已做的＋觀念：

- **已設定 Google Search Console**：資源 `https://opuszmusic.com/`（URL 前置字元），用 HTML 檔驗證通過。
  - ⚠️ 驗證檔 `googlee6c6f6d0a72e3f4f.html`（repo 根目錄）**絕對不能刪**，刪了就失去擁有權。
- 已提交 `sitemap.xml`、已對首頁要求建立索引（首頁其實早就被收錄）。
- **首頁 `<head>` 已補**：完整 title、meta description、OG/Twitter、favicon（移進 head）、Organization + WebSite JSON-LD（品牌卡養分）。
- **網址真相**：根 `/` 會 308 轉址到 `/musician-platform`，`*.html` 也會轉址到無副檔名版 → canonical / og:url / sitemap 已全部對齊**乾淨網址（無 .html）**。curl 測線上記得加 `-L`。
- **觀念（要跟業主講清楚）**：地球換 Logo、品牌資訊卡、SoundBetter 那種子連結（sitelinks）都是 **Google 自動給的**，沒網站能強制 → 靠**時間＋流量**；網站端能做的技術底子都做好了，favicon 會在 Google 重爬後（幾天～兩週）換成真 Logo。

**💰 收費／政策（2026-06-12 定案，正在實作 — 下一窗會接著做這塊）**

- **演出 15%**：Encore 式「全包價」。樂手設的公開價＝業主付的價，**15% 內含、樂手實拿 85%**；**業主只看到一個整數、看不到加價**。
- **教學 10% 內含**（老師實拿 90%），走平台收款。**評價只算平台完成的課**＝用評價綁人。⚠️ **政策別寫「平台外不收費／自行教課不收」**（等於鼓勵繞過，業主超在意這點）。
- **金流＝escrow 託管**（交付後放款），演出/上課完成才放款給樂手。
- **未定**：大案子服務費上限、取消/退款條款。
- 參考：Encore（現場演出 20% 全包價）、SoundBetter（錄音 ~8% 抽樂手、業主免費）。
- **✅ 已上線**：`terms.html` 第 7 章（費用與付款，中英）已照此發布。
- **⏳ 待辦（下一窗接手）**：① 後台音樂家政策（Firebase `siteContent/policy`，管理者後台「平台政策」可編）的「收費與抽成(演出)/教學收費/付款與結算」3 段**仍是草擬中**——文字已草好（同 terms、教學段已拿掉繞過字眼），**還沒填進後台**；卡在問業主「填中文 or 中英」。② 樂手後台價格旁顯示「你實拿 85%」即時換算。③ escrow 確認付款介面（聊天右側「開啟專案/確認付款」，最大工程、要接金流商，未開工）。

---
最後更新：2026-06-12

## 13. Hero 版本切換（2026-06-24）

**目前線上＝靜態照片版**：首頁 Hero 主視覺改成一張靜態模糊照片（`assets/images/hero-still.jpg`），
音樂家**不再隨捲動而動**；但「捲動→主視覺連同 Logo 縮小、露出後面照片」的動作**保留**。

- 實作：`musician-platform.html` 的 `drawScrubFrame()` 改成只畫這張靜態圖（固定置中、不平移）；
  原本載入 362 張影格的 `preloadScrubFrames` 改成只載入這張圖（`_heroStill`）。其餘 Hero 捲動邏輯（縮小、phases、背景照片露出）原封不動。
- **要還原成「音樂家會動」的舊版**：回到 commit **cf4f9eb**（或更早）的 Hero——
  `git checkout cf4f9eb -- musician-platform.html`（影格仍在 `assets/videos/frames/`）。跟下一個視窗說「Hero 換回動畫版」即可。

---
最後更新：2026-06-24
