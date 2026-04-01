Bug fix: the haptics toggle in Settings is decorative — toggling it off has no effect. All 24 haptic calls across 10 files fire unconditionally. This change makes them respect the user's preference.

---

## NEW FILE

### `utils/haptics.ts`

A thin wrapper around `expo-haptics` that checks the user's preference before firing. Two exported functions:

- `triggerImpact(style?)` — replaces `Haptics.impactAsync(style)`
- `triggerNotification(type)` — replaces `Haptics.notificationAsync(type)`

Both read the `flashquest_haptics_enabled` AsyncStorage key (the same key Settings already writes to), cache the result in memory so subsequent calls have zero overhead, and skip execution on web. Also exports `setHapticsEnabled(boolean)` for Settings to call when the user toggles, keeping the cache in sync.

Re-exports `ImpactFeedbackStyle` and `NotificationFeedbackType` from `expo-haptics` so callers don't need to import from two places.

Place this file at `utils/haptics.ts`. The full file contents are attached.

---

## MODIFIED FILES — 10 files, same mechanical change in each

The pattern for every file is:

1. **Remove** `import * as Haptics from 'expo-haptics';`
2. **Add** `import { triggerImpact, triggerNotification, ImpactFeedbackStyle, NotificationFeedbackType } from '@/utils/haptics';` (only import the symbols actually used in that file)
3. **Replace** every `Haptics.impactAsync(...)` call with `triggerImpact(...)`
4. **Replace** every `Haptics.notificationAsync(...)` call with `triggerNotification(...)`
5. **Replace** `Haptics.ImpactFeedbackStyle.X` with `ImpactFeedbackStyle.X`
6. **Replace** `Haptics.NotificationFeedbackType.X` with `NotificationFeedbackType.X`
7. **Remove** any `Platform.OS !== 'web'` guard that wraps a haptic call — the utility handles this internally

Here is every file and what to replace:

### `components/StudyFeed.tsx`
- Remove `import * as Haptics from 'expo-haptics';`
- Add `import { triggerImpact } from '@/utils/haptics';`
- The existing `triggerHaptic` callback wraps `Haptics.impactAsync` with a Platform check. Replace the entire callback body:
  ```ts
  const triggerHaptic = useCallback(() => {
    triggerImpact();
  }, []);
  ```

### `components/GameUI.tsx`
- Remove `import * as Haptics from 'expo-haptics';`
- Add `import { triggerImpact } from '@/utils/haptics';`
- 3 call sites, all identical pattern. Replace each:
  ```
  // before
  if (Platform.OS !== 'web') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  // after
  triggerImpact();
  ```
- Remove the `Platform` import if it's no longer used elsewhere in the file.

### `components/AchievementToast.tsx`
- Remove `import * as Haptics from 'expo-haptics';`
- Add `import { triggerNotification, NotificationFeedbackType } from '@/utils/haptics';`
- Replace: `void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);`
- With: `triggerNotification(NotificationFeedbackType.Success);`

### `components/AnswerCard.tsx`
- Remove `import * as Haptics from 'expo-haptics';`
- Add `import { triggerImpact, ImpactFeedbackStyle } from '@/utils/haptics';`
- Replace the Platform-guarded block:
  ```
  // before
  if (Platform.OS !== 'web') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
  // after
  triggerImpact(ImpactFeedbackStyle.Medium);
  ```
- Remove the `Platform` import if it's no longer used elsewhere in the file.

### `components/LevelUpToast.tsx`
- Remove `import * as Haptics from 'expo-haptics';`
- Add `import { triggerNotification, NotificationFeedbackType } from '@/utils/haptics';`
- Replace: `void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);`
- With: `triggerNotification(NotificationFeedbackType.Success);`

### `components/DeckMasteryToast.tsx`
- Remove `import * as Haptics from 'expo-haptics';`
- Add `import { triggerNotification, NotificationFeedbackType } from '@/utils/haptics';`
- Replace: `void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);`
- With: `triggerNotification(NotificationFeedbackType.Success);`

### `app/arena-results.tsx`
- Remove `import * as Haptics from 'expo-haptics';`
- Add `import { triggerImpact, triggerNotification, ImpactFeedbackStyle, NotificationFeedbackType } from '@/utils/haptics';`
- Replace 3 calls:
  - `void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` → `triggerNotification(NotificationFeedbackType.Success)`
  - `void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` → `triggerImpact(ImpactFeedbackStyle.Medium)`
  - `void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` → `triggerImpact(ImpactFeedbackStyle.Light)`

### `app/arena-session.tsx`
- Remove `import * as Haptics from 'expo-haptics';`
- Add `import { triggerNotification, NotificationFeedbackType } from '@/utils/haptics';`
- Replace 2 calls:
  - `void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` → `triggerNotification(NotificationFeedbackType.Success)`
  - The multi-line ternary:
    ```
    // before
    void Haptics.notificationAsync(
      lastAnswerCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
    // after
    triggerNotification(lastAnswerCorrect ? NotificationFeedbackType.Success : NotificationFeedbackType.Error);
    ```

### `app/quest-session.tsx`
- Remove `import * as Haptics from 'expo-haptics';`
- Add `import { triggerImpact, triggerNotification, ImpactFeedbackStyle, NotificationFeedbackType } from '@/utils/haptics';`
- Replace 5 calls:
  - `void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)` → `triggerNotification(NotificationFeedbackType.Error)` (2 occurrences)
  - `void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` → `triggerNotification(NotificationFeedbackType.Success)`
  - `void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` → `triggerImpact(ImpactFeedbackStyle.Medium)`
  - `void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` → `triggerImpact(ImpactFeedbackStyle.Light)`

### `app/practice-session.tsx`
- Remove `import * as Haptics from 'expo-haptics';`
- Add `import { triggerNotification, NotificationFeedbackType } from '@/utils/haptics';`
- Replace 6 calls, all are `notificationAsync` with ternary or direct type:
  - `void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)` → `triggerNotification(NotificationFeedbackType.Error)` (3 occurrences)
  - `void Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error)` → `triggerNotification(correct ? NotificationFeedbackType.Success : NotificationFeedbackType.Error)` (3 occurrences)

---

## ONE MORE CHANGE: `app/settings.tsx`

Settings needs to notify the utility when the user toggles, so the in-memory cache stays current.

- Add `import { setHapticsEnabled } from '@/utils/haptics';` to the imports.
- In the `handleToggleHaptics` callback, add one line:
  ```ts
  const handleToggleHaptics = useCallback((value: boolean) => {
    setHapticsEnabled(value);          // ← add this line
    setHapticsEnabled(value);          // existing local state setter — note this is React's setHapticsEnabled, not the import. Rename to avoid collision — see below.
    void AsyncStorage.setItem(HAPTICS_KEY, String(value));
  }, []);
  ```

**Important:** the local state setter from `useState` is also called `setHapticsEnabled`. To avoid the name collision, import the utility function with an alias:
  ```ts
  import { setHapticsEnabled as syncHapticsPreference } from '@/utils/haptics';
  ```
  Then call `syncHapticsPreference(value);` inside `handleToggleHaptics`.

---

## WHAT NOT TO CHANGE

- `expo-haptics` stays in `package.json` — the utility imports it.
- The `HAPTICS_KEY` constant in `settings.tsx` stays — Settings still reads/writes AsyncStorage directly for its own UI state. The utility reads the same key independently.
- No changes to any other files. The study SRS ordering, category guards, and edit-deck menu are all untouched.
