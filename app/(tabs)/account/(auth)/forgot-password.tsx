import React, {useRef, useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View,} from 'react-native';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Animated, {
    FadeInDown,
    FadeOutUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedText} from '@/components/ThemedText';
import {ThemedIcon} from '@/components/ThemedIcon';
import {ModernCard} from '@/components/ModernCard';
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import {useSnackbar} from '@/components/ThemedSnackbar';
import {useTheme, useSemanticColors, useColorVariants} from '@/hooks/useThemeColor';
import {sendPasswordResetEmail} from 'firebase/auth';
import {auth} from '@/firebase/config';

// Validation helper
const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export default function ForgotPasswordScreen() {
    const { t } = useTranslation();
    const theme = useTheme();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const snackbar = useSnackbar();

    // Form state
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [errors, setErrors] = useState<{ email?: string }>({});

    // Refs
    const emailInputRef = useRef<TextInput>(null);

    // Animation values
    const cardScale = useSharedValue(0.95);
    const cardOpacity = useSharedValue(0);
    const formOpacity = useSharedValue(1);

    React.useEffect(() => {
        // Entrance animation
        cardScale.value = withSpring(1, { damping: 20, stiffness: 300 });
        cardOpacity.value = withTiming(1, { duration: theme.motion.duration.normal });
    }, [cardOpacity, cardScale, theme.motion.duration.normal]);

    // Form validation
    const validateForm = (): boolean => {
        const newErrors: { email?: string } = {};

        if (!email.trim()) {
            newErrors.email = t('errors.email_required');
        } else if (!validateEmail(email.trim())) {
            newErrors.email = t('errors.invalid_email');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async () => {
        if (!validateForm()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsLoading(true);
        setErrors({});

        try {
            // Send password reset email via Firebase
            await sendPasswordResetEmail(auth, email.trim());

            // Success animation
            formOpacity.value = withTiming(0, { duration: theme.motion.duration.fast });

            setTimeout(() => {
                setEmailSent(true);
                formOpacity.value = withTiming(1, { duration: theme.motion.duration.normal });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }, theme.motion.duration.fast);

        } catch (error: unknown) {
            console.error('Password reset error:', error);

            // Handle Firebase Auth specific error codes
            let errorMessage = t('errors.sending_reset_error');
            if (error && typeof error === 'object' && 'code' in error) {
                switch ((error as { code: string }).code) {
                case 'auth/user-not-found':
                    errorMessage = t('errors.user_not_found');
                    break;
                case 'auth/invalid-email':
                    errorMessage = t('errors.invalid_email');
                    break;
                case 'auth/too-many-requests':
                    errorMessage = t('errors.too_many_requests');
                    break;
                case 'auth/network-request-failed':
                    errorMessage = t('errors.network_error');
                    break;
                default:
                    errorMessage = t('errors.sending_reset_error');
                }
            } else {
                errorMessage = error instanceof Error ? error.message : t('errors.sending_reset_error');
            }

            snackbar.showError(errorMessage);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle back navigation
    const handleBack = () => {
        Haptics.selectionAsync();
        router.back();
    };

    // Animated styles
    const cardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
        opacity: cardOpacity.value,
    }));

    const formAnimatedStyle = useAnimatedStyle(() => ({
        opacity: formOpacity.value,
    }));

    // Success screen content
    const renderSuccessScreen = () => (
        <Animated.View
            entering={FadeInDown.duration(theme.motion.duration.normal)}
            style={styles.successContainer}
        >
            <View style={[styles.successIcon, { backgroundColor: theme.colors.text.primary, opacity: 0.1 }]}>
                <ThemedIcon name="mail" size={48} color="primary" />
            </View>

            <ThemedText variant="headlineLarge" style={styles.successTitle}>
                {t('auth.email_sent_title')}
            </ThemedText>

            <ThemedText
                variant="bodyLarge"
                color="secondary"
                style={styles.successMessage}
            >
                {t('auth.email_sent_message', { email })}
            </ThemedText>

            <ThemedPressable
                variant="primary"
                size="lg"
                onPress={handleBack}
                style={styles.backButton}
            >
                <ThemedText variant="labelLarge" style={{ color: semanticColors.background }}>
                    {t('auth.back_to_login')}
                </ThemedText>
            </ThemedPressable>
        </Animated.View>
    );

    // Form screen content
    const renderFormScreen = () => (
        <Animated.View style={formAnimatedStyle}>
            {/* Header */}
            <View style={styles.header}>
                <ThemedText variant="displaySmall" style={styles.title}>
                    {t('auth.forgot_password_title')}
                </ThemedText>

                <ThemedText
                    variant="bodyLarge"
                    color="secondary"
                    style={styles.instructions}
                >
                    {t('auth.forgot_password_instructions')}
                </ThemedText>
            </View>

            {/* Form */}
            <View style={styles.form}>
                {/* Email Input */}
                <View style={styles.inputContainer}>
                    <ThemedText variant="labelLarge" style={styles.inputLabel}>
                        {t('auth.email_placeholder')}
                    </ThemedText>

                    <View style={[
                        styles.inputWrapper,
                        {
                            borderColor: errors.email
                                ? theme.colors.status.error
                                : theme.colors.border.primary,
                            backgroundColor: theme.colors.background.secondary,
                        }
                    ]}>
                        <ThemedIcon
                            name="mail"
                            size={20}
                            color={errors.email ? 'error' : 'tertiary'}
                        />
                        <TextInput
                            ref={emailInputRef}
                            style={[styles.textInput, { color: theme.colors.text.primary }]}
                            placeholder={t('auth.email_placeholder')}
                            placeholderTextColor={theme.colors.text.tertiary}
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                if (errors.email) {
                                    setErrors(prev => ({ ...prev, email: undefined }));
                                }
                            }}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            textContentType="emailAddress"
                            returnKeyType="send"
                            onSubmitEditing={handleSubmit}
                            editable={!isLoading}
                        />
                    </View>

                    {errors.email && (
                        <Animated.View
                            entering={FadeInDown.duration(200)}
                            exiting={FadeOutUp.duration(200)}
                            style={styles.errorContainer}
                        >
                            <ThemedIcon name="alert-circle" size={14} color="error" />
                            <ThemedText variant="labelSmall" color="error" style={styles.errorText}>
                                {errors.email}
                            </ThemedText>
                        </Animated.View>
                    )}
                </View>

                {/* Submit Button */}
                <ThemedPressable
                    variant="primary"
                    size="lg"
                    onPress={handleSubmit}
                    disabled={isLoading || !email.trim()}
                    style={styles.submitButton}
                >
                    <ThemedText variant="labelLarge" style={{ color: semanticColors.background }}>
                        {t('auth.send_reset')}
                    </ThemedText>
                </ThemedPressable>

                {/* Back to Login */}
                <ThemedPressable
                    variant="ghost"
                    onPress={handleBack}
                    disabled={isLoading}
                    style={styles.backToLoginButton}
                >
                    <ThemedIcon name="arrow-left" size={16} color="primary" />
                    <ThemedText variant="labelMedium" color="accent">
                        {t('auth.back_to_login')}
                    </ThemedText>
                </ThemedPressable>
            </View>
        </Animated.View>
    );

    return (
        <ThemedSafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Background Elements */}
                    <View style={StyleSheet.absoluteFillObject}>
                        <View style={[
                            styles.backgroundCircle,
                            { backgroundColor: variants.primary.light }
                        ]} />
                        <View style={[
                            styles.backgroundCircle2,
                            { backgroundColor: variants.secondary.light }
                        ]} />
                    </View>

                    {/* Main Card */}
                    <Animated.View style={[styles.cardContainer, cardAnimatedStyle]}>
                        <ModernCard
                            elevated={false}
                            bordered={true}
                            style={{
                                borderColor: variants.primary.light,
                                ...theme.shadows.lg,
                            }}
                        >
                            <View style={styles.cardContent}>
                                {emailSent ? renderSuccessScreen() : renderFormScreen()}
                            </View>
                        </ModernCard>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Snackbar */}
            <snackbar.SnackbarComponent />
        </ThemedSafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 40,
    },
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
        minHeight: '100%',
    },

    // Background
    backgroundCircle: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        top: -150,
        right: -150,
        opacity: 0.03,
    },
    backgroundCircle2: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        bottom: -100,
        left: -100,
        opacity: 0.02,
    },

    // Card
    cardContainer: {
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
    },
    cardContent: {
        padding: 32,
    },

    // Header
    header: {
        marginBottom: 32,
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
        marginBottom: 12,
        fontWeight: '700',
    },
    instructions: {
        textAlign: 'center',
        lineHeight: 24,
    },

    // Form
    form: {
        gap: 24,
    },
    inputContainer: {
        gap: 8,
    },
    inputLabel: {
        fontWeight: '600',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 12,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        lineHeight: 20,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    errorText: {
        fontSize: 12,
        lineHeight: 16,
    },

    // Buttons
    submitButton: {
        marginTop: 8,
    },
    backToLoginButton: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Success State
    successContainer: {
        alignItems: 'center',
        gap: 20,
    },
    successIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    successTitle: {
        textAlign: 'center',
        fontWeight: '700',
    },
    successMessage: {
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 280,
    },
    backButton: {
        marginTop: 16,
        minWidth: 160,
    },
});