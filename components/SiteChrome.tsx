"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSecurePortal = pathname.startsWith("/admin") || pathname.startsWith("/client");

  if (isSecurePortal) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      {children}
      <Footer />
      <WhatsAppButton />
    </>
  );
}
