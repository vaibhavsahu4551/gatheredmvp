import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { supabase } from "@/integrations/supabase/client";
import { getFirebaseConfig } from "@/lib/firebase-config.functions";

export type FirebaseWebConfig = Awaited<ReturnType<typeof getFirebaseConfig>>;

let configPromise: Promise<FirebaseWebConfig> | null = null;

export function loadFirebaseConfig(): Promise<FirebaseWebConfig> {
  if (!configPromise) configPromise = getFirebaseConfig();
  return configPromise;
}

export async function getFirebaseApp(): Promise<FirebaseApp | null> {
  const cfg = await loadFirebaseConfig();
  if (!cfg.apiKey || !cfg.projectId) return null;
  const existing = getApps();
  if (existing.length) return existing[0];
  return initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  });
}

const DENIED_KEY = "gathr.push.denied";
const ASKED_KEY = "gathr.push.asked";

/** True when the member previously declined — we never prompt again. */
export function pushDeclined(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DENIED_KEY) === "1";
}

export function pushAsked(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ASKED_KEY) === "1";
}

async function saveToken(token: string, platform: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { console.warn("[push] no session — token not saved"); return; }
  const { error } = await (supabase as any)
    .from("push_tokens")
    .upsert(
      { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: "token" },
    );
  if (error) console.error("[push] could not save device token:", error.message);
  else console.info("[push] device token registered");
}

function isNative(): boolean {
  const cap = (globalThis as any).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/** Native (Capacitor) registration — Android/iOS wrapped builds. */
async function registerNative(navigateTo: (url: string) => void) {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const perm = await PushNotifications.checkPermissions();
  let status = perm.receive;
  if (status === "prompt" || status === "prompt-with-rationale") {
    status = (await PushNotifications.requestPermissions()).receive;
  }
  if (status !== "granted") {
    localStorage.setItem(DENIED_KEY, "1");
    return false;
  }
  PushNotifications.addListener("registration", (t) => { void saveToken(t.value, "native"); });
  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const url = (action.notification.data as any)?.url;
    if (url) navigateTo(url);
  });
  await PushNotifications.register();
  return true;
}

/** Web/PWA registration via Firebase Cloud Messaging. */
async function registerWeb(): Promise<boolean> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("[push] this browser has no notification/service-worker support");
    return false;
  }
  if (Notification.permission === "denied") {
    localStorage.setItem(DENIED_KEY, "1");
    console.warn("[push] notifications blocked in browser settings");
    return false;
  }
  const cfg = await loadFirebaseConfig();
  if (!cfg.vapidKey || !cfg.apiKey) {
    console.error("[push] missing Firebase web config", { apiKey: !!cfg.apiKey, vapidKey: !!cfg.vapidKey });
    return false;
  }

  if (Notification.permission !== "granted") {
    const result = await Notification.requestPermission();
    localStorage.setItem(ASKED_KEY, "1");
    if (result !== "granted") {
      localStorage.setItem(DENIED_KEY, "1");
      console.warn("[push] permission not granted:", result);
      return false;
    }
  }

  const app = await getFirebaseApp();
  if (!app) { console.error("[push] Firebase app could not start"); return false; }
  const { getMessaging, getToken, isSupported, onMessage } = await import("firebase/messaging");
  if (!(await isSupported())) { console.warn("[push] FCM unsupported here"); return false; }

  const params = new URLSearchParams({
    apiKey: cfg.apiKey,
    projectId: cfg.projectId,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  });
  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${params.toString()}`,
    { scope: "/" },
  );
  await navigator.serviceWorker.ready;

  const messaging = getMessaging(app);
  let token: string | null = null;
  try {
    token = await getToken(messaging, { vapidKey: cfg.vapidKey, serviceWorkerRegistration: registration });
  } catch (e: any) {
    console.error("[push] getToken failed:", e?.message ?? e);
    return false;
  }
  if (!token) { console.error("[push] FCM returned no token"); return false; }
  await saveToken(token, "web");

  onMessage(messaging, (payload) => {
    const n = payload.notification;
    if (!n?.title) return;
    import("sonner").then(({ toast }) => toast(n.title!, { description: n.body ?? undefined }));
  });
  return true;
}

/**
 * Requests permission (once) and registers this device for push.
 * Silently no-ops when the member has already declined.
 */
export async function enablePush(navigateTo: (url: string) => void = (u) => { window.location.href = u; }) {
  try {
    if (pushDeclined()) return false;
    localStorage.setItem(ASKED_KEY, "1");
    return isNative() ? await registerNative(navigateTo) : await registerWeb();
  } catch (e) {
    console.warn("[push] registration skipped:", e);
    return false;
  }
}

/** Removes this device's token (used on logout). */
export async function disablePushForThisDevice() {
  try {
    if (isNative()) return;
    const app = await getFirebaseApp();
    if (!app) return;
    const { getMessaging, getToken, deleteToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return;
    const cfg = await loadFirebaseConfig();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: cfg.vapidKey }).catch(() => null);
    if (token) {
      await (supabase as any).from("push_tokens").delete().eq("token", token);
      await deleteToken(messaging).catch(() => {});
    }
  } catch {
    /* best effort */
  }
}
