# NeuroCalm & Fokus

> An offline-first productivity, focus, relaxation, breathing, and sleep application.

NeuroCalm & Fokus is a private, local-first web application designed to support mindful work, deep concentration, and nervous system recovery. Built on the philosophy that consistency matters more than intensity and that action precedes motivation, it provides a quiet, non-judgmental digital environment free from shame mechanics, streaks, and intrusive notifications.

---

## The Three Pillars

### 1. PLAN — Mindful Task & Schedule Organization
- **Structured Task Management:** Organize personal and professional tasks with clear priorities, categories, and deadlines.
- **Cognitive Workload Summary:** High-level metrics that encourage progress without pressure or penalty for unfinished items.
- **Smart Filtering:** Filter by status, priority, and timeframe to focus only on what matters next.

### 2. FOCUS — Distraction-Free Work & Study
- **Flexible Focus Timer:** Customizable session durations tailored to deep work or quick sprints.
- **Integrated Pomodoro System:** Configurable work/break intervals with gentle cycle indicators.
- **Task Association:** Anchor active focus sessions to specific tasks to reduce multitasking friction.
- **Session History:** Private, local logging of completed focus intervals.

### 3. RECOVER — Relaxation, Breathing & Sleep
- **Guided Breathing Exercises:** Clinically grounded breathing patterns (Box Breathing, 4-7-8, Resonant, Coherent) with an interactive visual orb and optional audio cues.
- **Ambient Soundscape Mixer:** High-fidelity multi-track audio player featuring:
  - *Nature sounds:* Rain, Stream, Ocean Waves
  - *Environment:* Ventilation Fan, Fireplace
  - *Traditional Instruments:* Dizi (笛子), Guqin (古琴), Guzheng (古筝), Xiao (簫)
  - *Synthetic Noise:* Real-time AudioWorklet white, pink, and brown noise generators.
- **Integrated Relaxation Sessions:** Harmonized music-and-breathwork pairings for nervous system decompression.
- **Sleep Preparation & Timer:** Evening wind-down routines, sleep schedules, and a multi-track audio fade-out sleep timer.

---

## Core Philosophy & Design

- **Private & Local-First:** All user data (tasks, focus logs, sleep routines, presets) resides entirely on your device in local browser storage. No accounts, no cookies, no tracking, and no third-party analytics.
- **Deterministic & AI-Free:** The application contains zero AI APIs, cloud chatbots, or algorithmic nudges. All features operate with deterministic local logic.
- **Calm, High-Contrast Aesthetics:** Designed with the *Deep Midnight Navy* palette, adhering to accessibility standards (WCAG contrast, keyboard navigation, reduced motion preferences).
- **Bilingual & RTL-Native:** Full English and Arabic localization with comprehensive Right-to-Left (RTL) layout switching.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.0.0 or higher recommended)
- `npm` (bundled with Node.js)

### Installation & Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Khaled-Ahmed/NeuroCalm-Fokus.git
   cd NeuroCalm-Fokus
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. **Run TypeScript verification:**
   ```bash
   npx tsc --noEmit
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

6. **Run tests:**
   ```bash
   npm test
   ```

---

## Optional Cloud Synchronization

NeuroCalm & Fokus is designed to be **100% functional offline by default**.

An optional cross-device synchronization architecture is included in the codebase under `supabase/migrations/`:
- 14 normalized PostgreSQL domain tables with Row Level Security (RLS).
- Transactional RPC mutation gateways (`sync_apply_batch`, `get_sync_changes`) with monotonic revision tracking and optimistic concurrency control.

### Current Implementation Status
> **Notice:** The cloud synchronization infrastructure is currently in **Offline Foundation (SYNC-1A)** status. The PostgreSQL schema migrations, stored procedures, and client adapters have been architected and locally validated, but cloud sync is **not yet tested against a live production Supabase instance**. Full end-to-end integration testing is scheduled for subsequent phases. The application currently operates in standalone offline-first mode.

### Setting Up Optional Sync (For Development)
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Populate `.env.local` with your Supabase project parameters:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your_publishable_anon_key
   ```
3. **Security Caution:** Never place a `service_role` key, database password, or secret token into `.env.local`. Client builds only accept the public publishable anon key. If these variables are left empty, the application seamlessly defaults to local storage.

---

## Audio Credits & Attributions

All ambient and instrumental soundscapes used in NeuroCalm & Fokus are conditioned from public domain (CC0) and Creative Commons (CC-BY 3.0, CC-BY 4.0) recordings by artists including ezwa, jackthemurray, Luftrum, Boštjan Troha, Glaneur de sons, xserra, and CarlosCarty.

Detailed license information, source links, and cryptographic file hashes are documented in `src/data/audioAttributions.json` and accessible within the app via the **Audio Credits** dialog.

---

## Copyright

Copyright © 2026 Khaled Ahmed. All rights reserved.
