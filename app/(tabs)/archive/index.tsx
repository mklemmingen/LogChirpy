import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Button, useColorScheme } from "react-native";
import { useTranslation } from "react-i18next";
import { useDatabase } from "@/hooks/useDatabase";
import NetInfo from '@react-native-community/netinfo';
import { theme } from "@/constants/theme";
import { router } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ArchiveScreen() {
    const { t } = useTranslation();
    const { birdSpottings, loading, syncSpottings } = useDatabase();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<'newest' | 'oldest'>('newest');
    const [filteredSpottings, setFilteredSpottings] = useState<any[]>([]);
    const [online, setOnline] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Loading...');

    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

    useEffect(() => {
        setLoadingMessage('Checking connection...');
        const unsubscribe = NetInfo.addEventListener(state => {
            setOnline(state.isConnected ?? false);
            setLoadingMessage('Loading bird spottings...');
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        setLoadingMessage('Filtering spottings...');
        let spottings = [...birdSpottings];

        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            spottings = spottings.filter(spotting =>
                spotting.bird_type?.toLowerCase().includes(query) ||
                spotting.date?.toLowerCase().includes(query)
            );
        }

        if (sortOption === 'newest') {
            spottings.sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime()));
        } else {
            spottings.sort((a, b) => (new Date(a.date).getTime() - new Date(b.date).getTime()));
        }

        setFilteredSpottings(spottings.slice(0, 50));

        setTimeout(() => setLoadingMessage(''), 500); // Clear after short delay
    }, [searchQuery, sortOption, birdSpottings]);

    const handleSyncNow = async () => {
        try {
            setLoadingMessage('Syncing with server...');
            await syncSpottings();
            setLoadingMessage('Done syncing!');
            setTimeout(() => setLoadingMessage(''), 1500);
        } catch (error) {
            setLoadingMessage('Error syncing data');
            console.error(error);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={currentTheme.colors.primary} />
                <Text style={[styles.loadingText, { color: currentTheme.colors.text.secondary }]}>
                    {loadingMessage}
                </Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: currentTheme.colors.background }}>
            <View style={styles.container}>
                {/* Search Input */}
                <TextInput
                    style={[
                        styles.searchInput,
                        {
                            backgroundColor: currentTheme.colors.card,
                            color: currentTheme.colors.text.primary,
                            borderColor: currentTheme.colors.border,
                        }
                    ]}
                    placeholder={t('archive.search_placeholder') || "Search by Bird or Date"}
                    placeholderTextColor={currentTheme.colors.text.secondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                {/* Button Row */}
                <View style={styles.buttonRow}>
                    <Button title={t('archive.sort_newest') || "Newest"} onPress={() => setSortOption('newest')} />
                    <Button title={t('archive.sort_oldest') || "Oldest"} onPress={() => setSortOption('oldest')} />
                    {online && <Button title={t('archive.sync_now') || "Sync Now"} onPress={handleSyncNow} />}
                </View>

                {/* List */}
                <FlatList
                    data={filteredSpottings}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={
                        <Text style={[styles.emptyText, { color: currentTheme.colors.text.secondary }]}>
                            {t('archive.no_spottings') || "No spottings found."}
                        </Text>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.card, { backgroundColor: currentTheme.colors.card }]}
                            onPress={() => router.push({ pathname: '/archive/detail/[id]', params: { id: item.id } })}
                        >
                            <Text style={[styles.cardTitle, { color: currentTheme.colors.text.primary }]}>
                                {item.bird_type || t('archive.unknown_bird') || 'Unknown Bird'}
                            </Text>
                            <Text style={[styles.cardSubtitle, { color: currentTheme.colors.text.secondary }]}>
                                {new Date(item.date).toLocaleDateString()}
                            </Text>
                            <Text style={[styles.cardInfo, { color: currentTheme.colors.text.secondary }]}>
                                {item.text_note?.slice(0, 80) || ''}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    searchInput: {
        height: 50,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        margin: 16,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    buttonRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    card: {
        borderRadius: theme.borderRadius.lg,
        padding: 16,
        marginBottom: 16,
        ...theme.shadows.sm,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        opacity: 0.7,
        marginBottom: 8,
    },
    cardInfo: {
        fontSize: 14,
        opacity: 0.8,
    },
    emptyText: {
        marginTop: 32,
        textAlign: 'center',
        fontSize: 16,
        opacity: 0.7,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        opacity: 0.7,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
});
