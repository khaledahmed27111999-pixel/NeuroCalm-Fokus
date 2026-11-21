# NeuroCalm & Fokus — Master Project Instructions

## Project Identity

Build **NeuroCalm & Fokus**, a private, offline-first personal productivity, focus, and relaxation web application.

The app is built around three pillars:

1. PLAN — organize tasks and schedules.
2. FOCUS — support distraction-free work and study.
3. RECOVER — support relaxation and recovery through breathing exercises and optional ambient audio.

The application must feel calm, elegant, lightweight, practical, and non-judgmental.

It is not a gamified productivity app. It must never shame users for unfinished tasks, missed sessions, low energy, or inconsistent routines.

## AI Policy

Do NOT implement AI features inside the application.

Do not integrate:
- AI APIs
- LLM APIs
- Chatbots
- AI-generated task plans
- Cloud AI services
- API keys
- External AI dependencies

All functionality must use deterministic local logic, conventional algorithms, browser APIs, and user-defined settings.

AI tools may be used during development to help write and inspect code, but the finished application itself must not depend on AI.

## Technical Requirements

Use:
- React
- Vite
- TypeScript
- Tailwind CSS
- Lucide icons

Prioritize:
- Modular architecture
- Maintainable code
- Strong TypeScript typing
- Small reusable components
- Separation of concerns
- Accessibility
- Responsive design
- Reliable state management
- Minimal dependencies

Do not introduce unnecessary libraries or architectural complexity.

## Privacy

The application must be local-first.

User data should remain on their device unless the user explicitly exports it.

No accounts, authentication, tracking, analytics services, cloud synchronization, or external APIs.

Use appropriate local storage mechanisms.

Provide user-controlled data export and import.

Clearly explain that locally stored browser data is not encrypted and may be accessible to other users of the same device/browser profile.

## Design System

Default theme: Deep Midnight Navy.

Suggested palette:

- Background: #0B1120
- Card: #1E293B
- Secondary Surface: #263449
- Border: #334155
- Primary Accent: #10B981
- Secondary Accent: #3B82F6
- Primary Text: #F8FAFC
- Secondary Text: #94A3B8

Support dark and light themes.

Use consistent spacing, typography, radii, visual hierarchy, and component styles.

Avoid excessive gradients, glowing effects, excessive animation, clutter, and unnecessary decoration.

The design should be modern and premium, but practical.

## Localization

Support Arabic and English.

Arabic must have proper RTL layout, not simply translated text.

Switching languages must correctly update:

- Text
- Layout direction
- Navigation
- Icons where directional
- Alignment
- Forms
- Dates
- Calendar presentation

Use a proper localization structure rather than scattered conditional strings.

## Accessibility

Support:

- Keyboard navigation
- Visible focus indicators
- Adequate contrast
- Reduced motion preferences
- Clear button labels
- Screen-reader-friendly controls
- Color-independent status indicators

Never rely on color alone.

## Core Philosophy

The application should help users return to what matters.

Action before motivation.

Incomplete tasks are better than zero action.

Consistency matters more than intensity.

Returning matters more than maintaining streaks.

Never use shame-based productivity mechanics.

## Development Workflow

Development MUST happen incrementally.

Never attempt to implement the entire application in one step.

For each development phase:

1. Inspect the current project.
2. Understand the existing architecture.
3. Identify the exact scope of the requested phase.
4. Present a short implementation plan.
5. Implement only the requested phase.
6. Run the build and available checks.
7. Inspect for errors and regressions.
8. Fix issues before declaring the phase complete.
9. Report what changed, what was tested, and any known limitations.

Do not unnecessarily rewrite working code from previous phases.

Do not add features that belong to future phases.

Do not silently replace libraries or architectural decisions.

Do not create mock functionality that appears functional but is not actually implemented.

Do not claim a feature has been tested if it has not.

Maintain a clear separation between:

- UI
- Business logic
- State management
- Persistence
- Browser APIs
- Audio engine
- Utilities

Keep the application functional and stable at the end of every phase.

If requirements are ambiguous, ask before making major architectural decisions.

**Current development phase must always be explicitly stated before implementation.**