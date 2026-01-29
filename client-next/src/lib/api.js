const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

function buildUrl(path) {
  return `${API_BASE}${path}`;
}

async function fetchJson(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const response = await fetch(buildUrl(path), {
    credentials: "include",
    ...options,
    headers,
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, data };
}

export async function getMe() {
  const { data } = await fetchJson("/api/me");
  return data;
}

export async function getActiveGame() {
  const { data } = await fetchJson("/api/active-game");
  return data;
}

export async function postLogout() {
  const { data } = await fetchJson("/api/logout", { method: "POST" });
  return data;
}
