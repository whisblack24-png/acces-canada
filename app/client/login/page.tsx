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
    <main className="grid min-h-screen place-items-center bg-ivory px-5 py-10">
      <ClientLoginForm />
    </main>
  );
}
