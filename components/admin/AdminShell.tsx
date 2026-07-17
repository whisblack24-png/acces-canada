"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, BarChart3, BookOpen, CalendarCheck, CircleDollarSign, FileSignature, FileText, LayoutDashboard, ListTodo, LogOut, UsersRound, type LucideIcon } from "lucide-react";
import { brand } from "@/lib/site";
import { AdminCommandCenter } from "@/components/admin/AdminCommandCenter";

type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

const adminNav: AdminNavItem[] = [
  { label: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
  { label: "Clients", href: "/admin/clients", icon: UsersRound },
  { label: "Tâches et rappels", href: "/admin/suivi", icon: ListTodo },
  { label: "Journal d’activité", href: "/admin/activite", icon: Activity },
  { label: "Rendez-vous", href: "/admin/rendez-vous", icon: CalendarCheck },
  { label: "Finances", href: "/admin/finances", icon: CircleDollarSign },
  { label: "Documents", href: "/admin/documents", icon: FileText },
  { label: "Bibliothèque", href: "/admin/bibliotheque", icon: BookOpen },
  { label: "Paramètres des signatures", href: "/admin/parametres-signatures", icon: FileSignature },
  { label: "Rapports", href: "/admin/rapports", icon: BarChart3 },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-ivory text-navy">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-navy/10 bg-navy text-white lg:block">
        <div className="flex h-full flex-col p-5">
          <Link href="/admin" className="flex items-center gap-3 rounded-3xl bg-white/8 p-4">
            <Image src="/images/logo.png" alt="Accès Canada" width={52} height={52} className="h-12 w-12 rounded-2xl" />
            <span>
              <span className="block font-black">{brand.name}</span>
              <span className="mt-1 block text-xs font-semibold text-white/52">Administration</span>
            </span>
          </Link>

          <nav className="mt-8 space-y-2">
            {adminNav.map((item) => {
              const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
              return item.disabled ? (
                <div key={item.href} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white/28">
                  <item.icon className="h-5 w-5" />
                  {item.label}
                  <span className="ml-auto text-[10px] uppercase tracking-[0.18em]">Bientôt</span>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${
                    active ? "bg-gold text-navy" : "text-white/74 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={logout}
            className="mt-auto flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/74 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-72">
        <header className="sticky top-0 z-30 hidden items-center border-b border-navy/10 bg-ivory/92 px-10 py-4 backdrop-blur-xl lg:flex"><AdminCommandCenter /></header>
        <header className="sticky top-0 z-30 border-b border-navy/10 bg-ivory/90 px-5 py-4 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="font-black">
              Admin Accès Canada
            </Link>
            <button type="button" onClick={logout} className="rounded-full bg-navy px-4 py-2 text-xs font-black text-white">
              Sortir
            </button>
          </div>
          <div className="mt-4"><AdminCommandCenter /></div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {adminNav
              .filter((item) => !item.disabled)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${
                    pathname === item.href ? "bg-gold text-navy" : "bg-white text-navy/62"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
          </nav>
        </header>

        <main className="min-w-0 px-5 py-8 md:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
