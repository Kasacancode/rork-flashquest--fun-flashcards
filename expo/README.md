# FlashQuest

**Gamified flashcards with AI deck creation, spaced repetition, real-time multiplayer, and cloud sync.**

FlashQuest is a mobile study app that turns flashcards into a competitive game. Users train decks across four study modes, track mastery with a spaced repetition engine, earn XP through a 20-level progression system, challenge friends in real-time arena battles, and discover community decks on the marketplace.

Built with Expo SDK 54, React Native 0.81, and TypeScript. ~61,000 lines across 182 files.

## Features

### Four Study Modes

- **Study:** Flip-style card review with self-rated recall. Pre-session mode picker (All, Due, Quick 5/10/15, Weak Cards). Spaced repetition schedules reviews automatically. Card schedule list shows SRS status per card.
- **Quest:** Timed multiple-choice rounds in Learn mode (hints, no timer) or Test mode (no hints, timed, higher points). Drill missed cards after each round.
- **Practice:** Head-to-head against an adaptive AI opponent over 5 rounds. The AI adjusts difficulty to keep matches competitive.
- **Arena:** Real-time multiplayer. Create a room, share the code, and battle friends. Same questions, same timer, scored on speed and accuracy.

### AI Deck Creation

- **Scan Notes:** Take a photo of handwritten or printed notes and generate a full flashcard deck with AI.
- **Text to Deck:** Paste any text and extract key concepts into flashcards automatically.
- Both flows produce structured cards with questions, short answers, hints, and explanations. Users review, edit, add, or remove cards before saving.

### User Accounts and Cloud Sync

- Optional sign-in with Apple, Google, or email (guest mode works fully without an account)
- Automatic cloud sync of all data after study sessions and on app open
- Cross-device sync with last-write-wins conflict resolution
- Unique username system with real-time availability checking
- Profile with username display across all social features

### Community Marketplace

- **Explore:** Browse community decks with search, category filters, and sort (Popular, Top Rated, Newest)
- **Download:** One-tap download creates a local copy with all cards, hints, and explanations
- **Publish:** Share your decks with the community from the deck hub menu
- **Vote:** Thumbs up/down rating system with atomic vote counting
- Duplicate detection updates existing published decks instead of creating copies

### Global Leaderboard

- All Time and Weekly rankings by XP
- Crown/Medal icons for top 3 places
- Current user highlight with rank card
- Entry points from Stats header and Profile screen

### Spaced Repetition Engine

FSRS-inspired memory model tracking per-card stability, difficulty, and retrievability. Cards classified as new, learning, reviewing, mastered, or lapsed. Reviews scheduled based on forgetting curves.

### Progression System

- 20 levels across 5 rank bands (Foundation, Momentum, Established, Advanced, Prestige)
- 36 achievements across 8 categories
- Daily streaks with push notification reminders
- Daily goal with progress ring
- Weekly recap with trend indicators
- Deck mastery tracking with per-card breakdowns

### Deck Management

- 10 built-in sample decks (Geography, Science, Math, Languages, History, Art, Business, Technology, SAT Vocab, Biology)
- Manual card creation with question, answer, hints, explanation, and image fields
- CSV import with automatic header detection
- JSON backup/restore via system share sheet
- QR code deck sharing (up to 2500 characters)
- Shareable result cards via screenshot capture
- Category management with presets and custom categories

### Accessibility

- 101 maxFontSizeMultiplier annotations on game UI
- Reduce motion support (disables confetti, toasts, animations)
- 241 accessibility labels across interactive elements
- Sound effects with independent toggle
- Haptic feedback with independent toggle
- Dark mode with system preference detection

### Privacy

- Opt-in analytics with granular consent
- AI feature disclosure before first use
- Data privacy screen with full transparency
- Guest mode with all data stored locally on device

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 54, React Native 0.81 |
| Language | TypeScript 5.9 (strict) |
| Navigation | Expo Router 6 (file-based, typed routes) |
| State | React Context + TanStack React Query |
| Persistence | AsyncStorage with cloud sync and backup/restore |
| Backend | Supabase (PostgreSQL, Auth, Row Level Security) |
| Arena Backend | Hono + tRPC + Upstash Redis |
| AI | Rork AI Toolkit SDK (structured generation) |
| Auth | Apple Sign In (native), Google OAuth, Email/Password |
| UI | Custom components, Lucide icons, Expo Linear Gradient |
| Notifications | Expo Notifications (streak reminders, smart scheduling) |
| Build | EAS Build (development, preview, production profiles) |

## Project Structure

```
app/                    # 34 screens (Expo Router file-based routing)
backend/                # Server-side modules (arena engine, analytics, tRPC)
components/             # 52 reusable UI components
context/                # 7 providers (FlashQuest, Performance, Arena, Avatar, Privacy, Theme, Auth)
data/                   # 10 sample decks and dialogue text
lib/                    # Supabase client, tRPC client, analytics
types/                  # Domain models (flashcard, game, arena, performance, avatar)
utils/                  # 51 utility modules (mastery, levels, achievements, cloud sync, marketplace)
constants/              # Colors, categories, avatar identities, privacy config
```

## Getting Started

```bash
npm install
npx expo start
```

Run on iOS Simulator, Android Emulator, or a physical device with Expo Go.

## Author

Built by **Caleb Mukasa**
