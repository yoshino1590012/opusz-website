# 改名計畫：OPUS.Z → 渡聲 Dushen

> 掃描日期：2026-09-24 ｜ 新網域：**dushenmusic.com**（已購入，到期 2027-09-24）
> 舊網域：opuszmusic.com（2026-05-27 註冊，到期 2027-05-27）
> **這份是清單，還沒動工。** Martin 確認後才開分支改。

---

## ⚠️ 開工前要 Martin 決定的 2 件事

### 決定 1：中英文各顯示什麼？
現在的 `OPUS.Z` 中英文通用，但新名字有兩個形式。三選一：

| 選項 | 中文站顯示 | 英文站顯示 | 影響 |
|---|---|---|---|
| **A**（建議） | 渡聲 | Dushen | 最自然，但要改 i18n 字典，多約 80 處 |
| **B** | Dushen | Dushen | 最省事，但中文站看不到中文名 |
| **C** | 渡聲 Dushen | 渡聲 Dushen | 一致但字長，nav / footer 版面要重調 |

### 決定 2：LOGO 圖形換不換？
| | 要改的東西 | 工作量 |
|---|---|---|
| **不換**（只換文字） | 無 | 0 |
| **換** | `assets/images/LOGO/*` 2 個檔、favicon 5 個檔、**`page-transition.js` 的一筆畫軌道要整個重刻**（4837 字元的手刻座標） | 大，要另外排時間 |

---

## 一、要改的（程式，我來做）

### A. 使用者看得到的品牌字 — 約 500 處 / 54 個檔
逐檔數量（前段）：

| 處數 | 檔案 | 備註 |
|---|---|---|
| 68 | `musician-platform.html` | 首頁，含 JSON-LD |
| 36 | `terms.html` | 服務條款，法律文字 |
| 32 | `musician-community.html` | |
| 30 | `about.html` | |
| 29 | `musician-dashboard.html` | |
| 26 | `blog-opusz-intro.html` | ⚠️ **檔名本身含 opusz** |
| 26 | `admin-panel.html` | |
| 25 | `functions/index.js` | ⚠️ **寄信模板，見 C** |
| 23 | `customer-profile.html` | |
| 22 | `musician-login.html` | |
| 20 | `blog.html` | |
| 16 | `privacy.html` / `blog-wedding-quartet.html` | |
| 13 | `musician-profile.html` / `macbook-editor.html` | |
| 3–9 | contact, lessons, footer.js, site-content.js, shows, recent-jobs, musicians, messaging.js, verify-email, newsletter-success, musician-apply, mobile-editor, instruments.js, customer-login, manifest*.json, admin* | |
| 1–2 | sign.html, nav.js, page-transition.js, notifications.js, newsletter.js, login-characters.js, firebase-config.js, favourites.html, assets/js/*.js | |

### B. 網域 opuszmusic.com → dushenmusic.com — 71 處 / 17 個檔

| 處數 | 檔案 | 風險 |
|---|---|---|
| 12 | `privacy.html` | |
| 10 | `musician-platform.html` | canonical / og:url / JSON-LD |
| **9** | **`sitemap.xml`** | 🔴 SEO 關鍵，9 條網址全要換 |
| 8 | `terms.html` | |
| 6 | `functions/index.js` | 信裡的連結 |
| 5 | `contact.html` | |
| 1–4 | blog*, about, musician-profile, **robots.txt**, newsletter.js, musician-login, musician-dashboard, customer-login, admin-panel | |

### C. 🔴 寄信設定（最高風險，改錯全站信件失效）
`functions/index.js` 第 18 行：
```js
const FROM = { address: "info@opuszmusic.com", name: "OPUS.Z" };
```
→ 改成 `info@dushenmusic.com` / `渡聲 Dushen`
**必須先在 ZeptoMail 把 dushenmusic.com 驗證通過，DNS 設好 SPF/DKIM/DMARC，再改這行。**
順序反了 = 所有通知信直接進垃圾桶或退信。

### D. 檔名含 opusz 的檔案
- `blog-opusz-intro.html` → 建議改名 `blog-dushen-intro.html`
  - ⚠️ 改檔名 = 舊網址失效，要在 Cloudflare 加一條轉址
  - 但這頁目前入口已隱藏（見 HANDOFF §14），**可以先不改**
- `assets/images/LOGO/opusz-logo.svg` / `opusz-logo-cropped.png`
  - 檔名不影響使用者，**除非換 LOGO 否則不動**

---

## 二、不要改的（改了會出事）— 共 353 處

| 類別 | 處數 | 為什麼不能改 |
|---|---|---|
| `opusz_lang`、`opusz_admin_loggedIn`、`opusz_role` 等瀏覽器儲存 key | **156** | 改了＝**所有人被登出、語言設定重置、收藏清空**。使用者完全看不到這些字 |
| `opuszPublishPost`、`opuszUploadCommunityPhoto` 等 JS 函式名 | **124** | 純內部名稱，改了只有 bug 風險、零好處 |
| Firebase 專案 ID `opusz-45280` | **73** | 🔴 **Google 規定永久不可改名**。要換＝開新專案搬所有資料和帳號，不值得 |

**Firebase 那 73 處使用者會看到嗎？** 平常完全不會。唯一可能露出的是「用 Google 登入」的彈窗網址列會出現 `opusz-45280.firebaseapp.com`。要蓋掉可以另外接自訂驗證網域，**但那是選配，不影響改名完成度**。

---

## 三、grep 找不到、但一定要改的（存在 Firebase / 本機編輯器）

> 這是最容易漏的一塊。依 HANDOFF §3「兩種存檔模型」：

| 內容 | 存在哪 | 怎麼改 |
|---|---|---|
| 首頁文案、Hero 標題、平台政策、邀請信文案、公告 | **Firebase** `siteContent/home`、`/policy`、`/invite`、`/media`、`/announcements` | 用管理者帳號登入**線上後台 admin-panel**，一條一條看過改掉 |
| 首頁照片設定等 | **檔案型** `site-data.json`（**有 6 處 OPUS 字樣**） | 只能在 `localhost:8080` 編輯後按發佈 |
| 音樂家自己寫的簡介裡若提到 OPUS.Z | Firebase 各音樂家 doc | 通知他們自行修改，或後台批次處理 |

---

## 四、Martin 要做的行政（我給步驟，你點）

依**執行順序**排，不可跳號：

| # | 事項 | 風險 |
|---|---|---|
| 1 | Cloudflare 加入 dushenmusic.com，把 Porkbun 的 NS 指過去 | 🟡 |
| 2 | ZeptoMail 新增 dushenmusic.com 寄件網域，拿到 SPF/DKIM 記錄 | 🔴 最容易出事 |
| 3 | 在 Cloudflare DNS 貼上 SPF / DKIM / DMARC 三筆記錄，等驗證通過 | 🔴 設錯＝信進垃圾桶 |
| 4 | **Firebase Console → Authentication → 授權網域加入 dushenmusic.com** | 🔴 **忘了做＝全站登不進去** |
| 5 | Cloudflare Pages 綁定新的自訂網域 | 🟡 |
| 6 | 舊網域 opuszmusic.com 設 301 轉址到新網域 | 🔴 不做＝所有舊連結全斷 |
| 7 | **舊網域續約至少到 2028**（目前 2027-05-27 到期） | 🔴 到期＝轉址失效 |
| 8 | Google Search Console 開新資源、驗證、送新 sitemap | 🟡 SEO 重來（才 4 個月，損失很小） |
| 9 | 通知現有音樂家 | 🟢 |

### ⚠️ 絕對不能刪的檔
`googlee6c6f6d0a72e3f4f.html` — **舊網域**的 Search Console 擁有權驗證檔。
新網域要另外下載一個新的驗證檔，**舊的在舊網域退役前都不能刪**。

---

## 五、時間估

| 階段 | 誰 | 時間 |
|---|---|---|
| 程式整批改 + 驗證歸零 | 我 | 半天～1 天 |
| Firebase 後台文案逐條改 | 我+你 | 1～2 小時 |
| 行政 9 步（網域/DNS/Auth/SEO） | 你（我給步驟） | 2～3 小時（DNS 要等生效） |
| **總計** | | **一個週末** |

---

## 六、驗收標準（改完怎麼確認沒漏）

```bash
# 這三個數字都要是 0
grep -ro 'OPUS\.Z\|OPUSZ\|OPUS Z' --include='*.html' --include='*.js' --include='*.json' --include='*.xml' . | wc -l
grep -ro 'opuszmusic\.com' --include='*.html' --include='*.js' --include='*.json' --include='*.xml' --include='*.txt' . | wc -l
grep -ro 'info@opuszmusic\.com' --include='*.html' --include='*.js' . | wc -l

# 這三個數字「不該」變（確認我沒手滑改到不該改的）
grep -rho "opusz_[a-zA-Z]*" --include='*.html' --include='*.js' . | wc -l   # 應為 156
grep -rho "opusz[A-Z][a-zA-Z]*" --include='*.html' --include='*.js' . | wc -l # 應為 124
grep -rho "opusz-45280" --include='*.html' --include='*.js' --include='*.json' . | wc -l # 應為 73
```

上線後要實測：註冊、登入、寄通知信、換語言、收藏 —— 這五項只要有一項掛掉就是改壞了。

---

# 📌 執行進度（2026-09-25 更新）

## ✅ 已完成

| # | 事項 | 備註 |
|---|---|---|
| 1 | 程式全部改名 | 分支 `rename/dushen`，**尚未合併到 main** |
| 2 | Firebase Auth 授權網域 | 已加 dushenmusic.com / www，舊網域保留 |
| 3 | 網域 dushenmusic.com | Porkbun 購入，NS 指向 Cloudflare |
| 4 | Cloudflare Pages 綁定 | 主網域 + www，SSL 已簽發 |
| 5 | **寄信**（ZeptoMail）| 網域已 Verified，掛在 `agent_1`（＝現有 API 金鑰可直接用，不必換）|
| 6 | **收信**（Cloudflare Email Routing）| `info@dushenmusic.com` → `tzutung.liao@gmail.com` |
| 7 | Martin 的音樂家簡介 | Firebase 5 個欄位已改（備份在 `~/opusz-backups/`）|
| 8 | ZeptoMail 帳號驗證表單 | 已送出，3 個工作天內審核（過了額度 100/天 → 10,000）|

## ⏳ 未完成

| # | 事項 | 誰做 |
|---|---|---|
| 9 | 合併 `rename/dushen` → main（＝正式上線）| Claude |
| 10 | Firebase `siteContent` 的 16 處舊品牌字 | Claude，**要跟 9 同時做** |
| 11 | 舊網域 opuszmusic.com → 301 轉址 | Claude |
| 12 | Google Search Console 新資源 + sitemap | Martin |
| 13 | 舊網域續約到 2028（目前 2027-05-27 到期）| Martin |

## 🔑 這次學到的關鍵事實（別重複踩）

- **Zoho Mail 免費版只能綁 1 個網域** → 收信改用 Cloudflare Email Routing（免費轉寄），不是 Zoho。
- **ZeptoMail 沒有網域數量限制**，而且新網域要選**同一個 agent**（`agent_1`），現有 API 金鑰才不用換。
- **SPF 只能有一筆**。正確內容：
  `v=spf1 include:zohomail.com include:_spf.mx.cloudflare.net ~all`
  ⚠️ `zeptomail.zoho.com` **沒有 SPF 記錄**，寫進去會讓整個 SPF 驗證失敗 —— 不要用。
- ZeptoMail 的 SPF 其實靠 `bounce-zem` CNAME → `cluster89.zeptomail.com` 負責，不是靠主網域 SPF。
- Cloudflare Email Routing 會**拒絕**在有非 Cloudflare MX 記錄時設定 → 要先刪掉舊的 MX。
- 舊網域 opuszmusic.com 的收信仍在 Zoho，**兩邊架構不同，別搞混**。
