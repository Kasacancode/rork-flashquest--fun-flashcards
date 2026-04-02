# iOS Home Screen Widget Setup

FlashQuest includes a widget data bridge on the React Native side. The app now writes widget-ready data after study sessions to `flashquest_widget_data`. To turn that into a real iOS home screen widget, add a native Widget Extension during your first iOS build setup.

## Prerequisites

- Apple Developer account
- A generated iOS project you can open in Xcode
- An App Group you control, such as `group.net.flashquest.app`

## Architecture

The app writes this JSON shape from React Native:

```json
{
  "currentStreak": 0,
  "longestStreak": 0,
  "totalCardsStudied": 0,
  "totalScore": 0,
  "level": 1,
  "dueCardCount": 0,
  "lastStudiedDate": "2026-04-02",
  "updatedAt": "2026-04-02T12:00:00.000Z"
}
```

Today that data is stored in AsyncStorage as `flashquest_widget_data`. When you add the native widget, switch the bridge to shared App Group storage so both the app and widget can read the same payload.

## Step 1: Add an App Group

In the Apple Developer portal:

1. Open **Certificates, Identifiers & Profiles**
2. Create an App Group named `group.net.flashquest.app`
3. Attach it to the main app ID and the future widget extension ID

## Step 2: Create the Widget Extension

After generating the iOS project and opening it in Xcode:

1. Choose **File > New > Target**
2. Add a **Widget Extension** target
3. Name it `FlashQuestWidget`
4. Enable the same App Group on both the main app target and the widget target

## Step 3: Replace the Generated SwiftUI File

Use this SwiftUI widget implementation:

```swift
import WidgetKit
import SwiftUI

struct FlashQuestEntry: TimelineEntry {
    let date: Date
    let streak: Int
    let dueCards: Int
    let level: Int
    let totalScore: Int
}

struct Provider: TimelineProvider {
    let appGroupId = "group.net.flashquest.app"

    func placeholder(in context: Context) -> FlashQuestEntry {
        FlashQuestEntry(date: Date(), streak: 0, dueCards: 0, level: 1, totalScore: 0)
    }

    func getSnapshot(in context: Context, completion: @escaping (FlashQuestEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FlashQuestEntry>) -> Void) {
        let entry = readEntry()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }

    private func readEntry() -> FlashQuestEntry {
        guard let defaults = UserDefaults(suiteName: appGroupId),
              let jsonString = defaults.string(forKey: "flashquest_widget_data"),
              let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return FlashQuestEntry(date: Date(), streak: 0, dueCards: 0, level: 1, totalScore: 0)
        }

        return FlashQuestEntry(
            date: Date(),
            streak: json["currentStreak"] as? Int ?? 0,
            dueCards: json["dueCardCount"] as? Int ?? 0,
            level: json["level"] as? Int ?? 1,
            totalScore: json["totalScore"] as? Int ?? 0
        )
    }
}

struct FlashQuestWidgetEntryView: View {
    var entry: FlashQuestEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("FlashQuest")
                    .font(.caption2)
                    .fontWeight(.heavy)
                    .foregroundColor(.secondary)
                Spacer()
                Text("Lv \(entry.level)")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(.purple)
            }

            Spacer()

            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(entry.streak)")
                        .font(.title)
                        .fontWeight(.heavy)
                    Text("day streak")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                if entry.dueCards > 0 {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(entry.dueCards)")
                            .font(.title)
                            .fontWeight(.heavy)
                            .foregroundColor(.orange)
                        Text("cards due")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding()
    }
}

@main
struct FlashQuestWidget: Widget {
    let kind = "FlashQuestWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            FlashQuestWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("FlashQuest")
        .description("Your streak and cards due for review.")
        .supportedFamilies([.systemSmall])
    }
}
```

## Step 4: Move the Bridge to Shared App Group Storage

Once the App Group exists, replace the AsyncStorage write in `utils/widgetBridge.ts` with a shared storage bridge. A small native module is the simplest approach. The React Native side should write the same JSON string to the App Group key `flashquest_widget_data`.

Example target behavior:

```typescript
const json = JSON.stringify(data);
await SharedGroupPreferences.setItem('flashquest_widget_data', json, 'group.net.flashquest.app');
```

## Step 5: Refresh Widget Timelines

After writing widget data, trigger a widget refresh from native code so updates appear faster than the 30-minute timeline window.

Expected native call shape:

```typescript
NativeModules.WidgetModule?.reloadAllTimelines();
```

## Data Source Notes

The current bridge writes these fields after every recorded study session:

- `currentStreak`
- `longestStreak`
- `totalCardsStudied`
- `totalScore`
- `level`
- `dueCardCount`
- `lastStudiedDate`
- `updatedAt`

`dueCardCount` is currently written as `0` from the shared session recorder. If you want live due counts in the widget, update the bridge from a screen or provider that already computes due cards and write the same payload again.
