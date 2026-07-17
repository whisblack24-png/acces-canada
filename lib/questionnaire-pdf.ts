import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import {
  questionnaireDefinitions,
  questionnaireLabels,
} from "./questionnaire-definitions.ts";
import type {
  QuestionnaireAnswers,
  QuestionnaireRecord,
} from "./questionnaires.ts";
import { companySignatureCommands, officialSealCommands, pdfText, premiumFooterCommands, qrCodeCommands, verificationUrl, watermarkCommands } from "./document-branding.ts";

type ClientPdfInfo = { fullName: string; fileReference?: string | null };
const NAVY = "0.043 0.114 0.212",
  GOLD = "0.831 0.686 0.216",
  INK = "0.16 0.20 0.27",
  PALE = "0.965 0.957 0.91";
function safe(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
function wrap(value: string, limit = 82) {
  const words = value.trim().split(/\s+/).filter(Boolean),
    lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > limit && current) {
      lines.push(current);
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["Non renseigne"];
}
function date(value?: string | null) {
  if (!value) return "Non renseigne";
  return new Date(value).toLocaleString("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  });
}
function pngRgb(path: string) {
  const png = readFileSync(path);
  let offset = 8,
    width = 0,
    height = 0,
    colorType = 0;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset),
      type = png.toString("ascii", offset + 4, offset + 8),
      data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    }
    if (type === "IDAT") idat.push(data);
    offset += length + 12;
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat)),
    stride = width * channels,
    decoded = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[source++];
    for (let x = 0; x < stride; x++) {
      const value = raw[source++],
        left = x >= channels ? decoded[y * stride + x - channels] : 0,
        up = y ? decoded[(y - 1) * stride + x] : 0,
        upperLeft =
          y && x >= channels ? decoded[(y - 1) * stride + x - channels] : 0;
      let result = value;
      if (filter === 1) result += left;
      else if (filter === 2) result += up;
      else if (filter === 3) result += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upperLeft,
          pa = Math.abs(p - left),
          pb = Math.abs(p - up),
          pc = Math.abs(p - upperLeft);
        result += pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft;
      }
      decoded[y * stride + x] = result & 255;
    }
  }
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0, j = 0; i < decoded.length; i += channels) {
    const alpha = channels === 4 ? decoded[i + 3] / 255 : 1;
    rgb[j++] = Math.round(decoded[i] * alpha + 255 * (1 - alpha));
    rgb[j++] = Math.round(decoded[i + 1] * alpha + 255 * (1 - alpha));
    rgb[j++] = Math.round(decoded[i + 2] * alpha + 255 * (1 - alpha));
  }
  return { width, height, data: deflateSync(rgb) };
}

export function generateQuestionnairePdf(
  row: QuestionnaireRecord,
  answers: QuestionnaireAnswers,
  client: ClientPdfInfo,
) {
  const pages: string[][] = [[]];
  let y = 620;
  const page = () => pages.at(-1)!;
  const text = (
    value: string,
    x: number,
    py: number,
    size = 9,
    bold = false,
    color = INK,
  ) =>
    page().push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg ${x} ${py} Td (${safe(value)}) Tj ET\n`,
    );
  const newPage = () => {
    pages.push([]);
    y = 620;
  };
  const ensure = (height: number) => {
    if (y - height < 78) newPage();
  };
  const sectionTitle = (title: string) => {
    ensure(38);
    page().push(`q ${NAVY} rg 36 ${y - 3} 540 27 re f Q\n`);
    text(title, 50, y + 5, 11, true, "1 1 1");
    y -= 38;
  };
  const answerBox = (label: string, value: unknown) => {
    const display =
      value === true
        ? "Oui"
        : value === false
          ? "Non"
          : String(value || "").trim() || "Non renseigne";
    const lines = wrap(display);
    const height = 31 + lines.length * 11;
    ensure(height);
    page().push(
      `q ${PALE} rg 42 ${y - height + 8} 528 ${height - 4} re f Q\nq ${GOLD} rg 42 ${y - height + 8} 3 ${height - 4} re f Q\n`,
    );
    text(label, 54, y - 9, 8, true, NAVY);
    lines.forEach((line, index) =>
      text(
        line,
        54,
        y - 23 - index * 11,
        8.5,
        false,
        display === "Non renseigne" ? "0.45 0.48 0.52" : INK,
      ),
    );
    y -= height;
  };
  for (const section of questionnaireDefinitions[row.questionnaire_type]) {
    sectionTitle(section.title);
    for (const field of section.fields)
      answerBox(field.label, answers[field.key]);
    y -= 8;
  }
  ensure(105);
  page().push(pdfText("VALIDATION ACCÈS CANADA", 42, y, 8, "F2", NAVY), companySignatureCommands("director", 42, y - 82, 150));
  y -= 105;
  const total = pages.length;
  const documentNumber = `AC-Q-${row.id.slice(0, 8).toUpperCase()}`;
  pages.forEach((commands, index) => {
    commands.unshift(
      watermarkCommands(),
      `q ${NAVY} rg 0 688 612 104 re f Q\nq ${GOLD} rg 0 684 612 4 re f Q\nq 54 0 0 54 38 714 cm /Logo Do Q\nBT /F2 18 Tf 1 1 1 rg 108 752 Td (ACCES CANADA) Tj ET\nBT /F1 9 Tf ${GOLD} rg 108 735 Td (${safe(questionnaireLabels[row.questionnaire_type])}) Tj ET\nBT /F2 10 Tf ${NAVY} rg 38 664 Td (${safe(client.fullName)}) Tj ET\nBT /F1 8 Tf ${INK} rg 38 649 Td (Reference: ${safe(client.fileReference || "Non renseignee")}) Tj ET\nBT /F1 8 Tf ${INK} rg 310 664 Td (Statut: ${safe(row.status === "completed" ? "Complete" : row.status === "in_progress" ? "En cours" : "Brouillon")}  |  Progression: ${row.progress_percent} %) Tj ET\nBT /F1 7.5 Tf ${INK} rg 310 649 Td (Cree: ${safe(date(row.created_at))}  |  Modifie: ${safe(date(row.updated_at))}) Tj ET\nBT /F1 7.5 Tf ${INK} rg 310 636 Td (Complete: ${safe(date(row.submitted_at))}) Tj ET\n`,
    );
    commands.push(
      officialSealCommands(472, 72, 86, false),
      premiumFooterCommands({ documentNumber }, index + 1, total),
      qrCodeCommands(verificationUrl(), 540, 8, 42),
    );
  });
  const logo = pngRgb(join(process.cwd(), "public", "images", "logo.png"));
  const objects: Buffer[] = [];
  const offsets: number[] = [0];
  let cursor = Buffer.byteLength("%PDF-1.4\n", "latin1");
  const addObject = (id: number, body: Buffer | string) => {
    offsets[id] = cursor;
    const head = Buffer.from(`${id} 0 obj\n`, "latin1"),
      data = Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1"),
      tail = Buffer.from("\nendobj\n", "latin1");
    objects.push(head, data, tail);
    cursor += head.length + data.length + tail.length;
  };
  const pageIds = pages.map((_, i) => 6 + i * 2);
  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObject(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  addObject(
    3,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  addObject(
    4,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  addObject(
    5,
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${logo.data.length} >>\nstream\n`,
        "latin1",
      ),
      logo.data,
      Buffer.from("\nendstream", "latin1"),
    ]),
  );
  pages.forEach((commands, i) => {
    const pageId = pageIds[i],
      streamId = pageId + 1,
      stream = Buffer.from(commands.join(""), "latin1");
    addObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents ${streamId} 0 R >>`,
    );
    addObject(
      streamId,
      Buffer.concat([
        Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"),
        stream,
        Buffer.from("endstream", "latin1"),
      ]),
    );
  });
  const size = 6 + pages.length * 2,
    xref = cursor;
  const trailer = [
    `xref\n0 ${size}\n0000000000 65535 f \n`,
    ...Array.from(
      { length: size - 1 },
      (_, i) => `${String(offsets[i + 1]).padStart(10, "0")} 00000 n \n`,
    ),
    `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
  ].join("");
  return Buffer.concat([
    Buffer.from("%PDF-1.4\n", "latin1"),
    ...objects,
    Buffer.from(trailer, "latin1"),
  ]);
}
