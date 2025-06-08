import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
    InteractionManager,
} from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { useObjectDetection } from '@infinitered/react-native-mlkit-object-detection';
import { useImageLabeling } from '@infinitered/react-native-mlkit-image-labeling';
import { Audio } from 'expo-av';
import { useIsFocused } from '@react-navigation/native';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { CriticalErrorBoundary } from '@/components/ComponentErrorBoundary';
import NavigationErrorBoundary from '@/components/NavigationErrorBoundary';
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
    const [appState, setAppState] = useState(AppState.currentState);
    
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            setAppState(nextAppState);
        });
        return () => subscription?.remove();
    }, []);
    
    // Enhanced camera rendering state with cleanup delays
    const [shouldRenderCamera, setShouldRenderCamera] = useState(false);
    const cameraCleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const cleanupInProgressRef = useRef(false);
    
    // CRITICAL: Multi-condition camera activation with InteractionManager
    const isActiveCameraState = isFocused && appState === "active" && shouldRenderCamera && !cleanupInProgressRef.current;
    
    // Navigation-aware camera mounting with InteractionManager
    useEffect(() => {
        if (isFocused && appState === 'active') {
            cleanupInProgressRef.current = false;
            
            // Clear any pending cleanup
            if (cameraCleanupTimeoutRef.current) {
                clearTimeout(cameraCleanupTimeoutRef.current);
                cameraCleanupTimeoutRef.current = null;
            }
            
            // Use InteractionManager for smooth transitions
            InteractionManager.runAfterInteractions(() => {
                const renderTimer = setTimeout(() => {
                    if (!cleanupInProgressRef.current && isFocused && appState === 'active') {
                        setShouldRenderCamera(true);
                    }
                }, 200); // Android stability delay
                
                return () => clearTimeout(renderTimer);
            });
        } else {
            cleanupInProgressRef.current = true;
            setShouldRenderCamera(false);
            setCameraReady(false);
            
            // Schedule cleanup with delay to ensure proper resource release
            cameraCleanupTimeoutRef.current = setTimeout(() => {
                console.log('[Camera] Cleanup timeout completed');
                // Additional cleanup operations if needed
            }, 200);
        }
    }, [isFocused, appState]);
    
    // Comprehensive cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupInProgressRef.current = true;
            setShouldRenderCamera(false);
            setCameraReady(false);
            
            if (cameraCleanupTimeoutRef.current) {
                clearTimeout(cameraCleanupTimeoutRef.current);
            }
        };
    }, []);
    
    // Early return for non-focused states (as per refactor plan)
    if (!isFocused) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Text style={{ color: currentTheme.colors.text.primary }}>
                        Camera paused - tab not focused
                    </Text>
                </View>
            </ThemedSafeAreaView>
        );
    }
    
    if (!shouldRenderCamera) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Text style={{ color: currentTheme.colors.text.primary }}>
                        Initializing camera system...
                    </Text>
                </View>
            </ThemedSafeAreaView>
        );
    }

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

    // Initialization state tracking with focus coordination
    const [initState, setInitState] = useState({
        camera: false,
        audio: false,
        detector: false,
        classifier: false,
        birdnet: false,
        fullyInitialized: false,
    });
    
    // Refs for cleanup coordination
    const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    // Coordinated ML Kit initialization tracking
    useEffect(() => {
        // Only track ML Kit if tab is focused to prevent race conditions
        if (!isFocused) return;
        
        const detectorReady = detector && !!detector.detectObjects;
        const classifierReady = classifier && !!classifier.classifyImage;
        
        if (detectorReady && !initState.detector) {
            console.log('[ObjectDetection] Detector available:', detectorReady);
            setInitState(prev => ({ ...prev, detector: true }));
        }
        
        if (classifierReady && !initState.classifier) {
            console.log('[ObjectDetection] Classifier available:', classifierReady);
            setInitState(prev => ({ ...prev, classifier: true }));
        }
        
        // Update full initialization status
        const fullyInitialized = initState.camera && initState.audio && detectorReady && classifierReady;
        if (fullyInitialized && !initState.fullyInitialized) {
            console.log('[ObjectDetection] All systems fully initialized');
            setInitState(prev => ({ ...prev, fullyInitialized: true }));
        }
    }, [isFocused, detector, classifier, initState]);

    // Enhanced camera lifecycle management with focus coordination
    const handleCameraReady = useCallback(() => {
        // Only activate camera if tab is focused
        if (!isFocused || cleanupInProgressRef.current) {
            console.log('[ObjectDetection] Camera ready but tab not focused, deferring activation');
            return;
        }
        
        console.log('[ObjectDetection] Camera ready callback triggered');
        setCameraReady(true);
        setIsActive(true);
        setDebugText('Camera ready - Starting detection...');
    }, [isFocused]);

    const handleCameraUnmount = useCallback(() => {
        console.log('[ObjectDetection] Camera unmount callback triggered');
        cleanupInProgressRef.current = true;
        
        // Clear all ML model intervals immediately before state cleanup
        if (audioIntervalRef.current) {
            clearInterval(audioIntervalRef.current);
            audioIntervalRef.current = null;
        }
        
        if (detectionIntervalRef.current) {
            clearInterval(detectionIntervalRef.current);
            detectionIntervalRef.current = null;
        }
        
        // Stop any ongoing audio recording immediately
        if (recording) {
            recording.stopAndUnloadAsync().catch(error => {
                console.warn('Failed to stop audio during camera unmount:', error);
            });
            setRecording(null);
        }
        
        // Reset processing states
        setIsProcessing(false);
        setCameraReady(false);
        setIsActive(false);
        setDetections([]);
        setDebugText('Camera stopped');
        
        // Reset cleanup flag after ensuring all cleanup is complete
        setTimeout(() => {
            cleanupInProgressRef.current = false;
        }, 200); // Increased delay to ensure cleanup completion
    }, [recording]);

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

    // Enhanced audio recording management with focus coordination
    const startAudioRecording = useCallback(async () => {
        if (!audioPermission || !isFocused || cleanupInProgressRef.current) {
            return;
        }
        
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Check focus state before creating recording
            if (!isFocused || cleanupInProgressRef.current) {
                return;
            }

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            
            // Only set recording if still focused
            if (isFocused && !cleanupInProgressRef.current) {
                setRecording(newRecording);
            } else {
                // Stop recording if focus was lost during creation
                newRecording.stopAndUnloadAsync().catch(error => {
                    console.warn('Failed to stop recording after focus loss:', error);
                });
            }
        } catch (error) {
            console.error('Failed to start audio recording:', error);
        }
    }, [audioPermission, isFocused]);

    const stopAudioRecording = useCallback(async () => {
        if (!recording || !isFocused || cleanupInProgressRef.current) {
            return null;
        }
        
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            
            // Only clear recording state if still focused
            if (isFocused && !cleanupInProgressRef.current) {
                setRecording(null);
            }
            
            return uri;
        } catch (error) {
            console.error('Failed to stop audio recording:', error);
            // Clear recording state even on error if still focused
            if (isFocused && !cleanupInProgressRef.current) {
                setRecording(null);
            }
            return null;
        }
    }, [recording, isFocused]);

    // Enhanced audio classification with focus coordination
    const classifyAudio = useCallback(async (audioUri: string) => {
        try {
            // Early exit if not focused
            if (!isFocused || cleanupInProgressRef.current) {
                return;
            }
            
            setDebugText(t('camera.analyzing_audio'));
            
            // Check focus before ML operation
            if (!isFocused || cleanupInProgressRef.current) {
                return;
            }
            
            const result = await BirdNetService.identifyBirdFromAudio(audioUri);
            
            // Check focus after ML operation
            if (!isFocused || cleanupInProgressRef.current) {
                return;
            }
            
            if (result.success && result.predictions.length > 0) {
                const bestPrediction = BirdNetService.getBestPrediction(result.predictions);
                if (bestPrediction && isFocused && !cleanupInProgressRef.current) {
                    const confidence = BirdNetService.formatConfidenceScore(bestPrediction.confidence);
                    const message = `🎵 ${bestPrediction.common_name} (${confidence})`;
                    setLastAudioClassification(message);
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
            // Only show error if still focused
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
    }, [isFocused, t]);

    // Enhanced audio recording cycle with comprehensive cleanup coordination
    useEffect(() => {
        // Only start audio if tab is focused and all prerequisites are met
        if (!isFocused || !isActive || !cameraReady || !audioPermission || cleanupInProgressRef.current) {
            return;
        }

        console.log('[ObjectDetection] Starting audio recording cycle');
        
        // Store active timeouts for cleanup
        const activeTimeouts = new Set<NodeJS.Timeout>();
        
        const audioInterval = setInterval(async () => {
            // Check if still focused before processing
            if (!isFocused || cleanupInProgressRef.current) {
                return;
            }
            
            // Start recording with focus check
            await startAudioRecording();
            
            // Stop after 5 seconds and classify
            const audioTimeout = setTimeout(async () => {
                if (!isFocused || cleanupInProgressRef.current) {
                    // If focus is lost, stop recording immediately
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
                    
                    // Clean up audio file
                    try {
                        await FileSystem.deleteAsync(audioUri);
                    } catch (error) {
                        console.warn('Failed to delete audio file:', error);
                    }
                }
                
                // Remove timeout from active set
                activeTimeouts.delete(audioTimeout);
            }, 5000);
            
            // Track timeout for cleanup
            activeTimeouts.add(audioTimeout);
        }, 5000);
        
        audioIntervalRef.current = audioInterval;

        return () => {
            console.log('[ObjectDetection] Cleaning up audio recording cycle');
            
            // Clear main interval
            if (audioIntervalRef.current) {
                clearInterval(audioIntervalRef.current);
                audioIntervalRef.current = null;
            }
            
            // Clear all active audio timeouts
            activeTimeouts.forEach(timeout => clearTimeout(timeout));
            activeTimeouts.clear();
            
            // Stop any ongoing recording immediately
            if (recording) {
                recording.stopAndUnloadAsync().catch(error => {
                    console.warn('Failed to stop recording during effect cleanup:', error);
                });
                setRecording(null);
            }
        };
    }, [isFocused, isActive, cameraReady, audioPermission, recording, startAudioRecording, stopAudioRecording, classifyAudio]);

    // Enhanced object detection with focus coordination
    const detectObjects = useCallback(async () => {
        // Early exit checks with focus coordination
        if (!cameraRef.current || !detector || isProcessing || !isFocused || cleanupInProgressRef.current) {
            return;
        }

        try {
            // Check focus state before starting processing
            if (!isFocused || cleanupInProgressRef.current) {
                return;
            }
            
            setIsProcessing(true);
            setDebugText(t('camera.capturing'));

            // Check focus state before camera operation
            if (!isFocused || cleanupInProgressRef.current) {
                setIsProcessing(false);
                return;
            }

            const photo = await cameraRef.current.takePhoto({
                flash: 'off',
                enableShutterSound: false,
            });

            // Check focus state after photo capture
            if (!photo?.path || !isFocused || cleanupInProgressRef.current) {
                setIsProcessing(false);
                return;
            }

            setDebugText(t('camera.detection_running'));
            
            // Check focus state before ML operations
            if (!isFocused || cleanupInProgressRef.current) {
                setIsProcessing(false);
                return;
            }
            
            // Object detection with focus check
            const objects = await detector.detectObjects(photo.path);
            
            // Process each detected object with focus coordination
            const enrichedDetections: Detection[] = [];
            
            for (const obj of objects) {
                // Check focus state during processing loop
                if (!isFocused || cleanupInProgressRef.current) {
                    setIsProcessing(false);
                    return;
                }
                
                const labels = [];
                
                // Classify the detected object region with focus checks
                if (classifier?.classifyImage && isFocused && !cleanupInProgressRef.current) {
                    try {
                        const result = await classifier.classifyImage(photo.path);
                        
                        // Check focus state after classification
                        if (!isFocused || cleanupInProgressRef.current) {
                            setIsProcessing(false);
                            return;
                        }
                        
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

            // Final focus check before state updates
            if (!isFocused || cleanupInProgressRef.current) {
                setIsProcessing(false);
                return;
            }

            setDetections(enrichedDetections);
            setDebugText(
                enrichedDetections.length > 0
                    ? t('camera.detection_successful', { count: enrichedDetections.length })
                    : t('camera.detection_none')
            );

        } catch (error) {
            console.error('Object detection failed:', error);
            // Only update state if still focused
            if (isFocused && !cleanupInProgressRef.current) {
                setDebugText(t('errors.detection_failed', { message: String(error) }));
            }
        } finally {
            // Always reset processing state if still focused
            if (isFocused && !cleanupInProgressRef.current) {
                setIsProcessing(false);
            }
        }
    }, [detector, classifier, isProcessing, isFocused, t]);

    // Enhanced auto-detect with focus coordination
    useEffect(() => {
        // Only start detection if tab is focused and all prerequisites are met
        if (!isFocused || !isActive || !cameraReady || cleanupInProgressRef.current) {
            return;
        }

        console.log('[ObjectDetection] Starting detection cycle');
        
        const detectionInterval = setInterval(() => {
            // Check if still focused before processing
            if (!isFocused || cleanupInProgressRef.current) {
                return;
            }
            detectObjects();
        }, 2000);
        
        detectionIntervalRef.current = detectionInterval;

        return () => {
            console.log('[ObjectDetection] Cleaning up detection cycle');
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
        };
    }, [isFocused, isActive, cameraReady, detectObjects]);
    
    // Comprehensive cleanup when focus is lost with enhanced audio coordination
    useEffect(() => {
        if (!isFocused) {
            console.log('[ObjectDetection] Tab unfocused, starting comprehensive cleanup');
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
            
            // Stop any ongoing audio recording with enhanced error handling
            if (recording) {
                recording.stopAndUnloadAsync().catch(error => {
                    console.warn('Failed to stop audio recording during cleanup:', error);
                }).finally(() => {
                    // Ensure recording state is cleared even if stop fails
                    setRecording(null);
                });
            }
            
            // Stop any pending BirdNet audio processing
            try {
                // Note: BirdNetService should have its own cleanup mechanisms
                // but we ensure no new processing starts
                console.log('[ObjectDetection] Stopping BirdNet processing');
            } catch (error) {
                console.warn('Error stopping BirdNet processing:', error);
            }
            
            // Reset all states
            setIsActive(false);
            setCameraReady(false);
            setDetections([]);
            setIsProcessing(false);
            setLastAudioClassification('');
            setSnackbarVisible(false);
            
            // Reset cleanup flag after ensuring all operations complete
            setTimeout(() => {
                cleanupInProgressRef.current = false;
            }, 300); // Increased delay for comprehensive cleanup
        }
    }, [isFocused, recording]);

    // Show snackbar helper
    const showSnackbar = useCallback((message: string) => {
        setSnackbarMessage(message);
        setSnackbarVisible(true);
        setTimeout(() => setSnackbarVisible(false), 2500);
    }, []);

    // Render fallbacks

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
                isActive={isActiveCameraState}
                onCameraReady={() => setCameraReady(true)}
                onCameraUnmount={() => {
                    setCameraReady(false);
                    cleanupInProgressRef.current = true;
                }}
            >
                <Camera
                    ref={cameraRef}
                    style={StyleSheet.absoluteFillObject}
                    device={device}
                    format={format}
                    isActive={isActiveCameraState}
                    photo={true}
                    enableZoomGesture={true}
                    onInitialized={() => {
                        console.log('[ObjectDetection] Camera onInitialized called');
                        // Additional delay to ensure view hierarchy is stable
                        setTimeout(() => {
                            if (isFocused && appState === 'active' && shouldRenderCamera && !cleanupInProgressRef.current) {
                                setCameraReady(true);
                            }
                        }, 100);
                    }}
                    onError={(error) => {
                        console.error('[ObjectDetection] Camera error:', error);
                        setDebugText(`Camera error: ${error.message}`);
                        // Reset camera state on error to prevent stuck states
                        setShouldRenderCamera(false);
                        setTimeout(() => {
                            if (isFocused && appState === 'active') {
                                setShouldRenderCamera(true);
                            }
                        }, 1000);
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
        <NavigationErrorBoundary>
            <CriticalErrorBoundary
                componentName="Simple Object Detection Camera"
                onError={(error, errorId) => {
                    console.error('Object detection camera error:', error, errorId);
                }}
            >
                <SimpleObjectDetectCamera />
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