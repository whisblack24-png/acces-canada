export type QuestionnaireType = "client_principal" | "garant_financier";
export type FieldType = "text" | "email" | "tel" | "date" | "number" | "textarea" | "select" | "checkbox";
export type QuestionnaireField = { key: string; label: string; type: FieldType; required?: boolean; options?: string[]; help?: string };
export type QuestionnaireSection = { key: string; title: string; description?: string; fields: QuestionnaireField[] };

const f = (key: string, label: string, type: FieldType = "text", required = false, options?: string[], help?: string): QuestionnaireField => ({ key, label, type, required, options, help });

export const questionnaireLabels: Record<QuestionnaireType, string> = {
  client_principal: "Questionnaire du client principal",
  garant_financier: "Questionnaire du garant financier",
};

export const caseSteps = [
  ["dossier_created", "Dossier créé"], ["service_agreement", "Convention de services"], ["payment", "Paiement"],
  ["client_questionnaire", "Questionnaire client"], ["guarantor_questionnaire", "Questionnaire garant"],
  ["documents_received", "Documents reçus"], ["case_analysis", "Analyse du dossier"], ["drafting", "Rédaction"],
  ["validation_signature", "Validation et signature"], ["ircc_submission", "Dépôt IRCC"], ["decision", "Décision"],
] as const;

export const questionnaireDefinitions: Record<QuestionnaireType, QuestionnaireSection[]> = {
  client_principal: [
    { key: "identity", title: "Identité complète", fields: [f("family_name", "Nom de famille", "text", true), f("given_names", "Prénom(s)", "text", true), f("birth_date", "Date de naissance", "date", true), f("birth_place", "Lieu de naissance", "text", true), f("nationality", "Nationalité", "text", true), f("passport_number", "Numéro de passeport"), f("passport_expiry", "Date d’expiration du passeport", "date")] },
    { key: "contact", title: "Coordonnées et adresse", fields: [f("email", "Adresse courriel", "email", true), f("phone", "Téléphone", "tel", true), f("address", "Adresse résidentielle complète", "textarea", true), f("residence_country", "Pays de résidence", "text", true), f("residence_since", "Depuis quelle date y résidez-vous ?", "date")] },
    { key: "civil_status", title: "État civil", fields: [f("civil_status", "État civil", "select", true, ["Célibataire", "Marié(e)", "Conjoint(e) de fait", "Divorcé(e)", "Séparé(e)", "Veuf / Veuve"]), f("previous_unions", "Unions antérieures et dates", "textarea")] },
    { key: "family", title: "Conjoint et enfants", fields: [f("has_spouse", "Avez-vous un conjoint ou une conjointe ?", "select", true, ["Oui", "Non"]), f("spouse_details", "Identité, profession et coordonnées du conjoint", "textarea"), f("has_children", "Avez-vous des enfants ?", "select", true, ["Oui", "Non"]), f("children_details", "Pour chaque enfant : nom, naissance, résidence et occupation", "textarea")] },
    { key: "education", title: "Études", fields: [f("education_level", "Plus haut niveau d’études", "text", true), f("education_history", "Établissements, programmes, diplômes et dates", "textarea", true), f("current_studies", "Études actuellement suivies", "textarea")] },
    { key: "employment", title: "Emploi, commerce ou activité professionnelle", fields: [f("occupation", "Profession ou activité actuelle", "text", true), f("employer", "Employeur ou nom du commerce"), f("employment_since", "Date de début", "date"), f("employment_address", "Adresse et coordonnées professionnelles", "textarea"), f("employment_history", "Historique professionnel des dix dernières années", "textarea", true)] },
    { key: "assets", title: "Revenus, épargne et biens", fields: [f("monthly_income", "Revenu mensuel net", "number", true), f("currency", "Devise", "text", true), f("savings", "Épargne disponible et devise", "text"), f("assets", "Biens immobiliers, véhicules, entreprises ou autres actifs", "textarea"), f("debts", "Dettes et engagements financiers", "textarea")] },
    { key: "banking", title: "Comptes bancaires et Mobile Money", fields: [f("bank_accounts", "Banques, types de comptes, ancienneté et soldes approximatifs", "textarea"), f("mobile_money", "Services Mobile Money, ancienneté et solde approximatif", "textarea"), f("regular_transactions", "Origine des entrées et principales transactions régulières", "textarea")] },
    { key: "travel", title: "Historique de voyages et visas", fields: [f("travel_history", "Pays visités, dates, motifs et durées", "textarea"), f("valid_visas", "Visas valides ou antérieurs", "textarea"), f("overstays", "Dépassement de séjour ou problème aux frontières", "textarea")] },
    { key: "refusals", title: "Refus antérieurs", fields: [f("has_refusal", "Avez-vous déjà reçu un refus de visa, permis ou entrée ?", "select", true, ["Oui", "Non"]), f("refusal_details", "Pays, type de demande, date et motifs du refus", "textarea"), f("refusal_changes", "Ce qui a changé depuis le dernier refus", "textarea")] },
    { key: "purpose", title: "Motif du voyage au Canada", fields: [f("travel_purpose", "Motif principal et objectifs précis", "textarea", true), f("inviting_party", "Personne ou organisme invitant", "textarea"), f("activities", "Activités prévues au Canada", "textarea", true)] },
    { key: "dates", title: "Durée et dates prévues", fields: [f("arrival_date", "Date d’arrivée prévue", "date", true), f("departure_date", "Date de départ prévue", "date", true), f("duration_explanation", "Contraintes ou flexibilité des dates", "textarea")] },
    { key: "cities", title: "Villes visitées", fields: [f("cities", "Villes, ordre de visite et durée dans chacune", "textarea", true), f("itinerary", "Itinéraire détaillé", "textarea")] },
    { key: "accommodation", title: "Hébergement", fields: [f("accommodation_type", "Type d’hébergement", "select", true, ["Chez un proche", "Hôtel", "Location", "Autre"]), f("accommodation_details", "Nom, adresse, coordonnées et dates", "textarea", true)] },
    { key: "budget", title: "Budget du voyage", fields: [f("travel_budget", "Budget total prévu", "number", true), f("budget_currency", "Devise", "text", true), f("budget_breakdown", "Transport, hébergement, nourriture, assurance et autres dépenses", "textarea", true)] },
    { key: "funding", title: "Personne ou organisme qui finance le voyage", fields: [f("funding_source", "Qui finance le voyage ?", "select", true, ["Moi-même", "Garant financier", "Employeur", "Organisme", "Partagé"]), f("funder_details", "Identité, lien et part prise en charge", "textarea"), f("personal_contribution", "Votre contribution personnelle et sa provenance", "textarea")] },
    { key: "ties", title: "Attaches dans le pays de résidence", fields: [f("family_ties", "Attaches familiales", "textarea", true), f("professional_ties", "Attaches professionnelles ou commerciales", "textarea", true), f("financial_ties", "Attaches financières et patrimoniales", "textarea"), f("return_reasons", "Raisons concrètes de votre retour", "textarea", true)] },
    { key: "documents", title: "Documents disponibles", fields: [f("identity_documents", "Documents d’identité et passeport disponibles", "textarea"), f("financial_documents", "Relevés, preuves de revenus et de biens disponibles", "textarea"), f("employment_documents", "Documents d’emploi ou de commerce disponibles", "textarea"), f("travel_documents", "Invitations, réservations et preuves de voyage disponibles", "textarea"), f("other_documents", "Autres pièces pertinentes", "textarea")] },
  ],
  garant_financier: [
    { key: "identity", title: "Identité complète", fields: [f("family_name", "Nom de famille", "text", true), f("given_names", "Prénom(s)", "text", true), f("birth_date", "Date de naissance", "date", true), f("nationality", "Nationalité", "text", true), f("identity_document", "Pièce d’identité utilisée", "text", true)] },
    { key: "contact", title: "Coordonnées et adresse", fields: [f("email", "Adresse courriel", "email", true), f("phone", "Téléphone", "tel", true), f("address", "Adresse résidentielle complète", "textarea", true)] },
    { key: "relationship", title: "Lien avec le client", fields: [f("relationship", "Nature du lien", "text", true), f("relationship_since", "Depuis quand connaissez-vous le client ?", "text", true), f("relationship_details", "Décrivez votre relation", "textarea", true)] },
    { key: "residence", title: "Pays de résidence et statut", fields: [f("residence_country", "Pays de résidence", "text", true), f("immigration_status", "Citoyenneté ou statut d’immigration dans ce pays", "text", true), f("status_expiry", "Date d’expiration du statut, s’il y a lieu", "date")] },
    { key: "profession", title: "Profession et employeur", fields: [f("occupation", "Profession", "text", true), f("employer", "Employeur ou entreprise", "text", true), f("employer_address", "Adresse et coordonnées", "textarea"), f("seniority", "Ancienneté professionnelle", "text", true)] },
    { key: "income", title: "Revenus", fields: [f("monthly_income", "Revenu mensuel net", "number", true), f("currency", "Devise", "text", true), f("income_sources", "Sources de revenus", "textarea", true)] },
    { key: "finances", title: "Situation financière", fields: [f("savings", "Épargne et liquidités disponibles", "textarea", true), f("assets", "Biens et autres actifs", "textarea"), f("debts_expenses", "Dettes et dépenses mensuelles importantes", "textarea", true), f("dependants", "Nombre de personnes à charge", "number", true)] },
    { key: "coverage", title: "Dépenses du voyage prises en charge", fields: [f("covered_expenses", "Dépenses prises en charge", "textarea", true), f("maximum_contribution", "Montant maximal de la contribution", "number", true), f("contribution_currency", "Devise", "text", true), f("payment_method", "Comment les dépenses seront-elles payées ?", "textarea", true)] },
    { key: "reason", title: "Raison de la prise en charge", fields: [f("support_reason", "Expliquez pourquoi vous financez ce voyage", "textarea", true), f("financial_capacity", "Expliquez votre capacité à respecter cet engagement", "textarea", true)] },
    { key: "documents", title: "Documents justificatifs disponibles", fields: [f("status_documents", "Preuves de citoyenneté ou statut", "textarea"), f("employment_documents", "Preuves d’emploi et de revenus", "textarea"), f("bank_documents", "Relevés bancaires et preuves d’épargne", "textarea"), f("relationship_documents", "Preuves du lien avec le client", "textarea"), f("other_documents", "Autres documents", "textarea")] },
    { key: "declaration", title: "Déclaration", description: "La soumission vaut confirmation formelle.", fields: [f("accuracy_confirmed", "Je confirme que les renseignements fournis sont exacts, complets et vérifiables.", "checkbox", true), f("declaration_name", "Nom complet du déclarant", "text", true), f("declaration_date", "Date de la déclaration", "date", true)] },
  ],
};

export function calculateQuestionnaireProgress(type: QuestionnaireType, answers: Record<string, unknown>) {
  const fields = questionnaireDefinitions[type].flatMap((section) => section.fields);
  const complete = fields.filter((field) => isQuestionnaireAnswerFilled(answers[field.key])).length;
  return fields.length ? Math.round((complete / fields.length) * 100) : 0;
}

export function isQuestionnaireAnswerFilled(value: unknown) {
  return value === true || (value !== false && String(value ?? "").trim().length > 0);
}

export function questionnaireLifecycleStatus(type: QuestionnaireType, answers: Record<string, unknown>) {
  const progress = calculateQuestionnaireProgress(type, answers);
  if (progress === 0) return "draft" as const;
  if (progress === 100) return "completed" as const;
  return "in_progress" as const;
}
