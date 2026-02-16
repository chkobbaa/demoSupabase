# 🌊 HabitFlow — Supabase DevContainer Demo

A habit tracking web app built with **Supabase** (Auth + PostgreSQL + RLS) inside a **DevContainer**.

![Stack](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)
![Stack](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Stack](https://img.shields.io/badge/DevContainer-VS%20Code-007ACC?logo=visualstudiocode)

## Features

- 🔐 **Authentication** — Sign up / Sign in with Supabase Auth
- 📋 **CRUD Habits** — Create, toggle, delete habits with emoji & color
- 📊 **Stats Dashboard** — Habit count, daily progress, best streak
- 🟩 **Activity Heatmap** — GitHub-style 60-day calendar view
- 🔒 **Row Level Security** — Each user sees only their own data
- 📦 **DevContainer** — One-click dev environment in VS Code

## Architecture

```
Browser  ──►  Supabase Auth  (login / signup)
         ──►  Supabase DB    (habits, habit_logs tables)
                  ▲
                  │ Row Level Security policies
                  │ auth.uid() = user_id
```

## Quick Start

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste the contents of `supabase/schema.sql`
3. Run the SQL to create tables + RLS policies
4. Copy your **Project URL** and **anon public key** from Settings > API

### 2. Configure

Edit `public/config.js` and replace the placeholders:

```js
const SUPABASE_URL = "https://xxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGci...";
```

### 3. Run

**With DevContainer (recommended):**
- Open in VS Code → "Reopen in Container"
- Dependencies install automatically
- Run `npm run dev`

**Without DevContainer:**
```bash
npm install
npm run dev
```

Open http://localhost:3000

## Supabase Local (inside DevContainer)

After reopening in the DevContainer:

1. Initialize Supabase local config (first time only)
    - `npm run supabase:init`
2. Start local Supabase stack
    - `npm run supabase:start`
3. Check local URLs and anon key
    - `npm run supabase:status`
4. Stop stack when done
    - `npm run supabase:stop`

Use local credentials for the frontend by updating `public/config.js` with values from `supabase status`:

```js
const SUPABASE_URL = "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = "<anon key from supabase status>";
```

Studio is available at `http://127.0.0.1:54323`.

## Project Structure

```
├── .devcontainer/
│   └── devcontainer.json     # DevContainer config (Node 22)
├── public/
│   ├── index.html            # Single-page app
│   ├── style.css             # Dark theme UI
│   ├── app.js                # Auth, CRUD, heatmap logic
│   └── config.js             # Supabase credentials
├── supabase/
│   └── schema.sql            # Tables + RLS policies
├── server.js                 # Express static server
└── package.json
```

## Key Supabase Concepts Demonstrated

| Concept | Where |
|---------|-------|
| `supabase.auth.signUp()` | Auth screen |
| `supabase.auth.signInWithPassword()` | Auth screen |
| `supabase.auth.onAuthStateChange()` | Session management |
| `supabase.from().insert()` | Creating habits/logs |
| `supabase.from().select()` | Reading data |
| `supabase.from().delete()` | Removing habits/logs |
| Row Level Security | `schema.sql` policies |
