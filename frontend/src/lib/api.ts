import type {
  AuthTokens,
  LoginPayload,
  RegisterPayload,
  User,
  Bot,
  CreateBotPayload,
  UpdateBotPayload,
  BotActivityLog,
  Tweet,
  TweetStatus,
  BotAnalyticsSummary,
  BotActivity,
  XAccountWithCount,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getStoredTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth_tokens");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem("auth_tokens", JSON.stringify(tokens));
}

function clearTokens(): void {
  localStorage.removeItem("auth_tokens");
}

let refreshPromise: Promise<AuthTokens> | null = null;

async function refreshAccessToken(): Promise<AuthTokens> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const tokens = getStoredTokens();
    if (!tokens?.refreshToken) {
      clearTokens();
      throw new ApiError(401, "No refresh token available");
    }

    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.refreshToken}`,
      },
    });

    if (!res.ok) {
      clearTokens();
      throw new ApiError(401, "Token refresh failed");
    }

    const data = await res.json();
    const newTokens: AuthTokens = data.data ?? data;
    storeTokens(newTokens);
    return newTokens;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const tokens = getStoredTokens();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (tokens?.accessToken) {
    headers["Authorization"] = `Bearer ${tokens.accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !isRetry && tokens?.refreshToken) {
    try {
      const newTokens = await refreshAccessToken();
      headers["Authorization"] = `Bearer ${newTokens.accessToken}`;
      return request<T>(path, { ...options, headers }, true);
    } catch {
      clearTokens();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new ApiError(401, "Session expired");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthTokens> => {
    const tokens = await request<AuthTokens>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    storeTokens(tokens);
    return tokens;
  },

  register: async (payload: RegisterPayload): Promise<AuthTokens> => {
    const tokens = await request<AuthTokens>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    storeTokens(tokens);
    return tokens;
  },

  logout: (): void => {
    clearTokens();
  },

  getTokens: getStoredTokens,

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  verifyEmail: (token: string) =>
    request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: () =>
    request<{ message: string }>("/auth/resend-verification", {
      method: "POST",
    }),
};

// ─── Users ───────────────────────────────────────────────────────────────────

export const usersApi = {
  getMe: () => request<User>("/users/me"),

  updateMe: (payload: { displayName?: string; avatarUrl?: string }) =>
    request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};

// ─── Bots ────────────────────────────────────────────────────────────────────

export const botsApi = {
  list: () => request<Bot[]>("/bots"),

  get: (id: string) => request<Bot>(`/bots/${encodeURIComponent(id)}`),

  create: (payload: CreateBotPayload) =>
    request<Bot>("/bots", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: UpdateBotPayload) =>
    request<Bot>(`/bots/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    request<void>(`/bots/${encodeURIComponent(id)}`, { method: "DELETE" }),

  start: (id: string) =>
    request<Bot>(`/bots/${encodeURIComponent(id)}/start`, { method: "POST" }),

  stop: (id: string) =>
    request<Bot>(`/bots/${encodeURIComponent(id)}/stop`, { method: "POST" }),

  getActivity: (id: string, limit = 20) =>
    request<BotActivityLog[]>(
      `/bots/${encodeURIComponent(id)}/activity?limit=${limit}`,
    ),
};

// ─── Tweets ──────────────────────────────────────────────────────────────────

export const tweetsApi = {
  list: (filters?: { status?: TweetStatus; botId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.botId) params.set("botId", filters.botId);
    const qs = params.toString();
    return request<Tweet[]>(`/tweets${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => request<Tweet>(`/tweets/${encodeURIComponent(id)}`),

  approve: (id: string) =>
    request<Tweet>(`/tweets/${encodeURIComponent(id)}/approve`, {
      method: "PATCH",
    }),
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export const analyticsApi = {
  getBotSummary: (botId: string) =>
    request<BotAnalyticsSummary>(
      `/analytics/bots/${encodeURIComponent(botId)}/summary`,
    ),

  getBotActivity: (botId: string) =>
    request<BotActivity[]>(
      `/analytics/bots/${encodeURIComponent(botId)}/activity`,
    ),
};

// ─── X Accounts ──────────────────────────────────────────────────────────────

export const xAccountsApi = {
  getAuthorizeUrl: () => `${API_BASE_URL}/x-oauth/authorize`,

  list: () => request<XAccountWithCount[]>("/x-oauth/accounts"),

  disconnect: (id: string) =>
    request<void>(`/x-oauth/accounts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

export { ApiError, getStoredTokens, clearTokens, storeTokens };
