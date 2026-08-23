# Gathr — native app push (Android / iOS)

The web app uses Firebase Cloud Messaging in the browser. Wrapped native builds
use Capacitor's push plugin, which talks to the OS notification system directly.
Both store their device token in the `push_tokens` table with a `platform` tag
(`web` / `android` / `ios`), and the server picks the right delivery payload.

## Build the Android app

```bash
npm run build            # or: bun run build
npx cap add android      # first time only
npx cap sync android
npx cap open android     # opens Android Studio → Run
```

Requirements:

1. `google-services.json` from the Firebase project must be placed at
   `android/app/google-services.json` (Firebase console → Android app).
2. iOS additionally needs `GoogleService-Info.plist` in `ios/App/App/` and the
   Push Notifications + Background Modes (remote notifications) capabilities,
   plus an APNs key uploaded to Firebase.
3. `FIREBASE_SERVICE_ACCOUNT_JSON` and `PUSH_HOOK_SECRET` must be set as backend
   secrets — the same ones the web push already uses.

The native shell loads the hosted site (`capacitor.config.ts` → `server.url`),
so shipping app updates does not require a new store build.

## Testing

Open the installed app once (accept the notification prompt), then from another
account send a message / like / join request. A system notification should
appear in the tray with the app backgrounded or closed, and tapping it opens the
linked screen (event, chat, or profile).
