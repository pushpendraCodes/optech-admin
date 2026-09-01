import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/hooks/useAuth";
import { setCredentials, clearAuth } from "@/features/auth/authSlice";
import { toast } from "@/components/Toast";
import { permissionsFromToken, tokenExpiresInMs } from "@/utils/jwt";
import type { ApiSuccess, AuthPayload } from "@/types/api";

const apiBase = import.meta.env.VITE_API_URL || "/api/v1";

async function refreshAccessToken(refreshToken: string | null) {
  const res = await fetch(`${apiBase}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });
  if (!res.ok) return null;
  return (await res.json()) as ApiSuccess<AuthPayload>;
}

export function AuthSessionWatcher() {
  const token = useAppSelector((s) => s.auth.accessToken);
  const refreshToken = useAppSelector((s) => s.auth.refreshToken);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const prevToken = useRef<string | null>(token);
  const refreshing = useRef(false);

  useEffect(() => {
    if (prevToken.current && !token && location.pathname !== "/login") {
      toast("Session expired. Please sign in again.", "error");
    }
    prevToken.current = token;
  }, [token, location.pathname]);

  useEffect(() => {
    if (!token) return;

    const schedule = () => {
      const ms = tokenExpiresInMs(token);
      if (ms == null) return undefined;
      const delay = Math.max(ms - 2 * 60 * 1000, 30_000);
      return window.setTimeout(async () => {
        if (refreshing.current) return;
        refreshing.current = true;
        try {
          const body = await refreshAccessToken(refreshToken);
          if (!body?.data?.accessToken) {
            dispatch(clearAuth());
            return;
          }
          dispatch(
            setCredentials({
              accessToken: body.data.accessToken,
              refreshToken: body.data.refreshToken,
              user: body.data.user,
              permissions: permissionsFromToken(body.data.accessToken),
            }),
          );
        } catch {
          dispatch(clearAuth());
        } finally {
          refreshing.current = false;
        }
      }, delay);
    };

    const id = schedule();
    return () => {
      if (id) window.clearTimeout(id);
    };
  }, [token, refreshToken, dispatch]);

  return null;
}
