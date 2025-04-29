import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import {Camera, CameraPermissionStatus, useCameraDevice} from 'react-native-vision-camera';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { decode as atobDecode } from 'base-64';
import jpeg from 'jpeg-js';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import {NoCameraErrorView} from "@/components/noCameraView";

const { width: W, height: H } = Dimensions.get('window');

interface Detection {
    bbox: [number, number, number, number];
    class: string;
    score: number;
}

export default function ObjectIdentCamera() {
    const cameraRef = useRef<Camera>(null);
    const [permission, setPermission] = useState<CameraPermissionStatus>('denied');
    const modelRef = useRef<tf.GraphModel | null>(null);
    const [modelReady, setModelReady] = useState(false);
    const [detections, setDetections] = useState<Detection[]>([]);
    const [debugText, setDebugText] = useState('Initializing...');

    // State for managing the camera device
    const [device, setDevice] = useState(null); // Initialize with null
    const cameraDevice = useCameraDevice('back');

    // 1. Model loading and permission request
    useEffect(() => {
        (async () => {
            const status = await Camera.requestCameraPermission();
            setPermission(status);

            if (status !== 'granted') {
                setDebugText('Camera permission denied or still asking for permission.');
                return;
            }

            console.log('TensorFlow initializing...');
            await tf.ready();
            await tf.setBackend('cpu');

            console.log('Loading model...');
            try {
                const modelJson = require('../../assets/model/objectDet/model.json');
                const modelWeights = [
                    require('../../assets/model/objectDet/group1-shard1of6.bin'),
                    require('../../assets/model/objectDet/group1-shard2of6.bin'),
                    require('../../assets/model/objectDet/group1-shard3of6.bin'),
                    require('../../assets/model/objectDet/group1-shard4of6.bin'),
                    require('../../assets/model/objectDet/group1-shard5of6.bin'),
                    require('../../assets/model/objectDet/group1-shard6of6.bin'),
                ];

                modelRef.current = await tf.loadGraphModel(bundleResourceIO(modelJson, modelWeights));
                console.log('Model loaded successfully!');
                setDebugText('Model loaded.');
                setModelReady(true);
            } catch (err) {
                console.error('Model loading failed', err);
                setDebugText('Model failed to load.');
            }
        })();
    }, []);

    // 2. Silent detection only starts when BOTH are ready
    useEffect(() => {
        if (!modelReady || permission !== 'granted') return;

        console.log('Starting silent detection loop...');
        const interval = setInterval(async () => {
            if (!cameraRef.current || !modelRef.current) return;
            try {
                const snapshot = await cameraRef.current.takePhoto({
                    flash: 'off',
                    enableShutterSound: false,
                    enableAutoDistortionCorrection: true,
                    enableAutoRedEyeReduction: true,
                });

                if (!snapshot?.path) return;

                // updated API for image manipulation
                const resized = await ImageManipulator.manipulateAsync(snapshot.path, [{ resize: { width: 300, height: 300 } }], {
                    compress: 0.7,
                    format: ImageManipulator.SaveFormat.JPEG,
                });

                const b64 = await FileSystem.readAsStringAsync(resized.uri, { encoding: FileSystem.EncodingType.Base64 });
                const u8 = b64toUint8Array(b64);
                const decoded = jpeg.decode(u8, { useTArray: true });
                const imgTensor = tf.tidy(() =>
                    tf.tensor3d(decoded.data, [decoded.height, decoded.width, 4])
                        .slice([0, 0, 0], [-1, -1, 3])
                        .expandDims(0)
                );

                const outputs = (await modelRef.current.executeAsync(imgTensor)) as tf.Tensor[];
                const results = await processDetections(outputs);

                console.log('[Detection] results:', results);
                console.log(`Detections found: ${results.length}`);
                setDebugText(`Detections: ${results.length}`);
                setDetections(results);

                imgTensor.dispose();
            } catch (err) {
                console.error('Detection error:', err);
                setDebugText('Detection failed.');
            }
        }, 500);

        return () => clearInterval(interval);
    }, [modelReady, permission, device]);

    if (permission === 'denied') return <ActivityIndicator style={styles.centered} />;
    if (permission !== 'granted') {
        return (
            <View style={styles.centered}>
                <Button title="Grant Camera" onPress={async () => await Camera.requestCameraPermission()} />
            </View>
        );
    }

    if (device == null || cameraDevice == null) {
        return <NoCameraErrorView onRetry={() => setDevice(cameraDevice)} />;
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
                    {detections.length > 0 ? detections.map((d, i) => {
                        const [x, y, w, h] = d.bbox;
                        const scaleX = W / 300;
                        const scaleY = H / 300;
                        return (
                            <React.Fragment key={i}>
                                <Rect
                                    x={x * scaleX}
                                    y={y * scaleY}
                                    width={w * scaleX}
                                    height={h * scaleY}
                                    stroke="red"
                                    strokeWidth="2"
                                    fill="transparent"
                                />
                                <SvgText
                                    x={x * scaleX}
                                    y={Math.max(y * scaleY - 5, 0)}
                                    fill="red"
                                    fontSize="14"
                                >
                                    {`${d.class} ${Math.round(d.score * 100)}%`}
                                </SvgText>
                            </React.Fragment>
                        );
                    }) : (
                        <SvgText
                            x="50%"
                            y="50%"
                            textAnchor="middle"
                            fill="white"
                            fontSize="18"
                        >
                            No detections yet
                        </SvgText>
                    )}
                </Svg>
                <View style={styles.debugTextContainer}>
                    <Text style={styles.debugText}>{debugText}</Text>
                </View>
            </Camera>
        </View>
    );
}

function b64toUint8Array(b64: string): Uint8Array {
    const bin = atobDecode(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
}

async function processDetections(outputs: tf.Tensor[]): Promise<Detection[]> {
    const [boxes, scores, classes, validDetections] = outputs;
    const boxesData = await boxes.array() as number[][][];
    const scoresData = await scores.array() as number[][];
    const classesData = await classes.array() as number[][];
    const valid = (await validDetections.array() as number[])[0];

    const results: Detection[] = [];
    for (let i = 0; i < valid; i++) {
        results.push({
            bbox: [
                boxesData[0][i][1] * 300,
                boxesData[0][i][0] * 300,
                (boxesData[0][i][3] - boxesData[0][i][1]) * 300,
                (boxesData[0][i][2] - boxesData[0][i][0]) * 300,
            ],
            class: String(classesData[0][i]),
            score: scoresData[0][i],
        });
    }
    return results;
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
    debugText: {
        color: 'white',
        fontSize: 16,
    },
});