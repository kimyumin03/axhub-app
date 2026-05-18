import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:8000" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

export const authApi = {
  register: (data: { email: string; name: string; password: string }) =>
    api.post("/auth/register", data),
  login: (email: string, password: string) => {
    const form = new FormData();
    form.append("username", email);
    form.append("password", password);
    return api.post("/auth/login", form);
  },
  me: () => api.get("/auth/me"),
};

export const vocApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/voc/upload", form);
  },
  records: (params: Record<string, string | number>) =>
    api.get("/voc/records", { params }),
  dashboard: () => api.get("/voc/dashboard"),
};

export const reportApi = {
  list: () => api.get("/reports/"),
  get: (id: number) => api.get(`/reports/${id}`),
  generate: (data: { title: string; start_date: string; end_date: string }) =>
    api.post("/reports/generate", data),
};
