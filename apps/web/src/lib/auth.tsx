import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from './api';

export type UserType = 'STAFF' | 'GUARDIAN';

export interface StaffUser {
  type: 'STAFF';
  userId: string;
  username: string;
  fullName: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  avatarUrl?: string;
}

export interface GuardianUser {
  type: 'GUARDIAN';
  studentAccountId: string;
  studentId: string;
  studentFullName: string;
  tenantId: string;
  mustChangePassword?: boolean;
  avatarUrl?: string;
}

export type AppUser = StaffUser | GuardianUser;

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (type: UserType, credentials: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapMeResponseToUser(meData: any): AppUser {
  const u = meData?.user;
  if (!u) throw new Error('INVALID_ME_RESPONSE');

  if (u.type === 'STAFF') {
    return {
      type: 'STAFF',
      userId: String(u.userId),
      tenantId: String(u.tenantId),
      username: u.profile?.username || '',
      fullName: u.profile?.full_name || '',
      roles: Array.isArray(u.roles) ? u.roles : [],
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
      avatarUrl: u.profile?.avatarUrl || undefined,
    };
  }

  return {
    type: 'GUARDIAN',
    studentAccountId: String(u.studentAccountId),
    studentId: String(u.studentId),
    tenantId: String(u.tenantId),
    studentFullName: u.profile?.students?.full_name || '',
    mustChangePassword: Boolean(u.profile?.must_change_password),
    avatarUrl: u.profile?.avatarUrl || undefined,
  };
}

function mapLoginFallback(type: UserType, data: any): AppUser {
  if (type === 'STAFF') {
    return {
      type: 'STAFF',
      userId: String(data?.staff?.id || ''),
      username: data?.staff?.username || '',
      fullName: data?.staff?.fullName || '',
      tenantId: String(data?.tenantId || ''),
      roles: Array.isArray(data?.roles) ? data.roles : [],
      permissions: Array.isArray(data?.permissions) ? data.permissions : [],
    };
  }

  return {
    type: 'GUARDIAN',
    studentAccountId: String(data?.studentAccountId || ''),
    studentId: String(data?.studentId || ''),
    tenantId: String(data?.tenantId || ''), // backend guardianLogin qaytarmasa bo'sh qolishi mumkin
    studentFullName: '',
    mustChangePassword: Boolean(data?.mustChangePassword),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    // Optimistically set cached user first for fast render
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }

    // Then validate token against server and refresh profile
    try {
      const meRes = await api.get('/auth/me');
      const profile = mapMeResponseToUser(meRes.data);
      setUser(profile);
      localStorage.setItem('user', JSON.stringify(profile));
    } catch {
      // Token invalid — api interceptor handles redirect on 401
      // If not 401 (e.g. network error), keep cached user
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (type: UserType, credentials: Record<string, string>) => {
    const endpoint = type === 'STAFF' ? '/auth/staff/login' : '/auth/guardian/login';
    const res = await api.post(endpoint, credentials);

    const token = res.data?.accessToken || res.data?.access_token;
    if (!token) throw new Error('ACCESS_TOKEN_NOT_FOUND');

    localStorage.setItem('access_token', token);

    try {
      // ✅ backendda umumiy endpoint
      const meRes = await api.get('/auth/me');
      const profile = mapMeResponseToUser(meRes.data);
      setUser(profile);
      localStorage.setItem('user', JSON.stringify(profile));
    } catch {
      const fallbackUser = mapLoginFallback(type, res.data);
      setUser(fallbackUser);
      localStorage.setItem('user', JSON.stringify(fallbackUser));
    }
  };

  const logout = async () => {
    try {
      // ✅ backendda umumiy endpoint
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const res = await api.get('/auth/me'); // ✅ umumiy endpoint
    const profile = mapMeResponseToUser(res.data);
    setUser(profile);
    localStorage.setItem('user', JSON.stringify(profile));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}