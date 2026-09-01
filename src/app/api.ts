import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import type { RootState } from "./store";
import { clearAuth, setCredentials } from "@/features/auth/authSlice";
import { permissionsFromToken } from "@/utils/jwt";
import type { ApiSuccess, AuthPayload } from "@/types/api";

const apiBase = import.meta.env.VITE_API_URL || "/api/v1";

const rawBase = fetchBaseQuery({
  baseUrl: apiBase,
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set("authorization", `Bearer ${token}`);
    return headers;
  },
});

function applySession(api: { dispatch: (a: unknown) => void }, body: ApiSuccess<AuthPayload>) {
  api.dispatch(
    setCredentials({
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
      user: body.data.user,
      permissions: permissionsFromToken(body.data.accessToken),
    }),
  );
}

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extra,
) => {
  let result = await rawBase(args, api, extra);
  if (result.error && result.error.status === 401) {
    const url = typeof args === "string" ? args : args.url;
    if (url?.includes("/auth/refresh") || url?.includes("/auth/admin/login")) {
      api.dispatch(clearAuth());
      return result;
    }
    const refreshToken = (api.getState() as RootState).auth.refreshToken;
    const refresh = await rawBase(
      { url: "/auth/refresh", method: "POST", body: refreshToken ? { refreshToken } : undefined },
      api,
      extra,
    );
    if (refresh.data) {
      applySession(api, refresh.data as ApiSuccess<AuthPayload>);
      result = await rawBase(args, api, extra);
    } else {
      api.dispatch(clearAuth());
    }
  }
  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["List", "Dashboard", "Auth", "Student", "Settings"],
  endpoints: (build) => ({
    login: build.mutation<ApiSuccess<AuthPayload>, { email: string; password: string; pushToken?: string }>({
      query: (body) => ({ url: "/auth/admin/login", method: "POST", body }),
    }),
    logout: build.mutation<ApiSuccess<unknown>, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
    }),
    dashboard: build.query<ApiSuccess<Record<string, number>>, void>({
      query: () => "/admin/dashboard",
      providesTags: ["Dashboard"],
    }),
    list: build.query<
      ApiSuccess<Record<string, unknown>[]>,
      { resource: string; page?: number; search?: string; limit?: number; extra?: Record<string, string> }
    >({
      query: ({ resource, page = 1, search = "", limit = 20, extra = {} }) => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (search) params.set("search", search);
        Object.entries(extra).forEach(([k, v]) => v && params.set(k, v));
        return `/admin/${resource}?${params.toString()}`;
      },
      transformResponse: (res: ApiSuccess<unknown>) => ({
        ...res,
        data: Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [],
      }),
      providesTags: (_r, _e, arg) => [{ type: "List", id: `${arg.resource}:${JSON.stringify(arg.extra ?? {})}` }],
    }),
    getById: build.query<ApiSuccess<Record<string, unknown>>, { resource: string; id: string }>({
      query: ({ resource, id }) => `/admin/${resource}/${id}`,
      providesTags: (_r, _e, arg) => [{ type: "Student", id: arg.id }],
    }),
    create: build.mutation<ApiSuccess<unknown>, { resource: string; body: unknown }>({
      query: ({ resource, body }) => ({ url: `/admin/${resource}`, method: "POST", body }),
      invalidatesTags: ["List", "Dashboard", "Student"],
    }),
    patch: build.mutation<ApiSuccess<unknown>, { resource: string; id: string; body: unknown }>({
      query: ({ resource, id, body }) => ({ url: `/admin/${resource}/${id}`, method: "PATCH", body }),
      invalidatesTags: ["List", "Dashboard", "Student"],
    }),
    remove: build.mutation<ApiSuccess<unknown>, { resource: string; id: string }>({
      query: ({ resource, id }) => ({ url: `/admin/${resource}/${id}`, method: "DELETE" }),
      invalidatesTags: ["List", "Dashboard", "Student"],
    }),
    action: build.mutation<ApiSuccess<unknown>, { path: string; body?: unknown; method?: "POST" | "PATCH" }>({
      query: ({ path, body, method = "POST" }) => ({ url: `/admin/${path}`, method, body }),
      invalidatesTags: ["List", "Dashboard", "Student"],
    }),
    upload: build.mutation<ApiSuccess<{ url?: string; publicId?: string }>, { file: File; folder?: string }>({
      query: ({ file, folder }) => {
        const body = new FormData();
        body.append("file", file);
        body.append("folder", folder ?? "optech/admin");
        return { url: "/admin/uploads", method: "POST", body };
      },
    }),
    websiteSettings: build.query<ApiSuccess<Record<string, unknown>>, void>({
      query: () => "/admin/settings/website",
      providesTags: ["Settings"],
    }),
    saveWebsiteSettings: build.mutation<
      ApiSuccess<Record<string, unknown>>,
      { name: string; email: string; mobile: string; address: string; logo?: Record<string, unknown> | null }
    >({
      query: (body) => ({ url: "/admin/settings/website", method: "POST", body }),
      invalidatesTags: ["Settings"],
    }),
    issueCertificate: build.mutation<
      ApiSuccess<Record<string, unknown>>,
      { enrollmentId: string; studentId: string }
    >({
      query: ({ enrollmentId }) => ({
        url: "/admin/certificates",
        method: "POST",
        body: { enrollmentId },
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: "Student", id: arg.studentId }],
    }),
    downloadCertificatePdf: build.mutation<Blob, string>({
      query: (enrollmentId) => ({
        url: `/admin/certificates/${enrollmentId}/pdf`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    downloadIdCardPdf: build.mutation<Blob, string>({
      query: (studentId) => ({
        url: `/admin/id-cards/${studentId}/pdf`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    getAdminAlerts: build.query<ApiSuccess<Record<string, unknown>[]>, void>({
      query: () => "/admin/alerts",
      providesTags: ["Dashboard"],
    }),
    getAdminAlertUnreadCount: build.query<ApiSuccess<{ count: number }>, void>({
      query: () => "/admin/alerts/unread-count",
      providesTags: ["Dashboard"],
    }),
    markAdminAlertRead: build.mutation<ApiSuccess<{ read: boolean }>, string>({
      query: (id) => ({ url: `/admin/alerts/${id}/read`, method: "PATCH" }),
      invalidatesTags: ["Dashboard"],
    }),
    saveAdminPushToken: build.mutation<ApiSuccess<{ saved: boolean }>, { token: string }>({
      query: (body) => ({ url: "/admin/push-token", method: "POST", body }),
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useDashboardQuery,
  useListQuery,
  useGetByIdQuery,
  useCreateMutation,
  usePatchMutation,
  useRemoveMutation,
  useActionMutation,
  useUploadMutation,
  useWebsiteSettingsQuery,
  useSaveWebsiteSettingsMutation,
  useIssueCertificateMutation,
  useDownloadCertificatePdfMutation,
  useDownloadIdCardPdfMutation,
  useGetAdminAlertsQuery,
  useGetAdminAlertUnreadCountQuery,
  useMarkAdminAlertReadMutation,
  useSaveAdminPushTokenMutation,
} = api;
