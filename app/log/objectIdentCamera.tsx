import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Dimensions, Image, Platform, SafeAreaView, StyleSheet, Text, View,} from 'react-native';
import {Camera, useCameraDevice, useCameraPermission,} from 'react-native-vision-camera';
import Svg, {Rect, Text as SvgText} from 'react-native-svg';
import * as ImageManipulator from 'expo-image-manipulator';
import {useObjectDetection} from '@infinitered/react-native-mlkit-object-detection';
import type {MyModelsConfig} from './../_layout';
import {Directory, File, Paths} from 'expo-file-system/next';

import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {useAppState} from '@react-native-community/hooks';
import {useImageLabeling} from "@infinitered/react-native-mlkit-image-labeling";

const { width: W, height: H } = Dimensions.get('window');

interface Detection {
    frame: { origin: { x: number; y: number }; size: { x: number; y: number } };
    labels: Array<{ text: string; confidence: number; index: number }>;
}

async function waitForFile(file: File, timeout = 3000, interval = 100): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (file.exists) return true;
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    return false;
}

// At the top of your file:
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

export default function ObjectIdentCamera() {
    const cameraRef = useRef<Camera>(null);
    const [detections, setDetections] = useState<Detection[]>([]);
    const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
    const [imageDims, setImageDims] = useState({ width: 0, height: 0 });
    const [photoPath, setPhotoPath] = useState<string | null>(null);
    const device = useCameraDevice('back');
    const [debugText, setDebugText] = useState('Initialisiere.');
    const { hasPermission, requestPermission } = useCameraPermission();

    const isFocused = useIsFocused();
    const appState = useAppState();
    const isCameraActive = isFocused && appState === 'active';

    // Request camera permission if not granted
    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission]);

    // If no camera or no permission, show loader
    if (device == null || !hasPermission) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    const detector = useObjectDetection<MyModelsConfig>('efficientNetlite0int8');
    const classifier = useImageLabeling("birdClassifier");

    const classifyImage = async (imageUri: string) => {
        try {
            // @ts-ignore
            const result = await classifier.classifyImage(imageUri);
            console.log(result);
        } catch (error) {
            console.error("Classification failed:", error);
        }
    };

    const imageContext = ImageManipulator.useImageManipulator(photoPath || '');
    const isActive = useRef(true);
    const hasStartedCaptureLoop = useRef(false);

    // Capture loop: take photo, manipulate, and save to document directory
    useEffect(() => {
        if (
            !detector ||
            !device ||
            !cameraRef.current ||
            hasStartedCaptureLoop.current
        ) {
            return;
        }
        hasStartedCaptureLoop.current = true;

        const captureLoop = async () => {
            if (!isActive.current || !cameraRef.current) return;

            try {
                setDebugText('Bildaufnahme...');
                const photo = await cameraRef.current.takePhoto({
                    flash: 'off',
                    enableShutterSound: false,
                });

                console.log('Photo taken:', photo);

                if (!photo?.path) {
                    setDebugText('Fehler: Kein Bildpfad.');
                    return;
                }

                // Apply any desired image manipulations (compression, format, etc.)
                const manipResult = await ImageManipulator.manipulateAsync(
                    photo.path,
                    [],
                    { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG }
                );

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
                } catch (copyError: any) {
                    console.error('Error copying photo to document directory:', copyError);
                    setDebugText(
                        `Fehler beim Speichern des Fotos: ${copyError.message}`
                    );
                    return;
                }
            } catch (err: any) {
                console.error('Fehler bei Bildaufnahme:', err);
                setDebugText(`Fehler bei Bildaufnahme: ${err.message}`);
            }

            // Continue capture loop if still active
            if (isActive.current) {
                setTimeout(captureLoop, 1000);
            }
        };

        captureLoop();
    }, [detector, device]);

    async function cropImage(imageUri: string, box: any) {
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

    // Process photoPath with MLKit and delete previous photos
    useEffect(() => {
        if (!photoPath || !detector || !classifier) return;

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

                const fileReady = await waitForFile(destFile2);
                if (!fileReady) {
                    console.error(`File not ready at ${destFile2.uri}`);
                    return;
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
                setDebugText('Objekterkennung läuft...');

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
                        const labelResult = await classifier.classifyImage(cropUri);

                        console.log(labelResult);

                        // pick the top label
                        const labels = labelResult.length
                            ? [{
                                text:    labelResult[0].text,
                                confidence: labelResult[0].confidence,
                                index:   labelResult[0].index
                            }]
                            : [];

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
                        ? `${enriched.length} Objekte erkannt und klassifiziert.`
                        : 'Keine Objekte erkannt.'
                );
            } catch (err: any) {
                console.error('Fehler bei Erkennung:', err);
                setDebugText(`Fehler: ${err.message}`);
            }
        })();
    }, [photoPath]);

    useEffect(() => {
        return () => {
            isActive.current = false; // Stop the capture loop
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

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.container}>
                <Camera
                    style={styles.camera}
                    ref={cameraRef}
                    device={device}
                    isActive={isCameraActive}
                    photo={true}
                />
                <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                    {detections.map((d, i) => {
                        // destructure frame and labels from the detection object
                        const { origin, size } = d.frame;
                        const labels = d.labels;
                        // If you have a label, use its confidence to style; otherwise default
                        const conf = labels[0]?.confidence ?? 0;
                        const { color, opacity } = getBoxStyle(conf);

                        return (
                            <React.Fragment key={i}>
                                <Rect
                                    x={origin.x * scaleX}
                                    y={origin.y * scaleY}
                                    width={size.x * scaleX}
                                    height={size.y * scaleY}
                                    stroke={color}
                                    strokeWidth={2}
                                    fill="none"
                                    fillOpacity={opacity * 0.3}    // lighter fill
                                />
                                {labels[0] && (
                                    <SvgText
                                        x={origin.x * scaleX}
                                        y={Math.max(origin.y * scaleY - 4, 0)}
                                        fill={color}
                                        fillOpacity={opacity}
                                        fontSize="12"
                                        fontWeight="bold"
                                    >
                                        {`${labels[0].text} ${(conf*100).toFixed(0)}%`}
                                    </SvgText>
                                )}
                            </React.Fragment>
                        );
                    })}
                </Svg>
                {lastPhotoUri && (
                    <Image source={{ uri: lastPhotoUri }} style={styles.thumbnail} />
                )}
                <View style={styles.debugTextContainer}>
                    <Text style={styles.debugText}>{debugText}</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    camera: { flex: 1 },
    thumbnail: {
        position: 'absolute',
        width: 80,
        height: 80,
        bottom: 10,
        right: 10,
        borderColor: '#fff',
        borderWidth: 1,
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    debugText: { color: 'white', fontSize: 16 },
});
