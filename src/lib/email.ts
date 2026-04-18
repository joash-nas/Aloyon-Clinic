// src/lib/email.ts
import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM || "no-reply@example.com";

if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
  console.warn(
    "[email] SMTP_* env vars are not fully set. Email sending will fail."
  );
}

// Reuse a single transporter instance.
const transporter =
  smtpHost && smtpPort && smtpUser && smtpPass
    ? nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465, // true for 465, false for 587
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      })
    : null;

function normalizeBaseUrl(u: string) {
  return u.replace(/\/+$/, "");
}

export function getAppBaseUrl(fallback?: string) {
  // Prefer explicit env URLs first
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "";

  if (envUrl) return normalizeBaseUrl(envUrl);

  // If Vercel provides a host, build from it
  if (process.env.VERCEL_URL) {
    return normalizeBaseUrl(`https://${process.env.VERCEL_URL}`);
  }

  // Fallback to what caller provides (e.g., req origin)
  if (fallback) return normalizeBaseUrl(fallback);

  return "http://localhost:3000";
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!transporter) {
    console.warn("[email] Transporter not configured, skipping sendMail.");
    return;
  }

  await transporter.sendMail({
    from: mailFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

// Password reset email (baseUrl passed from API route)
export async function sendPasswordResetEmail(
  to: string,
  token: string,
  baseUrl?: string
) {
  const appUrl = getAppBaseUrl(baseUrl);
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const html = `
    <p>Hi,</p>
    <p>We received a request to reset your Aloyon Optical password.</p>
    <p>If you made this request, click the button below to set a new password:</p>
    <p>
      <a href="${resetUrl}"
         style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
        Reset my password
      </a>
    </p>
    <p>This link will expire in <strong>1 hour</strong>. If you didn’t request a password reset, you can safely ignore this email.</p>
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
  `;

  await sendMail({
    to,
    subject: "Reset your Aloyon Optical password",
    html,
  });
}

/* =============================================================================
   NEW: Ready-for-pickup email (trigger when staff marks order as READY)
   ========================================================================== */

export async function sendOrderReadyForPickupEmail(args: {
  to: string;
  orderNumber: string;
  totalPhp?: number;
  baseUrl?: string;
}) {
  const appUrl = getAppBaseUrl(args.baseUrl);

  const ordersUrl = `${appUrl}/dashboard/shop-orders`;
  const totalLine =
    typeof args.totalPhp === "number"
      ? `₱${Number(args.totalPhp).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : null;

  const subject = `Ready for pickup: ${args.orderNumber}`;

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; line-height:1.5; color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;padding:18px;">
      <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;font-weight:700;">
        Aloyon Optical
      </div>

      <h2 style="margin:10px 0 6px;font-size:22px;">Your order is ready for pickup</h2>
      <p style="margin:0 0 14px;color:#334155;">
        Please bring your order number to claim your items.
      </p>

      <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;margin:0 0 14px;">
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;font-weight:700;">Order</div>
            <div style="font-size:16px;font-weight:700;margin-top:4px;">${args.orderNumber}</div>
          </div>
          ${
            totalLine
              ? `<div style="text-align:right;">
                  <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;font-weight:700;">Total</div>
                  <div style="font-size:16px;font-weight:700;margin-top:4px;">${totalLine}</div>
                </div>`
              : ""
          }
        </div>
        <div style="margin-top:10px;font-size:12px;color:#475569;">
          Pickup only • Present this order number at the clinic.
        </div>
      </div>

      <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin:0 0 14px;">
        <div style="font-weight:800;margin-bottom:6px;">Pickup location</div>
        <div style="font-weight:600;">Aloyon Optical – Main Clinic</div>
        <div style="color:#475569;font-size:13px;">386 J luna extension Mandaluyong City, Philippines</div>
        <div style="color:#475569;font-size:13px;margin-top:6px;">Mon–Sat • 9:00 AM – 5:00 PM</div>
      </div>

      <p style="margin:0 0 12px;color:#475569;font-size:13px;">
        You can also track your order status in your account:
      </p>

      <p style="margin:0 0 18px;">
        <a href="${ordersUrl}"
           style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;">
          View my shop orders
        </a>
      </p>

      <div style="font-size:12px;color:#94a3b8;">
        If you have questions, reply to this email.
      </div>
    </div>
  </div>`;

  await sendMail({
    to: args.to,
    subject,
    html,
  });
}