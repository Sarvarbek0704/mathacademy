import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');

function extractErrorMessage(input: unknown): string {
  if (!input) return "Noma'lum xato";

  if (typeof input === 'string') return input;

  if (Array.isArray(input)) {
    const arr = input
      .map((item) => extractErrorMessage(item))
      .filter(Boolean);
    return arr.join('\n');
  }

  if (typeof input === 'object') {
    const obj = input as Record<string, any>;

    // Nest ValidationError format: { property, children, constraints }
    if (obj.constraints && typeof obj.constraints === 'object') {
      const values = Object.values(obj.constraints).filter((v) => typeof v === 'string');
      if (values.length) return values.join(', ');
    }

    if (obj.message) return extractErrorMessage(obj.message);
    if (obj.error) return extractErrorMessage(obj.error);

    // fallback
    try {
      return JSON.stringify(obj);
    } catch {
      return "Noma'lum xato";
    }
  }

  return String(input);
}

export function getApiErrorMessage(error: unknown, fallback = "So'rov bajarilmadi"): string {
  const axiosErr = error as AxiosError<any>;
  const data = axiosErr?.response?.data;
  const msg = extractErrorMessage(data?.message || data?.error || axiosErr?.message);
  return msg || fallback;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // refresh/logout cookie ishlashi uchun muhim
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failedQueue: { resolve: (value?: unknown) => void; reject: (reason?: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const msg = getApiErrorMessage(error);

    if (status === 401 && originalRequest.url !== '/auth/refresh') {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { accessToken } = data;
        localStorage.setItem('access_token', accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        const path = window.location.pathname;
        if (!path.includes('/login')) {
          window.location.href = path.startsWith('/guardian')
            ? '/guardian/login'
            : '/staff/login';
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    } else if (status === 401 && originalRequest.url === '/auth/refresh') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      const path = window.location.pathname;
      if (!path.includes('/login')) {
        window.location.href = path.startsWith('/guardian') ? '/guardian/login' : '/staff/login';
      }
    } else if (status === 403) {
      toast.error("Ruxsat yo'q", { description: msg });
    } else if (status === 400) {
      toast.error("Xato", { description: msg || "So'rovda xatolik bor" });
    } else if (status === 404) {
      toast.error("Topilmadi", { description: msg || "So'ralgan ma'lumot topilmadi" });
    } else if (status && status >= 500) {
      toast.error("Server xatosi", { description: "Iltimos, keyinroq qayta urinib ko'ring" });
    } else if (!error.response && error.code !== 'ERR_CANCELED') {
      toast.error("Tarmoq xatosi", { description: "Server bilan aloqa o'rnatib bo'lmadi" });
    } else if (error.code !== 'ERR_CANCELED') {
      toast.error("Xatolik", { description: msg || "Noma'lum xato yuz berdi" });
    }

    return Promise.reject(error);
  }
);

export default api;