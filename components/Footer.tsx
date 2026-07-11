import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { brand, contactMethods, navItems, services } from "@/lib/site";

export function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.2fr_0.7fr_0.9fr_1fr]">
        <div>
          <div className="flex items-center gap-4">
            <Image src="/images/logo.png" alt="Accès Canada logo" width={58} height={58} className="rounded-2xl" />
            <div>
              <p className="text-xl font-black">{brand.name}</p>
              <p className="mt-1 text-sm text-white/60">{brand.slogan}</p>
            </div>
          </div>
          <p className="mt-7 max-w-md text-sm leading-7 text-white/64">
            Une présence premium, professionnelle et humaine pour accompagner les projets d'études, de travail,
            d'immigration et d'installation au Canada.
          </p>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-gold">Pages</p>
          <div className="mt-5 space-y-3">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="block text-sm text-white/68 transition hover:text-gold">
                {item.label}
              </Link>
            ))}
            <Link href="/client/login" className="block text-sm font-bold text-gold transition hover:text-white">
              Espace client
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-gold">Services</p>
          <div className="mt-5 space-y-3">
            {services.slice(0, 5).map((service) => (
              <Link key={service.title} href="/services" className="block text-sm text-white/68 transition hover:text-gold">
                {service.title}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-gold">Contact</p>
          <div className="mt-5 space-y-4">
            {contactMethods.map((method) => (
              <a key={method.label} href={method.href} className="flex items-start gap-3 text-sm text-white/68 transition hover:text-gold">
                <method.icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{method.value}</span>
              </a>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-black text-navy transition hover:bg-white"
            >
              Consultation
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/client/login"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-black text-white transition hover:border-gold hover:bg-white hover:text-navy"
            >
              <LockKeyhole className="h-4 w-4" />
              Espace client
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-5 text-center text-xs text-white/48">
        © {new Date().getFullYear()} Accès Canada. Tous droits réservés.
      </div>
    </footer>
  );
}
