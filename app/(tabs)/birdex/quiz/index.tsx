import React, { useEffect, useState } from 'react';
import { View, Image, TextInput, Alert, StyleSheet } from 'react-native';
import { getBirdImageSource } from '@/services/birdImageService';
import { queryBirdDexPage } from '@/services/databaseBirDex';
import { BirdDexRecord } from '@/services/databaseBirDex';
import levenshtein from 'fast-levenshtein';
import { Button } from '@/components/Button';
import { useUnifiedColors, useSafeColorCombinations } from '@/hooks/useUnifiedColors';
import { useNavigation } from 'expo-router';


export default function BirdQuiz() {
    const [bird, setBird] = useState<BirdDexRecord | null>(null);
    const [input, setInput] = useState('');
    const [correct, setCorrect] = useState(false);
    const navigation = useNavigation();
    const colors = useUnifiedColors();
    const { primaryButton } = useSafeColorCombinations();

    useEffect(() => {
        const birds = queryBirdDexPage('', 'english_name', true, 100, 1, 'all');
        const random = birds[Math.floor(Math.random() * birds.length)];
        setBird(random);
    }, []);

    useEffect(() => {
        navigation.setOptions({
            title: 'Quiz',
        });
    }, [navigation]);

    const checkAnswer = () => {
        if (!bird) return;
        const answer = bird.english_name.toLowerCase().trim();
        const guess = input.toLowerCase().trim();

        const distance = levenshtein.get(answer, guess);
        if (distance <= 2 || guess === answer) {
            setCorrect(true);
            Alert.alert('Richtig!', `Das war ${bird.english_name}`);
        } else {
            Alert.alert('Leider falsch', `Richtige Antwort: ${bird.english_name}`);
        }
    };

    if (!bird) return null;

    return (
        <View style={styles.container}>
            <Image
                source={getBirdImageSource(bird.scientific_name)}
                style={styles.image}
                resizeMode="cover"
            />
            <TextInput
                style={[
                    styles.input,
                    {
                        backgroundColor: colors.background.secondary,
                        borderColor: colors.border.primary,
                        color: colors.text.primary,
                    }
                ]}
                placeholder="Wie heißt dieser Vogel?"
                placeholderTextColor={colors.text.tertiary}
                value={input}
                onChangeText={setInput}
            />

            <View style={{ marginTop: 10 }}>
                <Button
                    size="md"
                    variant="primary"
                    onPress={checkAnswer}
                    title="Antwort prüfen"
                />
            </View>

        </View >
    );
}

const styles = StyleSheet.create({
    container: { padding: 20, alignItems: 'center' },
    image: { width: 250, height: 250, borderRadius: 12, marginBottom: 16 },
    input: { width: '100%', borderWidth: 1, padding: 8, borderRadius: 8, marginBottom: 12 }
});