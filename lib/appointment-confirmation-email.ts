import { brand } from "./site.ts";

type ConfirmationEmailData = {
  clientName: string;
  consultation: string;
  date: string;
  time: string;
  duration: string;
  mode: string;
  bookingReference: string;
  invoiceNumber: string;
  amount: string;
  invoiceUrl: string;
  portalUrl: string;
  contactUrl: string;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);

export function appointmentConfirmationEmailHtml(data: ConfirmationEmailData) {
  const rows = [
    ["Type de consultation", data.consultation],
    ["Date", data.date],
    ["Heure", data.time],
    ["Durée", data.duration],
    ["Mode", data.mode],
  ];
  const detailRows = rows
    .map(
      ([label, value]) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e9ef;color:#697586;font-size:13px;line-height:20px;width:48%;">${escapeHtml(label)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #e5e9ef;color:#0B1D36;font-size:14px;line-height:20px;font-weight:700;text-align:right;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");

  const button = (href: string, label: string, background: string, color: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;background:${background};color:${color};border:1px solid ${background === "#FFFFFF" ? "#d9e0e8" : background};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:18px;text-decoration:none;padding:14px 20px;border-radius:8px;margin:0 6px 10px;">${escapeHtml(label)}</a>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirmation de rendez-vous Accès Canada</title>
<style>@media only screen and (max-width:620px){.container{width:100%!important}.mobile-pad{padding-left:20px!important;padding-right:20px!important}.column{display:block!important;width:100%!important}.button-wrap a{display:block!important;margin:0 0 10px!important;text-align:center!important}.hero-title{font-size:25px!important}.qr-cell{padding-top:20px!important;text-align:center!important}}</style></head>
<body style="margin:0;padding:0;background-color:#eef2f6;font-family:Arial,Helvetica,sans-serif;color:#0B1D36;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Votre paiement et votre rendez-vous Accès Canada sont confirmés.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f6;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="620" class="container" cellpadding="0" cellspacing="0" border="0" style="width:620px;max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(11,29,54,.12);">
<tr><td style="background-color:#0B1D36;background-image:linear-gradient(135deg,#0B1D36 0%,#132d50 100%);padding:30px 36px 34px;" class="mobile-pad">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td valign="middle"><img src="cid:acces-canada-logo" width="96" alt="Accès Canada" style="display:block;width:96px;max-width:96px;height:auto;border:0;"></td>
    <td valign="middle" align="right" style="color:#D4AF37;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Confirmation officielle</td>
  </tr></table>
  <h1 class="hero-title" style="margin:28px 0 8px;color:#ffffff;font-size:30px;line-height:38px;font-weight:800;">Votre rendez-vous est confirmé.</h1>
  <p style="margin:0;color:#D4AF37;font-size:16px;line-height:24px;font-weight:700;">${escapeHtml(brand.slogan)}</p>
</td></tr>
<tr><td style="height:5px;background:#D4AF37;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td class="mobile-pad" style="padding:34px 36px 12px;">
  <p style="margin:0 0 8px;color:#697586;font-size:13px;line-height:20px;">Bonjour</p>
  <h2 style="margin:0 0 22px;color:#0B1D36;font-size:23px;line-height:30px;">${escapeHtml(data.clientName)},</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;border:1px solid #e5e9ef;border-radius:12px;"><tr>
    <td class="column" width="50%" style="padding:18px 20px;border-left:4px solid #2e9d62;"><div style="color:#2e9d62;font-size:18px;line-height:24px;font-weight:800;">✓ Paiement confirmé</div></td>
    <td class="column" width="50%" style="padding:18px 20px;border-left:4px solid #D4AF37;"><div style="color:#0B1D36;font-size:18px;line-height:24px;font-weight:800;">✓ Réservation confirmée</div></td>
  </tr></table>
</td></tr>
<tr><td class="mobile-pad" style="padding:18px 36px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td class="column" width="58%" valign="top" style="padding:22px;background:#ffffff;border:1px solid #e5e9ef;border-radius:12px;">
      <div style="color:#C8102E;font-size:12px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">Votre consultation</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table>
    </td>
    <td class="column" width="4%" style="font-size:0;">&nbsp;</td>
    <td class="column" width="38%" valign="top" style="padding:22px;background:#0B1D36;border-radius:12px;color:#ffffff;">
      <div style="color:#D4AF37;font-size:11px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;">Montant payé</div>
      <div style="font-size:26px;line-height:34px;font-weight:800;margin:8px 0 20px;">${escapeHtml(data.amount)}</div>
      <div style="color:#aeb9c8;font-size:11px;line-height:17px;text-transform:uppercase;">Réservation</div><div style="font-size:14px;font-weight:700;margin:3px 0 14px;">${escapeHtml(data.bookingReference)}</div>
      <div style="color:#aeb9c8;font-size:11px;line-height:17px;text-transform:uppercase;">Facture</div><div style="font-size:14px;font-weight:700;">${escapeHtml(data.invoiceNumber)}</div>
    </td>
  </tr></table>
</td></tr>
<tr><td class="mobile-pad button-wrap" align="center" style="padding:14px 30px 22px;">
  ${button(data.invoiceUrl, "Télécharger la facture PDF", "#D4AF37", "#0B1D36")}
  ${button(data.portalUrl, "Accéder à mon espace client", "#0B1D36", "#FFFFFF")}
  ${button(data.contactUrl, "Contacter Accès Canada", "#FFFFFF", "#0B1D36")}
</td></tr>
<tr><td class="mobile-pad" style="padding:4px 36px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;border-radius:12px;"><tr>
    <td class="column" valign="middle" style="padding:20px;"><div style="font-size:15px;font-weight:800;margin-bottom:6px;">Vérification rapide</div><div style="color:#697586;font-size:13px;line-height:20px;">Scannez ce code pour ouvrir votre facture sécurisée.</div></td>
    <td class="column qr-cell" width="112" align="right" style="padding:14px 20px;"><img src="cid:acces-canada-qr" width="84" height="84" alt="QR code de la facture" style="display:block;width:84px;height:84px;border:0;"></td>
  </tr></table>
</td></tr>
<tr><td class="mobile-pad" style="background:#0B1D36;padding:28px 36px;text-align:center;color:#ffffff;">
  <img src="cid:acces-canada-logo" width="58" alt="Accès Canada" style="display:inline-block;width:58px;height:auto;border:0;margin-bottom:12px;">
  <div style="color:#D4AF37;font-size:14px;font-weight:700;margin-bottom:10px;">${escapeHtml(brand.slogan)}</div>
  <div style="color:#c3ccd7;font-size:12px;line-height:20px;"><a href="tel:${brand.phone.replace(/\s/g, "")}" style="color:#ffffff;text-decoration:none;">${escapeHtml(brand.phone)}</a> &nbsp;•&nbsp; <a href="mailto:${escapeHtml(brand.email)}" style="color:#ffffff;text-decoration:none;">${escapeHtml(brand.email)}</a></div>
  <div style="margin-top:12px;font-size:12px;"><a href="${escapeHtml(data.portalUrl)}" style="color:#D4AF37;text-decoration:none;">Espace client</a> &nbsp;•&nbsp; <a href="${escapeHtml(data.contactUrl)}" style="color:#D4AF37;text-decoration:none;">Nous contacter</a></div>
  <div style="border-top:1px solid #31445e;margin-top:20px;padding-top:16px;color:#8492a6;font-size:10px;line-height:16px;">Courriel transactionnel officiel émis par Accès Canada à la suite de votre paiement. Conservez-le avec votre facture.</div>
</td></tr></table>
</td></tr></table></body></html>`;
}
