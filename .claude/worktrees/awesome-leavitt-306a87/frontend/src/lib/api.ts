import axios from "axios";

const BASE = import.meta.env.VITE_API_URL ?? "";

export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Inject JWT on every request
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("sysops_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Handle 401 globally
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("sysops_token");
      localStorage.removeItem("sysops_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error ?? err.message;
  }
  return String(err);
}
