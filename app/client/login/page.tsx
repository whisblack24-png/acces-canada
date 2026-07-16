import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClientLoginForm } from "@/components/client/ClientLoginForm";
import { getClientSession } from "@/lib/client-auth";

export const metadata: Metadata = {
  title: "Portail client",
};

export default async function ClientLoginPage() {
  if (await getClientSession()) {
    redirect("/client/dashboard");
  }

  return (
    <main className="grid min-h-screen min-w-0 place-items-center overflow-x-hidden bg-ivory px-4 py-8 sm:px-5 sm:py-10">
      <ClientLoginForm />
    </main>
  );
}
