import React from 'react';
import { View, Image, ScrollView, StyleSheet } from 'react-native';
import Onboarding from 'react-native-onboarding-swiper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView'
import { Card } from '@/components/ThemedView'
import LottieView from 'lottie-react-native';

export default function TutorialScreen() {
    const router = useRouter();
    const { t } = useTranslation();


    const InfoCard = () => (
        <Card style={styles.tutorialCard}>
            <View style={styles.tutorialContent}>
                <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                    {t("settings.tutorial.how_to_use.title")}
                </ThemedText>
                <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                    {t("settings.tutorial.how_to_use.description")}
                </ThemedText>



                <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                    {t("settings.tutorial.ai_models.title")}
                </ThemedText>
                <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                    {t("settings.tutorial.ai_models.description")}
                </ThemedText>

                <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                    {t("settings.tutorial.data_privacy.title")}
                </ThemedText>
                <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                    {t("settings.tutorial.data_privacy.description")}
                </ThemedText>
            </View>
        </Card>
    );

    return (
        <Onboarding
            onDone={() => router.back()}
            onSkip={() => router.back()}
            skipLabel={t("common.skip")}       
            nextLabel={t("common.next")}       
            pages={[
                {
                    backgroundColor: '#fff',
                    image: (
                        <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                            <LottieView
                                source={require('@/assets/tutorial/camera-animation.json')}
                                autoPlay
                                loop
                                style={{ width: 200, height: 200 }}
                            />
                            <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                                {t("settings.tutorial.image_processing.title")}
                            </ThemedText>
                            <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                                {t("settings.tutorial.image_processing.description")}
                            </ThemedText>
                        </View>
                    ),
                    title: '',
                    subtitle: '',
                },
                {
                    backgroundColor: '#e6f7ff',
                    image: (
                        <LottieView
                            source={require('@/assets/tutorial/map-animation.json')}
                            autoPlay
                            loop
                            style={{ width: 200, height: 200 }}
                        />
                    ),
                    title: '🗺️ Standort & Karte',
                    subtitle: 'Speichere Beobachtungen mit GPS und sieh sie auf der Karte.',
                },
                {
                    backgroundColor: '#f0f0f0',
                    image: (
                        <LottieView
                            source={require('@/assets/tutorial/AI-animation.json')}
                            autoPlay
                            loop
                            style={{ width: 200, height: 200 }}
                        />
                    ), title: '🤖 KI-Erkennung',
                    subtitle: 'Automatische Artenerkennung durch Kamera und Tonaufnahme.',
                },
                {
                    backgroundColor: '#fefefe',
                    image: <ScrollView style={{ maxHeight: 300 }}>{InfoCard()}</ScrollView>,
                    title: t("settings.tutorial.title"),
                    subtitle: t("settings.tutorial.subtitle"),
                },
            ]}
        />
    );
}

const styles = StyleSheet.create({
    tutorialCard: { padding: 0 },
    tutorialContent: { padding: 20, gap: 16 },
    tutorialSectionTitle: { fontWeight: '600', marginTop: 8 },
    tutorialText: { lineHeight: 20 },
});