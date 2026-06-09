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
