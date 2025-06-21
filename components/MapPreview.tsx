import React from 'react';
import { StyleSheet, ViewStyle, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapStyleElement } from 'react-native-maps';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedIcon } from '@/components/ThemedIcon';
import { useRef, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useThemeColor';

// Create dark map style using theme colors
function useDarkMapStyle() {
    const colors = useColors();

    return useMemo<MapStyleElement[]>(() => [
        {
            elementType: "geometry",
            stylers: [{ color: colors.background }] // Main background
        },
        {
            elementType: "labels.text.fill",
            stylers: [{ color: colors.textSecondary }] // Text color
        },
        {
            elementType: "labels.text.stroke",
            stylers: [{ color: colors.background }] // Text outline
        },
        {
            featureType: "administrative",
            elementType: "geometry",
            stylers: [{ color: colors.backgroundTertiary }] // Administrative boundaries
        },
        {
            featureType: "poi",
            elementType: "geometry",
            stylers: [{ color: colors.backgroundSecondary }] // Points of interest
        },
        {
            featureType: "poi",
            elementType: "labels.text.fill",
            stylers: [{ color: colors.textSecondary }] // POI text
        },
        {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: colors.backgroundTertiary }] // Roads
        },
        {
            featureType: "road",
            elementType: "labels.text.fill",
            stylers: [{ color: colors.textSecondary }] // Road labels
        },
        {
            featureType: "transit",
            elementType: "geometry",
            stylers: [{ color: colors.backgroundTertiary }] // Transit lines
        },
        {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: colors.backgroundSecondary }] // Water bodies
        },
        {
            featureType: "water",
            elementType: "labels.text.fill",
            stylers: [{ color: colors.textTertiary }] // Water labels
        }
    ], [colors]); // Only recreate when colors change
}

interface MapPreviewProps {
    latitude: number;
    longitude: number;
    /** Optional custom style overrides */
    style?: ViewStyle | ViewStyle[];
    /** If true, map is a preview (gestures disabled). Default: true */
    previewMode?: boolean;
    /** Optional callback when map needs to be focused */
    onFocus?: () => void;
}

const MapPreview = React.forwardRef<{ handleFocus: () => void }, MapPreviewProps>(function MapPreview({
    latitude,
    longitude,
    style,
    previewMode = true,
    onFocus,
}: MapPreviewProps, ref) {

    React.useImperativeHandle(ref, () => ({
        handleFocus
    }));
    const mapRef = useRef<MapView>(null);
    const colors = useColors();
    const darkStyle = useDarkMapStyle();

    const handleFocus = () => {
        Haptics.selectionAsync();
        mapRef.current?.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        }, 500);
        onFocus?.();
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={[styles.map, style]}
                initialRegion={{
                    latitude,
                    longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                }}
                provider={PROVIDER_GOOGLE}
                customMapStyle={colors.isDark ? darkStyle : undefined}
                pointerEvents={previewMode ? 'none' : 'auto'}
                scrollEnabled={!previewMode}
                pitchEnabled={!previewMode}
                rotateEnabled={!previewMode}
                zoomEnabled={!previewMode}
                showsMyLocationButton={!previewMode}
                showsCompass={!previewMode}
                toolbarEnabled={!previewMode}
            >
                <Marker coordinate={{ latitude, longitude }} />
            </MapView>
        </View>
    );
});

export default MapPreview;

const styles = StyleSheet.create({
    container: {
        width: '100%',
        flex: 1,
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 8,
    },
    focusButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        borderRadius: 6,
        padding: 6,
        // Shadow
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
});