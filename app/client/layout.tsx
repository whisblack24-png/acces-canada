import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: { default: "Espace client", template: "%s | Accès Canada" } };
export default function ClientLayout({ children }: { children: React.ReactNode }) { return children; }
