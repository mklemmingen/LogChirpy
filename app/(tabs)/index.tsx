import React from 'react';
import {Animated, Dimensions, StyleSheet, useColorScheme, View,} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {BlurView} from 'expo-blur'; // nice glass-morphism
import * as Haptics from 'expo-haptics';

import {ThemedText} from '@/components/ThemedText';
import {ThemedView} from '@/components/ThemedView';
import {ThemedPressable} from '@/components/ThemedPressable';
import BirdAnimation from '@/components/BirdAnimation';
import {HelloWave} from '@/components/HelloWave';
import {theme} from '@/constants/theme';

/* ---------- helpers ---------- */
type FeatherName = keyof typeof Feather.glyphMap;
const { width } = Dimensions.get('window');
const CARD_W = width * 0.82;

export default function Index() {

    const { t }    = useTranslation();
    const mode     = useColorScheme() ?? 'light';
    const pal      = theme[mode];

    /* one tidy small button component */
    const ActionBtn = ({
                           icon, label, route,
                       }: {
        icon: FeatherName;
        label: string;
        route: Parameters<typeof router.push>[0];
    }) => (
        <ThemedPressable
            variant="ghost"
            direction="column"
            style={styles.btn}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(route);
            }}
        >
            <Feather name={icon} size={20} color={pal.colors.text.primary} />
            <ThemedText
                type="default"
                style={[styles.btnLabel, { color: pal.colors.text.primary }]}
                numberOfLines={2}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
            >
                {label}
            </ThemedText>
        </ThemedPressable>
    );

    return (
        <ThemedView style={{ flex: 1 }}>
            <BirdAnimation numberOfBirds={5} />

            {/* -------- greeting -------- */}
            <View style={styles.center}>
                <HelloWave />
                <ThemedText type="title"   style={styles.title}>{t('welcome')}</ThemedText>
                <ThemedText type="default" style={styles.subtitle}>{t('start_logging')}</ThemedText>
            </View>

            {/* -------- action card -------- */}
            <Animated.View
                style={[
                    styles.cardWrap
                ]}
            >
                <BlurView
                    intensity={60}
                    tint={mode === 'dark' ? 'dark' : 'light'}
                    style={[styles.card, { borderColor: pal.colors.border }]}
                >
                    <ActionBtn icon="codesandbox" label={t('buttons.objectCamera')} route="/log/objectIdentCamera" />
                </BlurView>
            </Animated.View>

            {/* -------- action card -------- */}
            <Animated.View
                style={[
                    styles.cardWrap
                ]}
            >
                <BlurView
                    intensity={60}
                    tint={mode === 'dark' ? 'dark' : 'light'}
                    style={[styles.card, { borderColor: pal.colors.border }]}
                >
                    <ActionBtn icon="camera" label={t('buttons.photo')} route="/log/photo" />
                    <ActionBtn icon="video"  label={t('buttons.video')}  route="/log/video"  />
                    <ActionBtn icon="mic"    label={t('buttons.audio')}  route="/log/audio"  />
                    <ActionBtn icon="edit"   label={t('buttons.manual')} route="/log/manual" />
                </BlurView>
            </Animated.View>
        </ThemedView>
    );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    title: {
        textAlign: 'center',
        fontSize: theme.typography.h2.fontSize,
        marginTop: theme.spacing.sm
    },
    subtitle: {
        textAlign: 'center',
        fontSize: theme.typography.body.fontSize,
        opacity: 0.8
    },

    /* frosted card */
    cardWrap: {
        alignItems: 'center',
        marginBottom: 34,
    },
    card: {
        width: CARD_W,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.xl,
        borderWidth: 1,
        gap: theme.spacing.sm,
    },

    /* buttons inside card */
    btn: {
        flex: 1,
        borderRadius: theme.borderRadius.md,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs, // Add horizontal padding
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        backgroundColor: 'transparent', // Override ThemedPressable default
        minHeight: 60, // Ensure enough height for icon + text
    },
    btnLabel: {
        fontSize: 11, // Slightly smaller to fit better
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 14, // Tighter line height
    },
});