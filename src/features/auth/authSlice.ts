import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthUser } from "@/types/api";
import { permissionsFromToken } from "@/utils/jwt";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  permissions: string[];
};

function hydrate(): AuthState {
  const stored = sessionStorage.getItem("optech-admin-auth");
  if (!stored) return { accessToken: null, refreshToken: null, user: null, permissions: [] };
  try {
    const parsed = JSON.parse(stored) as AuthState;
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      user: parsed.user ?? null,
      permissions: parsed.accessToken ? permissionsFromToken(parsed.accessToken) : parsed.permissions ?? [],
    };
  } catch {
    return { accessToken: null, refreshToken: null, user: null, permissions: [] };
  }
}

const initialState: AuthState = hydrate();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ accessToken: string; refreshToken?: string; user: AuthUser; permissions?: string[] }>,
    ) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken ?? state.refreshToken;
      state.user = action.payload.user;
      state.permissions = action.payload.permissions ?? action.payload.user.roles;
      sessionStorage.setItem("optech-admin-auth", JSON.stringify(state));
    },
    clearAuth() {
      sessionStorage.removeItem("optech-admin-auth");
      return { accessToken: null, refreshToken: null, user: null, permissions: [] };
    },
  },
});

export const { setCredentials, clearAuth } = authSlice.actions;
export const authReducer = authSlice.reducer;
