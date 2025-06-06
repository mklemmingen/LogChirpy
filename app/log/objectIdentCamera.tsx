import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
    ActivityIndicator,
    Button,
    Dimensions,
    Image,
    LayoutAnimation,
    Modal,
    Platform,
    SafeAreaView,
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
import {Directory, File, Paths} from 'expo-file-system/next';

import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {useAppState} from '@react-native-community/hooks';
import {useImageLabeling} from "@infinitered/react-native-mlkit-image-labeling";

import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

import {useTranslation} from 'react-i18next';

import Slider from '@react-native-community/slider';

import {ThemedSnackbar} from "@/components/ThemedSnackbar";

import * as Haptics from 'expo-haptics';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {theme} from "@/constants/theme";


const STORAGE_KEYS = {
    pipelineDelay: 'pipelineDelay',
    confidenceThreshold: 'confidenceThreshold',
    showSettings: 'showSettings',
};
const { width: W, height: H } = Dimensions.get('window');

interface Detection {
    frame: { origin: { x: number; y: number }; size: { x: number; y: number } };
    labels: Array<{ text: string; confidence: number; index: number }>;
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

const persistToMediaLibraryAlbum = async (localUri: string, filename: string): Promise<boolean> => {
    try {
        // First ensure we have media library permissions
        const { status } = await MediaLibrary.getPermissionsAsync();
        if (status !== 'granted') {
            const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
            if (newStatus !== 'granted') {
                console.error("Media library permission denied");
                return false;
            }
        }

        // asset directly from the source URI
        const asset = await MediaLibrary.createAssetAsync(localUri);
        console.log("Asset created:", asset);

        // Create or get the album
        let album = await MediaLibrary.getAlbumAsync("LogChirpy");

        if (album) {
            // Add to existing album
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
            // Create new album with the asset
            album = await MediaLibrary.createAlbumAsync("LogChirpy", asset, false);
        }

        console.log("Saved image to LogChirpy album:", asset.uri);
        return true;
    } catch (e) {
        console.error("Failed to save to media library:", e);
        return false;
    }
};

const getDelayPresetLabel = (value: number): string => {
    if (value <= 0.25) return '⚡ Fast (0.2s)';
    if (value <= 0.6) return '⚖️ Balanced (0.5s)';
    return '🔍 Thorough (1s)';
};

const getConfidencePresetLabel = (value: number): string => {
    if (value < 0.4) return '🟢 Lenient (< 40%)';
    if (value < 0.75) return '🟡 Normal (40–75%)';
    return '🔴 Strict (≥ 75%)';
};

function generateFilename(prefix: string, label: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeLabel = label.replace(/\s+/g, '_');
    return `${prefix}_${safeLabel}_${timestamp}.jpg`;
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

    const filename = generateFilename(prefix, label.text);
    try {
        // Save directly without intermediate steps
        const saved = await persistToMediaLibraryAlbum(fileUri, filename);

        if (saved) {
            console.log(`${prefix} classified image saved successfully`);
            showSnackbar('camera.bird_detected', {
                bird: label.text,
                confidence: Math.round(label.confidence * 100),
            });
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    } catch (error) {
        console.error('Failed to save image to media library:', error);
        const message = error instanceof Error ? error.message : String(error);
        setDebugText(`Save failed: ${message}`);
    }
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

export default function ObjectIdentCameraWrapper() {
    const [isLoading, setIsLoading] = useState(true);
    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();
    const { t } = useTranslation();
    const raw = useColorScheme()
    const colorScheme: 'light' | 'dark' = raw === 'dark' ? 'dark' : 'light'
    const currentTheme = theme[colorScheme]

    // 1) run loading timer and kick off permission request exactly once
    useEffect(() => {
        // 3s splash
        const timer = setTimeout(() => setIsLoading(false), 1000);
        requestPermission();     // side-effect only here
        return () => clearTimeout(timer);
    }, [requestPermission]);

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
    const [pipelineDelay, setPipelineDelay] = useState(1); // seconds between captures
    const [confidenceThreshold, setConfidenceThreshold] = useState(0.8);

    // UI Settings and visibility toggles
    const [showSettings, setShowSettings] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    // Tooltip and label display info
    const [showDelayTooltip, setShowDelayTooltip] = useState(false);
    const [delayPresetLabel, setDelayPresetLabel] = useState('');
    const [showConfidenceTooltip, setShowConfidenceTooltip] = useState(false);
    const [confidencePresetLabel, setConfidencePresetLabel] = useState('');

    // Focus/app state control
    const isFocused = useIsFocused();
    const appState = useAppState();
    const isCameraActive = isFocused && appState === 'active';

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

    useEffect(() => {
        (async () => {
            try {
                const savedDelay = await AsyncStorage.getItem(STORAGE_KEYS.pipelineDelay);
                const savedThreshold = await AsyncStorage.getItem(STORAGE_KEYS.confidenceThreshold);
                const savedShowSettings = await AsyncStorage.getItem(STORAGE_KEYS.showSettings);

                if (savedDelay !== null) setPipelineDelay(parseFloat(savedDelay));
                if (savedThreshold !== null) setConfidenceThreshold(parseFloat(savedThreshold));
                if (savedShowSettings !== null) setShowSettings(savedShowSettings === 'true');
            } catch (e) {
                console.warn("Failed to load saved settings:", e);
            }
        })();
    }, []);

    const handleSetPipelineDelay = (value: number) => {
        setPipelineDelay(value);
        setDelayPresetLabel(getDelayPresetLabel(value));
        AsyncStorage.setItem(STORAGE_KEYS.pipelineDelay, value.toString());
    };

    const handleSetConfidenceThreshold = (value: number) => {
        setConfidenceThreshold(value);
        setConfidencePresetLabel(getConfidencePresetLabel(value));
        AsyncStorage.setItem(STORAGE_KEYS.confidenceThreshold, value.toString());
    };

    const toggleShowSettings = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowSettings(prev => {
            const newVal = !prev;
            AsyncStorage.setItem(STORAGE_KEYS.showSettings, newVal.toString());
            return newVal;
        });
    };

    // Ask for permissions once, also for layout
    useEffect(() => {
        (async () => {
            if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
                UIManager.setLayoutAnimationEnabledExperimental(true);
            }

            const hasPermission = await ensureMediaPermission();
            setHasMediaPermission(hasPermission);
        })();
    }, []);

    const ensureMediaPermission = async (): Promise<boolean> => {
        try {
            let { status } = await MediaLibrary.getPermissionsAsync();
            if (status !== 'granted') {
                const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
                if (newStatus !== 'granted') {
                    console.error("Media permission denied");
                    showSnackbar('errors.media_permission_denied');
                    return false;
                }
            }
            return true;
        } catch (error) {
            console.error("Error checking media permissions:", error);
            return false;
        }
    };

    const detector = useObjectDetection<MyModelsConfig>('efficientNetlite0int8');
    const classifier = useImageLabeling("birdClassifier");

    type ClassificationResult = Array<{ text: string; confidence: number; index: number }>;

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

    const imageContext = ImageManipulator.useImageManipulator(photoPath || '');
    const isActive = useRef(true);

    // Capture loop: take photo, manipulate, and save to document directory
    useEffect(() => {

        const captureLoop = async () => {
            if (!cameraRef.current || !isInitialized || isDetectionPaused) return;

            try {
                setIsProcessing(true);
                setDebugText(t('camera.capturing'));

                if (!cameraRef.current) return
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

                // Save manipulated image to the document directory using expo-file-system/next
                try {
                    const destDir = new Directory(Paths.document);
                    try {
                        destDir.create(); // ensure the document directory exists
                    } catch {
                        // Directory likely exists; ignore error
                    }
                    const fileName = `photo_${Date.now()}.jpg`;
                    const destFile = new File(destDir, fileName);

                    // Prepare source file instance from the manipulate result URI
                    const manipUri = manipResult.uri;
                    const srcName = Paths.basename(manipUri);
                    const srcDirPath = Paths.dirname(manipUri);
                    const srcDir = new Directory(srcDirPath);
                    const srcFile = new File(srcDir, srcName);

                    await srcFile.copy(destFile);
                    console.log('Photo saved to document directory:', destFile.uri);
                    // Set photoPath to the URI for MLKit
                    const savedPath = destFile.uri;

                    setPhotoPath(savedPath);

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
            if (isActive.current) {
                setTimeout(captureLoop, pipelineDelay*1000);
            }
        };

        captureLoop();
    }, [detector, device, isInitialized, isDetectionPaused]);

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

    useEffect(() => {
        if (classifier?.classifyImage) {
            setClassifierReady(true);
            console.log("Classifier is ready");
        }
    }, [classifier]);


    // Process photoPath with MLKit and delete previous photos
    useEffect(() => {
        if (!photoPath) return;

        if (!detector) {
            setDebugText(t('errors.detector_unavailable'));
            console.warn('Object detector not loaded.');
            return;
        }

        if (!classifierReady) {
            setDebugText(t('errors.classifier_unavailable'));
            console.warn('Image classifier not ready yet.');
            return;
        }

        (async () => {
            // Delete the last photo file (cleanup) if it exists
            if (lastPhotoUri) {
                try {
                    const lastFileName = Paths.basename(lastPhotoUri);
                    const lastFile = new File(Paths.document, lastFileName);
                    if (lastFile.exists) {
                        await lastFile.delete();
                        console.log('Deleted previous photo:', lastFile.uri);
                    }
                } catch (deleteError) {
                    console.warn('Error deleting previous photo:', deleteError);
                }
            }

            try {
                console.log('Rendering and saving new image...');
                const imageRef = await imageContext.renderAsync();
                const result = await imageRef.saveAsync({
                    format: ImageManipulator.SaveFormat.JPEG,
                    compress: 0.3,
                });

                // Save the rendered image to document directory
                const resultPath = result.uri;
                const resultName = Paths.basename(resultPath);
                const resultDirPath = Paths.dirname(resultPath);
                const resultDir = new Directory(resultDirPath);
                const srcResultFile = new File(resultDir, resultName);

                const destDir2 = new Directory(Paths.document);
                try {
                    destDir2.create();
                } catch {
                    // Directory likely exists; ignore error
                }

                const destFile2 = new File(destDir2, `photo_${Date.now()}.jpg`);
                await srcResultFile.copy(destFile2);

                const { exists } = await FileSystem.getInfoAsync(destFile2.uri);
                if (!exists) {
                    throw new Error(`File not ready at ${destFile2.uri}`);
                }

                // Ensure file exists (this should be immediate after copy)
                if (!destFile2.exists) {
                    throw new Error(`File still doesn't exist at ${destFile2.uri}`);
                }

                // Prepare the path for MLKit
                const imagePath = destFile2.uri;

                console.log('Original result URI:', result.uri);
                console.log('MLKit Path:', imagePath);

                setLastPhotoUri(imagePath);
                setImageDims({ width: result.width, height: result.height });
                setDebugText(t('camera.detection_running'));

                // Run object detection on the image
                const objects = await detector.detectObjects(imagePath);
                console.log('Detection results:', objects);
                console.log(objects.length);


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

                // 1) Enrich each detection by cropping + classifying:
                const enriched: Detection[] = [];
                for (const obj of objects) {
                    // crop the box out of the image
                    const cropUri = await cropImage(imagePath, obj.frame);

                    try {
                        // classify the cropped image
                        if (typeof classifier?.classifyImage !== 'function') {
                            console.warn("Classifier method not available");
                            return;
                        }
                        const labelResult = await classifyImage(cropUri);

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

                    // get the directory and filename straight from the URI:
                    const dirPath  = Paths.dirname(cropUri);
                    const fileName = Paths.basename(cropUri);

                    // construct a Directory/File pair for that path + name
                    const cropDir  = new Directory(dirPath);
                    const cropFile = new File(cropDir, fileName);

                    try {
                        await cropFile.delete();
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
                    const fullImageLabels = await classifyImage(imagePath);
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

            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(t('errors.detection_failed', { message }));
                setDebugText(t('errors.detection_failed', { message }));
            }
        })();
    }, [photoPath, classifier]);

    useEffect(() => {
        return () => {
            isActive.current = false;

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

    useFocusEffect(
        React.useCallback(() => {
            // Component is focused
            isActive.current = true;

            return () => {
                // Component lost focus
                isActive.current = false;
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

    // @ts-ignore
    // @ts-ignore
    return (
        <SafeAreaView style={{ flex: 1 }}>
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

                <TouchableOpacity
                    onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setShowSettings(prev => !prev);
                        AsyncStorage.setItem('showSettings', (!showSettings).toString());
                    }}
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
                        <View style={styles.sliderRow}>
                            <Text style={styles.sliderLabel}>{t('camera.pipeline_delay_label')}</Text>
                            <Slider
                                value={pipelineDelay}
                                onValueChange={handleSetPipelineDelay}
                                onSlidingStart={() => setShowDelayTooltip(true)}
                                onSlidingComplete={() => setShowDelayTooltip(false)}
                                minimumValue={0.01}
                                maximumValue={1}
                                step={0.01}
                                minimumTrackTintColor="#1EB1FC"
                                maximumTrackTintColor="#d3d3d3"
                                thumbTintColor="#1EB1FC"
                                style={{ width: '100%', height: 40 }}
                            />
                            <Text style={styles.sliderValue}>{pipelineDelay.toFixed(2)}s</Text>
                            {showDelayTooltip && (
                                <View style={[styles.tooltipBox, { backgroundColor: currentTheme.colors.overlay.dark }]}>
                                    <Text style={styles.tooltipText}>{delayPresetLabel}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.sliderRow}>
                            <Text style={styles.sliderLabel}>{t('camera.confidence_threshold_label')}</Text>
                            <Slider
                                value={confidenceThreshold}
                                onValueChange={handleSetConfidenceThreshold}
                                onSlidingStart={() => setShowConfidenceTooltip(true)}
                                onSlidingComplete={() => setShowConfidenceTooltip(false)}
                                minimumValue={0}
                                maximumValue={1}
                                step={0.01}
                                minimumTrackTintColor="#1EB1FC"
                                maximumTrackTintColor="#d3d3d3"
                                thumbTintColor="#1EB1FC"
                                style={{ width: '100%', height: 40 }}
                            />
                            <Text style={styles.sliderValue}>{Math.round(confidenceThreshold * 100)}%</Text>
                            {showConfidenceTooltip && (
                                <View style={[styles.tooltipBox, { backgroundColor: currentTheme.colors.overlay.dark }]}>
                                    <Text style={styles.tooltipText}>{confidencePresetLabel}</Text>
                                </View>
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={() => setIsDetectionPaused(prev => !prev)}
                            style={{
                                marginTop: 10,
                                backgroundColor: isDetectionPaused ? 'tomato' : '#1EB1FC',
                                padding: 10,
                                borderRadius: 6,
                            }}
                        >
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                {isDetectionPaused ? t('camera.resume') : t('camera.pause')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

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
                            const granted = await ensureMediaPermission();
                            setHasMediaPermission(granted);
                        }}
                    />
                </View>
            )}
            {modalVisible && modalPhotoUri && (
                <Modal
                    visible={modalVisible}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setModalVisible(false)}
                >
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
                                setModalVisible(false);
                                setModalPhotoUri(null); // clear frozen image of the modal
                                setShowOverlays(true);
                            }} />
                            {/* Optional, havent fully fletched out the UX yet */}
                            {/* <Button title="Delete" onPress={...} /> */}
                            {/* <Button title="Save" onPress={...} /> */}
                        </View>
                    </View>
                </Modal>
            )}
        </SafeAreaView>
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
});

