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
import { TouchableOpacity } from 'react-native';
import { Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';

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
    const [options, setOptions] = useState<BirdDexRecord[]>([]);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [score, setScore] = useState(0);
    const router = useRouter();
    const totalQuestions = 3;

    useEffect(() => {
        const birds = queryBirdDexPage('', 'english_name', true, 100, 1, 'all');
        const getValidBirdWithImage = (): BirdDexRecord | null => {
            for (let i = 0; i < birds.length; i++) {
                const candidate = birds[Math.floor(Math.random() * birds.length)];
                const image = getBirdImageSource(candidate.scientific_name);
                if (image) return candidate;
            }
            return null;
        };

        const selectOptions = () => {
            const selectedNames = new Set<string>();
            const selectedImages = new Set<string>();
            const results: BirdDexRecord[] = [];

            while (results.length < 4 && selectedNames.size < birds.length) {
                const candidate = birds[Math.floor(Math.random() * birds.length)];
                const image = getBirdImageSource(candidate.scientific_name);

                if (
                    image &&
                    !selectedNames.has(candidate.scientific_name) &&
                    !selectedImages.has(image.uri || image)
                ) {
                    selectedNames.add(candidate.scientific_name);
                    selectedImages.add(image.uri || image);
                    results.push(candidate);
                }
            }

            return results;
        };


        const options = selectOptions();

        if (options.length === 4) {
            const correct = options[Math.floor(Math.random() * options.length)];
            setOptions(options);
            setBird(correct);
        } else {
            console.warn('Nicht genügend gültige Bilder gefunden');
        }
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
        if (questionIndex === 1) return;

        else if (questionIndex === 2) {
            Keyboard.dismiss();
            const answer = bird.range.toLowerCase().trim();
            const guess = input.toLowerCase().trim();
            const distance = levenshtein.get(answer, guess);

            if (guess.length >= 3 && (distance <= 2 || answer.includes(guess) || guess.includes(answer))) {
                answeredCorrectly = true;
                setScore(prev => prev + 1);
                Alert.alert(t('alerts.correctTitle'), t('alerts.correctRangeMessage', { range: bird.range }),
                    [{ text: t('common.ok') }]);
            } else {
                Alert.alert(t('alerts.incorrectTitle'), t('alerts.incorrectRangeMessage', { range: bird.range }),
                    [{ text: t('common.ok') }]);
            }
        }

        else if (questionIndex === 3) {
            const extinct = bird.extinct && bird.extinct.trim() !== '';
            const correctAnswer = extinct ? "t('buttons.yes')" : t('buttons.no');

            if (selectedAnswer === correctAnswer) {
                answeredCorrectly = true;
                setScore(prev => prev + 1);
                Alert.alert(t('alerts.correctTitle'), t('alerts.correctStatusMessage', { status: correctAnswer }),
                    [
                        { text: t('common.ok'), onPress: () => console.log('OK pressed') }
                    ]
                );
            } else {
                Alert.alert(t('alerts.incorrectTitle'), t('alerts.incorrectStatusMessage', { status: correctAnswer }),
                    [{ text: t('common.ok') }]
                );
            }
        }
        setIsAnswered(true);
        setCorrect(answeredCorrectly);
    };

    if (!bird) return null;
    const name = bird.english_name;
    if (questionIndex === 4) {
        return (
            <View style={styles.container}>
                <LottieView
                    source={
                        score >= 2
                            ? require('@/assets/quiz/success-animation.json')
                            : require('@/assets/quiz/failure-animation.json')
                    }
                    autoPlay
                    loop={true}
                    style={{ width: 200, height: 200, marginTop: 40, marginBottom: 5 }}
                />
                <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>
                    {t('results.title')}
                </Text>
                <Text style={{ fontSize: 20, marginBottom: 40, textAlign: 'center' }}>
                    {score >= 2
                        ? t('results.successMessage', { score })
                        : t('results.failureMessage')}
                </Text>

                {/* Restart */}
                <TouchableOpacity
                    onPress={() => {
                        setQuestionIndex(1);
                        setScore(0);
                        setInput('');
                        setSelectedAnswer(null);
                        setIsAnswered(false);
                        setCorrect(false);

                        const birds = queryBirdDexPage('', 'english_name', true, 100, 1, 'all');
                        const options: BirdDexRecord[] = [];

                        const selectedNames = new Set<string>();
                        const selectedImages = new Set<string>();

                        while (options.length < 4 && selectedNames.size < birds.length) {
                            const candidate = birds[Math.floor(Math.random() * birds.length)];
                            const image = getBirdImageSource(candidate.scientific_name);

                            if (
                                image &&
                                !selectedNames.has(candidate.scientific_name) &&
                                !selectedImages.has(image.uri || image)
                            ) {
                                selectedNames.add(candidate.scientific_name);
                                selectedImages.add(image.uri || image);
                                options.push(candidate);
                            }
                        }

                        if (options.length === 4) {
                            const correct = options[Math.floor(Math.random() * options.length)];
                            setOptions(options);
                            setBird(correct);
                        }
                    }}
                    style={{ marginBottom: 15 }}
                >
                    <Ionicons name="refresh-circle" size={52} color={colors.text.secondary} />
                </TouchableOpacity>
                <Button
                    title={t('buttons.backToHome')}
                    onPress={() => router.replace('/birdex')}
                    variant="primary"
                />

            </View>
        );
    }

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
                <View style={{ width: '90%', alignItems: 'flex-end', marginTop: 10 }}>
                    <Text style={{ fontSize: 16, color: colors.text.secondary }}>
                        {questionIndex}/{totalQuestions}
                    </Text>
                </View>


                {(questionIndex === 2 || questionIndex === 3) && (
                    <Image
                        source={getBirdImageSource(bird.scientific_name)}
                        style={[styles.image, { marginTop: 60 }]}
                        resizeMode="cover"
                    />
                )}
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
                            disabled={isAnswered}
                        />
                        <Button
                            title={t('buttons.no')}
                            variant={selectedAnswer === t('buttons.no') ? 'primary' : 'secondary'}
                            onPress={() => setSelectedAnswer(t('buttons.no'))}
                            disabled={isAnswered}
                        />
                    </View>
                ) : questionIndex === 1 && bird ? (
                    // Frage 1 – Bildauswahl
                    <>
                        <Text style={{ fontSize: 18, marginBottom: 25, color: colors.text.primary }}>
                            {t('questions.selectCorrectImage', { name: bird.english_name || bird.de_name || bird.scientific_name })}
                        </Text>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>

                            {options.map((option) => {
                                const imageSource = getBirdImageSource(option.scientific_name);
                                if (!imageSource) return null;
                                const isSelected = selectedOption === option.scientific_name;
                                const isCorrectBird = bird?.scientific_name === option.scientific_name;
                                const borderColor = !isAnswered
                                    ? 'transparent'
                                    : isCorrectBird
                                        ? 'green'
                                        : isSelected
                                            ? 'red'
                                            : 'transparent';

                                return (
                                    <TouchableOpacity
                                        key={option.scientific_name}
                                        disabled={isAnswered}
                                        onPress={() => {
                                            const isCorrect = option.scientific_name === bird?.scientific_name;
                                            setIsAnswered(true);
                                            setCorrect(isCorrect);
                                            setSelectedOption(option.scientific_name);
                                            if (isCorrect) {
                                                setScore(prev => prev + 1);
                                            }
                                            Alert.alert(
                                                t(isCorrect ? 'alerts.correctTitle' : 'alerts.incorrectTitle'),
                                                isCorrect
                                                    ? t('alerts.correctMessage', { name: bird.english_name || bird.de_name || bird.scientific_name })
                                                    : t('alerts.incorrectMessageWithGuess', {
                                                        correctName: bird.english_name,
                                                        guessName: option.english_name || option.de_name || option.scientific_name
                                                    }),
                                                [
                                                    { text: t('common.ok') }
                                                ]
                                            );

                                        }}
                                        style={{
                                            margin: 5,
                                            borderRadius: 12,
                                            borderWidth: 3,
                                            borderColor: borderColor,
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Image
                                            source={getBirdImageSource(option.scientific_name)}
                                            style={{ width: 150, height: 150, borderRadius: 12 }}
                                            resizeMode="cover"
                                        />
                                    </TouchableOpacity>
                                );
                            })}

                        </View>
                    </>
                ) : (
                    <>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.border.primary,
                                color: colors.text.primary,
                            }]}
                            placeholder={t('questions.birdRange')}
                            placeholderTextColor={colors.text.tertiary}
                            value={input}
                            onChangeText={setInput}
                            editable={!isAnswered}
                        />
                        {questionIndex === 2 && input.trim().length > 0 && input.trim().length < 3 && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>
                                {t('alerts.inputTooShort')}
                            </Text>
                        )}
                        {questionIndex === 2 && (
                            <Text style={{ fontSize: 14, color: 'gray', marginBottom: 4 }}>
                                {t('questions.answerInEnglish')}
                            </Text>
                        )}
                    </>
                )}



                {questionIndex !== 1 && (
                    <View style={{ marginTop: 10 }}>
                        <Button
                            size="md"
                            variant="primary"
                            onPress={checkAnswer}
                            title={t('buttons.checkAnswer')}
                            disabled={
                                (questionIndex === 2 && input.trim().length < 3) || // Für Frage 2
                                (questionIndex === 3 && (!selectedAnswer || isAnswered)) // Für Frage 3
                            }
                        />
                    </View>
                )}
                <View style={{ marginTop: 10 }}>
                    <Button
                        size="md"
                        variant="secondary"
                        onPress={() => {
                            if (questionIndex === 3) {
                                setQuestionIndex(4);
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
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: { padding: 20, alignItems: 'center' },
    image: { width: 250, height: 250, borderRadius: 12, marginBottom: 16 },
    input: { width: '100%', borderWidth: 1, padding: 8, borderRadius: 8, marginBottom: 12 }
});