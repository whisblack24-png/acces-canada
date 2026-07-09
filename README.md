# Accès Canada

Production-ready Next.js 15, TypeScript, Tailwind CSS, Framer Motion, and Lucide React website for Accès Canada.

## Run locally

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000`.

## Brand

- Navy Blue: `#0B1D36`
- Gold: `#D4AF37`
- White
- Canadian Red: `#C8102E`

## Pages

- Home
- About
- Services
- Process
- FAQ
- Contact

## Assets

- Logo: `public/images/logo.png`
- Skyline hero: `public/images/canada-skyline.png`

## Production Vercel

Configure all variables from `.env.example` in Vercel for Production, Preview, and Development as needed.

For the future custom domain, set:

```bash
NEXT_PUBLIC_SITE_URL=https://your-custom-domain.com
```

Then add the domain in Vercel under Project Settings > Domains and follow the DNS instructions shown by Vercel.

Never commit `.env.local`; keep Supabase service role keys, Gmail app passwords, and session secrets only in Vercel environment variables.
