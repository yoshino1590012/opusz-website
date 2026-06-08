/**
 * OPUS.Z — email notifications
 * When a customer inquiry (contact / booking / lesson) lands in Firestore
 * `inquiries`, email the target musician at their registered address via
 * ZeptoMail, sending as info@opuszmusic.com.
 */
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

// ZeptoMail "Send Mail Token" (the key part only; we add the scheme prefix below).
const ZEPTO_TOKEN = defineSecret("ZEPTOMAIL_TOKEN");

const FROM = { address: "info@opuszmusic.com", name: "OPUS.Z" };
const DASH_URL = "https://opuszmusic.com/musician-dashboard";

// Red OPUS.Z brand logo, shown at the top of every official email.
const LOGO_HEADER =
  '<div style="text-align:center;padding:6px 0 22px">' +
    '<img src="https://opuszmusic.com/assets/images/LOGO/opusz-logo-cropped.png" alt="OPUS.Z" width="56" height="56" style="border-radius:50%;display:inline-block;border:0">' +
    '<div style="font-weight:800;font-size:18px;letter-spacing:-.5px;margin-top:8px;color:#111">OPUS.Z</div>' +
  "</div>";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendZepto(token, toEmail, toName, subject, html) {
  const res = await fetch("https://api.zeptomail.com/v1.1/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Zoho-enczapikey " + token,
    },
    body: JSON.stringify({
      from: FROM,
      to: [{ email_address: { address: toEmail, name: toName || "" } }],
      subject: subject,
      htmlbody: html,
    }),
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
    const uid = d.musicianUid;
    if (!uid) { logger.warn("inquiry has no musicianUid", { id: event.params.id }); return; }

    const email = await musicianEmail(uid);
    if (!email) { logger.warn("no email for musician", { uid }); return; }

    const label = KIND_LABEL[d.kind] || "新訊息";
    const subject = "【OPUS.Z】你有一筆" + label;
    const fromLine = esc(d.name || "客戶") + (d.email ? (" &lt;" + esc(d.email) + "&gt;") : "");
    const html =
      '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto">' +
        LOGO_HEADER +
        '<h2 style="margin:0 0 4px">你有一筆' + esc(label) + "</h2>" +
        '<p style="color:#666;margin:0 0 16px">有人透過 OPUS.Z 與你聯繫</p>' +
        "<p><b>來自：</b>" + fromLine + "</p>" +
        (d.subject ? ("<p><b>主旨：</b>" + esc(d.subject) + "</p>") : "") +
        '<div style="white-space:pre-wrap;background:#f6f6f6;padding:14px 16px;border-radius:10px;margin:12px 0">' +
          esc(d.message || "") + "</div>" +
        '<p style="margin-top:20px"><a href="' + DASH_URL + '" ' +
          'style="background:#111;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;display:inline-block">' +
          "前往後台查看與回覆 →</a></p>" +
        '<p style="color:#aaa;font-size:12px;margin-top:24px">此信由 OPUS.Z 自動寄出，請勿直接回覆此信。</p>' +
      "</div>";

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
    const wrap = (inner) =>
      '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto">' +
        LOGO_HEADER +
        inner +
        '<p style="color:#aaa;font-size:12px;margin-top:24px">OPUS.Z · 遇見台灣菁英音樂家。此信由系統自動寄出。</p>' +
      "</div>";

    if (after.status === "approved") {
      const html = wrap(
        '<h2 style="margin:0 0 4px">🎉 申請通過，歡迎加入 OPUS.Z！</h2>' +
        "<p>" + esc(name) + " 您好，</p>" +
        "<p>您的樂手申請已通過審核。現在就能登入您的樂手後台，完成個人檔案、開始接案與教學。</p>" +
        '<p style="margin-top:18px"><a href="' + DASH_URL + '" ' +
          'style="background:#111;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;display:inline-block">' +
          "登入樂手後台 →</a></p>"
      );
      await sendZepto(ZEPTO_TOKEN.value(), email, name, "🎉 您的 OPUS.Z 樂手申請已通過審核", html);
      logger.info("approval email sent", { uid });
    } else {
      const reason = after.rejectReason
        ? '<div style="background:#fbeaea;border:1px solid #f3c9c9;border-radius:10px;padding:12px 14px;color:#a13a3a;margin:12px 0"><b>審核意見：</b>' + esc(after.rejectReason) + "</div>"
        : "";
      const html = wrap(
        '<h2 style="margin:0 0 4px">關於您的 OPUS.Z 樂手申請</h2>' +
        "<p>" + esc(name) + " 您好，</p>" +
        "<p>感謝您的申請。很抱歉，您這次的申請尚未通過審核。</p>" +
        reason +
        '<p>如有疑問，歡迎回信至 <a href="mailto:info@opuszmusic.com">info@opuszmusic.com</a> 與我們聯繫。</p>'
      );
      await sendZepto(ZEPTO_TOKEN.value(), email, name, "關於您的 OPUS.Z 樂手申請", html);
      logger.info("rejection email sent", { uid });
    }
  }
);
