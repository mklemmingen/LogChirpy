import React from 'react';
import {View, Text, StyleSheet, Dimensions} from "react-native";
import { ReactNode } from "react";
import { theme } from "@/constants/theme";
import { useColorScheme } from "react-native";
import {BlurView} from "expo-blur";

interface SettingsSectionProps {
    title: string;
    children: ReactNode;
}

const { width } = Dimensions.get('window');
const CARD_W = width * 0.82;

export default function SettingsSection({ title, children }: SettingsSectionProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

    const mode     = useColorScheme() ?? 'light';
    const pal      = theme[mode];

    return (
        <BlurView
            intensity={60}
            tint={mode === 'dark' ? 'dark' : 'light'}
            style={[styles.card, { borderColor: pal.colors.border }]}
        >
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.text.primary }]}>
                {title}
            </Text>
            {children}
        </BlurView>
    );
}

const styles = StyleSheet.create({
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: theme.spacing.md,
    },
    card: {
        width: CARD_W,
        justifyContent: 'space-between',
        marginBottom: theme.spacing.lg,
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        gap: theme.spacing.md,
    },
});
