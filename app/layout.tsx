import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteChrome } from "@/components/SiteChrome";
import { brand } from "@/lib/site";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://acces-canada.vercel.app").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
  category: "services professionnels",
  openGraph: {
    title: "Accès Canada",
    description: brand.slogan,
    url: siteUrl,
    siteName: "Accès Canada",
    images: [{ url: "/images/canada-skyline.webp", width: 1200, height: 630, alt: "Accès Canada - accompagnement professionnel" }],
    locale: "fr_CA",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Accès Canada",
    description: brand.slogan,
    images: ["/images/canada-skyline.webp"]
  },
  icons: {
    icon: "/images/logo.png",
    apple: "/images/logo.png"
  },
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
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
