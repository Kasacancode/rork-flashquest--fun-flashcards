# FlashQuest

**Gamified flashcards with AI deck creation, spaced repetition, and real-time multiplayer battles.**

FlashQuest is a mobile study app that turns flashcards into a competitive game. Instead of passive review, users train decks across four distinct modes, track mastery with a spaced repetition engine, earn XP through a 20-level progression system, and challenge friends in real-time arena battles.

Built with Expo, React Native, and TypeScript. ~49,000 lines across 150 files.

## Features

### Four Study Modes

- **Study:** Flip through cards at your own pace. Rate your recall, view hints and explanations, and let the spaced repetition engine schedule reviews automatically.
- **Quest:** Timed multiple-choice rounds. Choose Learn mode (hints on, no timer) or Test mode (no hints, timed, higher points). Drill missed cards after each round.
- **Practice:** Head-to-head against an adaptive AI opponent over 5 rounds. The AI adjusts to your skill level to keep matches competitive.
- **Arena:** Real-time multiplayer. Create a room, share the code, and battle a friend. Same questions, same timer. Scores based on speed and accuracy.

### AI Deck Creation

- **Scan Notes:** Take a photo of handwritten or printed notes and generate a full flashcard deck with AI.
- **Text to Deck:** Paste any text (notes, articles, study guides) and extract key concepts into flashcards automatically.
- Both flows produce structured cards with questions, short answers, and explanations. Users can review, edit, add, or remove cards before saving.

### Spaced Repetition Engine

FSRS-inspired memory model that tracks per-card stability, difficulty, and retrievability. Cards are classified as new, learning, reviewing, mastered, or lapsed. The engine schedules reviews based on forgetting curves, not fixed intervals.

### Progression System

- **20 levels** across 5 rank bands (Foundation, Momentum, Established, Advanced, Prestige)
- **36 achievements** across 8 categories (Study, Streaks, XP, Battle, Quest, Accuracy, Building, Collection)
- **Daily streaks** with push notification reminders
- **Deck mastery tracking** with per-card and per-deck breakdowns
- **Weekly accuracy trends** and study activity heatmaps

### Deck Management

- 8 built-in sample decks across all categories (Geography, Technology, Languages, Science, History, Math, Art, Business)
- Manual card creation with question, answer, hints, and explanation fields
- Deck import/export via clipboard (share decks as encoded text)
- Category management with presets and custom categories
- Deck duplication, editing, hiding, and deletion

### Multiplayer Arena (Backend)

- Real-time game engine with Redis-backed room state
- Room creation, join-by-code, and deep link support (`flashquest://join/{code}`)
- Lobby system with player presence, heartbeats, and disconnect detection
- Configurable round count, timer settings, and deck selection
- Post-game leaderboard with battle history

### Privacy and Analytics

- Opt-in analytics with granular consent management
- AI feature disclosure prompts before first use
- Data privacy screen with full transparency into what is collected
- All user data stored locally on device (no account required)

### Polish

- Full dark mode with system preference detection
- Haptic feedback throughout (configurable)
- Guided onboarding with interactive tutorial, category selection, and profile setup
- First-visit contextual education cards on Quest, Practice, and Arena screens
- In-app FAQ covering all features and modes
- Content normalization pipeline for consistent card display across all surfaces
- Store review prompting after engagement milestones
- Offline detection banner
- Error boundaries with recovery

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 54, React Native 0.81 |
| Language | TypeScript 5.9 (strict) |
| Navigation | Expo Router 6 (file-based, typed routes) |
| State | React Context + TanStack React Query |
| Persistence | AsyncStorage with backup/restore |
| Backend | Hono + tRPC + Upstash Redis |
| AI | Rork AI Toolkit SDK (structured generation with Zod schemas) |
| Analytics | Custom event pipeline with batched tRPC submission |
| UI | Custom components, Lucide icons, Expo Linear Gradient |
| Notifications | Expo Notifications (streak reminders) |
| Build | EAS Build (development, preview, production profiles) |

## Project Structure

```
app/                    # 29 screens (Expo Router file-based routing)
  index.tsx             # Home screen with recommendations and stats
  onboarding.tsx        # 4-step guided onboarding flow
  study.tsx             # Spaced repetition study mode
  quest.tsx             # Multiple-choice quiz configuration
  quest-session.tsx     # Active quest gameplay
  practice.tsx          # AI opponent mode selection
  practice-session.tsx  # Active practice gameplay
  arena.tsx             # Multiplayer hub (create/join rooms)
  arena-lobby.tsx       # Pre-game lobby with settings
  arena-session.tsx     # Active arena gameplay
  decks.tsx             # Deck library with search and filters
  deck-hub.tsx          # Per-deck overview with mastery stats
  scan-notes.tsx        # Camera/gallery AI deck generation
  text-to-deck.tsx      # Text input AI deck generation
  stats.tsx             # Full statistics dashboard
  profile.tsx           # Player profile with awards and avatar
  settings.tsx          # App preferences and data management
backend/                # 14 server-side modules
  arena/                # Game engine, room repository, deck service
  analytics/            # Event ingestion and aggregation
  trpc/                 # Router definitions and context
components/             # 47 reusable UI components
context/                # 6 providers (FlashQuest, Performance, Arena, Avatar, Privacy, Theme)
data/                   # Sample decks and dialogue text
types/                  # Domain models (flashcard, game, arena, performance, avatar)
utils/                  # 31 utility modules (mastery, levels, achievements, content normalization)
constants/              # Colors, categories, avatar identities, privacy config
```

## Getting Started

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start
```

Run on iOS Simulator, Android Emulator, or a physical device with Expo Go.

### Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Build for iOS TestFlight
eas build --profile preview --platform ios

# Build for Android internal testing
eas build --profile preview --platform android

# Production build for store submission
eas build --profile production --platform all
```

## Author

Built by **Caleb Mukasa**
Economics & Data Science | Mobile Development | Gamified Learning Systems
