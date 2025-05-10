import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    useColorScheme,
    ActivityIndicator,
    Linking,
    Alert,
    FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import BirdAnimation from '@/components/BirdAnimation';
import { theme } from '@/constants/theme';
import {
    initBirdDexDB,
    queryBirdDexPage,
    getBirdDexRowCount,
    type BirdDexRecord,
} from '@/services/databaseBirDex';
import { hasSpottingForLatin } from '@/services/database';
import { fetchLocalizedNamesPage } from '@/services/wikipediaService';

const PAGE_SIZE = 20;

type DisplayRecord = BirdDexRecord & {
    displayName: string;
    logged: boolean;
};

const BirdDexIndex: React.FC = () => {
    const { i18n, t } = useTranslation();
    const router = useRouter();
    const scheme = useColorScheme() ?? 'light';
    const pal = theme[scheme];

    /* ──────────────────────────  STATE  ────────────────────────── */
    const [displayList, setDisplayList] = useState<DisplayRecord[]>([]);
    const [searchText, setSearchText]   = useState('');
    const [sortKey, setSortKey]         = useState<keyof BirdDexRecord>('english_name');
    const [sortAscending, setSortAscending] = useState(true);

    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isRefreshing,     setIsRefreshing]     = useState(false);
    const initedRef = useRef(false);

    const [page, setPage]           = useState(1);
    const [pageCount, setPageCount] = useState(1);

    /* ────────────────────────  DATA LOADER  ─────────────────────── */
    const loadPage = useCallback(async (targetPage: number) => {
        setIsRefreshing(true);
        try {
            const offset = (targetPage - 1) * PAGE_SIZE;
            const raw = queryBirdDexPage(
                searchText.trim(),
                sortKey,
                sortAscending,
                PAGE_SIZE,
                offset,
            );

            /* map + logged flag */
            let rows: DisplayRecord[] = raw.map(r => ({
                ...r,
                displayName: r.english_name,
                logged: hasSpottingForLatin(r.scientific_name),
            }));

            /* localisation */
            try {
                const sci = rows.map(r => r.scientific_name);
                const loc = await fetchLocalizedNamesPage(sci, i18n.language);
                rows = rows.map(r => ({
                    ...r,
                    displayName: loc[r.scientific_name] ?? r.displayName,
                }));
            } catch (e) {
                console.warn('Localization failed', e);
            }

            /* total pages */
            const total = getBirdDexRowCount(searchText.trim());
            setPageCount(Math.max(1, Math.ceil(total / PAGE_SIZE)));

            /* UI push */
            setDisplayList(rows);
            setPage(targetPage);
        } catch (e) {
            console.error(e);
            Alert.alert(t('birddex.error'), t('birddex.loadPageFailed'));
        } finally {
            setIsRefreshing(false);
            setIsInitialLoading(false);
        }
    }, [searchText, sortKey, sortAscending, i18n.language]);

    /* ──────────────────  INITIALISE + WATCH FILTERS  ────────────────── */
    useEffect(() => {
        (async () => {
            try {
                if (!initedRef.current) {
                    await initBirdDexDB();
                    initedRef.current = true;
                }
            } catch (e) {
                console.error('DB init error', e);
                Alert.alert(t('birddex.error'), t('birddex.initFailed'));
            } finally {
                loadPage(1);
            }
        })();
    }, []); // run exactly once

    /* reload when search / sort change */
    useEffect(() => { loadPage(1); }, [searchText, sortKey, sortAscending]);

    /* ────────────────────────  UI HELPERS  ───────────────────────── */
    const toggleSort = (key: keyof BirdDexRecord) => {
        if (key === sortKey) setSortAscending(p => !p);
        else { setSortKey(key); setSortAscending(true); }
    };

    const handleLog = (latin: string) => router.push({ pathname: '/log/select', params: { latin } });

    const handleWiki = (sci: string) => {
        const url = `https://${i18n.language}.wikipedia.org/wiki/${encodeURIComponent(sci.replace(/ /g, '_'))}`;
        Linking.openURL(url).catch(e => {
            console.error('Wiki open error', e);
            Alert.alert(t('birddex.error'), t('birddex.openWikiFailed'));
        });
    };

    /* ───────────────────────────  RENDER  ─────────────────────────── */
    const renderItem = useCallback(({ item }: { item: DisplayRecord }) => (
        <View style={[styles.row, { borderColor: pal.colors.border }, item.logged && { backgroundColor: pal.colors.primary + '20' }]}>
            <Text style={[styles.cell, { color: pal.colors.text.primary }]}>{item.displayName}</Text>
            <Text style={[styles.cell, { color: pal.colors.text.secondary }]}>{item.scientific_name}</Text>
            <View style={[styles.cell, styles.loggedCol]}><Text>{item.logged ? '✅' : ''}</Text></View>
            <Pressable style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.6 }]} onPress={() => handleLog(item.scientific_name)}>
                <Text style={[styles.buttonText, { color: pal.colors.primary }]}>{t('birddex.log')}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.6 }]} onPress={() => handleWiki(item.scientific_name)}>
                <Text style={[styles.buttonText, { color: pal.colors.primary }]}>{t('birddex.wikipedia')}</Text>
            </Pressable>
        </View>
    ), [pal.colors, t]);

    const renderHeader = () => (
        <View style={[styles.headerRow, { backgroundColor: pal.colors.card }]}>
            {([['english_name', t('birddex.name')], ['scientific_name', t('birddex.scientific')]] as const).map(([key, label]) => (
                <Pressable key={key} style={styles.headerCell} onPress={() => toggleSort(key)}>
                    <Text style={{ color: pal.colors.text.primary }}>{label} {sortKey === key ? (sortAscending ? '↑' : '↓') : ''}</Text>
                </Pressable>
            ))}
            <View style={[styles.headerCell, styles.loggedCol]}><Text style={{ color: pal.colors.text.primary }}>{t('birddex.logged')}</Text></View>
            <View style={styles.headerCell}><Text style={{ color: pal.colors.text.primary }}>{t('birddex.action')}</Text></View>
            <View style={styles.headerCell}><Text style={{ color: pal.colors.text.primary }}>{t('birddex.wikipedia')}</Text></View>
        </View>
    );

    const ListEmpty = () => isRefreshing ? (
        <View style={styles.emptyWrapper}>
            <ActivityIndicator size="large" color={pal.colors.primary} />
            <Text style={[styles.emptyText, { color: pal.colors.text.secondary }]}>{t('birddex.loadingEntries')}</Text>
        </View>
    ) : <Text style={[styles.emptyText, { color: pal.colors.text.secondary }]}>{t('birddex.noResults')}</Text>;

    if (isInitialLoading) return (
        <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
            <BirdAnimation numberOfBirds={5} />
            <ActivityIndicator size="large" color={pal.colors.primary} />
            <Text style={[styles.loadingText, { color: pal.colors.text.primary }]}>{t('birddex.initializingDb')}</Text>
        </SafeAreaView>
    );

    const Pager = () => {
        // show ≤5 numbers around the current page so it stays compact
        const window = 2;
        const first  = Math.max(1, page - window);
        const last   = Math.min(pageCount, page + window);
        const nums   = [];
        for (let i = first; i <= last; i++) nums.push(i);

        return (
            <View style={styles.pagerRow}>
                {/* left arrow */}
                <Pressable
                    disabled={page === 1}
                    onPress={() => loadPage(page - 1)}
                    style={[styles.pageBtn, page === 1 && styles.disabledBtn]}>
                    <Text style={styles.pageTxt}>{'‹‹'}</Text>
                </Pressable>

                {/* page numbers */}
                {nums.map(n => (
                    <Pressable
                        key={n}
                        onPress={() => loadPage(n)}
                        style={[
                            styles.pageBtn,
                            n === page && styles.currentBtn,
                        ]}>
                        <Text style={[
                            styles.pageTxt,
                            n === page && styles.currentTxt,
                        ]}>{n}</Text>
                    </Pressable>
                ))}

                {/* right arrow */}
                <Pressable
                    disabled={page === pageCount}
                    onPress={() => loadPage(page + 1)}
                    style={[
                        styles.pageBtn,
                        page === pageCount && styles.disabledBtn,
                    ]}>
                    <Text style={styles.pageTxt}>{'››'}</Text>
                </Pressable>
            </View>
        );
    };

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
                    onPress={() => loadPage(1)}
                >
                    <Text style={[styles.buttonText, { color: pal.colors.text.light }]}>
                        {t('birddex.reload')}
                    </Text>
                </Pressable>
            </View>

            <Pager />
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
    pagerRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 8,
    },
    pageBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginHorizontal: 2,
        borderRadius: theme.borderRadius.sm,
    },
    currentBtn: { backgroundColor: theme.dark.colors.text.primary + '20' },
    disabledBtn: { opacity: 0.3 },
    pageTxt:   { color: theme.dark.colors.text.primary, fontSize: 16 },
    currentTxt:{ fontWeight: '700' },
});
