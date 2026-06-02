const DEFAULT_API_URL = "http://127.0.0.1:8006";

const rawApiUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  DEFAULT_API_URL;

export const API_BASE_URL = String(rawApiUrl).replace(/\/+$/, "");
