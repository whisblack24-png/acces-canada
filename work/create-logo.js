const sharp = require("sharp");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0B1D36"/>
  <circle cx="256" cy="256" r="188" fill="none" stroke="#D4AF37" stroke-width="18"/>
  <path d="M256 80l-20 45h40z" fill="#C8102E"/>
  <path d="M256 80v70" stroke="#C8102E" stroke-width="14" stroke-linecap="round"/>
  <text x="256" y="272" text-anchor="middle" font-family="Georgia,serif" font-size="126" font-weight="700" fill="#FFFFFF">AC</text>
  <text x="256" y="346" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" letter-spacing="2" fill="#D4AF37">ACCES CANADA</text>
</svg>`;

sharp(Buffer.from(svg))
  .png()
  .toFile("public/images/logo.png")
  .then(() => console.log("logo created"));
