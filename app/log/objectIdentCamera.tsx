import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { useObjectDetection } from '@infinitered/react-native-mlkit-object-detection';
import { useImageLabeling } from '@infinitered/react-native-mlkit-image-labeling';
import { Audio } from 'expo-av';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { CriticalErrorBoundary } from '@/components/ComponentErrorBoundary';
import { SafeCameraViewManager } from '@/components/SafeViewManager';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ThemedSnackbar } from '@/components/ThemedSnackbar';
import { theme } from '@/constants/theme';
import { COMPONENT_Z_INDEX } from '@/constants/layers';
import { BirdNetService } from '@/services/birdNetService';
import type { MyModelsConfig } from './../_layout';

import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

interface Detection {
    frame: { origin: { x: number; y: number }; size: { x: number; y: number } };
    labels: Array<{ text: string; confidence: number; index: number }>;
}

function SimpleObjectDetectCamera() {
    const { t } = useTranslation();
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];
    const isFocused = useIsFocused();

    // Camera setup
    const device = useCameraDevice('back');
    const format = useCameraFormat(device, [
        { photoResolution: { width: 1920, height: 1080 } },
        { fps: 30 }
    ]);
    const { hasPermission, requestPermission } = useCameraPermission();
    const cameraRef = useRef<Camera>(null);
    
    // Camera state
    const [isActive, setIsActive] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    
    // Detection state
    const [detections, setDetections] = useState<Detection[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Audio recording state
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [audioPermission, setAudioPermission] = useState(false);
    const [lastAudioClassification, setLastAudioClassification] = useState<string>('');
    
    // UI state
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [debugText, setDebugText] = useState(t('camera.initializing'));

    // ML Kit hooks
    const detector = useObjectDetection<MyModelsConfig>('efficientNetlite0int8');
    const classifier = useImageLabeling('birdClassifier');

    // Initialization state tracking
    const [initState, setInitState] = useState({
        camera: false,
        audio: false,
        detector: false,
        classifier: false,
        birdnet: false,
    });

    // Initialize permissions and services
    useEffect(() => {
        console.log('[ObjectDetection] Starting initialization...');
        setDebugText('Requesting permissions...');
        
        const initializeServices = async () => {
            try {
                // Camera permission
                if (!hasPermission) {
                    console.log('[ObjectDetection] Requesting camera permission...');
                    const granted = await requestPermission();
                    console.log('[ObjectDetection] Camera permission:', granted);
                    setInitState(prev => ({ ...prev, camera: granted }));
                } else {
                    setInitState(prev => ({ ...prev, camera: true }));
                }
                
                // Audio permission
                console.log('[ObjectDetection] Requesting audio permission...');
                setDebugText('Requesting audio permission...');
                const audioStatus = await Audio.requestPermissionsAsync();
                console.log('[ObjectDetection] Audio permission:', audioStatus.granted);
                setAudioPermission(audioStatus.granted);
                setInitState(prev => ({ ...prev, audio: audioStatus.granted }));
                
                // Initialize BirdNet service (non-blocking)
                setDebugText('Loading BirdNet models...');
                try {
                    await BirdNetService.initializeOfflineMode();
                    console.log('[ObjectDetection] BirdNet service initialized');
                    setInitState(prev => ({ ...prev, birdnet: true }));
                } catch (error) {
                    console.warn('[ObjectDetection] Failed to initialize BirdNet:', error);
                    setInitState(prev => ({ ...prev, birdnet: false }));
                }
                
                console.log('[ObjectDetection] Initialization complete');
            } catch (error) {
                console.error('[ObjectDetection] Initialization failed:', error);
                setDebugText(`Init failed: ${error}`);
            }
        };
        
        initializeServices();
    }, [hasPermission, requestPermission]);

    // Track ML Kit initialization
    useEffect(() => {
        if (detector) {
            console.log('[ObjectDetection] Detector available:', !!detector.detectObjects);
            setInitState(prev => ({ ...prev, detector: !!detector.detectObjects }));
        }
    }, [detector]);

    useEffect(() => {
        if (classifier) {
            console.log('[ObjectDetection] Classifier available:', !!classifier.classifyImage);
            setInitState(prev => ({ ...prev, classifier: !!classifier.classifyImage }));
        }
    }, [classifier]);

    // Camera lifecycle management
    const handleCameraReady = useCallback(() => {
        console.log('[ObjectDetection] Camera ready callback triggered');
        setCameraReady(true);
        setIsActive(true);
        setDebugText('Camera ready - Starting detection...');
    }, []);

    const handleCameraUnmount = useCallback(() => {
        console.log('[ObjectDetection] Camera unmount callback triggered');
        setCameraReady(false);
        setIsActive(false);
        setDetections([]);
        setDebugText('Camera stopped');
    }, []);

    // Update debug text based on initialization state
    useEffect(() => {
        const { camera, detector, classifier } = initState;
        
        if (!camera) {
            setDebugText('Waiting for camera permission...');
        } else if (!detector) {
            setDebugText('Loading object detector...');
        } else if (!classifier) {
            setDebugText('Loading image classifier...');
        } else if (!cameraReady) {
            setDebugText('Camera initializing...');
        } else {
            setDebugText('Ready for detection');
        }
        
        console.log('[ObjectDetection] Init state:', initState, 'Camera ready:', cameraReady);
    }, [initState, cameraReady]);

    // Fallback: Force camera ready after timeout if stuck
    useEffect(() => {
        if (hasPermission && device && initState.camera && !cameraReady) {
            const timeout = setTimeout(() => {
                console.log('[ObjectDetection] Forcing camera ready after timeout');
                setDebugText('Camera forced ready');
                handleCameraReady();
            }, 5000); // 5 second timeout
            
            return () => clearTimeout(timeout);
        }
    }, [hasPermission, device, initState.camera, cameraReady, handleCameraReady]);

    // Audio recording management
    const startAudioRecording = useCallback(async () => {
        if (!audioPermission) return;
        
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(newRecording);
        } catch (error) {
            console.error('Failed to start audio recording:', error);
        }
    }, [audioPermission]);

    const stopAudioRecording = useCallback(async () => {
        if (!recording) return null;
        
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);
            return uri;
        } catch (error) {
            console.error('Failed to stop audio recording:', error);
            return null;
        }
    }, [recording]);

    // Audio classification
    const classifyAudio = useCallback(async (audioUri: string) => {
        try {
            setDebugText(t('camera.analyzing_audio'));
            const result = await BirdNetService.identifyBirdFromAudio(audioUri);
            
            if (result.success && result.predictions.length > 0) {
                const bestPrediction = BirdNetService.getBestPrediction(result.predictions);
                if (bestPrediction) {
                    const confidence = BirdNetService.formatConfidenceScore(bestPrediction.confidence);
                    const message = `🎵 ${bestPrediction.common_name} (${confidence})`;
                    setLastAudioClassification(message);
                    setSnackbarMessage(message);
                    setSnackbarVisible(true);
                    
                    setTimeout(() => setSnackbarVisible(false), 3000);
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            }
        } catch (error) {
            console.error('Audio classification failed:', error);
            setSnackbarMessage(t('errors.audio_classification_failed'));
            setSnackbarVisible(true);
            setTimeout(() => setSnackbarVisible(false), 2000);
        }
    }, [t]);

    // 5-second audio recording cycle
    useEffect(() => {
        if (!isActive || !cameraReady || !audioPermission) return;

        const audioInterval = setInterval(async () => {
            // Start recording
            await startAudioRecording();
            
            // Stop after 5 seconds and classify
            setTimeout(async () => {
                const audioUri = await stopAudioRecording();
                if (audioUri) {
                    await classifyAudio(audioUri);
                    
                    // Clean up audio file
                    try {
                        await FileSystem.deleteAsync(audioUri);
                    } catch (error) {
                        console.warn('Failed to delete audio file:', error);
                    }
                }
            }, 5000);
        }, 5000);

        return () => {
            clearInterval(audioInterval);
        };
    }, [isActive, cameraReady, audioPermission, startAudioRecording, stopAudioRecording, classifyAudio]);

    // Object detection pipeline
    const detectObjects = useCallback(async () => {
        if (!cameraRef.current || !detector || isProcessing) return;

        try {
            setIsProcessing(true);
            setDebugText(t('camera.capturing'));

            const photo = await cameraRef.current.takePhoto({
                flash: 'off',
                enableShutterSound: false,
            });

            if (!photo?.path) return;

            setDebugText(t('camera.detection_running'));
            
            // Object detection
            const objects = await detector.detectObjects(photo.path);
            
            // Process each detected object
            const enrichedDetections: Detection[] = [];
            
            for (const obj of objects) {
                const labels = [];
                
                // Classify the detected object region
                if (classifier?.classifyImage) {
                    try {
                        const result = await classifier.classifyImage(photo.path);
                        const classificationResults = Array.isArray(result) ? result : 
                                                    typeof result === 'string' ? JSON.parse(result) : [];
                        
                        if (classificationResults.length > 0) {
                            labels.push({
                                text: classificationResults[0].text || 'Unknown',
                                confidence: classificationResults[0].confidence || 0,
                                index: classificationResults[0].index || 0,
                            });
                        }
                    } catch (error) {
                        console.warn('Classification failed for object:', error);
                    }
                }
                
                enrichedDetections.push({
                    frame: obj.frame,
                    labels,
                });
            }

            setDetections(enrichedDetections);
            setDebugText(
                enrichedDetections.length > 0
                    ? t('camera.detection_successful', { count: enrichedDetections.length })
                    : t('camera.detection_none')
            );

        } catch (error) {
            console.error('Object detection failed:', error);
            setDebugText(t('errors.detection_failed', { message: String(error) }));
        } finally {
            setIsProcessing(false);
        }
    }, [detector, classifier, isProcessing, t]);

    // Auto-detect every 2 seconds
    useEffect(() => {
        if (!isActive || !cameraReady) return;

        const detectionInterval = setInterval(detectObjects, 2000);
        return () => clearInterval(detectionInterval);
    }, [isActive, cameraReady, detectObjects]);

    // Show snackbar helper
    const showSnackbar = useCallback((message: string) => {
        setSnackbarMessage(message);
        setSnackbarVisible(true);
        setTimeout(() => setSnackbarVisible(false), 2500);
    }, []);

    // Render fallbacks
    if (Platform.OS === 'web') {
        return (
            <View style={styles.centered}>
                <Text style={{ color: currentTheme.colors.text.primary }}>
                    {t('camera.unsupported_platform')}
                </Text>
            </View>
        );
    }

    if (!hasPermission) {
        return (
            <View style={styles.centered}>
                <Text style={{ color: currentTheme.colors.text.primary }}>
                    {t('camera.permission_required')}
                </Text>
                <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={requestPermission}
                >
                    <Text style={styles.permissionButtonText}>
                        {t('buttons.grant_permission')}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!device) {
        return (
            <View style={styles.centered}>
                <Text style={{ color: currentTheme.colors.text.primary }}>
                    {t('camera.error.camera_not_available')}
                </Text>
            </View>
        );
    }

    return (
        <ThemedSafeAreaView style={styles.container}>
            <SafeCameraViewManager
                style={StyleSheet.absoluteFillObject}
                isActive={hasPermission && !!device && isFocused}
                onCameraReady={handleCameraReady}
                onCameraUnmount={handleCameraUnmount}
            >
                <Camera
                    ref={cameraRef}
                    style={styles.camera}
                    device={device}
                    format={format}
                    isActive={hasPermission && !!device && isFocused}
                    photo={true}
                    enableZoomGesture={true}
                    onInitialized={() => {
                        console.log('[ObjectDetection] Camera onInitialized called');
                        handleCameraReady();
                    }}
                    onError={(error) => {
                        console.error('[ObjectDetection] Camera error:', error);
                        setDebugText(`Camera error: ${error.message}`);
                    }}
                />
            </SafeCameraViewManager>

            {/* Detection overlays */}
            <View style={styles.overlay} pointerEvents="none">
                <Svg style={{ width: '100%', height: '100%' }}>
                    {detections.map((detection, index) => {
                        const { origin, size } = detection.frame;
                        const label = detection.labels[0];
                        const confidence = label?.confidence || 0;
                        const color = confidence > 0.7 ? '#10B981' : confidence > 0.4 ? '#F59E0B' : '#EF4444';

                        return (
                            <React.Fragment key={`detection-${index}`}>
                                <Rect
                                    x={origin.x}
                                    y={origin.y}
                                    width={size.x}
                                    height={size.y}
                                    stroke={color}
                                    strokeWidth={2}
                                    fill="none"
                                />
                                {label && (
                                    <>
                                        <Rect
                                            x={origin.x}
                                            y={Math.max(origin.y - 20, 0)}
                                            width={label.text.length * 8 + 16}
                                            height={20}
                                            fill="rgba(0, 0, 0, 0.8)"
                                            rx={4}
                                        />
                                        <SvgText
                                            x={origin.x + 8}
                                            y={Math.max(origin.y - 6, 14)}
                                            fill="white"
                                            fontSize="12"
                                            fontWeight="bold"
                                        >
                                            {`${label.text} ${Math.round(confidence * 100)}%`}
                                        </SvgText>
                                    </>
                                )}
                            </React.Fragment>
                        );
                    })}
                </Svg>
            </View>

            {/* Status displays */}
            <View style={styles.statusContainer}>
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(0, 0, 0, 0.8)' }]}>
                    <View style={[
                        styles.statusDot,
                        { backgroundColor: isActive ? '#10B981' : '#EF4444' }
                    ]} />
                    <Text style={styles.statusText}>
                        {isActive ? 'Active' : 'Inactive'}
                    </Text>
                </View>

                {/* Initialization status */}
                <View style={[styles.initStatus, { backgroundColor: 'rgba(0, 0, 0, 0.8)' }]}>
                    <Text style={styles.statusText}>
                        📷 {initState.camera ? '✅' : '⏳'} 
                        🔍 {initState.detector ? '✅' : '⏳'} 
                        🏷️ {initState.classifier ? '✅' : '⏳'}
                    </Text>
                </View>

                {audioPermission && (
                    <View style={[styles.audioStatus, { backgroundColor: 'rgba(0, 0, 0, 0.8)' }]}>
                        <ThemedIcon 
                            name={recording ? "mic" : "mic-off"} 
                            size={16} 
                            color="secondary" 
                        />
                        <Text style={styles.statusText}>
                            Audio: {recording ? 'Recording' : 'Ready'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Debug text */}
            <View style={styles.debugContainer}>
                <Text style={styles.debugText}>{debugText}</Text>
            </View>

            {/* Audio classification result */}
            {lastAudioClassification && (
                <View style={styles.audioResultContainer}>
                    <Text style={styles.audioResultText}>{lastAudioClassification}</Text>
                </View>
            )}

            {/* Simple controls */}
            <View style={styles.controls}>
                <TouchableOpacity
                    style={styles.controlButton}
                    onPress={detectObjects}
                    disabled={isProcessing}
                >
                    <ThemedIcon 
                        name="camera" 
                        size={24} 
                        color="secondary" 
                    />
                </TouchableOpacity>
            </View>

            <ThemedSnackbar
                visible={snackbarVisible}
                message={snackbarMessage}
                onHide={() => setSnackbarVisible(false)}
            />
        </ThemedSafeAreaView>
    );
}

export default function ObjectIdentCamera() {
    return (
        <CriticalErrorBoundary
            componentName="Simple Object Detection Camera"
            onError={(error, errorId) => {
                console.error('Object detection camera error:', error, errorId);
            }}
        >
            <SimpleObjectDetectCamera />
        </CriticalErrorBoundary>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    camera: {
        ...StyleSheet.absoluteFillObject,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: COMPONENT_Z_INDEX.DETECTION_OVERLAY,
    },
    statusContainer: {
        position: 'absolute',
        top: 10,
        left: 10,
        gap: 8,
        zIndex: COMPONENT_Z_INDEX.CAMERA_UI,
    },
    statusBadge: {
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '500',
    },
    initStatus: {
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    audioStatus: {
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    debugContainer: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        zIndex: COMPONENT_Z_INDEX.CAMERA_UI,
    },
    debugText: {
        color: 'white',
        fontSize: 14,
        textAlign: 'center',
    },
    audioResultContainer: {
        position: 'absolute',
        bottom: 80,
        alignSelf: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        zIndex: COMPONENT_Z_INDEX.CAMERA_UI,
    },
    audioResultText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    controls: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        zIndex: COMPONENT_Z_INDEX.CAMERA_CONTROLS,
    },
    controlButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    permissionButton: {
        backgroundColor: 'white',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 20,
    },
    permissionButtonText: {
        color: '#DC2626',
        fontWeight: '600',
        fontSize: 14,
    },
});