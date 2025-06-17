/**
 * 80s Sci-Fi ObjectIdentCamera Component
 * 
 * Features:
 * ✅ Retro-futuristic 80s sci-fi UI design
 * ✅ Automatic object detection → image classification
 * ✅ Automatic audio bird classification
 * ✅ Camera zoom and flash controls
 * ✅ Portrait and landscape orientation support
 * ✅ Compact ML pipeline results display
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Platform,
    StyleSheet,
    UIManager,
    View,
    StatusBar,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import Svg, { Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useObjectDetection } from '@infinitered/react-native-mlkit-object-detection';
import { useImageLabeling } from "@infinitered/react-native-mlkit-image-labeling";
import type { MyModelsConfig } from './../_layout';

import { useIsFocused } from '@react-navigation/native';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import Animated, {
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedPressable } from "@/components/ThemedPressable";
import { ThemedIcon } from "@/components/ThemedIcon";
import { Config } from "@/constants/config";

import { capturePhoto, saveClassifiedImage } from '@/services/cameraOperationsService';
import { ensureGalleryDirectory, copyFileWithProperUri } from '@/services/uriUtils';
import { 
    classifyBirdAudioForPipeline as classifyWithUltraSimple,
    initializeBirdClassifier as initUltraSimple
} from '@/services/ultraSimpleBirdClassifier';

// Core interfaces
interface Detection {
    frame: { origin: { x: number; y: number }; size: { x: number; y: number } };
    labels: { text: string; confidence: number; index: number }[];
}

interface AudioPrediction {
    common_name: string;
    scientific_name: string;
    confidence: number;
}

const { width: W, height: H } = Dimensions.get('window');

// Dark Cyberpunk Color Palette
const CYBER_COLORS = {
    primary: '#00D4FF',      // Electric blue
    secondary: '#7C3AED',    // Deep purple
    accent: '#10B981',       // Emerald green
    warning: '#F59E0B',      // Amber
    danger: '#EF4444',       // Red
    success: '#22C55E',      // Green
    text: '#F8FAFC',         // Near white
    textMuted: '#94A3B8',    // Slate 400
    background: '#0F0F23',   // Very dark blue
    surface: '#1E1E2E',      // Dark surface
    surfaceElevated: '#262640', // Elevated surface
    border: '#374151',       // Gray border
    borderActive: '#00D4FF', // Active border
    overlay: '#000000CC',    // Semi-transparent black
};

// Helper function for cyberpunk confidence visualization
function getCyberBoxStyle(confidence: number) {
    const c = Math.min(Math.max(confidence, 0), 1);
    
    if (c > 0.8) return { color: CYBER_COLORS.success, opacity: 0.9 };
    if (c > 0.6) return { color: CYBER_COLORS.primary, opacity: 0.8 };
    if (c > 0.4) return { color: CYBER_COLORS.accent, opacity: 0.7 };
    if (c > 0.2) return { color: CYBER_COLORS.warning, opacity: 0.6 };
    return { color: CYBER_COLORS.danger, opacity: 0.5 };
}

// Helper function to crop detected objects from images
async function cropDetectionImage(
    imageUri: string, 
    frame: { origin: { x: number; y: number }; size: { x: number; y: number } }
): Promise<string> {
    try {
        const { origin, size } = frame;
        
        // Validate coordinates are reasonable
        if (origin.x < 0 || origin.y < 0 || size.x <= 0 || size.y <= 0) {
            throw new Error(`Invalid crop coordinates: origin(${origin.x}, ${origin.y}) size(${size.x}, ${size.y})`);
        }
        
        // Detect if coordinates are normalized (0-1) or pixel coordinates
        const isNormalized = origin.x <= 1 && origin.y <= 1 && size.x <= 1 && size.y <= 1;
        
        let cropX, cropY, cropWidth, cropHeight;
        
        if (isNormalized) {
            // Coordinates are normalized (0-1), need to get image dimensions
            // For this case, we'll use a reasonable assumption about image size
            // Camera typically captures at device screen resolution or higher
            const imageWidth = 1080; // Assume typical camera resolution width
            const imageHeight = 1920; // Assume typical camera resolution height
            
            cropX = Math.round(origin.x * imageWidth);
            cropY = Math.round(origin.y * imageHeight);
            cropWidth = Math.round(size.x * imageWidth);
            cropHeight = Math.round(size.y * imageHeight);
            
            console.log(`[ImageML] Normalized coordinates detected, scaling to pixels:`, {
                normalized: { origin, size },
                pixels: { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
            });
        } else {
            // Coordinates are already in pixels
            cropX = Math.round(origin.x);
            cropY = Math.round(origin.y);
            cropWidth = Math.round(size.x);
            cropHeight = Math.round(size.y);
            
            console.log(`[ImageML] Pixel coordinates detected:`, {
                pixels: { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
            });
        }
        
        // Ensure minimum crop size for classification
        cropWidth = Math.max(cropWidth, 50);
        cropHeight = Math.max(cropHeight, 50);
        
        const cropAction = {
            crop: {
                originX: cropX,
                originY: cropY,
                width: cropWidth,
                height: cropHeight
            }
        };
        
        const result = await ImageManipulator.manipulateAsync(
            imageUri,
            [cropAction],
            { 
                compress: 0.8, 
                format: ImageManipulator.SaveFormat.JPEG 
            }
        );
        
        console.log(`[ImageML] ✅ Crop successful:`, {
            outputUri: result.uri,
            outputDimensions: { width: result.width, height: result.height },
            cropRegion: cropAction.crop
        });
        return result.uri;
    } catch (error) {
        console.error('[ImageML] Crop failed:', error);
        throw error;
    }
}

// Helper function to save high-confidence detection screenshots
async function saveHighConfidenceScreenshot(
    originalImageUri: string,
    croppedImageUri: string,
    detection: Detection,
    detectionIndex: number,
    onSaveSuccess?: () => void
): Promise<void> {
    try {
        const bestLabel = detection.labels[0];
        if (!bestLabel || bestLabel.confidence < Config.camera.confidenceThreshold) {
            return; // Below threshold, don't save
        }

        console.log(`[Screenshot] High confidence detection found: ${bestLabel.text} (${Math.round(bestLabel.confidence * 100)}%)`);

        // Generate descriptive filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeLabel = bestLabel.text.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const confidenceStr = Math.round(bestLabel.confidence * 100).toString().padStart(3, '0');
        
        // Save both original and cropped versions
        const galleryDir = await ensureGalleryDirectory();
        
        // Save original full screenshot
        const originalFilename = `detection_full_${safeLabel}_conf${confidenceStr}_${timestamp}_${Date.now()}.jpg`;
        const originalDestPath = `${galleryDir}${originalFilename}`;
        const originalSavedUri = await copyFileWithProperUri(originalImageUri, originalDestPath);
        
        // Save cropped object image
        const croppedFilename = `detection_crop_${safeLabel}_conf${confidenceStr}_${timestamp}_${Date.now()}_crop.jpg`;
        const croppedDestPath = `${galleryDir}${croppedFilename}`;
        const croppedSavedUri = await copyFileWithProperUri(croppedImageUri, croppedDestPath);
        
        console.log(`[Screenshot] Saved high-confidence detection:`, {
            label: bestLabel.text,
            confidence: bestLabel.confidence,
            originalImage: originalSavedUri,
            croppedImage: croppedSavedUri
        });

        // Optional: Add haptic feedback for successful save
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Notify parent component of successful save
        if (onSaveSuccess) {
            onSaveSuccess();
        }
        
    } catch (error) {
        console.error('[Screenshot] Failed to save high-confidence detection:', error);
    }
}

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

    // Request permissions
    useEffect(() => {
        if (!hasPermission && !permissionRequested) {
            setPermissionRequested(true);
            requestPermission();
        }
    }, [hasPermission, permissionRequested, requestPermission]);

    useEffect(() => {
        const requestAudioPermission = async () => {
            if (!hasAudioPermission && !audioPermissionRequested) {
                setAudioPermissionRequested(true);
                try {
                    const { status } = await Audio.requestPermissionsAsync();
                    setHasAudioPermission(status === 'granted');
                    console.log('[AudioML] Permission status:', status);
                    if (status === 'granted') {
                        console.log('[AudioML] ✅ Audio permission granted - ML will initialize');
                    } else {
                        console.log('[AudioML] ❌ Audio permission denied - ML disabled');
                    }
                } catch (error) {
                    console.error('Audio permission request failed:', error);
                    setHasAudioPermission(false);
                }
            }
        };
        requestAudioPermission();
    }, [hasAudioPermission, audioPermissionRequested]);

    useEffect(() => {
        const requestLocationPermission = async () => {
            if (!hasLocationPermission && !locationPermissionRequested) {
                setLocationPermissionRequested(true);
                try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    setHasLocationPermission(status === 'granted');
                } catch (error) {
                    console.error('Location permission request failed:', error);
                    setHasLocationPermission(false);
                }
            }
        };
        requestLocationPermission();
    }, [hasLocationPermission, locationPermissionRequested]);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading || !device || !hasPermission) {
        return (
            <View style={styles.cyberLoading}>
                <StatusBar barStyle="light-content" backgroundColor={CYBER_COLORS.background} />
                <View style={styles.cyberLoadingContainer}>
                    <ActivityIndicator size="large" color={CYBER_COLORS.primary} />
                    <ThemedText style={styles.cyberLoadingText}>
                        Initializing Neural Networks...
                    </ThemedText>
                    <View style={styles.cyberLoadingBar}>
                        <View style={styles.cyberLoadingBarFill} />
                    </View>
                </View>
            </View>
        );
    }

    return (
        <ObjectIdentCamera 
            hasAudioPermission={hasAudioPermission}
            hasLocationPermission={hasLocationPermission}
        />
    );
}

interface ObjectIdentCameraProps {
    hasAudioPermission: boolean;
    hasLocationPermission: boolean;
}

function ObjectIdentCamera({ hasAudioPermission, hasLocationPermission }: ObjectIdentCameraProps) {
    const device = useCameraDevice('back');
    const { t } = useTranslation();

    // Core state
    const cameraRef = useRef<Camera>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [flash, setFlash] = useState<'off' | 'on'>('off');
    
    // ML state
    const [detections, setDetections] = useState<Detection[]>([]);
    const [audioResults, setAudioResults] = useState<AudioPrediction[]>([]);
    const [imageMLReady, setImageMLReady] = useState(false);
    const [audioMLReady, setAudioMLReady] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [recentSaves, setRecentSaves] = useState<number>(0); // Count of recent screenshot saves

    // Focus and app state
    const isFocused = useIsFocused();
    const [appState, setAppState] = useState(AppState.currentState);
    
    // Subtle animated values for cyberpunk effects
    const pulseAnimation = useSharedValue(0);
    
    useEffect(() => {
        // Gentle pulse for status indicators only
        pulseAnimation.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true);
    }, []);
    
    useEffect(() => {
        const subscription = AppState.addEventListener('change', setAppState);
        return () => subscription?.remove();
    }, []);
    
    const isCameraActive = isFocused && appState === 'active';

    // MLKit setup
    const detector = useObjectDetection<MyModelsConfig>('efficientNetlite0int8');
    const classifier = useImageLabeling("birdClassifier");
    
    const isClassifierReady = useMemo(() => {
        return !!(classifier && typeof classifier.classifyImage === 'function');
    }, [classifier]);

    const classifyImage = async (imageUri: string) => {
        try {
            console.log('[ImageML] Classifying image:', imageUri);
            const result = await classifier?.classifyImage(imageUri);
            console.log('[ImageML] Raw classification result type:', typeof result);
            
            let parsedResult;
            if (typeof result === 'string') {
                console.log('[ImageML] Parsing string result...');
                const parsed = JSON.parse(result);
                parsedResult = Array.isArray(parsed) ? parsed : [];
            } else {
                parsedResult = result ?? [];
            }
            
            console.log('[ImageML] Parsed classification result:', {
                isArray: Array.isArray(parsedResult),
                length: parsedResult.length,
                sample: parsedResult[0] || 'No results'
            });
            
            return parsedResult;
        } catch (error) {
            console.error("[ImageML] Classification failed:", error);
            return [];
        }
    };

    // Initialize ML systems independently (only once)
    useEffect(() => {
        let isMounted = true;
        
        // Prevent re-initialization if already ready
        if (imageMLReady && audioMLReady) {
            return;
        }
        
        // Initialize Image ML
        const initImageML = async () => {
            if (imageMLReady) return;
            try {
                if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
                    UIManager.setLayoutAnimationEnabledExperimental(true);
                }
                setImageMLReady(true);
                console.log('[ImageML] ✅ Ready');
            } catch (error) {
                console.error('[ImageML] ❌ Failed:', error);
            }
        };
        
        // Initialize Audio ML
        const initAudioML = async () => {
            if (audioMLReady) return;
            try {
                if (!hasAudioPermission) {
                    console.log('[AudioML] ⚠️ No audio permission - audio ML disabled');
                    return;
                }
                
                const initialized = await initUltraSimple();
                if (initialized && isMounted) {
                    setAudioMLReady(true);
                    console.log('[AudioML] ✅ Ready');
                }
            } catch (error) {
                console.error('[AudioML] ❌ Failed:', error);
            }
        };

        if (!imageMLReady) initImageML().catch(console.error);
        if (!audioMLReady && hasAudioPermission) initAudioML().catch(console.error);
        
        return () => { isMounted = false; };
    }, [hasAudioPermission, imageMLReady, audioMLReady]);

    // Image ML loop
    useEffect(() => {
        if (!isInitialized || !cameraRef.current || !detector || !isClassifierReady || !imageMLReady || !isCameraActive) {
            return;
        }

        let isActive = true;
        
        const detectionLoop = async () => {
            if (!isActive) return;
            
            try {
                setIsProcessing(true);
                
                // Capture photo with error isolation
                let photoResult;
                try {
                    photoResult = await capturePhoto(cameraRef, { manual: false, quality: 0.3 });
                    if (!photoResult.success || !photoResult.uri) {
                        console.warn('[ImageML] Photo capture failed:', photoResult.error || 'No URI returned');
                        return;
                    }
                } catch (captureError) {
                    console.error('[ImageML] Photo capture error:', captureError);
                    return;
                }

                // Detect objects with error isolation
                let objects = [];
                try {
                    console.log('[ImageML] 🔍 Step 1: Starting object detection...');
                    objects = await detector.detectObjects(photoResult.uri);
                    console.log(`[ImageML] ✅ Step 1 Complete: Detected ${objects.length} objects`);
                    
                    // Log detailed frame data for debugging
                    objects.forEach((obj, idx) => {
                        console.log(`[ImageML] Object ${idx + 1} frame:`, {
                            origin: obj.frame?.origin,
                            size: obj.frame?.size,
                            hasLabels: !!obj.labels,
                            labelCount: obj.labels?.length || 0
                        });
                    });
                } catch (detectionError) {
                    console.error('[ImageML] ❌ Object detection error:', detectionError);
                    return; // Skip this cycle if detection fails
                }
                
                // Process detections with individual error isolation and proper cropping
                const enrichedDetections: Detection[] = [];
                for (const [index, obj] of objects.entries()) {
                    try {
                        // Validate detection frame
                        if (!obj.frame || !obj.frame.origin || !obj.frame.size) {
                            console.warn(`[ImageML] Invalid detection frame for object ${index + 1}`);
                            continue;
                        }
                        
                        // Crop the detected object and classify the cropped image
                        let labels = [];
                        let croppedUri = '';
                        try {
                            console.log(`[ImageML] 📐 Step 2.${index + 1}: Cropping object ${index + 1}...`);
                            croppedUri = await cropDetectionImage(photoResult.uri, obj.frame);
                            console.log(`[ImageML] ✅ Step 2.${index + 1} Complete: Cropped successfully`);
                            
                            console.log(`[ImageML] 🧠 Step 3.${index + 1}: Classifying cropped image...`);
                            labels = await classifyImage(croppedUri);
                            console.log(`[ImageML] ✅ Step 3.${index + 1} Complete: Got ${labels.length} labels`);
                            
                            if (labels.length > 0) {
                                console.log(`[ImageML] Top classifications for object ${index + 1}:`, 
                                    labels.slice(0, 3).map(l => `${l.text} (${Math.round(l.confidence * 100)}%)`).join(', ')
                                );
                            }
                        } catch (cropError) {
                            console.warn(`[ImageML] ⚠️ Cropping failed for object ${index + 1}, using full image:`, cropError instanceof Error ? cropError.message : 'Unknown error');
                            // Fallback to full image classification
                            labels = await classifyImage(photoResult.uri);
                            croppedUri = photoResult.uri; // Use original if crop failed
                        }
                        
                        const detection: Detection = {
                            frame: obj.frame,
                            labels: labels.slice(0, 2) // Top 2 labels
                        };
                        
                        // Check if we should save this high-confidence detection
                        if (labels.length > 0 && croppedUri) {
                            try {
                                await saveHighConfidenceScreenshot(
                                    photoResult.uri, 
                                    croppedUri, 
                                    detection, 
                                    index,
                                    () => {
                                        // Increment save counter for UI feedback
                                        setRecentSaves(prev => prev + 1);
                                        // Reset counter after 3 seconds
                                        setTimeout(() => setRecentSaves(prev => Math.max(0, prev - 1)), 3000);
                                    }
                                );
                            } catch (screenshotError) {
                                console.warn(`[Screenshot] Failed to save screenshot for object ${index + 1}:`, screenshotError);
                                // Don't fail the pipeline for screenshot errors
                            }
                        }
                        
                        enrichedDetections.push(detection);
                    } catch (classificationError) {
                        console.warn(`[ImageML] Classification failed for object ${index + 1}:`, classificationError instanceof Error ? classificationError.message : 'Unknown error');
                        // Add detection with empty labels instead of skipping
                        enrichedDetections.push({
                            frame: obj.frame,
                            labels: []
                        });
                    }
                }

                console.log(`[ImageML] 📊 Step 4: Setting ${enrichedDetections.length} detections for rendering`);
                setDetections(enrichedDetections);
                
                // Log final detection data for SVG rendering debug
                if (enrichedDetections.length > 0) {
                    console.log('[ImageML] 🎯 Final detections for SVG:', enrichedDetections.map((d, i) => ({
                        index: i,
                        frame: d.frame,
                        topLabel: d.labels[0] ? `${d.labels[0].text} (${Math.round(d.labels[0].confidence * 100)}%)` : 'No labels'
                    })));
                }
                
            } catch (error) {
                console.error('[ImageML] ❌ Detection pipeline error:', error);
                // Clear detections on major error to avoid stale data
                setDetections([]);
            } finally {
                setIsProcessing(false);
            }

            // Continue loop
            if (isActive) {
                setTimeout(detectionLoop, Config.camera.pipelineDelay * 1000);
            }
        };

        const timer = setTimeout(detectionLoop, 1000);
        return () => {
            isActive = false;
            clearTimeout(timer);
        };
    }, [isInitialized, detector, isClassifierReady, imageMLReady, isCameraActive]);

    // Audio ML loop with proper recording management
    useEffect(() => {
        if (!audioMLReady || !isCameraActive) return;

        let isActive = true;
        let isRecording = false;
        let currentRecording: Audio.Recording | null = null;
        
        const audioLoop = async () => {
            if (!isActive || isRecording) return;
            
            try {
                isRecording = true;
                console.log('[AudioML] Starting new audio recording...');
                
                // Create and prepare recording with error isolation
                let recordingUri;
                
                try {
                    // Clean up any existing recording first
                    if (currentRecording) {
                        try {
                            await currentRecording.stopAndUnloadAsync();
                        } catch (cleanupError) {
                            console.warn('[AudioML] Failed to cleanup previous recording:', cleanupError);
                        }
                        currentRecording = null;
                    }
                    
                    currentRecording = new Audio.Recording();
                    
                    await currentRecording.prepareToRecordAsync({
                        android: {
                            extension: '.wav',
                            outputFormat: Audio.AndroidOutputFormat.DEFAULT,
                            audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
                            sampleRate: 48000, // Use BirdNET target sample rate
                            numberOfChannels: 1,
                            bitRate: 128000, // Higher quality
                        },
                        ios: {
                            extension: '.wav',
                            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
                            audioQuality: Audio.IOSAudioQuality.HIGH,
                            sampleRate: 48000, // Match BirdNET target
                            numberOfChannels: 1,
                            bitRate: 128000,
                            linearPCMBitDepth: 16, // Standard 16-bit depth
                            linearPCMIsBigEndian: false,
                            linearPCMIsFloat: false,
                        },
                        web: {
                            mimeType: 'audio/wav',
                            bitsPerSecond: 128000,
                        }
                    });
                } catch (prepareError) {
                    console.error('[AudioML] Recording preparation failed:', prepareError);
                    return; // Skip this cycle if preparation fails
                }
                
                // Record audio with error isolation
                try {
                    await currentRecording.startAsync();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    await currentRecording.stopAndUnloadAsync();
                    recordingUri = currentRecording.getURI();
                } catch (recordError) {
                    console.error('[AudioML] Recording process failed:', recordError);
                    try {
                        if (currentRecording) {
                            await currentRecording.stopAndUnloadAsync();
                        }
                    } catch (stopError) {
                        console.warn('[AudioML] Failed to stop recording after error:', stopError);
                    }
                    currentRecording = null;
                    return; // Skip processing if recording fails
                }
                
                // Process audio with error isolation
                if (recordingUri && isActive) {
                    console.log('[AudioML] Processing audio:', recordingUri);
                    try {
                        const location = hasLocationPermission ? { latitude: 0, longitude: 0 } : undefined;
                        const predictions = await classifyWithUltraSimple(recordingUri, location);
                        
                        if (isActive) {
                            if (predictions && Array.isArray(predictions) && predictions.length > 0) {
                                // Pipeline-compatible function already returns correct format
                                setAudioResults(predictions.slice(0, 3));
                                console.log(`[AudioML] ✅ Classification successful: ${predictions.length} predictions`);
                                console.log(`[AudioML] Top result: ${predictions[0].common_name} (${Math.round(predictions[0].confidence * 100)}%)`);
                            } else {
                                console.warn('[AudioML] Classification returned no valid results');
                                setAudioResults([]);
                            }
                        }
                    } catch (classifyError) {
                        console.error('[AudioML] Classification error:', classifyError);
                        // Don't clear previous results on classification error - just log and continue
                    }
                } else {
                    console.warn('[AudioML] No recording URI available or context inactive');
                }
                
            } catch (error) {
                console.error('[AudioML] Audio pipeline error:', error);
                // Clear audio results on major pipeline error
                if (isActive) {
                    setAudioResults([]);
                }
            } finally {
                isRecording = false;
                // Clean up current recording
                if (currentRecording) {
                    try {
                        await currentRecording.stopAndUnloadAsync();
                    } catch (cleanupError) {
                        console.warn('[AudioML] Final cleanup failed:', cleanupError);
                    }
                    currentRecording = null;
                }
            }

            // Continue loop with longer delay
            if (isActive) {
                setTimeout(audioLoop, 10000); // Every 10 seconds to avoid conflicts
            }
        };

        const timer = setTimeout(audioLoop, 5000); // Start after 5 seconds
        return () => {
            isActive = false;
            clearTimeout(timer);
            // Cleanup on unmount
            if (currentRecording) {
                currentRecording.stopAndUnloadAsync().catch(console.warn);
                currentRecording = null;
            }
        };
    }, [audioMLReady, hasLocationPermission, isCameraActive]);

    // Subtle animated styles for cyberpunk effects
    const statusPulseStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulseAnimation.value, [0, 1], [0.7, 1]),
    }));

    const processingIndicatorStyle = useAnimatedStyle(() => ({
        opacity: isProcessing ? withTiming(1, { duration: 200 }) : withTiming(0.5, { duration: 200 }),
    }));

    // Log current detections for debugging
    useEffect(() => {
        if (detections.length > 0) {
            console.log(`[Render] Current detections state: ${detections.length} items`);
        }
    }, [detections]);

    return (
        <View style={styles.cyberContainer}>
            <StatusBar barStyle="light-content" backgroundColor={CYBER_COLORS.background} />
            
            <Camera
                ref={cameraRef}
                style={styles.camera}
                device={device!}
                isActive={isCameraActive}
                onInitialized={() => setIsInitialized(true)}
                zoom={zoom}
                torch={flash}
                photo={true}
            />

            {/* Dark overlay for better contrast */}
            <View style={styles.cyberOverlay} />

            {/* Detection Overlays with Cyberpunk Styling */}
            <View pointerEvents="none" style={styles.overlay}>
                <Svg style={{ width: '100%', height: '100%' }} viewBox={`0 0 ${W} ${H}`}>
                    {detections.map((detection, index) => {
                        const { origin, size } = detection.frame;
                        const bestLabel = detection.labels[0];
                        if (!bestLabel) return null;
                        
                        const { color, opacity } = getCyberBoxStyle(bestLabel.confidence);
                        
                        // Calculate scale factors (assuming ML model output is normalized 0-1)
                        // MLKit typically provides normalized coordinates, so scale to screen dimensions
                        const scaleX = W;
                        const scaleY = H;
                        
                        // Scale coordinates to screen dimensions
                        const x = origin.x * scaleX;
                        const y = origin.y * scaleY;
                        const width = size.x * scaleX;
                        const height = size.y * scaleY;
                        
                        // Log SVG rendering coordinates for debugging
                        if (index === 0) { // Only log first detection to avoid spam
                            console.log(`[SVG] Rendering detection ${index + 1}:`, {
                                screenDimensions: { W, H },
                                originalFrame: { origin, size },
                                scaledCoords: { x, y, width, height },
                                label: bestLabel.text,
                                confidence: Math.round(bestLabel.confidence * 100)
                            });
                        }
                        
                        const labelText = `${bestLabel.text} ${Math.round(bestLabel.confidence * 100)}%`;
                        
                        return (
                            <React.Fragment key={`detection-${index}`}>
                                {/* Main detection box */}
                                <Rect
                                    x={x}
                                    y={y}
                                    width={width}
                                    height={height}
                                    stroke={color}
                                    strokeWidth="3"
                                    fill="none"
                                    strokeOpacity={opacity}
                                    rx="8"
                                    ry="8"
                                />
                                
                                {/* Corner brackets for cyberpunk effect */}
                                <Rect x={x} y={y} width="16" height="3" fill={color} fillOpacity={opacity} />
                                <Rect x={x} y={y} width="3" height="16" fill={color} fillOpacity={opacity} />
                                <Rect x={x + width - 16} y={y} width="16" height="3" fill={color} fillOpacity={opacity} />
                                <Rect x={x + width - 3} y={y} width="3" height="16" fill={color} fillOpacity={opacity} />
                                <Rect x={x} y={y + height - 3} width="16" height="3" fill={color} fillOpacity={opacity} />
                                <Rect x={x} y={y + height - 16} width="3" height="16" fill={color} fillOpacity={opacity} />
                                <Rect x={x + width - 16} y={y + height - 3} width="16" height="3" fill={color} fillOpacity={opacity} />
                                <Rect x={x + width - 3} y={y + height - 16} width="3" height="16" fill={color} fillOpacity={opacity} />
                                
                                {/* Label background */}
                                <Rect
                                    x={x}
                                    y={Math.max(y - 28, 4)}
                                    width={labelText.length * 8 + 16}
                                    height="24"
                                    rx="12"
                                    fill={color}
                                    fillOpacity="0.9"
                                />
                                
                                {/* Label text */}
                                <SvgText
                                    x={x + 8}
                                    y={Math.max(y - 8, 18)}
                                    fontSize="13"
                                    fill="white"
                                    fontWeight="600"
                                    fontFamily="system-ui"
                                >
                                    {labelText}
                                </SvgText>
                            </React.Fragment>
                        );
                    })}
                </Svg>
            </View>

            {/* Cyberpunk HUD - Top Panel */}
            <Animated.View style={[styles.cyberHUD, statusPulseStyle]}>
                <View style={styles.cyberPanel}>
                    <View style={styles.cyberPanelHeader}>
                        <ThemedText style={styles.cyberTitle}>NEURAL VISION SYSTEM</ThemedText>
                        <Animated.View style={[styles.cyberStatusIndicators, processingIndicatorStyle]}>
                            <View style={[styles.cyberStatusDot, { 
                                backgroundColor: imageMLReady ? CYBER_COLORS.success : CYBER_COLORS.warning 
                            }]} />
                            <ThemedText style={styles.cyberStatusText}>IMG</ThemedText>
                            <View style={[styles.cyberStatusDot, { 
                                backgroundColor: audioMLReady ? CYBER_COLORS.success : CYBER_COLORS.warning 
                            }]} />
                            <ThemedText style={styles.cyberStatusText}>AUD</ThemedText>
                            {recentSaves > 0 && (
                                <>
                                    <View style={[styles.cyberStatusDot, { 
                                        backgroundColor: CYBER_COLORS.accent 
                                    }]} />
                                    <ThemedText style={styles.cyberStatusText}>SAVE ({recentSaves})</ThemedText>
                                </>
                            )}
                        </Animated.View>
                    </View>
                    
                    {/* Results Display */}
                    <View style={styles.cyberResultsContainer}>
                        {/* Visual Analysis Panel */}
                        <View style={styles.cyberDetectionPanel}>
                            <View style={styles.cyberSectionHeader}>
                                <ThemedText style={styles.cyberSectionTitle}>VISUAL</ThemedText>
                                <View style={styles.cyberBadge}>
                                    <ThemedText style={styles.cyberBadgeText}>{detections.length}</ThemedText>
                                </View>
                            </View>
                            {detections.length > 0 && (
                                <View style={styles.cyberDetectionList}>
                                    {detections.slice(0, 2).map((detection, index) => {
                                        const bestLabel = detection.labels[0];
                                        if (!bestLabel) return null;
                                        return (
                                            <View key={index} style={styles.cyberDetectionItem}>
                                                <ThemedText style={styles.cyberDetectionName}>
                                                    {bestLabel.text}
                                                </ThemedText>
                                                <View style={[styles.cyberConfidenceBar, { 
                                                    backgroundColor: getCyberBoxStyle(bestLabel.confidence).color + '40' 
                                                }]}>
                                                    <View style={[styles.cyberConfidenceFill, { 
                                                        width: `${bestLabel.confidence * 100}%`,
                                                        backgroundColor: getCyberBoxStyle(bestLabel.confidence).color
                                                    }]} />
                                                    <ThemedText style={styles.cyberConfidenceText}>
                                                        {Math.round(bestLabel.confidence * 100)}%
                                                    </ThemedText>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                        
                        {/* Audio Analysis Panel */}
                        <View style={styles.cyberAudioPanel}>
                            <View style={styles.cyberSectionHeader}>
                                <ThemedText style={styles.cyberSectionTitle}>AUDIO</ThemedText>
                                <View style={styles.cyberBadge}>
                                    <ThemedText style={styles.cyberBadgeText}>{audioResults.length}</ThemedText>
                                </View>
                            </View>
                            {audioResults.length > 0 ? (
                                <View style={styles.cyberAudioResults}>
                                    {audioResults.slice(0, 2).map((result, index) => (
                                        <View key={index} style={styles.cyberAudioItem}>
                                            <ThemedText style={styles.cyberAudioName}>
                                                {result.common_name}
                                            </ThemedText>
                                            <View style={styles.cyberConfidenceBar}>
                                                <View style={[styles.cyberConfidenceFill, { 
                                                    width: `${result.confidence * 100}%`,
                                                    backgroundColor: CYBER_COLORS.primary
                                                }]} />
                                                <ThemedText style={styles.cyberConfidenceText}>
                                                    {Math.round(result.confidence * 100)}%
                                                </ThemedText>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <ThemedText style={styles.cyberStatusText}>
                                    {audioMLReady ? 'Listening...' : 'Offline'}
                                </ThemedText>
                            )}
                        </View>
                    </View>
                </View>
            </Animated.View>

            {/* Cyberpunk Control Panel - Bottom */}
            <View style={styles.cyberControlPanel}>
                <View style={styles.cyberControlsContainer}>
                    {/* Zoom Control with Cyberpunk Styling */}
                    <View style={styles.cyberZoomContainer}>
                        <ThemedText style={styles.cyberControlLabel}>ZOOM</ThemedText>
                        <View style={styles.cyberSliderContainer}>
                            <Slider
                                style={styles.cyberSlider}
                                minimumValue={1}
                                maximumValue={5}
                                value={zoom}
                                onValueChange={setZoom}
                                thumbTintColor={CYBER_COLORS.primary}
                                minimumTrackTintColor={CYBER_COLORS.primary}
                                maximumTrackTintColor={CYBER_COLORS.border}
                            />
                            <View style={styles.cyberZoomDisplay}>
                                <ThemedText style={styles.cyberZoomValue}>
                                    {zoom.toFixed(1)}X
                                </ThemedText>
                            </View>
                        </View>
                    </View>

                    {/* Flash Toggle with Cyberpunk Styling */}
                    <ThemedPressable
                        style={[styles.cyberFlashButton, { 
                            backgroundColor: flash === 'on' ? CYBER_COLORS.warning + '20' : CYBER_COLORS.surface,
                            borderColor: flash === 'on' ? CYBER_COLORS.warning : CYBER_COLORS.border
                        }]}
                        onPress={() => {
                            setFlash(flash === 'off' ? 'on' : 'off');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                    >
                        <ThemedIcon 
                            name={flash === 'on' ? 'zap' : 'zap-off'} 
                            size={18}
                            color={flash === 'on' ? 'accent' : 'primary'}
                        />
                        <ThemedText style={[styles.cyberButtonText, { 
                            color: flash === 'on' ? CYBER_COLORS.warning : CYBER_COLORS.text 
                        }]}>
                            FLASH
                        </ThemedText>
                    </ThemedPressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Loading Screen
    cyberLoading: {
        flex: 1,
        backgroundColor: CYBER_COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cyberLoadingContainer: {
        alignItems: 'center',
        padding: 40,
    },
    cyberLoadingText: {
        color: CYBER_COLORS.text,
        fontSize: 16,
        fontWeight: '500',
        marginTop: 20,
        letterSpacing: 0.5,
    },
    cyberLoadingBar: {
        width: 200,
        height: 3,
        backgroundColor: CYBER_COLORS.surface,
        marginTop: 20,
        borderRadius: 2,
        overflow: 'hidden',
    },
    cyberLoadingBarFill: {
        height: '100%',
        width: '70%',
        backgroundColor: CYBER_COLORS.primary,
    },

    // Main Container
    cyberContainer: {
        flex: 1,
        backgroundColor: CYBER_COLORS.background,
    },
    camera: {
        flex: 1,
    },

    // Cyberpunk Effects
    cyberOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: CYBER_COLORS.overlay,
        opacity: 0.2,
        zIndex: 5,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 8,
    },

    // HUD and Panels
    cyberHUD: {
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        zIndex: 15,
    },
    cyberPanel: {
        backgroundColor: CYBER_COLORS.surfaceElevated,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: CYBER_COLORS.border,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    cyberPanelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: CYBER_COLORS.border,
    },
    cyberTitle: {
        color: CYBER_COLORS.text,
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    cyberStatusIndicators: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cyberStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    cyberStatusText: {
        color: CYBER_COLORS.textMuted,
        fontSize: 11,
        fontWeight: '500',
        marginLeft: 4,
    },

    // Results Display
    cyberResultsContainer: {
        flexDirection: 'row',
        gap: 16,
    },
    cyberDetectionPanel: {
        flex: 1,
    },
    cyberAudioPanel: {
        flex: 1,
    },
    cyberSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cyberSectionTitle: {
        color: CYBER_COLORS.primary,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    cyberBadge: {
        backgroundColor: CYBER_COLORS.primary + '20',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: CYBER_COLORS.primary + '40',
    },
    cyberBadgeText: {
        color: CYBER_COLORS.primary,
        fontSize: 10,
        fontWeight: '600',
    },
    cyberDetectionList: {
        gap: 8,
    },
    cyberDetectionItem: {
        gap: 4,
    },
    cyberDetectionName: {
        color: CYBER_COLORS.text,
        fontSize: 12,
        fontWeight: '500',
    },
    cyberConfidenceBar: {
        height: 4,
        backgroundColor: CYBER_COLORS.surface,
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
    },
    cyberConfidenceFill: {
        height: '100%',
        borderRadius: 2,
    },
    cyberConfidenceText: {
        position: 'absolute',
        right: 4,
        top: -16,
        color: CYBER_COLORS.textMuted,
        fontSize: 9,
        fontWeight: '500',
    },
    cyberAudioResults: {
        gap: 8,
    },
    cyberAudioItem: {
        gap: 4,
    },
    cyberAudioName: {
        color: CYBER_COLORS.text,
        fontSize: 12,
        fontWeight: '500',
    },

    // Control Panel
    cyberControlPanel: {
        position: 'absolute',
        bottom: 40,
        left: 16,
        right: 16,
        zIndex: 15,
    },
    cyberControlsContainer: {
        backgroundColor: CYBER_COLORS.surfaceElevated,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: CYBER_COLORS.border,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    cyberZoomContainer: {
        flex: 1,
    },
    cyberControlLabel: {
        color: CYBER_COLORS.textMuted,
        fontSize: 11,
        fontWeight: '500',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    cyberSliderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cyberSlider: {
        flex: 1,
        height: 30,
    },
    cyberZoomDisplay: {
        backgroundColor: CYBER_COLORS.surface,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: CYBER_COLORS.border,
    },
    cyberZoomValue: {
        color: CYBER_COLORS.text,
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        minWidth: 30,
    },
    cyberFlashButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        gap: 8,
    },
    cyberButtonText: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});