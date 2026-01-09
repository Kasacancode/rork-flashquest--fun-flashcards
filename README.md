Gamified Flashcards. Competitive Learning. Real Progress.

FlashQuest is a mobile learning app that turns flashcards into a competitive game. Instead of passive studying, users train decks, track stats, and enter head-to-head “duels” designed to reinforce recall under pressure.

Built with Expo + React Native + TypeScript, FlashQuest is structured for scalability, persistence, and future multiplayer expansion.

🚀 Core Features
📚 Deck-Based Learning

Create and train flashcard decks

Typed flashcard models for consistency and safety

Clean separation between data, logic, and UI

⚔️ Duel Arena (Game Mode)

Head-to-head flashcard challenges

Score-based outcomes (foundation for ranking systems)

Designed to simulate pressure and speed, not passive recall

📊 Player Stats

Track performance across decks and duels

Foundation for streaks, rankings, and progression systems

🎨 Theming & UI

Global theme context

Centralized color and style constants

Clean, mobile-first UI built with Expo

🧠 Philosophy

Most flashcard apps optimize for comfort.
FlashQuest optimizes for retention under pressure.

By introducing game mechanics (duels, stats, progression), FlashQuest pushes users to:

Recall faster

Think under constraint

Stay consistent through visible progress

🛠️ Tech Stack

Expo (React Native)

TypeScript

Expo Router (file-based navigation)

React Context (global state & theming)

ESLint + TSConfig (code quality & safety)

📁 Project Structure
app/                # Expo Router screens
components/         # Reusable UI components
context/            # Global state & theme providers
data/               # Sample decks and seed data
types/              # TypeScript domain models
constants/          # Colors, styles, app constants


The project is intentionally organized for scaling (persistence, backend, multiplayer).

▶️ Running the App Locally
# Install dependencies
npm install

# Start the Expo dev server
npx expo start


You can run the app on:

iOS Simulator

Android Emulator

Physical device via Expo Go

🧩 Current Status

Implemented

App structure & routing

Deck system (local/sample data)

Duel mode screens

Global state management

Typed flashcard models

In Progress / Planned

Local persistence (AsyncStorage / SQLite)

Formal duel scoring & ranking logic

User profiles & progression

Backend integration (auth + sync)

Multiplayer duels

🎯 Roadmap (Short-Term)

 Persist decks, stats, and progress locally

 Define duel win conditions & scoring rules

 Add streaks / rank indicators

 Improve onboarding & empty states

 Expand README with screenshots

👤 Author

Built by Caleb Mukasa
Economics & Data Science | Mobile Apps | Gamified Learning Systems
