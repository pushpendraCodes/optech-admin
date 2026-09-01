export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function permissionsFromToken(token: string): string[] {
  const payload = decodeJwtPayload(token);
  const perms = payload?.permissions;
  return Array.isArray(perms) ? perms.map(String) : [];
}

export function rolesFromToken(token: string): string[] {
  const payload = decodeJwtPayload(token);
  const roles = payload?.roles;
  return Array.isArray(roles) ? roles.map(String) : [];
}

export function tokenExpiresInMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return null;
  return exp * 1000 - Date.now();
}
