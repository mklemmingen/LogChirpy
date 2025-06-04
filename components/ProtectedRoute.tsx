import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/app/context/AuthContext';
import { useSemanticColors } from '@/hooks/useThemeColor';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ children, redirectTo = '/account/login' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const semanticColors = useSemanticColors();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(redirectTo as any);
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: semanticColors.background }}>
        <ActivityIndicator size="large" color={semanticColors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}