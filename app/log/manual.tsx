import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    Dimensions,
    SafeAreaView,
    ActivityIndicator,
} from 'react-native';
import { useLogDraft } from '../context/LogDraftContext';
import '@tensorflow/tfjs-backend-cpu';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { decode } from 'jpeg-js';
import { insertBirdSpotting } from '@/services/database'; // adjust path as needed

const { width } = Dimensions.get('window');
const GAP = 12;
const HALF = (width - GAP * 3) / 2;
const FULL = width - GAP * 2;

type Tile = {
    key: keyof DraftFields;
    label: string;
    span: 'half' | 'full';
};

// Define fields managed in the draft
type DraftFields = {
    birdType: string;
    textNote: string;
};

export default function Manual() {
    const { draft, update, clear } = useLogDraft();
    const [busy, setBusy] = useState(false);

    // Initialize the TF CPU backend
    useEffect(() => {
        tf.ready().then(() => tf.setBackend('cpu'));
    }, []);

    const tiles: Tile[] = [
        { key: 'birdType', label: 'Bird', span: 'half' },
        { key: 'textNote', label: 'Notes', span: 'full' },
    ];

    const onChange = (key: keyof DraftFields, val: string) => {
        update({ [key]: val });
    };

    const onSave = async () => {
        setBusy(true);
        let imagePrediction = '';

        if (draft.imageUri) {
            try {
                const res = await fetch(draft.imageUri);
                const buffer = await res.arrayBuffer();
                const imageData = decode(new Uint8Array(buffer));
                // Build a tensor and drop the alpha channel
                const imgTensor = tf.tensor3d(
                    imageData.data,
                    [imageData.height, imageData.width, 4]
                );
                const rgbTensor = imgTensor.slice([0, 0, 0], [-1, -1, 3]);

                const model = await mobilenet.load();
                const predictions = await model.classify(rgbTensor as any);
                if (predictions.length > 0) {
                    imagePrediction = predictions[0].className;
                }

                tf.dispose([imgTensor, rgbTensor]);
            } catch (error) {
                console.warn('Image recognition failed:', error);
            }
        }

        const now = new Date();
        insertBirdSpotting({
            imageUri: draft.imageUri || '',
            videoUri: draft.videoUri || '',
            audioUri: draft.audioUri || '',
            textNote: draft.textNote || '',
            gpsLat: draft.gpsLat || 0,
            gpsLng: draft.gpsLng || 0,
            date: draft.date || now.toISOString(),
            birdType: draft.birdType || '',
            imagePrediction,
            audioPrediction: draft.audioPrediction || '',
        });

        clear();
        setBusy(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.grid}>
                {tiles.map((t) => (
                    <View
                        key={t.key}
                        style={[
                            styles.tile,
                            { width: t.span === 'full' ? FULL : HALF },
                        ]}
                    >
                        <Text style={styles.label}>{t.label}</Text>
                        <TextInput
                            style={styles.input}
                            value={(draft as any)[t.key] as string}
                            onChangeText={(v) => onChange(t.key, v)}
                            multiline={t.span === 'full'}
                        />
                    </View>
                ))}
            </ScrollView>

            <Pressable
                style={[styles.saveBtn, busy && styles.disabledBtn]}
                onPress={onSave}
                disabled={busy}
            >
                {busy ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.saveText}>Save</Text>
                )}
            </Pressable>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: GAP,
        justifyContent: 'space-between',
    },
    tile: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 8,
        marginBottom: GAP,
    },
    label: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 4,
        padding: 6,
        minHeight: 40,
    },
    saveBtn: {
        position: 'absolute',
        bottom: 24,
        left: 24,
        right: 24,
        height: 50,
        backgroundColor: '#007AFF',
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledBtn: {
        backgroundColor: '#888',
    },
    saveText: { color: '#fff', fontWeight: '600' },
});
