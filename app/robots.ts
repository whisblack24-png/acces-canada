import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://acces-canada.vercel.app").replace(/\/$/, "");
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/client/", "/api/", "/facture/"] }, sitemap: `${base}/sitemap.xml`, host: base };
}
