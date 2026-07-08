"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { faqs } from "@/lib/site";

export function FAQAccordion() {
  const [active, setActive] = useState(0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {faqs.map((faq, index) => {
        const open = active === index;
        return (
          <div key={faq.question} className="overflow-hidden rounded-[1.5rem] border border-navy/8 bg-white shadow-premium">
            <button
              type="button"
              onClick={() => setActive(open ? -1 : index)}
              className="flex w-full items-center justify-between gap-5 px-6 py-5 text-left text-lg font-black text-navy"
            >
              {faq.question}
              <ChevronDown className={`h-5 w-5 shrink-0 text-gold transition ${open ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <p className="px-6 pb-6 leading-8 text-navy/66">{faq.answer}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
