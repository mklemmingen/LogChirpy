import { View, type ViewProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = String(useThemeColor({ light: lightColor, dark: darkColor }, 'background'));

  return (
      <View
          style={[{ flex: 1, backgroundColor }, style]} // Added flex: 1 here
          {...otherProps}
      />
  );
}
