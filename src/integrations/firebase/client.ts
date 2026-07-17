import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirebaseConfig } from "@/lib/firebase-auth.functions";

let authPromise: Promise<Auth> | null = null;

export function getFirebaseAuth(): Promise<Auth> {
  if (!authPromise) {
    authPromise = (async () => {
      const config = await getFirebaseConfig();
      const app: FirebaseApp = getApps()[0] ?? initializeApp(config);
      return getAuth(app);
    })();
  }
  return authPromise;
}
