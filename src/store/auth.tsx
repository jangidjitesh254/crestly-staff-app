import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CurrentUser, LoginResponse } from "../types/api";
import { api, setAuthToken, setUnauthorizedHandler } from "../lib/api";

const TOKEN_KEY = "crestly.staff.token";
const USER_KEY = "crestly.staff.user";

interface AuthState {
  user: CurrentUser | null;
  token: string | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPerm: (perm: string) => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((t: string | null, u: CurrentUser | null) => {
    setAuthToken(t);
    setToken(t);
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    applySession(null, null);
  }, [applySession]);

  // A 401 from any request means the token is dead — drop the session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  // Restore a stored session on cold start.
  useEffect(() => {
    (async () => {
      try {
        const [[, t], [, u]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
        if (t && u) applySession(t, JSON.parse(u) as CurrentUser);
      } catch {
        // Corrupt storage — start signed out.
      } finally {
        setLoading(false);
      }
    })();
  }, [applySession]);

  const signIn = useCallback(
    async (phone: string, password: string) => {
      const { data } = await api.post<LoginResponse>("/auth/login", { phone, password });
      await AsyncStorage.multiSet([
        [TOKEN_KEY, data.accessToken],
        [USER_KEY, JSON.stringify(data.user)],
      ]);
      applySession(data.accessToken, data.user);
    },
    [applySession],
  );

  const hasPerm = useCallback(
    (perm: string) => Boolean(user?.permissions.includes(perm)),
    [user],
  );

  const value = useMemo<AuthState>(
    () => ({ user, token, loading, signIn, signOut, hasPerm }),
    [user, token, loading, signIn, signOut, hasPerm],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
