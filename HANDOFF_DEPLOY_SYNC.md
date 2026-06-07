# OPUS.Z — 系統交接手冊 (HANDBOOK / DEPLOY & SYNC)

> **給下一個接手的 Claude 視窗：先讀這份（全貌＋部署＋前後台串接），再讀 `ADMIN_CMS_HANDOFF.md`（CMS 細節）、`SECURITY-CHECKLIST.md`。**
> 業主（Martin / yoshino1590012）不是工程背景 → 回答一律**中文、白話、給可執行步驟**。
> 目標：讓這個系統「**能一直被傳承下去**」。看完這份你應該知道：平台在幹嘛、東西存在哪、怎麼上線、改東西要在哪改、哪裡有雷。

最後更新：2026-06-07

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

**🔴 still open（見 §10 待辦）：** 演出頁「刪指定某張海報／拖曳排序」、音樂家後台手機預覽要加手機外框、Lessons 老師列表自動列出、子頁更多區段的圖片編輯、影片連結搬雲端。

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

### Firebase 安全規則（現狀）
- Firestore：`match /siteContent/{page}` → 任何人可讀；只有 `tzutung.liao@gmail.com` 可寫。`musicians`/`customers` 各有既有規則（音樂家寫自己的）。
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

---

## 8. 業主白話名詞

- **GitHub**＝程式碼雲端倉庫＋備份。**push**＝把改好的檔上傳 GitHub（沒 push 線上不會更新）。
- **Cloudflare Pages**＝把網站放上網的主機，收到 GitHub 更新就自動重做。
- **Firebase**＝Google 後端：Firestore(資料庫文字/設定)、Storage(圖片影片檔)、Auth(登入)。
- **server.py**＝你電腦上的小幫手程式，負責把「照片存成檔案、寫設定檔、一鍵上傳」；**要先打開它（localhost:8080）**才能改照片那類東西。
- **兩種存檔**＝① 文字/海報設定 → 存雲端(Firebase)，線上後台就能改；② 照片檔/首頁照片 → 存成檔案，要在你電腦 localhost:8080 改完按發佈。

---

## 9. 變更紀錄 (CHANGELOG)

- **2026-06-07（本視窗・接續，全部已 push 上線）**
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

1. **演出頁海報「刪指定某張 / 拖曳排序」**（目前只能刪最後一張）：需把海報文字從 index 綁定的 i18n 改成「綁進每張海報的資料(`posters[].text`)」，這樣刪中間/換序文字才不會錯位（在 `shows.html` 的 `opzShows`：讓 `applyAll` 由 `ST.shows[i]` 直接渲染文字；`removeAt(i)`/`move(i,dir)` = 陣列操作 + 重畫）。
2. **音樂家後台手機預覽加「手機外框」**：抄 `admin-panel.html` 的 `#seFrameWrap.se-phone`（邊框＋瀏海）到 `musician-dashboard` 的 `pbFrameInner`，在 `pbSetDevice('mobile')` 時加 class。
3. **Lessons 老師列表自動列出**：從 Firestore 撈 `config.lessons.visible` 的音樂家列到 `lessons.html`（目前該頁是空的）。
4. **子頁更多區段可編輯**：照 §3(4) 模式，給 blog/musicians/jobs/lessons 的各區段加 `data-cms-section` + `SE_SECTIONS_BY_PAGE`。
5. **影片連結搬雲端**：`mono-hero-video`/`lessons-hero-video`/`martin-showreel-videos`/`mono-vid-*`（Cloudinary 網址存 localStorage）→ 納入 `siteContent/media` 或各頁 config。
6. 未轉 Firestore 的功能（詢問訊息、課程預約、收藏）仍 localStorage（見 `ADMIN_CMS_HANDOFF.md`）。

---

## 11. 給接手 Claude 的開場 SOP
1. 讀本檔 → `ADMIN_CMS_HANDOFF.md` → `SECURITY-CHECKLIST.md`。
2. 確認 `git status` 乾淨、`git log` 看最近進度；本機 `python server.py 8080` 是否在跑。
3. 動工前先判斷：這次要改的是**模型 A(Firebase)** 還是 **模型 B(檔案型)**？要不要 server.py？
4. **確認沒有別的視窗在改同一個檔**（問業主）。改前重讀、改後 `pull --rebase` 再 push。
5. 動畫/版面類改動，自己無法用工具完全驗證 → 請業主在真站確認，並用 `jsc` 做語法檢查避免推壞。
6. 回業主一律中文白話＋可執行步驟。
