import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteChrome } from "@/components/SiteChrome";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL("https://acces-canada.com"),
  title: {
    default: "Accès Canada | Immigration, études et installation au Canada",
    template: "%s | Accès Canada"
  },
  description:
    "Accès Canada accompagne vos projets d'immigration, d'études, de travail et d'installation au Canada avec une approche premium et personnalisée.",
  keywords: [
    "Accès Canada",
    "immigration Canada",
    "étudier au Canada",
    "travailler au Canada",
    "installation Canada",
    "consultation immigration"
  ],
  authors: [{ name: brand.name }],
  creator: brand.name,
  openGraph: {
    title: "Accès Canada",
    description: brand.slogan,
    url: "https://acces-canada.com",
    siteName: "Accès Canada",
    images: [{ url: "/images/canada-skyline.png", width: 1200, height: 630, alt: "Canada skyline" }],
    locale: "fr_CA",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Accès Canada",
    description: brand.slogan,
    images: ["/images/canada-skyline.png"]
  },
  icons: {
    icon: "/images/logo.png",
    apple: "/images/logo.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1D36"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr-CA">
      <body className="font-sans antialiased">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
