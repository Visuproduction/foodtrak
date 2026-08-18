# FoodTrak

Solution SaaS B2B ultra-légère de prise de commande, gestion de file d'attente, carte et fidélité pour food-trucks.

## Stack

- **Next.js 15** (App Router, Server Actions, React 19)
- **Supabase** (PostgreSQL, Auth, Realtime, Storage)
- **Vercel** (déploiement + cron RGPD)
- **Tailwind CSS + Shadcn UI**

## Structure du projet

```
foodtrak/
├── src/
│   ├── app/
│   │   ├── [merchantSlug]/          # Web-app client (menu, checkout, suivi)
│   │   │   ├── page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   └── track/page.tsx
│   │   ├── admin/
│   │   │   ├── login/page.tsx
│   │   │   └── (dashboard)/         # KDS, menu, settings (auth requise)
│   │   │       ├── layout.tsx
│   │   │       ├── kds/page.tsx
│   │   │       ├── menu/page.tsx
│   │   │       └── settings/page.tsx
│   │   └── api/cron/purge-data/     # Purge RGPD horaire
│   ├── actions/orders.ts            # Server Actions
│   ├── components/
│   │   ├── client/                  # Menu, checkout, tracker
│   │   ├── admin/                   # KDS, menu manager, settings
│   │   └── ui/                      # Shadcn
│   ├── hooks/use-realtime.ts        # Supabase Realtime
│   ├── lib/
│   │   ├── slotCalculator.ts        # Algorithme créneaux
│   │   ├── supabase/                # Clients SSR / browser / service
│   │   └── utils.ts
│   └── types/database.ts
├── supabase/migrations/
│   └── 001_initial_schema.sql       # Tables, RLS, Realtime, Storage
├── .env.example
├── vercel.json                      # Cron purge RGPD
└── package.json
```

## Installation

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Supabase

Projet dédié **FoodTrak** (indépendant de Komback) :
https://supabase.com/dashboard/project/dcirmugdwswurxaexieu

Le schéma est déjà appliqué. Créez un compte commerçant via `/admin/login`, ou liez un user Auth :

```sql
UPDATE merchants
SET user_id = '<uuid-auth-user>'
WHERE slug = 'demo-truck';
```

## Déploiement Vercel

1. Importer le repo sur Vercel
2. Configurer les variables d'environnement (voir `.env.example`)
3. Le cron `/api/cron/purge-data` s'exécute toutes les heures

## URLs

| Route | Description |
|-------|-------------|
| `/demo-truck` | Menu client |
| `/demo-truck/checkout` | Checkout express |
| `/demo-truck/track` | Suivi Realtime |
| `/admin/kds` | Écran cuisine |
| `/admin/menu` | Gestion carte |
| `/admin/settings` | Configuration |

## Architecture

```
Client (0 auth)          Admin (Supabase Auth)
     │                          │
     ▼                          ▼
Next.js Server Actions ──► Supabase PostgreSQL
     │                          │
     ▼                          ▼
Supabase Realtime ◄────── KDS + Menu + Tracker
```
