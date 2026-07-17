import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import QRCode from "qrcode";
import type { Appointment } from "./booking-shared.ts";
import { consultationModeLabels, consultationTypes, formatDateTimeFr } from "./booking-shared.ts";
import { formatCountryName, formatDateFr, formatPhoneNumber, formatProperName, formatUsd } from "./format.ts";
import { brand } from "./site.ts";
import { companySignatureCommands, officialSealCommands, watermarkCommands } from "./document-branding.ts";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const NAVY = "0.043 0.114 0.212";
const GOLD = "0.831 0.686 0.216";
const RED = "0.800 0.063 0.180";
const IVORY = "0.980 0.965 0.925";
const INK = "0.105 0.133 0.170";
const MUTED = "0.390 0.425 0.470";

function pdfText(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[^ -~ -ÿ]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function text(value: string, x: number, y: number, size: number, font = "F1", color = INK) {
  return `BT /${font} ${size} Tf ${color} rg ${x} ${y} Td (${pdfText(value)}) Tj ET\n`;
}

function rect(x: number, y: number, width: number, height: number, color: string, radius = 0) {
  if (!radius) return `q ${color} rg ${x} ${y} ${width} ${height} re f Q\n`;
  const r = Math.min(radius, width / 2, height / 2);
  const k = r * 0.55228475;
  return `q ${color} rg ${x + r} ${y} m ${x + width - r} ${y} l ${x + width - r + k} ${y} ${x + width} ${y + r - k} ${x + width} ${y + r} c ${x + width} ${y + height - r} l ${x + width} ${y + height - r + k} ${x + width - r + k} ${y + height} ${x + width - r} ${y + height} c ${x + r} ${y + height} l ${x + r - k} ${y + height} ${x} ${y + height - r + k} ${x} ${y + height - r} c ${x} ${y + r} l ${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c f Q\n`;
}

function line(x1: number, y1: number, x2: number, y2: number, color: string, width = 1) {
  return `q ${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q\n`;
}

function labelValue(label: string, value: string, x: number, y: number, width = 210, valueSize = 10.5) {
  return [
    text(label.toUpperCase(), x, y, 7.5, "F2", MUTED),
    text(value, x, y - 17, valueSize, "F2", INK),
    line(x, y - 27, x + width, y - 27, "0.890 0.900 0.910", 0.6),
  ].join("");
}

function paymentMethodLabel(value: string | null) {
  const normalized = String(value || "card").trim().toLowerCase();
  const labels: Record<string, string> = {
    card: "Carte bancaire",
    "carte bancaire": "Carte bancaire",
    link: "Stripe Link",
    paypal: "PayPal",
    cashapp: "Cash App Pay",
    us_bank_account: "Compte bancaire américain",
    customer_balance: "Solde client",
  };
  return labels[normalized] || formatProperName(normalized.replace(/_/g, " "));
}

function qrCode(value: string, x: number, y: number, size: number) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const moduleCount = qr.modules.size;
  const quietZone = 4;
  const cell = size / (moduleCount + quietZone * 2);
  const commands = [rect(x, y, size, size, "1 1 1", 5)];
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (qr.modules.get(row, column)) {
        commands.push(rect(x + (column + quietZone) * cell, y + size - (row + quietZone + 1) * cell, cell + 0.08, cell + 0.08, NAVY));
      }
    }
  }
  return commands.join("");
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodeLogo() {
  const png = readFileSync(join(process.cwd(), "public", "images", "logo.png"));
  if (png.subarray(1, 4).toString("ascii") !== "PNG") throw new Error("Logo PNG invalide.");
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error("Le logo doit être un PNG RGBA 8 bits non entrelacé.");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset += length + 12;
  }
  const source = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = source[sourceOffset++];
    for (let column = 0; column < stride; column += 1) {
      const raw = source[sourceOffset++];
      const index = row * stride + column;
      const left = column >= 4 ? pixels[index - 4] : 0;
      const up = row > 0 ? pixels[index - stride] : 0;
      const upperLeft = row > 0 && column >= 4 ? pixels[index - stride - 4] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft);
      pixels[index] = (raw + predictor) & 255;
    }
  }
  const rgb = Buffer.alloc(width * height * 3);
  const alpha = Buffer.alloc(width * height);
  for (let sourceIndex = 0, rgbIndex = 0, alphaIndex = 0; sourceIndex < pixels.length; sourceIndex += 4) {
    rgb[rgbIndex++] = pixels[sourceIndex];
    rgb[rgbIndex++] = pixels[sourceIndex + 1];
    rgb[rgbIndex++] = pixels[sourceIndex + 2];
    alpha[alphaIndex++] = pixels[sourceIndex + 3];
  }
  return { width, height, rgb: deflateSync(rgb), alpha: deflateSync(alpha) };
}

class PdfBuilder {
  private parts: Buffer[] = [Buffer.from("%PDF-1.7\n%\xFF\xFF\xFF\xFF\n", "latin1")];
  private offsets: number[] = [0];

  private length() {
    return this.parts.reduce((total, part) => total + part.length, 0);
  }

  object(index: number, body: string | Buffer) {
    this.offsets[index] = this.length();
    this.parts.push(Buffer.from(`${index} 0 obj\n`, "latin1"));
    this.parts.push(typeof body === "string" ? Buffer.from(body, "latin1") : body);
    this.parts.push(Buffer.from("\nendobj\n", "latin1"));
  }

  stream(index: number, dictionary: string, data: Buffer) {
    this.object(index, Buffer.concat([Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`, "latin1"), data, Buffer.from("\nendstream", "latin1")]));
  }

  finish(count: number) {
    const xref = this.length();
    const rows = ["xref", `0 ${count + 1}`, "0000000000 65535 f "];
    for (let index = 1; index <= count; index += 1) rows.push(`${String(this.offsets[index]).padStart(10, "0")} 00000 n `);
    rows.push("trailer", `<< /Size ${count + 1} /Root 1 0 R >>`, "startxref", String(xref), "%%EOF");
    this.parts.push(Buffer.from(`${rows.join("\n")}\n`, "latin1"));
    return Buffer.concat(this.parts);
  }
}

export function generatePremiumAppointmentInvoicePdf(appointment: Appointment) {
  const logo = decodeLogo();
  const clientName = formatProperName(appointment.client_full_name);
  const phone = formatPhoneNumber(appointment.client_phone);
  const country = formatCountryName(appointment.client_country);
  const amount = formatUsd(appointment.amount_cents / 100);
  const method = paymentMethodLabel(appointment.payment_method_label);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://acces-canada.vercel.app").replace(/\/$/, "");
  const verificationUrl = `${siteUrl}/facture/verifier/${encodeURIComponent(appointment.stripe_session_id)}`;
  const content: string[] = [];

  content.push(rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "1 1 1"));
  content.push(watermarkCommands(PAGE_WIDTH, PAGE_HEIGHT));
  content.push(rect(0, 632, PAGE_WIDTH, 210, NAVY));
  content.push(rect(0, 626, PAGE_WIDTH, 6, GOLD));
  content.push(rect(30, 718, 98, 98, "1 1 1", 15));
  content.push("q 88 0 0 88 35 723 cm /Im1 Do Q\n");
  content.push(text("ACCÈS CANADA", 148, 778, 20, "F2", "1 1 1"));
  content.push(text(brand.slogan, 148, 758, 9.5, "F1", "0.760 0.800 0.850"));
  content.push(text("FACTURE", 436, 782, 10, "F2", GOLD));
  content.push(text(appointment.invoice_number, 386, 754, 16, "F2", "1 1 1"));
  content.push(rect(386, 690, 158, 34, GOLD, 17));
  content.push(text("✓  FACTURE ACQUITTÉE", 402, 702, 9, "F2", NAVY));
  content.push(text("Merci pour votre confiance.", 42, 665, 11, "F1", "0.800 0.830 0.870"));

  content.push(text("RÉCAPITULATIF", 42, 594, 8, "F2", RED));
  content.push(text("Votre consultation, en toute clarté.", 42, 570, 18, "F2", NAVY));
  content.push(rect(374, 546, 170, 66, NAVY, 12));
  content.push(text("MONTANT PAYÉ", 392, 590, 7.5, "F2", GOLD));
  content.push(text(amount, 392, 564, 18, "F2", "1 1 1"));

  content.push(rect(34, 354, 255, 166, IVORY, 12));
  content.push(rect(306, 354, 255, 166, "0.955 0.965 0.975", 12));
  content.push(rect(50, 486, 26, 26, RED, 13));
  content.push(text("C", 59, 495, 9, "F2", "1 1 1"));
  content.push(text("CLIENT", 84, 495, 8, "F2", RED));
  content.push(text(clientName, 50, 461, 15, "F2", NAVY));
  content.push(labelValue("Courriel", appointment.client_email, 50, 433, 220, appointment.client_email.length > 34 ? 7.5 : 10.5));
  content.push(labelValue("Téléphone", phone, 50, 386, 102));
  content.push(labelValue("Pays", country, 168, 386, 102));

  content.push(rect(322, 486, 26, 26, GOLD, 13));
  content.push(text("R", 331, 495, 9, "F2", NAVY));
  content.push(text("RENDEZ-VOUS", 356, 495, 8, "F2", NAVY));
  content.push(text(consultationTypes[appointment.consultation_type].label, 322, 461, 13, "F2", NAVY));
  content.push(labelValue("Date et heure", formatDateTimeFr(appointment.starts_at), 322, 433, 220));
  content.push(labelValue("Mode", consultationModeLabels[appointment.consultation_mode], 322, 386, 102));
  content.push(labelValue("Durée", `${appointment.duration_minutes} minutes`, 440, 386, 102));

  content.push(text("DÉTAIL DU PAIEMENT", 42, 318, 8, "F2", RED));
  content.push(rect(34, 198, 527, 98, "0.975 0.978 0.982", 10));
  content.push(text("SERVICE", 52, 272, 7.5, "F2", MUTED));
  content.push(text("MÉTHODE", 304, 272, 7.5, "F2", MUTED));
  content.push(text("TOTAL", 470, 272, 7.5, "F2", MUTED));
  content.push(line(52, 258, 543, 258, "0.850 0.865 0.885", 0.8));
  content.push(text(consultationTypes[appointment.consultation_type].label, 52, 232, 11, "F2", INK));
  content.push(text(method, 304, 232, 10, "F1", INK));
  content.push(text(amount, 465, 232, 12, "F2", NAVY));
  content.push(text(`Paiement confirmé le ${formatDateFr(appointment.confirmed_at || appointment.created_at)}`, 52, 211, 8.5, "F1", MUTED));

  content.push(rect(0, 0, PAGE_WIDTH, 150, NAVY));
  content.push(rect(34, 106, 5, 22, RED, 2));
  content.push(text("Référence de réservation", 52, 121, 7.5, "F2", "0.650 0.700 0.760"));
  content.push(text(appointment.booking_reference, 52, 101, 11, "F2", "1 1 1"));
  content.push(rect(236, 70, 145, 67, IVORY, 8));
  content.push(companySignatureCommands("director", 246, 79, 125));
  content.push(officialSealCommands(397, 72, 78, false));
  content.push(qrCode(verificationUrl, 493, 84, 58));
  content.push(text("VÉRIFIER", 505, 72, 6, "F2", GOLD));
  content.push(line(34, 62, 561, 62, "0.180 0.240 0.320", 0.8));
  content.push(text(`${brand.phone}   •   ${brand.email}`, 34, 42, 8, "F1", "0.800 0.830 0.870"));
  content.push(text("Canada et international", 428, 42, 8, "F2", GOLD));
  content.push(text("Document électronique officiel émis par Accès Canada. Cette facture fait foi de paiement.", 34, 20, 7, "F1", "0.500 0.560 0.640"));
  content.push(text("1 / 1", 536, 20, 6.5, "F2", GOLD));

  const builder = new PdfBuilder();
  builder.object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  builder.object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  builder.object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 7 0 R >> >> /Contents 6 0 R >>`);
  builder.object(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  builder.object(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  builder.stream(6, "", Buffer.from(content.join(""), "latin1"));
  builder.stream(7, `/Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 8 0 R`, logo.rgb);
  builder.stream(8, `/Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, logo.alpha);
  return builder.finish(8);
}
