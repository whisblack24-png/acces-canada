import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { LibraryManager } from "@/components/admin/LibraryManager";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listClients } from "@/lib/admin-data";
import { listLibraryItems } from "@/lib/document-library";

export const dynamic="force-dynamic";
export default async function LibraryPage(){
  if(!(await isAdminAuthenticated()))redirect("/admin/login");
  const[items,clients]=await Promise.all([listLibraryItems(),listClients()]);
  return <AdminShell><LibraryManager initialItems={items} clients={clients.map(({id,full_name,file_reference})=>({id,full_name,file_reference}))}/></AdminShell>;
}
