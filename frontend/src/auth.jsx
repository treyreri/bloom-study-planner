/* Who is logged in: profile + the server's "today". */
import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, tokens } from './api/client.js';
import { setServerToday } from './lib/bloom.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const hasToken = Boolean(tokens.access);

  // The old site reloaded the page on every navigation, so the sidebar,
  // the accent colour and "today" were always fresh. Do the same here.
  useEffect(() => {
    if (!tokens.access) {
      setProfile(null);
      document.body.dataset.accent = 'pink';
      return undefined;
    }
    let cancelled = false;
    Promise.all([api('profile/'), api('server-date/')])
      .then(([data, date]) => {
        if (cancelled) return;
        setServerToday(date.date);
        setProfile(data);
        document.body.dataset.accent = data.accent_color || 'pink';
      })
      .catch(() => { /* a 401 already sent the user to the login page */ });
    return () => { cancelled = true; };
  }, [location.pathname, location.search]);

  const value = { profile, hasToken };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** "/focus/?start=1" -> "/focus/%3Fstart%3D1" (same as Django's login_required) */
export function loginUrl(location) {
  const next = encodeURIComponent(location.pathname + location.search).replace(/%2F/g, '/');
  return `/login/?next=${next}`;
}

/** Pages after login: no token -> login page; wait for the profile the first time. */
export function RequireAuth({ children }) {
  const location = useLocation();
  const { profile, hasToken } = useAuth();
  if (!hasToken) return <Navigate to={loginUrl(location)} replace />;
  if (!profile) return null;
  return children;
}

/** Landing, login and register: a logged-in user goes straight to /today/. */
export function PublicOnly({ children }) {
  const { hasToken } = useAuth();
  if (hasToken) return <Navigate to="/today/" replace />;
  return children;
}
