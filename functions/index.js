/**
 * OPUS.Z — email notifications
 * When a customer inquiry (contact / booking / lesson) lands in Firestore
 * `inquiries`, email the target musician at their registered address via
 * ZeptoMail, sending as info@opuszmusic.com.
 */
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

// ZeptoMail "Send Mail Token" (the key part only; we add the scheme prefix below).
const ZEPTO_TOKEN = defineSecret("ZEPTOMAIL_TOKEN");

const FROM = { address: "info@opuszmusic.com", name: "OPUS.Z" };
const SITE_URL = "https://opuszmusic.com";
const DASH_URL = SITE_URL + "/musician-dashboard";
const LOGO_URL = SITE_URL + "/assets/images/LOGO/opusz-logo-cropped.png";
const SUPPORT_EMAIL = "info@opuszmusic.com";
const PHONE = "+886 972238828";
const LOCATION = "Taipei, Taiwan";
const FONT = "-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,'PingFang TC','Microsoft JhengHei',Arial,sans-serif";

// A dark, branded call-to-action button.
function btn(href, label) {
  return '<a href="' + href + '" style="background:#111;color:#fff;padding:13px 26px;' +
    'border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;font-size:15px">' +
    label + "</a>";
}

// Wrap body content in the full branded email shell (header + footer).
// Pass `inner` = the message body HTML for the white card.
function emailShell(inner) {
  const year = new Date().getFullYear();
  return [
    '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#f0efec;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0efec;">',
    '<tr><td align="center" style="padding:28px 12px;">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" ' +
      'style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ececec;">',
    // ── Header ──
    '<tr><td style="padding:32px 32px 22px;text-align:center;border-bottom:1px solid #f1f1f1;">',
      '<img src="' + LOGO_URL + '" alt="OPUS.Z" width="54" height="54" ' +
        'style="border-radius:50%;display:inline-block;border:0;">',
      '<div style="font-family:' + FONT + ';font-weight:800;font-size:19px;letter-spacing:-.5px;margin-top:10px;color:#111;">OPUS.Z</div>',
      '<div style="font-family:' + FONT + ';font-size:12px;color:#9a9a9a;margin-top:4px;letter-spacing:.06em;">遇見台灣菁英音樂家</div>',
    "</td></tr>",
    // ── Body ──
    '<tr><td style="padding:30px 32px;font-family:' + FONT + ';line-height:1.65;color:#1a1a1a;font-size:15px;">',
      inner,
    "</td></tr>",
    // ── Footer ──
    '<tr><td style="background:#111;padding:26px 32px;font-family:' + FONT + ';">',
      '<div style="font-weight:800;font-size:15px;color:#fff;letter-spacing:-.3px;">OPUS.Z</div>',
      '<div style="font-size:12px;color:#9a9a9a;margin-top:5px;line-height:1.7;">媒合台灣頂尖音樂家與演出、錄音、教學機會。</div>',
      '<div style="font-size:12px;color:#cfcfcf;margin-top:16px;line-height:2.1;">' +
        '<span style="color:#7f7f7f;display:inline-block;width:38px;">Email</span> <a href="mailto:' + SUPPORT_EMAIL + '" style="color:#cfcfcf;text-decoration:none;">' + SUPPORT_EMAIL + "</a><br>" +
        '<span style="color:#7f7f7f;display:inline-block;width:38px;">電話</span> ' + PHONE + "<br>" +
        '<span style="color:#7f7f7f;display:inline-block;width:38px;">地點</span> ' + LOCATION +
      "</div>",
      '<div style="margin-top:18px;"><a href="' + SITE_URL + '" ' +
        'style="color:#fff;font-size:12px;text-decoration:none;border:1px solid #3a3a3a;border-radius:6px;padding:8px 16px;display:inline-block;">前往官方網站 →</a></div>',
      '<div style="border-top:1px solid #2a2a2a;margin:20px 0 0;"></div>',
      '<div style="font-size:11px;color:#777;margin-top:14px;line-height:1.8;">© ' + year + " OPUS.Z. All rights reserved.<br>" +
        "此信由系統自動寄出，請勿直接回覆本信；如需協助，請來信 " + SUPPORT_EMAIL + "。</div>",
    "</td></tr>",
    "</table></td></tr></table></body></html>",
  ].join("");
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendZepto(token, toEmail, toName, subject, html, replyTo) {
  const payload = {
    from: FROM,
    to: [{ email_address: { address: toEmail, name: toName || "" } }],
    subject: subject,
    htmlbody: html,
  };
  if (replyTo) payload.reply_to = [{ address: replyTo }];
  const res = await fetch("https://api.zeptomail.com/v1.1/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Zoho-enczapikey " + token,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("ZeptoMail " + res.status + ": " + text);
  return text;
}

// Look up the musician's email: Auth record first, then musicians/{uid}.email.
async function musicianEmail(uid) {
  try {
    const u = await admin.auth().getUser(uid);
    if (u && u.email) return u.email;
  } catch (e) { /* fall through */ }
  try {
    const snap = await admin.firestore().doc("musicians/" + uid).get();
    if (snap.exists && snap.data() && snap.data().email) return snap.data().email;
  } catch (e) { /* ignore */ }
  return "";
}

const KIND_LABEL = { booking: "檔期預約", lesson: "課程預約", message: "新訊息" };

exports.notifyMusicianOnInquiry = onDocumentCreated(
  { document: "inquiries/{id}", secrets: [ZEPTO_TOKEN] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const d = snap.data() || {};

    // General "Contact Us" website form → email the company inbox (info@), with
    // reply-to set to the visitor so the owner can reply straight from Zoho.
    if (d.kind === "contact") {
      const subj = "【OPUS.Z 官網聯絡】" + (d.subject || d.category || "新訊息");
      const fromLine = esc(d.name || "訪客") + (d.email ? (" &lt;" + esc(d.email) + "&gt;") : "");
      const cell = '<td style="color:#888;padding:3px 12px 3px 0;white-space:nowrap;vertical-align:top;">';
      const val = '<td style="color:#111;padding:3px 0;">';
      const rows =
        "<tr>" + cell + "來自</td>" + val + fromLine + "</td></tr>" +
        (d.category ? ("<tr>" + cell + "分類</td>" + val + esc(d.category) + "</td></tr>") : "") +
        (d.subject ? ("<tr>" + cell + "主旨</td>" + val + esc(d.subject) + "</td></tr>") : "");
      const html = emailShell(
        '<h1 style="margin:0 0 6px;font-size:21px;color:#111;">官網聯絡表單新訊息</h1>' +
        '<p style="color:#777;margin:0 0 22px;font-size:14px;">有人透過網站「Contact」表單與你聯繫</p>' +
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px;font-size:15px;">' + rows + "</table>" +
        '<div style="white-space:pre-wrap;background:#f6f6f6;border:1px solid #eee;padding:16px 18px;border-radius:10px;margin:14px 0 18px;color:#222;">' + esc(d.message || "") + "</div>" +
        (d.email ? ('<p style="margin:0;color:#777;font-size:13px;">直接回覆本信即可回覆 ' + esc(d.email) + "。</p>") : "")
      );
      await sendZepto(ZEPTO_TOKEN.value(), SUPPORT_EMAIL, "OPUS.Z", subj, html, d.email || "");
      logger.info("contact email sent to admin", { id: event.params.id });
      return;
    }

    const uid = d.musicianUid;
    if (!uid) { logger.warn("inquiry has no musicianUid", { id: event.params.id }); return; }

    // 檢查樂手是否關閉了「新詢問 email」偏好
    try {
      const musSnap = await admin.firestore().doc("musicians/" + uid).get();
      const prefs = (musSnap.exists && musSnap.data() && musSnap.data().notifPrefs) || {};
      if (prefs.email_inquiry === false) {
        logger.info("musician opted out of inquiry emails", { uid });
        return;
      }
    } catch (e) { /* 讀不到就預設寄出 */ }

    const email = await musicianEmail(uid);
    if (!email) { logger.warn("no email for musician", { uid }); return; }

    const label = KIND_LABEL[d.kind] || "新訊息";
    const subject = "【OPUS.Z】你有一筆" + label;
    const fromLine = esc(d.name || "客戶") + (d.email ? (" &lt;" + esc(d.email) + "&gt;") : "");
    const greet = d.musicianName ? ("<p style=\"margin:0 0 16px\">" + esc(d.musicianName) + " 您好，</p>") : "";
    const html = emailShell(
      '<h1 style="margin:0 0 6px;font-size:21px;color:#111;">你有一筆' + esc(label) + "</h1>" +
      '<p style="color:#777;margin:0 0 22px;font-size:14px;">有人透過 OPUS.Z 與你聯繫</p>' +
      greet +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px;font-size:15px;">' +
        '<tr><td style="color:#888;padding:3px 12px 3px 0;white-space:nowrap;vertical-align:top;">來自</td><td style="color:#111;padding:3px 0;">' + fromLine + "</td></tr>" +
        (d.subject ? ('<tr><td style="color:#888;padding:3px 12px 3px 0;white-space:nowrap;vertical-align:top;">主旨</td><td style="color:#111;padding:3px 0;">' + esc(d.subject) + "</td></tr>") : "") +
      "</table>" +
      '<div style="white-space:pre-wrap;background:#f6f6f6;border:1px solid #eee;padding:16px 18px;border-radius:10px;margin:14px 0 24px;color:#222;">' +
        esc(d.message || "") + "</div>" +
      '<p style="margin:0;">' + btn(DASH_URL, "前往後台查看與回覆 →") + "</p>"
    );

    await sendZepto(ZEPTO_TOKEN.value(), email, d.musicianName || "", subject, html);
    logger.info("notified musician", { uid, kind: d.kind });
  }
);

// ── New direct message → email the recipient ─────────────────────────────────
// Fires when a message lands in conversations/{convId}/messages/{msgId}.
// Emails the OTHER participant (musician↔musician peer chats and customer↔musician
// threads both). Reuses the musician "新詢問 / 訊息" email pref (email_inquiry);
// customers have no musicians doc → default to send. A 5-minute per-recipient
// throttle prevents an active back-and-forth from spamming the inbox.
exports.notifyOnNewMessage = onDocumentCreated(
  { document: "conversations/{convId}/messages/{msgId}", secrets: [ZEPTO_TOKEN] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const m = snap.data() || {};
    if (m.type === "sys") return;                       // skip system lines

    const convId = event.params.convId;
    const convRef = admin.firestore().doc("conversations/" + convId);
    let conv;
    try {
      const c = await convRef.get();
      if (!c.exists) return;
      conv = c.data() || {};
    } catch (e) { logger.warn("notifyOnNewMessage: conv read failed", { convId }); return; }

    const parts = conv.participants || [];
    const recipientUid = parts.find((p) => p !== m.senderUid);
    if (!recipientUid) { logger.warn("notifyOnNewMessage: no recipient", { convId }); return; }

    // Throttle: at most one email per recipient per thread every 5 minutes.
    const now = Date.now();
    const lastAt = (conv.lastNotifiedAt && conv.lastNotifiedAt.toMillis) ? conv.lastNotifiedAt.toMillis() : 0;
    if (conv.lastNotifiedUid === recipientUid && (now - lastAt) < 5 * 60 * 1000) {
      logger.info("notifyOnNewMessage: throttled", { convId, recipientUid });
      return;
    }

    // Recipient preference (only musicians have notifPrefs; customers default to send).
    try {
      const rSnap = await admin.firestore().doc("musicians/" + recipientUid).get();
      const prefs = (rSnap.exists && rSnap.data() && rSnap.data().notifPrefs) || {};
      if (prefs.email_inquiry === false) {
        logger.info("recipient opted out of message emails", { recipientUid });
        return;
      }
    } catch (e) { /* default to send */ }

    const email = await musicianEmail(recipientUid);
    if (!email) { logger.warn("notifyOnNewMessage: no email", { recipientUid }); return; }

    const senderName = (m.senderRole === "customer")
      ? (conv.customerName || "對方")
      : (conv.musicianName || "對方");
    const recipientName = (m.senderRole === "customer")
      ? (conv.musicianName || "")
      : (conv.customerName || "");
    const snippet = m.text ? String(m.text).slice(0, 300) : (m.file ? "📎 附件" : "");

    const greet = recipientName ? ('<p style="margin:0 0 16px;">' + esc(recipientName) + " 您好，</p>") : "";
    const html = emailShell(
      '<h1 style="margin:0 0 6px;font-size:21px;color:#111;">💬 你有一則新訊息</h1>' +
      '<p style="color:#777;margin:0 0 22px;font-size:14px;">' + esc(senderName) + " 在 OPUS.Z 傳了訊息給你</p>" +
      greet +
      '<div style="white-space:pre-wrap;background:#f6f6f6;border:1px solid #eee;padding:16px 18px;border-radius:10px;margin:0 0 24px;color:#222;">' +
        esc(snippet) + "</div>" +
      '<p style="margin:0;">' + btn(DASH_URL, "前往後台查看與回覆 →") + "</p>"
    );

    await sendZepto(ZEPTO_TOKEN.value(), email, recipientName, "【OPUS.Z】" + senderName + " 傳了一則訊息給你", html);
    try {
      await convRef.update({
        lastNotifiedUid: recipientUid,
        lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) { /* throttle bookkeeping is best-effort */ }
    logger.info("notifyOnNewMessage sent", { convId, recipientUid });
  }
);

// ── Musician application review: email the applicant on approve / reject ──────
// Fires when a musician doc's `status` changes. Approve → welcome + dashboard
// link; reject → notice + the admin's reason. Reuses the same ZeptoMail sender.
exports.notifyMusicianOnReview = onDocumentUpdated(
  { document: "musicians/{uid}", secrets: [ZEPTO_TOKEN] },
  async (event) => {
    const before = (event.data && event.data.before && event.data.before.data()) || {};
    const after  = (event.data && event.data.after  && event.data.after.data())  || {};
    if (before.status === after.status) return;        // only on a real status change
    if (after.status !== "approved" && after.status !== "rejected") return;

    const uid = event.params.uid;
    const email = after.email || (await musicianEmail(uid));
    if (!email) { logger.warn("notifyMusicianOnReview: no email", { uid }); return; }
    const name = after.name || "";

    if (after.status === "approved") {
      const html = emailShell(
        '<h1 style="margin:0 0 14px;font-size:21px;color:#111;">🎉 申請通過，歡迎加入 OPUS.Z！</h1>' +
        '<p style="margin:0 0 14px;">' + esc(name) + " 您好，</p>" +
        '<p style="margin:0 0 22px;">您的樂手申請已通過審核。現在就能登入您的樂手後台，完成個人檔案、開始接案與教學。期待在 OPUS.Z 看見您的演出。</p>' +
        '<p style="margin:0;">' + btn(DASH_URL, "登入樂手後台 →") + "</p>"
      );
      await sendZepto(ZEPTO_TOKEN.value(), email, name, "🎉 您的 OPUS.Z 樂手申請已通過審核", html);
      logger.info("approval email sent", { uid });
    } else {
      const reason = after.rejectReason
        ? '<div style="background:#fbeaea;border:1px solid #f3c9c9;border-radius:10px;padding:14px 16px;color:#a13a3a;margin:14px 0;"><b>審核意見：</b>' + esc(after.rejectReason) + "</div>"
        : "";
      const html = emailShell(
        '<h1 style="margin:0 0 14px;font-size:21px;color:#111;">關於您的 OPUS.Z 樂手申請</h1>' +
        '<p style="margin:0 0 14px;">' + esc(name) + " 您好，</p>" +
        '<p style="margin:0 0 6px;">感謝您對 OPUS.Z 的支持與申請。很抱歉，您這次的申請尚未通過審核。</p>' +
        reason +
        '<p style="margin:14px 0 0;">如有任何疑問，歡迎回信至 <a href="mailto:' + SUPPORT_EMAIL + '" style="color:#111;">' + SUPPORT_EMAIL + "</a> 與我們聯繫，我們很樂意提供協助。</p>"
      );
      await sendZepto(ZEPTO_TOKEN.value(), email, name, "關於您的 OPUS.Z 樂手申請", html);
      logger.info("rejection email sent", { uid });
    }
  }
);

// ── Account email verification ───────────────────────────────────────────────
// Called by the signup pages instead of Firebase's built-in sendEmailVerification.
// We generate the verification link with the Admin SDK and deliver it via
// ZeptoMail from info@opuszmusic.com (DKIM-signed) so it lands in the inbox,
// not spam — and carries the branded template. Only works for emails that
// actually have a (still-unverified) Firebase account, which limits abuse.
exports.sendVerifyEmail = onCall(
  { secrets: [ZEPTO_TOKEN] },
  async (req) => {
    const email = String((req.data && req.data.email) || "").trim();
    const name = String((req.data && req.data.name) || "");
    const role = (req.data && req.data.role) === "customer" ? "customer" : "musician";
    if (!email) throw new HttpsError("invalid-argument", "email required");

    const continueUrl = role === "customer"
      ? SITE_URL + "/customer-login"
      : SITE_URL + "/musician-login";

    let link;
    try {
      link = await admin.auth().generateEmailVerificationLink(email, { url: continueUrl });
    } catch (e) {
      logger.warn("generateEmailVerificationLink failed", { email, err: e.message });
      throw new HttpsError("failed-precondition", "could-not-generate-link");
    }

    // Rewrite Firebase's firebaseapp.com action link to a clean same-domain link
    // on opuszmusic.com. A scary cross-domain URL full of tokens is the #1 reason
    // verification emails get flagged as phishing/spam. Our /verify-email page
    // applies the oobCode. Falls back to the original link if parsing fails.
    let verifyUrl = link;
    try {
      const code = new URL(link).searchParams.get("oobCode");
      if (code) verifyUrl = SITE_URL + "/verify-email?code=" + encodeURIComponent(code) + "&r=" + role;
    } catch (e) { /* keep original link */ }

    const greet = name ? ('<p style="margin:0 0 14px;">' + esc(name) + " 您好，</p>") : "";
    const html = emailShell(
      '<h1 style="margin:0 0 14px;font-size:21px;color:#111;">請驗證您的 Email</h1>' +
      greet +
      '<p style="margin:0 0 22px;">感謝您註冊 OPUS.Z。請點擊下方按鈕完成 Email 驗證，啟用您的帳號：</p>' +
      '<p style="margin:0 0 24px;">' + btn(verifyUrl, "驗證我的 Email →") + "</p>" +
      '<p style="margin:0 0 6px;color:#777;font-size:13px;">若按鈕無法點擊，請複製以下連結貼到瀏覽器開啟：</p>' +
      '<p style="margin:0;word-break:break-all;font-size:12px;color:#999;">' + esc(verifyUrl) + "</p>" +
      '<p style="margin:24px 0 0;color:#777;font-size:13px;">如果這不是您本人的操作，請直接忽略本信。</p>'
    );

    await sendZepto(ZEPTO_TOKEN.value(), email, name, "請驗證您的 OPUS.Z 帳號", html);
    logger.info("verification email sent", { email, role });
    return { ok: true };
  }
);

// ── Poster approved → notify the musician their poster is live ────────────────
// Called by the admin panel when a poster submission is marked 已張貼.
// Admin-only (caller must be signed in as the admin account).
exports.notifyPosterApproved = onCall(
  { secrets: [ZEPTO_TOKEN] },
  async (req) => {
    if (!req.auth || req.auth.token.email !== "tzutung.liao@gmail.com") {
      throw new HttpsError("permission-denied", "admin only");
    }
    const email = String((req.data && req.data.email) || "").trim();
    const name = String((req.data && req.data.name) || "");
    const posterTitle = String((req.data && req.data.posterTitle) || "");
    if (!email) throw new HttpsError("invalid-argument", "email required");

    const greet = name ? ('<p style="margin:0 0 14px;">' + esc(name) + " 您好，</p>") : "";
    const html = emailShell(
      '<h1 style="margin:0 0 14px;font-size:21px;color:#111;">🎉 您的海報已上線</h1>' +
      greet +
      '<p style="margin:0 0 14px;">好消息！您投稿的演出海報已通過審核並張貼至 OPUS.Z 演出頁，現在所有訪客都能看到了。</p>' +
      (posterTitle ? ('<p style="margin:0 0 18px;">海報：<b>' + esc(posterTitle) + "</b></p>") : "") +
      '<p style="margin:0 0 24px;">' + btn(SITE_URL + "/shows", "前往演出頁查看 →") + "</p>" +
      '<p style="margin:0;color:#777;font-size:13px;">感謝您的投稿，期待與您一起把台灣的好演出帶給更多人。</p>'
    );
    await sendZepto(ZEPTO_TOKEN.value(), email, name, "🎉 您投稿的海報已在 OPUS.Z 上線", html);
    logger.info("poster-approved email sent", { email });
    return { ok: true };
  }
);

// ── New public job → email all active musicians ───────────────────────────────
// Fires when a new job doc is created in `jobs/{jobId}`.
// Emails every published, non-suspended musician who hasn't opted out.
exports.notifyOnNewJob = onDocumentCreated(
  { document: "jobs/{jobId}", secrets: [ZEPTO_TOKEN] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data() || {};
    if (job.status !== "open") return;   // 只通知公開案子

    const musSnap = await admin.firestore()
      .collection("musicians")
      .where("published", "==", true)
      .get();

    if (musSnap.empty) { logger.info("notifyOnNewJob: no published musicians"); return; }

    const token = ZEPTO_TOKEN.value();
    const jobId  = event.params.jobId;
    const jobUrl = SITE_URL + "/musician-dashboard";   // 後台「公開接案」分頁

    // 案子摘要文字
    const typeLabel  = esc(job.type || "演出 / 錄音 / 活動");
    const locLabel   = job.location ? esc(job.location) : "";
    const dateLabel  = job.eventDate ? esc(job.eventDate) : "";
    const custLabel  = job.customerName ? esc(job.customerName) : "";
    const descLabel  = job.desc ? esc(String(job.desc).slice(0, 200)) : "";

    const detailRows = [
      typeLabel  ? ('<tr><td style="color:#888;padding:3px 12px 3px 0;white-space:nowrap;">類型</td><td style="color:#111;">' + typeLabel  + "</td></tr>") : "",
      locLabel   ? ('<tr><td style="color:#888;padding:3px 12px 3px 0;white-space:nowrap;">地點</td><td style="color:#111;">' + locLabel   + "</td></tr>") : "",
      dateLabel  ? ('<tr><td style="color:#888;padding:3px 12px 3px 0;white-space:nowrap;">日期</td><td style="color:#111;">' + dateLabel  + "</td></tr>") : "",
      custLabel  ? ('<tr><td style="color:#888;padding:3px 12px 3px 0;white-space:nowrap;">委托人</td><td style="color:#111;">' + custLabel  + "</td></tr>") : "",
    ].join("");

    const promises = [];

    for (const mDoc of musSnap.docs) {
      const mData = mDoc.data();
      const mUid  = mDoc.id;
      const st    = mData.status || "";
      if (st === "suspended" || st === "rejected") continue;

      // 樂手偏好：email_job === false 代表關閉，其他（true 或未設定）都寄
      const prefs = mData.notifPrefs || {};
      if (prefs.email_job === false) continue;

      const mEmail = mData.email || (await musicianEmail(mUid));
      if (!mEmail) continue;

      const mName = mData.name || "";
      const greet = mName ? ('<p style="margin:0 0 16px;">' + esc(mName) + " 您好，</p>") : "";

      const html = emailShell(
        '<h1 style="margin:0 0 6px;font-size:21px;color:#111;">🎯 有新的公開演出委托</h1>' +
        '<p style="color:#777;margin:0 0 22px;font-size:14px;">有人在 OPUS.Z 發布了新的演出案子，可能適合你！</p>' +
        greet +
        (detailRows ? ('<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;font-size:15px;">' + detailRows + "</table>") : "") +
        (descLabel ? ('<div style="white-space:pre-wrap;background:#f6f6f6;border:1px solid #eee;padding:14px 16px;border-radius:10px;margin:0 0 22px;color:#444;font-size:14px;">' + descLabel + (job.desc && job.desc.length > 200 ? "…" : "") + "</div>") : "") +
        '<p style="margin:0;">' + btn(jobUrl, "前往後台查看完整委托 →") + "</p>"
      );

      promises.push(
        sendZepto(token, mEmail, mName, "【OPUS.Z】有新的演出委托，快去看看", html)
          .catch(err => logger.warn("notifyOnNewJob: send failed", { mUid, err: err.message }))
      );
    }

    await Promise.allSettled(promises);
    logger.info("notifyOnNewJob done", { jobId, sent: promises.length });
  }
);

// ── New musician application → email the admin (official inbox) ──
// Fires when a musicians/{uid} doc is created as status:'pending' (the apply
// form). Profiles created by other flows aren't 'pending' → skipped.
exports.notifyAdminOnApplication = onDocumentCreated(
  { document: "musicians/{uid}", secrets: [ZEPTO_TOKEN] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const d = snap.data() || {};
    if (d.status !== "pending") return;   // only real applications awaiting review

    const name   = d.name || (d.email ? d.email.split("@")[0] : "（未填姓名）");
    const insts  = Array.isArray(d.instruments) ? d.instruments.join("、") : (d.instrument || "");
    const region = d.primaryRegion || "";
    const cell = '<td style="color:#888;padding:3px 12px 3px 0;white-space:nowrap;vertical-align:top;">';
    const val  = '<td style="color:#111;padding:3px 0;">';
    const rows =
      "<tr>" + cell + "姓名</td>" + val + esc(name) + "</td></tr>" +
      (d.email  ? ("<tr>" + cell + "Email</td>" + val + esc(d.email) + "</td></tr>") : "") +
      (insts    ? ("<tr>" + cell + "樂器</td>" + val + esc(insts) + "</td></tr>") : "") +
      (region   ? ("<tr>" + cell + "地區</td>" + val + esc(region) + "</td></tr>") : "");

    const html = emailShell(
      '<h1 style="margin:0 0 6px;font-size:21px;color:#111;">🎼 有新的樂手申請待審核</h1>' +
      '<p style="color:#777;margin:0 0 22px;font-size:14px;">一位新樂手送出了申請，請到後台「申請審核」核准或退件。</p>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:15px;">' + rows + "</table>" +
      '<p style="margin:0;">' + btn(SITE_URL + "/admin-panel", "前往後台審核 →") + "</p>"
    );

    try {
      await sendZepto(ZEPTO_TOKEN.value(), SUPPORT_EMAIL, "OPUS.Z", "🎼 新樂手申請待審核：" + name, html, d.email || "");
      logger.info("admin notified: new application", { uid: event.params.uid });
    } catch (e) {
      logger.error("notifyAdminOnApplication failed", { uid: event.params.uid, err: String(e) });
    }
  }
);
