import { StyleSheet, ViewStyle } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

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
    return (
        <MapView
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
        >
            <Marker coordinate={{ latitude, longitude }} />
        </MapView>
    );
}

const styles = StyleSheet.create({
    map: {
        width: '100%',
        height: 200,
        borderRadius: 8,
    },
}); 