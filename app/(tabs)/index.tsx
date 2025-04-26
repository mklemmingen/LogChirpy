import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { HelloWave } from '@/components/HelloWave';
import { ThemedText } from '@/components/ThemedText';

export default function Index() {
    return (
        <ThemedView style={styles.container}>
            <View style={styles.inner}>
                <HelloWave />
                <ThemedText type="title" style={styles.title}>
                    Logging the Birdies here
                </ThemedText>
                <ThemedText type="default" style={styles.subtitle}>
                    Start logging, saving and exploring chirps 🐦
                </ThemedText>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    inner: {
        alignItems: 'center',
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
