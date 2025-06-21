import { StyleSheet, ViewStyle, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedIcon } from '@/components/ThemedIcon';
import { useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useThemeColor';

interface MapPreviewProps {
    latitude: number;
    longitude: number;
    /** Optional custom style overrides */
    style?: ViewStyle | ViewStyle[];
    /** If true, map is a preview (gestures disabled). Default: true */
    previewMode?: boolean;
}

export default function MapPreview({
    latitude,
    longitude,
    style,
    previewMode = true,
}: MapPreviewProps) {
    const mapRef = useRef<MapView>(null);
    const colors = useColors();

    const handleFocus = () => {
        Haptics.selectionAsync();
        mapRef.current?.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        }, 500);
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
            {!previewMode && (
                <ThemedPressable
                    onPress={handleFocus}
                    style={[styles.focusButton, { backgroundColor: colors.surface }]}
                    variant="secondary"
                >
                    <ThemedIcon name="crosshair" size={16} color="secondary" />
                </ThemedPressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 200,
    },
    map: {
        width: '100%',
        height: 200,
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