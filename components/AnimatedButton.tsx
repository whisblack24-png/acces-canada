"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

type AnimatedButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "light";
};

export function AnimatedButton({ href, children, variant = "primary" }: AnimatedButtonProps) {
  const styles = {
    primary: "bg-gold text-navy shadow-[0_18px_45px_rgba(212,175,55,0.26)] hover:bg-white",
    secondary: "border border-white/30 bg-white/10 text-white hover:border-gold hover:bg-white/15",
    light: "border border-navy/10 bg-white text-navy shadow-premium hover:bg-gold"
  }[variant];

  return (
    <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
      <Link href={href} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black transition ${styles}`}>
        {children}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}
