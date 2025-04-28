import React,{ PropsWithChildren, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { theme } from '@/constants/theme';
import { useColorScheme } from 'react-native';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';
  const currentTheme = theme[colorScheme].colors;

  return (
      <ThemedView>
        <TouchableOpacity
            style={styles.heading}
            onPress={() => setIsOpen((value) => !value)}
            activeOpacity={0.8}>
          <IconSymbol
              name="x"
              size={18}
              color={currentTheme.primary}
          />
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
        </TouchableOpacity>
        {isOpen && <ThemedView style={styles.content}>{children}</ThemedView>}
      </ThemedView>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  content: {
    marginTop: 6,
    marginLeft: 24,
  },
});