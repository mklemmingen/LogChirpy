import React, { useMemo, useRef, useState } from 'react';
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

    /** NEW: Label and description text */
    label?: string;
    description?: string;
};

export default function CustomSlider({
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
    const trackHeight = style?.height || 200;
    const clamp = (val: number, min: number, max: number) =>
        Math.max(min, Math.min(val, max));

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (evt) => {
                const { locationY } = evt.nativeEvent;
                const clampedY = clamp(locationY, 0, trackHeight);
                const ratio = 1 - clampedY / trackHeight;
                const range = maximumValue - minimumValue;
                let stepped = Math.round((minimumValue + ratio * range) / step) * step;
                stepped = clamp(stepped, minimumValue, maximumValue);
                onValueChange(stepped);
            },
        })
    ).current;

    const thumbPos = useMemo(() => {
        const ratio = (value - minimumValue) / (maximumValue - minimumValue);
        return (1 - ratio) * trackHeight;
    }, [value, minimumValue, maximumValue, trackHeight]);

    return (
        <View style={styles.wrapper}>
            {/* Top-right text overlay */}
                {(label || description) && (
                    <View style={styles.overlay}>
                        {label && <Text style={styles.label}>{label}</Text>}
                        {description && <Text style={styles.description}>{description}</Text>}
                    </View>
                )}

                {/* Actual slider */}
                <View style={[styles.sliderTouchZone, style]} {...panResponder.panHandlers}>
                    <View style={[styles.track, { backgroundColor: maximumTrackTintColor }]} />
                    <View
                        style={[
                            styles.trackFilled,
                            {
                                height: trackHeight - thumbPos,
                                backgroundColor: minimumTrackTintColor,
                            },
                        ]}
                    />
                    <View
                        style={[
                            styles.thumb,
                            {
                                backgroundColor: thumbTintColor,
                                top: thumbPos - 12,
                            },
                        ]}
                    />
                </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        right: 10,
        top: 130,
        alignItems: 'center',
    },
    overlay: {
        position: 'absolute',
        top: -60,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 8,
        maxWidth: 160,
        maxHeight: 160,
        minHeight: 80,
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
        width: 60,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    track: {
        position: 'absolute',
        width: 8,
        borderRadius: 4,
        top: 0,
        bottom: 0,
    },
    trackFilled: {
        position: 'absolute',
        width: 8,
        borderRadius: 4,
        bottom: 0,
    },
    thumb: {
        position: 'absolute',
        width: 28,
        height: 28,
        borderRadius: 14,
    },
});


