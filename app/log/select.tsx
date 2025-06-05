import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, TextInput, View,} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {Layout, useAnimatedStyle, useSharedValue, withSpring, withTiming,} from 'react-native-reanimated';

import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ModernCard} from '@/components/ModernCard';
import {ThemedIcon} from '@/components/ThemedIcon';
import {useColorVariants, useMotionValues, useSemanticColors, useTheme, useTypography, useColors} from '@/hooks/useThemeColor';
import {type BirdSpotting, getBirdSpottings, updateLatinBirDex} from '@/services/database';

interface SpottingCardProps {
    spotting: BirdSpotting;
    onSelect: (id: number) => void;
    delay: number;
}

function SpottingCard({ spotting, onSelect, delay }: SpottingCardProps) {
    const semanticColors = useSemanticColors();
    const typography = useTypography();
    const variants = useColorVariants();
    const motion = useMotionValues();

    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);

    useEffect(() => {
        const timer = setTimeout(() => {
            opacity.value = withTiming(1, { duration: motion.timing.duration });
            translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        }, delay * 50);

        return () => clearTimeout(timer);
    }, [delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const hasMedia = spotting.imageUri || spotting.videoUri || spotting.audioUri;

    return (
        <Animated.View style={animatedStyle} layout={Layout.springify()}>
            <ThemedPressable
                variant="ghost"
                onPress={() => onSelect(spotting.id)}
                style={{ marginBottom: 12 }}
            >
                <ModernCard elevated={false} bordered={true} style={{ marginHorizontal: 0 }}>
                    <View style={{ padding: 16 }}>
                        {/* Header */}
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: 12
                        }}>
                            <View style={{ flex: 1, marginRight: 12 }}>
                                <ThemedText
                                    variant="bodyLarge"
                                    style={{ fontWeight: '600', marginBottom: 4 }}
                                >
                                    {spotting.birdType || 'Unknown Species'}
                                </ThemedText>
                                <ThemedText
                                    variant="bodySmall"
                                    color="secondary"
                                >
                                    {formatDate(spotting.date)}
                                </ThemedText>
                            </View>

                            <ThemedIcon name="chevron-right" size={20} color="tertiary" />
                        </View>

                        {/* Media indicators */}
                        {hasMedia && (
                            <View style={{
                                flexDirection: 'row',
                                gap: 8,
                                marginBottom: 8
                            }}>
                                {spotting.imageUri && (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        backgroundColor: variants.primary.light,
                                        borderRadius: 12,
                                        gap: 4
                                    }}>
                                        <ThemedIcon name="camera" size={12} color="primary" />
                                        <ThemedText variant="labelSmall" color="primary">
                                            Photo
                                        </ThemedText>
                                    </View>
                                )}
                                {spotting.videoUri && (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        backgroundColor: variants.secondary.light,
                                        borderRadius: 12,
                                        gap: 4
                                    }}>
                                        <ThemedIcon name="video" size={12} color="secondary" />
                                        <ThemedText variant="labelSmall" color="secondary">
                                            Video
                                        </ThemedText>
                                    </View>
                                )}
                                {spotting.audioUri && (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        backgroundColor: variants.primary.light,
                                        borderRadius: 12,
                                        gap: 4
                                    }}>
                                        <ThemedIcon name="mic" size={12} color="primary" />
                                        <ThemedText variant="labelSmall" color="primary">
                                            Audio
                                        </ThemedText>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Notes preview */}
                        {spotting.textNote && (
                            <ThemedText
                                variant="bodySmall"
                                color="tertiary"
                                numberOfLines={2}
                                style={{ fontStyle: 'italic' }}
                            >
                                "{spotting.textNote}"
                            </ThemedText>
                        )}
                    </View>
                </ModernCard>
            </ThemedPressable>
        </Animated.View>
    );
}

export default function SelectSpottingScreen() {
    const { t } = useTranslation();
    const theme = useTheme();
    const semanticColors = useSemanticColors();
    const colors = useColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const motion = useMotionValues();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { latin } = useLocalSearchParams<{ latin: string }>();

    const [rows, setRows] = useState<BirdSpotting[]>([]);
    const [query, setQuery] = useState('');
    const [sortDir, setSortDir] = useState<'DESC' | 'ASC'>('DESC');
    const [loading, setLoading] = useState(true);

    // Animation values
    const headerOpacity = useSharedValue(0);
    const searchOpacity = useSharedValue(0);

    useEffect(() => {
        // Entrance animations
        headerOpacity.value = withTiming(1, { duration: motion.timing.duration });
        setTimeout(() => {
            searchOpacity.value = withTiming(1, { duration: motion.timing.duration });
        }, 150);
    }, []);

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
                        r.date.toLowerCase().includes(q) ||
                        (r.textNote && r.textNote.toLowerCase().includes(q))
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
        const selectedSpotting = rows.find((r) => r.id === id);
        if (!selectedSpotting) return;

        Alert.alert(
            t('select.confirmTitle'),
            t('select.confirmMessage', {
                latin,
                date: new Date(selectedSpotting.date).toLocaleDateString(),
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

    const headerAnimatedStyle = useAnimatedStyle(() => ({
        opacity: headerOpacity.value,
        transform: [{ translateY: (1 - headerOpacity.value) * -20 }],
    }));

    const searchAnimatedStyle = useAnimatedStyle(() => ({
        opacity: searchOpacity.value,
        transform: [{ translateY: (1 - searchOpacity.value) * 20 }],
    }));

    if (loading) {
        return (
            <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
                <View style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 16
                }}>
                    <ActivityIndicator size="large" color={semanticColors.primary} />
                    <ThemedText variant="bodyLarge" color="secondary">
                        Loading spottings...
                    </ThemedText>
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
            {/* Header */}
            <Animated.View style={[
                {
                    paddingHorizontal: theme.spacing.lg,
                    paddingVertical: theme.spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border
                },
                headerAnimatedStyle
            ]}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: theme.spacing.sm
                }}>
                    <ThemedPressable
                        variant="ghost"
                        onPress={() => router.back()}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            marginRight: theme.spacing.md
                        }}
                    >
                        <ThemedIcon name="arrow-left" size={20} />
                        <ThemedText variant="bodyLarge" color="primary">
                            {t('select.back')}
                        </ThemedText>
                    </ThemedPressable>
                </View>

                <ThemedText variant="h2" style={{ marginBottom: 4 }}>
                    Assign Species
                </ThemedText>
                <ThemedText variant="body" color="secondary">
                    Select a spotting to assign "{latin}" to
                </ThemedText>
            </Animated.View>

            {/* Search & Sort */}
            <Animated.View style={[
                {
                    paddingHorizontal: theme.spacing.lg,
                    paddingVertical: theme.spacing.md
                },
                searchAnimatedStyle
            ]}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: semanticColors.surface,
                    borderRadius: theme.borderRadius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: theme.spacing.md,
                    gap: 12
                }}>
                    <ThemedIcon name="search" size={20} color="tertiary" />
                    <TextInput
                        style={[
                            typography.body,
                            {
                                flex: 1,
                                color: colors.text,
                                paddingVertical: theme.spacing.sm
                            }
                        ]}
                        placeholder={t('select.searchPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        value={query}
                        onChangeText={setQuery}
                    />

                    <ThemedPressable
                        variant="ghost"
                        onPress={toggleSort}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: theme.borderRadius.sm
                        }}
                    >
                        <ThemedIcon
                            name={sortDir === 'DESC' ? 'arrow-down' : 'arrow-up'}
                            size={14}
                            color="tertiary"
                        />
                        <ThemedText variant="labelMedium" color="tertiary">
                            {sortDir === 'DESC' ? t('select.sortNewest') : t('select.sortOldest')}
                        </ThemedText>
                    </ThemedPressable>
                </View>
            </Animated.View>

            {/* List */}
            <FlatList
                data={rows}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, index }) => (
                    <SpottingCard
                        spotting={item}
                        onSelect={handleSelect}
                        delay={index}
                    />
                )}
                contentContainerStyle={{
                    paddingHorizontal: theme.spacing.lg,
                    paddingBottom: theme.spacing.xl + insets.bottom
                }}
                ListEmptyComponent={() => (
                    <ThemedView
                        style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            paddingVertical: theme.spacing.xxxl
                        }}
                    >
                        <View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: variants.primary.light,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: theme.spacing.lg
                        }}>
                            <ThemedIcon name="search" size={32} color="primary" />
                        </View>
                        <ThemedText variant="h3" style={{ marginBottom: 8 }}>
                            No Spottings Found
                        </ThemedText>
                        <ThemedText
                            variant="body"
                            color="secondary"
                            style={{ textAlign: 'center', maxWidth: 280 }}
                        >
                            {query.trim()
                                ? 'Try adjusting your search terms'
                                : 'Create your first bird spotting to get started'
                            }
                        </ThemedText>
                    </ThemedView>
                )}
                showsVerticalScrollIndicator={false}
            />
        </ThemedView>
    );
}