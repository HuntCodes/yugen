# Project Overview

This is an AI-powered run club app for On. Users choose their coach (Craig, Thomas, Dathan), complete a smart, adaptive onboarding chat, then receive weekly-updated, personalized training plans. They chat with their AI coach to adjust training, log feedback, and get contextual gear recommendations.

## Key Technologies

- **Cursor** – AI coding assistant and editor
- **Expo Go** – Mobile testing environment
- **Supabase** – Auth, database, and edge functions
- **NativeWind** – Tailwind-like styling for React Native
- **OpenAI (GPT-3.5 Turbo)** – Conversational coaching logic

## Architecture Principles

- Modular, domain-driven codebase
- Stateless UI where possible (Supabase + hooks hold state)
- All persistent user data stored in Supabase
- GPT uses structured, context-aware prompts and JSON responses
- Clean separation between:
  - Prompt logic
  - Data parsing
  - UI interaction

---

# 🧠 AI Design System

## Conversational Onboarding
- Fully adaptive chat with background parsing
- Extracts core athlete data into `profiles` table
- Conversation feels natural — not like a form
- Coach style and tone persist through the onboarding and into daily coaching

## Daily Chat
- Coach tone and communication style persist
- Chat summaries stored and referenced for future planning
- Context window populated with:
  - User profile data
  - Recent chat + workout summaries
  - Plan metadata
- JSON response includes both message and extracted info

## Plan Generation
- Weekly adaptive training plans
- Plans consider:
  - Race date & goal
  - Current mileage/frequency
  - Athlete experience level
  - Prior summaries (chat, feedback)
- Future: dynamic plan adjustments based on feedback

---

# 💾 Data Architecture

## Supabase Tables
- `profiles`: user details (name, units, mileage, constraints, etc.)
- `summaries`: chat + workout summaries
- `plans`: weekly plan data (type, distance, notes)
- `messages`: chat history (optional long-term storage)

## Parsing Functions
- Format user onboarding responses
- Summarize past conversations and workouts
- Store summaries with timestamps for lightweight memory

---

# 🎯 MVP Feature Set

1. Supabase Auth (email & Google)
2. Smart, conversational onboarding flow
3. Persistent AI chat (coaching + feedback)
4. Weekly, adaptive training plan
5. Context-aware On gear suggestions
6. Basic user preference handling (coach tone, style)
7. Lightweight history-based chat memory via Supabase

---

# 📁 Dev Guidelines

### 🧱 Code Structure
- `/components`: UI components by domain (`chat`, `coach`, `ui`, etc.)
- `/hooks`: Custom hooks, split by purpose
- `/services`: All Supabase & API access
- `/lib`: Utilities and parsing logic
- `/screens`: Full app views/screens
- `/types`: Type definitions per domain
- `/data`: Static files (e.g. coach style configs, constants)

### ✅ Coding Conventions
- Every screen uses custom hooks (no inline logic)
- Keep files under 350 lines
- Abstract duplicate logic across onboarding, chat, and plans
- Use `index.ts` for clean imports (barrel files)
- Tailwind-only styling via NativeWind (no inline styles)
- JSDoc comments for complex functions/components

### 📄 Docs & Maintainability
- Every folder must have a `README.md` for onboarding
- Keep text (e.g. coach phrases, tone) centralized
- Shared logic (e.g. formatting, summarizing, parsing) lives in `/lib`

---

# ✅ Refactor Checklist

- [x] Coach tone & style persist across all chat interactions
- [x] Onboarding uses GPT parsing to store structured profile info
- [x] Summaries of chats + workouts stored and reused
- [x] Supabase handles all persistent storage
- [x] Data access abstracted into `services/`
- [x] UI styled only with NativeWind
- [x] File structure follows domain-driven design
- [x] Prompt system reduced for token efficiency

