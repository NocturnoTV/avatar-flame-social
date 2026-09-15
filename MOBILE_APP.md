# BloxSpark - iOS/Android app (Capacitor)

BloxSpark is a full server-rendered TanStack Start app (server functions,
Stripe webhooks, live Supabase queries) deployed to Cloudflare Workers. There
is no static build that could be bundled inside a native app the way a plain
single-page app would be - so the native apps are a thin [Capacitor](https://capacitorjs.com)
WebView shell that always loads the real, live `https://bloxspark.app`
(see `capacitor.config.ts`, `server.url`). A new web release reaches the app
instantly with no store resubmission needed, for anything that isn't
native-shell/plugin code.

## What's already done

- `capacitor.config.ts` - app id `app.bloxspark.mobile`, points at
  `https://bloxspark.app`.
- `android/` and `ios/` - native projects scaffolded via `npx cap add`.
- `src/lib/native.ts` - the only place that checks
  `Capacitor.isNativePlatform()`; everything else uses its helpers:
  - `openExternal(url)` - opens a URL in the system browser (native) or a
    new tab (web). Used for Roblox OAuth-adjacent links, the Stripe Customer
    Portal, and any "leaving BloxSpark" confirmation link.
  - `openWebPurchase(path)` / `useNativeCheckoutGate(path)` - see Payments
    below.
- `src/components/NativeAppBridge.tsx` (mounted once in `__root.tsx`) -
  hides the native splash screen once React mounts, themes the status bar
  to match dark/light mode, and makes the Android hardware back button
  navigate back instead of instantly killing the app.
- Android manifest permissions for camera/microphone/photos (the app uses
  plain web `getUserMedia()`/file inputs, not a native camera plugin -
  Capacitor's own `BridgeWebChromeClient` already handles the runtime
  permission prompt once the manifest declares them).
- iOS `Info.plist` usage-description strings for camera/microphone/photo
  library (required or the app crashes the first time JS asks for access).
- `public/site.webmanifest` filled out for PWA installability (description,
  categories, orientation, proper icon `purpose` entries).

## Payments: redirects to the website, not in-app

Apple requires purchases of digital goods consumed in-app (our Blox virtual
currency, Spark Plus) to go through Apple's In-App Purchase system, and
Google has an equivalent Play Billing policy - shipping Stripe checkout
inside the app risks rejection. Per your decision, the native apps instead
send the user to the website for every real-money purchase:

- `BloxPackCheckout`, `SparkPlusCheckout`, and the Spark Plus gift checkout
  inside `GiftSheet` all call `useNativeCheckoutGate(path)`: on native, it
  immediately opens `https://bloxspark.app<path>` in the system browser
  instead of rendering the embedded Stripe checkout, and shows a short
  "opening the website…" notice in the app meanwhile.
- Sending Blox you already own (peer-to-peer, no payment involved) is
  **not** gated - that still works natively, since no purchase is happening.
- If you ever want native purchases instead (Apple/Google take a cut -
  roughly 15-30% - instead of Stripe's ~2.9%, but it's the only way to avoid
  this restriction entirely), that's a separate, sizeable project: StoreKit
  on iOS + Play Billing on Android, products configured in App Store
  Connect/Play Console, and server-side receipt validation before crediting
  an account. Nothing here blocks doing that later.

## What you still need to do before submitting

1. **Real app icon + splash screen.** The native projects currently ship
   Capacitor's placeholder icon. Generate real ones from a 1024×1024 (icon)
   and 2732×2732 (splash) source image with:
   ```bash
   npx @capacitor/assets generate
   ```
   This couldn't be run in this environment (the `sharp` image library's
   native binary failed to download here - no network access to fetch it).
   Run it yourself once you have proper source images (e.g. the BloxSpark
   "B" mark from `public/bloxspark-logo.png`, composited onto the brand
   gradient background rather than left transparent - app icons can't have
   transparency).
2. **iOS build.** Scaffolding succeeded even on this Windows machine, but
   actually building/archiving/submitting needs a Mac (Xcode + a paid Apple
   Developer account, $99/yr) or a cloud Mac CI. Open `ios/App/App.xcworkspace`
   (or `.xcodeproj` if no workspace) in Xcode, set your Team/signing, and
   run on a simulator or device first.
3. **Android build.** `npm run android:open` opens `android/` in Android
   Studio (needs the Android SDK installed). You'll need a signing keystore
   and a Google Play Console account ($25 one-time) to publish.
4. **Store listings.** Screenshots, description, privacy policy URL (you
   already have `/privacy`), Apple's "App Privacy" nutrition label (what
   data BloxSpark collects - accounts, messages, purchases, etc.), and
   Google's Data Safety form - both ask you to declare this yourself, I
   can't fill it out on your behalf since it's a compliance statement about
   your data practices.
5. **Age rating / content questionnaire** on both stores - BloxSpark has
   user-generated video, chat, and virtual currency, which affects the
   rating; answer honestly based on the moderation systems already in place
   (first-video review, reporting, blocking, sanctions).
6. Re-run `npx cap sync` any time you add/remove a Capacitor plugin, and
   after `npm install` on a fresh clone.

## Local development

```bash
npm run android:open   # opens android/ in Android Studio
npm run android:run    # builds + runs on a connected device/emulator
npm run ios:open       # opens ios/ in Xcode (Mac only)
npm run ios:run        # builds + runs on a connected device/simulator (Mac only)
npm run cap:sync       # re-copy config/plugins into both native projects
```
