import React, { useEffect, useRef } from 'react';
import {
    StyleSheet, View, Pressable, Animated, useColorScheme, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';              // nice glass-morphism
import * as Haptics from 'expo-haptics';

import { ThemedText }    from '@/components/ThemedText';
import { ThemedView }    from '@/components/ThemedView';
import BirdAnimation     from '@/components/BirdAnimation';
import { HelloWave }     from '@/components/HelloWave';
import { theme }         from '@/constants/theme';
import { initDB }        from '@/services/database';

/* ---------- helpers ---------- */
type FeatherName = keyof typeof Feather.glyphMap;
const { width } = Dimensions.get('window');
const CARD_W = width * 0.82;

export default function Index() {

    const { t }    = useTranslation();
    const mode     = useColorScheme() ?? 'light';
    const pal      = theme[mode];

    /* once-per-app boot */
    useEffect(() => { initDB(); }, []);

    /* one tidy small button component */
    const ActionBtn = ({
                           icon, label, route,
                       }: { icon: FeatherName; label: string; route: string }) => (
        <Pressable
            style={({ pressed }) => [
                styles.btn,
                {
                    backgroundColor: pressed
                        ? pal.colors.primary + '33'
                        : pal.colors.card + 'AA',         // translucent
                },
            ]}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(route);
            }}
        >
            <Feather name={icon} size={22} color={pal.colors.text.primary} />
            <ThemedText type="default" style={[styles.btnLabel, { color: pal.colors.text.primary }]}>
                {label}
            </ThemedText>
        </Pressable>
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

/* <ActionBtn icon="camera" label={t('buttons.photo')}  route="/log/photo"  /> */

/* ---------- styles ---------- */
const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        gap: 16,
    },
    title:    { textAlign: 'center', fontSize: 24, marginTop: 8 },
    subtitle: { textAlign: 'center', fontSize: 16, opacity: 0.8 },

    /* frosted card */
    cardWrap: {
        alignItems: 'center',
        marginBottom: 34,
    },
    card: {
        width: CARD_W,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 20,
        borderWidth: 1,
        gap: 8,
    },

    /* buttons inside card */
    btn: {
        flex: 1,
        minWidth: (CARD_W - 18 * 2 - 8 * 3) / 4, // equal width inc. gaps
        borderRadius: 14,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    btnLabel: { fontSize: 12, fontWeight: '600' },
});
