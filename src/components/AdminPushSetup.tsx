import { useEffect, useRef } from "react";
import { useSaveAdminPushTokenMutation } from "@/app/api";
import { registerWebPushToken } from "@/lib/firebase-push";

export function AdminPushSetup({ active }: { active: boolean }) {
  const [saveToken] = useSaveAdminPushTokenMutation();
  const attempted = useRef(false);

  useEffect(() => {
    if (!active || attempted.current) return;

    void (async () => {
      attempted.current = true;
      try {
        const token = await registerWebPushToken();
        if (token) await saveToken({ token }).unwrap();
      } catch {
        /* push optional */
      }
    })();
  }, [active, saveToken]);

  return null;
}
