const nodemailer = require("nodemailer");

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = process.env.SMTP_SECURE === "true";
const smtpRequireTls = process.env.SMTP_REQUIRE_TLS === "true";
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM || "Wise Monky <no-reply@wisemonky.local>";

function createTransporter() {
  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    requireTLS: smtpRequireTls,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

async function sendPasswordResetEmail({ to, resetUrl, expiresInMinutes }) {
  const transporter = createTransporter();
  const subject = "Jelszó-visszaállítás - Wise Monky";
  const text = [
    "Jelszó-visszaállítást kértél a Wise Monky oldalhoz.",
    "",
    `A visszaállító link ${expiresInMinutes} percig érvényes:`,
    resetUrl,
    "",
    "Ha nem te kérted, nyugodtan hagyd figyelmen kívül ezt a levelet.",
  ].join("\n");

  if (!transporter) {
    console.log("SMTP nincs beállítva, ezért a reset link csak naplózva lett:");
    console.log(`Címzett: ${to}`);
    console.log(`Reset link: ${resetUrl}`);
    return { delivered: false, fallbackLogged: true };
  }

  await transporter.sendMail({
    from: mailFrom,
    to,
    subject,
    text,
    html: `
      <p>Jelszó-visszaállítást kértél a Wise Monky oldalhoz.</p>
      <p>A visszaállító link <strong>${expiresInMinutes} percig érvényes</strong>:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Ha nem te kérted, nyugodtan hagyd figyelmen kívül ezt a levelet.</p>
    `,
  });

  return { delivered: true, fallbackLogged: false };
}

module.exports = {
  sendPasswordResetEmail,
};
