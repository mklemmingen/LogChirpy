import React from 'react';
import { Text, TextProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  type?: 'title' | 'default';
};

export function ThemedText({ style, type = 'default', ...rest }: ThemedTextProps) {
  const themeTextColor = useThemeColor({}, 'text'); // might be a string OR an object

  // Correctly handles both cases
  const color = typeof themeTextColor === 'string'
      ? themeTextColor
      : themeTextColor.primary;

  return (
      <Text
          style={[
            { color },
            type === 'title' && { fontSize: 24, fontWeight: 'bold' },
            type === 'default' && { fontSize: 16 },
            style,
          ]}
          {...rest}
      />
  );
}
