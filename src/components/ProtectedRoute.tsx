import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAppSelector, useCanAny } from "@/hooks/useAuth";

export function ProtectedRoute({
  children,
  permission,
}: {
  children: ReactNode;
  permission?: string | string[];
}) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const location = useLocation();
  const allowed = useCanAny(permission);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!allowed) {
    const label = Array.isArray(permission) ? permission.join(" or ") : permission;
    return (
      <div className="card p-10 text-center">
        <h1 className="font-sans text-2xl font-semibold">Not permitted</h1>
        <p className="mt-2 text-sm text-zinc-400">This area needs {label}. Ask an admin to update your role permissions.</p>
      </div>
    );
  }
  return children;
}
