import { useEffect, useCallback } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, onMessage, isSupported } from "firebase/messaging";

export type LiveNotification = {
  title: string;
  body: string;
  link?: string;
  type?: string;
};

type OnMessageCallback = (n: LiveNotification) => void;

function getFirebaseConfig() {
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
  };
}

/**
 * Subscribes to foreground Firebase push messages (when the app is in the foreground).
 * Calls `onNotification` whenever a push arrives while the user is on the page.
 */
export function useLivePush(active: boolean, onNotification: OnMessageCallback) {
  const stableCallback = useCallback(onNotification, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) return;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const supported = await isSupported();
        if (!supported) return;
        const config = getFirebaseConfig();
        if (!config) return;

        const app = getApps().length ? getApp() : initializeApp(config);
        const messaging = getMessaging(app);

        unsubscribe = onMessage(messaging, (payload) => {
          const title = payload.notification?.title ?? payload.data?.title ?? "Notification";
          const body = payload.notification?.body ?? payload.data?.body ?? "";
          const link = payload.data?.link || undefined;
          const type = payload.data?.type || undefined;
          stableCallback({ title, body, link, type });
        });
      } catch {
        /* push optional */
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [active, stableCallback]);
}
