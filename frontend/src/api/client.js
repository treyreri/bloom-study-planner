/* ==========================================================================
   API client: one fetch wrapper for /api/v1/.

   Authentication: JWT from the existing endpoints.
   The access and refresh tokens are kept in localStorage; every request
   sends "Authorization: Bearer <access>". When the access token expires
   (401) the refresh token is used once to get a new pair; if that fails
   the user is logged out and sent to the login page.
   ========================================================================== */
const API = '/api/v1/';
const ACCESS = 'bloom.access';
const REFRESH = 'bloom.refresh';

export const tokens = {
  get access() { return localStorage.getItem(ACCESS); },
  get refresh() { return localStorage.getItem(REFRESH); },
  save({ access, refresh }) {
    localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const FIELD_NAMES = {
  title: 'Название', date: 'Дата', name: 'Название', due_date: 'Дата',
  start_time: 'Начало', end_time: 'Конец', week_start: 'Неделя', mood: 'Настроение',
  subject: 'Предмет', month_plan: 'Месяц', duration_min: 'Длительность',
  focus_goals: 'Фокус-цели', color: 'Цвет', avatar: 'Аватар', year: 'Год', month: 'Месяц',
};

/** Turn a DRF error body into one readable sentence. */
function errorMessage(data) {
  if (!data) return 'Что-то пошло не так. Попробуйте ещё раз.';
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map(errorMessage).join(' ');
  if (data.detail) return String(data.detail);
  return Object.entries(data)
    .map(([field, messages]) => {
      const text = Array.isArray(messages) ? messages.join(' ') : errorMessage(messages);
      return field === 'non_field_errors' ? text : `${FIELD_NAMES[field] || field}: ${text}`;
    })
    .join(' ');
}

/** Go to the login page and come back afterwards (like the old 401 handling). */
export function redirectToLogin() {
  tokens.clear();
  window.location.href = '/login/?next=' + encodeURIComponent(location.pathname + location.search);
}

let refreshing = null;   // one refresh request at a time

async function refreshTokens() {
  if (!tokens.refresh) return false;
  if (!refreshing) {
    refreshing = fetch(API + 'auth/token/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh: tokens.refresh }),
    })
      .then(async (response) => {
        if (!response.ok) return false;
        tokens.save(await response.json());
        return true;
      })
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function send(url, method, payload, headers) {
  const all = { ...headers };
  if (tokens.access) all.Authorization = `Bearer ${tokens.access}`;
  return fetch(url, { method, headers: all, body: payload });
}

/**
 * api('tasks/', {method: 'POST', body: {...}})
 * Returns the parsed JSON (or null for 204). Throws ApiError on failure.
 */
export async function api(path, { method = 'GET', body, formData } = {}) {
  const url = path.startsWith('/') ? path : API + path;
  const headers = { Accept: 'application/json' };
  let payload;
  if (formData) {
    payload = formData;                          // browser sets multipart headers
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await send(url, method, payload, headers);
    if (response.status === 401 && await refreshTokens()) {
      response = await send(url, method, payload, headers);
    }
  } catch {
    throw new ApiError('Нет связи с сервером. Проверьте интернет.', 0, null);
  }

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError('Нужно войти снова.', 401, null);
  }
  if (response.status === 204) return null;

  let data = null;
  const type = response.headers.get('Content-Type') || '';
  if (type.includes('application/json')) data = await response.json();

  if (!response.ok) {
    const message = response.status === 404 ? 'Не найдено.' : errorMessage(data);
    throw new ApiError(message, response.status, data);
  }
  return data;
}

/** Load every page of a paginated list ({count, next, results}). */
export async function getAll(path) {
  let data = await api(path);
  if (!data || !Array.isArray(data.results)) return data || [];
  const items = [...data.results];
  while (data.next) {
    const next = new URL(data.next);
    data = await api(next.pathname + next.search);
    items.push(...data.results);
  }
  return items;
}

/** Login / registration through the Django forms (same messages as before). */
export async function submitAuthForm(kind, values) {
  const response = await fetch(`${API}auth/form-${kind}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(values),
  });
  const data = await response.json();
  if (!response.ok) return { errors: data.errors || {} };
  tokens.save(data);
  return { errors: null };
}

/** Log out: blacklist the refresh token on the server, then forget both tokens. */
export async function logout() {
  const refresh = tokens.refresh;
  if (refresh && tokens.access) {
    try {
      await send(API + 'auth/logout/', 'POST', JSON.stringify({ refresh }),
        { 'Content-Type': 'application/json', Accept: 'application/json' });
    } catch { /* the tokens are removed below anyway */ }
  }
  tokens.clear();
}
