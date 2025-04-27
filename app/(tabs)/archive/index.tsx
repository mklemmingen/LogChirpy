import React, { useEffect, useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Button,
    ActivityIndicator,
    useColorScheme,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { theme } from '@/constants/theme';
import { getBirdSpottings, syncUnsyncedSpottings } from '@/services/database';

type Spotting = {
    id: number;
    bird_type: string;
    date: string;
    text_note?: string;
};

export default function ArchiveScreen() {
    const { t } = useTranslation();
    const scheme  = useColorScheme() ?? 'light';
    const colors  = theme[scheme].colors;

    const [rows, setRows]               = useState<Spotting[]>([]);
    const [loading, setLoading]         = useState(true);
    const [status, setStatus]           = useState('');
    const [query, setQuery]             = useState('');
    const [sort, setSort]               = useState<'DESC' | 'ASC'>('DESC');
    const [online, setOnline]           = useState(false);

    /** connectivity */
    useEffect(() => {
        const unsub = NetInfo.addEventListener(s => setOnline(s.isConnected ?? false));
        return () => unsub();
    }, []);

    /** fetch rows whenever sort or query changes */
    useEffect(() => {
        setLoading(true);
        setStatus(t('loading_spottings') || 'Loading...');
        try {
            let data = getBirdSpottings(50, sort);
            if (query.trim()) {
                const q = query.trim().toLowerCase();
                data = data.filter(
                    r =>
                        r.bird_type?.toLowerCase().includes(q) ||
                        r.date?.toLowerCase().includes(q)
                );
            }
            setRows(data);
            setStatus('');
        } catch (err) {
            console.error(err);
            setStatus(t('error_loading_spottings') || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [sort, query]);

    /** sync handler */
    const handleSync = async () => {
        if (!online) return;
        setStatus(t('syncing_unsynced') || 'Syncing...');
        await syncUnsyncedSpottings();
        setStatus(t('sync_complete') || 'Done!');
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                {!!status && <Text style={{ marginTop: 10, color: colors.text.secondary }}>{status}</Text>}
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <TextInput
                style={[
                    styles.input,
                    { backgroundColor: colors.card, color: colors.text.primary, borderColor: colors.border },
                ]}
                placeholder={t('search_placeholder') || 'Search...'}
                placeholderTextColor={colors.text.secondary}
                value={query}
                onChangeText={setQuery}
            />

            <View style={styles.row}>
                <Button title={t('sort_newest') || 'Newest'} onPress={() => setSort('DESC')} />
                <Button title={t('sort_oldest') || 'Oldest'}  onPress={() => setSort('ASC')}  />
                {online && <Button title={t('sync_now') || 'Sync'} onPress={handleSync} />}
            </View>

            {!!status && <Text style={{ textAlign: 'center', marginVertical: 6, color: colors.text.secondary }}>{status}</Text>}

            <FlatList
                data={rows}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={
                    <Text style={{ textAlign: 'center', marginTop: 32, color: colors.text.secondary }}>
                        {t('no_spottings_found') || 'Nothing here.'}
                    </Text>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.card, { backgroundColor: colors.card }]}
                        onPress={() =>
                            router.push({ pathname: '/archive/detail/[id]', params: { id: item.id } })
                        }
                    >
                        <Text style={[styles.title, { color: colors.text.primary }]}>
                            {item.bird_type || t('unknown_bird') || 'Unknown Bird'}
                        </Text>
                        <Text style={{ color: colors.text.secondary }}>
                            {new Date(item.date).toLocaleDateString()}
                        </Text>
                        {!!item.text_note && (
                            <Text style={{ color: colors.text.secondary }} numberOfLines={2}>
                                {item.text_note}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
    input: {
        height: 48,
        borderWidth: 1,
        borderRadius: theme.borderRadius.md,
        margin: 16,
        paddingHorizontal: 16,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 8,
    },
    card: {
        borderRadius: theme.borderRadius.lg,
        padding: 16,
        marginBottom: 16,
        ...theme.shadows.sm,
    },
    title: { fontSize: 18, fontWeight: 'bold' },
});
