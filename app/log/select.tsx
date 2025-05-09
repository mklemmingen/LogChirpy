import React, { useEffect, useState, useCallback } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    FlatList,
    TextInput,
    Pressable,
    StyleSheet,
    useColorScheme,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import {
    getBirdSpottings,
    type BirdSpotting,
    updateLatinBirDex,
} from '@/services/database';

/**
 * Selection screen to assign a Latin name to an existing spotting.
 * Receives `latin` via route params.
 * Allows the user to go back, search, sort, and choose an entry.
 */
export default function SelectSpottingScreen() {
    const { t } = useTranslation();
    const scheme = useColorScheme() ?? 'light';
    const pal = theme[scheme];
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { latin } = useLocalSearchParams<{ latin: string }>();

    const [rows, setRows] = useState<BirdSpotting[]>([]);
    const [query, setQuery] = useState('');
    const [sortDir, setSortDir] = useState<'DESC' | 'ASC'>('DESC');
    const [loading, setLoading] = useState(true);

    // Load and filter data
    const loadData = useCallback(() => {
        setLoading(true);
        try {
            let data = getBirdSpottings(100, sortDir);
            if (query.trim()) {
                const q = query.trim().toLowerCase();
                data = data.filter(
                    (r) =>
                        r.birdType.toLowerCase().includes(q) ||
                        r.date.toLowerCase().includes(q)
                );
            }
            setRows(data);
        } catch (e) {
            console.error(e);
            Alert.alert(t('select.error'), t('select.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [query, sortDir, t]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Confirm and update DB
    const handleSelect = (id: number) => {
        Alert.alert(
            t('select.confirmTitle'),
            t('select.confirmMessage', {
                latin,
                date: new Date(
                    rows.find((r) => r.id === id)?.date || ''
                ).toLocaleDateString(),
            }),
            [
                { text: t('select.cancel'), style: 'cancel' },
                {
                    text: t('select.ok'),
                    onPress: () => {
                        try {
                            updateLatinBirDex(id, latin);
                            Alert.alert(t('select.success'), t('select.successMessage'));
                            router.back();
                        } catch (err) {
                            console.error(err);
                            Alert.alert(t('select.error'), t('select.updateFailed'));
                        }
                    },
                },
            ]
        );
    };

    // Toggle sort direction
    const toggleSort = () => {
        setSortDir((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'));
    };

    // Row renderer
    const renderItem = ({ item }: { item: BirdSpotting }) => (
        <Pressable
            style={[styles.row, { borderColor: pal.colors.border }]}
            onPress={() => handleSelect(item.id)}
        >
            <Text style={[styles.cell, { color: pal.colors.text.primary }]}>
                {item.birdType || t('select.unknown')}
            </Text>
            <Text style={[styles.cell, { color: pal.colors.text.secondary }]}>
                {new Date(item.date).toLocaleDateString()}
            </Text>
            <Text style={styles.chooseText}>{t('select.choose')}</Text>
        </Pressable>
    );

    // While loading
    if (loading) {
        return (
            <SafeAreaView
                style={[
                    styles.container,
                    { paddingTop: insets.top, backgroundColor: pal.colors.background },
                ]}
            >
                <ActivityIndicator size="large" color={pal.colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView
            style={[
                styles.container,
                { paddingTop: insets.top, backgroundColor: pal.colors.background },
            ]}
        >
            {/* Header with back button and instructions */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={[styles.backText, { color: pal.colors.primary }]}>
                        ← {t('select.back')}
                    </Text>
                </Pressable>
                <Text style={[styles.instructions, { color: pal.colors.text.primary }]}>
                    {t('select.instructions')}
                </Text>
            </View>

            {/* Search & Sort */}
            <View style={[styles.searchWrap, { borderColor: pal.colors.border }]}>
                <TextInput
                    style={[styles.input, { color: pal.colors.text.primary }]}
                    placeholder={t('select.searchPlaceholder')}
                    placeholderTextColor={pal.colors.text.secondary}
                    value={query}
                    onChangeText={setQuery}
                />
                <Pressable style={styles.sortButton} onPress={toggleSort}>
                    <Text style={[styles.sortText, { color: pal.colors.primary }]}>
                        {sortDir === 'DESC' ? t('select.sortNewest') : t('select.sortOldest')}
                    </Text>
                </Pressable>
            </View>

            {/* List of spot entries to choose from */}
            <FlatList
                data={rows}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={
                    rows.length === 0 ? styles.emptyWrapper : undefined
                }
                ListEmptyComponent={
                    <Text
                        style={[styles.emptyText, { color: pal.colors.text.secondary }]}
                    >
                        {t('select.empty')}
                    </Text>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'column',
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    backButton: { alignSelf: 'flex-start', marginBottom: 8 },
    backText: { fontSize: 16, fontWeight: '600' },
    instructions: { fontSize: 14, marginBottom: 12 },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: theme.borderRadius.md,
        marginHorizontal: 16,
        paddingHorizontal: 12,
        height: 44,
        marginBottom: 8,
    },
    input: { flex: 1, fontSize: 16, marginRight: 8 },
    sortButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: theme.dark.colors.background,
    },
    sortText: { fontSize: 14, fontWeight: '600' },
    row: {
        flexDirection: 'row',
        paddingVertical: 12,
        marginHorizontal: 16,
        borderBottomWidth: 1,
    },
    cell: { flex: 1, paddingHorizontal: 4 },
    chooseText: {
        color: theme.dark.colors.primary,
        fontWeight: '500',
        paddingHorizontal: 8,
    },
    emptyWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 16, textAlign: 'center' },
});
