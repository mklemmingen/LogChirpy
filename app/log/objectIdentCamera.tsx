import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { Camera, CameraPermissionStatus, useCameraDevice } from 'react-native-vision-camera';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { NoCameraErrorView } from '@/components/noCameraView';

// ML Kit provider hooks
import { useObjectDetection } from '@infinitered/react-native-mlkit-object-detection';
import type { MyModelsConfig } from '../_layout';

const { width: W, height: H } = Dimensions.get('window');

interface Detection {
    frame: { origin: { x: number; y: number }; size: { x: number; y: number } };
    labels: Array<{ text: string; confidence: number; index: number }>;
}

export default function ObjectIdentCamera() {
    const cameraRef = useRef<Camera>(null);
    const [permission, setPermission] = useState<CameraPermissionStatus>('denied');
    const [detections, setDetections] = useState<Detection[]>([]);
    const [debugText, setDebugText] = useState('Initializing...');
    const device = useCameraDevice('back');

    // Grab the default detector from context
    const detector = useObjectDetection<MyModelsConfig>('mobilenetFloat');

    // Request permission
    useEffect(() => {
        (async () => {
            const status = await Camera.requestCameraPermission();
            setPermission(status);
            if (status !== 'granted') {
                setDebugText('Camera permission denied.');
            } else {
                setDebugText('Permission granted. Ready.');
            }
        })();
    }, []);

    // Run detection every half-second
    useEffect(() => {
        if (permission !== 'granted' || !detector) return;
        let active = true;
        const loop = async () => {
            if (!active) return;
            try {
                const photo = await cameraRef.current?.takePhoto({ flash: 'off', enableShutterSound: false });
                if (photo?.path) {
                    setDebugText('Detecting...');
                    const results = await detector.detectObjects(photo.path);
                    setDetections(results);
                    setDebugText(`Detections: ${results.length}`);
                }
            } catch (e) {
                console.error('Detection error:', e);
                setDebugText('Detection failed.');
            }
            setTimeout(loop, 500);
        };
        loop();
        return () => { active = false; };
    }, [permission, detector]);

    if (permission === 'denied') {
        return <ActivityIndicator style={styles.centered} />;
    }
    if (permission !== 'granted') {
        return (
            <View style={styles.centered}>
                <Text>Please grant camera permission.</Text>
            </View>
        );
    }
    if (!device) {
        return <NoCameraErrorView onRetry={() => Camera.requestCameraPermission().then(setPermission)} />;
    }

    return (
        <View style={styles.container}>
            <Camera
                style={styles.camera}
                ref={cameraRef}
                device={device}
                isActive={true}
            >
                <Svg style={styles.overlay} width="100%" height="100%">
                    {detections.map((d, i) => {
                        const { origin, size } = d.frame;
                        const scaleX = W / size.x;
                        const scaleY = H / size.y;
                        return (
                            <React.Fragment key={i}>
                                <Rect
                                    x={origin.x * scaleX}
                                    y={origin.y * scaleY}
                                    width={size.x * scaleX}
                                    height={size.y * scaleY}
                                    stroke="red"
                                    strokeWidth={2}
                                    fill="transparent"
                                />
                                {d.labels.map((lab, j) => (
                                    <SvgText
                                        key={j}
                                        x={origin.x * scaleX}
                                        y={Math.max(origin.y * scaleY - 4, 0)}
                                        fill="red"
                                        fontSize="12"
                                    >
                                        {`${lab.text} ${Math.round(lab.confidence * 100)}%`}
                                    </SvgText>
                                ))}
                            </React.Fragment>
                        );
                    })}
                    {detections.length === 0 && (
                        <SvgText x="50%" y="50%" textAnchor="middle" fill="white" fontSize="18">
                            {debugText}
                        </SvgText>
                    )}
                </Svg>
            </Camera>
            <View style={styles.debugTextContainer}>
                <Text style={styles.debugText}>{debugText}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    camera: { flex: 1 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
