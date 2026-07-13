import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://acces-canada.vercel.app").replace(/\/$/, "");
  return [["",1,"weekly"],["/services",.9,"monthly"],["/rendez-vous",.9,"weekly"],["/about",.7,"monthly"],["/faq",.7,"monthly"],["/contact",.8,"monthly"]].map(([path,priority,frequency]) => ({ url: `${base}${path}`, lastModified: new Date(), priority: Number(priority), changeFrequency: frequency as MetadataRoute.Sitemap[number]["changeFrequency"] }));
}
