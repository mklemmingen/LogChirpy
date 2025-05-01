import React, { memo, useEffect, useState } from 'react';
import {
    View, Text, Image, Pressable, ScrollView,
    ActivityIndicator, StyleSheet, useColorScheme, Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { getSpottingById } from '@/services/database';
import { theme as appTheme } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

/* ─────────────── helpers & constants ─────────────── */
type Row = Awaited<ReturnType<typeof getSpottingById>>;
type Size = 'full' | 'half';
type Tile = {
    type : 'image' | 'video' | 'audio' | 'text';
    key  : string;
    span : Size;
    /** media  */  uri?  : string;
    /** text   */  label?: string;
    /** text + audio display text */
    value?: string;
};

const COL_GAP   = 12;
const SCREEN_W  = Dimensions.get('window').width;
const HALF_W    = (SCREEN_W - COL_GAP * 3) / 2;
const FULL_W    = SCREEN_W - COL_GAP * 2;
const randH = (span: Size) => span === 'full'
    ? 180 + Math.random() * 50
    : 120 + Math.random() * 60;

type Palette = { colors: { [k: string]: string } };

/* ─────────────── tile component ─────────────── */
const TileCard = memo(function TileCard({
                                            tile,
                                            palette,
                                        }: {
    tile: Tile;
    palette: Palette;
}) {
    const base = [
        styles.tile,
        {
            width: tile.span === 'full' ? FULL_W : HALF_W,
            backgroundColor: palette.colors.card,
        },
    ];

    /* media ──────────────────── */
    if (tile.type === 'image' || tile.type === 'video') {
        return (
            <Pressable
                style={[...base, { height: randH(tile.span), overflow: 'hidden' }]}
                onPress={
                    tile.type === 'video'
                        ? async () => {
                            const { sound } = await Audio.Sound.createAsync(
                                { uri: tile.uri! },
                                { shouldPlay: true }
                            );
                        }
                        : undefined
                }
            >
                <Image source={{ uri: tile.uri! }} style={{ flex: 1, resizeMode: 'cover' }} />
                {tile.type === 'video' && (
                    <View style={styles.playOverlay}>
                        <Text style={styles.playTriangle}>▶</Text>
                    </View>
                )}
            </Pressable>
        );
    }

    /* audio ──────────────────── */
    if (tile.type === 'audio') {
        return (
            <Pressable
                style={[...base, styles.audioBox, { height: 80 }]}
                onPress={async () => {
                    const { sound } = await Audio.Sound.createAsync(
                        { uri: tile.uri! },
                        { shouldPlay: true }
                    );
                }}
            >
                <Text style={[styles.audioLabel, { color: palette.colors.text ?? '#fff' }]}>
                    {tile.value}
                </Text>
            </Pressable>
        );
    }

    /* text ───────────────────── */
    return (
        <View style={[...base, { padding: 12 }]}>
            <Text style={[styles.label, { color: palette.colors.text?.secondary ?? '#888' }]}>
                {tile.label}
            </Text>
            <Text style={[styles.value, { color: palette.colors.text?.primary ?? '#000' }]}>
                {tile.value}
            </Text>
        </View>
    );
});

/* ─────────────── main screen ─────────────── */
export default function ArchiveDetailScreen() {
    const { id }      = useLocalSearchParams<{ id: string }>();
    const { t }       = useTranslation();
    const [entry, setEntry]   = useState<Row | null>(null);
    const [loading, setLoading] = useState(true);

    const scheme   = useColorScheme() ?? 'light';
    const palette  = appTheme[scheme];

    useEffect(() => {
        (async () => {
            try { setEntry(await getSpottingById(Number(id))); }
            catch (e) { console.error(e); }
            finally    { setLoading(false); }
        })();
    }, [id]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={palette.colors.primary} />
            </View>
        );
    }

    if (!entry) {
        return (
            <View style={styles.center}>
                <Text style={{ color: palette.colors.text.primary }}>
                    {t('idcard.not_found')}
                </Text>
            </View>
        );
    }

    /* build tiles */
    const tiles: Tile[] = [];

    if (entry.image_uri)
        tiles.push({ type: 'image', key: 'img', uri: entry.image_uri,
            span: Math.random() < 0.4 ? 'full' : 'half' });

    if (entry.video_uri)
        tiles.push({ type: 'video', key: 'vid', uri: entry.video_uri, span: 'half' });

    if (entry.audio_uri)
        tiles.push({ type: 'audio', key: 'aud', uri: entry.audio_uri,
            span: 'half', value: t('idcard.play_audio') });

    tiles.push(
        { type: 'text', key: 'bird', label: t('idcard.bird'),
            value: entry.bird_type || t('idcard.unknown'), span: 'half' },
        { type: 'text', key: 'date', label: t('idcard.date'),
            value: new Date(entry.date).toLocaleString(), span: 'half' },
        { type: 'text', key: 'note', label: t('idcard.notes'),
            value: entry.text_note || '—', span: 'full' },
        { type: 'text', key: 'gps', label: t('idcard.gps'),
            value: `${entry.gps_lat}, ${entry.gps_lng}`, span: 'half' },
        { type: 'text', key: 'imgai', label: t('idcard.img_ai'),
            value: entry.image_prediction || 'N/A', span: 'half' },
        { type: 'text', key: 'audai', label: t('idcard.audio_ai'),
            value: entry.audio_prediction || 'N/A', span: 'half' },
    );

    return (
        <SafeAreaView edges={['top']}
                      style={{ flex: 1, backgroundColor: palette.colors.background }}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}>
                <View style={styles.masonry}>
                    {tiles.map(tl => (
                        <TileCard key={tl.key} tile={tl} palette={palette} />
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

/* ─────────────── styles ─────────────── */
const styles = StyleSheet.create({
    center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll:  { paddingHorizontal: COL_GAP },
    masonry: { flexDirection: 'row', flexWrap: 'wrap',
        justifyContent: 'space-between', gap: COL_GAP },

    tile:    { borderRadius: appTheme.borderRadius.lg, marginBottom: COL_GAP },
    playOverlay:   { ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center', alignItems: 'center' },
    playTriangle:  { fontSize: 46, color: '#fff' },
    audioBox:      { alignItems: 'center', justifyContent: 'center',
        borderRadius: appTheme.borderRadius.lg },
    audioLabel:    { fontWeight: '600', fontSize: 16 },

    label: { fontSize: 12, fontWeight: '500', opacity: 0.7, marginBottom: 4 },
    value: { fontSize: 16, fontWeight: '600' },
});
