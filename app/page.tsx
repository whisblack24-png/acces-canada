
import Image from "next/image";
export default function Home() {
return (
<main className="bg-white">
<section className="relative h-screen">
<Image
src="/images/canada-skyline.png"
alt="Toronto"
fill
priority
className="object-cover"
/>
<div className="absolute inset-0 bg-black/60" />
<div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
<Image
src="/images/logo.png"
alt="Accès Canada"
width={140}
height={140}
className="mb-8 rounded-3xl"
/>
<h1 className="text-6xl font-black text-white">
Votre passerelle vers le Canada
</h1>
<p className="mt-6 max-w-3xl text-xl text-white">
Cabinet professionnel spécialisé en immigration, études,
permis de travail et accompagnement vers le Canada.
</p>
<div className="mt-10 flex gap-5">
<button className="rounded-full bg-yellow-400 px-8 py-4 font-bold">
Consultation
</button>
<button className="rounded-full border-2 border-white px-8 py-4 font-bold text-white">
Nos services
</button>
</div>
</div>
</section>
<section className="py-20">
<div className="mx-auto max-w-6xl px-6">
<h2 className="mb-10 text-center text-4xl font-bold">
Nos services
</h2>
<div className="grid gap-6 md:grid-cols-4">
{[
["Études", "Admission dans les universités canadiennes"],
["Travail", "Permis de travail et carrière"],
["Immigration", "Résidence permanente"],
["Installation", "Accompagnement avant et après arrivée"],
].map(([title, text]) => (
<div key={title} className="rounded-2xl border p-6 shadow">
<h3 className="mb-3 text-xl font-bold">{title}</h3>
<p>{text}</p>
</div>

))}
</div>
</div>
</section>
<footer className="bg-slate-900 py-12 text-center text-white">
<h3 className="text-2xl font-bold">Accès Canada</h3>
<p className="mt-3">+1 819 266 8420</p>
<p>accesc625@gmail.com</p>
</footer>
</main>
);
}