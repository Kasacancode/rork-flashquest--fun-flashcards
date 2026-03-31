# FlashQuest — Updates Changelog

## New Screens

### `/settings` — Settings Screen
Full settings page accessible from Profile → Overview → Settings. Includes:
- **Dark mode toggle** (mirrors the existing profile toggle for consistency)
- **Streak reminder notifications** toggle with system permission detection
- **Haptic feedback** toggle (persisted to AsyncStorage)
- **Usage analytics** toggle (wired to existing PrivacyContext)
- **Privacy & Data** deep link
- **FAQ** deep link
- **Data summary** — custom deck count, total flashcards, study sessions, total score
- **Clear All Data** — destructive action with confirmation dialog
- **App version and author credit**

### `/edit-deck` — Edit Deck Screen
Deck management screen accessible from Deck Hub → menu → "Edit Deck". Includes:
- **Rename deck** — inline editable name and description fields
- **Change deck color** — 12-color swatch picker
- **Card search** — filter cards by question or answer text
- **Card list** — tap any card to edit, swipe/tap trash to delete
- **Add Card** button — links to existing create-flashcard screen
- **Delete Deck** — destructive action for custom decks

### `/edit-flashcard` — Edit Flashcard Screen
Individual card editor accessible from Edit Deck → tap a card. Includes:
- **Edit question** (multiline, 500 char limit)
- **Edit answer** (200 char limit)
- **Edit explanation** (optional, multiline)
- **Edit hints** (hint 1 and hint 2)
- **Difficulty selector** — Easy / Medium / Hard chip picker
- **Unsaved changes guard** — confirmation dialog on back navigation
- **Delete card** — destructive action with confirmation
- **Deck context pill** — shows which deck the card belongs to

## Modified Files

### `context/FlashQuestContext.tsx`
- Added `deleteFlashcard(deckId, cardId)` method — removes a single flashcard from a deck with optimistic cache update and rollback on failure
- Added `deleteFlashcard` to the context return value

### `utils/routes.ts`
- Added `SETTINGS_ROUTE`, `EDIT_DECK_ROUTE`, `EDIT_FLASHCARD_ROUTE` constants
- Added `editDeckHref(deckId)` and `editFlashcardHref(deckId, cardId)` helper functions

### `app/_layout.tsx`
- Registered `settings`, `edit-deck`, and `edit-flashcard` Stack.Screen entries

### `app/deck-hub.tsx`
- Added "Edit Deck" option to the overflow menu (⋯ button)
- Added `Pencil` icon import
- Imported `editDeckHref` route helper

### `app/decks.tsx`
- Added **sort controls** (Newest / A–Z / Most Cards) between category filters and deck list
- Sort state persists within session
- Added `ArrowUpDown` icon and `sortRow`, `sortChip`, `sortChipText` styles

### `app/profile.tsx`
- Added `handleOpenSettings` to destructured hook values
- Passes `onOpenSettings` prop to `OverviewTab`

### `components/profile/OverviewTab.tsx`
- Added optional `onOpenSettings` prop
- Renders a "Settings" row with gear icon linking to `/settings`
- Added `Settings` icon import

### `components/profile/useProfileScreenState.ts`
- Imported `SETTINGS_ROUTE`
- Added `handleOpenSettings` callback
- Included `handleOpenSettings` in return value
