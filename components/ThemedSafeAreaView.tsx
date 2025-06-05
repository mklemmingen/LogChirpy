import React from 'react';
import { SafeAreaView, ViewProps } from 'react-native';
import { useTheme } from '@/hooks/useThemeColor';

interface ThemedSafeAreaViewProps extends ViewProps {
  background?: 'primary' | 'secondary' | 'tertiary';
}

export function ThemedSafeAreaView({ 
  background = 'primary', 
  style, 
  ...props 
}: ThemedSafeAreaViewProps) {
  const theme = useTheme();
  
  const backgroundColor = {
    primary: theme.colors.background.primary,
    secondary: theme.colors.background.secondary,
    tertiary: theme.colors.background.tertiary,
  }[background];

  return (
    <SafeAreaView
      {...props}
      style={[{ backgroundColor, flex: 1 }, style]}
    />
  );
}