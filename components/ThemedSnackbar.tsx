import React, { useEffect, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    useColorScheme,
    ViewStyle,
} from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
    visible: boolean;
    message: string;
    onHide: () => void;
    /** Optional extra style (e.g. to change bottom offset) */
    style?: ViewStyle;
};

export function ThemedSnackbar({ visible, message, onHide, style }: Props) {
    const scheme          = useColorScheme() ?? 'light';
    const colors          = theme[scheme].colors;
    const translateY      = useRef(new Animated.Value(60)).current; // start off-screen

    /* slide-in / slide-out animation */
    useEffect(() => {
        if (visible) {
            Animated.timing(translateY, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }).start();

            const timer = setTimeout(() => {
                Animated.timing(translateY, {
                    toValue: 60,
                    duration: 250,
                    useNativeDriver: true,
                }).start(onHide);
            }, 2500);

            return () => clearTimeout(timer);
        }
    }, [visible, translateY, onHide]);

    /* nothing to paint while hidden */
    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.wrap,
                {
                    backgroundColor: colors.card,
                    shadowColor: colors.shadow,
                    transform: [{ translateY }],
                },
                style,
            ]}
        >
            <Text style={[styles.text, { color: colors.text.primary }]}>
                {message}
            </Text>
        </Animated.View>
    );
}

/* basic visual set-up shared by light & dark */
const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: theme.borderRadius.lg,
        elevation: 4,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
    },
    text: {
        textAlign: 'center',
        fontWeight: '600',
    },
});