import { createServerFn } from "@tanstack/react-start";

/**
 * Returns the *publishable* Firebase web config so the browser can boot the
 * Firebase SDK (phone auth + Cloud Messaging). These values are safe to expose.
 */
export const getFirebaseConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    apiKey: process.env.FIREBASE_API_KEY ?? "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.FIREBASE_APP_ID ?? "",
    vapidKey: process.env.FIREBASE_VAPID_KEY ?? process.env.FIREBASE_VAVID_KEY ?? "",
  };
});
