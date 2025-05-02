import React from 'react';
import {View, Text, StyleSheet, Dimensions} from "react-native";
import { ReactNode } from "react";
import { theme } from "@/constants/theme";
import { useColorScheme } from "react-native";
import {BlurView} from "expo-blur";

interface SettingsSectionProps {
    title?: string;
    children: ReactNode;
}

export default function Section({ title, children }: SettingsSectionProps) {
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
            {title ? (
                <Text style={[styles.sectionTitle, { color: currentTheme.colors.text.primary }]}>
                    {title}
                </Text>
            ) : null}
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
        marginBottom: 18,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 4,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
    },
});
