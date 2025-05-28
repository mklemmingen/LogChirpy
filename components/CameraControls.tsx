import { TouchableOpacity, View, StyleSheet, useColorScheme } from 'react-native';
import { theme } from '../constants/theme';
import { Feather } from '@expo/vector-icons';

interface CameraControlsProps {
    onCapture: () => void;
    onFlip: () => void;
    isRecording?: boolean;
    isFlipDisabled?: boolean;
    activeOpacity?: number;
}

export function CameraControls({
    onCapture,
    onFlip,
    isRecording = false,
    isFlipDisabled = false,
    activeOpacity = 0.7
}: CameraControlsProps) {
    const colorScheme = useColorScheme() as 'light' | 'dark';
    const currentTheme = theme[colorScheme];

    return (
        <View style={styles.container}>
            <View style={styles.section} />
            <View style={styles.section}>
                <TouchableOpacity
                    onPress={onCapture}
                    style={[styles.outerCircle, { borderColor: currentTheme.colors.secondary }]}
                    activeOpacity={activeOpacity}
                >
                    <View
                        style={[
                            styles.innerCircle,
                            isRecording && styles.innerSquare,
                            { backgroundColor: currentTheme.colors.primary }
                        ]}
                    />
                </TouchableOpacity>
            </View>
            <View style={styles.section}>
                <TouchableOpacity
                    style={styles.flipButton}
                    onPress={onFlip}
                    disabled={isFlipDisabled}
                    activeOpacity={activeOpacity}
                >
                    <Feather name="refresh-ccw" size={24} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        width: '100%',
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    section: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    outerCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    innerCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    innerSquare: {
        width: 40,
        height: 40,
        borderRadius: theme.borderRadius.sm,
    },
    flipButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
}); 