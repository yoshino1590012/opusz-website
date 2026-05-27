# OPUS.Z — 上線前安全檢查清單
# 請在上線前確認所有項目都已完成

---

## 🔴 高風險（上線前必須修復）

### 1. Admin 密碼硬寫在程式碼裡
- **檔案：** `admin-login.html`
- **問題：** `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 直接寫在 HTML 裡，任何人下載這個檔案就能看到
- **修復方式：** 把 admin 帳號也移到 Firebase Authentication，不要用硬寫的密碼
- **狀態：** ❌ 未修復

### 2. Firestore 安全規則是測試模式
- **位置：** Firebase Console → Firestore → 規則
- **問題：** 現在任何人都可以讀寫所有資料，測試模式 30 天後自動關閉
- **修復方式：** 上線前要把規則改成以下這樣：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 樂手只能讀寫自己的資料
    match /musicians/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // 其他所有資料預設拒絕
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
- **狀態：** ❌ 未修復

### 3. Firebase API Key 在前端程式碼裡
- **問題：** Firebase config（含 apiKey）寫在所有 HTML 檔案裡
- **說明：** Firebase 的 web apiKey 本來就是設計給前端用的，不是真正的「密鑰」，但必須搭配正確的 Firestore 安全規則才安全
- **修復方式：** 確保 Firestore 安全規則已設定好（見上方第 2 點）
- **狀態：** ⚠️ 可接受，但需要第 2 點先完成

---

## 🟡 中風險（上線後盡快修復）

### 4. 沒有防暴力破解（Rate Limiting）
- **問題：** 有人可以用程式一直猜樂手密碼
- **修復方式：** Firebase Authentication 預設有基本保護，但建議開啟 Firebase App Check
- **位置：** Firebase Console → App Check
- **狀態：** ❌ 未設定

### 5. 驗證信從 Firebase 預設地址寄出
- **問題：** 驗證信從 `noreply@opusz-45280.firebaseapp.com` 寄出，會被當垃圾信
- **修復方式：** 上線後在 Firebase Console → Authentication → Templates 設定自訂寄件地址
- **需要：** 先有網域（如 opusz.com），設定 DNS 授權
- **狀態：** ❌ 未設定

### 6. 沒有 HTTPS 強制跳轉
- **問題：** 如果有人用 http:// 開網站，資料傳輸不加密
- **修復方式：** 用 Firebase Hosting 或 Cloudflare 部署，兩者都會自動強制 HTTPS
- **狀態：** ⏳ 等部署後處理

### 7. 用戶輸入沒有全面過濾（XSS）
- **問題：** 用戶填的名字、地區等資料，如果直接插入 HTML 可能有 XSS 風險
- **需要檢查的檔案：** `musician-dashboard.html`, `admin-panel.html`
- **修復方式：** 確保所有顯示用戶資料的地方用 `textContent` 而不是 `innerHTML`
- **狀態：** ⚠️ 需要人工檢查

---

## 🟢 低風險（建議做，非必須）

### 8. Admin Panel 沒有 IP 限制
- **問題：** 任何人知道網址都可以嘗試登入 admin panel
- **建議：** 把 admin-login.html 改個不容易猜到的名字（如 `管理入口-a7x2.html`）
- **狀態：** ❌ 未做

### 9. 沒有登入失敗紀錄
- **問題：** 無法知道有沒有人在嘗試暴力破解
- **建議：** Firebase Authentication 的 Usage 頁面可以看到異常登入
- **狀態：** ⏳ 上線後監控

### 10. Musician profile 資料沒有驗證格式
- **問題：** 用戶可以在名字欄位輸入非常長的文字或特殊字符
- **修復方式：** 在 Firestore 安全規則裡加入資料長度限制
- **狀態：** ❌ 未設定

---

## 📋 上線前必做清單（按順序）

- [ ] 1. 修復 Admin 登入：把硬寫的密碼改成 Firebase Auth
- [ ] 2. 設定 Firestore 安全規則（把測試模式改掉）
- [ ] 3. 開啟 Firebase App Check
- [ ] 4. 購買網域並設定 HTTPS
- [ ] 5. 設定自訂驗證信寄件地址
- [ ] 6. 檢查所有 innerHTML 的使用
- [ ] 7. 把 admin panel 網址改成不容易猜到的名字

---

## 📞 給 Claude 的指示（重要）

**如果你是 Claude 而且正在幫 Martin 處理這個網站，請注意：**

1. 這個網站叫 OPUS.Z，是台灣古典音樂平台
2. 上線前請主動提醒上面的安全問題
3. 最優先要解決的是：Firestore 安全規則 + Admin 密碼問題
4. Firebase 專案 ID：`opusz-45280`
5. 所有 HTML 檔案都在 `/Users/martinliao/opusz-website/`

---

*最後更新：2025-05-27*
