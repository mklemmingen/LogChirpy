import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {
    ActivityIndicator,
    Button,
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
} from 'react-native';
import {Camera, useCameraDevice, useCameraPermission,} from 'react-native-vision-camera';
import Svg, {Rect, Text as SvgText} from 'react-native-svg';
import * as ImageManipulator from 'expo-image-manipulator';
import {useObjectDetection} from '@infinitered/react-native-mlkit-object-detection';
import type {MyModelsConfig} from './../_layout';

import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {AppState} from 'react-native';
import {useImageLabeling} from "@infinitered/react-native-mlkit-image-labeling";

import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

import {useTranslation} from 'react-i18next';

import Slider from '@react-native-community/slider';

import { BirdNetService, BirdNetPrediction } from '@/services/birdNetService';

import {ThemedSnackbar} from "@/components/ThemedSnackbar";
import {ThemedSafeAreaView} from "@/components/ThemedSafeAreaView";

import * as Haptics from 'expo-haptics';

import {theme} from "@/constants/theme";
import {Config} from "@/constants/config";


// Note: Storage keys now managed globally in constants/config.ts
const { width: W, height: H } = Dimensions.get('window');

interface Detection {
    frame: { origin: { x: number; y: number }; size: { x: number; y: number } };
    labels: { text: string; confidence: number; index: number }[];
}

interface CropBox {
    origin: { x: number; y: number };
    size: { x: number; y: number };
}

interface SnackbarOptions {
    bird?: string;
    confidence?: number;
    message?: string;
    [key: string]: any;
}

function getBoxStyle(confidence: number) {
    // Clamp conf to [0,1]
    const c = Math.min(Math.max(confidence, 0), 1);
    // Map confidence → hue (0 = red, 120 = green)
    const hue = Math.round(c * 120);
    // Use full saturation + mid lightness
    const color = `hsl(${hue}, 100%, 50%)`;
    // Make sure we never go fully transparent
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

function generateFilename(prefix: string, label: string, confidence: number) {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const milliseconds = now.getTime();
    const safeLabel = label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const confidenceStr = Math.round(confidence * 100).toString().padStart(3, '0');
    return `${prefix}_${safeLabel}_conf${confidenceStr}_${timestamp}_${milliseconds}.jpg`;
}

async function handleClassifiedSave(
    fileUri: string,
    label: { text: string; confidence: number },
    threshold: number,
    prefix: 'bird' | 'full',
    showSnackbar: (key: string, options?: SnackbarOptions) => void,
    setDebugText: (txt: string) => void
): Promise<void> {
    if (label.confidence < threshold) return;

    const filename = generateFilename(prefix, label.text, label.confidence);
    try {
        // Create gallery directory in document storage if it doesn't exist
        const galleryDir = `${FileSystem.documentDirectory}gallery/`;
        const dirInfo = await FileSystem.getInfoAsync(galleryDir);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(galleryDir, { intermediates: true });
            console.log('Created gallery directory:', galleryDir);
        }

        // Save to document directory for gallery access
        const destPath = `${galleryDir}${filename}`;
        await FileSystem.copyAsync({
            from: fileUri,
            to: destPath
        });

        console.log(`${prefix} classified image saved to gallery:`, destPath);
        showSnackbar('camera.bird_detected', {
            bird: label.text,
            confidence: Math.round(label.confidence * 100),
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error) {
        console.error('Failed to save image to gallery directory:', error);
        const message = error instanceof Error ? error.message : String(error);
        setDebugText(`Save failed: ${message}`);
    }
}

async function waitForFileStability(filePath: string, maxWaitMs: number = 3000): Promise<boolean> {
    let attempts = 0;
    const maxAttempts = Math.ceil(maxWaitMs / 100);
    let lastSize = 0;
    
    while (attempts < maxAttempts) {
        try {
            const info = await FileSystem.getInfoAsync(filePath);
            if (!info.exists) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
                continue;
            }
            
            const currentSize = info.size || 0;
            if (currentSize > 0 && currentSize === lastSize && attempts > 2) {
                return true;
            }
            
            lastSize = currentSize;
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
    }
    
    return false;
}

async function retryFileOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 200
): Promise<T> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
            }
        }
    }
    
    throw lastError;
}

async function deleteOldFiles(dirUri: string, maxAgeMinutes: number): Promise<void> {
    const fileNames = await FileSystem.readDirectoryAsync(dirUri);
    const now = Date.now();

    for (const name of fileNames) {
        const fileUri = `${dirUri}${name}`;
        const info = await FileSystem.getInfoAsync(fileUri) as FileSystem.FileInfo & { modificationTime?: number };
        const mod = info.modificationTime;
        if (mod && now - mod * 1000 > maxAgeMinutes * 60 * 1000) {
            await FileSystem.deleteAsync(fileUri);
            console.log("Deleted old file:", fileUri);
        }
    }
}

// Audio recording configuration for bird detection
const AUDIO_CONFIG = {
    android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 48000, // BirdNet prefers 48kHz
        numberOfChannels: 1, // Mono for smaller files
        bitRate: 128000,
    },
    ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 48000,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
    },
    web: {
        extension: '.m4a',
    }
};

async function initializeAudio(): Promise<boolean> {
    try {
        console.log('[Audio] Initializing audio system...');
        
        // Step 1: Request audio permissions
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
            console.warn('[Audio] Microphone permission denied');
            throw new Error('Microphone permission required for bird detection');
        }
        
        // Step 2: Configure audio mode
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });
        } catch (audioModeError) {
            console.warn('[Audio] Audio mode configuration failed:', audioModeError);
            // Continue anyway, as this might still work
        }
        
        // Step 3: Initialize BirdNet service for audio processing
        try {
            await BirdNetService.initializeOfflineMode();
            console.log('[Audio] BirdNet service initialized successfully');
        } catch (birdNetError) {
            console.error('[Audio] BirdNet initialization failed:', birdNetError);
            
            // Try fallback initialization
            try {
                await BirdNetService.initializeFastTflite();
                console.log('[Audio] BirdNet FastTflite fallback initialized');
            } catch (fallbackError) {
                console.error('[Audio] All BirdNet initialization methods failed:', fallbackError);
                throw new Error('Bird detection models unavailable');
            }
        }
        
        // Step 4: Test recording capability
        try {
            const testRecording = new Audio.Recording();
            await testRecording.prepareToRecordAsync(AUDIO_CONFIG as any);
            await testRecording.stopAndUnloadAsync();
            console.log('[Audio] Recording test passed');
        } catch (recordingTestError) {
            console.error('[Audio] Recording test failed:', recordingTestError);
            throw new Error('Audio recording unavailable');
        }
        
        console.log('[Audio] Audio system initialized successfully');
        return true;
        
    } catch (error) {
        console.error('[Audio] Failed to initialize audio system:', error);
        
        // Return specific error information
        if (error instanceof Error) {
            console.error('[Audio] Initialization error details:', error.message);
        }
        
        return false;
    }
}

async function recordAndProcessAudio(): Promise<BirdNetPrediction[]> {
    let recording: Audio.Recording | null = null;
    let audioUri: string | null = null;
    
    try {
        console.log('[Audio] Starting 5-second recording...');
        
        recording = new Audio.Recording();
        await recording.prepareToRecordAsync(AUDIO_CONFIG as any);
        await recording.startAsync();
        
        // Record for exactly 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await recording.stopAndUnloadAsync();
        audioUri = recording.getURI();
        
        if (!audioUri) {
            throw new Error('Failed to get recording URI');
        }
        
        console.log('[Audio] Recording complete, processing audio...');
        
        // Process audio through BirdNet with enhanced error handling
        let result;
        try {
            result = await BirdNetService.identifyBirdFromAudio(audioUri);
            
            if (!result || !result.success) {
                console.warn('[Audio] BirdNet processing failed, no valid results');
                return [];
            }
            
        } catch (birdNetError) {
            console.error('[Audio] BirdNet service failed:', birdNetError);
            
            // Fallback: Try to extract basic audio info without ML processing
            console.log('[Audio] Attempting fallback processing...');
            return []; // Return empty results rather than crashing
        }
        
        console.log(`[Audio] Found ${result.predictions.length} bird detections`);
        return result.predictions || [];
        
    } catch (error) {
        console.error('[Audio] Recording and processing failed:', error);
        
        // Enhanced error handling with specific error types
        if (error instanceof Error) {
            if (error.message.includes('permission')) {
                throw new Error('Microphone permission required');
            } else if (error.message.includes('recording')) {
                throw new Error('Recording failed - check microphone');
            } else if (error.message.includes('processing')) {
                throw new Error('Audio processing failed');
            }
        }
        
        throw new Error('Audio pipeline unavailable');
        
    } finally {
        // Ensure cleanup happens regardless of success/failure
        if (recording) {
            try {
                await recording.stopAndUnloadAsync();
            } catch (stopError) {
                console.warn('[Audio] Failed to stop recording:', stopError);
            }
        }
        
        if (audioUri) {
            try {
                await FileSystem.deleteAsync(audioUri);
            } catch (cleanupError) {
                console.warn('[Audio] Failed to cleanup recording:', cleanupError);
            }
        }
    }
}

export default function ObjectIdentCameraWrapper() {
    const [isLoading, setIsLoading] = useState(true);
    const [permissionRequested, setPermissionRequested] = useState(false);
    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();
    const { t } = useTranslation();
    const raw = useColorScheme()
    const colorScheme: 'light' | 'dark' = raw === 'dark' ? 'dark' : 'light'
    const currentTheme = theme[colorScheme]

    // Request permission only once
    useEffect(() => {
        if (!hasPermission && !permissionRequested) {
            setPermissionRequested(true);
            requestPermission();
        }
    }, [hasPermission, permissionRequested, requestPermission]);

    // Loading timer
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    // 2) if we’re still loading resources, show loader
    if (isLoading || !device || !hasPermission) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={{color: currentTheme.colors.text.primary, fontSize: 16, marginTop: 10}}>
                    {t('camera.loading_screen')}
                </Text>
            </View>
        );
    }

    // 3) when everything’s ready, mount the real camera content
    return <ObjectIdentCameraContent />;
}


function ObjectIdentCameraContent() {
    const device = useCameraDevice('back');
    const { t } = useTranslation();
    const raw = useColorScheme()
    const colorScheme: 'light' | 'dark' = raw === 'dark' ? 'dark' : 'light'
    const currentTheme = theme[colorScheme]

    // Camera setup and permissions
    const cameraRef = useRef<Camera>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);
    const [zoom, setZoom] = useState(1);

    // MLKit: detection, classification, and UI overlays
    const [detections, setDetections] = useState<Detection[]>([]);
    const [classifierReady, setClassifierReady] = useState(false);
    const [imageDims, setImageDims] = useState({ width: 0, height: 0 });
    const [showOverlays, setShowOverlays] = useState(true);

    // Photo paths and image state
    const [photoPath, setPhotoPath] = useState<string | null>(null);
    const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
    const [modalPhotoUri, setModalPhotoUri] = useState<string | null>(null);

    // Detection pipeline controls
    const [isDetectionPaused, setIsDetectionPaused] = useState(false);
    const [pipelineDelay, setPipelineDelay] = useState(Config.camera.pipelineDelay);
    const [confidenceThreshold, setConfidenceThreshold] = useState(Config.camera.confidenceThreshold);

    // UI Settings and visibility toggles
    const [showSettings, setShowSettings] = useState(Config.camera.showSettings);
    const [modalVisible, setModalVisible] = useState(false);

    // Audio processing state
    const [audioResults, setAudioResults] = useState<BirdNetPrediction[]>([]);
    const [audioProcessing, setAudioProcessing] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [audioInitialized, setAudioInitialized] = useState(false);
    const audioIntervalRef = useRef<NodeJS.Timeout>();

    // Note: Tooltip states removed - settings now managed globally

    // Focus/app state control
    const isFocused = useIsFocused();
    const [appState, setAppState] = useState(AppState.currentState);
    
    useEffect(() => {
        const subscription = AppState.addEventListener('change', setAppState);
        return () => subscription?.remove();
    }, []);
    
    const isCameraActive = isFocused && appState === 'active';
    
    // Component cleanup to prevent view conflicts
    useFocusEffect(
        useCallback(() => {
            return () => {
                // Cleanup when losing focus to prevent view conflicts
                setIsInitialized(false);
                setIsDetectionPaused(true);
                setModalVisible(false);
                setModalPhotoUri(null);
                setShowOverlays(true);
                
                // Stop audio processing
                if (audioIntervalRef.current) {
                    clearInterval(audioIntervalRef.current);
                }
            };
        }, [])
    );

    // Permissions
    const [hasMediaPermission, setHasMediaPermission] = useState(false);

    // Snackbar notification logic
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const showSnackbar = useCallback((key: string, options?: SnackbarOptions) => {
        setSnackbarMessage(t(key, options));
        setSnackbarVisible(true);
        setTimeout(() => setSnackbarVisible(false), 2500);
    }, [t]);


    // Debug message shown to user
    const [debugText, setDebugText] = useState(t('camera.initializing'));

    // Load settings from global config on mount and when config changes
    useEffect(() => {
        setPipelineDelay(Config.camera.pipelineDelay);
        setConfidenceThreshold(Config.camera.confidenceThreshold);
        setShowSettings(Config.camera.showSettings);
    }, []);
    
    // Update local state when global config changes (e.g., from settings page)
    useEffect(() => {
        const interval = setInterval(() => {
            if (Config.camera.pipelineDelay !== pipelineDelay) {
                setPipelineDelay(Config.camera.pipelineDelay);
            }
            if (Config.camera.confidenceThreshold !== confidenceThreshold) {
                setConfidenceThreshold(Config.camera.confidenceThreshold);
            }
            if (Config.camera.showSettings !== showSettings) {
                setShowSettings(Config.camera.showSettings);
            }
        }, 1000); // Check every second
        
        return () => clearInterval(interval);
    }, [pipelineDelay, confidenceThreshold, showSettings]);

    // Note: Settings handlers removed - values now managed globally via settings page

    const toggleShowSettings = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowSettings(prev => !prev);
        // Note: showSettings is now managed globally via settings page
    }, []);

    // Initialize component once on mount
    useEffect(() => {
        console.log('[ObjectDetection] Component mounted, initializing...');
        let isMounted = true;
        
        const initializeComponent = async () => {
            if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
                UIManager.setLayoutAnimationEnabledExperimental(true);
            }

            // No media permissions needed for document directory storage
            if (isMounted) {
                setHasMediaPermission(true);
            }
            
            // Initialize audio system
            try {
                const audioSuccess = await initializeAudio();
                if (isMounted) {
                    setAudioInitialized(audioSuccess);
                    if (audioSuccess) {
                        console.log('[Audio] Audio system ready for bird detection');
                    } else {
                        setAudioError('Audio initialization failed');
                    }
                }
            } catch (error) {
                console.error('[Audio] Audio initialization error:', error);
                if (isMounted) {
                    setAudioError('Audio system unavailable');
                }
            }
        };

        initializeComponent();
        
        // Cleanup function to prevent view conflicts on unmount
        return () => {
            console.log('[ObjectDetection] Component unmounting, cleaning up...');
            isMounted = false;
            setIsInitialized(false);
            setIsDetectionPaused(true);
            setModalVisible(false);
            setModalPhotoUri(null);
        };
    }, []);


    const detector = useObjectDetection<MyModelsConfig>('efficientNetlite0int8');
    const classifier = useImageLabeling("birdClassifier");
    
    // Memoize classifier ready check
    const isClassifierReady = useMemo(() => {
        return !!(classifier && typeof classifier.classifyImage === 'function');
    }, [classifier]);

    type ClassificationResult = { text: string; confidence: number; index: number }[];

    const classifyImage = async (imageUri: string): Promise<ClassificationResult> => {
        try {
            const result = await classifier?.classifyImage(imageUri);
            console.log('Classifier result:', result);

            // If result is string, try JSON.parse
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

    // Component active state
    const isActive = useRef(true);
    const captureTimeoutRef = useRef<NodeJS.Timeout>();

    // Capture loop: take photo, manipulate, and save to document directory
    useEffect(() => {
        if (!isInitialized || isDetectionPaused || !cameraRef.current || !detector) {
            return;
        }

        const captureLoop = async () => {
            if (!cameraRef.current || !isInitialized || isDetectionPaused || !isActive.current) {
                return;
            }

            try {
                setIsProcessing(true);
                setDebugText(t('camera.capturing'));

                const photo = await cameraRef.current.takePhoto({
                    flash: 'off',
                    enableShutterSound: false,
                });

                console.log('Photo taken:', photo);

                if (!photo?.path) {
                    setDebugText(t('errors.no_photo_path'));
                    return;
                }

                // Apply any desired image manipulations (compression, format, etc.)
                const manipResult = await ImageManipulator.manipulateAsync(
                    photo.path,
                    [],
                    { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG }
                );

                setImageDims({ width: manipResult.width, height: manipResult.height });

                // Save manipulated image to the document directory using standard FileSystem
                try {
                    const fileName = `photo_${Date.now()}.jpg`;
                    const destPath = `${FileSystem.documentDirectory}${fileName}`;

                    // Copy the manipulated image to document directory
                    await FileSystem.copyAsync({
                        from: manipResult.uri,
                        to: destPath
                    });
                    
                    console.log('Photo saved to document directory:', destPath);
                    setPhotoPath(destPath);

                } catch (copyError: unknown) {
                    console.error('Error copying photo to document directory:', copyError);
                    const message = copyError instanceof Error ? copyError.message : String(copyError);
                    setDebugText(t('errors.save_photo_failed', { message }));
                    return;
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(t('errors.capture_failed', { message }));
                setDebugText(t('errors.capture_failed', { message }));
            } finally {
                setIsProcessing(false);
            }

            // Continue capture loop if still active
            if (isActive.current && !isDetectionPaused) {
                captureTimeoutRef.current = setTimeout(captureLoop, pipelineDelay * 1000);
            }
        };

        // Start the capture loop
        const timeoutId = setTimeout(captureLoop, 1000); // Initial delay
        
        return () => {
            clearTimeout(timeoutId);
            if (captureTimeoutRef.current) {
                clearTimeout(captureTimeoutRef.current);
            }
        };
    }, [isInitialized, isDetectionPaused, detector, pipelineDelay, t]);

    async function cropImage(imageUri: string, box: CropBox) : Promise<string> {
        const cropAction = {
            crop: {
                originX: box.origin.x,
                originY: box.origin.y,
                width: box.size.x,
                height: box.size.y
            }
        };
        const cropResult = await ImageManipulator.manipulateAsync(
            imageUri,
            [cropAction],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        // cropResult.uri is the URI of the cropped image
        return cropResult.uri;
    }

    // Update classifier ready state
    useEffect(() => {
        setClassifierReady(isClassifierReady);
        if (isClassifierReady) {
            console.log("[ObjectDetection] Classifier ready and functional");
        } else if (classifier === null) {
            console.log("[ObjectDetection] Classifier failed to initialize");
        }
    }, [isClassifierReady, classifier]);

    useEffect(() => {
        if (detector) {
            console.log("[ObjectDetection] Detector available with methods:", Object.keys(detector || {}));
        } else if (detector === null) {
            console.log("[ObjectDetection] Detector failed to initialize");
        }
    }, [detector]);


    // Process photoPath with MLKit and delete previous photos
    useEffect(() => {
        if (!photoPath || !detector || !classifierReady) {
            if (!photoPath) return;
            if (!detector) {
                setDebugText(t('errors.detector_unavailable'));
                console.error('[ObjectDetection] Object detector not loaded. Detector state:', detector);
                return;
            }
            if (!classifierReady) {
                setDebugText(t('errors.classifier_unavailable'));
                console.warn('Image classifier not ready yet.');
                return;
            }
        }

        let isMounted = true;
        
        const processPhoto = async () => {
            if (!isMounted) return;

            // Use the photoPath directly since it's already been processed
            const imagePath = photoPath;

            try {
                console.log('Processing image...');

                // Wait for file to be stable before processing
                console.log('Waiting for file stability:', imagePath);
                const isStable = await waitForFileStability(imagePath, 3000);
                if (!isStable) {
                    throw new Error(`File not stable after waiting: ${imagePath}`);
                }

                console.log('MLKit Path:', imagePath);

                // Keep existing image dimensions from when photo was first processed
                setDebugText(t('camera.detection_running'));

                // Run object detection on the image with retry logic
                console.log('[ObjectDetection] Starting object detection on image:', imagePath);
                console.log('[ObjectDetection] Detector ready:', !!detector, 'Has detectObjects method:', !!detector?.detectObjects);
                
                const objects = await retryFileOperation(
                    () => detector.detectObjects(imagePath),
                    3,
                    300
                );
                console.log('[ObjectDetection] Detection completed successfully. Results:', objects);
                console.log('[ObjectDetection] Number of objects detected:', objects.length);


                // pipeline to run all objects into the image classificer pipeline with classifyImage(imagePath: string): Promise<ClassificationResult>
                // for this, we need to cut the image from path into each objects piece, run it through classifiy, and then map the right label onto the object for display

                // type ClassificationResult = Array<{
                //   text: string;
                //   index: number;
                //   confidence: number;
                // }>;

                // interface ObjectDetectionObject {
                //   frame: {
                //     origin: { x: number; y: number };
                //     size: { x: number; y: number };
                //   };
                //   labels: Array<{
                //     text: string;
                //     confidence: number;
                //     index: number;
                //   }>;
                //   trackingID?: number;
                // }

                // Set current photo as last photo for UI display
                setLastPhotoUri(imagePath);

                // 1) Enrich each detection by cropping + classifying:
                const enriched: Detection[] = [];
                for (const obj of objects) {
                    // crop the box out of the image
                    const cropUri = await cropImage(imagePath, obj.frame);

                    try {
                        // classify the cropped image with retry logic
                        if (typeof classifier?.classifyImage !== 'function') {
                            console.warn("Classifier method not available");
                            return;
                        }
                        const labelResult = await retryFileOperation(
                            () => classifyImage(cropUri),
                            3,
                            200
                        );

                        console.log(labelResult);

                        // pick the top label
                        const labels = labelResult.length
                            ? [{
                                text:    labelResult[0].text,
                                confidence: labelResult[0].confidence,
                                index:   labelResult[0].index
                            }]
                            : [];

                        // check if the label confidence is above the threshold, and save the image if it is
                        if (labels[0]) {
                            await handleClassifiedSave(
                                cropUri,
                                labels[0],
                                confidenceThreshold,
                                'bird',
                                showSnackbar,
                                setDebugText
                            );
                        }

                        // attach those labels to a fresh object
                        enriched.push({
                            frame: obj.frame,
                            labels,
                        });
                    } catch (e) {
                        console.warn('Failed to classify crop:', e);
                    }

                    // Delete the crop file
                    try {
                        await FileSystem.deleteAsync(cropUri);
                        console.log('Deleted crop:', cropUri);
                    } catch (err) {
                        console.warn('Could not delete crop file:', err);
                    }
                }

                // 2) Update state with your new list:
                setDetections(enriched);
                setDebugText(
                    enriched.length > 0
                        ? t('camera.detection_successful', { count: enriched.length })
                        : t('camera.detection_none')
                );

                // Run classification on the full image
                try {
                    const fullImageLabels = await retryFileOperation(
                        () => classifyImage(imagePath),
                        3,
                        200
                    );
                    console.log('Full image classification:', fullImageLabels);

                    const top = fullImageLabels[0];
                    if (top) {
                        await handleClassifiedSave(
                            imagePath,
                            top,
                            confidenceThreshold,
                            'full',
                            showSnackbar,
                            setDebugText
                        );
                    }

                } catch (e) {
                    console.warn('Failed to classify full image:', e);
                }

                // Delete the previous photo file only after all processing is complete
                if (lastPhotoUri && lastPhotoUri !== imagePath) {
                    try {
                        const fileInfo = await FileSystem.getInfoAsync(lastPhotoUri);
                        if (fileInfo.exists) {
                            await FileSystem.deleteAsync(lastPhotoUri);
                            console.log('Deleted previous photo:', lastPhotoUri);
                        }
                    } catch (deleteError) {
                        console.warn('Error deleting previous photo:', deleteError);
                    }
                }

            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(t('errors.detection_failed', { message }));
                setDebugText(t('errors.detection_failed', { message }));
                
                // Still try to delete previous photo on error to prevent accumulation
                if (lastPhotoUri && lastPhotoUri !== imagePath) {
                    try {
                        const fileInfo = await FileSystem.getInfoAsync(lastPhotoUri);
                        if (fileInfo.exists) {
                            await FileSystem.deleteAsync(lastPhotoUri);
                            console.log('Deleted previous photo after error:', lastPhotoUri);
                        }
                    } catch (deleteError) {
                        console.warn('Error deleting previous photo after error:', deleteError);
                    }
                }
            }
        };
        
        processPhoto();
        
        return () => {
            isMounted = false;
        };
    }, [photoPath, detector, classifierReady, classifier, lastPhotoUri, confidenceThreshold, showSnackbar, t]);

    // Cleanup effect
    useEffect(() => {
        return () => {
            isActive.current = false;
            
            if (captureTimeoutRef.current) {
                clearTimeout(captureTimeoutRef.current);
            }

            (async () => {
                try {
                    console.log("Cleaning up old files in document and cache directories...");
                    await deleteOldFiles(FileSystem.documentDirectory!, 5); // Files older than 5 minutes
                    await deleteOldFiles(FileSystem.cacheDirectory!, 5);
                } catch (e) {
                    console.warn("Cleanup failed:", e);
                }
            })();
        };
    }, []);

    // Audio processing interval effect
    useEffect(() => {
        if (!audioInitialized || isDetectionPaused || !isActive.current) {
            return;
        }

        const startAudioProcessing = () => {
            console.log('[Audio] Starting 5-second audio processing interval');
            
            const processAudioInterval = async () => {
                if (!audioInitialized || isDetectionPaused || !isActive.current) {
                    return;
                }
                
                try {
                    setAudioProcessing(true);
                    setAudioError(null);
                    
                    const predictions = await recordAndProcessAudio();
                    
                    // Filter predictions by confidence and take top 3
                    const filteredPredictions = predictions
                        .filter(p => p.confidence >= 0.1) // 10% minimum confidence
                        .slice(0, 3) // Max 3 results
                        .sort((a, b) => b.confidence - a.confidence);
                    
                    setAudioResults(filteredPredictions);
                    
                    if (filteredPredictions.length > 0) {
                        console.log(`[Audio] Detected ${filteredPredictions.length} bird(s):`, 
                            filteredPredictions.map(p => `${p.common_name} (${Math.round(p.confidence * 100)}%)`));
                    }
                    
                } catch (error) {
                    console.error('[Audio] Processing error:', error);
                    setAudioError(error instanceof Error ? error.message : 'Audio processing failed');
                    setAudioResults([]);
                } finally {
                    setAudioProcessing(false);
                }
            };
            
            // Initial processing
            processAudioInterval();
            
            // Set up 5-second interval
            audioIntervalRef.current = setInterval(processAudioInterval, 5000);
        };

        // Small delay to let camera initialize first
        const audioStartTimeout = setTimeout(startAudioProcessing, 2000);
        
        return () => {
            clearTimeout(audioStartTimeout);
            if (audioIntervalRef.current) {
                clearInterval(audioIntervalRef.current);
            }
        };
    }, [audioInitialized, isDetectionPaused]);

    // Focus/unfocus effect
    useFocusEffect(
        useCallback(() => {
            // Component is focused
            isActive.current = true;
            setIsDetectionPaused(false);

            return () => {
                // Component lost focus
                isActive.current = false;
                setIsDetectionPaused(true);
                if (captureTimeoutRef.current) {
                    clearTimeout(captureTimeoutRef.current);
                }
                if (audioIntervalRef.current) {
                    clearInterval(audioIntervalRef.current);
                }
            };
        }, [])
    );

    // Calculate scale for rendering detection bounding boxes
    const scaleX = imageDims.width ? W / imageDims.width : 1;
    const scaleY = imageDims.height ? H / imageDims.height : 1;

    // ——— FALLBACKS & CONTENT ———
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
                <Text>{ t('camera.unsupported_platform') }</Text>
            </View>
        );
    }

    return (
        <ThemedSafeAreaView style={{ flex: 1 }}>
            <View style={styles.container}>
                {showOverlays && (
                    <View pointerEvents="none" style={styles.overlay}>
                        <Svg style={{ width: '100%', height: '100%' }}>
                            {detections.map((item, index) => {
                                const { origin, size } = item.frame;
                                const labels = item.labels;
                                const conf = labels[0]?.confidence ?? 0;
                                const { color, opacity } = getBoxStyle(conf);

                                return (
                                    <React.Fragment key={`det-${index}`}>
                                        {/* Bounding box */}
                                        <Rect
                                            x={origin.x * scaleX}
                                            y={origin.y * scaleY}
                                            width={size.x * scaleX}
                                            height={size.y * scaleY}
                                            stroke={color}
                                            strokeWidth={2}
                                            fill="none"
                                            fillOpacity={opacity * 0.3}
                                        />
                                        {labels.slice(0, 3).map((label, idx) => {
                                            const conf = label.confidence;
                                            const labelText = `${label.text} ${(conf * 100).toFixed(0)}%`;
                                            const labelX = origin.x * scaleX;
                                            const labelY = Math.max(origin.y * scaleY - 22 * (labels.length - idx), 0);
                                            const labelWidth = labelText.length * 6.8 + 12;
                                            const backgroundPadding = 4;

                                            return (
                                                <React.Fragment key={`label-${index}-${idx}`}>
                                                    <Rect
                                                        x={labelX - backgroundPadding}
                                                        y={labelY - 12}
                                                        width={labelWidth}
                                                        height={18}
                                                        rx={4}
                                                        ry={4}
                                                        fill="black"
                                                        fillOpacity={0.5}
                                                    />
                                                    <SvgText
                                                        x={labelX}
                                                        y={labelY}
                                                        fill="white"
                                                        fontSize="12"
                                                        fontWeight="bold"
                                                    >
                                                        {labelText}
                                                    </SvgText>
                                                    <Rect
                                                        x={labelX - backgroundPadding}
                                                        y={labelY + 6}
                                                        width={labelWidth * Math.min(conf, 1)}
                                                        height={4}
                                                        rx={2}
                                                        fill={conf >= confidenceThreshold ? 'limegreen' : 'crimson'}
                                                    />
                                                </React.Fragment>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </Svg>
                    </View>
                )}

                {/* Audio Results Display */}
                <View style={[styles.audioResultsContainer, { backgroundColor: currentTheme.colors.overlay.heavy }]}>
                    <View style={styles.audioHeader}>
                        <View style={styles.audioStatusIndicator}>
                            {audioProcessing ? (
                                <ActivityIndicator size="small" color="#00FF00" />
                            ) : audioInitialized ? (
                                <View style={[styles.statusDot, { backgroundColor: '#00FF00' }]} />
                            ) : (
                                <View style={[styles.statusDot, { backgroundColor: '#FF0000' }]} />
                            )}
                            <Text style={styles.audioStatusText}>
                                {audioProcessing ? 'Listening...' : audioInitialized ? 'Audio Ready' : 'Audio Error'}
                            </Text>
                        </View>
                        {audioResults.length > 0 && (
                            <Text style={styles.audioResultCount}>
                                🐦 {audioResults.length}
                            </Text>
                        )}
                    </View>
                    
                    {audioError && (
                        <View style={[styles.audioErrorContainer, { backgroundColor: currentTheme.colors.status.error }]}>
                            <Text style={styles.audioErrorText}>
                                ⚠️ {audioError}
                            </Text>
                        </View>
                    )}
                    
                    {audioResults.length > 0 && (
                        <View style={styles.audioBirdList}>
                            {audioResults.map((bird, index) => (
                                <View key={`${bird.common_name}-${index}`} style={[
                                    styles.audioBirdItem,
                                    { backgroundColor: currentTheme.colors.overlay.medium }
                                ]}>
                                    <Text style={styles.audioBirdName} numberOfLines={1}>
                                        {bird.common_name}
                                    </Text>
                                    <View style={[
                                        styles.audioConfidenceBar,
                                        { backgroundColor: currentTheme.colors.overlay.light }
                                    ]}>
                                        <View 
                                            style={[
                                                styles.audioConfidenceFill,
                                                { 
                                                    width: `${bird.confidence * 100}%`,
                                                    backgroundColor: bird.confidence > 0.5 ? '#00FF00' : bird.confidence > 0.2 ? '#FFFF00' : '#FF9900'
                                                }
                                            ]} 
                                        />
                                        <Text style={styles.audioConfidenceText}>
                                            {Math.round(bird.confidence * 100)}%
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    onPress={toggleShowSettings}
                    style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        backgroundColor: currentTheme.colors.overlay.dark,
                        padding: 6,
                        borderRadius: 20,
                        zIndex: 15,
                    }}
                >
                    <Text style={{ color: 'white', fontSize: 18 }}>⚙️</Text>
                </TouchableOpacity>

                <Camera
                    style={styles.camera}
                    ref={cameraRef}
                    device={device!}
                    isActive={isCameraActive}
                    photo={true}
                    zoom={zoom}
                    enableZoomGesture={true}
                    onInitialized={() => {
                        console.log("Camera initialized!");
                        setIsInitialized(true);
                    }}
                />
                {isCameraActive && (
                    <View style={[styles.statusBadge, { backgroundColor: currentTheme.colors.overlay.dark }]}>
                        <View style={[
                            styles.statusDot,
                            { backgroundColor: isProcessing ? 'limegreen' : 'red' }
                        ]} />
                        <Text style={styles.statusText}>
                            {isProcessing ? t('camera.status_detecting') : t('camera.status_idle')}
                        </Text>
                    </View>
                )}
                {showSettings && (
                    <View style={[styles.sliderBlock, { backgroundColor: currentTheme.colors.overlay.medium }]}>
                        <View style={styles.sliderRow}>
                            <Text style={styles.sliderLabel}>{t('camera.zoom')}</Text>
                            <Slider
                                value={zoom}
                                onValueChange={setZoom}
                                minimumValue={1}
                                maximumValue={device?.maxZoom ?? 5}
                                step={0.01}
                                minimumTrackTintColor="#1EB1FC"
                                maximumTrackTintColor="#d3d3d3"
                                thumbTintColor="#1EB1FC"
                                style={{ width: '100%', height: 40 }}
                            />
                            <Text style={styles.sliderValue}>{zoom.toFixed(2)}x</Text>
                        </View>
                        
                        {/* AI Settings Status */}
                        <View style={styles.settingsStatus}>
                            <Text style={[styles.statusLabel, { color: currentTheme.colors.text.secondary }]}>AI Settings</Text>
                            <Text style={[styles.statusValue, { color: currentTheme.colors.text.primary }]}>
                                Speed: {getDelayPresetLabel(pipelineDelay).split(' ')[1]} | 
                                Confidence: {getConfidencePresetLabel(confidenceThreshold).split(' ')[1]}
                            </Text>
                            <Text style={[styles.statusNote, { color: currentTheme.colors.text.tertiary }]}>
                                Configure in Settings → Camera AI
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => setIsDetectionPaused(prev => !prev)}
                            style={[styles.pauseResumeButton, {
                                backgroundColor: isDetectionPaused ? currentTheme.colors.status.error : currentTheme.colors.interactive.primary,
                            }]}
                        >
                            <Text style={[styles.pauseResumeText, { color: currentTheme.colors.text.inverse }]}>
                                {isDetectionPaused ? t('camera.resume') : t('camera.pause')} Detection
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Photo and Video Capture Buttons */}
                <View style={styles.captureButtons}>
                    <TouchableOpacity
                        onPress={() => {
                            console.log('Manual photo capture requested');
                            // Manual photo capture - saves a single high-quality photo
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(console.warn);
                        }}
                        style={[styles.captureButton, { backgroundColor: currentTheme.colors.interactive.primary }]}
                    >
                        <Text style={styles.captureButtonText}>📸</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                        onPress={() => {
                            console.log('Video recording requested');
                            // Video recording functionality
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(console.warn);
                        }}
                        style={[styles.captureButton, { backgroundColor: '#FF6B6B' }]}
                    >
                        <Text style={styles.captureButtonText}>🎥</Text>
                    </TouchableOpacity>
                </View>

                {lastPhotoUri && (
                    <TouchableOpacity
                        onPress={() => {
                            setModalPhotoUri(lastPhotoUri); // freeze the preview
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
                <View style={[styles.debugTextContainer, { backgroundColor: currentTheme.colors.overlay.heavy }]}>
                    <Text
                        style={styles.debugText}
                        accessibilityRole="alert"
                        accessibilityLiveRegion="polite"
                    >
                        {debugText}
                    </Text>
                </View>
                <ThemedSnackbar
                    visible={snackbarVisible}
                    message={snackbarMessage}
                    onHide={() => setSnackbarVisible(false)}
                />
            </View>
            {!hasMediaPermission && (
                <View style={[styles.permissionWarning, { backgroundColor: currentTheme.colors.status.error }]}>
                    <Text style={styles.permissionWarningText}>
                        {t('warnings.media_permission_required')}
                    </Text>
                    <Button
                        title={t('buttons.grant_permission')}
                        onPress={async () => {
                            // No media permissions needed for document directory storage
                            setHasMediaPermission(true);
                        }}
                    />
                </View>
            )}
            <Modal
                visible={modalVisible && modalPhotoUri !== null}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    setModalVisible(false);
                    setTimeout(() => setModalPhotoUri(null), 100);
                }}
            >
                {modalPhotoUri && (
                    <View style={styles.modalContainer}>
                        <Image source={{ uri: modalPhotoUri }} style={styles.modalImage} />
                        <View style={styles.modalOverlay}>
                            {detections.map((d, i) => {
                                const { origin, size } = d.frame;
                                const label = d.labels[0];
                                const conf = label?.confidence ?? 0;
                                const { color } = getBoxStyle(conf);
                                return (
                                    <View
                                        key={i}
                                        style={{
                                            position: 'absolute',
                                            left: origin.x * scaleX,
                                            top: origin.y * scaleY,
                                            width: size.x * scaleX,
                                            height: size.y * scaleY,
                                            borderWidth: 2,
                                            borderColor: color,
                                        }}
                                    />
                                );
                            })}
                        </View>
                        <View style={styles.modalButtons}>
                            <Button title={t('buttons.close')} onPress={() => {
                                // Safe modal close to prevent view conflicts
                                setModalVisible(false);
                                setShowOverlays(true);
                                // Delay clearing the URI to ensure modal is fully unmounted
                                setTimeout(() => {
                                    setModalPhotoUri(null);
                                }, 100);
                            }} />
                            {/* Optional, havent fully fletched out the UX yet */}
                            {/* <Button title="Delete" onPress={...} /> */}
                            {/* <Button title="Save" onPress={...} /> */}
                        </View>
                    </View>
                )}
            </Modal>
        </ThemedSafeAreaView>
    );
}

const styles = StyleSheet.create({
    tooltipBox: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginTop: 4,
        alignSelf: 'flex-start',
        zIndex: 10,
    },
    tooltipText: {
        color: 'white',
        fontSize: 12,
        fontStyle: 'italic',
        zIndex: 10,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10, // Ensure modal is above the SVG overlay
    },
    modalImage: {
        width: W,
        height: H,
        resizeMode: 'contain',
        zIndex: 10, // Ensure modal image is above the SVG overlay
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: W,
        height: H,
        zIndex: 10, // Ensure modal overlay is above the SVG overlay
    },
    modalButtons: {
        position: 'absolute',
        bottom: 40,
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        paddingHorizontal: 20,
        zIndex: 10, // Ensure modal buttons are above the SVG overlay
    },
    statusBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 5,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 6,
        zIndex: 10,
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        zIndex: 10,
    },
    container: { flex: 1 },
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
        zIndex: 5, // Ensure SVG overlay is below the modal
    },
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
    sliderValue: {
        color: 'white',
        fontSize: 10,
        textAlign: 'right',
        marginTop: -6,
        marginBottom: 8,
    },
    settingsStatus: {
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 8,
        gap: 4,
    },
    statusLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    statusValue: {
        fontSize: 13,
        fontWeight: '500',
    },
    statusNote: {
        fontSize: 11,
        fontStyle: 'italic',
    },
    pauseResumeButton: {
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    pauseResumeText: {
        fontSize: 14,
        fontWeight: '600',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    debugTextContainer: {
        position: 'absolute',
        top: 40,
        alignSelf: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        zIndex: 10,
    },
    debugText: { color: 'white', fontSize: 16 },
    sliderBlock: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        padding: 10,
        borderRadius: 10,
        zIndex: 10,
    },
    sliderRow: {
        marginBottom: 10,
        zIndex: 10,
    },
    sliderLabel: {
        color: 'white',
        fontSize: 10,
        fontWeight: '400',
        marginBottom: 4,
    },
    permissionWarning: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        padding: 15,
        borderRadius: 10,
        zIndex: 25, // Higher than other UI elements
        alignItems: 'center',
    },
    permissionWarningText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 10,
    },
    captureButtons: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        flexDirection: 'column',
        gap: 12,
        zIndex: 20,
    },
    captureButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    captureButtonText: {
        fontSize: 24,
        color: 'white',
    },
    
    // Audio Results Styles
    audioResultsContainer: {
        position: 'absolute',
        top: 60,
        left: 10,
        right: 10,
        borderRadius: 12,
        padding: 12,
        zIndex: 20,
        maxHeight: 200,
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
        gap: 6,
    },
    audioStatusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    audioResultCount: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    audioErrorContainer: {
        padding: 8,
        borderRadius: 6,
        marginTop: 4,
    },
    audioErrorText: {
        color: 'white',
        fontSize: 11,
        textAlign: 'center',
    },
    audioBirdList: {
        gap: 6,
        maxHeight: 120,
    },
    audioBirdItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 8,
        borderRadius: 8,
        gap: 8,
    },
    audioBirdName: {
        color: 'white',
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    audioConfidenceBar: {
        width: 60,
        height: 16,
        borderRadius: 8,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioConfidenceFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        height: '100%',
        borderRadius: 8,
    },
    audioConfidenceText: {
        color: 'black',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
        zIndex: 1,
    },
});

