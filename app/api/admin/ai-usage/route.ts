import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listAiUsage, summarizeAiUsage } from "@/lib/ai-usage";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const events = await listAiUsage();
  return NextResponse.json({ summary: summarizeAiUsage(events), events });
}
