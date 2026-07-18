import { NextResponse } from "next/server";
import { getAdminIdentity, isAdminAuthenticated } from "@/lib/admin-auth";
import { getClient } from "@/lib/admin-data";
import { approveDocumentReview } from "@/lib/document-analysis";
import { executeJulieCommand } from "@/lib/julie-agent";
import { getJulieApproval, listJulieApprovals, reviewJulieApproval } from "@/lib/julie";
import { createAuditLog } from "@/lib/platform-v2";
import { requestSignature } from "@/lib/production-workflow";
import type { ClientDocumentType } from "@/lib/pdf-documents";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  return NextResponse.json(await listJulieApprovals());
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const body = await request.json() as { id?: string; status?: "approved" | "rejected"; note?: string };
  if (!body.id || !body.status) return NextResponse.json({ error: "Décision incomplète." }, { status: 400 });
  try {
    const identity = await getAdminIdentity();
    if (!identity?.id) return NextResponse.json({ error: "Identité administrative introuvable." }, { status: 401 });
    const pending = await getJulieApproval(body.id);
    if (!pending) return NextResponse.json({ error: "Cette demande a déjà été traitée." }, { status: 409 });
    let result: unknown = null;
    if (body.status === "approved" && pending.action_type === "document_review" && pending.client_id) result = await approveDocumentReview({ uploadId: String(pending.payload.uploadId || ""), analysisId: String(pending.payload.analysisId || "") || undefined, clientId: pending.client_id, reviewedBy: identity.id });
    if (body.status === "approved" && pending.action_type === "internal_action") result = await executeJulieCommand(String(pending.payload.instruction || ""), pending.client_id || undefined, [], "automatic");
    if (body.status === "approved" && pending.action_type === "signature_electronique" && pending.client_id) {
      const client = await getClient(pending.client_id);
      if (!client) throw new Error("Client introuvable.");
      result = await requestSignature(client, String(pending.payload.documentType || "convention") as ClientDocumentType);
    }
    const row = await reviewJulieApproval(body.id, body.status, identity.id, String(body.note || "").slice(0, 2000));
    await createAuditLog({ actorId: identity.id, actorType: "staff", action: body.status, entityType: "julie_approval_requests", entityId: row.id, clientId: row.client_id || undefined, summary: `Demande ${body.status === "approved" ? "approuvée" : "refusée"} par ${identity.name}.`, metadata: { actionType: row.action_type, note: body.note || null, result } });
    return NextResponse.json({ ...row, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Décision impossible." }, { status: 400 });
  }
}
