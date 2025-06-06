import React from 'react';
import { ScrollView, ScrollViewProps } from 'react-native';
import { useTheme } from '@/hooks/useThemeColor';

interface ThemedScrollViewProps extends ScrollViewProps {
  background?: 'primary' | 'secondary' | 'tertiary';
}

export const ThemedScrollView = React.forwardRef<ScrollView, ThemedScrollViewProps>(
  ({ background = 'primary', style, refreshControl, ...props }, ref) => {
    const theme = useTheme();
    
    const backgroundColor = {
      primary: theme.colors.background.primary,
      secondary: theme.colors.background.secondary,
      tertiary: theme.colors.background.tertiary,
    }[background];

    // If refreshControl is provided and it's a RefreshControl, apply theme colors
    const themedRefreshControl = refreshControl && React.isValidElement(refreshControl) 
      ? React.cloneElement(refreshControl, {
          tintColor: theme.colors.text.secondary,
          colors: [theme.colors.text.primary], // Android
        })
      : refreshControl;

    return (
      <ScrollView
        ref={ref}
        {...props}
        style={[{ backgroundColor }, style]}
        refreshControl={themedRefreshControl}
      />
    );
  }
);

ThemedScrollView.displayName = 'ThemedScrollView';