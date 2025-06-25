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
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Video as VideoType } from 'expo-av';
import { TouchableOpacity, Text } from 'react-native';
import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { TouchableWithoutFeedback } from 'react-native';

export default function TutorialScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { t, i18n } = useTranslation();
    const videoRef = useRef<VideoType>(null);;
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const lang = i18n.language || 'de';

    useEffect(() => {
        navigation.setOptions({
            title: 'Tutorial',
            headerLeft: () => null,
        });
    }, [navigation]);

    const pauseVideo = async () => {
        if (videoRef.current) {
            const status = await videoRef.current.getStatusAsync();
            if (status.isLoaded && status.isPlaying) {
                await videoRef.current.pauseAsync();
                setIsPlaying(false);
            }
        }
    };
    const CustomNextButton = ({ isLight, ...props }: any) => (
        <TouchableOpacity
            {...props}
            onPress={async () => {
                if (currentPage === 0) {
                    await pauseVideo();
                }
                props.onPress?.();
            }}
            style={{ marginHorizontal: 10 }}
        >
            <Text style={{ fontSize: 16, color: isLight ? '#000' : '#fff' }}>
                {t("common.next")}
            </Text>
        </TouchableOpacity>
    );
    const subtitles = [
        { key: 'intro.line1', start: 5, end: 7 },
        { key: 'intro.line2', start: 6, end: 11 },
        { key: 'intro.line3', start: 11, end: 16 },
        { key: 'intro.line4', start: 16, end: 21 },
        { key: 'intro.line5', start: 21, end: 24 },
        { key: 'intro.line6', start: 24, end: 28},
    ];
    const generateSubtitles = () => {
        return subtitles.map(({ key, start, end }) => ({
            text: t(key, { lng: lang }), // Hole die Übersetzung in aktueller Sprache
            start,
            end,
        }));
    };

    const subtitleSet = generateSubtitles();

    return (
        <Onboarding
            onDone={() => router.back()}
            onSkip={() => router.back()}
            onPageChange={(index: number) => setCurrentPage(index)}
            NextButtonComponent={CustomNextButton}
            skipLabel={t("common.skip")}
            nextLabel={t("common.next")}
            pages={[
                {
                    backgroundColor: '#fff',
                    image: (
                        <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                            <TouchableWithoutFeedback onPress={() => setShowControls(true)}>
                                <View style={{ position: 'relative', width: 560, height: 340 }}>
                                    <Video
                                        ref={videoRef}
                                        source={require('@/assets/tutorial/Video/intro-fixed.mp4')}
                                        resizeMode={ResizeMode.CONTAIN}
                                        isLooping={false}
                                        onLoad={() => setVideoLoaded(true)}
                                        useNativeControls={false}
                                        onPlaybackStatusUpdate={(status) => {
                                            if ('didJustFinish' in status && status.didJustFinish) {
                                                setIsPlaying(false);
                                            }
                                            if ('positionMillis' in status && status.isLoaded) {
                                                if (lang === 'en') {
                                                    setCurrentSubtitle('');
                                                    return;
                                                }
                                                const currentTime = status.positionMillis / 1000;
                                                const subtitleSet = generateSubtitles();
                                                const found = subtitleSet.find(s => currentTime >= s.start && currentTime < s.end);
                                                setCurrentSubtitle(found ? found.text : '');
                                            }
                                        }}
                                        onError={(error) => {
                                            console.error('Video error:', error);
                                            setVideoLoaded(false);
                                        }}
                                        style={{ width: 490, height: 370, alignSelf: 'center' }}
                                    />{videoLoaded && showControls && (
                                        <TouchableOpacity
                                            onPress={async () => {
                                                if (videoRef.current) {
                                                    const status = await videoRef.current.getStatusAsync();
                                                    if ('isLoaded' in status && status.isLoaded) {
                                                        const atEnd =
                                                            typeof status.positionMillis === 'number' &&
                                                            typeof status.durationMillis === 'number' &&
                                                            status.positionMillis >= status.durationMillis;

                                                        if (status.isPlaying) {
                                                            await videoRef.current.pauseAsync();
                                                            setIsPlaying(false);
                                                            setShowControls(true);
                                                        } else {
                                                            if (atEnd) {
                                                                await videoRef.current.setPositionAsync(0);
                                                            }
                                                            await videoRef.current.playAsync();
                                                            setIsPlaying(true);
                                                            setShowControls(true);
                                                            setTimeout(() => {
                                                                setShowControls(false);
                                                            }, 1000);
                                                        }
                                                    }
                                                }
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '45%',
                                                backgroundColor: 'rgba(0,0,0,0.4)',
                                                borderRadius: 30,
                                                padding: 10,
                                            }}
                                        >
                                            <Ionicons
                                                name={isPlaying ? 'pause' : 'play'}
                                                size={32}
                                                color="white"
                                            />
                                        </TouchableOpacity>
                                    )}
                                    {currentSubtitle !== '' && (
                                        <Text style={{
                                            position: 'absolute',
                                            bottom: -100,
                                            alignSelf: 'center',
                                            color: 'white',
                                            backgroundColor: 'rgba(0,0,0,0.6)',
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 6,
                                            fontSize: 15,
                                            textAlign: 'center',
                                        }}>
                                            {currentSubtitle}
                                        </Text>

                                    )}

                                </View>
                            </TouchableWithoutFeedback>
                        </View >
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
    subtitle: {
        textAlign: 'center',
        marginBottom: 5,
        fontSize: 14,
        color: '#333',
    },
});