# Apex Connect

Dark-mode health dashboard syncing Garmin Connect metrics, AI photo nutrition estimation, and dynamic weight-adjusted hydration tracking.

## Features

- **Daily Vitals** — Steps, resting HR, calories, SpO₂, respiration, stress
- **Recovery & Readiness** — Training readiness, body battery, HRV, sleep architecture, training load (acute / chronic / ratio)
- **Training** — Run/bike/swim pace, lactate threshold, cycling FTP, heat & altitude acclimation
- **Weight & Nutrition** — Weight logger, sweat-adjusted hydration, Gemini AI meal scanner

All metric cards open interactive 7-day trend modals powered by Recharts.

## Tech Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL)
- Recharts for data visualization
- Gemini 2.5 Flash for meal photo analysis
- Python `python-garminconnect` sync engine

## Setup

### 1. Install dependencies

```bash
npm install
pip install -r backend/requirements.txt
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

### 3. Run Supabase migration

Execute `supabase/schema.sql` in your Supabase SQL editor.

### 4. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Sync Garmin data

Click **Sync Garmin Data** on the Daily Vitals page, or run manually:

```bash
python backend/garmin_sync.py
```

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for server-side & Python sync) |
| `GARMIN_EMAIL` | Garmin Connect email |
| `GARMIN_PASSWORD` | Garmin Connect password |
| `GEMINI_API_KEY` | Google Gemini API key for meal analysis |

## Demo Mode

Without credentials configured, the app runs with realistic demo data so you can explore all features immediately.

## Lean Bulk Targets

- **Calories:** 2,600 kcal/day
- **Protein:** 140g/day
- **Base Weight:** 135 lbs
- **Hydration:** 30 mL per lb + workout sweat loss
