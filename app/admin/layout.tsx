import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: { default: "Administration Accès Canada", template: "%s | Administration Accès Canada" } };
export default function AdminLayout({ children }: { children: React.ReactNode }) { return children; }
