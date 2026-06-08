# OPUS.Z — 系統交接手冊 (HANDBOOK / DEPLOY & SYNC)

> **給下一個接手的 Claude 視窗：先讀這份（全貌＋部署＋前後台串接），再讀 `ADMIN_CMS_HANDOFF.md`（CMS 細節）、`SECURITY-CHECKLIST.md`。**
> 業主（Martin / yoshino1590012）不是工程背景 → 回答一律**中文、白話、給可執行步驟**。
> 目標：讓這個系統「**能一直被傳承下去**」。看完這份你應該知道：平台在幹嘛、東西存在哪、怎麼上線、改東西要在哪改、哪裡有雷。

最後更新：2026-06-09

---

## 0. 我們在做什麼（平台定位）

**OPUS.Z** = 一個媒合「**台灣頂尖（古典）音樂家**」與「**工作機會**」的平台。
- 兩種核心服務：**演出**（live performance / 錄音 / 活動）＋ **教學**（音樂課程）。
- **客戶端**：來找音樂家辦演出、錄音、活動，或找老師上課（首頁兩顆鈕 Find Artists / Create a Project）。
- **音樂家端**：在「音樂家後台」(`musician-dashboard`) 編輯自己的公開檔案、報價、課程、海報投稿。
- 品牌調性：**菁英、嚴選、頂尖**（不是「便宜」，是「最強的都在這」）。首頁主標語：**遇見台灣菁英音樂家 / Meet Taiwan's elite musicians.**
- **沒有付費方案**（2026-06 移除）：所有音樂家功能一律平等，演出＋教學都能做；教學由每位音樂家自己開關。

---

## 1. ⏩ RESUME HERE — 現況快照

**整體架構（誰負責什麼）：**
| 角色 | 服務 | 說明 |
|---|---|---|
| 程式碼倉庫 / 備份 | **GitHub** `github.com/yoshino1590012/opusz-website`（branch `main`） | 所有 HTML/JS/CSS + 部分圖片檔 + `site-data.json`/`shows-data.json` |
| 線上主機 | **Cloudflare Pages** 專案 `opusz-website` → `opusz-website.pages.dev` | **push 到 GitHub main 就自動重新部署**（約 30 秒～2 分） |
| 正式網域 | **opuszmusic.com**（Porkbun 註冊、Cloudflare 管 DNS）| ✅ 已綁定、SSL 已簽發，正常運作 |
| 資料庫 / 帳號 / 檔案 | **Firebase** 專案 `opusz-45280` | Firestore（資料）+ Storage（圖片/影片檔）+ Auth（登入） |
| 本機編輯伺服器 | **`server.py`**（在業主電腦跑 `python server.py 8080`）| 提供「檔案型」編輯：存圖到 `assets/images/`、寫 `site-data.json`/`shows-data.json`、一鍵 git-push |

**目前線上正常運作：** `https://opuszmusic.com`（首頁＝`musician-platform.html`）。

**這次 session（2026-06-07）完成的大事（見 §9 變更紀錄）：**
1. 首頁 Hero 重做（置中大標語＋品牌字＋黑白反轉）。
2. **移除所有「前端網頁上」的編輯器**（按 P/Q/R/O）→ 編輯全部集中到「後台 Site Editor」。
3. 後台 Site Editor 變成**多分頁**（首頁/部落格/音樂家/工作/演出/課程），預覽可自由導覽＋登入（跟前台一樣）。
4. **演出頁海報編輯器**：每張海報＝圖＋資訊合一，可拖曳移位/大小/模糊/背景X-Y、拖照片上傳、**增減張數**；存到 Firebase（線上後台也能改）。
5. **移除付費方案制度**（Basic/Premium、邀請碼、教學鎖、後台徽章全砍）。
6. 修好音樂家後台「編輯主頁」預覽**無限重整**的 bug。

**🔴 still open（見 §10 待辦）：** ① **放行管理者刪樂手的 Firestore 規則**（後台刪除功能已做、被 permission-denied 擋）② 部落格「**文字**」可編輯（圖片已可）③ 演出頁「刪指定某張海報／拖曳排序」、音樂家後台手機預覽手機外框、Lessons 老師列表、子頁更多區段圖片編輯、影片連結搬雲端。

> **2026-06-08 本視窗摘要**：Logo 換新＋全站套用、管理者密碼安全強化、部落格圖片可編輯＋雲端同步、海報投稿系統（樂手↔管理者）、樂手後台收件匣合併、管理者刪樂手功能（差規則放行）、nav logo 對齊修正。詳見 §9。
> **2026-06-08 另一視窗摘要（樂手檔案／公告／海報／手機線）**：系統公告（管理者發→樂手看，看後 24h 自動消失）、Showreel 影片大改（動態1–3、標題=大字+副標、每片X/Y、手機橫向全螢幕疊層）、亮點可排序+預設第一張+每張X/Y/Zoom、海報存原檔+下載原圖+刪除、客戶刪除鈕、首頁輪播標語可拖曳/對齊（分裝置）、全站隱藏捲動軸、首頁手機白卡縮放、上傳格式錯誤訊息修正。**🔴 重要：首頁有自己的 inline nav（不吃 nav.js）；nav.js 已加 `?v=2` 快取版本號**。詳見 §9 + §7 第 9 點。
> **2026-06-09 本視窗摘要（訊息後端打通 ＋ 自動 Email 通知系統｜全新基礎設施，務必先讀 §12）**：
> ①**iOS 首頁修正**：開場大卡在 iPhone 滑動時漏底/閃白（網址列收合 viewport 變高、卡片高度追不上）→ 卡片改用 **`100lvh`(最大視窗)+只增不減快取** 永遠蓋滿；主標題在 iOS 變白（`mix-blend-mode` 疊 canvas 失效）→ 改**固定深色**；手機隱藏底部浮動導覽列；手機 logo（紅圈+OPUS.Z）**整體縮 75%** 並靠齊左上角（首頁 inline nav + `nav.css` 都改，**nav.css bump 到 `?v=3`**）。
> ②**首頁主標題/副標可後台編輯**：Site Editor「首頁→主視覺」新增「主標題/副標」**多行文字框**（中英、按 Enter 換行）＋「行距」滑桿（`siteContent/home.heroType`）。主標題 CSS 改 `white-space:pre`（**預設一行、只在手動換行處斷**）、副標 `pre-line`。`site-content.js` 加 `applyHeroType`。
> ③🟢**訊息後端打通（取代 localStorage）**：樂手公開檔的「聯絡(Message)/檔期(Check availability)/課程(Book a lesson)」三個動作 → 改寫進 Firestore **`inquiries`** 集合（`kind:message/booking/lesson` + `musicianUid`，匿名登入；`musician-profile.html` 的 `window.opzSendInquiry`）。樂手後台「**訊息**」改即時讀 `inquiries`（`onSnapshot where musicianUid==我`，已讀/回覆寫回 Firestore；`musician-dashboard.html` 的 `_fsInbox`/`renderInbox`/`__markInquiryRead`/`__saveInquiryReplies`）。已加 `inquiries` Firestore 規則（業主已發布）。Enquiry 表單補了 email 欄位。
> ④🟢**自動 Email 通知（全新！見 §12）**：用 **ZeptoMail**（Zoho 自家交易型郵件）以 `info@opuszmusic.com` 寄信，網域已驗證（DKIM + bounce CNAME 已加到 Cloudflare）。寫了 **Firebase Cloud Functions**（`functions/` 資料夾，2nd gen）：`notifyMusicianOnInquiry`（新訊息→寄給該樂手註冊信箱）＋（另一視窗加的）`notifyMusicianOnReview`（樂手申請通過/退件→寄給申請人）。**已部署、實測收到信（進主收件匣）**。本機已用 Homebrew 裝 **Node.js + firebase CLI**，已 `firebase login`（yoshino1590012@gmail.com）。
> ⑤**還沒做**：公開委托(jobs)發布→**自動 email 通知全體樂手**（目前只「私人訊息→單一樂手」有 email）；課程預約流程沒收集學生 email；`functions/` **還沒 commit 進 git**（見 §10）。
>
> **2026-06-08 本視窗摘要（公開委托串流／樂手主頁載入體驗／雙語內容）**：①**公開委托真資料流**：客戶在 `recent-jobs` 送委托→寫 Firestore **`jobs`**→樂手後台「公開接案」即時看到（onSnapshot＋紅點徽章＋通知；已過活動日期/已接的自動不顯示）。Post-a-Project 加**活動時間**選擇器。**🔴 還沒通：要業主在 Firebase 主控台①開 Anonymous 登入②發布 `jobs` 規則**（見 §10 第 0.5 點）。②**樂手公開主頁載入大修**：修「published 卻顯示空白模板」(module 頂層 `return` 語法錯→包 async IIFE)、改用 **Firestore REST 取代 SDK**（少約 0.8s 灰屏）、**等照片+字型都好才一次顯示**（名字/照片一起出現、不分批）、**開場動畫等資料就緒才播**、**Showreel 輪播改在動畫後+1.5s 才開始**（修白閃）。③**YouTube showreel 填滿**（過去有黑邊：cinematic 影片被 YT 自己加黑邊→把 iframe 放大 ~1.4× 裁掉）。④**列表卡片音樂(MP3)**：Card 編輯器可上傳 MP3、列表卡播放鍵真的播（並修卡片按鈕因字串 uid 沒加引號→點了跳主頁的 bug）。⑤**樂手內容雙語**：bio/學經歷/服務/亮點各加英文版輸入框；主頁切 EN/中文顯示對應版本（英文留空＝空白、不回退）。⑥**退役所有前台浮動編輯器**（全站 CSS 隱藏）。⑦**nav hover 底線**（從左滑出）改用 nav.js 注入的 `::after`，**全站都有**；**nav.js 版本號 bump 成 `?v=3`**。⑧後台預覽 iframe 加 `&_=Date.now()` 快取破壞（預覽永遠載最新）。⑨修 Site Editor「打字後移位置→文字回退」bug。詳見 §9。

---

## 2. 🧠 最重要的觀念：兩種「存檔模型」（搞懂這個，90% 的困惑都解開）

網站的內容編輯，背後其實有**兩套不同的儲存方式**。**搞混它們 = 「我明明改了/刪了，線上卻沒變」**（業主最常踩的雷）。

### 模型 A — Firebase（雲端資料庫，線上後台就能存）
- 存到 **Firestore** `siteContent/<page>`（文字 i18n、Hero 樣式、演出頁海報設定…）或 **Storage**（上傳的圖片→小網址）。
- **在哪都能存**：只要用**管理者帳號登入** Firebase，連線上 `opuszmusic.com/admin-panel` 都能存、即時生效（公開頁靠 `site-content.js` 讀回來套用）。
- 用在：首頁文字、Hero 樣式、合作廠商、**演出頁海報的「張數/位置/大小/模糊/文字/圖片網址」**、子頁文字。

### 模型 B — 檔案型（`server.py` + git，**只能在本機 localhost:8080 編輯**）
- 上傳的圖存成**真實檔案** `assets/images/*.jpg`；版面設定寫進 `site-data.json`（首頁）/`shows-data.json`（演出頁）。
- 這些都靠 **`server.py` 的端點**（`/upload-file`、`/save-config`、`/save-shows`、`/git-push`）。**線上沒有 server.py** → 在線上後台改這類東西**存不進去**。
- 用在：**首頁的照片引擎**（主視覺14張、分類、海報、服務）＝ `opzEdit`；以及演出頁海報**圖片本身**的本機上傳備援。
- **工作流程**：業主電腦跑 `python server.py 8080` → 開 `localhost:8080/admin-panel.html` 編 → 按發佈（git-push）→ 線上更新。

> ⚠️ **黃金守則**：要改「**圖片檔本身/首頁照片/檔案型設定**」→ **去 `localhost:8080` 編、按發佈**。要改「**文字/演出頁海報設定**」→ 線上後台也能改（記得用管理者帳號登入 Firebase）。
> 這次已把**演出頁海報的設定**改成走 Firebase（模型 A），所以線上後台刪/加/移海報會生效；但**換海報圖片**最好還是本機（會上傳成 Storage 小網址才不會塞爆 Firestore）。

---

## 3. 編輯系統地圖（哪個東西在哪改）

### (1) 後台 Site Editor — `admin-panel.html` `#page-siteeditor`（主力）
- 左欄「**頁面 PAGES**」：首頁/部落格/音樂家/工作/演出/課程（`SE_PAGES`）。點頁面 → 中間預覽切到該頁（iframe 載 `<page>?cmsedit=1`）＋ 左下「區段 SECTIONS」換成該頁的（`SE_SECTIONS_BY_PAGE`）。
- 中間 = **真實預覽 iframe**（可像前台一樣導覽、登入）。`seSetDevice` 切螢幕尺寸（會用該頁網址重載 iframe 以取得正確 RWD 版型）。
- 右欄 = 該區段的可編輯欄位。依頁面/區段不同：
  - **首頁** → 用固定 schema `SE_FIELDS`（文字 i18n）＋ `SE_ENGINE_GROUP`（圖片走 `opzEdit` 引擎，見 (2)）＋ 合作廠商自訂清單。
  - **演出頁「海報」** → 專屬控制 `seBuildShowsPoster`（驅動 `opzShows`，見 (3)）。
  - **其他子頁** → **通用自動編輯器** `seBuildAutoControls`：掃描該區段 DOM，自動列出「文字(data-i18n)／圖片／影片／連結」變成欄位（見 (4)）。
- **儲存/發佈**：「儲存文字」→ 寫 `siteContent/<page>`（Firebase）。「🚀 儲存並發布到網站」→ 文字存 Firebase ＋ 呼叫該頁引擎的 `publish()` 做 git-push（首頁=`opzEdit.publish`、演出=`opzShows.publish`，需本機 server.py）。

### (2) 首頁照片引擎 `window.opzEdit`（在 `musician-platform.html`，模型 B）
- 管首頁所有照片：主視覺 14、分類 6、作品/海報 3、服務 5、部落格 4。每格有 `{x,y,zoom,url}`，存 `site-data.json` + `assets/images/`，靠 server.py。
- 後台透過 iframe 呼叫 `opzEdit.list/setFrame/setImageFile/publish` 來遙控它（這樣前端不用自己的浮動編輯器）。

### (3) 演出頁海報引擎 `window.opzShows`（在 `shows.html`）
- 每張海報 `{url,x,y,scale,blur,bgX,bgY}` ＋ 前景圖位置/大小、**背景模糊海報的模糊度＋X/Y**。
- `add/removeLast/applyConfig/setFrame/setImageUrl/setImageFile/publish`。
- **雙存**：圖片本身→server.py(`shows-data.json`)；但**整體設定（張數+位置+模糊+圖片網址）也存 Firebase** `siteContent/shows.posters`，由 `site-content.js` 在線上頁面 `opzShows.applyConfig()` 套用 → **線上後台改海報會生效**。
- 海報文字（姓名/標題/場地/曲目）目前走 i18n（`show.N.*`，index 綁定）→ 這是「刪指定/排序」還沒做的原因（見 §10）。

### (4) 通用自動編輯器（子頁文字/連結/媒體）
- `seBuildAutoControls` 掃描區段內 `[data-i18n]`（文字 EN/中）＋ `img/video/a`（媒體/連結，依 DOM 順序 index）。
- 存 `siteContent/<page>`：文字→`.i18n`，媒體/連結→`.auto[]`（`{sec,kind,idx,v,pos,zoom}`）。`site-content.js` 套用。
- 要讓子頁某段可編輯：① 該頁 `<html data-cms-page="...">` ② 載入 `site-content.js` ③ 區段加 `data-cms-section="..."` ④ 後台 `SE_SECTIONS_BY_PAGE` 加該區段。**演出頁已示範**；其他子頁照這個模式接。

### (5) 公開頁渲染器 `site-content.js`（所有公開頁都載）
- 開機讀 `siteContent/<page>`（`data-cms-page` 決定 page，預設 home）→ 套用：i18n 文字、`data-cms` 媒體、`cfg.auto` 通用媒體、`cfg.posters`（演出頁海報）、Hero 樣式（位置/品牌色/按鈕/玻璃）等。
- 也提供**編輯模式** `?cmsedit=1`：區段藍框 highlight、點區段回報後台、放行導覽（連結會自動帶 `cmsedit=1`）。

### (6) `media-sync.js`（舊編輯器照片的雲端橋）
- 把舊的 `localStorage` base64 照片還原/發布到 Firebase `siteContent/media`。所有公開頁都載。`window.opzMigrateMedia()` 一次性搬家（需管理者登入）。

### (7) 音樂家後台 `musician-dashboard.html`（音樂家自己編）
- 「編輯主頁」即時預覽 iframe = `musician-profile.html?edit=1&uid=<自己>`，存 `musicians/{uid}.config`（Firebase）。
- 已移除付費方案；教學 = 每人自行開「顯示課程方案」。

---

### (8) 首頁 Hero 元素樣式/排版編輯器（模型 A，存 `siteContent/home`）
- 後台「首頁 → 主視覺 / Hero」右欄上方那一整塊（藍色提示框）。**拖曳在預覽 iframe 裡做**（`site-content.js` 的 cmsedit 區塊裝了拖曳/縮放邏輯，postMessage 回後台儲存）。
- 存的 key（都在 `siteContent/home`，`site-content.js` 套用）：
  - `heroPos` = `{headline,sub,btnFind,btnProject,brand}` → `{xPct,yPct,s}`（位移用 vw/vh、大小用獨立 `scale`）。
  - `heroBrandColor`（`'auto'` 或色碼）、`heroBtn{find,project}{bg,fg,bd,op}`、`heroBtnShape{radius,bw}`、`heroBtnGlass`(bool)。
- 對應元素（`musician-platform.html` 的 hc-card-overlay）：`.hco-headline/.hco-sub/.hco-btn-pri/.hco-btn-out/.hco-brand`；頂部大字是另一個 `.hero-big-title`（純 CSS，**不被這套控制**，手機置中是直接改 CSS）。
- ⚠️ 已知細節：`backdrop-filter` 在「祖先 opacity<1」時會抓錯背景 → 玻璃按鈕出場淡入會延遲，已用「玻璃模式時不淡入(只滑入)」解掉。

## 4. 部署流程（push → 自動上線）

- **改程式碼 → 上線**：`git push origin main` → Cloudflare Pages 自動重建（約 30 秒～2 分）。
- **改 Firebase 資料（文字/海報設定/音樂家檔案）**：即時生效、跨裝置，**不需 push**。
- **改檔案型內容（首頁照片/`*-data.json`）**：在 `localhost:8080` 編 → 按發佈（server.py 會寫檔 + git-push）。
- Cloudflare Pages 設定：framework=None、build command 空、output dir=根目錄。`_redirects`：`/ → /musician-platform.html 200`。
- **本機跑站**：`python server.py 8080` 後開 `http://localhost:8080/`（**一定要透過 server.py**，否則檔案型上傳/發佈端點不存在）。

---

## 5. 帳號 / 存取

- **GitHub**：`github.com/yoshino1590012/opusz-website`，branch `main`。
- **Cloudflare**：帳號 `Yoshino1590012@gmail.com`；account id `a9c9efa2ee4f1d201b360e21f5c32bfa`；Pages 專案 `opusz-website`。
- **Firebase** 專案 `opusz-45280`：
  - 管理者（有 `siteContent` 寫入權）：**`tzutung.liao@gmail.com`**，密碼**請向業主索取（不寫進 repo）**，uid `qR8q45IUgpSg8lcMeHtHqmngy9e2`。
  - 編輯/發佈前在 `admin-login.html` 用**管理者帳號**登入（建立 Firebase session）。`opusz_admin_loggedIn` 只是 UI 門禁，**不等於** Firebase 登入。
- **Porkbun**：管 `opuszmusic.com`（nameserver 指向 Cloudflare：`darl`/`jamie`.ns.cloudflare.com）。
- **ZeptoMail**（交易型寄信，2026-06-09 新增）：用業主 **Zoho 帳號**登入 `zeptomail.zoho.com`；Mail Agent `agent_1`；網域 `opuszmusic.com` 已驗證；寄信金鑰已存成 Firebase secret `ZEPTOMAIL_TOKEN`。詳見 §12。
- **Firebase CLI**（本機，2026-06-09 新增）：已用 Homebrew 裝 Node.js + firebase-tools（`/opt/homebrew/bin`）；已 `firebase login` 為 **yoshino1590012@gmail.com**（對 opusz-45280 有部署權限）。Cloud Functions 部署/log 見 §12.4。

### Firebase 安全規則（現狀）
- Firestore：`match /siteContent/{page}` → 任何人可讀；只有 `tzutung.liao@gmail.com` 可寫。`musicians`/`customers` 各有既有規則（音樂家寫**自己的**）。⚠️ **管理者改/刪「別人的」樂手會被擋**（後台刪除樂手 → permission-denied）→ 放行見 §10 第 0 點。
- Storage：`siteContent/{**}` 公開讀、管理者寫（上傳媒體放這）；`musicians/{uid}/{**}` 公開讀、本人寫。
- 👉 媒體上傳走 `siteContent/*` 路徑、管理者是 tzutung，**通常不需改規則**。

---

## 6. 關鍵檔案

- `musician-platform.html`（首頁，~330KB）：Hero、各區段（`data-cms-section`）、首頁照片引擎 `opzEdit`、`server.py` 同步、i18n。**頁面最上方有一段攔截 P/Q/R/O 快捷鍵的程式（前端編輯器已退役）**。
- `shows.html`（演出頁）：海報引擎 `opzShows`、`data-cms-page="shows"`、`site-content.js`、區段 `sh-hero`/`sh-poster`/`sh-info`。
- `admin-panel.html`（管理者後台）：多分頁 Site Editor（`SE_PAGES`/`SE_SECTIONS_BY_PAGE`/`seBuildControls`/`seBuildAutoControls`/`seBuildShowsPoster`）、音樂家管理（已無方案徽章）。
- `site-content.js`：公開頁渲染器（讀 Firebase 套用）＋ 編輯模式。
- `media-sync.js`：舊照片雲端橋。
- `musician-dashboard.html` / `musician-profile.html`：音樂家後台/公開檔案（已移除方案）。
- `blog.html`：部落格（另一條線做了 banner/封面可編輯，`data-cms-section="blog-hero"/"blog-list"`）。
- `server.py`：本機編輯伺服器（端點：`/upload-file /save-config /save-shows /save-videos /git-push /submit-application /update-application /get-applications`）。**POST 回應 (`_ok`/`_err`) 一定要送 `Content-Length`**（HTTP/1.1 keep-alive，否則上傳卡住）；改 server.py 後**要重啟**才生效。
- `nav.js` / `nav.css`：共用導覽（內頁注入）。**≤900px 會把愛心/登入/語言搬進漢堡抽屜**（`#navDrawerExtra`，首頁同邏輯內建在 `musician-platform.html`）。
- `site-data.json` / `shows-data.json`：首頁/演出頁的檔案型設定（會被 git 追蹤＝部署）。
- `_redirects`、`.gitignore`（排除 >25MB 大檔；那些影片走 Cloudinary）。
- 🆕 `functions/index.js` + `firebase.json` + `.firebaserc`（2026-06-09）：**Firebase Cloud Functions**（自動寄信通知）。`notifyMusicianOnInquiry`（訊息→樂手信箱）、`notifyMusicianOnReview`（審核→申請人）。詳見 §12。**⚠️ 還沒 commit 進 git。**
- 🆕 `musician-profile.html` 新增 `window.opzSendInquiry`（聯絡/檔期/課程 → 寫 Firestore `inquiries`，匿名登入）；`musician-dashboard.html`「訊息」改讀 `inquiries`（`_fsInbox`/`renderInbox`）。見 §12.1。

---

## 7. 🚧 雷區（省下大量時間）

1. **「我改了線上卻沒變」** → 99% 是搞錯**存檔模型**（§2）。圖片/首頁照片/`*-data.json` 要在 `localhost:8080` 編＋發佈；文字/海報設定線上後台可改（要 Firebase 管理者登入）。
2. **多個 Claude 視窗同時改同一個檔 = 會互相覆蓋！** 這次就發生過（admin-panel.html / site-content.js 被兩邊改）。規則：**同一個檔一次只給一個視窗改**；每次 Edit 前先重讀；commit 前 `git pull --rebase`。若分工，請按「檔案」分，不要兩人動同一檔。
3. **base64 不能寫進 Firestore**：圖片要先上傳 Firebase Storage 變小網址再存設定，否則 `invalid-argument`（文件 >1MB）。演出頁上傳已走 Storage；存檔前也會過濾掉 `data:`。
4. **localStorage 是「每個網址各自獨立」**：`localhost:8080` 和 `opuszmusic.com` 是不同儲存空間。
5. **Cloudflare 單檔 ≤ 25 MiB**：大影片別進 repo（已 gitignore），走 Cloudinary。
6. **大小寫敏感**：macOS 本機不分、Cloudflare(Linux) 分，路徑大小寫要對。
7. **發佈端點在線上會 404**（沒 server.py）：所以「發佈照片」按鈕在線上對檔案型內容無效；文字仍會存 Firebase。
8. **驗證程式**：本機沒有 node；可用 `jsc`（`/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc`）做 `new Function(src)` 純語法檢查（記得先剝掉 `import` 行）。預覽工具（Claude Preview）會用自己的 server，cwd 可能在家目錄，要導到 `/opusz-website/...`；且**無法穩定重現首頁/演出頁的捲動動畫**，動畫類改動請業主在真站確認。
9. 🔴 **首頁有自己的 inline nav，不吃 `nav.js`**：`musician-platform.html` 的導覽（登入/帳號/抽屜/登入下拉）是頁面內自帶的;其他內頁才用共用 `nav.js`。**改 nav 行為要兩邊都改**，否則「在其他頁好了、首頁沒好」。另：`nav.js` 全站引用帶 **`?v=N` 版本號**（**目前 v3**，本視窗從 v2 bump 上來），**改 nav.js 後要 bump 版本號**才不會被瀏覽器/iframe 快取吃掉舊版（本視窗被這個快取坑很久）。**外部 `<script src>` 改了，硬重新整理常常刷不到，版本號才可靠。** 同理本視窗把後台預覽 iframe 的 `musician-profile.html` src 加了 `&_=Date.now()`（HTML 沒版本號、會被快取，這樣預覽永遠最新）。
10. **預覽工具測不到登入後的後台**：`admin-panel`/`musician-dashboard`/`musician-profile?uid=` 都要登入才完整跑（沒登入會跳轉 login）。後台類功能多半只能用 `jsc` 驗語法 + 模擬資料測邏輯，最後請業主登入實測。

---

## 8. 業主白話名詞

- **GitHub**＝程式碼雲端倉庫＋備份。**push**＝把改好的檔上傳 GitHub（沒 push 線上不會更新）。
- **Cloudflare Pages**＝把網站放上網的主機，收到 GitHub 更新就自動重做。
- **Firebase**＝Google 後端：Firestore(資料庫文字/設定)、Storage(圖片影片檔)、Auth(登入)。
- **server.py**＝你電腦上的小幫手程式，負責把「照片存成檔案、寫設定檔、一鍵上傳」；**要先打開它（localhost:8080）**才能改照片那類東西。
- **兩種存檔**＝① 文字/海報設定 → 存雲端(Firebase)，線上後台就能改；② 照片檔/首頁照片 → 存成檔案，要在你電腦 localhost:8080 改完按發佈。

---

## 9. 變更紀錄 (CHANGELOG)

- **2026-06-09（本視窗：iOS 修正 / 主標題後台可編 / 訊息後端 / 自動 Email；前端已 push、Functions 已部署）**
  - **iOS 首頁修正**（`musician-platform.html`）：
    - 🐞 **開場大卡在 iPhone 漏底/閃白**：卡片高度原本鎖 `window.innerHeight`，但 iOS 滑動時網址列收合、可視高度變大 → 卡片變太矮露出後面照片格。改用 `heroViewportH()` 量 **`100lvh`（網址列隱藏時的最大高度）+ 只增不減快取**，卡片永遠 ≥ 視窗 → 不漏不閃；`resizeHeroCanvas`/`updateHeroDims` 都吃這個值，並監聽 `resize`/`orientationchange`/`visualViewport`。
    - 🐞 **主標題在手機變白**：`.hco-headline`/`.hco-sub` 用 `mix-blend-mode:difference`，iOS Safari 疊在 `<canvas>` 上會失效 → 文字變白。改**固定深色**（標題 `#111`、副標 `#6b7177`），移除 blend-mode。
    - 手機（≤900px）**隱藏底部浮動導覽列** `.bottom-nav`（`display:none!important` 蓋過 JS 的 inline display）。
    - 手機 logo **整體縮 75% 並靠左上角**：紅圈 `#navOrbFixed` + 文字 `#navLogoFixed` 用 `transform:scale(.75)` 共同基準點縮放（首頁 inline nav + `nav.css` 都改）。**`nav.css` 全站 `?v=2`→`?v=3`**（cache-bust；下次改 nav.css 記得再 bump）。
  - **首頁主標題/副標 → 後台可編輯（文字 + 行距 + 換行）**：
    - `admin-panel.html` `SE_FIELDS` 加 `hero.headline`、`hero.sub`（`multiline:true`）→ 文字框改 **`<textarea>`**（中英、按 Enter 換行）；新增「行距/Line height」滑桿（`seHeroTypeRows`/`seHeroSetLineH`，存 `siteContent/home.heroType`）。
    - `musician-platform.html`：`.hco-headline` 改 `white-space:pre`（**預設一行、只在手動 `\n` 處換行、不自動折**）；`.hco-sub` 改 `pre-line`。`site-content.js` 加 `applyHeroType()`（套 line-height）。
  - 🟢 **訊息後端打通**（取代 localStorage，見 §12）：
    - `musician-profile.html`：加 `window.opzSendInquiry()`（匿名登入 + `addDoc('inquiries')`）；「Send Enquiry」表單補 email 欄位、改寫 Firestore；`submitAvail`（檔期）、lesson `submit`（課程）也改走 `opzSendInquiry`（`kind:booking/lesson`，帶 summary + details）。
    - `musician-dashboard.html`：「訊息」改即時讀 `inquiries`（auth 區塊加 `onSnapshot where musicianUid==我` → `window._fsInbox`）；`loadEnquiries` 回 `_fsInbox`、`renderInbox` 暴露給 module、已讀/回覆改 `__markInquiryRead`/`__saveInquiryReplies` 寫 Firestore；import 加 `where`。
    - `inquiries` Firestore 規則已加、業主已發布（見 §12.5）。
  - 🟢 **自動 Email 通知系統（全新基礎設施，見 §12）**：建 ZeptoMail + 驗證網域（DKIM/CNAME 加到 Cloudflare）+ 寫並部署 Firebase Cloud Functions（`functions/`）：`notifyMusicianOnInquiry`（新訊息→樂手信箱，信頭有紅 Logo）。本機 brew 裝 Node + firebase CLI、`firebase login`、secret `ZEPTOMAIL_TOKEN`。**實測：寄訊息→樂手 Gmail 主收件匣收到** ✅。
  - **（另一視窗並行加的）** `functions/index.js` 多了 `notifyMusicianOnReview`（樂手申請 approved/rejected → 寄信給申請人，也套 `LOGO_HEADER`）。⚠️ 本次又是多視窗並行改同檔（functions/index.js、musician-dashboard.html、musician-login.html），務必 commit 前重讀。

- **2026-06-08（本視窗：公開委托串流 / 樂手主頁載入 / 雙語內容；全部已 push 上線）**
  - **公開委托真資料流（recent-jobs ↔ 樂手後台）**：
    - `recent-jobs.html` 的「Post a Project」原本只顯示「Inquiry Sent ✓」、不存檔。改成 `window.pjSaveJob()` 用 **Firebase Anonymous Auth（沒登入就匿名登入）+ addDoc** 寫進 Firestore **`jobs`** 集合（欄位：type/ensemble/location/duration/desc/eventDate/eventTime/customerName/customerEmail/createdAt(ISO)/status:'open'/uid）。送出前**必填活動日期+時間**。Post-a-Project 表單第一排改成原生 **date + time 選擇器**（活動時間），欄位都給了 id（pjDate/pjTime/...）。
    - `musician-dashboard.html` 的「公開接案」(`#jobs-public`，原本空殼) 接上 **onSnapshot(`jobs` orderBy createdAt desc)** 即時清單：只顯示 `status==='open'` 且**未過活動日期**的委托（已接/過期自動不顯示）；卡片含活動日期+時間、地點、長度、「發布於 X 前」、客戶、「我有興趣」聯絡鈕。側邊 `sbJobsBadge` 顯示「上次看後新增幾筆」，開「公開接案」分頁即標記已看+清徽章；有新委托即時跳 `showNotif('🔔 有新的公開委托！')`。
    - `recent-jobs.html` 那 8 張**範例卡**補上「活動日期+時間」與「發布於 X 前」（中英、用相對 now 的位移算，永遠看起來新鮮），純展示用。
    - 🔴 **未通，待業主在 Firebase 主控台做 2 件事**（見 §10 第 0.5）：①Authentication→Sign-in method→開 **Anonymous**；②Firestore Rules 加 **`jobs`** 規則。我曾把規則文字貼進主控台 CodeMirror（用 JS 插入，**沒幫按發布**），但不確定業主有沒有按「發布」——**請接手視窗向業主確認 `jobs` 規則是否已發布、Anonymous 是否已開**。實測目前寫入仍 `permission-denied`（規則缺）。
  - **樂手公開主頁 `musician-profile.html` 載入體驗大修**：
    - 🐞 **「published 卻顯示空白模板」**：載入 Firestore 的那段 `<script type="module">` 用了**頂層 `return`**（module 頂層 return = SyntaxError「Illegal return statement」→整段死掉→只剩模板）。**包進 `(async()=>{ … })()`** 解掉。
    - **改用 Firestore REST 取代 SDK 讀取**：原本 `getDoc` 走 WebChannel ~2s。改成單一 `fetch()` REST GET + 一個 typed-JSON 解碼器（`fsDec/fsDoc`，輸出和 `snap.data()` 同形狀）→ 資料約 90ms 就開抓、早約 0.8s。**此頁不再載 firestore SDK**（media-sync.js 仍會 lazy 載，不擋首屏）。加了 firestore/firebasestorage 的 `preconnect`。
    - **名字+照片一起出現**：新增 `prof-pending`（head 內聯，先把 hero 名字/頭銜/地點藏起來避免閃模板）；`revealWhenReady()` **等橫幅照片 `Image()` 載完 + `document.fonts.ready` 都好**才 reveal（EN/字型慢時名字不會比照片晚出）；reveal 同時強制 `heroNameBig.fonts-ready`。localStorage 快取（`opusz_profile_<uid>`）→ 重複造訪秒開。
    - **開場動畫**（全螢幕照片→縮小→名字滑出）：改成 `window.__startHeroIntro()`，**等 reveal（照片+資料就緒）才開播**（不再在空資料上跑掉）；6s/5s 保險網。
    - **Showreel 輪播**：原本 `__applyHeroExtraSlides→__heroSlideshowReload` 會在資料一套用就 `startTimer()`（動畫沒跑完就換圖、且 goTo 在投影片還沒 inline 初始化前跑→**白閃**）。加 `_booted` 旗標：未 boot 不啟動計時器；`hero-intro-done` 後做 inline 初始化、設 `_booted`、**再等 1.5s 才開始輪播**。
    - **YouTube/Vimeo showreel 填滿**：mp4 用 `object-fit:cover` 會填滿，但 YT 把 **cinematic（比 16:9 寬）影片在自己 16:9 播放器裡上下加黑邊**（黑邊在 iframe 內，CSS 去不掉）。把 iframe **放大到 ~1.4× 舞台**（仍 16:9、`margin:auto` 置中、外框 overflow 裁掉），把 YT 黑邊推出畫面外→影片帶填滿。⚠️**取捨**：真 16:9 影片會被放大裁掉約左右各 16%。要每片自調可加 zoom 滑桿（見 §10）。`buildEmbed` + 退出全螢幕還原路徑都改。
    - **關於卡只顯示名字**：頭貼右邊拿掉「Your title · Your city」那行，名字（`#aboutMusicianName`）**跟主視覺名字同步**。
  - **列表卡片音樂（MP3）**：`musician-dashboard` 的「列表卡片 / Card」加「卡片音樂 (MP3)」欄位（重用 `pbAttachAudioUploader`→Firebase Storage），存 `config.card.audioUrl`。`musicians.html` 載 `m.audioUrl`，**卡片左下播放鍵真的用 `<audio>` 播放**（有音樂才顯示播放鍵）。
    - 🐞 **順手修卡片按鈕 bug**：`musicians.html` 卡片所有 onclick 用 `...(event,'+m.id+')` **沒加引號**，但 `MUSICIANS` 現在只有 Firestore 的**字串 uid**→拼成 `togglePlay(event,qR8q45…)`（未定義變數）→拋錯→點擊穿透到 `<a>`→**跳去主頁**。全部加引號（togglePlay/toggleFav/scrollToCard/removeFav）＋togglePlay 補 `preventDefault`。
  - **樂手內容雙語（中＝預設 / 英＝另存）**：4 區塊各加英文版——
    - 後台 `musician-dashboard`：簡介→`pbAboutBioEn`、學經歷→`pbAboutCredsEn`、每張服務→`pbSvcNTitleEn/DescEn/TagsEn`、每列亮點→`.pbHlTitleEn`；pbReadForm/pbLoadForm 存讀 `about.bioEn/credentialsEn`、`services[].{titleEn,descriptionEn,tagsEn}`、`highlights[].titleEn`。
    - 前台 `musician-profile`：新增 `applyLocalizedSections()`（在 applyProfileConfig 結尾＋`switchProfileLang` 都呼叫），依 `_profileLang` 顯示中/英。**英文留空＝該段空白（不回退中文、不自動翻譯）**（業主決定）。
  - **退役所有前台浮動編輯器**（全站）：各公開頁 `<head>` 注入 `#opz-no-fe-editors` CSS 把舊編輯器面板/按鈕 `display:none!important`（首頁 Photo/Video/responsive、blog `#ebpPanel`、musicians/lessons `.med-overlay`、shows `#editorPanel`、profile `#martin-photo-editor`/`.bve-*`）。**純 CSS，不動後台用的 JS API**（opzEdit/opzShows/opzBlogEdit/opzMusApply/applyProfileConfig）。
  - **nav hover 底線（全站）**：原本只首頁有、且用會被「逐字上色 re-split」洗掉的 `<span class="nav-ul">`。改用 `nav.js` 注入的 CSS **`::after`**（`background:#fff`+`mix-blend-mode:difference` 自動對比、滑入用 scaleX、mega-open 變黑），**首頁不吃 nav.js→另外把同款 CSS 直接寫進 `musician-platform.html`**。**nav.js 版本號 bump：全站 `?v=2`→`?v=3`**（下次改 nav.js 記得 →`?v=4`）。
  - **後台預覽 iframe 快取破壞**：`musician-dashboard` 設 `pbPreview`/snap-back 的 src 加 `&_=Date.now()` → 預覽永遠載最新 `musician-profile.html`（之前部署後預覽吃舊快取，YouTube 填滿修正看起來「沒生效」）。
  - 🐞 **Site Editor「打字後移位置→文字回退」**：`admin-panel` 的 `seBuildControls()` 被很多操作（切裝置、對齊鈕、顏色…）呼叫，每次都從 `seCurrentConfig`（上次存的）重建所有文字框→洗掉沒存的打字。修法：`seBuildControls` 開頭先把現有 DOM 欄位值快照、合併回 `cur/curCms` 當來源。
  - **音樂家頁 hero/過濾器編輯（順帶）**：`musicians.html` 接上 `site-content.js`（`data-cms-page="musicians"`）＋ `window.opzMusApply`，後台「音樂家」頁可編輯總覽 hero（標題/副標中英、背景影片/圖片、X/Y/縮放）＋過濾器文字；存 `siteContent/musicians`（`musHero`/`musFilters`）。修了「後台預覽有 hero 影片、前台沒有」＝原本 hero 媒體只存 localStorage 沒同步雲端。

- **2026-06-08（本視窗・全部已 push 上線；過程中有 3~4 個 Claude 視窗並行，commit 偶有夾帶彼此改動）**
  - **品牌 Logo 換新（全站）**：業主新 logo＝**去背圓形紅底＋白色螺旋**（檔在 `下載/Black and White Bold Kitchen Knife Logo (2).png`，2000px、含 alpha）。因幾乎所有頁的圓 logo 都吃同一個檔 `assets/images/LOGO/opusz-logo-cropped.png`，**換這一個檔＝前端 nav＋兩個後台側邊欄一次全換**。favicon 另外重生（`favicon.png` 512px、`favicon.ico` 含 16/32/48/64/128、`favicon-16/32.png`）。全站 favicon `?v=` 與 logo 圖引用都加版本號（目前 **?v=7**）強制更新快取。刪掉沒用到的舊 logo 檔。
    - ⚠️ **教訓**：別擅自「美化」業主的 logo。我一度自作主張把四角去背→紅圈邊緣出現黑邊，業主不要。**已還原成原圖、只保留他要的「容器放大 ~15%」**（`.orb 40→46`、`.sb-logo-orb 32→37`）。
  - **首頁 nav logo 文字對齊修正**：圓(`#navOrbFixed`)與文字(`#navLogoFixed`)是**兩個各自 fixed 定位**的元素。圓放大成 46px 後圓心移到 y≈41，但文字 `top` 還停在為 40px 圓算的值→文字偏上。已校正 `#navLogoFixed { top:30→33; left:90→96 }`、`:hover top:19→22`（同步 musician-platform / musician-apply / messages 三頁）。
  - **管理者密碼安全性**（`admin-login.html` 之前把帳密寫死在前端、public repo 看得到）：移除寫死的 `ADMIN_EMAIL/ADMIN_PASSWORD`，登入改成**純 Firebase Auth 驗證**（對錯由後端判斷，頁面原始碼不再有密碼）；email placeholder 改中性 `you@example.com`；交接文件裡的明文密碼也清掉。**業主已自行把 Firebase 管理者密碼重設**（舊的寫死密碼已作廢）。
  - **部落格圖片可編輯（接通到後台 Site Editor）**：`blog.html` 本來就有一套 `data-photo-id` + `localStorage('blog-photo:<id>')` 的自製圖片編輯器（但只在 localhost 出現、是頁面內彈窗）。新增 `window.opzBlogEdit` 橋接（`list/setFrame/setUrl/setImageFile`，操作同一套 localStorage + `applyAll`）；後台 `admin-panel.html` 加 `_seEng()` 引擎選擇器，讓既有的圖片編輯 UI（`seEngLoad/seEngWire`）在 blog 頁時改用 `opzBlogEdit`，blog-hero（reel-1~3）+ blog-list（feat/mini/large）都能拖曳/縮放/換圖。**`media-sync.js` 擴充**：原本只同步含 `data:` 的值，現在 `blog-photo:*` 即使只改位置/縮放（無 data:）也會同步上 Firestore `siteContent/media`，線上/跨裝置才一致。
  - **海報投稿系統（樂手投稿→管理者收）**：
    - 樂手端 `musician-dashboard.html` 新增「海報投稿」頁：上傳海報圖（JPG/PNG/WebP≤10MB，驗證+壓縮，傳 `musicians/{uid}/poster_*`）+ 演出資訊（名稱/日期/地點/簡介）+ 最多 2 個連結按鈕 → 存 **`musicians/{uid}.posterSubmissions[]`**。
    - 管理者端 `admin-panel.html` 新增「海報投稿」分頁：`getDocs(musicians)` 聚合所有樂手的 `posterSubmissions`，可篩選/標記「已張貼/未採用」（寫回各自 doc 的 status）。
    - **刻意用既有 `musicians/{uid}` 權限（樂手寫自己的）達成，不動安全規則。**
  - **樂手後台收件匣合併**：發現「工作與詢問→直接詢問」和「訊息」**讀同一份 enquiries、是重複入口**。移除「直接詢問」tab，「工作與詢問」改名 **「公開接案」**（只剩公開職缺看板）；客戶的詢價＋訊息統一在 **「訊息」**（有完整對話 UI）。概念分清：公開接案＝我去找工作、訊息＝客戶來找我。
  - **管理者後台「刪除樂手」功能**（`admin-panel.html` Musicians 列）：每列加低調紅色 🗑，點了要**親手打出該樂手完整名字**才會 `deleteDoc(musicians/{uid})`（type-to-confirm 防誤觸），有 `permission-denied` 友善提示。
    - 🔴 **目前被 Firestore 規則擋住**（規則只允許「樂手寫自己的」，管理者刪別人→permission-denied）。**功能已寫好，差規則沒放行**（見 §10 第 1 點）。
  - `musician-community.html` 左上「返回平台」按鈕原本連到前端首頁，改成連回**音樂家後台** `musician-dashboard.html`，文字改「返回後台」。
  - 後台手機預覽外框（這條線版本）：用 iPhone 16 精確尺寸 **393×852**，並修掉 `box-sizing:border-box` 害黑邊框「吃掉螢幕」的問題（強制 `content-box`），bezel/圓角/動態島隨 `--sps` 等比縮放。

  - **首頁 Hero「Canva 式」排版編輯**（後台 Hero 區段，存 `siteContent/home`）：
    - 標題/副標/兩顆按鈕/品牌字 OPUS.Z 可在預覽**直接拖曳移位**＋滑桿**調大小**（品牌字可到 400%）。
    - 位移用獨立 CSS `translate`、大小用獨立 `scale`（跟動畫的 `transform` 分開，**不影響浮現/縮放動畫**）。
    - 位移以**視窗寬度百分比**存（`heroPos[key]={xPct,yPct,s}`，舊的 px 自動換算）→ 不同螢幕寬度位置一致。
    - 品牌字顏色：自動黑白(隨背景)／色票／自訂（`heroBrandColor`）。
  - **按鈕樣式系統**（兩顆 Hero 按鈕，存 `siteContent/home`）：
    - 各自獨立：背景色/文字色/邊框色＋**背景透明度**（只淡化背景 rgba，文字邊框不透明）= `heroBtn{find,project}{bg,fg,bd,op}`。
    - 共用：**形狀**（方角/微圓/圓角/大圓角/膠囊）＋**邊框粗細**（細/中/粗）= `heroBtnShape{radius,bw}`，用 `calc(var(--k)*…)` 跟 Hero 縮放系統一致避免失真。
    - **液態玻璃 Liquid Glass**（`heroBtnGlass`）：仿 21st.dev，`.lg-glass` class ＝透明玻璃底＋多層內陰影斜邊＋`backdrop-filter:url(#container-glass)`（SVG feTurbulence/feDisplacementMap 扭曲，藍模糊備援）。SVG 濾鏡定義在 `musician-platform.html`（`<svg>#container-glass`）。「View all shows」鈕也套了同款（玻璃在它的 `::before`）。
  - Hero 文字改 **Inter 字型 + SaaS 風**（粗體緊湊大標、灰副標一行、按鈕帶 › 箭頭、彈性 hover）。左欄主視覺照片預設比右欄高（`applyColRatios` 的 LEFT_DEFAULT_H）。
  - **手機版導覽收合**（首頁 + `nav.js`/`nav.css`，所有頁）：≤900px 時把**真實的**愛心/登入/帳號/語言鈕**搬進三條線抽屜**（保留所有功能），頂部列只剩 Logo+漢堡；桌機自動搬回。Logo 手機版往左。
  - **手機版頂部大字 OPUS.Z**（`.hero-big-title`）：改置中（原本 flex-start 靠左、Z 貼邊）＋字級可調。
  - **後台預覽框大升級**：① 桌機「標準螢幕」改用 `window.innerWidth`（= 真站視窗寬，位置才對得上）② 切裝置時**用該寬度重載 iframe**（取得正確 RWD + boot 寬度）③ 照片編輯框長寬比**自動對齊該格在頁面實際顯示的比例**（`seEngApplyAspect`，所見即所得）④ **iPhone 預覽框**做成真 iPhone：黑邊框包四邊、頂部**仿真狀態列**（9:41＋訊號/Wi-Fi/電量，底色=首頁 `#f8f8f8`、深色圖示、`--se-status-bg/-fg` 可調）、動態島、**狀態列算在螢幕高度內**所以比例=真 iPhone 16（2.168）。
  - **後台合作廠商編輯器**：跑馬燈改資料驅動（`siteContent/home.partners`，`opzRenderPartners`），可增/刪/改名/排序＋每家可上傳 logo（沒上傳就顯示名稱、避免商標問題）；名單太短時自動重複填滿、無縫循環。
  - **分類 Categories 區段**加入後台可編輯（`SE_FIELDS` 的 `discover`）；`applyCat()` 改成尊重 i18n 覆寫。
  - 合併後台「儲存文字＋發佈照片」為**單一「🚀 儲存並發布到網站」鈕**；發佈照片改背景執行＋逾時，**按鈕不會再卡在「發佈中」**。
  - 🐞 **`server.py` 重大修正**：POST 回應（`/upload-file` 等）原本**沒送 `Content-Length`**，HTTP/1.1 keep-alive 下瀏覽器會一直等連線關閉 → **照片上傳看起來卡住約 30 秒才逾時**（任何圖都中，不是 HEIC 問題）。已在 `_ok`/`_err` 補上 `Content-Length`。**改完要重啟 server.py 才生效。**
  - 照片上傳：`compressImg` 加逾時（HEIC 在 Chrome 不觸發 onload/onerror 會卡死）＋後台上傳器偵測 HEIC 提示改用 JPG/PNG＋30 秒逾時保護。

- **2026-06-08（另一條線：樂手公開檔案 / 系統公告 / 海報 / 手機修正；皆已 push）**
  - 🔴 **架構雷（最重要）**：**首頁 `musician-platform.html` 有自己一套 inline nav，不載入 `nav.js`**。所以 nav 行為類修正（登入/帳號互斥、抽屜…）**首頁與 nav.js 兩邊都要改**。已把 `nav.js` 全站 `<script src>` 加 **`?v=2`** 強制刷快取 → **以後再改 nav.js，記得 bump 成 `?v=3`**，否則瀏覽器吃舊版（本視窗測試一直被舊 nav.js 快取坑到）。
  - **Nav 登入/帳號修正**：手機抽屜裡「Log in」與「My Account」**依登入狀態只顯示一個**（抽屜 CSS 用 `!important` 強制顯示，故 JS 改用 `setProperty('display',..,'important')` 壓過）；登入下拉選單（在抽屜外）開啟時**不關閉抽屜**（`closeDrawer` 加 `menuOpen()` guard）。**首頁 inline nav 與 nav.js 同步改**。
  - **全站隱藏捲動軸**：每頁 `<head>` 注入 `<style id="opz-no-scrollbar">`（`*{scrollbar-width:none;-ms-overflow-style:none}` + `*::-webkit-scrollbar{display:none}`）。內容照捲、只是看不到那條線。
  - **系統公告（管理者→全樂手）**：admin「Announcements」頁原本是**假的(stub)**，已接通 → 寫進 **`siteContent/announcements`** = `{items:[{id,title,body,urgency,ts}]}`（siteContent **admin 寫/公開讀，不用改規則**），含歷史清單＋逐則刪除。樂手後台「**總覽**」最上方顯示最新公告（依緊急度配色）；**每位樂手「第一次看到後 24 小時自動消失」**——純 localStorage(`opusz_ann_seen_<id>`) 比對時間，**零伺服器負擔/零額外讀寫**。
  - **Showreel 影片大改**（`musician-dashboard` 編輯 + `musician-profile` 顯示，存 `musicians/{uid}.config.videos[]`）：
    - **動態清單**：起始 1、**最多 3**、每片可**刪任一個**（不是只刪最後）。
    - **影片標題 → 顯示成影片上的大字**；新增**副標題**（大字下方，預設「Showreel」）；移除底部那個舊 caption 標題。
    - 每片**畫面位置 X/Y**，**桌機/手機各一套**（`x/y/xm/ym` → `object-position`，僅對 mp4 `<video>` 有效；iframe 無法 pan）。
    - 手機「**放大**」鍵 = **頁面內橫向疊層**（`position:fixed` 填滿手機框/手機螢幕，旋轉 90°），含**靜音鍵＋進度條**（重用既有 `mediaCtl`）。⚠️ **不要用瀏覽器原生全螢幕**——原生會衝出 iframe、在後台預覽時佔滿整個電腦螢幕（業主明確不要）。
  - **Career Highlights（亮點）**（`musician-dashboard` + `musician-profile`，存 `config.highlights[]`）：每條加 **▲▼ 排序**；右側大圖**預設顯示「第一個有圖的亮點」**、**滑到哪張就停在哪張（不跳回最前）**；每張可調 **X / Y / Zoom**（`imageX/imageY/imageZoom` → `background-position` + `transform:scale`，frame 已 `overflow:clip`）。
  - **海報投稿**：樂手上傳改成**存原檔、完全不壓縮**（保留原始長寬）＋ `Content-Disposition:attachment`；admin 海報卡片加「**⬇ 下載原圖**」（`fetch→blob` 強制下載，CORS 擋則開新分頁＋新檔靠 attachment 也會下載）與「**🗑 刪除**」（從 `posterSubmissions[]` 移除）。
  - **客戶管理**：每列加「🗑 刪除」鈕（confirm 後 `deleteDoc(customers/<id>)`）。⚠️ 可能同樣被 Firestore 規則擋（見 §10）。
  - **首頁 Hero 輪播標語**（`siteContent/home`）：三句**共用同一位置**，可在預覽**拖曳**或用 **X/Y 滑桿**移動＋**對齊(左/中/右)**＋換行，**分桌機/手機**（`heroPos.phrases` / `heroPosPhone.phrases` + `heroPhrase{align,wrap}`，`site-content.js` 套用）。⚠️ **業主明確要求標語維持原本「浮現→淡出」捲動動畫、編輯器不要硬把它釘出來**——我曾加 pin/peek 被退回，**已移除，請勿再加**。
  - **首頁手機白卡**：`_cardEndScale` 手機 **0.69**、桌機 0.60（`musician-platform.html`）。**音樂家列表頁** `musicians.html`：載入中顯示**骨架卡**（`window.musiciansLoaded` 旗標），不再先閃「No musicians found」。**樂手公開檔手機版** Hero 大名字**自動折行、不被右邊切掉**（mobile-only CSS）。
  - **上傳失敗訊息**：壓縮失敗（HEIC 等無法解碼）改顯示「**圖片格式不支援，請改用 JPG/PNG/WebP**」，不再誤導去動 Storage 規則。

- **2026-06-07（這次 session）**
  - 首頁 Hero 重做：置中大標語「遇見台灣菁英音樂家」＋副標＋品牌字 OPUS.Z（升起動畫、純黑/可調色）、文字 `mix-blend-mode` 黑白反轉。
  - 移除前端所有編輯器（P 照片/Q 版面/R 預覽/O 跳轉）；編輯全集中後台。
  - 後台 Site Editor → **多分頁**（6 頁）；預覽可自由導覽＋登入（`site-content.js` 編輯模式放行導覽、帶 `cmsedit=1`）。
  - **演出頁海報編輯器**：圖＋資訊合一卡、拖曳移位/大小/模糊/背景XY、拖照片上傳(→Storage)、增減張數；設定存 Firebase `siteContent/shows.posters` → 線上後台可改。中間海報放大、左側資訊放大右移。
  - 通用自動編輯器（子頁掃描 data-i18n/媒體/連結）。
  - **移除付費方案**：方案頁/側欄/邀請碼/教學鎖/後台 Tier 徽章/公開頁 premium gate 全砍；人人可演出＋教學，教學每人自行開關。
  - 修音樂家後台「編輯主頁」預覽無限重整（用 uid 載入＋一次性 snap-back 防迴圈）。
  - 清除三頁假音樂家「Martin」（musicians/lessons/favourites）。
  - （另一條線並行）部落格頁可編輯、海報投稿(musician dashboard/admin inbox)、Hero 按鈕玻璃質感。
- **2026-06-04**：搬到 Cloudflare Pages；`media-sync.js`；Shopify 式區段編輯器；綁定 `opuszmusic.com`。

---

## 10. 待辦 (TODO，建議順序)

0. 🔴 **放行管理者管理樂手權（Firestore 規則）** — 後台「刪除樂手」(`deleteMusician`) 已寫好但被擋。現有 `musicians/{uid}` 寫入規則只允許 `request.auth.uid == uid`（樂手寫自己）。要讓管理者能刪/改任何樂手，把 write 改成：
   ```
   match /musicians/{uid} {
     allow read: if true;
     allow write: if request.auth != null
       && (request.auth.uid == uid
           || request.auth.token.email == 'tzutung.liao@gmail.com');
   }
   ```
   ⚠️ 改安全規則＝動存取控制，**Claude 不可代業主發布**；帶業主到 Firebase Console → Firestore Database → 規則，貼上後**由業主親手按「發布」**。（「停用樂手」suspend 同樣是 admin 改別人 doc，改完一起生效。）順帶：業主想刪的測試帳號 **TEST**＝業主用自己 `yoshino1590012@gmail.com` 建的（uid `Yko3QTjFa2QHsn54iFFGUahwJWg2`，簡介亂打 123123…）。
   - 🔴 **客戶刪除同款問題**：admin「客戶管理」的 🗑 刪除（`deleteDoc(customers/<id>)`）若 `customers` 規則沒放行管理者刪除，一樣會 permission-denied。要的話比照上面，給 `customers/{id}` 加 `|| request.auth.token.email == 'tzutung.liao@gmail.com'` 的 write 規則。**海報刪除**是改 `musicians/{uid}.posterSubmissions[]`（樂手自己的 doc）——若由管理者操作別人的 doc，也吃同一條 musicians 規則。
   - **海報「下載原圖」CORS**：admin 下載鈕用 `fetch→blob`，若 Firebase Storage 沒開放跨來源讀取會被 CORS 擋（已 fallback 開新分頁；新上傳帶 `Content-Disposition:attachment` 開了也會下載）。要「一鍵直接下載」更順，可用 `gsutil cors set` 給 bucket 設 CORS 允許 `opuszmusic.com`/`localhost`。

0.6. 🟡 **公開委托(jobs) → 自動 email 通知「全體樂手」**（2026-06-09 待辦）：目前只有「私人訊息(inquiries)→單一樂手」會自動寄 email（§12）。委托是公開的，業主要求**發布委托時自動 email 給所有樂手**。做法：在 `functions/index.js` 加一個 `onDocumentCreated('jobs/{id}')`，用 `admin.auth().listUsers()` 或撈 `musicians` 集合所有 uid → 各自查 email → 用同一個 `sendZepto()` 寄（注意：量大時要分批、加退訂連結/合法性，見 §12 注意事項）。**課程預約流程目前沒收集學生 email**（樂手收到預約但無對方信箱可回）→ 可在 `musician-profile.html` 的 lesson modal 加 email 欄位。

0.7. 🟡 **把 `functions/` 提交進 git**（2026-06-09）：Cloud Functions 程式（`functions/index.js`、`firebase.json`、`.firebaserc`）**已部署但還沒 commit 進 GitHub**（當時有另一視窗並行改同檔、git 工作區有別人未提交的改動，沒硬推）。請接手視窗確認工作區乾淨後，`git add functions firebase.json .firebaserc`（`functions/.gitignore` 已排除 node_modules）→ commit → push。**注意 `functions/index.js` 可能被多視窗改過，commit 前先重讀。**

0.5. ✅ **（已完成）公開委托串流 + Anonymous 登入**：2026-06-09 確認 **Anonymous 登入已開、`jobs` 規則已發布**（`inquiries` 也用匿名登入寫入成功、`jobs` 集合已有真實資料）。委托流程已通。下面這段保留作參考：
   - ① **Authentication → Sign-in method → 開啟 Anonymous（匿名登入）**：讓沒登入的客人也能送委托（`pjSaveJob` 會匿名登入再寫入）。
   - ② **Firestore Database → Rules**，在 `match /databases/{database}/documents {` 內加：
     ```
     match /jobs/{jobId} {
       allow read:   if request.auth != null;
       allow create: if request.auth != null
                     && request.resource.data.status == 'open'
                     && request.resource.data.createdAt is string;
       allow update, delete: if request.auth != null
                     && request.auth.token.email == 'tzutung.liao@gmail.com';
     }
     ```
   ⚠️ 改規則＝動存取控制，**Claude 不可代發布**，帶業主親手按「發布」。**接手請先確認這兩項是否已完成**（之前可能貼了規則但沒按發布）。完成後可實測：客戶送委托→樂手後台「公開接案」即時出現。

1. **部落格「文字可編輯」**（banner/文章的標題、標籤）：圖片已可編輯（§9 2026-06-08），但 `.rs-title`/`.feat__title` 文字還寫死在 `blog.html`、`.rs-tag`/`.feat__tag` 是 `data-i18n`。要接成後台可編輯（**業主有要求，是這條線唯一沒做完的**）。

2. **演出頁海報「刪指定某張 / 拖曳排序」**（目前只能刪最後一張）：需把海報文字從 index 綁定的 i18n 改成「綁進每張海報的資料(`posters[].text`)」，這樣刪中間/換序文字才不會錯位（在 `shows.html` 的 `opzShows`：讓 `applyAll` 由 `ST.shows[i]` 直接渲染文字；`removeAt(i)`/`move(i,dir)` = 陣列操作 + 重畫）。
2. **音樂家後台手機預覽加「手機外框」**：抄 `admin-panel.html` 的 `#seFrameWrap.se-phone`（邊框＋瀏海）到 `musician-dashboard` 的 `pbFrameInner`，在 `pbSetDevice('mobile')` 時加 class。
3. **Lessons 老師列表自動列出**：從 Firestore 撈 `config.lessons.visible` 的音樂家列到 `lessons.html`（目前該頁是空的）。
4. **子頁更多區段可編輯**：照 §3(4) 模式，給 blog/musicians/jobs/lessons 的各區段加 `data-cms-section` + `SE_SECTIONS_BY_PAGE`。
5. **影片連結搬雲端**：`mono-hero-video`/`lessons-hero-video`/`martin-showreel-videos`/`mono-vid-*`（Cloudinary 網址存 localStorage）→ 納入 `siteContent/media` 或各頁 config。
6. 未轉 Firestore 的功能（詢問訊息、課程預約、收藏）仍 localStorage（見 `ADMIN_CMS_HANDOFF.md`）。
7. **（可選）Showreel YouTube 每片 zoom 滑桿**：目前 YT iframe 固定放大 ~1.4× 以裁掉 cinematic 黑邊（會讓真 16:9 影片被裁約左右各 16%）。若業主要「16:9 不裁、寬影片才放大」，在 showreel 編輯器加一個 zoom 滑桿（存 `config.videos[i].zoom`），`buildEmbed` 依該值決定放大倍率（預設 0＝只做 16:9 cover）。
8. **公開委托後續**（§9 本視窗已做基本流）：可加「樂手接案→標記 accepted（status 改）→從看板消失」「客戶在後台看自己發的委托/回覆」「委托真的進樂手訊息匣」等。目前委托是單向公開看板，沒有接受/媒合流程。

---

## 11. 給接手 Claude 的開場 SOP
1. 讀本檔 → `ADMIN_CMS_HANDOFF.md` → `SECURITY-CHECKLIST.md`。
2. 確認 `git status` 乾淨、`git log` 看最近進度；本機 `python server.py 8080` 是否在跑。
3. 動工前先判斷：這次要改的是**模型 A(Firebase)** 還是 **模型 B(檔案型)**？要不要 server.py？
4. **確認沒有別的視窗在改同一個檔**（問業主）。改前重讀、改後 `pull --rebase` 再 push。
5. 動畫/版面類改動，自己無法用工具完全驗證 → 請業主在真站確認，並用 `jsc` 做語法檢查避免推壞。
6. 回業主一律中文白話＋可執行步驟。
7. 🆕 **動到「訊息/通知/寄信」→ 先讀 §12**（這是 2026-06-09 新增的後端 + Cloud Functions 基礎設施，跟前面純前端的東西不一樣）。

---

## 12. 🆕 訊息後端 + 自動 Email 通知（2026-06-09 新增｜最重要的新基礎設施）

> 這是全站第一個「真．後端」：客戶在前台的動作 → 寫 Firestore → **Firebase Cloud Function** 觸發 → 透過 **ZeptoMail** 以 `info@opuszmusic.com` 寄 email 給樂手。跟前面那些「純前端 + Firestore 直接讀寫」不同，這裡有伺服器端程式（functions/）。

### 12.1 整條資料流
```
客戶在 musician-profile 按 Message/Check availability/Book a lesson
   → window.opzSendInquiry() 匿名登入 + addDoc 寫進 Firestore `inquiries`
       （欄位：kind:'message'|'booking'|'lesson', musicianUid, name, email,
         subject, message, details, musicianName, createdAt, ts, read, replies）
   → (A) 樂手後台「訊息」即時顯示（onSnapshot where musicianUid==我）
   → (B) Cloud Function `notifyMusicianOnInquiry` 觸發
         → 查該樂手 email（admin.auth().getUser(uid).email，退而求其次 musicians/{uid}.email）
         → 用 ZeptoMail HTTP API 以 info@opuszmusic.com 寄通知信（信頭有紅 Logo）
```
另有 `notifyMusicianOnReview`（另一視窗加的）：`musicians/{uid}` 的 `status` 變 approved/rejected 時，寄審核結果信給申請人。

### 12.2 ZeptoMail（寄信引擎）
- **登入**：用業主的 **Zoho 帳號**（zeptomail.zoho.com）。Mail Agent = `agent_1`。
- **網域 `opuszmusic.com` 已驗證**：在 Cloudflare 加了 2 筆 DNS（已生效）：
  - `TXT  88174._domainkey` = DKIM 公鑰（`k=rsa; p=...`）
  - `CNAME  bounce-zem` → `cluster89.zeptomail.com`（**必須 DNS only / 不要 Proxied**）
- **寄信金鑰（Send Mail Token）**：在 ZeptoMail → agent_1 → 「SMTP / API」→ Password 1。**已存成 Firebase secret `ZEPTOMAIL_TOKEN`**（只存 token 本身；程式裡 Authorization 自動加 `Zoho-enczapikey ` 前綴）。
- **免費額度**有限；量大要在 ZeptoMail「Subscription」買 credits（很便宜，~US$2.5/1萬封）。

### 12.3 Firebase Cloud Functions（`functions/` 資料夾）
- `functions/index.js`（2nd gen, Node 20）：`notifyMusicianOnInquiry`（onCreate `inquiries/{id}`）＋ `notifyMusicianOnReview`（onUpdate `musicians/{uid}`）。共用 `sendZepto()`、`musicianEmail()`、`LOGO_HEADER`、secret `ZEPTOMAIL_TOKEN`。
- `firebase.json`（functions source/runtime）、`.firebaserc`（default = opusz-45280）。`functions/.gitignore` 排除 node_modules。
- 函式在 **us-central1**；Firestore DB 在 **nam5**（含 us-central1，相容，沒問題）。
- ⚠️ **`functions/` 目前還沒 commit 進 git**（已部署但未進版控）→ §10 第 0.7 點。

### 12.4 部署 / 改 / 看 log（給接手視窗）
本機已用 Homebrew 裝好 **Node.js + firebase-tools**，路徑在 `/opt/homebrew/bin`（指令前先 `export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"`）。已 `firebase login`（**yoshino1590012@gmail.com**，對 opusz-45280 有權限）。
- **部署函式**：`cd /Users/martinliao/opusz-website && firebase deploy --only functions --force`
- **看執行紀錄/除錯**：`firebase functions:log`（或 Firebase Console → Functions → Logs）
- **改/換寄信金鑰**：在 ZeptoMail 複製 token → `pbpaste | tr -d '\r\n' | firebase functions:secrets:set ZEPTOMAIL_TOKEN --data-file -` → 重新部署。**全程不要把 token 印出來/寫進 repo。**
- ⚠️ **第一次部署 2nd gen 函式的雷**：（1）會自動啟用一堆 Google Cloud API（Cloud Functions/Build/Run/Eventarc/Artifact Registry…），第一次較久；（2）常見錯誤「Eventarc Service Agent permission … retry in a few minutes」＝權限還在傳播，**等 2~3 分鐘重跑 deploy 就會過**；（3）若報「failed to modify IAM policy / re-run as project owner」＝登入帳號權限不夠，需用**專案 Owner** 身份（yoshino 這次夠用）。

### 12.5 Firestore 規則（本次新增，業主已發布）
`inquiries` 集合規則（任何登入者可建立、只有該樂手讀/改自己的）：
```
match /inquiries/{id} {
  allow create: if request.auth != null;
  allow read, update, delete: if request.auth != null
                               && request.auth.uid == resource.data.musicianUid;
}
```

### 12.6 寄件人頭像 Logo（BIMI）— 業主問過，現階段「不做」
Gmail 寄件人旁邊的圓圈頭像要變成品牌 Logo，需 **BIMI + DMARC 強制 + VMC 付費憑證**（VMC 還要求 Logo 是**註冊商標**，憑證 ~US$1000/年）。CP 值太低，**已跟業主說明、現階段不做**；信件「內容裡」的紅 Logo 已加（`LOGO_HEADER`，每封官方信都有）。未來品牌做大有預算＋商標再回來做。

### 12.7 相關雷區
- **curl 測線上 HTML 要加 `-L`**：Cloudflare Pages 把 `xxx.html` **308 轉址**成無副檔名 `/xxx`，不跟轉址會抓到空字串（我一度誤判「沒部署」）。例：`curl -sL https://opuszmusic.com/musician-profile`。
- **讀機密/長字串（DKIM、token）避開隱私過濾**：瀏覽器 JS 直接回傳 key 字串會被擋（"Cookie/query string data"）→ 改回傳**字元碼陣列**再 bash 解碼；或用網頁的「複製鈕」+ `pbpaste` 灌進去（token 走這條最安全）。
