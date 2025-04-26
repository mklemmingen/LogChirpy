import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { HelloWave } from '@/components/HelloWave';
import { ThemedText } from '@/components/ThemedText';
import BirdAnimation from '@/components/BirdAnimation'; // <-- import BirdAnimation

export default function Index() {
    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
                {/* Background Bird Animation */}
                <BirdAnimation numberOfBirds={5} />

                {/* Foreground content */}
                <View style={styles.inner}>
                    <HelloWave />
                    <ThemedText type="title" style={styles.title}>
                        Logging the Birdies here
                    </ThemedText>
                    <ThemedText type="default" style={styles.subtitle}>
                        Start logging, saving and exploring chirps 🐦
                    </ThemedText>
                </View>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    inner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        gap: 16,
    },
    title: {
        textAlign: 'center',
        fontSize: 24,
        marginTop: 8,
    },
    subtitle: {
        textAlign: 'center',
        fontSize: 16,
        opacity: 0.8,
    },
});
