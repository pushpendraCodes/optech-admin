export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

export function readFirebaseWebConfig(env: Record<string, string | undefined>): FirebaseWebConfig | null {
  const apiKey = env.apiKey || "";
  const projectId = env.projectId || "";
  const vapidKey = env.vapidKey || "";
  if (!apiKey || !projectId || !vapidKey) return null;
  return {
    apiKey,
    authDomain: env.authDomain || "",
    projectId,
    storageBucket: env.storageBucket || "",
    messagingSenderId: env.messagingSenderId || "",
    appId: env.appId || "",
    vapidKey,
  };
}

export async function registerWebPushToken(
  config: FirebaseWebConfig,
  saveToken: (token: string) => Promise<void>,
) {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return;
  }

  const [{ initializeApp, getApps, getApp }, { getMessaging, getToken, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);

  if (!(await isSupported())) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });

  const swUrl = `/firebase-messaging-sw.js?${new URLSearchParams({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  }).toString()}`;

  let registration = await navigator.serviceWorker.getRegistration("/firebase-cloud-messaging-push-scope");
  if (!registration) {
    registration = await navigator.serviceWorker.register(swUrl, { scope: "/firebase-cloud-messaging-push-scope" });
  }
  await navigator.serviceWorker.ready;

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: config.vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (token) await saveToken(token);
}
