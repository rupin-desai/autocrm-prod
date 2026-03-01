import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from './queryClient';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  mobileNumber?: string;
  permissions?: Record<string, string[]>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  sendOTP: (mobileNumber: string) => Promise<void>;
  verifyOTP: (otp: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const { data: userData, isLoading, error } = useQuery<User>({
    queryKey: ['/api/auth/me'],
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (userData) {
      setUser(userData);
    } else if (!isLoading) {
      setUser(null);
    }
  }, [userData, isLoading]);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await apiRequest('POST', '/api/auth/login', { email, password });
      return response.json();
    },
    onSuccess: async (data) => {
      setUser(data);
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      await queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ email, password, name, role }: { email: string; password: string; name: string; role?: string }) => {
      const response = await apiRequest('POST', '/api/auth/register', { email, password, name, role });
      return response.json();
    },
    onSuccess: (data) => {
      setUser(data);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/auth/logout');
    },
    onSuccess: () => {
      setUser(null);
      queryClient.clear();
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const register = async (email: string, password: string, name: string, role?: string) => {
    await registerMutation.mutateAsync({ email, password, name, role });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const sendOTPMutation = useMutation({
    mutationFn: async ({ mobileNumber }: { mobileNumber: string }) => {
      const response = await apiRequest('POST', '/api/auth/send-otp', { mobileNumber });
      return response.json();
    },
  });

  const verifyOTPMutation = useMutation({
    mutationFn: async ({ otp }: { otp: string }) => {
      const response = await apiRequest('POST', '/api/auth/verify-otp', { otp });
      return response.json();
    },
    onSuccess: async (data) => {
      setUser(data);
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      await queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const sendOTP = async (mobileNumber: string) => {
    await sendOTPMutation.mutateAsync({ mobileNumber });
  };

  const verifyOTP = async (otp: string) => {
    await verifyOTPMutation.mutateAsync({ otp });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, sendOTP, verifyOTP }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function hasPermission(user: User | null, resource: string, action: string): boolean {
  if (!user?.permissions) return false;
  const resourcePermissions = user.permissions[resource];
  if (!resourcePermissions) return false;
  return resourcePermissions.includes(action);
}
