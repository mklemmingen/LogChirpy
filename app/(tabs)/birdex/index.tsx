import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    FlatList,
    TextInput,
    Pressable,
    StyleSheet,
    useColorScheme,
    ActivityIndicator,
    Linking,
    Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import BirdAnimation from '@/components/BirdAnimation';
import { theme } from '@/constants/theme';
import {
    initBirdDexDB,
    queryBirdDexBatch,
    type BirdDexRecord,
} from '@/services/databaseBirDex';
import { hasSpottingForLatin } from '@/services/database';
import { fetchLocalizedNamesBatch } from '@/services/wikipediaService';

const BATCH_SIZE = 50;

type DisplayRecord = BirdDexRecord & {
    displayName: string;
    logged: boolean;
};

const BirdDexIndex: React.FC = () => {
    const { i18n, t } = useTranslation();
    const router = useRouter();
    const scheme = useColorScheme() ?? 'light';
    const pal = theme[scheme];

    // Pagination/filter/sort state
    const [displayList, setDisplayList] = useState<DisplayRecord[]>([]);
    const [searchText, setSearchText] = useState('');
    const [sortKey, setSortKey] = useState<keyof BirdDexRecord>('english_name');
    const [sortAscending, setSortAscending] = useState(true);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Loading flags
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const initedRef = useRef(false);

    // Load a page of records
    const loadBatch = useCallback(
        async (reset = false) => {
            // Reset states if refreshing
            if (reset) {
                setIsRefreshing(true);
                setOffset(0);
                setHasMore(true);
            }

            const pageOffset = reset ? 0 : offset;

            try {
                // Fetch raw batch
                const raw = queryBirdDexBatch(
                    searchText.trim(),
                    sortKey,
                    sortAscending,
                    BATCH_SIZE,
                    pageOffset
                );

                // Map to display model
                const batch: DisplayRecord[] = raw.map(item => ({
                    ...item,
                    displayName: item.english_name,
                    logged: hasSpottingForLatin(item.scientific_name),
                }));

                // Fetch localized names
                try {
                    const sciNames = batch.map(b => b.scientific_name);
                    const localized = await fetchLocalizedNamesBatch(
                        sciNames,
                        i18n.language
                    );
                    batch.forEach(b => {
                        const loc = localized[b.scientific_name];
                        if (loc) b.displayName = loc;
                    });
                } catch (err) {
                    console.warn('Localization failed', err);
                }

                // Append or replace
                if (reset) {
                    setDisplayList(batch);
                } else {
                    setDisplayList(prev => [...prev, ...batch]);
                }

                // Update offset and hasMore
                setOffset(prev => reset ? batch.length : prev + batch.length);
                if (batch.length < BATCH_SIZE) {
                    setHasMore(false);
                }
            } catch (err) {
                console.error('Error loading batch:', err);
                Alert.alert(t('birddex.error'), t('birddex.loadBatchFailed'));
            } finally {
                if (reset) setIsRefreshing(false);
                if (isInitialLoading) setIsInitialLoading(false);
                setIsLoadingMore(false);
            }
        },
        [searchText, sortKey, sortAscending, offset, i18n.language, t, isInitialLoading]
    );

    // initialize DB then load first batch
    useEffect(() => {
        (async () => {
            try {
                if (!initedRef.current) {
                    await initBirdDexDB();
                    initedRef.current = true;
                }
            } catch (err) {
                console.error('DB init error:', err);
                Alert.alert(t('birddex.error'), t('birddex.initFailed'));
            } finally {
                await loadBatch(true);
            }
        })();
    }, [loadBatch, t]);

    // reload on filter/sort change
    useEffect(() => {
        loadBatch(true);
    }, [searchText, sortKey, sortAscending, loadBatch]);

    // infinite scroll
    const onEndReached = () => {
        if (hasMore && !isInitialLoading && !isRefreshing && !isLoadingMore) {
            setIsLoadingMore(true);
            loadBatch(false);
        }
    };

    // sort toggler
    const toggleSort = (key: keyof BirdDexRecord) => {
        if (key === sortKey) {
            setSortAscending(p => !p);
        } else {
            setSortKey(key);
            setSortAscending(true);
        }
    };

    // navigation to log select
    const handleLog = (latin: string) => {
        router.push({ pathname: '/log/select', params: { latin } });
    };

    // Wikipedia opener
    const handleWiki = (sci: string) => {
        const title = encodeURIComponent(sci.replace(/ /g, '_'));
        const url = `https://${i18n.language}.wikipedia.org/wiki/${title}`;
        Linking.openURL(url).catch(e => {
            console.error('Wiki open error:', e);
            Alert.alert(t('birddex.error'), t('birddex.openWikiFailed'));
        });
    };

    // item renderer
    const renderItem = useCallback(
        ({ item }: { item: DisplayRecord }) => (
            <View
                style={[
                    styles.row,
                    { borderColor: pal.colors.border },
                    item.logged && { backgroundColor: pal.colors.primary + '20' },
                ]}
            >
                <Text style={[styles.cell, { color: pal.colors.text.primary }]}>
                    {item.displayName}
                </Text>
                <Text style={[styles.cell, { color: pal.colors.text.secondary }]}>
                    {item.scientific_name}
                </Text>
                <View style={[styles.cell, styles.loggedCol]}>
                    <Text>{item.logged ? '✅' : ''}</Text>
                </View>
                <Pressable
                    style={({ pressed }) => [
                        styles.actionButton,
                        pressed && { opacity: 0.6 },
                    ]}
                    onPress={() => handleLog(item.scientific_name)}
                >
                    <Text style={[styles.buttonText, { color: pal.colors.primary }]}>
                        {t('birddex.log')}
                    </Text>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [
                        styles.actionButton,
                        pressed && { opacity: 0.6 },
                    ]}
                    onPress={() => handleWiki(item.scientific_name)}
                >
                    <Text style={[styles.buttonText, { color: pal.colors.primary }]}>
                        {t('birddex.wikipedia')}
                    </Text>
                </Pressable>
            </View>
        ),
        [pal.colors, t]
    );

    // header
    const renderHeader = () => (
        <View style={[styles.headerRow, { backgroundColor: pal.colors.card }]}>
            <Pressable style={styles.headerCell} onPress={() => toggleSort('english_name')}>
                <Text style={{ color: pal.colors.text.primary }}>
                    {t('birddex.name')} {sortKey === 'english_name' ? (sortAscending ? '↑' : '↓') : ''}
                </Text>
            </Pressable>
            <Pressable style={styles.headerCell} onPress={() => toggleSort('scientific_name')}>
                <Text style={{ color: pal.colors.text.primary }}>
                    {t('birddex.scientific')} {sortKey === 'scientific_name' ? (sortAscending ? '↑' : '↓') : ''}
                </Text>
            </Pressable>
            <View style={[styles.headerCell, styles.loggedCol]}>
                <Text style={{ color: pal.colors.text.primary }}>{t('birddex.logged')}</Text>
            </View>
            <View style={styles.headerCell}>
                <Text style={{ color: pal.colors.text.primary }}>{t('birddex.action')}</Text>
            </View>
            <View style={styles.headerCell}>
                <Text style={{ color: pal.colors.text.primary }}>{t('birddex.wikipedia')}</Text>
            </View>
        </View>
    );

    // empty state
    const ListEmpty = () =>
        isRefreshing ? (
            <View style={styles.emptyWrapper}>
                <ActivityIndicator size="large" color={pal.colors.primary} />
                <Text style={[styles.emptyText, { color: pal.colors.text.secondary }]}>
                    {t('birddex.loadingEntries')}
                </Text>
            </View>
        ) : (
            <Text style={[styles.emptyText, { color: pal.colors.text.secondary }]}>
                {t('birddex.noResults')}
            </Text>
        );

    // footer spinner
    const renderFooter = () =>
        isLoadingMore ? <ActivityIndicator style={{ margin: 16 }} color={pal.colors.primary} /> : null;

    // initial loading screen
    if (isInitialLoading) {
        return (
            <SafeAreaView
                style={[
                    styles.container,
                    { backgroundColor: pal.colors.background, justifyContent: 'center', alignItems: 'center' },
                ]}
            >
                <BirdAnimation numberOfBirds={5} />
                <ActivityIndicator size="large" color={pal.colors.primary} />
                <Text style={[styles.loadingText, { color: pal.colors.text.primary }]}>
                    {t('birddex.initializingDb')}
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>
            <View style={[styles.searchWrap, { borderColor: pal.colors.border }]}>
                <TextInput
                    style={[styles.input, { color: pal.colors.text.primary }]}
                    placeholder={t('birddex.searchPlaceholder')}
                    placeholderTextColor={pal.colors.text.secondary}
                    value={searchText}
                    onChangeText={setSearchText}
                />
                <Pressable
                    style={({ pressed }) => [
                        styles.reloadButton,
                        { backgroundColor: pal.colors.primary },
                        pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => loadBatch(true)}
                >
                    <Text style={[styles.buttonText, { color: pal.colors.text.light }]}>
                        {t('birddex.reload')}
                    </Text>
                </Pressable>
            </View>

            <FlatList<DisplayRecord>
                data={displayList}
                keyExtractor={item => item.species_code}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={ListEmpty}
                ListFooterComponent={renderFooter}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.5}
                showsVerticalScrollIndicator
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={21}
                contentContainerStyle={displayList.length === 0 ? { flex: 1, justifyContent: 'center' } : undefined}
            />
        </SafeAreaView>
    );
};

export default BirdDexIndex;

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingText: { fontSize: 16, marginTop: 8 },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: theme.borderRadius.md,
        margin: 16,
        paddingHorizontal: 12,
        height: 44,
    },
    input: { flex: 1, fontSize: 16, marginRight: 8 },
    reloadButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: theme.borderRadius.sm,
        elevation: 2,
    },
    buttonText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
    headerRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        marginHorizontal: 16,
        borderRadius: theme.borderRadius.sm,
    },
    headerCell: { flex: 1, alignItems: 'center' },
    loggedCol: { flex: 0.6, alignItems: 'center' },
    row: {
        flexDirection: 'row',
        paddingVertical: 12,
        marginHorizontal: 16,
        borderBottomWidth: 1,
    },
    cell: { flex: 1, paddingHorizontal: 4 },
    actionButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderRadius: theme.borderRadius.sm,
        marginHorizontal: 4,
        elevation: 1,
        backgroundColor: theme.dark.colors.background,
    },
    emptyWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
        textAlign: 'center',
    },
});