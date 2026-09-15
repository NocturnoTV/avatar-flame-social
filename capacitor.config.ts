import type { CapacitorConfig } from "@capacitor/cli";

// BloxSpark is a full server-rendered TanStack Start app (server functions,
// Stripe webhooks, live Supabase queries) deployed to Cloudflare Workers -
// there is no static build that could be bundled inside the native shell the
// way a plain SPA would be. Capacitor's "remote URL" mode is the correct fit
// here: the native app is a thin WebView shell that always loads the real,
// live bloxspark.app, so every server-side feature keeps working exactly as
// deployed and a new web release reaches the app instantly, no store
// resubmission needed for anything that isn't native-shell/plugin code.
const config: CapacitorConfig = {
  appId: "app.bloxspark.mobile",
  appName: "BloxSpark",
  // Required by the CLI even in remote-URL mode; never actually served since
  // `server.url` below takes priority, but must point at a real folder.
  webDir: "public",
  server: {
    url: "https://bloxspark.app",
    cleartext: false,
    // Let the WebView follow real navigations to bloxspark.app; anything
    // else (Roblox OAuth, Stripe) is opened via @capacitor/browser instead
    // of allowed to navigate here, see src/lib/native.ts.
    allowNavigation: ["bloxspark.app", "*.bloxspark.app"],
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#08090d",
  },
  android: {
    backgroundColor: "#08090d",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      backgroundColor: "#08090d",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#08090d",
    },
  },
};

export default config;
