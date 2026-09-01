import { useEffect, useRef } from "react";
import { showLiveToast } from "@/components/NotificationToast";

type AlertRow = Record<string, unknown>;

export function useLiveAlertPolling(
  active: boolean,
  unread: number,
  alerts: AlertRow[],
  refetchAlerts: () => Promise<{ data?: { data?: AlertRow[] } }>,
) {
  const prevUnread = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    if (prevUnread.current === null) {
      prevUnread.current = unread;
      return;
    }

    if (unread <= prevUnread.current) {
      prevUnread.current = unread;
      return;
    }

    void (async () => {
      let rows = alerts;
      try {
        const res = await refetchAlerts();
        rows = res.data?.data ?? alerts;
      } catch {
        /* use cached alerts */
      }

      const latest = rows.find((row) => !row.readAt);
      const alert = (latest?.alert as Record<string, unknown> | undefined) ?? {};
      showLiveToast(String(alert.title ?? "New alert"), String(alert.body ?? ""), String(alert.link ?? ""));
    })();

    prevUnread.current = unread;
  }, [active, unread, alerts, refetchAlerts]);
}
