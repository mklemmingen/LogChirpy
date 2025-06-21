import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapView, Camera, PointAnnotation } from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedIcon } from '@/components/ThemedIcon';
import { useColors } from '@/hooks/useThemeColor';
import { getBirdSpottings, type BirdSpotting } from '@/services/database';
import { getMapStyle } from '@/constants/mapStyles';

/**
 * Map view showing all bird spotting locations
 * Implements User Story 5: Finding specific bird sightings on a map
 */
export default function MapScreen() {
    const { t } = useTranslation();
    const colors = useColors();
    const [spottings, setSpottings] = useState<BirdSpotting[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);

    const mapStyle = useMemo(() => getMapStyle(colors.isDark), [colors.isDark]);

    // Load all spottings with GPS coordinates
    useEffect(() => {
        loadSpottings();
    }, []);

    const loadSpottings = async () => {
        try {
            setLoading(true);
            const allSpottings = await getBirdSpottings();
            // Filter out spottings without valid GPS coordinates
            const validSpottings = allSpottings.filter(
                spotting => 
                    spotting.gpsLat !== null && 
                    spotting.gpsLng !== null && 
                    spotting.gpsLat !== 0 && 
                    spotting.gpsLng !== 0 &&
                    spotting.gpsLat >= -90 && 
                    spotting.gpsLat <= 90 &&
                    spotting.gpsLng >= -180 && 
                    spotting.gpsLng <= 180
            );
            setSpottings(validSpottings);
        } catch (error) {
            console.error('Error loading spottings:', error);
            Alert.alert(
                t('error.title') || 'Error',
                t('error.loadingSpottings') || 'Failed to load bird spottings'
            );
        } finally {
            setLoading(false);
        }
    };

    // Get unique species for filtering
    const uniqueSpecies = useMemo(() => {
        const species = new Set(spottings.map(s => s.birdType).filter(Boolean));
        return Array.from(species).sort();
    }, [spottings]);

    // Filter spottings by selected species
    const filteredSpottings = useMemo(() => {
        if (!selectedSpecies) return spottings;
        return spottings.filter(s => s.birdType === selectedSpecies);
    }, [spottings, selectedSpecies]);

    // Calculate map center from all spottings
    const mapCenter = useMemo(() => {
        if (filteredSpottings.length === 0) {
            return [0, 50]; // Default to center of Europe
        }

        const avgLat = filteredSpottings.reduce((sum, s) => sum + (s.gpsLat || 0), 0) / filteredSpottings.length;
        const avgLng = filteredSpottings.reduce((sum, s) => sum + (s.gpsLng || 0), 0) / filteredSpottings.length;
        
        return [avgLng, avgLat];
    }, [filteredSpottings]);

    const handleMarkerPress = (spotting: BirdSpotting) => {
        Haptics.selectionAsync();
        Alert.alert(
            spotting.birdType || t('archive.unknownSpecies') || 'Unknown Species',
            `${t('archive.location') || 'Location'}: ${spotting.gpsLat?.toFixed(4)}, ${spotting.gpsLng?.toFixed(4)}\n${t('archive.date') || 'Date'}: ${new Date(spotting.date).toLocaleDateString()}`,
            [
                {
                    text: t('common.cancel') || 'Cancel',
                    style: 'cancel'
                },
                {
                    text: t('archive.viewDetails') || 'View Details',
                    onPress: () => {
                        router.push(`/(tabs)/archive/detail/${spotting.id}`);
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ThemedText variant="bodyLarge">
                        {t('map.loading') || 'Loading map...'}
                    </ThemedText>
                </View>
            </ThemedSafeAreaView>
        );
    }

    if (spottings.length === 0) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <View style={styles.emptyContainer}>
                    <ThemedIcon name="map-pin" size={48} color="secondary" />
                    <ThemedText variant="h3" style={styles.emptyTitle}>
                        {t('map.noSpottings') || 'No bird spottings found'}
                    </ThemedText>
                    <ThemedText variant="body" color="secondary" style={styles.emptySubtitle}>
                        {t('map.startLogging') || 'Start logging birds with GPS to see them on the map'}
                    </ThemedText>
                </View>
            </ThemedSafeAreaView>
        );
    }

    return (
        <ThemedSafeAreaView style={styles.container}>
            {/* Header with back button and species filter */}
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <View style={styles.headerTop}>
                    <ThemedPressable
                        variant="secondary"
                        size="sm"
                        onPress={() => {
                            Haptics.selectionAsync();
                            router.back();
                        }}
                        style={styles.backButton}
                    >
                        <ThemedIcon name="arrow-left" size={16} color="secondary" />
                        <ThemedText variant="labelMedium" color="secondary">
                            {t('common.back') || 'Back'}
                        </ThemedText>
                    </ThemedPressable>
                </View>
                <ThemedText variant="h2" style={styles.title}>
                    {t('map.title') || 'Bird Spotting Map'}
                </ThemedText>
                <ThemedText variant="labelMedium" color="secondary">
                    {filteredSpottings.length} {selectedSpecies ? `${selectedSpecies} ` : ''}{t('map.spottings') || 'spottings'}
                </ThemedText>
                
                {/* Species filter button */}
                {uniqueSpecies.length > 0 && (
                    <ThemedPressable
                        variant="secondary"
                        size="sm"
                        onPress={() => {
                            Haptics.selectionAsync();
                            // TODO: Implement species picker modal
                            setSelectedSpecies(selectedSpecies ? null : uniqueSpecies[0]);
                        }}
                        style={styles.filterButton}
                    >
                        <ThemedIcon name="filter" size={16} color="secondary" />
                        <ThemedText variant="labelMedium" color="secondary">
                            {selectedSpecies || (t('map.allSpecies') || 'All Species')}
                        </ThemedText>
                    </ThemedPressable>
                )}
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
                <MapView
                    style={StyleSheet.absoluteFillObject}
                    mapStyle={mapStyle}
                    logoEnabled={false}
                    attributionEnabled={false}
                    scrollEnabled={true}
                    pitchEnabled={true}
                    rotateEnabled={true}
                    zoomEnabled={true}
                    compassEnabled={true}
                >
                    <Camera
                        centerCoordinate={mapCenter}
                        zoomLevel={filteredSpottings.length === 1 ? 14 : 10}
                    />
                    
                    {filteredSpottings.map((spotting, index) => (
                        <PointAnnotation
                            key={`${spotting.id}-${index}`}
                            id={`spotting-${spotting.id}`}
                            coordinate={[spotting.gpsLng!, spotting.gpsLat!]}
                            onSelected={() => handleMarkerPress(spotting)}
                        >
                            <View style={styles.markerContainer}>
                                <View style={[styles.marker, { backgroundColor: colors.primary }]}>
                                    <ThemedIcon name="feather" size={12} color="inverse" />
                                </View>
                                {spotting.birdType && (
                                    <View style={[styles.markerLabel, { backgroundColor: colors.surface }]}>
                                        <ThemedText variant="labelSmall" numberOfLines={1}>
                                            {spotting.birdType}
                                        </ThemedText>
                                    </View>
                                )}
                            </View>
                        </PointAnnotation>
                    ))}
                </MapView>

                {/* Attribution */}
                <View style={styles.attribution}>
                    <Text style={[styles.attributionText, { color: colors.textTertiary }]}>
                        © OpenStreetMap, © CARTO
                    </Text>
                </View>
            </View>
        </ThemedSafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyTitle: {
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubtitle: {
        marginTop: 8,
        textAlign: 'center',
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTop: {
        marginBottom: 12,
    },
    backButton: {
        flexDirection: 'row',
        gap: 4,
        alignSelf: 'flex-start',
    },
    title: {
        marginBottom: 4,
    },
    filterButton: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    markerContainer: {
        alignItems: 'center',
    },
    marker: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
    },
    markerLabel: {
        marginTop: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        maxWidth: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
    },
    attribution: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 3,
    },
    attributionText: {
        fontSize: 10,
        fontFamily: 'monospace',
    },
});