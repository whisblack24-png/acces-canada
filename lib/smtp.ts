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
  replyTo?: string;
};

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
    const socket = net.connect(port, host, () => resolve(socket));
    socket.once("error", reject);
  });
}

function connectTls(host: string, port: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, () => resolve(socket));
    socket.once("error", reject);
  });
}

function upgradeToTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host }, () => resolve(secureSocket));
    secureSocket.once("error", reject);
  });
}

function encodeAddress(address: string) {
  return address.replace(/[\r\n<>]/g, "").trim();
}

function formatMessage(options: SmtpOptions) {
  const from = encodeAddress(options.from);
  const to = encodeAddress(options.to);
  const replyTo = options.replyTo ? encodeAddress(options.replyTo) : undefined;
  const subject = options.subject.replace(/[\r\n]/g, " ").trim();
  const escapedText = options.text.replace(/^\./gm, "..");

  return [
    `From: Accès Canada <${from}>`,
    `To: ${to}`,
    replyTo ? `Reply-To: ${replyTo}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    escapedText,
  ]
    .filter(Boolean)
    .join("\r\n");
}

export async function sendSmtpMail(options: SmtpOptions) {
  let socket: net.Socket | tls.TLSSocket | undefined;

  try {
    socket = options.secure ? await connectTls(options.host, options.port) : await connectPlain(options.host, options.port);
    await waitForLine(socket);
    await command(socket, "EHLO acces-canada.local", [250]);

    if (!options.secure && options.startTls !== false) {
      await command(socket, "STARTTLS", [220]);
      socket = await upgradeToTls(socket, options.host);
      await command(socket, "EHLO acces-canada.local", [250]);
    }

    const auth = Buffer.from(`\u0000${options.user}\u0000${options.pass}`, "utf8").toString("base64");
    await command(socket, `AUTH PLAIN ${auth}`, [235]);
    await command(socket, `MAIL FROM:<${encodeAddress(options.from)}>`, [250]);
    await command(socket, `RCPT TO:<${encodeAddress(options.to)}>`, [250, 251]);
    await command(socket, "DATA", [354]);
    socket.write(`${formatMessage(options)}\r\n.\r\n`);
    const response = await waitForLine(socket);
    const code = Number(response.slice(0, 3));
    if (code !== 250) {
      throw new Error(`Le serveur SMTP a refusé le message: ${response.trim()}`);
    }
    await command(socket, "QUIT", [221]);
  } finally {
    socket?.destroy();
  }
}
