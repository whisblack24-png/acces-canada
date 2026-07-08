import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0B1D36",
        gold: "#D4AF37",
        canada: "#C8102E",
        ivory: "#F8F6EF"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
        display: ["Georgia", "Times New Roman", "serif"]
      },
      boxShadow: {
        premium: "0 24px 70px rgba(11, 29, 54, 0.18)"
      },
      backgroundImage: {
        "gold-line": "linear-gradient(90deg, transparent, #D4AF37, transparent)"
      }
    }
  },
  plugins: []
};

export default config;
