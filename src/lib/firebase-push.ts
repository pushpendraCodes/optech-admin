import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

export type FirebaseWebConfig = FirebaseOptions & { vapidKey?: string };

function readConfig(): FirebaseWebConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId,
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
  };
}

async function serviceWorkerRegistration(config: FirebaseOptions) {
  if (!("serviceWorker" in navigator)) return undefined;

  const params = new URLSearchParams({
    apiKey: config.apiKey || "",
    authDomain: config.authDomain || "",
    projectId: config.projectId || "",
    storageBucket: config.storageBucket || "",
    messagingSenderId: config.messagingSenderId || "",
    appId: config.appId || "",
  });
  const swUrl = `/firebase-messaging-sw.js?${params.toString()}`;
  const registration = await navigator.serviceWorker.register(swUrl, { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}

export async function registerWebPushToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const config = readConfig();
  if (!config?.vapidKey) return null;
  if (!(await isSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const { vapidKey, ...firebaseConfig } = config;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  const registration = await serviceWorkerRegistration(firebaseConfig);
  if (!registration) return null;

  return getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
}
