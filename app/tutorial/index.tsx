import React from 'react';
import { View, Image, ScrollView, StyleSheet } from 'react-native';
import Onboarding from 'react-native-onboarding-swiper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView'
import { Card } from '@/components/ThemedView'
import LottieView from 'lottie-react-native';
import { useNavigation } from 'expo-router';
import { useEffect } from 'react';

export default function TutorialScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { t } = useTranslation();

    useEffect(() => {
        navigation.setOptions({
            title: 'Tutorial',
            headerLeft: () => null,
        });
    }, [navigation]);


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
                                source={require('@/assets/tutorial/willkommen-animation.json')}
                                autoPlay
                                loop
                                style={{ width: 300, height: 300, alignSelf: 'center' }}
                            />
                            <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                                {t("settings.tutorial.tutorial_welcome_title")}
                            </ThemedText>
                            <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                                {t("settings.tutorial.tutorial_welcome_description")}
                            </ThemedText>
                        </View>
                    ),
                    title: '',
                    subtitle: '',
                },
                {
                    backgroundColor: '#fff',
                    image: (
                        <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                            <Image
                                source={require('@/assets/images/LogChirpy_Logo.png')}
                                resizeMode="contain"
                                style={{ width: 160, height: 160, alignSelf: 'center' }}
                            />
                            <ThemedText variant="bodyLarge" style={[styles.tutorialSectionTitle]}>
                                {t("settings.tutorial.how_to_use.title")}
                            </ThemedText>
                            <ThemedText variant="body" color="secondary" style={[styles.tutorialText]}>
                                {t("settings.tutorial.how_to_use.description")}
                            </ThemedText>
                        </View>
                    ),
                    title: '',
                    subtitle: '',


                },
                {
                    backgroundColor: '#f0f0f0',
                    image: (
                        <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                            <LottieView
                                source={require('@/assets/tutorial/AI-animation.json')}
                                autoPlay
                                loop
                                style={{ width: 200, height: 200 }}
                            />
                            <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                                {t("settings.tutorial.image_processing_ai.title")}
                            </ThemedText>
                            <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                                {t("settings.tutorial.image_processing_ai.description")}
                            </ThemedText>
                        </View>
                    ),
                    title: '',
                    subtitle: '',
                },
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
                    backgroundColor: '#fff',
                    image: (
                        <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                            <LottieView
                                source={require('@/assets/tutorial/audio-animation.json')}
                                autoPlay
                                loop
                                style={{ width: 200, height: 210 }}
                            />
                            <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                                {t('settings.tutorial.record_audio')}
                            </ThemedText>
                            <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                                {t('settings.tutorial.audio_recording')}
                            </ThemedText>
                        </View>
                    ),
                    title: '',
                    subtitle: '',
                },
                {
                    backgroundColor: '#fff',
                    image: (
                        <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                            <LottieView
                                source={require('@/assets/tutorial/manual-animation.json')}
                                autoPlay
                                loop
                                style={{ width: 200, height: 210 }}
                            />
                            <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                                {t('settings.tutorial.manual_entry')}
                            </ThemedText>
                            <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                                {t('settings.tutorial.manual_entry_description')}
                            </ThemedText>
                        </View>
                    ),
                    title: '',
                    subtitle: '',
                },

                {
                    backgroundColor: '#fff',
                    image: (
                        <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                            <LottieView
                                source={require('@/assets/tutorial/Datenschutz-animation.json')}
                                autoPlay
                                loop
                                style={{ width: 200, height: 210 }}
                            />
                            <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                                {t("settings.tutorial.data_privacy.title")}
                            </ThemedText>
                            <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                                {t("settings.tutorial.data_privacy.description")}
                            </ThemedText>
                        </View>
                    ),
                    title: '',
                    subtitle: '',
                },
                {
                    backgroundColor: '#fff',
                    image: (
                        <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                            <LottieView
                                source={require('@/assets/tutorial/login-animation.json')} 
                                autoPlay
                                loop
                                style={{ width: 220, height: 220 }}
                            />
                            <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                                {t("settings.tutorial.login.title")}
                            </ThemedText>
                            <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                                {t("settings.tutorial.login.description")}
                            </ThemedText>
                        </View>
                    ),
                    title: '',
                    subtitle: '',
                },

            ]}
        />
    );
}

const styles = StyleSheet.create({
    tutorialCard: { padding: 0 },
    tutorialContent: { padding: 20, gap: 16 },
    tutorialSectionTitle: { fontWeight: '600', marginBottom: 10 },
    tutorialText: { lineHeight: 20 },
});