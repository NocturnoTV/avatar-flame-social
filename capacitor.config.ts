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
    // Roblox and Google sign-in both navigate the WebView itself to the
    // provider's own login/consent page and back (auth.tsx's roblox()/
    // google() use window.location, not a separate browser tab) - without
    // explicitly allowing those origins here, Capacitor blocks the
    // cross-origin hop and the sign-in button just spins/loops forever.
    // Stripe checkout and admin "sign in as" links are the ones that use
    // @capacitor/browser instead (src/lib/native.ts's openExternal), since
    // those are meant to leave the app rather than come back into it.
    allowNavigation: [
      "bloxspark.app",
      "*.bloxspark.app",
      "accounts.google.com",
      "*.google.com",
      "roblox.com",
      "*.roblox.com",
      // Google sign-in goes through Lovable's own OAuth broker
      // (@lovable.dev/cloud-auth-js's /~oauth/initiate) before reaching
      // Google - these are its hardcoded supported origins.
      "oauth.lovable.app",
      "lovable.dev",
      "*.lovable.dev",
    ],
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
