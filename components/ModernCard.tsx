// Minimal card component for clean layouts
// Simple, accessible, and professional

import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle, Image } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import { useBorderRadius, useShadows, useTheme } from '@/hooks/useThemeColor';
import { ImageSourcePropType } from "react-native";

interface ModernCardProps {
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  
  // Content
  title?: string;
  subtitle?: string;
  image?: ImageSourcePropType;
  
  // Style options
  elevated?: boolean;
  bordered?: boolean;
}

export function ModernCard({
  children,
  onPress,
  disabled = false,
  style,
  title,
  subtitle,
  image,
  elevated = false,
  bordered = true,
}: ModernCardProps) {
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();
  const borderRadius = useBorderRadius();
  const shadows = useShadows();
  const theme = useTheme();
  
  const styles = createStyles(dimensions);

  const cardContent = (
    <ThemedView
      style={[
        styles.card,
        {
          borderRadius: borderRadius.lg,
          ...(bordered && {
            borderWidth: 1,
            borderColor: colors.border.primary,
          }),
          ...(elevated && shadows.md),
        },
        style,
      ]}
      background="surface"
    >
      {image && (
        <Image 
          source={image} 
          style={[
            styles.image,
            { borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg }
          ]} 
          resizeMode="cover" 
        />
      )}
      
      <View style={styles.content}>
        {title && (
          <ThemedText variant="h3" style={styles.title}>
            {title}
          </ThemedText>
        )}
        
        {subtitle && (
          <ThemedText variant="bodySmall" color="secondary" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        )}
        
        {children}
      </View>
    </ThemedView>
  );

  if (onPress) {
    return (
      <Pressable 
        onPress={onPress} 
        disabled={disabled}
        style={({ pressed }) => [
          { opacity: pressed ? 0.95 : 1 },
          disabled && { opacity: 0.5 }
        ]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

const createStyles = (dimensions: ReturnType<typeof useResponsiveDimensions>) => StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: dimensions.screen.isSmall ? 120 * dimensions.multipliers.size : dimensions.screen.isLarge ? 200 * dimensions.multipliers.size : 160 * dimensions.multipliers.size,
  },
  content: {
    padding: dimensions.layout.componentSpacing,
  },
  title: {
    marginBottom: dimensions.layout.componentSpacing / 4,
  },
  subtitle: {
    marginBottom: dimensions.layout.componentSpacing / 2,
  },
});