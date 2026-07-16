import { randomUUID } from "node:crypto";
import net from "node:net";
import tls from "node:tls";

type SmtpOptions = {
  host: string;
  port: number;
  secure: boolean;
  startTls?: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: {
    filename: string;
    contentType: string;
    content: Buffer;
    contentId?: string;
    disposition?: "attachment" | "inline";
  }[];
};

/** Le port 465 utilise TLS implicite; les ports de soumission utilisent STARTTLS. */
export function smtpSecurityForPort(port: number) {
  return { secure: port === 465, startTls: port !== 465 };
}

const SMTP_TIMEOUT_MS = 15_000;

function attachTimeout<T extends net.Socket>(socket: T): T {
  socket.setTimeout(SMTP_TIMEOUT_MS);
  socket.on("timeout", () => {
    socket.destroy(new Error(`Délai SMTP dépassé après ${SMTP_TIMEOUT_MS / 1000} secondes.`));
  });
  return socket;
}

function waitForLine(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("end", onEnd);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onEnd = () => {
      cleanup();
      reject(new Error("Connexion SMTP fermée avant la réponse du serveur."));
    };
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      if (last && /^\d{3}\s/.test(last)) {
        cleanup();
        resolve(buffer);
      }
    };
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("end", onEnd);
  });
}

async function command(socket: net.Socket, line: string, expected: number[]) {
  socket.write(`${line}\r\n`);
  const response = await waitForLine(socket);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) {
    throw new Error(`Réponse SMTP inattendue pour "${line.split(" ")[0]}": ${response.trim()}`);
  }
  return response;
}

function connectPlain(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = attachTimeout(net.connect(port, host, () => resolve(socket)));
    socket.once("error", reject);
  });
}

function connectTls(host: string, port: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = attachTimeout(tls.connect({ host, port, servername: host }, () => resolve(socket)));
    socket.once("error", reject);
  });
}

function upgradeToTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secureSocket = attachTimeout(tls.connect({ socket, servername: host }, () => resolve(secureSocket)));
    secureSocket.once("error", reject);
  });
}

function encodeAddress(address: string) {
  return address.replace(/[\r\n<>]/g, "").trim();
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: Buffer | string) {
  const base64 = Buffer.isBuffer(value) ? value.toString("base64") : Buffer.from(value, "utf8").toString("base64");
  return base64.match(/.{1,76}/g)?.join("\r\n") || "";
}

function formatMessage(options: SmtpOptions) {
  const from = encodeAddress(options.from);
  const to = encodeAddress(options.to);
  const replyTo = options.replyTo ? encodeAddress(options.replyTo) : undefined;
  const subject = options.subject.replace(/[\r\n]/g, " ").trim();
  const attachments = options.attachments || [];
  const messageIdDomain = from.split("@")[1] || "acces-canada.vercel.app";
  const headers = [
    `From: ${encodeHeader("Accès Canada")} <${from}>`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@${messageIdDomain}>`,
    "MIME-Version: 1.0",
  ];

  if (attachments.length || options.html) {
    const mixedBoundary = `acces-canada-mixed-${randomUUID()}`;
    const alternativeBoundary = `acces-canada-alternative-${randomUUID()}`;
    return [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      "",
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      "",
      `--${alternativeBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(options.text),
      "",
      ...(options.html
        ? [
            `--${alternativeBoundary}`,
            'Content-Type: text/html; charset="UTF-8"',
            "Content-Transfer-Encoding: base64",
            "",
            wrapBase64(options.html),
            "",
          ]
        : []),
      `--${alternativeBoundary}--`,
      "",
      ...attachments.flatMap((attachment) => {
        const filename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const disposition = attachment.disposition || "attachment";
        return [
          `--${mixedBoundary}`,
          `Content-Type: ${attachment.contentType}; name="${filename}"`,
          "Content-Transfer-Encoding: base64",
          `Content-Disposition: ${disposition}; filename="${filename}"`,
          ...(attachment.contentId ? [`Content-ID: <${attachment.contentId}>`] : []),
          "",
          wrapBase64(attachment.content),
          "",
        ];
      }),
      `--${mixedBoundary}--`,
      "",
    ].join("\r\n");
  }

  return [
    ...headers,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(options.text),
    "",
  ].join("\r\n");
}

async function authenticate(socket: net.Socket, user: string, pass: string) {
  const plain = Buffer.from(`\u0000${user}\u0000${pass}`, "utf8").toString("base64");
  try {
    await command(socket, `AUTH PLAIN ${plain}`, [235]);
  } catch (plainError) {
    console.warn("[smtp] AUTH PLAIN refusé; tentative AUTH LOGIN.");
    await command(socket, "AUTH LOGIN", [334]);
    await command(socket, Buffer.from(user, "utf8").toString("base64"), [334]);
    try {
      await command(socket, Buffer.from(pass, "utf8").toString("base64"), [235]);
    } catch (loginError) {
      throw new AggregateError([plainError, loginError], "Authentification SMTP Gmail refusée.");
    }
  }
}

export async function sendSmtpMail(options: SmtpOptions) {
  let socket: net.Socket | tls.TLSSocket | undefined;
  const normalizedPass = options.host.toLowerCase() === "smtp.gmail.com" ? options.pass.replace(/\s/g, "") : options.pass;
  const context = { host: options.host, port: options.port, secure: options.secure, recipient: encodeAddress(options.to) };
  try {
    console.info("[smtp] connect_start", context);
    socket = options.secure ? await connectTls(options.host, options.port) : await connectPlain(options.host, options.port);
    await waitForLine(socket);
    console.info("[smtp] connected", context);
    await command(socket, "EHLO acces-canada.vercel.app", [250]);
    if (!options.secure && options.startTls !== false) {
      console.info("[smtp] starttls_start", context);
      await command(socket, "STARTTLS", [220]);
      socket = await upgradeToTls(socket, options.host);
      await command(socket, "EHLO acces-canada.vercel.app", [250]);
      console.info("[smtp] starttls_complete", context);
    }

    if (normalizedPass !== options.pass) console.info("[smtp] gmail_app_password_whitespace_removed");
    await authenticate(socket, options.user, normalizedPass);
    console.info("[smtp] authenticated", context);
    await command(socket, `MAIL FROM:<${encodeAddress(options.from)}>`, [250]);
    await command(socket, `RCPT TO:<${encodeAddress(options.to)}>`, [250, 251]);
    console.info("[smtp] envelope_accepted", context);
    await command(socket, "DATA", [354]);
    socket.write(`${formatMessage(options)}\r\n.\r\n`);
    const response = await waitForLine(socket);
    const code = Number(response.slice(0, 3));
    if (code !== 250) throw new Error(`Le serveur SMTP a refusé le message: ${response.trim()}`);
    console.info("[smtp] message_accepted", { ...context, response: response.trim() });
    await command(socket, "QUIT", [221]);
  } catch (error) {
    console.error("[smtp] failed", {
      ...context,
      message: error instanceof Error ? error.message : "Erreur inconnue",
      code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
    });
    throw error;
  } finally {
    socket?.destroy();
  }
}
