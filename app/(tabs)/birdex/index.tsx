import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    SafeAreaView, View, Text, TextInput, Pressable,
    StyleSheet, useColorScheme, ActivityIndicator, Alert, FlatList
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import BirdAnimation from '@/components/BirdAnimation';
import { theme } from '@/constants/theme';

import {
    initBirdDexDB,
    queryBirdDexPage,
    getBirdDexRowCount,
    type BirdDexRecord
} from '@/services/databaseBirDex';
import { hasSpottingForLatin } from '@/services/database';

const PAGE_SIZE = 20;

type NameKey =
    | 'english_name'
    | 'german_name'
    | 'spanish_name'
    | 'ukrainian_name'
    | 'arabic_name';

type DisplayRecord = BirdDexRecord & {
    displayName: string;
    logged: boolean;
};


export default function BirdDexIndex() {
    const { i18n, t } = useTranslation();
    const router = useRouter();
    const scheme = useColorScheme() ?? 'light';
    const pal = theme[scheme];

    const [list, setList]         = useState<DisplayRecord[]>([]);
    const [searchText, setSearch] = useState('');
    const [sortKey, setSortKey]   = useState<keyof BirdDexRecord>('english_name');
    const [asc, setAsc]           = useState(true);

    const [initLoading, setInit]  = useState(true);
    const [refreshing, setRefresh]= useState(false);
    const initedRef               = useRef(false);

    const [page, setPage]         = useState(1);
    const [pageCount, setPageCount] = useState(1);

    const loadPage = useCallback(async (target: number) => {
        setRefresh(true);
        try {
            const offset = (target - 1) * PAGE_SIZE;
            const raw = queryBirdDexPage(
                searchText.trim(), sortKey, asc, PAGE_SIZE, offset
            );

            // pick translation column based on locale, as a NameKey
            const lang = i18n.language.split('-')[0];
            const colMap: Record<string, NameKey> = {
                de: 'german_name',
                es: 'spanish_name',
                uk: 'ukrainian_name',
                ar: 'arabic_name',
            };
            // fall back to english_name if not in map
            const langCol: NameKey = colMap[lang] || 'english_name';

            // r[langCol] is definitely a string
            const rows: DisplayRecord[] = raw.map(r => ({
                ...r,
                displayName: r[langCol] || r.english_name,
                logged: hasSpottingForLatin(r.scientific_name),
            }));

            const total = getBirdDexRowCount(searchText.trim());
            setPageCount(Math.max(1, Math.ceil(total / PAGE_SIZE)));

            setList(rows);
            setPage(target);
        } catch (e) {
            console.error(e);
            Alert.alert(t('birddex.error'), t('birddex.loadPageFailed'));
        } finally {
            setRefresh(false);
            setInit(false);
        }
    }, [searchText, sortKey, asc, i18n.language]);

    // init DB + first load
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
    }, []);

    // reload on search/sort change
    useEffect(() => {
        if (initedRef.current) loadPage(1);
    }, [searchText, sortKey, asc]);

    const toggleSort = (key: keyof BirdDexRecord) => {
        if (key === sortKey) setAsc(a => !a);
        else {
            setSortKey(key);
            setAsc(true);
        }
    };

    const renderItem = useCallback(({ item }: { item: DisplayRecord }) => (
        <Pressable
            onPress={() => router.push(`/birdex/details/${item.species_code}`)}
            style={({ pressed }) => [
                styles.row,
                { borderColor: pal.colors.border },
                item.logged && { backgroundColor: pal.colors.primary + '20' },
                pressed && { opacity: 0.5 }
            ]}
        >
            <Text style={[styles.cell, { color: pal.colors.text.primary }]}>
                {item.displayName}
            </Text>
            <Text style={[styles.cell, { color: pal.colors.text.secondary }]}>
                {item.scientific_name}
            </Text>
            <Text style={[styles.cell, styles.loggedCol]}>
                {item.logged ? '✅' : ''}
            </Text>
        </Pressable>
    ), [pal.colors, router]);

    const renderHeader = () => (
        <View style={[styles.headerRow, { backgroundColor: pal.colors.card }]}>
            {([
                ['english_name', t('birddex.name')],
                ['scientific_name', t('birddex.scientific')]
            ] as const).map(([key, label]) => (
                <Pressable
                    key={key}
                    style={styles.headerCell}
                    onPress={() => toggleSort(key)}
                >
                    <Text style={{ color: pal.colors.text.primary }}>
                        {label}{sortKey === key ? (asc ? ' ↑' : ' ↓') : ''}
                    </Text>
                </Pressable>
            ))}
            <View style={[styles.headerCell, styles.loggedCol]}>
                <Text style={{ color: pal.colors.text.primary }}>
                    {t('birddex.logged')}
                </Text>
            </View>
        </View>
    );

    if (initLoading) {
        return (
            <SafeAreaView style={[styles.center, { backgroundColor: pal.colors.background }]}>
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
                    onChangeText={setSearch}
                />
                <Pressable
                    style={[styles.reloadBtn, { backgroundColor: pal.colors.primary }]}
                    onPress={() => loadPage(1)}
                >
                    <Text style={[styles.buttonText, { color: pal.colors.text.light }]}>
                        {t('birddex.reload')}
                    </Text>
                </Pressable>
            </View>

            <FlatList
                data={list}
                keyExtractor={r => r.species_code}
                ListHeaderComponent={renderHeader}
                renderItem={renderItem}
                refreshing={refreshing}
                onRefresh={() => loadPage(page)}
                ListEmptyComponent={
                    refreshing
                        ? <ActivityIndicator size="large" color={pal.colors.primary} />
                        : <Text style={[styles.noResults, { color: pal.colors.text.secondary }]}>
                            {t('birddex.noResults')}
                        </Text>
                }
            />

            <View style={styles.pagerRow}>
                <Pressable
                    disabled={page === 1}
                    onPress={() => loadPage(page - 1)}
                    style={[styles.pageBtn, page === 1 && styles.disabledBtn]}
                ><Text style={styles.pageTxt}>‹‹</Text></Pressable>

                {Array.from({ length: pageCount }, (_, i) => i + 1)
                    .slice(Math.max(0, page - 3), Math.min(pageCount, page + 2))
                    .map(n => (
                        <Pressable
                            key={n}
                            onPress={() => loadPage(n)}
                            style={[styles.pageBtn, n === page && styles.currentBtn]}
                        >
                            <Text style={[styles.pageTxt, n === page && styles.currentTxt]}>
                                {n}
                            </Text>
                        </Pressable>
                    ))}

                <Pressable
                    disabled={page === pageCount}
                    onPress={() => loadPage(page + 1)}
                    style={[styles.pageBtn, page === pageCount && styles.disabledBtn]}
                ><Text style={styles.pageTxt}>››</Text></Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container:  { flex: 1 },
    center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText:{ fontSize: 16, marginTop: 8 },

    searchWrap: { flexDirection: 'row', margin: 16, borderWidth: 1,
        borderRadius: theme.borderRadius.md, paddingHorizontal: 12,
        height: 44, alignItems: 'center' },
    input:      { flex: 1, fontSize: 16 },
    reloadBtn:  { padding: 8, borderRadius: theme.borderRadius.sm, elevation: 2 },
    buttonText: { fontSize: 14, fontWeight: '600' },

    headerRow:  { flexDirection: 'row', paddingVertical: 8, marginHorizontal: 16 },
    headerCell: { flex: 1, alignItems: 'center' },

    row:        { flexDirection: 'row', padding: 12, marginHorizontal: 16,
        borderBottomWidth: 1 },
    cell:       { flex: 1, paddingHorizontal: 4 },
    loggedCol:  { flex: 0.6, alignItems: 'center' },

    pagerRow:   { flexDirection: 'row', justifyContent: 'center', padding: 8 },
    pageBtn:    { marginHorizontal: 4, padding: 6, borderRadius: theme.borderRadius.sm },
    currentBtn: { backgroundColor: theme.dark.colors.text.primary + '20' },
    disabledBtn:{ opacity: 0.3 },
    pageTxt:    { fontSize: 16 },
    currentTxt: { fontWeight: '700' },

    noResults:  { textAlign: 'center', marginTop: 40, fontSize: 16 }
});
