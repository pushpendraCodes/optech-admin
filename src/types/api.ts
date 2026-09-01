export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
  meta?: {
    currentPage?: number;
    totalPages?: number;
    totalItems?: number;
    limit?: number;
  };
};

export type AuthUser = {
  id: string;
  name: string;
  kind: "staff" | "student";
  roles: string[];
};

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};
