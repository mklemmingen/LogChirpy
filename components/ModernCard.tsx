// Minimal card component for clean layouts
// Simple, accessible, and professional

import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle, Image } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { useColors, useBorderRadius, useShadows } from '@/hooks/useThemeColor';
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
  const colors = useColors();
  const borderRadius = useBorderRadius();
  const shadows = useShadows();

  const cardContent = (
    <ThemedView
      style={[
        styles.card,
        {
          borderRadius: borderRadius.lg,
          ...(bordered && {
            borderWidth: 1,
            borderColor: colors.border,
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

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 160,
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 12,
  },
});