import {
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  HeartHandshake,
  Home,
  Landmark,
  Mail,
  MapPinned,
  MessageCircle,
  Phone,
  Plane,
  ShieldCheck,
  Sparkles,
  Star,
  UsersRound
} from "lucide-react";

export const brand = {
  name: "Accès Canada",
  slogan: "Votre chemin vers le Canada, notre engagement.",
  phone: "+1 819 266 8420",
  email: "accesc625@gmail.com",
  whatsapp: "18192668420",
  colors: {
    navy: "#0B1D36",
    gold: "#D4AF37",
    red: "#C8102E",
    white: "#FFFFFF"
  }
};

export const navItems = [
  { label: "Accueil", href: "/" },
  { label: "À propos", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" }
];

export const services = [
  {
    icon: GraduationCap,
    title: "Études au Canada",
    description:
      "Orientation académique, admission, permis d'études et préparation des documents essentiels.",
    points: ["Choix du programme", "Admission", "Permis d'études"]
  },
  {
    icon: BriefcaseBusiness,
    title: "Travail et carrière",
    description:
      "Accompagnement des profils qualifiés dans la préparation d'un projet professionnel crédible.",
    points: ["Profil professionnel", "Permis de travail", "Stratégie carrière"]
  },
  {
    icon: FileCheck2,
    title: "Dossiers d'immigration",
    description:
      "Structuration, vérification et suivi de vos pièces pour un dossier clair et bien organisé.",
    points: ["Analyse du profil", "Documents", "Suivi"]
  },
  {
    icon: Home,
    title: "Installation au Canada",
    description:
      "Préparation de votre arrivée, premiers repères, démarches pratiques et intégration.",
    points: ["Pré-départ", "Logement", "Installation"]
  },
  {
    icon: UsersRound,
    title: "Regroupement familial",
    description:
      "Conseil et préparation pour les familles qui souhaitent construire leur avenir ensemble.",
    points: ["Évaluation", "Pièces requises", "Accompagnement"]
  },
  {
    icon: Landmark,
    title: "Conseil personnalisé",
    description:
      "Une consultation structurée pour clarifier les options adaptées à votre situation.",
    points: ["Diagnostic", "Plan d'action", "Priorités"]
  }
];

export const values = [
  {
    icon: ShieldCheck,
    title: "Transparence",
    text: "Des explications claires, des attentes réalistes et une communication honnête."
  },
  {
    icon: Award,
    title: "Excellence",
    text: "Une approche soignée, organisée et attentive aux détails qui comptent."
  },
  {
    icon: HeartHandshake,
    title: "Engagement",
    text: "Un accompagnement humain, respectueux et adapté à votre histoire."
  }
];

export const reasons = [
  {
    icon: BadgeCheck,
    title: "Méthode structurée",
    text: "Chaque parcours est organisé autour d'étapes concrètes, lisibles et maîtrisées."
  },
  {
    icon: Sparkles,
    title: "Expérience premium",
    text: "Un service moderne, élégant et fluide, de la première prise de contact au suivi."
  },
  {
    icon: Building2,
    title: "Vision canadienne",
    text: "Une compréhension des attentes académiques, professionnelles et administratives."
  },
  {
    icon: MessageCircle,
    title: "Communication claire",
    text: "Vous savez quoi préparer, pourquoi c'est important et quelle est la prochaine étape."
  }
];

export const stats = [
  { value: "6+", label: "services spécialisés" },
  { value: "100%", label: "accompagnement personnalisé" },
  { value: "24h", label: "première réponse ciblée" },
  { value: "FR", label: "service francophone" }
];

export const testimonials = [
  {
    name: "Mariam D.",
    role: "Projet d'études",
    quote:
      "Accès Canada m'a aidée à comprendre les étapes et à préparer mon dossier avec beaucoup plus de confiance."
  },
  {
    name: "Samuel K.",
    role: "Projet professionnel",
    quote:
      "L'accompagnement était clair, sérieux et très bien organisé. J'ai enfin eu une vision précise de mon parcours."
  },
  {
    name: "Nadia B.",
    role: "Installation",
    quote:
      "Une équipe attentive, disponible et rassurante. Le service donne vraiment l'impression d'être accompagné."
  }
];

export const faqs = [
  {
    question: "Comment commencer avec Accès Canada ?",
    answer:
      "Envoyez un message via le formulaire, WhatsApp, téléphone ou email. Nous analysons votre besoin et vous proposons la meilleure première étape."
  },
  {
    question: "Puis-je demander une consultation si mon projet n'est pas encore clair ?",
    answer:
      "Oui. La consultation sert justement à clarifier votre situation, vos priorités et les options pertinentes selon votre profil."
  },
  {
    question: "Accompagnez-vous les étudiants internationaux ?",
    answer:
      "Oui. Nous accompagnons les projets d'études, de l'orientation au dossier de permis d'études, avec une préparation structurée."
  },
  {
    question: "Est-ce que les services sont personnalisés ?",
    answer:
      "Oui. Chaque parcours est différent. L'accompagnement est adapté à votre profil, votre objectif, votre calendrier et vos documents."
  },
  {
    question: "Puis-je vous contacter depuis l'extérieur du Canada ?",
    answer:
      "Oui. Les échanges peuvent se faire à distance par email, téléphone ou WhatsApp."
  }
];

export const contactMethods = [
  { icon: Phone, label: "Téléphone", value: brand.phone, href: `tel:${brand.phone.replaceAll(" ", "")}` },
  { icon: Mail, label: "Courriel", value: brand.email, href: `mailto:${brand.email}` },
  { icon: MapPinned, label: "Zone de service", value: "Canada et international", href: "/contact" }
];

export const process = [
  { icon: MessageCircle, title: "Échange initial", text: "Nous comprenons votre projet et vos priorités." },
  { icon: ClipboardCheck, title: "Évaluation", text: "Nous analysons les options adaptées à votre profil." },
  { icon: CheckCircle2, title: "Plan d'action", text: "Vous recevez une feuille de route claire et structurée." },
  { icon: Plane, title: "Accompagnement", text: "Nous vous aidons à avancer étape par étape." }
];

export const starIcon = Star;
