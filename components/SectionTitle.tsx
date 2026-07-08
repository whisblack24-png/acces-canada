"use client";

import { motion } from "framer-motion";

type SectionTitleProps = {
  eyebrow: string;
  title: string;
  text?: string;
  light?: boolean;
  align?: "center" | "left";
};

export function SectionTitle({ eyebrow, title, text, light = false, align = "center" }: SectionTitleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.55 }}
      className={`${align === "center" ? "mx-auto text-center" : ""} max-w-3xl`}
    >
      <p className={`text-sm font-black uppercase tracking-[0.26em] ${light ? "text-gold" : "text-canada"}`}>
        {eyebrow}
      </p>
      <h2 className={`mt-4 font-display text-4xl font-black leading-tight md:text-5xl ${light ? "text-white" : "text-navy"}`}>
        {title}
      </h2>
      {text ? <p className={`mt-5 text-base leading-8 ${light ? "text-white/68" : "text-navy/68"}`}>{text}</p> : null}
    </motion.div>
  );
}
