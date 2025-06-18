import React, { useEffect } from 'react';
import { router, Href } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: Href<string>;
  requireAuth?: boolean;
}

export function ProtectedRoute({
  children,
  redirectTo = '/(tabs)/account/(auth)/login' as Href<string>,
  requireAuth = true,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (requireAuth && !isAuthenticated) {
        router.replace(redirectTo);
      } else if (!requireAuth && isAuthenticated) {
        router.replace('/(tabs)/account/profile' as Href<string>);
      }
    }
  }, [isLoading, isAuthenticated, requireAuth, redirectTo]);

  if (isLoading) {
    return null;
  }

  if (requireAuth && !isAuthenticated) {
    return null;
  }

  if (!requireAuth && isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}