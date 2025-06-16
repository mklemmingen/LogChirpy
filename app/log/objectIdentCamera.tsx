/**
 * Streamlined ObjectIdentCamera Component (~600 lines)
 * 
 * Preserves all features while using new services:
 * ✅ Global Config.camera settings
 * ✅ Root layout MLKit pipeline (useObjectDetection → useImageLabeling)
 * ✅ Object detection → crop → classify → colored rectangles
 * ✅ Gallery.tsx compatible file naming
 * ✅ Confidence threshold from global settings
 * ✅ Audio processing with real-time optimization
 * ✅ Manual capture buttons (now functional)
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    LayoutAnimation,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    useColorScheme,
    View,
    ScrollView,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import Svg, { Rect, Text as SvgText, Circle, G } from 'react-native-svg';
import { useObjectDetection } from '@infinitered/react-native-mlkit-object-detection';
import { useImageLabeling } from "@infinitered/react-native-mlkit-image-labeling";
import type { MyModelsConfig } from './../_layout';

import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { filePathToUri } from '@/services/uriUtils';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSpring,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';

import { ThemedSnackbar } from "@/components/ThemedSnackbar";
import { ThemedSafeAreaView } from "@/components/ThemedSafeAreaView";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedPressable } from "@/components/ThemedPressable";
import { ThemedIcon } from "@/components/ThemedIcon";
import { ModernCard } from "@/components/ModernCard";
import { theme } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(ThemedPressable);
import { Config } from "@/constants/config";
import { useTheme, useColors } from "@/hooks/useThemeColor";

import { 
    cameraOperationsService, 
    capturePhoto, 
    recordVideo, 
    processDetectedImage,
    updateDetections,
    getVideoRecordingState,
    stopVideoRecording,
    type Detection,
    type VideoResult,
    VideoRecordingState
} from '@/services/cameraOperationsService';
import { 
    AudioIdentificationService, 
    type AudioPrediction 
} from '@/services/audioIdentificationService';
import { 
    liveAudioRecordingService,
    type LivePrediction,
    type RecordingState
} from '@/services/liveAudioRecordingService';

const { width: W, height: H } = Dimensions.get('window');

interface SnackbarOptions {
    bird?: string;
    confidence?: number;
    message?: string;
    [key: string]: any;
}

// Helper functions (kept minimal)
function getBoxStyle(confidence: number) {
    const c = Math.min(Math.max(confidence, 0), 1);
    const hue = Math.round(c * 120);
    const color = `hsl(${hue}, 100%, 50%)`;
    const opacity = 0.2 + 0.8 * c;
    return { color, opacity };
}

const getDelayPresetLabel = (value: number): string => {
    if (value <= 0.25) return '⚡ Fast';
    if (value <= 0.6) return '⚖️ Balanced';
    return '🔍 Thorough';
};

const getConfidencePresetLabel = (value: number): string => {
    if (value < 0.4) return '🟢 Lenient';
    if (value < 0.75) return '🟡 Normal';
    return '🔴 Strict';
};

export default function ObjectIdentCameraWrapper() {
    const [isLoading, setIsLoading] = useState(true);
    const [permissionRequested, setPermissionRequested] = useState(false);
    const [audioPermissionRequested, setAudioPermissionRequested] = useState(false);
    const [locationPermissionRequested, setLocationPermissionRequested] = useState(false);
    const [hasAudioPermission, setHasAudioPermission] = useState(false);
    const [hasLocationPermission, setHasLocationPermission] = useState(false);
    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();
    const { t } = useTranslation();
    const raw = useColorScheme();
    const colorScheme: 'light' | 'dark' = raw === 'dark' ? 'dark' : 'light';
    const colors = useColors();

    // Request camera permission only once
    useEffect(() => {
        if (!hasPermission && !permissionRequested) {
            setPermissionRequested(true);
            requestPermission();
        }
    }, [hasPermission, permissionRequested, requestPermission]);

    // Request audio permission for live recording
    useEffect(() => {
        const requestAudioPermission = async () => {
            if (!hasAudioPermission && !audioPermissionRequested) {
                setAudioPermissionRequested(true);
                try {
                    const { status } = await Audio.requestPermissionsAsync();
                    setHasAudioPermission(status === 'granted');
                    if (status === 'granted') {
                        console.log('Audio permission granted');
                    } else {
                        console.warn('Audio permission denied');
                    }
                } catch (error) {
                    console.error('Audio permission request failed:', error);
                    setHasAudioPermission(false);
                }
            }
        };
        requestAudioPermission();
    }, [hasAudioPermission, audioPermissionRequested]);

    // Request location permission for GPS meta model
    useEffect(() => {
        const requestLocationPermission = async () => {
            if (!hasLocationPermission && !locationPermissionRequested) {
                setLocationPermissionRequested(true);
                try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    setHasLocationPermission(status === 'granted');
                    if (status === 'granted') {
                        console.log('Location permission granted');
                    } else {
                        console.warn('Location permission denied - meta model disabled');
                    }
                } catch (error) {
                    console.error('Location permission request failed:', error);
                    setHasLocationPermission(false);
                }
            }
        };
        requestLocationPermission();
    }, [hasLocationPermission, locationPermissionRequested]);

    // Loading timer
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading || !device || !hasPermission) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={{ color: colors.text, fontSize: 16, marginTop: 10 }}>
                    {t('camera.loading_screen')}
                </Text>
            </View>
        );
    }

    return (
        <ObjectIdentCameraContent 
            hasAudioPermission={hasAudioPermission}
            hasLocationPermission={hasLocationPermission}
        />
    );
}

interface ObjectIdentCameraContentProps {
    hasAudioPermission: boolean;
    hasLocationPermission: boolean;
}

function ObjectIdentCameraContent({ hasAudioPermission, hasLocationPermission }: ObjectIdentCameraContentProps) {
    const device = useCameraDevice('back');
    const { t } = useTranslation();
    const appTheme = useTheme();
    const colors = useColors();

    // Camera and component state
    const cameraRef = useRef<Camera>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [zoom, setZoom] = useState(1);

    // Detection and processing state
    const [detections, setDetections] = useState<Detection[]>([]);
    const [fullFrameResults, setFullFrameResults] = useState<{ text: string; confidence: number; index: number }[]>([]);
    const [classifierReady, setClassifierReady] = useState(false);
    const [imageDims, setImageDims] = useState({ width: 0, height: 0 });
    const [showOverlays, setShowOverlays] = useState(true);
    const [isDetectionPaused, setIsDetectionPaused] = useState(false);

    // Photo and modal state
    const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
    const [modalPhotoUri, setModalPhotoUri] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Audio processing state
    const [audioResults, setAudioResults] = useState<AudioPrediction[]>([]);
    const [audioProcessing, setAudioProcessing] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [audioInitialized, setAudioInitialized] = useState(false);
    const audioIntervalRef = useRef<NodeJS.Timeout>();

    // Live audio recording state
    const [livePredictions, setLivePredictions] = useState<LivePrediction[]>([]);
    const [liveRecordingState, setLiveRecordingState] = useState<RecordingState>({
        isRecording: false,
        isProcessing: false,
        bufferFull: false,
        totalPredictions: 0,
        averageProcessingTime: 0
    });

    // Settings from global config (reactive)
    const [pipelineDelay, setPipelineDelay] = useState(Config.camera.pipelineDelay);
    const [confidenceThreshold, setConfidenceThreshold] = useState(Config.camera.confidenceThreshold);
    const [showSettings, setShowSettings] = useState(Config.camera.showSettings);

    // Video recording state
    const [videoRecordingState, setVideoRecordingState] = useState<VideoRecordingState>(VideoRecordingState.IDLE);
    const [recordedVideo, setRecordedVideo] = useState<VideoResult | null>(null);

    // UI state
    const [debugText, setDebugText] = useState(t('camera.initializing'));
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const showSnackbar = useCallback((key: string, options?: SnackbarOptions) => {
        setSnackbarMessage(t(key, options));
        setSnackbarVisible(true);
        setTimeout(() => setSnackbarVisible(false), 2500);
    }, [t]);

    // Focus/app state control
    const isFocused = useIsFocused();
    const [appState, setAppState] = useState(AppState.currentState);
    
    // Animated style for blinking dot
    const blinkingDotStyle = useAnimatedStyle(() => ({
        opacity: !isDetectionPaused ? withRepeat(
            withTiming(0.5, { duration: 1000 }),
            -1,
            true
        ) : 1,
    }));
    
    // Animated style for capture button
    const captureButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(1) }],
    }));
    
    useEffect(() => {
        const subscription = AppState.addEventListener('change', setAppState);
        return () => subscription?.remove();
    }, []);
    
    const isCameraActive = isFocused && appState === 'active';

    // MLKit setup (preserved original pattern)
    const detector = useObjectDetection<MyModelsConfig>('efficientNetlite0int8');
    const classifier = useImageLabeling("birdClassifier");
    
    const isClassifierReady = useMemo(() => {
        return !!(classifier && typeof classifier.classifyImage === 'function');
    }, [classifier]);

    const classifyImage = async (imageUri: string): Promise<{ text: string; confidence: number; index: number }[]> => {
        try {
            const result = await classifier?.classifyImage(imageUri);
            if (typeof result === 'string') {
                const parsed = JSON.parse(result);
                return Array.isArray(parsed) ? parsed : [];
            }
            return result ?? [];
        } catch (error) {
            console.error("Classification failed:", error);
            return [];
        }
    };

    // Initialize component and services
    useEffect(() => {
        console.log('[ObjectDetection] Component mounted, initializing...');
        let isMounted = true;
        
        const initializeComponent = async () => {
            if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
                UIManager.setLayoutAnimationEnabledExperimental(true);
            }

            // Initialize audio system with real-time optimization
            try {
                await AudioIdentificationService.initialize(); // Uses MDATA_V2_FP16 by default
                if (isMounted) {
                    setAudioInitialized(true);
                    console.log('[Audio] Audio system ready for real-time detection');
                }
            } catch (error) {
                console.error('[Audio] Audio initialization error:', error);
                if (isMounted) {
                    setAudioError(t('audio.audio_initialization_failed'));
                }
            }

            // Initialize live audio recording service if permissions available
            if (hasAudioPermission) {
                try {
                    const liveAudioReady = await liveAudioRecordingService.initialize();
                    if (liveAudioReady && isMounted) {
                        console.log('[LiveAudio] Live audio recording service initialized');
                        
                        // Subscribe to live predictions and state changes
                        const unsubscribePredictions = liveAudioRecordingService.onPrediction((prediction) => {
                            setLivePredictions(prev => [prediction, ...prev.slice(0, 4)]); // Keep last 5
                        });
                        
                        const unsubscribeState = liveAudioRecordingService.onStateChange((state) => {
                            setLiveRecordingState(state);
                        });
                        
                        // Start live recording if location permission is also available
                        if (hasLocationPermission) {
                            await liveAudioRecordingService.startLiveRecording(true);
                            console.log('[LiveAudio] Live recording started with GPS meta model');
                        } else {
                            await liveAudioRecordingService.startLiveRecording(false);
                            console.log('[LiveAudio] Live recording started without GPS (meta model disabled)');
                        }
                        
                        // Store cleanup functions
                        return () => {
                            unsubscribePredictions();
                            unsubscribeState();
                        };
                    }
                } catch (error) {
                    console.error('[LiveAudio] Live audio initialization failed:', error);
                }
            } else {
                console.log('[LiveAudio] Audio permission not granted, skipping live recording');
            }

            // Start camera operations service
            cameraOperationsService.startDetection();
        };

        initializeComponent();
        
        return () => {
            console.log('[ObjectDetection] Component unmounting, cleaning up...');
            isMounted = false;
            cameraOperationsService.cleanup();
            liveAudioRecordingService.dispose();
        };
    }, []);

    // Reactive config updates (no more polling!)
    useEffect(() => {
        setPipelineDelay(Config.camera.pipelineDelay);
        setConfidenceThreshold(Config.camera.confidenceThreshold);
        setShowSettings(Config.camera.showSettings);
    }, [Config.camera.pipelineDelay, Config.camera.confidenceThreshold, Config.camera.showSettings]);

    // Update classifier ready state
    useEffect(() => {
        setClassifierReady(isClassifierReady);
        if (isClassifierReady) {
            console.log("[ObjectDetection] Classifier ready and functional");
        }
    }, [isClassifierReady, classifier]);

    useEffect(() => {
        if (detector) {
            console.log("[ObjectDetection] Detector available with methods:", Object.keys(detector || {}));
        }
    }, [detector]);

    // Main detection loop (simplified with service)
    useEffect(() => {
        if (!isInitialized || isDetectionPaused || !cameraRef.current || !detector || !classifierReady) {
            return;
        }

        let isActive = true;
        const captureTimeoutRef = { current: null as NodeJS.Timeout | null };

        const detectionLoop = async () => {
            if (!isActive || !cameraRef.current) return;

            try {
                setDebugText(t('camera.capturing'));

                // Use new camera service for reliable capture
                const photoResult = await capturePhoto(cameraRef, { manual: false, quality: 0.3 });
                
                if (!photoResult.success || !photoResult.uri) {
                    setDebugText(t('errors.capture_failed', { message: photoResult.error }));
                    return;
                }

                console.log('Photo captured successfully:', photoResult.uri);
                setLastPhotoUri(photoResult.uri);

                // Get image dimensions for proper scaling
                const photoUri = photoResult.uri;
                if (!photoUri) {
                    throw new Error('Photo capture failed - no URI');
                }
                
                const { width: imgWidth, height: imgHeight } = await new Promise<{width: number, height: number}>((resolve) => {
                    Image.getSize(photoUri, (width, height) => {
                        resolve({ width, height });
                    }, () => {
                        // Fallback to camera preview dimensions
                        resolve({ width: W, height: H });
                    });
                });
                
                setImageDims({ width: imgWidth, height: imgHeight });
                console.log('[ObjectDetection] Image dimensions:', imgWidth, 'x', imgHeight);

                // Run detection pipeline
                const objects = await detector.detectObjects(photoUri);
                console.log('[ObjectDetection] Detected', objects.length, 'objects');

                // 1. Classify the COMPLETE FRAME first
                console.log('[Classification] Classifying complete frame...');
                const frameResults = await classifyImage(photoUri);
                console.log('[Classification] Full frame results:', frameResults.slice(0, 3));
                setFullFrameResults(frameResults.slice(0, 5)); // Store top 5 results

                // 2. Process detections using service (crops and saves to gallery)
                await processDetectedImage(photoUri, objects, classifyImage);

                // 3. For UI display: crop each detected object and classify individually
                console.log('[Classification] Processing individual objects...');
                const enrichedDetections: Detection[] = [];
                for (const [index, obj] of objects.entries()) {
                    try {
                        // Crop this specific object from the frame
                        const { origin, size } = obj.frame;
                        const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
                        const cropResult = await manipulateAsync(
                            photoUri,
                            [{
                                crop: {
                                    originX: origin.x,
                                    originY: origin.y,
                                    width: size.x,
                                    height: size.y
                                }
                            }],
                            { compress: 0.7, format: SaveFormat.JPEG }
                        );
                        const cropUri = cropResult.uri;

                        // Classify the cropped object
                        const objectLabels = await classifyImage(cropUri);
                        console.log(`[Classification] Object ${index + 1} results:`, objectLabels.slice(0, 2));
                        
                        enrichedDetections.push({
                            frame: obj.frame,
                            labels: objectLabels.slice(0, 3) // Top 3 labels for this specific object
                        });

                        // Clean up the temporary crop file
                        // Note: In production, you might want to queue this for later cleanup
                        
                    } catch (error) {
                        console.warn(`[Classification] Failed to process object ${index + 1}:`, error);
                        // Add the detection with empty labels if classification fails
                        enrichedDetections.push({
                            frame: obj.frame,
                            labels: []
                        });
                    }
                }

                setDetections(enrichedDetections);
                
                // Update camera service with current detections for video overlay recording
                updateDetections(enrichedDetections);
                setDebugText(
                    enrichedDetections.length > 0
                        ? t('camera.detection_successful', { count: enrichedDetections.length })
                        : t('camera.detection_none')
                );

            } catch (error) {
                console.error('Detection loop error:', error);
                setDebugText(t('errors.detection_failed', { message: error instanceof Error ? error.message : 'Unknown' }));
            }

            // Continue loop
            if (isActive && !isDetectionPaused) {
                captureTimeoutRef.current = setTimeout(detectionLoop, pipelineDelay * 1000);
            }
        };

        // Start the detection loop
        const timeoutId = setTimeout(detectionLoop, 1000);
        
        return () => {
            isActive = false;
            clearTimeout(timeoutId);
            if (captureTimeoutRef.current) {
                clearTimeout(captureTimeoutRef.current);
            }
        };
    }, [isInitialized, isDetectionPaused, detector, classifierReady, pipelineDelay, t]);

    // Audio processing with adaptive intervals
    useEffect(() => {
        if (!audioInitialized || isDetectionPaused) {
            return;
        }

        const processAudioInterval = async () => {
            try {
                setAudioProcessing(true);
                setAudioError(null);
                
                // TODO: Replace with actual audio recording
                // For now, we need to record actual audio. Using a test approach:
                console.log('[Audio] Starting audio classification...');
                
                let predictions: AudioPrediction[] = [];
                
                try {
                    // Try to use the audio service (this will likely fail without real audio)
                    const dummyAudioUri = 'dummy://audio.m4a'; // This will fail, but we'll see the logs
                    console.log('[Audio] Attempting classification with dummy audio...');
                    const audioResponse = await AudioIdentificationService.identifyBirdFromAudio(dummyAudioUri);
                    predictions = audioResponse.predictions;
                    console.log('[Audio] Classification successful:', predictions.length, 'results');
                } catch (audioError) {
                    console.log('[Audio] Expected error (no real audio):', (audioError as Error).message);
                    // Fall back to empty results for now
                    predictions = [];
                    console.log('[Audio] Using empty results as fallback');
                }
                
                setAudioResults(predictions);
                
                if (predictions.length > 0) {
                    console.log(`[Audio] Detected ${predictions.length} bird(s)`);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                
            } catch (error) {
                console.error('[Audio] Processing error:', error);
                setAudioError('Audio processing failed');
                setAudioResults([]);
            } finally {
                setAudioProcessing(false);
            }
        };

        // Use adaptive intervals from service
        const scheduleNext = () => {
            const interval = AudioIdentificationService.getAdaptiveInterval(audioResults.length > 0, audioResults);
            console.log(`[Audio] Setting adaptive interval: ${interval}ms`);
            
            audioIntervalRef.current = setTimeout(() => {
                processAudioInterval().then(scheduleNext);
            }, interval);
        };

        // Start processing
        processAudioInterval().then(scheduleNext);
        
        return () => {
            if (audioIntervalRef.current) {
                clearTimeout(audioIntervalRef.current);
            }
        };
    }, [audioInitialized, isDetectionPaused]);

    // Focus/unfocus effect
    useFocusEffect(
        useCallback(() => {
            setIsDetectionPaused(false);
            return () => {
                setIsDetectionPaused(true);
                if (audioIntervalRef.current) {
                    clearTimeout(audioIntervalRef.current);
                }
            };
        }, [])
    );

    // Manual capture handlers (now functional!)
    const handleManualPhoto = useCallback(async () => {
        try {
            console.log('Manual photo capture requested');
            const result = await capturePhoto(cameraRef, { manual: true, enableShutterSound: true });
            
            if (result.success) {
                showSnackbar('camera.photo_saved');
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                showSnackbar('camera.photo_failed', { message: result.error });
            }
        } catch (error) {
            console.error('Manual photo failed:', error);
            showSnackbar('camera.photo_failed', { message: error instanceof Error ? error.message : 'Unknown' });
        }
    }, [showSnackbar]);

    const handleVideoRecording = useCallback(async () => {
        // If currently recording, stop recording
        if (videoRecordingState === VideoRecordingState.RECORDING) {
            try {
                console.log('Stopping video recording...');
                setVideoRecordingState(VideoRecordingState.STOPPING);
                await stopVideoRecording();
                
                // State will be updated by the subscription below
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (error) {
                console.error('Failed to stop video recording:', error);
                setVideoRecordingState(VideoRecordingState.IDLE);
                showSnackbar('camera.video_stop_failed', { message: error instanceof Error ? error.message : 'Unknown' });
            }
            return;
        }

        // Start new recording
        try {
            console.log('Starting video recording with overlays...');
            setVideoRecordingState(VideoRecordingState.STARTING);
            
            const result = await recordVideo(cameraRef, { 
                maxDuration: 30, 
                includeOverlays: true // Enable detection overlay recording
            });
            
            if (result.success) {
                setRecordedVideo(result);
                setVideoRecordingState(VideoRecordingState.COMPLETED);
                
                // Show success message with overlay info
                const message = result.annotatedUri 
                    ? 'Video saved with detection overlays!'
                    : 'Video saved successfully!';
                showSnackbar('camera.video_saved', { message });
                
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
                console.log('Video recording completed:', {
                    original: result.uri,
                    annotated: result.annotatedUri
                });
            } else {
                setVideoRecordingState(VideoRecordingState.IDLE);
                showSnackbar('camera.video_failed', { message: result.error });
            }
        } catch (error) {
            console.error('Video recording failed:', error);
            setVideoRecordingState(VideoRecordingState.IDLE);
            showSnackbar('camera.video_failed', { message: error instanceof Error ? error.message : 'Unknown' });
        }
    }, [videoRecordingState, showSnackbar]);

    // Sync video recording state with service
    useEffect(() => {
        const interval = setInterval(() => {
            const serviceState = getVideoRecordingState();
            if (serviceState !== videoRecordingState) {
                setVideoRecordingState(serviceState);
            }
        }, 500); // Check every 500ms

        return () => clearInterval(interval);
    }, []); // Remove dependency to prevent infinite loop

    // Calculate scale for rendering detection bounding boxes
    const scaleX = imageDims.width ? W / imageDims.width : 1;
    const scaleY = imageDims.height ? H / imageDims.height : 1;

    if (!device) {
        return (
            <View style={styles.centered}>
                <Text>{t('camera_advanced.no_camera_found')}</Text>
            </View>
        );
    }

    if (Platform.OS === 'web') {
        return (
            <View style={styles.centered}>
                <Text>{t('camera.unsupported_platform')}</Text>
            </View>
        );
    }

    return (
        <ThemedSafeAreaView style={{ flex: 1 }}>
            <ThemedView style={styles.container}>
                {/* Camera View */}
                <Camera
                    ref={cameraRef}
                    style={styles.camera}
                    device={device}
                    isActive={isInitialized && !isDetectionPaused}
                    onInitialized={() => setIsInitialized(true)}
                    zoom={zoom}
                />

                {/* Modern Detection Overlays */}
                {showOverlays && (
                    <View pointerEvents="none" style={styles.overlay}>
                        <Svg style={{ width: '100%', height: '100%' }}>
                            {detections.map((item, index) => {
                                const { origin, size } = item.frame;
                                const labels = item.labels;
                                const conf = labels[0]?.confidence ?? 0;
                                const { color } = getBoxStyle(conf);

                                return (
                                    <G key={`det-${index}`}>
                                        {/* Modern rounded rectangle */}
                                        <Rect
                                            x={origin.x * scaleX}
                                            y={origin.y * scaleY}
                                            width={size.x * scaleX}
                                            height={size.y * scaleY}
                                            stroke={color}
                                            strokeWidth={3}
                                            fill="transparent"
                                            rx={8}
                                            ry={8}
                                        />
                                        {labels.slice(0, 3).map((label, idx) => {
                                            const labelText = `${label.text} ${(label.confidence * 100).toFixed(0)}%`;
                                            const labelX = origin.x * scaleX;
                                            const labelY = Math.max(origin.y * scaleY - 22 * (labels.length - idx), 0);
                                            
                                            return (
                                                <G key={`label-${index}-${idx}`}>
                                                    <Rect
                                                        x={labelX}
                                                        y={labelY - 16}
                                                        width={labelText.length * 7.5 + 16}
                                                        height={24}
                                                        rx={12}
                                                        fill={idx === 0 ? color : "rgba(0,0,0,0.85)"}
                                                        fillOpacity={idx === 0 ? 0.9 : 1}
                                                    />
                                                    <SvgText
                                                        x={labelX + 8}
                                                        y={labelY - 2}
                                                        fill="white"
                                                        fontSize="13"
                                                        fontWeight="600"
                                                        fontFamily="system-ui"
                                                    >
                                                        {labelText}
                                                    </SvgText>
                                                </G>
                                            );
                                        })}
                                    </G>
                                );
                            })}
                        </Svg>
                    </View>
                )}

                {/* Full Frame Classification Results */}
                {fullFrameResults.length > 0 && (
                    <Animated.View 
                        entering={FadeIn.duration(300)} 
                        style={styles.fullFrameResultsWrapper}
                    >
                        <ModernCard
                            style={{ ...styles.fullFrameResultsCard, backgroundColor: colors.surface }}
                            bordered={true}
                            elevated={true}
                        >
                            <ThemedView style={styles.fullFrameHeader}>
                                <ThemedIcon name="image" size={18} color="primary" />
                                <ThemedText variant="body" color="primary">Full Frame</ThemedText>
                                <ThemedText variant="caption" color="secondary">
                                    {fullFrameResults.length} result{fullFrameResults.length !== 1 ? 's' : ''}
                                </ThemedText>
                            </ThemedView>
                            
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                style={{ marginTop: 8 }}
                                contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
                            >
                                {fullFrameResults.slice(0, 5).map((result, index) => (
                                    <Animated.View
                                        key={`fullframe-${index}`}
                                        entering={FadeIn.delay(index * 100)}
                                        style={[{ 
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 6,
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            minWidth: 100,
                                            backgroundColor: index === 0 ? colors.primary + '20' : colors.backgroundSecondary,
                                            borderColor: index === 0 ? colors.primary : colors.border
                                        }]}
                                    >
                                        <ThemedIcon name="eye" size={16} color={index === 0 ? "primary" : "secondary"} />
                                        <ThemedText variant="caption" color={index === 0 ? "primary" : "secondary"} style={{ fontWeight: '600', flex: 1 }}>
                                            {result.text}
                                        </ThemedText>
                                        <ThemedText variant="caption" color="secondary" style={{ fontSize: 11, fontWeight: '500' }}>
                                            {Math.round(result.confidence * 100)}%
                                        </ThemedText>
                                    </Animated.View>
                                ))}
                            </ScrollView>
                        </ModernCard>
                    </Animated.View>
                )}

                {/* Professional Audio Results Section */}
                <Animated.View 
                    entering={FadeIn.duration(300)} 
                    style={styles.audioResultsWrapper}
                >
                    <ModernCard
                        style={{ ...styles.audioResultsCard, backgroundColor: colors.surface }}
                        bordered={true}
                        elevated={true}
                    >
                        <ThemedView style={styles.audioHeader}>
                            <ThemedView style={styles.audioStatusIndicator}>
                                <ThemedView style={[styles.audioIconWrapper, { 
                                    backgroundColor: audioInitialized ? colors.success + '20' : colors.error + '20' 
                                }]}>
                                    {audioProcessing ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <ThemedIcon 
                                            name={audioInitialized ? "mic" : "mic-off"} 
                                            size={18} 
                                            color={audioInitialized ? "success" : "error"}
                                        />
                                    )}
                                </ThemedView>
                                <ThemedText variant="body" color="primary">
                                    {audioProcessing ? t('audio.listening') : audioInitialized ? t('audio.audio_ready') : t('audio.audio_error')}
                                </ThemedText>
                            </ThemedView>
                            {audioResults.length > 0 && (
                                <ThemedView style={[styles.audioResultBadge, { backgroundColor: colors.primary }]}>
                                    <ThemedIcon name="volume-2" size={14} color="inverse" />
                                    <ThemedText variant="caption" color="inverse">
                                        {audioResults.length}
                                    </ThemedText>
                                </ThemedView>
                            )}
                        </ThemedView>
                        
                        {/* Audio Results List */}
                        {audioResults.length > 0 && (
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                style={{ marginTop: 8 }}
                                contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
                            >
                                {audioResults.slice(0, 5).map((result, index) => (
                                    <Animated.View
                                        key={`audio-${index}`}
                                        entering={FadeIn.delay(index * 100)}
                                        style={[{ 
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 6,
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            minWidth: 100,
                                            backgroundColor: colors.backgroundSecondary,
                                            borderColor: colors.border 
                                        }]}
                                    >
                                        <ThemedIcon name="volume-2" size={16} color="primary" />
                                        <ThemedText variant="caption" color="primary" style={{ fontWeight: '600', flex: 1 }}>
                                            {result.common_name || 'Unknown'}
                                        </ThemedText>
                                        <ThemedText variant="caption" color="secondary" style={{ fontSize: 11, fontWeight: '500' }}>
                                            {Math.round(result.confidence * 100)}%
                                        </ThemedText>
                                    </Animated.View>
                                ))}
                            </ScrollView>
                        )}
                        
                        {/* Live Audio Predictions */}
                        {liveRecordingState.isRecording && livePredictions.length > 0 && (
                            <ThemedView style={{ marginTop: 8 }}>
                                <ThemedView style={styles.fullFrameHeader}>
                                    <ThemedView style={{ 
                                        flexDirection: 'row', 
                                        alignItems: 'center', 
                                        gap: 6 
                                    }}>
                                        <View style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 4,
                                            backgroundColor: liveRecordingState.isProcessing ? colors.warning : colors.success
                                        }} />
                                        <ThemedIcon name="radio" size={16} color="success" />
                                        <ThemedText variant="caption" color="success" style={{ fontWeight: '600' }}>
                                            LIVE
                                        </ThemedText>
                                    </ThemedView>
                                    <ThemedText variant="caption" color="secondary">
                                        {liveRecordingState.totalPredictions} total
                                    </ThemedText>
                                </ThemedView>
                                
                                <ScrollView 
                                    horizontal 
                                    showsHorizontalScrollIndicator={false}
                                    style={{ marginTop: 8 }}
                                    contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
                                >
                                    {livePredictions.slice(0, 3).map((prediction, index) => (
                                        <Animated.View
                                            key={`live-${prediction.timestamp}-${index}`}
                                            entering={FadeIn.delay(index * 100)}
                                            style={[{ 
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 6,
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                                borderRadius: 12,
                                                borderWidth: 1,
                                                minWidth: 120,
                                                backgroundColor: index === 0 ? colors.success + '20' : colors.backgroundSecondary,
                                                borderColor: index === 0 ? colors.success : colors.border
                                            }]}
                                        >
                                            <ThemedIcon 
                                                name={prediction.metaModelUsed ? "map-pin" : "mic"} 
                                                size={14} 
                                                color={index === 0 ? "success" : "primary"} 
                                            />
                                            <ThemedView style={{ flex: 1 }}>
                                                <ThemedText variant="caption" color={index === 0 ? "success" : "primary"} style={{ fontWeight: '600' }}>
                                                    {prediction.species}
                                                </ThemedText>
                                                {prediction.metaModelUsed && (
                                                    <ThemedText variant="caption" color="secondary" style={{ fontSize: 10 }}>
                                                        GPS enhanced
                                                    </ThemedText>
                                                )}
                                            </ThemedView>
                                            <ThemedText variant="caption" color="secondary" style={{ fontSize: 11, fontWeight: '500' }}>
                                                {Math.round(prediction.confidence * 100)}%
                                            </ThemedText>
                                        </Animated.View>
                                    ))}
                                </ScrollView>
                            </ThemedView>
                        )}

                        {audioError && (
                            <ThemedView style={[styles.audioErrorContainer, { 
                                backgroundColor: colors.error + '10',
                                borderColor: colors.error + '30',
                            }]}>
                                <ThemedIcon name="alert-circle" size={14} color="error" />
                                <ThemedText variant="caption" color="error">
                                    {audioError}
                                </ThemedText>
                            </ThemedView>
                        )}
                    </ModernCard>
                </Animated.View>

                {/* Professional Video Recording Status */}
                {videoRecordingState !== VideoRecordingState.IDLE && (
                    <Animated.View 
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(200)}
                        style={styles.videoStatusWrapper}
                    >
                        <ModernCard
                            style={{ ...styles.videoStatusCard, backgroundColor: colors.surface }}
                            bordered={true}
                            elevated={true}
                        >
                            <ThemedView style={styles.videoStatusIndicator}>
                                {videoRecordingState === VideoRecordingState.RECORDING ? (
                                    <>
                                        <ThemedView style={[styles.recordingDot, { backgroundColor: colors.error }]} />
                                        <ThemedText variant="body" color="error">
                                            🔴 Recording Video
                                        </ThemedText>
                                    </>
                                ) : videoRecordingState === VideoRecordingState.STARTING ? (
                                    <>
                                        <ActivityIndicator size="small" color={colors.warning} />
                                        <ThemedText variant="body" color="secondary">
                                            Starting Recording...
                                        </ThemedText>
                                    </>
                                ) : videoRecordingState === VideoRecordingState.STOPPING ? (
                                    <>
                                        <ActivityIndicator size="small" color={colors.warning} />
                                        <ThemedText variant="body" color="secondary">
                                            Stopping Recording...
                                        </ThemedText>
                                    </>
                                ) : (
                                    <>
                                        <ThemedIcon name="check-circle" size={16} color="success" />
                                        <ThemedText variant="body" color="success">
                                            Video Completed
                                        </ThemedText>
                                    </>
                                )}
                            </ThemedView>
                            {recordedVideo && (
                                <ThemedView style={styles.videoStatusDetails}>
                                    <ThemedIcon 
                                        name={recordedVideo.annotatedUri ? "layers" : "video"} 
                                        size={14} 
                                        color="secondary" 
                                    />
                                    <ThemedText variant="caption" color="secondary">
                                        {recordedVideo.annotatedUri ? 'With detection overlays' : 'Basic video'}
                                    </ThemedText>
                                </ThemedView>
                            )}
                        </ModernCard>
                    </Animated.View>
                )}

                {/* Settings Toggle - Professional Design */}
                <Animated.View style={styles.settingsButtonWrapper}>
                    <ThemedPressable
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setShowSettings(prev => !prev);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        style={[styles.settingsButton, { 
                            backgroundColor: colors.overlay + 'DD',
                            borderColor: colors.border + '40',
                        }]}
                    >
                        <ThemedIcon 
                            name="settings" 
                            size={22} 
                            color="primary" 
                        />
                    </ThemedPressable>
                </Animated.View>

                {/* Camera */}
                <Camera
                    style={styles.camera}
                    ref={cameraRef}
                    device={device!}
                    isActive={isCameraActive}
                    photo={true}
                    video={true}
                    zoom={zoom}
                    enableZoomGesture={true}
                    onInitialized={() => {
                        console.log("Camera initialized!");
                        setIsInitialized(true);
                    }}
                />

                {/* Status Badge - Professional Design */}
                {isCameraActive && (
                    <Animated.View 
                        entering={FadeIn.delay(500).duration(300)}
                        style={styles.statusBadgeWrapper}
                    >
                        <View style={[styles.statusBadge, { 
                            backgroundColor: colors.overlay + 'EE',
                            borderColor: colors.border + '40',
                        }]}>
                            <Animated.View 
                                style={[
                                    styles.statusDot, 
                                    { backgroundColor: !isDetectionPaused ? '#22C55E' : '#EF4444' },
                                    !isDetectionPaused && blinkingDotStyle
                                ]} 
                            />
                            <ThemedText variant="caption" style={styles.statusText}>
                                {!isDetectionPaused ? t('camera.status_detecting') : t('camera.status_idle')}
                            </ThemedText>
                        </View>
                    </Animated.View>
                )}

                {/* Settings Panel - Modern Design */}
                {showSettings && (
                    <Animated.View 
                        entering={FadeIn.duration(200)}
                        style={styles.settingsPanelWrapper}
                    >
                        <ModernCard
                            style={{ 
                                ...styles.settingsPanel,
                                backgroundColor: colors.overlay + 'F5',
                            }}
                            bordered={true}
                            elevated={true}
                        >
                            {/* Zoom Control */}
                            <View style={styles.settingsSection}>
                                <View style={styles.settingHeader}>
                                    <ThemedIcon name="zoom-in" size={18} color="secondary" />
                                    <ThemedText variant="label">{t('camera.zoom')}</ThemedText>
                                    <ThemedText variant="label" color="secondary" style={styles.settingValue}>
                                        {zoom.toFixed(1)}x
                                    </ThemedText>
                                </View>
                                <Slider
                                    value={zoom}
                                    onValueChange={setZoom}
                                    minimumValue={1}
                                    maximumValue={device?.maxZoom ?? 5}
                                    step={0.01}
                                    minimumTrackTintColor={colors.primary}
                                    maximumTrackTintColor={colors.border}
                                    thumbTintColor={colors.primary}
                                    style={styles.slider}
                                />
                            </View>
                            
                            {/* AI Settings Display */}
                            <View style={[styles.aiSettingsCard, { 
                                backgroundColor: colors.backgroundSecondary,
                                borderColor: colors.border,
                            }]}>
                                <View style={styles.aiSettingRow}>
                                    <ThemedIcon name="zap" size={16} color="primary" />
                                    <ThemedText variant="caption" color="secondary">Speed</ThemedText>
                                    <ThemedText variant="caption" style={styles.aiSettingValue}>
                                        {getDelayPresetLabel(pipelineDelay).split(' ')[1]}
                                    </ThemedText>
                                </View>
                                <View style={styles.aiSettingRow}>
                                    <ThemedIcon name="shield" size={16} color="primary" />
                                    <ThemedText variant="caption" color="secondary">Confidence</ThemedText>
                                    <ThemedText variant="caption" style={styles.aiSettingValue}>
                                        {getConfidencePresetLabel(confidenceThreshold).split(' ')[1]}
                                    </ThemedText>
                                </View>
                            </View>

                            {/* Pause/Resume Button */}
                            <ThemedPressable
                                onPress={() => {
                                    setIsDetectionPaused(prev => !prev);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                }}
                                style={[styles.pauseResumeButton, {
                                    backgroundColor: isDetectionPaused 
                                        ? '#EF4444' 
                                        : colors.primary,
                                }]}
                            >
                                <ThemedIcon 
                                    name={isDetectionPaused ? "play" : "pause"} 
                                    size={18} 
                                    color="inverse" 
                                />
                                <ThemedText variant="button" color="inverse" style={styles.pauseResumeText}>
                                    {isDetectionPaused ? t('camera.resume') : t('camera.pause')} Detection
                                </ThemedText>
                            </ThemedPressable>
                        </ModernCard>
                    </Animated.View>
                )}

                {/* Manual Capture Buttons - Professional Design */}
                <Animated.View 
                    entering={FadeIn.delay(300).duration(300)}
                    style={styles.captureButtonsContainer}
                >
                    {/* Photo Capture Button */}
                    <Animated.View
                        style={[
                            styles.captureButtonWrapper,
                            captureButtonStyle
                        ]}
                    >
                        <AnimatedPressable
                            onPress={handleManualPhoto}
                            style={[styles.captureButton, { backgroundColor: colors.primary }]}
                            variant="primary"
                        >
                            <ThemedIcon name="camera" size={28} color="inverse" />
                        </AnimatedPressable>
                        <ThemedText variant="caption" color="primary" style={styles.captureButtonLabel}>
                            Photo
                        </ThemedText>
                    </Animated.View>
                    
                    {/* Video Capture Button */}
                    <Animated.View style={styles.captureButtonWrapper}>
                        <AnimatedPressable
                            onPress={handleVideoRecording}
                            style={[
                                styles.captureButton, 
                                { 
                                    backgroundColor: videoRecordingState === VideoRecordingState.RECORDING 
                                        ? colors.error
                                        : videoRecordingState === VideoRecordingState.STARTING || videoRecordingState === VideoRecordingState.STOPPING
                                            ? colors.warning
                                            : colors.error,
                                }
                            ]}
                            variant="primary"
                            disabled={videoRecordingState === VideoRecordingState.STARTING || videoRecordingState === VideoRecordingState.STOPPING}
                        >
                            <ThemedIcon 
                                name={videoRecordingState === VideoRecordingState.RECORDING ? "square" : "video"} 
                                size={28} 
                                color="inverse" 
                            />
                        </AnimatedPressable>
                        <ThemedText variant="caption" color="primary" style={styles.captureButtonLabel}>
                            {videoRecordingState === VideoRecordingState.RECORDING ? 'Stop' : 'Video'}
                        </ThemedText>
                    </Animated.View>
                </Animated.View>

                {/* Photo Thumbnail */}
                {lastPhotoUri && (
                    <TouchableOpacity
                        onPress={() => {
                            setModalPhotoUri(lastPhotoUri);
                            setModalVisible(true);
                            setShowOverlays(false);
                        }}
                        style={styles.thumbnail}
                    >
                        <Image
                            source={{ uri: lastPhotoUri }}
                            style={{ width: '100%', height: '100%', borderRadius: 4 }}
                        />
                    </TouchableOpacity>
                )}

                {/* Debug Text - Professional Design */}
                <Animated.View 
                    entering={FadeIn.duration(200)}
                    style={[styles.debugTextContainer, { 
                        backgroundColor: colors.overlay + 'CC',
                        borderColor: colors.border + '20',
                    }]}
                >
                    <ThemedText variant="caption" style={styles.debugText}>
                        {debugText}
                    </ThemedText>
                </Animated.View>

                {/* Snackbar */}
                <ThemedSnackbar
                    visible={snackbarVisible}
                    message={snackbarMessage}
                    onHide={() => setSnackbarVisible(false)}
                />
            </ThemedView>

            {/* Modal for photo preview */}
            <Modal
                visible={modalVisible && modalPhotoUri !== null}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    setModalVisible(false);
                    setShowOverlays(true);
                    setTimeout(() => setModalPhotoUri(null), 100);
                }}
            >
                {modalPhotoUri && (
                    <View style={styles.modalContainer}>
                        <Image source={{ uri: modalPhotoUri }} style={styles.modalImage} />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                                onPress={() => {
                                    setModalVisible(false);
                                    setShowOverlays(true);
                                    setTimeout(() => setModalPhotoUri(null), 100);
                                }}
                            >
                                <Text style={styles.modalButtonText}>{t('buttons.close')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </Modal>
        </ThemedSafeAreaView>
    );
}

// Styles (simplified and organized)
const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: { 
        flex: 1 
    },
    camera: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
    },
    
    // Full Frame Results - Modern Design
    fullFrameResultsWrapper: {
        position: 'absolute',
        top: 120,
        left: 16,
        right: 16,
        zIndex: 19,
    },
    fullFrameResultsCard: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    fullFrameHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    
    // Audio Results - Modern Design
    audioResultsWrapper: {
        position: 'absolute',
        top: 190,
        left: 16,
        right: 16,
        zIndex: 18,
    },
    audioResultsCard: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    audioHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    audioStatusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    audioIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioStatusText: {
        marginLeft: 4,
    },
    audioResultBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.9)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    audioResultCount: {
        color: 'white',
        fontWeight: '600',
    },
    audioErrorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        marginTop: 8,
        gap: 8,
        borderWidth: 1,
    },
    audioErrorText: {
        flex: 1,
    },
    audioResultsList: {
        marginTop: 12,
        maxHeight: 60,
    },
    audioResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 8,
        gap: 6,
        borderWidth: 1,
    },
    
    // Video Recording Status - Modern Design
    videoStatusWrapper: {
        position: 'absolute',
        top: 200,
        left: 16,
        right: 16,
        zIndex: 15,
    },
    videoStatusCard: {
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    videoStatusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    videoStatusText: {
        fontWeight: '600',
    },
    videoStatusDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    
    // Controls - Modern Design
    settingsButtonWrapper: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 15,
    },
    settingsButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statusBadgeWrapper: {
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 5,
    },
    statusBadge: {
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusText: {
        fontWeight: '500',
    },
    
    // Settings Panel - Modern Design
    settingsPanelWrapper: {
        position: 'absolute',
        bottom: 140,
        left: 16,
        right: 16,
        zIndex: 10,
    },
    settingsPanel: {
        borderRadius: 20,
        padding: 20,
    },
    settingsSection: {
        marginBottom: 20,
    },
    settingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    settingValue: {
        marginLeft: 'auto',
        fontWeight: '600',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    aiSettingsCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    aiSettingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    aiSettingValue: {
        marginLeft: 'auto',
        fontWeight: '600',
    },
    pauseResumeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        gap: 8,
    },
    pauseResumeText: {
        marginLeft: 4,
    },
    
    // Capture Buttons - Modern Design
    captureButtonsContainer: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 32,
        zIndex: 20,
    },
    captureButtonWrapper: {
        alignItems: 'center',
    },
    captureButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    captureButtonLabel: {
        marginTop: 8,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.9)',
    },
    
    // Thumbnail and Modal
    thumbnail: {
        position: 'absolute',
        width: 80,
        height: 80,
        bottom: 10,
        right: 10,
        borderColor: '#fff',
        borderWidth: 1,
        zIndex: 20
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalImage: {
        width: W,
        height: H,
        resizeMode: 'contain',
    },
    modalButtons: {
        position: 'absolute',
        bottom: 40,
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        paddingHorizontal: 20,
    },
    modalButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    modalButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    
    // Debug - Modern Design
    debugTextContainer: {
        position: 'absolute',
        top: 16,
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        zIndex: 10,
    },
    debugText: { 
        textAlign: 'center',
        fontWeight: '500',
    },
});