import React from 'react';
import { TextInput, TextInputProps, StyleSheet, View } from 'react-native';
import { useTheme } from '@/hooks/useThemeColor';
import { ThemedText } from './ThemedText';

interface ThemedTextInputProps extends Omit<TextInputProps, 'placeholderTextColor'> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'default' | 'filled' | 'outlined';
}

export function ThemedTextInput({ 
  label,
  error,
  helperText,
  variant = 'outlined',
  style,
  ...props 
}: ThemedTextInputProps) {
  const theme = useTheme();
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: theme.colors.background.secondary,
          borderWidth: 0,
          borderBottomWidth: 1,
          borderBottomColor: error ? theme.colors.status.error : theme.colors.border.primary,
        };
      case 'outlined':
      default:
        return {
          backgroundColor: theme.colors.background.primary,
          borderWidth: 1,
          borderColor: error ? theme.colors.status.error : theme.colors.border.primary,
          borderRadius: theme.borderRadius.sm,
        };
    }
  };

  return (
    <View style={styles.container}>
      {label && (
        <ThemedText variant="label" style={styles.label}>
          {label}
        </ThemedText>
      )}
      
      <TextInput
        {...props}
        style={[
          styles.input,
          getVariantStyles(),
          {
            color: theme.colors.text.primary,
            paddingHorizontal: theme.spacing.md,
          },
          style,
        ]}
        placeholderTextColor={theme.colors.text.tertiary}
      />
      
      {error && (
        <ThemedText 
          variant="caption" 
          style={[styles.helperText, { color: theme.colors.status.error }]}
        >
          {error}
        </ThemedText>
      )}
      
      {helperText && !error && (
        <ThemedText 
          variant="caption" 
          style={[styles.helperText, { color: theme.colors.text.secondary }]}
        >
          {helperText}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: 4,
  },
  input: {
    height: 48,
    fontSize: 16,
  },
  helperText: {
    marginTop: 4,
  },
});