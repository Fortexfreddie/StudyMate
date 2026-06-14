import type {
  AdminDocumentListParams,
  AdminDocumentListResponse,
  AdminOverview,
  AdminUserActivityParams,
  AdminUserActivityResponse,
  AdminUserDeleteResponse,
  AdminUserListParams,
  AdminUserListResponse,
  AdminUserUpdateRequest,
  AdminUserUsageParams,
  AdminUserUsageResponse,
  AuthTokens,
  ChatHistoryResponse,
  ChatRequest,
  ChatResponse,
  DeleteResponse,
  Document,
  DocumentListResponse,
  LoginRequest,
  QuizDetailResponse,
  QuizHistoryResponse,
  QuizRequest,
  QuizResponse,
  QuizSubmitRequest,
  QuizSubmitResponse,
  RefreshResponse,
  SignupRequest,
  SignupResponse,
  StatsResponse,
  SummaryDetailResponse,
  SummaryHistoryResponse,
  SummaryRequest,
  SummaryResponse,
  UpdateProfileRequest,
  UploadResponse,
  UsageResponse,
  User,
} from "./types";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "studymate_access_token";
const REFRESH_KEY = "studymate_refresh_token";
const PERFORMANCE_KEY = "studymate_performance_mode";

export function getPerformanceMode(): string {
  if (typeof window === "undefined") return "high";
  return localStorage.getItem(PERFORMANCE_KEY) || "high";
}

export function setPerformanceMode(mode: string): void {
  localStorage.setItem(PERFORMANCE_KEY, mode);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

class ApiClientError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiClientError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Attach performance mode on every request
  headers["X-Performance-Mode"] = getPerformanceMode();

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshResponse.ok) {
          const data: RefreshResponse = await refreshResponse.json();
          setTokens(data.access_token, data.refresh_token ?? refreshToken);
          return request<T>(path, options, false);
        }
      } catch {
        // Refresh failed
      }
    }
    clearTokens();
    throw new ApiClientError(401, "Session expired. Please log in again.");
  }

  if (!response.ok) {
    let detail = "An unexpected error occurred.";
    try {
      const errorBody = await response.json();
      detail = errorBody.detail || detail;
    } catch {
      // Body not JSON
    }
    throw new ApiClientError(response.status, detail);
  }

  return response.json() as Promise<T>;
}

export const api = {
  auth: {
    signup(data: SignupRequest): Promise<SignupResponse> {
      return request<SignupResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    login(data: LoginRequest): Promise<AuthTokens> {
      return request<AuthTokens>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    refresh(refreshToken: string): Promise<RefreshResponse> {
      return request<RefreshResponse>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    },

    logout(refreshToken: string): Promise<{ success: boolean }> {
      return request<{ success: boolean }>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    },

    me(): Promise<User> {
      return request<User>("/auth/me");
    },

    updateProfile(data: UpdateProfileRequest): Promise<User> {
      return request<User>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
  },

  documents: {
    upload(file: File): Promise<UploadResponse> {
      const formData = new FormData();
      formData.append("file", file);
      return request<UploadResponse>("/documents/upload", {
        method: "POST",
        body: formData,
      });
    },

    list(): Promise<DocumentListResponse> {
      return request<DocumentListResponse>("/documents");
    },

    get(docId: string): Promise<Document> {
      return request<Document>(`/documents/${docId}`);
    },

    remove(docId: string): Promise<DeleteResponse> {
      return request<DeleteResponse>(`/documents/${docId}`, {
        method: "DELETE",
      });
    },
  },

  stats: {
    get(): Promise<StatsResponse> {
      return request<StatsResponse>("/stats");
    },
  },

  usage: {
    get(): Promise<UsageResponse> {
      return request<UsageResponse>("/usage");
    },
  },

  chat: {
    send(data: ChatRequest): Promise<ChatResponse> {
      return request<ChatResponse>("/chat", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  },

  summary: {
    generate(data: SummaryRequest): Promise<SummaryResponse> {
      return request<SummaryResponse>("/summary/generate", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  },

  quiz: {
    generate(data: QuizRequest): Promise<QuizResponse> {
      return request<QuizResponse>("/quiz/generate", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    submit(
      sessionId: string,
      data: QuizSubmitRequest
    ): Promise<QuizSubmitResponse> {
      return request<QuizSubmitResponse>(`/quiz/${sessionId}/submit`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  },

  history: {
    chatHistory(params?: {
      doc_id?: string;
      limit?: number;
      offset?: number;
    }): Promise<ChatHistoryResponse> {
      const searchParams = new URLSearchParams();
      if (params?.doc_id) searchParams.set("doc_id", params.doc_id);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.offset) searchParams.set("offset", String(params.offset));
      const query = searchParams.toString();
      return request<ChatHistoryResponse>(
        `/history/chat${query ? `?${query}` : ""}`
      );
    },

    quizHistory(params?: {
      doc_id?: string;
      limit?: number;
      offset?: number;
    }): Promise<QuizHistoryResponse> {
      const searchParams = new URLSearchParams();
      if (params?.doc_id) searchParams.set("doc_id", params.doc_id);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.offset) searchParams.set("offset", String(params.offset));
      const query = searchParams.toString();
      return request<QuizHistoryResponse>(
        `/history/quizzes${query ? `?${query}` : ""}`
      );
    },

    quizDetail(sessionId: string): Promise<QuizDetailResponse> {
      return request<QuizDetailResponse>(`/history/quizzes/${sessionId}`);
    },

    summaryHistory(params?: {
      doc_id?: string;
      limit?: number;
      offset?: number;
    }): Promise<SummaryHistoryResponse> {
      const searchParams = new URLSearchParams();
      if (params?.doc_id) searchParams.set("doc_id", params.doc_id);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.offset) searchParams.set("offset", String(params.offset));
      const query = searchParams.toString();
      return request<SummaryHistoryResponse>(
        `/history/summaries${query ? `?${query}` : ""}`
      );
    },

    summaryDetail(summaryId: string): Promise<SummaryDetailResponse> {
      return request<SummaryDetailResponse>(`/history/summaries/${summaryId}`);
    },
  },

  admin: {
    overview(): Promise<AdminOverview> {
      return request<AdminOverview>("/admin/stats/overview");
    },

    listUsers(params?: AdminUserListParams): Promise<AdminUserListResponse> {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set("search", params.search);
      if (params?.role) searchParams.set("role", params.role);
      if (params?.major) searchParams.set("major", params.major);
      if (params?.is_pro !== undefined)
        searchParams.set("is_pro", String(params.is_pro));
      if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.offset) searchParams.set("offset", String(params.offset));
      const query = searchParams.toString();
      return request<AdminUserListResponse>(
        `/admin/users${query ? `?${query}` : ""}`
      );
    },

    userUsage(
      userId: string,
      params?: AdminUserUsageParams
    ): Promise<AdminUserUsageResponse> {
      const searchParams = new URLSearchParams();
      if (params?.start) searchParams.set("start", params.start);
      if (params?.end) searchParams.set("end", params.end);
      if (params?.request_type)
        searchParams.set("request_type", params.request_type);
      const query = searchParams.toString();
      return request<AdminUserUsageResponse>(
        `/admin/users/${userId}/usage${query ? `?${query}` : ""}`
      );
    },

    userActivity(
      userId: string,
      params?: AdminUserActivityParams
    ): Promise<AdminUserActivityResponse> {
      const searchParams = new URLSearchParams();
      if (params?.action_type)
        searchParams.set("action_type", params.action_type);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.offset) searchParams.set("offset", String(params.offset));
      const query = searchParams.toString();
      return request<AdminUserActivityResponse>(
        `/admin/users/${userId}/activity${query ? `?${query}` : ""}`
      );
    },

    updateUser(
      userId: string,
      data: AdminUserUpdateRequest
    ): Promise<User> {
      return request<User>(`/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },

    deleteUser(userId: string): Promise<AdminUserDeleteResponse> {
      return request<AdminUserDeleteResponse>(`/admin/users/${userId}`, {
        method: "DELETE",
      });
    },

    listDocuments(
      params?: AdminDocumentListParams
    ): Promise<AdminDocumentListResponse> {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set("search", params.search);
      if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.offset) searchParams.set("offset", String(params.offset));
      const query = searchParams.toString();
      return request<AdminDocumentListResponse>(
        `/admin/documents${query ? `?${query}` : ""}`
      );
    },

    deleteDocument(docId: string): Promise<DeleteResponse> {
      return request<DeleteResponse>(`/admin/documents/${docId}`, {
        method: "DELETE",
      });
    },
  },
};

export { ApiClientError };
