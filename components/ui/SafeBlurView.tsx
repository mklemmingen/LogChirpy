// components/ui/SafeBlurView.tsx - Android-only blur fallback component
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface SafeBlurViewProps {
  children?: React.ReactNode;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent' | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial' | 'systemChromeMaterial' | 'systemUltraThinMaterialLight' | 'systemThinMaterialLight' | 'systemMaterialLight' | 'systemThickMaterialLight' | 'systemChromeMaterialLight' | 'systemUltraThinMaterialDark' | 'systemThinMaterialDark' | 'systemMaterialDark' | 'systemThickMaterialDark' | 'systemChromeMaterialDark';
  style?: ViewStyle;
  fallbackColor?: string;
}

/**
 * Safe BlurView component for Android
 * Uses solid color overlay instead of blur
 */
export const SafeBlurView: React.FC<SafeBlurViewProps> = ({ 
  children, 
  intensity = 100, 
  tint = 'systemChromeMaterial',
  style,
  fallbackColor = 'rgba(0,0,0,0.8)'
}) => {
  
  // Android fallback (always used in Android-only app)
  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      {children}
      <View 
        style={[
          StyleSheet.absoluteFill, 
          { 
            backgroundColor: fallbackColor,
            elevation: 8
          }
        ]} 
      />
    </View>
  );
};

export default SafeBlurView;