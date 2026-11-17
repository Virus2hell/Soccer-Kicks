// Login state for the whole app (React Context).
// Wrap the app in <AuthProvider> and read it anywhere with useAuth().

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

import type { Profile } from '@/game/types';
import { SERVER_URL, WAKE_UP_TIMEOUT_MS } from '@/lib/config';
import { connect, request } from '@/lib/socket';

const TOKEN_KEY = 'auth-token';

type Status = 'loading' | 'loggedOut' | 'loggedIn';

type AuthContextValue = {
  status: Status;
  profile: Profile | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Calls a profile:* event on the server and stores the updated profile */
  call: <T extends object>(event: string, payload?: object) => Promise<T & { profile?: Profile }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Connects to the server and re-authenticates after every reconnect
  const attach = useCallback(() => {
    const socket = connect(SERVER_URL);
    socket.off('connect').on('connect', () => {
      const token = tokenRef.current;
      if (!token) return;
      socket.emit('auth:token', { token }, (res: { ok: boolean; profile?: Profile }) => {
        if (res?.ok && res.profile) setProfile(res.profile);
      });
    });
    socket.off('profile:update').on('profile:update', (p: Profile) => setProfile(p));
  }, []);

  // On app start: try the saved login
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
      if (!token) {
        setStatus('loggedOut');
        return;
      }
      tokenRef.current = token;
      attach();
      try {
        const res = await request<{ profile: Profile }>('auth:token', { token }, WAKE_UP_TIMEOUT_MS);
        setProfile(res.profile);
        setStatus('loggedIn');
      } catch {
        setStatus('loggedOut');
      }
    })();
  }, [attach]);

  const signIn = useCallback(
    async (event: 'auth:login' | 'auth:register', username: string, password: string) => {
      attach();
      const res = await request<{ token: string; profile: Profile }>(event, { username, password }, WAKE_UP_TIMEOUT_MS);
      tokenRef.current = res.token;
      await AsyncStorage.setItem(TOKEN_KEY, res.token);
      setProfile(res.profile);
      setStatus('loggedIn');
    },
    [attach]
  );

  const logout = useCallback(async () => {
    await request('auth:logout', { token: tokenRef.current }).catch(() => {});
    tokenRef.current = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
    setProfile(null);
    setStatus('loggedOut');
  }, []);

  const call = useCallback(async <T extends object>(event: string, payload: object = {}) => {
    const res = await request<T & { profile?: Profile }>(event, payload);
    if (res.profile) setProfile(res.profile);
    return res;
  }, []);

  const value: AuthContextValue = {
    status,
    profile,
    login: (u, p) => signIn('auth:login', u, p),
    register: (u, p) => signIn('auth:register', u, p),
    logout,
    call,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
