import React from 'react';
import { View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useThemeColor';

interface ThemedSafeAreaViewProps extends ViewProps {
  background?: 'primary' | 'secondary' | 'tertiary';
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function ThemedSafeAreaView({ 
  background = 'primary', 
  edges = ['top', 'bottom', 'left', 'right'],
  style, 
  ...props 
}: ThemedSafeAreaViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const backgroundColor = {
    primary: theme.colors.background.primary,
    secondary: theme.colors.background.secondary,
    tertiary: theme.colors.background.tertiary,
  }[background];

  const paddingStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <View
      {...props}
      style={[{ backgroundColor, flex: 1 }, paddingStyle, style]}
    />
  );
}