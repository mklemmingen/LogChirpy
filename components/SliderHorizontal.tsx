import React, { useMemo, useRef } from 'react';
import { View, Text, PanResponder, StyleSheet } from 'react-native';

type CustomSliderProps = {
    style?: any;
    minimumValue?: number;
    maximumValue?: number;
    value: number;
    step?: number;
    onValueChange: (value: number) => void;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
    thumbTintColor?: string;
    label?: string;
    description?: string;
};

export default function CustomSliderHorizontal({
                                                   style,
                                                   minimumValue = 0,
                                                   maximumValue = 1,
                                                   value,
                                                   step = 0.01,
                                                   onValueChange,
                                                   minimumTrackTintColor = '#1EB1FC',
                                                   maximumTrackTintColor = '#d3d3d3',
                                                   thumbTintColor = '#1EB1FC',
                                                   label,
                                                   description,
                                               }: CustomSliderProps) {
    const trackWidth = style?.width || 300;
    const clamp = (val: number, min: number, max: number) =>
        Math.max(min, Math.min(val, max));

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gesture) => {
                const dx = clamp(gesture.moveX - 20, 0, trackWidth); // adjust for margin
                const ratio = dx / trackWidth;
                const range = maximumValue - minimumValue;
                let stepped = Math.round((minimumValue + ratio * range) / step) * step;
                stepped = clamp(stepped, minimumValue, maximumValue);
                onValueChange(stepped);
            },
        })
    ).current;

    const thumbPos = useMemo(() => {
        const ratio = (value - minimumValue) / (maximumValue - minimumValue);
        return ratio * trackWidth;
    }, [value, minimumValue, maximumValue, trackWidth]);

    return (
        <View style={[styles.wrapper, style]}>
            {(label || description) && (
                <View style={styles.overlay}>
                    {label && <Text style={styles.label}>{label}</Text>}
                    {description && <Text style={styles.description}>{description}</Text>}
                </View>
            )}
            <View style={styles.sliderTouchZone} {...panResponder.panHandlers}>
                <View style={[styles.track, { backgroundColor: maximumTrackTintColor, width: trackWidth }]} />
                <View style={[
                    styles.trackFilled,
                    { backgroundColor: minimumTrackTintColor, width: thumbPos }
                ]} />
                <View style={[
                    styles.thumb,
                    {
                        backgroundColor: thumbTintColor,
                        left: thumbPos - 14,
                    },
                ]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlay: {
        marginBottom: 8,
        alignItems: 'center',
    },
    label: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    description: {
        color: 'white',
        fontSize: 12,
        opacity: 0.8,
        marginTop: 2,
    },
    sliderTouchZone: {
        height: 40,
        justifyContent: 'center',
    },
    track: {
        position: 'absolute',
        height: 8,
        borderRadius: 4,
    },
    trackFilled: {
        position: 'absolute',
        height: 8,
        borderRadius: 4,
    },
    thumb: {
        position: 'absolute',
        width: 28,
        height: 28,
        borderRadius: 14,
        top: -10,
    },
});
