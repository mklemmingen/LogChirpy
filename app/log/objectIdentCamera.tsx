/**
 * ObjectIdentCamera - Clean Implementation with Unified ML Pipeline
 * 
 * Features:
 * - Unified ML Pipeline integration
 * - Real-time object detection with SVG overlays
 * - Audio bird classification
 * - Cyberpunk-themed UI
 * - Camera controls (zoom, flash)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    View,
    StatusBar,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useObjectDetection } from '@infinitered/react-native-mlkit-object-detection';
import { useImageLabeling } from "@infinitered/react-native-mlkit-image-labeling";

import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { ThemedText } from "@/components/ThemedText";
import { ThemedPressable } from "@/components/ThemedPressable";
import { ThemedIcon } from "@/components/ThemedIcon";

import { 
    createUnifiedPipeline,
    type UnifiedMLPipelineService,
    type Detection,
    type AudioPrediction,
    type PipelineState
} from '@/services/unifiedMLPipelineService';

const { width: W, height: H } = Dimensions.get('window');

// Cyberpunk Color Palette
const CYBER_COLORS = {
    primary: '#00D4FF',      // Electric blue
    secondary: '#1E1B3C',    // Deep purple
    accent: '#10B981',       // Emerald green
    warning: '#F59E0B',      // Amber
    danger: '#EF4444',       // Red
    success: '#22C55E',      // Green
    text: '#F8FAFC',         // Near white
    textMuted: '#94A3B8',    // Slate 400
    background: '#0F0F23',   // Very dark blue
    surface: '#1E1B3C80',    // Semi-transparent surface
    border: '#374151',       // Gray border
    overlay: '#000000CC',    // Semi-transparent black
};

// Confidence color coding for detection boxes (old style)
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

// Cyber-themed version of getBoxStyle for modern UI
function getCyberBoxStyle(confidence: number) {
    const c = Math.min(Math.max(confidence, 0), 1);
    if (c > 0.8) return { color: CYBER_COLORS.success, opacity: 0.9 };
    if (c > 0.6) return { color: CYBER_COLORS.primary, opacity: 0.8 };
    if (c > 0.4) return { color: CYBER_COLORS.accent, opacity: 0.7 };
    if (c > 0.2) return { color: CYBER_COLORS.warning, opacity: 0.6 };
    return { color: CYBER_COLORS.danger, opacity: 0.5 };
}

// Permission Wrapper Component
export default function ObjectIdentCameraWrapper() {
    const [isLoading, setIsLoading] = useState(true);
    const [hasAudioPermission, setHasAudioPermission] = useState(false);
    const [hasLocationPermission, setHasLocationPermission] = useState(false);
    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();

    // Request camera permission
    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

    // Request audio permission
    useEffect(() => {
        const requestAudioPermission = async () => {
            try {
                const { status } = await Audio.requestPermissionsAsync();
                setHasAudioPermission(status === 'granted');
                console.log('[AudioML] Permission status:', status);
            } catch (error) {
                console.error('Audio permission request failed:', error);
                setHasAudioPermission(false);
            }
        };
        requestAudioPermission();
    }, []);

    // Request location permission
    useEffect(() => {
        const requestLocationPermission = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                setHasLocationPermission(status === 'granted');
            } catch (error) {
                console.error('Location permission request failed:', error);
                setHasLocationPermission(false);
            }
        };
        requestLocationPermission();
    }, []);

    // Loading delay
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading || !device || !hasPermission) {
        return (
            <View style={styles.loadingContainer}>
                <StatusBar barStyle="light-content" backgroundColor={CYBER_COLORS.background} />
                <ActivityIndicator size="large" color={CYBER_COLORS.primary} />
                <ThemedText style={styles.loadingText}>
                    Initializing Neural Networks...
                </ThemedText>
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

// Main Camera Component
interface ObjectIdentCameraProps {
    hasAudioPermission: boolean;
    hasLocationPermission: boolean;
}

function ObjectIdentCamera({ hasAudioPermission, hasLocationPermission }: ObjectIdentCameraProps) {
    const device = useCameraDevice('back');
    const { t } = useTranslation();
    const isFocused = useIsFocused();

    // Core refs
    const cameraRef = useRef<Camera>(null);
    const pipelineRef = useRef<UnifiedMLPipelineService | null>(null);

    // Camera state
    const [isInitialized, setIsInitialized] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [flash, setFlash] = useState<'off' | 'on'>('off');

    // ML results from unified pipeline
    const [detections, setDetections] = useState<Detection[]>([]);
    const [audioResults, setAudioResults] = useState<AudioPrediction[]>([]);
    const [pipelineState, setPipelineState] = useState<PipelineState>('idle');
    const [imageDims, setImageDims] = useState({ width: 0, height: 0 });

    // ML Kit hooks
    const detector = useObjectDetection('default');
    const classifier = useImageLabeling('birdClassifier');

    // Animation
    const pulseAnimation = useSharedValue(0);
    
    // Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [debugText, setDebugText] = useState('Initializing Neural Networks...');

    // Get current location for ML enhancement
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | undefined>();

    useEffect(() => {
        if (hasLocationPermission) {
            Location.getCurrentPositionAsync({})
                .then(pos => setLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                }))
                .catch(console.warn);
        }
    }, [hasLocationPermission]);

    // Start pulse animation
    useEffect(() => {
        pulseAnimation.value = withRepeat(
            withTiming(1, { duration: 2000 }),
            -1,
            true
        );
    }, []);

    // Camera active state
    const isCameraActive = isFocused && isInitialized;

    // Initialize unified pipeline
    useEffect(() => {
        console.log('[Debug] Pipeline check:', {
            isCameraActive,
            isFocused,
            isInitialized,
            hasDetector: !!detector,
            hasClassifier: !!classifier
        });
        
        if (!isCameraActive || !detector || !classifier) {
            console.log('[Debug] Pipeline not starting - missing dependencies');
            return;
        }

        // Prevent multiple rapid restarts
        if (pipelineRef.current) {
            console.log('[Debug] Pipeline already exists, skipping initialization');
            return;
        }

        console.log('[UnifiedPipeline] Initializing...');

        const pipeline = createUnifiedPipeline({
            cameraRef,
            detector,
            classifier,
            hasAudioPermission,
            hasLocationPermission,
            location
        });

        // Set up callbacks for UI updates
        pipeline.setCallbacks({
            // Image ML callbacks
            onImageDetections: (newDetections, imageDimensions) => {
                setDetections(newDetections);
                console.log(`[UI] Updated detections: ${newDetections.length} items`);
                
                // Set image dimensions for coordinate scaling
                if (imageDimensions) {
                    setImageDims(imageDimensions);
                    console.log(`[UI] Image dimensions set:`, imageDimensions);
                } else {
                    // Fallback to screen dimensions
                    setImageDims({ width: W, height: H });
                }
                
                // Log first detection details for debugging
                if (newDetections.length > 0) {
                    const firstDetection = newDetections[0];
                    console.log(`[SVG Debug] First detection:`, {
                        origin: firstDetection.frame.origin,
                        size: firstDetection.frame.size,
                        labels: firstDetection.labels[0]?.text,
                        confidence: firstDetection.labels[0]?.confidence
                    });
                    
                    if (imageDimensions) {
                        const scaleX = W / imageDimensions.width;
                        const scaleY = H / imageDimensions.height;
                        console.log(`[SVG Debug] Scaled coordinates:`, {
                            x: firstDetection.frame.origin.x * scaleX,
                            y: firstDetection.frame.origin.y * scaleY,
                            width: firstDetection.frame.size.x * scaleX,
                            height: firstDetection.frame.size.y * scaleY,
                            scale: { scaleX, scaleY },
                            imageDims: imageDimensions,
                            screenDims: { W, H }
                        });
                    }
                }
                
                setDebugText(
                    newDetections.length > 0
                        ? `Detection successful: ${newDetections.length} objects found`
                        : 'No objects detected'
                );
            },
            onImageProcessingStart: () => {
                setIsProcessing(true);
                setDebugText('Processing image...');
            },
            onImageProcessingEnd: () => {
                setIsProcessing(false);
            },
            onHighConfidenceSave: () => {
                // Haptic feedback for saved detections
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
            
            // Audio ML callbacks
            onAudioPredictions: (newPredictions) => {
                setAudioResults(newPredictions);
                console.log(`[UI] Updated audio results: ${newPredictions.length} items`);
                if (newPredictions.length > 0) {
                    const topResult = newPredictions[0];
                    setDebugText(`Audio: ${topResult.common_name} (${Math.round(topResult.confidence * 100)}%)`);
                }
            },
            onAudioProcessingStart: () => {
                setDebugText('Recording audio...');
            },
            onAudioProcessingEnd: () => {
                // Audio processing complete
            },
            
            // General callbacks
            onError: (phase, error) => {
                console.error(`[UnifiedPipeline] ${phase} error:`, error);
                if (phase === 'image') {
                    setDetections([]);
                } else if (phase === 'audio') {
                    setAudioResults([]);
                }
            },
            onStateChange: (state) => {
                setPipelineState(state);
                console.log(`[UnifiedPipeline] State: ${state}`);
                
                // Update debug text based on pipeline state
                switch (state) {
                    case 'capturing_image':
                        setDebugText('Capturing photo...');
                        break;
                    case 'detecting_objects':
                        setDebugText('Detecting objects...');
                        break;
                    case 'classifying_objects':
                        setDebugText('Classifying objects...');
                        break;
                    case 'recording_audio':
                        setDebugText('Recording audio...');
                        break;
                    case 'processing_audio':
                        setDebugText('Processing audio...');
                        break;
                    case 'waiting':
                        setDebugText('Neural networks active');
                        break;
                    case 'idle':
                        setDebugText('Neural networks offline');
                        break;
                }
            }
        });

        // Store pipeline reference and start
        pipelineRef.current = pipeline;
        pipeline.start();

        return () => {
            console.log('[UnifiedPipeline] Cleaning up...');
            pipelineRef.current?.cleanup();
            pipelineRef.current = null;
        };
    }, [isCameraActive, isFocused, isInitialized, detector, classifier, hasAudioPermission, hasLocationPermission, location]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={CYBER_COLORS.background} />
            
            {/* Camera View */}
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
            <View style={styles.overlay} />

            {/* Detection Overlays */}
            <View pointerEvents="none" style={styles.svgContainer}>
                <Svg style={styles.svg} viewBox={`0 0 ${W} ${H}`}>
                    {detections.map((item, index) => {
                        const { origin, size } = item.frame;
                        const labels = item.labels;
                        
                        if (!labels || labels.length === 0) {
                            console.log(`[SVG] No labels for detection ${index}`);
                            return null;
                        }
                        
                        const conf = labels[0]?.confidence ?? 0;
                        const { color, opacity } = getBoxStyle(conf);
                        
                        // Calculate scale for rendering detection bounding boxes (like old code)
                        const scaleX = imageDims.width ? W / imageDims.width : 1;
                        const scaleY = imageDims.height ? H / imageDims.height : 1;
                        
                        console.log(`[SVG] Detection ${index}:`, {
                            frame: { origin, size },
                            scale: { scaleX, scaleY },
                            imageDims,
                            screenDims: { W, H }
                        });

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
                                                fill={conf >= 0.7 ? 'limegreen' : 'crimson'}
                                            />
                                        </React.Fragment>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </Svg>
            </View>

            {/* Cyberpunk HUD */}
            <View style={styles.hud}>

                {/* Detection Results Panel */}
                <View style={styles.resultsPanel}>

                        <ThemedText style={styles.statusText}>
                            Status: {pipelineState.toUpperCase()} | Detections: {detections.length}
                        </ThemedText>
                        <ThemedText style={styles.debugText}>
                            {debugText}
                        </ThemedText>

                        <ThemedText style={styles.sectionTitle}>VISUAL ANALYSIS: </ThemedText>
                        {detections.slice(0, 2).map((detection, index) => {
                            const label = detection.labels[0];
                            if (!label) return null;
                            return (
                                <View key={index} style={styles.resultItem}>
                                    <ThemedText style={styles.resultText}>
                                        {label.text}
                                    </ThemedText>
                                    <View style={styles.confidenceBar}>
                                        <View
                                            style={[
                                                styles.confidenceFill,
                                                {
                                                    width: `${label.confidence * 100}%`,
                                                    backgroundColor: getCyberBoxStyle(label.confidence).color
                                                }
                                            ]}
                                        />
                                    </View>
                                </View>
                            );
                        })}



                        <ThemedText style={styles.sectionTitle}>AUDIO ANALYSIS: </ThemedText>
                        {audioResults.slice(0, 2).map((result, index) => (
                            <View key={index} style={styles.resultItem}>
                                <ThemedText style={styles.resultText}>
                                    {result.common_name}
                                </ThemedText>
                                <ThemedText style={styles.scientificText}>
                                    {result.scientific_name}
                                </ThemedText>
                                <View style={styles.confidenceBar}>
                                    <View
                                        style={[
                                            styles.confidenceFill,
                                            {
                                                width: `${result.confidence * 100}%`,
                                                backgroundColor: getCyberBoxStyle(result.confidence).color
                                            }
                                        ]}
                                    />
                                </View>
                            </View>
                        ))}

                </View>

                {/* Controls Panel */}
                <View style={styles.controlsPanel}>
                    {/* Zoom Control */}
                    <View style={styles.controlGroup}>
                        <ThemedText style={styles.controlLabel}>ZOOM</ThemedText>
                        <Slider
                            style={styles.slider}
                            minimumValue={1}
                            maximumValue={device?.neutralZoom || 4}
                            value={zoom}
                            onValueChange={setZoom}
                            minimumTrackTintColor={CYBER_COLORS.primary}
                            maximumTrackTintColor={CYBER_COLORS.surface}
                            thumbTintColor={CYBER_COLORS.primary}
                        />
                        <ThemedText style={styles.zoomValue}>{zoom.toFixed(1)}x</ThemedText>
                    </View>

                    {/* Flash Toggle */}
                    <ThemedPressable
                        style={[
                            styles.flashButton, 
                            { 
                                backgroundColor: flash === 'on' ? CYBER_COLORS.warning + '40' : CYBER_COLORS.surface,
                                borderColor: flash === 'on' ? CYBER_COLORS.warning : CYBER_COLORS.border
                            }
                        ]}
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
                        <ThemedText style={[
                            styles.flashText, 
                            { color: flash === 'on' ? CYBER_COLORS.warning : CYBER_COLORS.text }
                        ]}>
                            FLASH
                        </ThemedText>
                    </ThemedPressable>
                </View>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Loading
    loadingContainer: {
        flex: 1,
        backgroundColor: CYBER_COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: CYBER_COLORS.text,
        fontSize: 16,
        marginTop: 20,
        fontWeight: '500',
    },

    // Main container
    container: {
        flex: 1,
        backgroundColor: CYBER_COLORS.background,
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: CYBER_COLORS.overlay,
        opacity: 0.1,
        zIndex: 1,
    },

    // SVG overlays
    svgContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 5, // Match old code overlay z-index
    },
    svg: {
        flex: 1,
        width: '100%',
        height: '100%',
    },

    // HUD
    hud: {
        position: 'absolute',
        top: 500,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3,
        padding: 20,
        justifyContent: 'space-between',
    },

    // Top bar
    topBar: {
        marginTop: 40,
    },
    hudTitle: {
        color: CYBER_COLORS.primary,
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    statusText: {
        color: CYBER_COLORS.textMuted,
        fontSize: 12,
        marginTop: 4,
    },
    debugText: {
        color: CYBER_COLORS.text,
        fontSize: 11,
        marginTop: 4,
        fontStyle: 'italic',
    },

    // Results panel
    resultsPanel: {
        flex: 1,
        justifyContent: "flex-start",
        marginHorizontal: 20,
        maxWidth: 250,
    },
    sectionTitle: {
        color: CYBER_COLORS.text,
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4,
        letterSpacing: 1,
    },
    resultItem: {
        marginVertical: 1,
    },
    resultText: {
        color: CYBER_COLORS.primary,
        fontSize: 15,
        fontWeight: '500',
    },
    scientificText: {
        color: CYBER_COLORS.textMuted,
        fontSize: 11,
        fontStyle: 'italic',
        marginTop: 2,
    },
    confidenceBar: {
        height: 4,
        backgroundColor: CYBER_COLORS.border,
        borderRadius: 2,
        marginBottom: 4,
        maxWidth: 150,
        overflow: 'hidden',
    },
    confidenceFill: {
        height: '100%',
        borderRadius: 2,
    },

    // Controls
    controlsPanel: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    controlGroup: {
        flex: 1,
        marginRight: 20,
    },
    controlLabel: {
        color: CYBER_COLORS.textMuted,
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 8,
        letterSpacing: 1,
    },
    slider: {
        height: 30,
    },
    zoomValue: {
        color: CYBER_COLORS.text,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
    flashButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        minWidth: 80,
        justifyContent: 'center',
    },
    flashText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 6,
        letterSpacing: 1,
    },
});