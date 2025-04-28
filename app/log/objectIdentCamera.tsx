import React, { useState, useRef, useEffect } from 'react';
import { View, Button, StyleSheet, Image, Text, ActivityIndicator, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions, Camera } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ThemedSnackbar } from '@/components/ThemedSnackbar';
import * as jpeg from 'jpeg-js';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

export default function ObjectIdentCamera() {
    const { t } = useTranslation();
    const [permission, requestPermission] = useCameraPermissions();
    const [photo, setPhoto] = useState<string | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [isRequestingPermission, setIsRequestingPermission] = useState(false);
    const cameraRef = useRef<CameraView>(null);
    const router = useRouter();

    // Neue States für TensorFlow und Objekterkennung
    const [tfReady, setTfReady] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
    const [frameCount, setFrameCount] = useState(0);
    const [detections, setDetections] = useState<cocoSsd.DetectedObject[]>([]);
    const [displayDetectionFrames, setDisplayDetectionFrames] = useState(0);
    const [lastImageDimensions, setLastImageDimensions] = useState({ width: windowWidth, height: windowHeight });
    const [decodeJpegFn, setDecodeJpegFn] = useState<((data: Uint8Array) => tf.Tensor3D) | null>(null);
    // Neue States für Snackbar (Fehler und Popups)
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    // TensorFlow.js initialisieren und COCO-SSD Modell laden + eigene Decoder-Funktion
    useEffect(() => {
        const loadTfModel = async () => {
            try {
                await tf.ready();
                await tf.setBackend('cpu');

                // Decoder-Funktion mit jpeg-js implementieren
                const decodeImage = (jpegData: Uint8Array) => {
                  const { width, height, data } = jpeg.decode(jpegData, { useTArray: true });
                  const buffer = new Uint8Array(width * height * 3);

                  let offset = 0;
                  for (let i = 0; i < data.length; i += 4) {
                    buffer[offset++] = data[i];
                    buffer[offset++] = data[i + 1];
                    buffer[offset++] = data[i + 2];
                  }

                  return tf.tensor3d(buffer, [height, width, 3]);
                };

                setDecodeJpegFn(() => decodeImage);
                console.log('Loading CocoSSD model...');

                const modelJson = require('@/assets/model/model.json');

                // Bei tf.loadGraphModel können wir einen Asset-Pfad verwenden
                const model = await tf.loadGraphModel(modelJson);
                // Alternativ für cocoSsd spezifisch:
                // const model = await cocoSsd.load({
                //   modelUrl: FileSystem.documentDirectory + 'model/model.json'
                // });

                modelRef.current = model;
                setModelLoaded(true);
                setTfReady(true);
                console.log('TensorFlow.js and model loaded');
            } catch (error) {
                console.error('Failed to load TensorFlow.js/model:', error);
                setSnackbarMessage('Failed to load object detection model');
                setSnackbarVisible(true);
            }
        };
        loadTfModel();
    }, []);

    // Frame-Verarbeitung: Jeden dritten Frame verarbeiten und Overlay drei Frames lang anzeigen
    useEffect(() => {
        if (!cameraReady || !modelLoaded || photo !== null) return;
        const interval = setInterval(() => {
            setFrameCount(prev => {
                const newCount = prev + 1;
                if (newCount >= 3) {
                    processFrame();
                    return 0;
                }
                return newCount;
            });
            setDisplayDetectionFrames(prev => (prev > 0 ? prev - 1 : 0));
        }, 200);
        return () => clearInterval(interval);
    }, [cameraReady, modelLoaded, photo]);

    const processFrame = async () => {
        if (!cameraRef.current || !modelRef.current || !decodeJpegFn) return;
        try {
            const frame = await cameraRef.current.takePictureAsync({
                skipProcessing: true,
                quality: 0.5,
                exif: false,
            });
            // Sicherstellen, dass frame definiert ist
            if (!frame) {
                console.error('Frame is undefined');
                setSnackbarMessage('Frame is undefined');
                setSnackbarVisible(true);
                return;
            }
            // Speichern der abgemessenen Bilddimensionen
            setLastImageDimensions({ width: frame.width, height: frame.height });
            // Bildgröße reduzieren
            const resized = await manipulateAsync(
                frame.uri,
                [{ resize: { width: 300 } }],
                { compress: 0.7, format: SaveFormat.JPEG }
            );
            // Datei als Base64 einlesen und in einen Tensor umwandeln
            const imgB64 = await FileSystem.readAsStringAsync(resized.uri, { encoding: FileSystem.EncodingType.Base64 });
            const imgBuffer = tf.util.encodeString(imgB64, 'base64').buffer;
            const raw = new Uint8Array(imgBuffer);
            const imageTensor = decodeJpegFn(raw);
            // Objekterkennung durchführen
            const preds = await modelRef.current.detect(imageTensor);
            setDetections(preds);
            setDisplayDetectionFrames(3);
            tf.dispose(imageTensor);
        } catch (error) {
            console.error('Error during object detection:', error);
            setSnackbarMessage('Error during object detection');
            setSnackbarVisible(true);
        }
    };

    const requestPermissionHandler = async () => {
        try {
            setIsRequestingPermission(true);
            console.log("Requesting camera permission...");

            // Manuelles Anfordern der Berechtigung mit dem nativen Modul
            const { status } = await Camera.requestCameraPermissionsAsync();

            console.log("Camera permission status:", status);

            if (status !== 'granted') {
                setSnackbarMessage(t('camera.permission_required') || 'Camera permission required');
                setSnackbarVisible(true);
            }

            // Seite neu laden nach Berechtigungsanfrage
            router.replace('/log/objectIdentCamera');

        } catch (error) {
            console.error("Error requesting camera permission:", error);
            setSnackbarMessage(t('camera.permission_error') || 'Error requesting camera permission');
            setSnackbarVisible(true);
        } finally {
            setIsRequestingPermission(false);
        }
    };

    const takePicture = async () => {
        if (cameraRef.current && cameraReady) {
            try {
                const photoData = await cameraRef.current.takePictureAsync();
                if (photoData && photoData.uri) {
                    setPhoto(photoData.uri);
                }
            } catch (error) {
                console.error('Error taking picture:', error);
                setSnackbarMessage(t('camera.take_photo_error') || 'Error taking photo');
                setSnackbarVisible(true);
            }
        } else {
            setSnackbarMessage(t('camera.not_ready') || 'Camera not ready');
            setSnackbarVisible(true);
        }
    };

    const confirmPhoto = () => {
        if (photo) {
            router.push({
                pathname: '/log/manual',
                params: { image: photo },
            });
        }
    };

    // Anzeige während Permission-Abfrage läuft
    if (isRequestingPermission) {
        return (
            <View style={styles.permissionContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={styles.permissionText}>{t('camera.requesting_access')}</Text>
            </View>
        );
    }

    // Anzeige wenn Permission fehlt
    if (permission === null) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>{t('camera.checking_access')}</Text>
                <ActivityIndicator size="small" color="#0000ff" />
            </View>
        );
    }

    // Anzeige wenn Permission abgelehnt wurde
    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>{t('camera.need_permission')}</Text>
                <Button
                    title={t('camera.allow_access')}
                    onPress={requestPermissionHandler}
                    disabled={isRequestingPermission}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {!photo ? (
                <CameraView
                    style={styles.camera}
                    facing="back"
                    ref={cameraRef}
                    onCameraReady={() => setCameraReady(true)}
                >
                    {/* SVG-Overlay: Anzeige der Detektionen für drei Frames */}
                    {displayDetectionFrames > 0 && detections.length > 0 && (
                        <Svg height="100%" width="100%" style={styles.overlay}>
                            {detections.map((d, idx) => {
                                const scaleX = windowWidth / lastImageDimensions.width;
                                const scaleY = windowHeight / lastImageDimensions.height;
                                const [x, y, w, h] = d.bbox;
                                return (
                                    <React.Fragment key={idx}>
                                        <Rect
                                            x={x * scaleX}
                                            y={y * scaleY}
                                            width={w * scaleX}
                                            height={h * scaleY}
                                            stroke="#FF0000"
                                            strokeWidth="2"
                                            fillOpacity="0"
                                        />
                                        <SvgText
                                            x={x * scaleX}
                                            y={y * scaleY - 5}
                                            fill="#FF0000"
                                            fontSize="16"
                                            fontWeight="bold"
                                            stroke="#FFFFFF"
                                            strokeWidth="1"
                                        >
                                            {`${d.class} ${Math.floor(d.score * 100)}%`}
                                        </SvgText>
                                    </React.Fragment>
                                );
                            })}
                        </Svg>
                    )}
                    <View style={styles.buttonContainer}>
                        <Button title={t('camera.take_photo')} onPress={takePicture} />
                    </View>
                </CameraView>
            ) : (
                <View style={styles.previewContainer}>
                    <Image source={{ uri: photo }} style={styles.preview} />
                    <Button title={t('common.confirm')} onPress={confirmPhoto} />
                    <Button title={t('camera.retake')} onPress={() => setPhoto(null)} />
                </View>
            )}
            <ThemedSnackbar
                visible={snackbarVisible}
                message={snackbarMessage}
                onHide={() => setSnackbarVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    camera: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    buttonContainer: {
        backgroundColor: 'transparent',
        alignSelf: 'center',
        marginBottom: 20,
    },
    previewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    preview: {
        width: '100%',
        height: '80%',
        marginBottom: 20,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    permissionText: {
        marginBottom: 20,
        textAlign: 'center',
        fontSize: 16,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
    },
});
