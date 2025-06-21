import React from 'react';
import { StyleSheet, ViewStyle, View, Text } from 'react-native';
import { MapView, Camera, PointAnnotation, MapViewRef, CameraRef } from '@maplibre/maplibre-react-native';
import { useRef, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useThemeColor';
import { getMapStyle } from '@/constants/mapStyles';


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
    const mapRef = useRef<MapViewRef>(null);
    const cameraRef = useRef<CameraRef>(null);
    const colors = useColors();

    const mapStyle = useMemo(() => getMapStyle(colors.isDark), [colors.isDark]);

    // Validate coordinates
    const isValidCoordinate = useMemo(() => {
        return (
            latitude !== null && latitude !== undefined && 
            longitude !== null && longitude !== undefined &&
            latitude !== 0 && longitude !== 0 &&
            latitude >= -90 && latitude <= 90 &&
            longitude >= -180 && longitude <= 180
        );
    }, [latitude, longitude]);

    const handleFocus = () => {
        if (!isValidCoordinate) return;
        
        Haptics.selectionAsync();
        cameraRef.current?.setCamera({
            centerCoordinate: [longitude, latitude],
            zoomLevel: 16,
            animationDuration: 500,
        });
        onFocus?.();
    };

    // Don't render map with invalid coordinates
    if (!isValidCoordinate) {
        return (
            <View style={[styles.container, style]}>
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                        No location data available
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View 
                style={[styles.map, style]} 
                pointerEvents={previewMode ? 'none' : 'auto'}
            >
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFillObject}
                    mapStyle={mapStyle}
                    logoEnabled={false}
                    attributionEnabled={false}
                    scrollEnabled={!previewMode}
                    pitchEnabled={!previewMode}
                    rotateEnabled={!previewMode}
                    zoomEnabled={!previewMode}
                    compassEnabled={!previewMode}
                >
                <Camera
                    ref={cameraRef}
                    centerCoordinate={[longitude, latitude]}
                    zoomLevel={16}
                />
                <PointAnnotation
                    id="location-marker"
                    coordinate={[longitude, latitude]}
                >
                    <View style={styles.markerContainer}>
                        <View style={[styles.marker, { backgroundColor: colors.primary }]} />
                    </View>
                </PointAnnotation>
                </MapView>
            </View>
            {/* OpenStreetMap Attribution */}
            <View style={styles.attribution}>
                <Text style={[styles.attributionText, { color: colors.textTertiary }]}>
                    © OpenStreetMap, © CARTO
                </Text>
            </View>
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
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
    },
    marker: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
    },
    focusButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        borderRadius: 6,
        padding: 6,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    attribution: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 2,
    },
    attributionText: {
        fontSize: 10,
        fontFamily: 'monospace',
    },
    errorContainer: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    errorText: {
        fontSize: 14,
        fontWeight: '500',
    },
});