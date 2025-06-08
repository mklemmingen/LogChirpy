/**
 * ObjectIdentCameraAndroid2025.tsx - Enhanced camera with Android 2025 patterns
 * 
 * Implements Zustand state management, AndroidViewManager optimizations,
 * Vision Camera V4 with YUV_420_888, and TensorFlow Lite GPU acceleration
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    InteractionManager,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useObjectDetection } from '@infinitered/react-native-mlkit-object-detection';
import { useImageLabeling } from '@infinitered/react-native-mlkit-image-labeling';
import { Audio } from 'expo-av';
import { useIsFocused } from '@react-navigation/native';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

// Android 2025 imports
import { useAndroidViewManager } from '../../utils/AndroidViewManager';
import { useCameraService } from '../../services/CameraService';
import { useMLModelManager } from '../../services/MLModelManager';
import { useDetectionStore, selectCameraState, selectMLModelState, selectAppSettings } from '../store/detectionStore';

// Existing imports
import { CriticalErrorBoundary } from '@/components/ComponentErrorBoundary';
import NavigationErrorBoundary from '@/components/NavigationErrorBoundary';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ThemedSnackbar } from '@/components/ThemedSnackbar';
import { theme } from '@/constants/theme';
import { COMPONENT_Z_INDEX } from '@/constants/layers';
import { BirdNetService } from '@/services/birdNetService';

interface Detection {
    frame: { origin: { x: number; y: number }; size: { x: number; y: number } };
    labels: Array<{ text: string; confidence: number; index: number }>;
}

function Android2025ObjectDetectCamera() {
    const { t } = useTranslation();
    const isFocused = useIsFocused();
    const [appState, setAppState] = useState(AppState.currentState);
    
    // Android 2025 optimizations
    const { getSafeContainer, cameraSafeProps } = useAndroidViewManager();
    const { cameraService, isInitialized, handleCameraActive, getOptimizedProps, getOptimizedFormat, createFrameProcessor } = useCameraService();
    const { modelManager, processFrame } = useMLModelManager();
    
    // Zustand state management
    const cameraState = useDetectionStore(selectCameraState);
    const mlModelState = useDetectionStore(selectMLModelState);
    const settings = useDetectionStore(selectAppSettings);
    const { 
        addDetection, 
        setCameraActive, 
        setCameraReady,
        updatePerformanceMetrics 
    } = useDetectionStore();

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            setAppState(nextAppState);
        });
        return () => subscription?.remove();
    }, []);
    
    // Enhanced camera rendering state with Android ViewGroup safety
    const [shouldRenderCamera, setShouldRenderCamera] = useState(false);
    const cameraCleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const cleanupInProgressRef = useRef(false);
    
    // Android 2025 camera activation with comprehensive safety
    const isActiveCameraState = 
        isFocused && 
        appState === "active" && 
        shouldRenderCamera && 
        !cleanupInProgressRef.current &&
        isInitialized;
    
    // Camera setup with Android optimizations
    const device = useCameraDevice('back');
    const format = getOptimizedFormat(device);
    const { hasPermission, requestPermission } = useCameraPermission();
    const cameraRef = useRef<Camera>(null);
    
    // Local state for UI
    const [detections, setDetections] = useState<Detection[]>([]);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [debugText, setDebugText] = useState(t('camera.initializing'));

    // ML Kit hooks (maintaining compatibility)
    const detector = useObjectDetection<any>('efficientNetlite0int8');
    const classifier = useImageLabeling('birdClassifier');

    // Refs for cleanup coordination
    const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Android ViewGroup-safe camera mounting
    useEffect(() => {
        if (isFocused && appState === 'active' && isInitialized) {
            cleanupInProgressRef.current = false;
            
            // Clear any pending cleanup
            if (cameraCleanupTimeoutRef.current) {
                clearTimeout(cameraCleanupTimeoutRef.current);
                cameraCleanupTimeoutRef.current = null;
            }
            
            // Use InteractionManager for ViewGroup-safe mounting
            InteractionManager.runAfterInteractions(() => {
                const renderTimer = setTimeout(() => {
                    if (!cleanupInProgressRef.current && isFocused && appState === 'active' && isInitialized) {
                        setShouldRenderCamera(true);
                        handleCameraActive(true);
                    }
                }, 300); // Increased delay for Android ViewGroup stability
                
                return () => clearTimeout(renderTimer);
            });
        } else {
            cleanupInProgressRef.current = true;
            setShouldRenderCamera(false);
            setCameraReady(false);
            handleCameraActive(false);
            
            // Android-safe cleanup with proper delays
            cameraCleanupTimeoutRef.current = setTimeout(() => {
                console.log('[Android2025Camera] Cleanup timeout completed');
            }, 300);
        }
    }, [isFocused, appState, isInitialized, handleCameraActive]);

    // Enhanced frame processor with Android optimizations
    const frameProcessor = createFrameProcessor(
        useCallback((result) => {
            // Update performance metrics
            updatePerformanceMetrics({
                processingFPS: 1000 / result.processingTime,
                averageInferenceTime: result.processingTime,
            });

            // Process detections for UI
            if (result.detections.length > 0) {
                const uiDetections: Detection[] = result.detections.map((detection, index) => ({
                    frame: {
                        origin: { x: detection.x || 0, y: detection.y || 0 },
                        size: { x: detection.width || 100, y: detection.height || 100 }
                    },
                    labels: [{
                        text: detection.label || 'Unknown',
                        confidence: detection.confidence || 0,
                        index
                    }]
                }));

                setDetections(uiDetections);

                // Add to store
                if (result.detections[0]?.confidence > 0.5) {
                    addDetection({
                        type: 'object',
                        birdName: result.detections[0].label,
                        confidence: result.detections[0].confidence,
                        metadata: {
                            processingTime: result.processingTime,
                            accelerator: 'gpu', // From Android optimizations
                        }
                    });
                }
            }
        }, [updatePerformanceMetrics, addDetection]),
        useCallback(async (frame) => {
            return await processFrame(frame, 'efficientnet');
        }, [processFrame])
    );

    // Enhanced camera ready handler with Zustand integration
    const handleCameraReady = useCallback(() => {
        if (!isFocused || cleanupInProgressRef.current) {
            console.log('[Android2025Camera] Camera ready but tab not focused, deferring activation');
            return;
        }
        
        console.log('[Android2025Camera] Camera ready callback triggered');
        setCameraReady(true);
        setDebugText('Camera ready - Starting detection...');
    }, [isFocused, setCameraReady]);

    // Comprehensive cleanup with Android ViewGroup safety
    const handleCameraUnmount = useCallback(() => {
        console.log('[Android2025Camera] Camera unmount callback triggered');
        cleanupInProgressRef.current = true;
        
        // Clear all intervals immediately
        if (audioIntervalRef.current) {
            clearInterval(audioIntervalRef.current);
            audioIntervalRef.current = null;
        }
        
        if (detectionIntervalRef.current) {
            clearInterval(detectionIntervalRef.current);
            detectionIntervalRef.current = null;
        }
        
        // Stop audio recording
        if (recording) {
            recording.stopAndUnloadAsync().catch(error => {
                console.warn('Failed to stop audio during camera unmount:', error);
            });
            setRecording(null);
        }
        
        // Reset states
        setDetections([]);
        setDebugText('Camera stopped');
        setCameraReady(false);
        handleCameraActive(false);
        
        // Android ViewGroup-safe cleanup delay
        setTimeout(() => {
            cleanupInProgressRef.current = false;
        }, 300);
    }, [recording, setCameraReady, handleCameraActive]);

    // Audio processing with Android optimizations
    const startAudioRecording = useCallback(async () => {
        if (!settings.audioRecordingEnabled || !isFocused || cleanupInProgressRef.current) {
            return;
        }
        
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            if (!isFocused || cleanupInProgressRef.current) return;

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            
            if (isFocused && !cleanupInProgressRef.current) {
                setRecording(newRecording);
            } else {
                newRecording.stopAndUnloadAsync().catch(console.warn);
            }
        } catch (error) {
            console.error('Failed to start audio recording:', error);
        }
    }, [settings.audioRecordingEnabled, isFocused]);

    const stopAudioRecording = useCallback(async () => {
        if (!recording || !isFocused || cleanupInProgressRef.current) {
            return null;
        }
        
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            
            if (isFocused && !cleanupInProgressRef.current) {
                setRecording(null);
            }
            
            return uri;
        } catch (error) {
            console.error('Failed to stop audio recording:', error);
            if (isFocused && !cleanupInProgressRef.current) {
                setRecording(null);
            }
            return null;
        }
    }, [recording, isFocused]);

    // Audio classification with BirdNet integration
    const classifyAudio = useCallback(async (audioUri: string) => {
        try {
            if (!isFocused || cleanupInProgressRef.current) return;
            
            setDebugText(t('camera.analyzing_audio'));
            
            const result = await BirdNetService.identifyBirdFromAudio(audioUri);
            
            if (!isFocused || cleanupInProgressRef.current) return;
            
            if (result.success && result.predictions.length > 0) {
                const bestPrediction = BirdNetService.getBestPrediction(result.predictions);
                if (bestPrediction && isFocused && !cleanupInProgressRef.current) {
                    const confidence = BirdNetService.formatConfidenceScore(bestPrediction.confidence);
                    const message = `🎵 ${bestPrediction.common_name} (${confidence})`;
                    
                    // Add to store
                    addDetection({
                        type: 'audio',
                        birdName: bestPrediction.common_name,
                        confidence: bestPrediction.confidence,
                        audioUri,
                    });
                    
                    setSnackbarMessage(message);
                    setSnackbarVisible(true);
                    
                    setTimeout(() => {
                        if (isFocused && !cleanupInProgressRef.current) {
                            setSnackbarVisible(false);
                        }
                    }, 3000);
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            }
        } catch (error) {
            console.error('Audio classification failed:', error);
            if (isFocused && !cleanupInProgressRef.current) {
                setSnackbarMessage(t('errors.audio_classification_failed'));
                setSnackbarVisible(true);
                setTimeout(() => {
                    if (isFocused && !cleanupInProgressRef.current) {
                        setSnackbarVisible(false);
                    }
                }, 2000);
            }
        }
    }, [isFocused, t, addDetection]);

    // Audio recording cycle with Android memory optimization
    useEffect(() => {
        if (!isFocused || !cameraState.isActive || !cameraState.isReady || !settings.audioRecordingEnabled || cleanupInProgressRef.current) {
            return;
        }

        console.log('[Android2025Camera] Starting audio recording cycle');
        
        const activeTimeouts = new Set<NodeJS.Timeout>();
        
        const audioInterval = setInterval(async () => {
            if (!isFocused || cleanupInProgressRef.current) return;
            
            await startAudioRecording();
            
            const audioTimeout = setTimeout(async () => {
                if (!isFocused || cleanupInProgressRef.current) {
                    if (recording) {
                        try {
                            await recording.stopAndUnloadAsync();
                            setRecording(null);
                        } catch (error) {
                            console.warn('Failed to stop recording during cleanup:', error);
                        }
                    }
                    return;
                }
                
                const audioUri = await stopAudioRecording();
                if (audioUri && isFocused && !cleanupInProgressRef.current) {
                    await classifyAudio(audioUri);
                    
                    // Cleanup audio file
                    try {
                        await FileSystem.deleteAsync(audioUri);
                    } catch (error) {
                        console.warn('Failed to delete audio file:', error);
                    }
                }
                
                activeTimeouts.delete(audioTimeout);
            }, 5000);
            
            activeTimeouts.add(audioTimeout);
        }, 5000);
        
        audioIntervalRef.current = audioInterval;

        return () => {
            console.log('[Android2025Camera] Cleaning up audio recording cycle');
            
            if (audioIntervalRef.current) {
                clearInterval(audioIntervalRef.current);
                audioIntervalRef.current = null;
            }
            
            activeTimeouts.forEach(timeout => clearTimeout(timeout));
            activeTimeouts.clear();
            
            if (recording) {
                recording.stopAndUnloadAsync().catch(console.warn);
                setRecording(null);
            }
        };
    }, [isFocused, cameraState.isActive, cameraState.isReady, settings.audioRecordingEnabled, recording, startAudioRecording, stopAudioRecording, classifyAudio]);

    // Manual detection trigger
    const detectObjects = useCallback(async () => {
        if (!cameraRef.current || !detector || mlModelState.isProcessing || !isFocused || cleanupInProgressRef.current) {
            return;
        }

        try {
            if (!isFocused || cleanupInProgressRef.current) return;
            
            setDebugText(t('camera.capturing'));

            const photo = await cameraRef.current.takePhoto({
                flash: 'off',
                enableShutterSound: false,
            });

            if (!photo?.path || !isFocused || cleanupInProgressRef.current) return;

            setDebugText(t('camera.detection_running'));
            
            // Use ML Model Manager for processing
            const result = await processFrame({ path: photo.path }, 'efficientnet');
            
            if (!isFocused || cleanupInProgressRef.current) return;

            if (result.predictions.length > 0) {
                const detectionCount = result.predictions.length;
                setDebugText(
                    t('camera.detection_successful', { count: detectionCount })
                );
            } else {
                setDebugText(t('camera.detection_none'));
            }

        } catch (error) {
            console.error('Object detection failed:', error);
            if (isFocused && !cleanupInProgressRef.current) {
                setDebugText(t('errors.detection_failed', { message: String(error) }));
            }
        }
    }, [detector, mlModelState.isProcessing, isFocused, t, processFrame]);

    // Comprehensive cleanup when focus is lost
    useEffect(() => {
        if (!isFocused) {
            console.log('[Android2025Camera] Tab unfocused, starting comprehensive cleanup');
            cleanupInProgressRef.current = true;
            
            // Clear all intervals
            if (audioIntervalRef.current) {
                clearInterval(audioIntervalRef.current);
                audioIntervalRef.current = null;
            }
            
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
            
            // Stop audio recording
            if (recording) {
                recording.stopAndUnloadAsync().catch(console.warn).finally(() => {
                    setRecording(null);
                });
            }
            
            // Reset states
            setCameraActive(false);
            setCameraReady(false);
            setDetections([]);
            setSnackbarVisible(false);
            
            // Android ViewGroup-safe cleanup delay
            setTimeout(() => {
                cleanupInProgressRef.current = false;
            }, 400);
        }
    }, [isFocused, recording, setCameraActive, setCameraReady]);

    // Early returns for non-ready states
    if (!isFocused) {
        return (
            <ThemedSafeAreaView style={getSafeContainer()}>
                <View style={styles.centered}>
                    <Text style={styles.statusText}>
                        Camera paused - tab not focused
                    </Text>
                </View>
            </ThemedSafeAreaView>
        );
    }

    if (!isInitialized || !shouldRenderCamera) {
        return (
            <ThemedSafeAreaView style={getSafeContainer()}>
                <View style={styles.centered}>
                    <Text style={styles.statusText}>
                        Initializing Android 2025 camera system...
                    </Text>
                    <Text style={styles.debugText}>
                        Camera: {isInitialized ? '✅' : '⏳'} 
                        ML Models: {mlModelState.isLoaded ? '✅' : '⏳'}
                    </Text>
                </View>
            </ThemedSafeAreaView>
        );
    }

    if (!hasPermission) {
        return (
            <View style={styles.centered}>
                <Text style={styles.statusText}>
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
                <Text style={styles.statusText}>
                    {t('camera.error.camera_not_available')}
                </Text>
            </View>
        );
    }

    // Android 2025 optimized camera properties
    const cameraProps = {
        ...getOptimizedProps(device),
        ...cameraSafeProps,
    };

    return (
        <ThemedSafeAreaView style={getSafeContainer({ isCameraView: true })}>
            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
                device={device}
                format={format}
                isActive={isActiveCameraState}
                photo={true}
                frameProcessor={settings.enableGPUAcceleration ? frameProcessor : undefined}
                onInitialized={handleCameraReady}
                onError={(error) => {
                    console.error('[Android2025Camera] Camera error:', error);
                    setDebugText(`Camera error: ${error.message}`);
                    setShouldRenderCamera(false);
                    setTimeout(() => {
                        if (isFocused && appState === 'active') {
                            setShouldRenderCamera(true);
                        }
                    }, 1000);
                }}
                {...cameraProps}
            />

            {/* Detection overlays with Android optimizations */}
            <View style={[styles.overlay, getSafeContainer()]} pointerEvents="none">
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

            {/* Android 2025 status displays */}
            <View style={styles.statusContainer}>
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(0, 0, 0, 0.8)' }]}>
                    <View style={[
                        styles.statusDot,
                        { backgroundColor: cameraState.isActive ? '#10B981' : '#EF4444' }
                    ]} />
                    <Text style={styles.statusText}>
                        {cameraState.isActive ? 'Active' : 'Inactive'}
                    </Text>
                </View>

                <View style={[styles.initStatus, { backgroundColor: 'rgba(0, 0, 0, 0.8)' }]}>
                    <Text style={styles.statusText}>
                        📷 {cameraState.isReady ? '✅' : '⏳'} 
                        🤖 {mlModelState.isLoaded ? '✅' : '⏳'} 
                        ⚡ {mlModelState.gpuAcceleration ? '🚀' : '🐌'}
                        🧠 {mlModelState.nnapiEnabled ? '🧠' : '💻'}
                    </Text>
                </View>

                {settings.audioRecordingEnabled && (
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

            {/* Android 2025 controls */}
            <View style={styles.controls}>
                <TouchableOpacity
                    style={styles.controlButton}
                    onPress={detectObjects}
                    disabled={mlModelState.isProcessing}
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

export default function ObjectIdentCameraAndroid2025() {
    return (
        <NavigationErrorBoundary>
            <CriticalErrorBoundary
                componentName="Android 2025 Object Detection Camera"
                onError={(error, errorId) => {
                    console.error('Android 2025 camera error:', error, errorId);
                }}
            >
                <Android2025ObjectDetectCamera />
            </CriticalErrorBoundary>
        </NavigationErrorBoundary>
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