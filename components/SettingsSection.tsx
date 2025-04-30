import React from 'react';
import { View, Text, StyleSheet } from "react-native";
import { ReactNode } from "react";
import { theme } from "@/constants/theme";
import { useColorScheme } from "react-native";

interface SettingsSectionProps {
    title: string;
    children: ReactNode;
}

export default function SettingsSection({ title, children }: SettingsSectionProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

    return (
        <View style={[styles.sectionContainer, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.text.primary }]}>
                {title}
            </Text>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    sectionContainer: {
        width: '100%',
        marginBottom: theme.spacing.lg,
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        ...theme.shadows.md,
        gap: theme.spacing.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: theme.spacing.md,
    },
});
