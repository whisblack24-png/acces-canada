import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Accès Canada", short_name: "Accès Canada", description: "Votre chemin vers le Canada, notre engagement.", start_url: "/", display: "standalone", background_color: "#F8F6EF", theme_color: "#0B1D36", lang: "fr-CA", icons: [{ src: "/images/logo.png", sizes: "512x512", type: "image/png" }] };
}
