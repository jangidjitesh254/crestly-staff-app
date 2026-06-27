import axios, { AxiosError } from "axios";
import Constants from "expo-constants";

const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  "http://localhost:4000/api";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  // 60s — bulk attendance over a remote DB on a hotspot can take a while,
  // and we'd rather wait than fail spuriously.
  timeout: 60_000,
});

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  // React Native / axios can drop the instance-level Content-Type, which makes
  // the server receive an empty body (it can't tell the payload is JSON).
  // Declare it explicitly on every request that carries a body so the body
  // always reaches the server and is parsed.
  if (config.data != null) {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      onUnauthorized?.();
    }
    return Promise.reject(err);
  },
);

/** True when the server rejected the request for a missing permission. */
export function isForbidden(err: unknown): boolean {
  return err instanceof AxiosError && err.response?.status === 403;
}

interface ZodIssue {
  path?: (string | number)[];
  message?: string;
  code?: string;
}

interface ErrorBody {
  message?: string | string[];
  issues?: ZodIssue[];
  error?: string;
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof AxiosError) {
    if (err.code === "ECONNABORTED") return "The server took too long to respond.";
    if (!err.response) return "Can't reach the server. Check your connection and API URL.";

    const data = err.response.data as ErrorBody | undefined;

    // Zod / class-validator errors carry an `issues` array — pluck the first
    // so the user sees which field is wrong, not just "Validation failed".
    if (data?.issues && Array.isArray(data.issues) && data.issues.length > 0) {
      const first = data.issues[0];
      if (first) {
        const path = Array.isArray(first.path) && first.path.length > 0
          ? first.path.join(".")
          : "";
        const head = typeof data.message === "string" ? data.message : "Validation failed";
        const tail = first.message ?? "invalid";
        return path ? `${head}: ${path} — ${tail}` : `${head} — ${tail}`;
      }
    }

    if (Array.isArray(data?.message)) return data!.message.join(", ");
    if (typeof data?.message === "string") return data.message;
    return err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
