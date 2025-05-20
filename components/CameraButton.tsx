import { TouchableOpacity, View, StyleSheet, useColorScheme } from 'react-native';
import { theme } from '../constants/theme';

interface CameraButtonProps {
    onPress: () => void;
    isRecording?: boolean;
    activeOpacity?: number;
}

export function CameraButton({ onPress, isRecording = false, activeOpacity = 0.7 }: CameraButtonProps) {
    const colorScheme = useColorScheme() as 'light' | 'dark';
    const currentTheme = theme[colorScheme];

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.outerCircle, { borderColor: currentTheme.colors.buttonText }]}
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
    );
}

const styles = StyleSheet.create({
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
}); 