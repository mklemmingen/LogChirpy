import React, { useState, useEffect } from 'react';
import {Button, Image, StyleSheet, Text, ScrollView, ActivityIndicator, View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { ThemedText } from '@/components/ThemedText';
import { Card } from 'react-native-paper';

export default function ImageModel() {
    const [isTfReady, setIsTfReady] = useState(false);
    const [model, setModel] = useState<mobilenet.MobileNet | null>(null);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [predictions, setPredictions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        (async () => {
            await tf.ready();
            setIsTfReady(true);
            setModel(await mobilenet.load());
        })();
    }, []);

    const pickImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            alert('Permission required!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            quality: 1,
            selectionLimit: 1,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            setImageUri(uri);
            await classifyImage(uri);
        }
    };

    const classifyImage = async (uri: string) => {
        if (!isTfReady || !model) return;

        try {
            setIsLoading(true);
            const imgB64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            const raw = new Uint8Array(tf.util.encodeString(imgB64, 'base64').buffer);
            const imageTensor = decodeJpeg(raw);
            const resizedTensor = tf.image.resizeBilinear(imageTensor, [224, 224]);
            setPredictions(await model.classify(resizedTensor));
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View>
            <ScrollView >
                <ThemedText type="title">Image Classification</ThemedText>
                <Button title="Pick an Image" onPress={pickImage} disabled={!isTfReady || isLoading} />
                {isLoading && <ActivityIndicator size="large" color="#6200ee" />}
                {imageUri && <Image source={{ uri: imageUri }}  resizeMode="contain" />}
                {predictions.map((prediction, index) => (
                    <Card key={index} >
                        <Card.Content>
                            <Text >
                                {(prediction.probability * 100).toFixed(2)}%
                            </Text>
                        </Card.Content>
                    </Card>
                ))}
            </ScrollView>
        </View>
    );
}