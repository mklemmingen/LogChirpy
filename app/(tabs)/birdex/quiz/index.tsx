import React, { useEffect, useState } from 'react';
import { View, Image, TextInput, Alert, StyleSheet } from 'react-native';
import { getBirdImageSource } from '@/services/birdImageService';
import { queryBirdDexPage } from '@/services/databaseBirDex';
import { BirdDexRecord } from '@/services/databaseBirDex';
import levenshtein from 'fast-levenshtein';
import { Button } from '@/components/Button';
import { useUnifiedColors, useSafeColorCombinations } from '@/hooks/useUnifiedColors';
import { useNavigation } from 'expo-router';
import { KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function BirdQuiz() {
    const [bird, setBird] = useState<BirdDexRecord | null>(null);
    const [input, setInput] = useState('');
    const [correct, setCorrect] = useState(false);
    const navigation = useNavigation();
    const colors = useUnifiedColors();
    const { primaryButton } = useSafeColorCombinations();
    const [questionIndex, setQuestionIndex] = useState(1);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const { t } = useTranslation();
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
        let answeredCorrectly = false;
        const answer = bird.english_name?.toLowerCase().trim() ?? '';
        const guess = input.toLowerCase().trim();

        const correctName = bird.english_name || bird.de_name || bird.scientific_name;

        const distance = levenshtein.get(answer, guess);
        if (questionIndex === 1) {
            if (guess === answer || answer.includes(guess) || guess.includes(answer)) {
                answeredCorrectly = true;
                Alert.alert(t('alerts.correctTitle'), t('alerts.correctMessage', { name: correctName }),
                    [
                        { text: t('common.ok'), onPress: () => console.log('OK pressed') }
                    ]
                );
            } else {
                Alert.alert(t('alerts.incorrectTitle'), t('alerts.incorrectMessage', { name: correctName }));
            }
        }

        else if (questionIndex === 2) {
            const answer = bird.range.toLowerCase().trim();
            const guess = input.toLowerCase().trim();
            if (answer.includes(guess) || guess.includes(answer)) {
                answeredCorrectly = true;
                Alert.alert(t('alerts.correctTitle'), t('alerts.correctRangeMessage', { range: bird.range }));
            } else {
                Alert.alert(t('alerts.incorrectTitle'), t('alerts.incorrectRangeMessage', { range: bird.range }));
            }
        }

        else if (questionIndex === 3) {
            const extinct = bird.extinct && bird.extinct.trim() !== '';
            const correctAnswer = extinct ? "t('buttons.yes')" : t('buttons.no');

            if (selectedAnswer === correctAnswer) {
                answeredCorrectly = true;
                Alert.alert(t('alerts.correctTitle'), t('alerts.correctStatusMessage', { status: correctAnswer }),
                    [
                        { text: t('common.ok'), onPress: () => console.log('OK pressed') }
                    ]
                );
            } else {
                Alert.alert(t('alerts.incorrectTitle'), t('alerts.incorrectStatusMessage', { status: correctAnswer }));
            }
        }
        setIsAnswered(true);
        setCorrect(answeredCorrectly);
    };

    if (!bird) return null;

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Image
                    source={getBirdImageSource(bird.scientific_name)}
                    style={styles.image}
                    resizeMode="cover"
                />
                <Text style={{ fontSize: 18, marginBottom: 10, color: colors.text.primary }}>
                    {questionIndex === 3 && t('questions.birdExtinct')}
                </Text>
                {questionIndex === 3 ? (
                    // Für die 3. Frage 
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                        <Button
                            title={t('buttons.yes')}
                            variant={selectedAnswer === t('buttons.yes') ? 'primary' : 'secondary'}
                            onPress={() => setSelectedAnswer(t('buttons.yes'))}
                        />
                        <Button
                            title={t('buttons.no')}
                            variant={selectedAnswer === t('buttons.no') ? 'primary' : 'secondary'}
                            onPress={() => setSelectedAnswer(t('buttons.no'))}
                        />
                    </View>
                ) : (
                    // Für Frage 1 und 2 das TextInput
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.border.primary,
                            color: colors.text.primary,
                        }]}
                        placeholder={questionIndex === 1 ? t('questions.birdName') : t('questions.birdRange')}
                        placeholderTextColor={colors.text.tertiary}
                        value={input}
                        onChangeText={setInput}
                    />
                )}
                <View style={{ marginTop: 10 }}>
                    <Button
                        size="md"
                        variant="primary"
                        onPress={checkAnswer}
                        title={t('buttons.checkAnswer')}
                    />
                </View>
                <View style={{ marginTop: 10 }}>
                    <Button
                        size="md"
                        variant="secondary"
                        onPress={() => {
                            if (questionIndex === 3) {
                                navigation.goBack();  // Zurück zur vorherigen Seite
                            } else {
                                setQuestionIndex(prev => prev + 1);
                                setInput('');
                                setSelectedAnswer(null);
                                setIsAnswered(false);
                                setCorrect(false);
                            }
                        }}
                        title={questionIndex === 3 ? t('buttons.finish') : t('buttons.nextQuestion')}
                        disabled={!isAnswered}
                    />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20, alignItems: 'center' },
    image: { width: 250, height: 250, borderRadius: 12, marginBottom: 16 },
    input: { width: '100%', borderWidth: 1, padding: 8, borderRadius: 8, marginBottom: 12 }
});