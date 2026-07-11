"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, LockKeyhole, Menu, Phone, X } from "lucide-react";
import { useState } from "react";
import { brand, navItems } from "@/lib/site";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/15 bg-navy/90 px-4 py-3 text-white shadow-2xl shadow-navy/20 backdrop-blur-xl sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
          <Image src="/images/logo.png" alt="Accès Canada logo" width={48} height={48} className="h-12 w-12 rounded-2xl" />
          <span className="min-w-0">
            <span className="block truncate text-base font-black leading-none tracking-wide">{brand.name}</span>
            <span className="mt-1 block truncate text-[11px] font-semibold text-white/60">Immigration & conseil</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  active ? "bg-white text-navy" : "text-white/78 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/client/login"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-black text-white transition hover:border-gold hover:bg-white hover:text-navy"
          >
            <LockKeyhole className="h-4 w-4" />
            Espace client
          </Link>
          <Link
            href="/rendez-vous"
            className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-black text-navy transition hover:bg-white"
          >
            <CalendarCheck className="h-4 w-4" />
            Prendre rendez-vous
          </Link>
          <a
            href={`tel:${brand.phone.replaceAll(" ", "")}`}
            className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm font-black text-gold transition hover:bg-gold hover:text-navy"
          >
            <Phone className="h-4 w-4" />
            {brand.phone}
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white lg:hidden"
          aria-label="Ouvrir le menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mx-auto mt-3 max-w-7xl rounded-3xl border border-white/15 bg-navy p-3 text-white shadow-2xl lg:hidden"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm font-bold text-white/85 hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/rendez-vous"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gold px-4 py-3 text-sm font-black text-navy"
            >
              <CalendarCheck className="h-4 w-4" />
              Prendre rendez-vous
            </Link>
            <Link
              href="/client/login"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white"
            >
              <LockKeyhole className="h-4 w-4" />
              Espace client
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
