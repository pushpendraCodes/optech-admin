import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/app/store";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export function useCan(permission: string) {
  const { permissions, user } = useAppSelector((s) => s.auth);
  if (user?.roles.includes("SUPER_ADMIN") || permissions.includes("*")) return true;
  return permissions.includes(permission);
}

export function useCanAny(required?: string | string[]) {
  const { permissions, user } = useAppSelector((s) => s.auth);
  if (!required) return true;
  if (user?.roles.includes("SUPER_ADMIN") || permissions.includes("*")) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.some((p) => permissions.includes(p));
}
