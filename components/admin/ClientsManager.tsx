"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Edit3, Eye, FileText, Plus, Trash2, X } from "lucide-react";
import { dossierStatuses, serviceLabels, serviceTypes, statusLabels } from "@/lib/admin-data";
import type { AdminClient, ClientInput, ClientStatus, ServiceType } from "@/lib/admin-data";

const emptyForm: ClientInput = {
  full_name: "",
  email: "",
  phone: "",
  country: "",
  service: "visa_visiteur",
  status: "nouveau",
  file_reference: "",
  notes: "",
  internal_notes: "",
  documents_received: [],
  documents_missing: [],
  action_history: [],
  paid_amount: 0,
};

function linesToArray(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value: string[] | null | undefined) {
  return (value || []).join("\n");
}

export function ClientsManager({ initialClients }: { initialClients: AdminClient[] }) {
  const [clients, setClients] = useState(initialClients);
  const [form, setForm] = useState<ClientInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminClient | null>(initialClients[0] || null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const stats = useMemo(
    () => ({
      total: clients.length,
      active: clients.filter((client) => ["en_attente", "incomplet", "en_traitement"].includes(client.status)).length,
      revenue: clients.reduce((sum, client) => sum + Number(client.paid_amount || 0), 0),
    }),
    [clients],
  );

  function edit(client: AdminClient) {
    setEditingId(client.id);
    setSelected(client);
    setForm({
      full_name: client.full_name,
      email: client.email,
      phone: client.phone || "",
      country: client.country || "",
      service: client.service,
      status: client.status,
      file_reference: client.file_reference || "",
      notes: client.notes || "",
      internal_notes: client.internal_notes || client.notes || "",
      documents_received: client.documents_received || [],
      documents_missing: client.documents_missing || [],
      action_history: client.action_history || [],
      paid_amount: Number(client.paid_amount || 0),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function refresh() {
    const response = await fetch("/api/admin/clients", { credentials: "include" });
    const result = (await response.json()) as { clients?: AdminClient[] };
    setClients(result.clients || []);
    setSelected((current) => result.clients?.find((client) => client.id === current?.id) || result.clients?.[0] || null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback("");

    const response = await fetch(editingId ? `/api/admin/clients/${editingId}` : "/api/admin/clients", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });

    const result = (await response.json()) as { message?: string };
    setLoading(false);

    if (!response.ok) {
      setFeedback(result.message || "Action impossible.");
      return;
    }

    setFeedback(editingId ? "Client modifié avec succès." : "Client ajouté avec succès.");
    resetForm();
    await refresh();
  }

  async function remove(client: AdminClient) {
    if (!window.confirm(`Supprimer ${client.full_name} ?`)) return;

    const response = await fetch(`/api/admin/clients/${client.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) {
      setFeedback("Impossible de supprimer le client.");
      return;
    }

    setFeedback("Client supprimé.");
    await refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-[2rem] bg-white p-5 shadow-premium md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-canada">CRM Clients</p>
            <h2 className="mt-2 font-display text-3xl font-black text-navy">Portefeuille clients</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Clients" value={stats.total.toString()} />
            <MiniStat label="Actifs" value={stats.active.toString()} />
            <MiniStat label="Revenus" value={`${stats.revenue.toLocaleString("fr-CA")} $`} />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-navy/10">
          <div className="grid grid-cols-[1.1fr_0.9fr_0.8fr_0.8fr] bg-navy px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/70">
            <span>Client</span>
            <span>Service</span>
            <span>Statut</span>
            <span className="text-right">Actions</span>
          </div>
          {clients.length ? (
            clients.map((client) => (
              <div
                key={client.id}
                className="grid grid-cols-1 gap-3 border-t border-navy/10 px-4 py-4 md:grid-cols-[1.1fr_0.9fr_0.8fr_0.8fr] md:items-center"
              >
                <button type="button" onClick={() => setSelected(client)} className="text-left">
                  <span className="block font-black text-navy">{client.full_name}</span>
                  <span className="mt-1 block text-sm text-navy/52">{client.email}</span>
                </button>
                <span className="text-sm font-bold text-navy/64">{serviceLabels[client.service as ServiceType] || client.service}</span>
                <span className="w-fit rounded-full bg-gold/18 px-3 py-1 text-xs font-black text-navy">
                  {statusLabels[client.status] || client.status}
                </span>
                <span className="flex justify-start gap-2 md:justify-end">
                  <Link
                    href={`/admin/clients/${client.id}`}
                    aria-label="Ouvrir le dossier"
                    title="Ouvrir le dossier"
                    className="grid h-9 w-9 place-items-center rounded-full bg-gold/20 text-navy transition hover:bg-gold"
                  >
                    <FileText className="h-4 w-4" />
                  </Link>
                  <IconButton label="Aperçu" onClick={() => setSelected(client)} icon={<Eye className="h-4 w-4" />} />
                  <IconButton label="Modifier" onClick={() => edit(client)} icon={<Edit3 className="h-4 w-4" />} />
                  <IconButton label="Supprimer" onClick={() => remove(client)} icon={<Trash2 className="h-4 w-4" />} danger />
                </span>
              </div>
            ))
          ) : (
            <p className="px-4 py-8 text-center text-sm font-bold text-navy/50">Aucun client enregistré pour le moment.</p>
          )}
        </div>
      </section>

      <aside className="space-y-6">
        <section className="rounded-[2rem] bg-white p-5 shadow-premium md:p-7">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-black text-navy">{editingId ? "Modifier le client" : "Ajouter un client"}</h2>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-full bg-navy/8 p-2 text-navy">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Input label="Nom complet" value={form.full_name} onChange={(value) => setForm({ ...form, full_name: value })} required />
            <Input label="E-mail" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
            <Input label="Téléphone" value={form.phone || ""} onChange={(value) => setForm({ ...form, phone: value })} />
            <Input label="Pays" value={form.country || ""} onChange={(value) => setForm({ ...form, country: value })} />

            <label className="block text-sm font-bold text-navy/70">
              Type de service
              <select
                value={form.service}
                onChange={(event) => setForm({ ...form, service: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-3 text-navy outline-none focus:border-gold"
              >
                {serviceTypes.map((value) => (
                  <option key={value} value={value}>
                    {serviceLabels[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-navy/70">
              Statut du dossier
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as ClientStatus })}
                className="mt-2 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-3 text-navy outline-none focus:border-gold"
              >
                {dossierStatuses.map((value) => (
                  <option key={value} value={value}>
                    {statusLabels[value]}
                  </option>
                ))}
              </select>
            </label>

            <Input label="Référence dossier" value={form.file_reference || ""} onChange={(value) => setForm({ ...form, file_reference: value })} />
            <Input
              label="Montant payé"
              type="number"
              value={String(form.paid_amount || 0)}
              onChange={(value) => setForm({ ...form, paid_amount: Number(value) })}
            />

            <Textarea
              label="Notes internes"
              value={form.internal_notes || ""}
              onChange={(value) => setForm({ ...form, internal_notes: value, notes: value })}
            />
            <Textarea
              label="Documents reçus"
              value={arrayToLines(form.documents_received)}
              onChange={(value) => setForm({ ...form, documents_received: linesToArray(value) })}
              placeholder="Passeport&#10;Photo d'identité&#10;Relevés bancaires"
            />
            <Textarea
              label="Documents manquants"
              value={arrayToLines(form.documents_missing)}
              onChange={(value) => setForm({ ...form, documents_missing: linesToArray(value) })}
              placeholder="Lettre d'invitation&#10;Preuve d'emploi"
            />

            {feedback ? <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm font-bold text-navy">{feedback}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-canada px-5 py-3 text-sm font-black text-white transition hover:bg-navy disabled:bg-navy/40"
            >
              <Plus className="h-4 w-4" />
              {loading ? "Enregistrement..." : editingId ? "Enregistrer les modifications" : "Ajouter le client"}
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] bg-navy p-5 text-white shadow-premium md:p-7">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-gold">Fiche complète</p>
          {selected ? (
            <div className="mt-4 space-y-3">
              <h3 className="font-display text-3xl font-black">{selected.full_name}</h3>
              <Detail label="E-mail" value={selected.email} />
              <Detail label="Téléphone" value={selected.phone || "Non renseigné"} />
              <Detail label="Pays" value={selected.country || "Non renseigné"} />
              <Detail label="Service" value={serviceLabels[selected.service as ServiceType] || selected.service} />
              <Detail label="Statut" value={statusLabels[selected.status] || selected.status} />
              <Detail label="Référence" value={selected.file_reference || "À créer"} />
              <Detail label="Paiements" value={`${Number(selected.paid_amount || 0).toLocaleString("fr-CA")} $`} />
              <div className="rounded-2xl bg-white/8 p-4">
                <span className="block text-xs font-black uppercase tracking-[0.16em] text-white/42">Notes</span>
                <p className="mt-2 text-sm leading-6 text-white/72">
                  {selected.internal_notes || selected.notes || "Aucune note pour ce client."}
                </p>
              </div>
              <Link
                href={`/admin/clients/${selected.id}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-black text-navy transition hover:bg-white"
              >
                <FileText className="h-4 w-4" />
                Ouvrir le dossier complet
              </Link>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/60">Sélectionnez un client pour consulter sa fiche complète.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-2xl bg-ivory px-4 py-3">
      <span className="block text-lg font-black text-navy">{value}</span>
      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-navy/40">{label}</span>
    </span>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-bold text-navy/70">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-3 text-navy outline-none focus:border-gold"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-bold text-navy/70">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-24 w-full rounded-2xl border border-navy/10 bg-ivory px-4 py-3 text-navy outline-none focus:border-gold"
        placeholder={placeholder}
      />
    </label>
  );
}

function IconButton({ label, onClick, icon, danger = false }: { label: string; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-full transition ${
        danger ? "bg-canada/10 text-canada hover:bg-canada hover:text-white" : "bg-navy/8 text-navy hover:bg-navy hover:text-white"
      }`}
    >
      {icon}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/8 p-4">
      <span className="block text-xs font-black uppercase tracking-[0.16em] text-white/42">{label}</span>
      <span className="mt-1 block font-bold text-white/82">{value}</span>
    </div>
  );
}
