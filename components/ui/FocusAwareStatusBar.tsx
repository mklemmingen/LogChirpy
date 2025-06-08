// components/ui/FocusAwareStatusBar.tsx - Single focus-aware StatusBar to prevent conflicts
import React from 'react';
import { StatusBar, StatusBarProps } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';

interface FocusAwareStatusBarProps extends StatusBarProps {
  style?: 'auto' | 'inverted' | 'light' | 'dark';
  backgroundColor?: string;
}

/**
 * Focus-Aware StatusBar Component
 * Prevents multiple StatusBar components from causing conflicts
 * Only renders StatusBar for the currently focused screen
 */
export const FocusAwareStatusBar: React.FC<FocusAwareStatusBarProps> = ({ 
  style = 'auto', 
  backgroundColor = 'transparent',
  ...props 
}) => {
  const isFocused = useIsFocused();
  
  // Only render StatusBar for focused screen to prevent conflicts
  if (!isFocused) return null;
  
  return (
    <StatusBar 
      style={style}
      backgroundColor={backgroundColor}
      translucent={true}
      {...props}
    />
  );
};

export default FocusAwareStatusBar;