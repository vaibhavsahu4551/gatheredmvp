import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wrapper config for the native Gathr apps.
 *
 * The app is a server-rendered web app, so the native shell loads the hosted
 * build. Push notifications go through the native bridge (see src/lib/push.ts).
 */
const config: CapacitorConfig = {
  appId: "app.lovable.gathr",
  appName: "Gathr",
  webDir: "dist/client",
  server: {
    url: "https://gatheredmvp.lovable.app",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
