import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not authed

  const flattenUser = (data) => {
    if (!data) return null;
    const active = data.memberships?.find(m => m.status === 'active');
    return {
      ...data,
      role: active?.role ?? null,
      org_id: active?.org_id ?? null,
      org_name: active?.org_name ?? null,
      accent_color: active?.accent_color ?? null,
      is_superadmin: !!data.is_superadmin,
    };
  };

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setUser(flattenUser(data)))
      .catch(() => setUser(null));
  }, []);

  const login = async (email, password) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    const me = await fetch('/api/auth/me', { credentials: 'include' }).then(x => x.json());
    setUser(flattenUser(me));
    return data;
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await fetch('/api/auth/me', { credentials: 'include' }).then(x => x.ok ? x.json() : null);
    setUser(flattenUser(me));
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
