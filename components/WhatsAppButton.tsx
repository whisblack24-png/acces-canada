import { MessageCircle } from "lucide-react";
import { brand } from "@/lib/site";

export function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${brand.whatsapp}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Contacter Accès Canada sur WhatsApp"
      className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_18px_40px_rgba(37,211,102,0.35)] transition hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(37,211,102,0.45)]"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
