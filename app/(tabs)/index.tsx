import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedView } from '@/components/ThemedView';
import { HelloWave } from '@/components/HelloWave';
import { ThemedText } from '@/components/ThemedText';
import BirdAnimation from '@/components/BirdAnimation';
import { initDB } from '@/services/database';

export default function Index() {
    const { t } = useTranslation(); // <-- Hook into translations

    // initialise database once
    useEffect(() => {
        initDB();              // synchronous – no await needed
    }, []);

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
                {/* Background Bird Animation */}
                <BirdAnimation numberOfBirds={5} />

                {/* Foreground content */}
                <View style={styles.inner}>
                    <HelloWave />
                    <ThemedText type="title" style={styles.title}>
                        {t('welcome')}
                    </ThemedText>
                    <ThemedText type="default" style={styles.subtitle}>
                        {t('start_logging')}
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
