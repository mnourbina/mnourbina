import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = checking, undefined = anonymous, object = user
  const [user, setUser] = useState(null);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("khalaba_token");
    if (!token) {
      setUser(undefined);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("khalaba_token");
      setUser(undefined);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("khalaba_token", data.token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e) };
    }
  };

  const logout = () => {
    localStorage.removeItem("khalaba_token");
    setUser(undefined);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function roleHome(role) {
  if (role === "patient") return "/portail/patiente";
  if (role === "admin") return "/portail/admin";
  return "/portail/pro";
}
