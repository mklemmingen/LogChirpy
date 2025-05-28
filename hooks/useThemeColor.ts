import {theme} from '@/constants/theme';
import {useColorScheme} from 'react-native';

export function useThemeColor(
    props: { light?: string; dark?: string },
    colorName: keyof typeof theme.light.colors & keyof typeof theme.dark.colors
) {
  const colorScheme = useColorScheme() ?? 'light';
  const colorFromProps = props[colorScheme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return theme[colorScheme].colors[colorName];
  }
}