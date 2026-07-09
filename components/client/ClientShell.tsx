"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, FolderKanban, LayoutDashboard, LogOut, UploadCloud } from "lucide-react";
import { brand } from "@/lib/site";

const nav = [
  { label: "Tableau de bord", href: "/client/dashboard", icon: LayoutDashboard },
  { label: "Mon dossier", href: "/client/dossier", icon: FolderKanban },
  { label: "Documents", href: "/client/documents", icon: UploadCloud },
];

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/client/auth/logout", { method: "POST", credentials: "include" });
    router.push("/client/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-ivory text-navy">
      <header className="border-b border-navy/10 bg-navy text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <Link href="/client/dashboard" className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="Acces Canada" width={52} height={52} className="h-12 w-12 rounded-2xl" />
            <span>
              <span className="block font-black">{brand.name}</span>
              <span className="block text-xs font-semibold text-white/52">Espace client securise</span>
            </span>
          </Link>
          <nav className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${
                    active ? "bg-gold text-navy" : "bg-white/8 text-white/76 hover:bg-white/14 hover:text-white"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={logout}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-black text-white/76"
            >
              <LogOut className="h-4 w-4" />
              Sortir
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 md:py-10">{children}</main>
    </div>
  );
}

export function ClientPanel({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-premium md:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/18 text-navy">{icon || <FileText className="h-5 w-5" />}</span>
        <h2 className="font-display text-2xl font-black text-navy">{title}</h2>
      </div>
      {children}
    </section>
  );
}
