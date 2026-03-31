I'm adding 3 new screens and updating several existing files to close critical feature gaps. Here's exactly what changed and why — please integrate these into the existing codebase.

---

## NEW FILES (3 screens)

### `app/settings.tsx`
A full Settings screen with toggles for dark mode, streak reminder notifications, haptic feedback, and usage analytics. Also includes a data summary section (custom deck count, total flashcards, study sessions, score), links to Privacy & Data and FAQ, and a "Clear All Data" destructive action. Themed consistently with the rest of the app using LinearGradient backgrounds and the existing ThemeContext.

### `app/edit-deck.tsx`  
A deck editor screen. Users can rename the deck, change its description, pick a new color from a 12-color swatch grid, search through cards by question/answer text, tap any card to open the card editor, or delete individual cards with confirmation. Custom decks also get a "Delete Deck" button. Receives `deckId` as a route param.

### `app/edit-flashcard.tsx`
An individual flashcard editor. Users can edit the question, answer, explanation, hint1, hint2, and difficulty (easy/medium/hard chip selector). Has an unsaved-changes guard that prompts before discarding edits. Includes a "Delete This Card" button. Receives `deckId` and `cardId` as route params.

---

## MODIFIED FILES

### `context/FlashQuestContext.tsx`
Added a `deleteFlashcard(deckId, cardId)` callback — this was missing from the context. It filters out the target card, runs normalization, and persists with the same optimistic-update + rollback pattern used by `updateFlashcard`. Added `deleteFlashcard` to both the return value and the dependency array of the useMemo.

### `utils/routes.ts`
Added 3 new route constants: `SETTINGS_ROUTE`, `EDIT_DECK_ROUTE`, `EDIT_FLASHCARD_ROUTE`. Added 2 new href helpers: `editDeckHref(deckId)` and `editFlashcardHref(deckId, cardId)`.

### `app/_layout.tsx`
Registered the 3 new Stack.Screen entries for `settings`, `edit-deck`, and `edit-flashcard` (all with `headerShown: false`).

### `app/deck-hub.tsx`
Added an "Edit Deck" option to the existing overflow menu (the ⋯ button). It appears above the existing "Duplicate Deck" option. Tapping it navigates to `/edit-deck?deckId=...`. Added `Pencil` to the lucide icon imports and `editDeckHref` to the route imports.

### `app/decks.tsx`
Added sort controls between the category filter pills and the deck list. Three options: "Newest" (default, by createdAt desc), "A–Z" (alphabetical), and "Most Cards" (by flashcard count desc). Added `sortBy` state, sorting logic inside the existing `filteredDecks` useMemo, sort chip UI with `ArrowUpDown` icon, and corresponding styles.

### `app/profile.tsx`
Added `handleOpenSettings` to the destructured values from `useProfileScreenState` and passes `onOpenSettings={handleOpenSettings}` to the `OverviewTab` component.

### `components/profile/OverviewTab.tsx`
Added an optional `onOpenSettings` prop. When provided, renders a "Settings" row with a gear icon and chevron, positioned after Privacy & Data and before the Flashcard Inspector (if visible). Added `Settings` to the lucide icon imports.

### `components/profile/useProfileScreenState.ts`
Imported `SETTINGS_ROUTE`. Added a `handleOpenSettings` callback that pushes to the settings route. Included it in the hook's return object.

---

## IMPORTANT NOTES
- All 3 new screens follow the same visual patterns as existing screens: LinearGradient background, SafeAreaView, consistent header with back button, themed surfaces using `isDark` conditional colors.
- The `deleteFlashcard` function uses the same `enqueuePersistenceTask` + `reconcileDeckCatalog` + `normalizeDeck` pipeline as all other deck mutations.
- The edit-flashcard screen calls the existing `updateFlashcard` context method — no new data layer was needed for updates.
- Sort state on the decks screen is session-only (resets on remount). This is intentional to keep it lightweight.
- The Settings screen reads/writes haptics and notification preferences to AsyncStorage under `flashquest_haptics_enabled` and `flashquest_notifications_enabled` keys.
- No new dependencies were added. Everything uses existing packages (expo-notifications, AsyncStorage, lucide-react-native, expo-linear-gradient, etc.).

Please review the CHANGELOG.md file for a structured breakdown of every change.
