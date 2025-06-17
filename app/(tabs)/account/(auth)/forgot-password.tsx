import React, { useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { router, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/firebase/config';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ModernCard } from '@/components/ModernCard';
import { ThemedIcon } from '@/components/ThemedIcon';
import {
    useTheme,
    useTypography,
    useSemanticColors,
    useColorVariants,
} from '@/hooks/useThemeColor';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Forgot Password screen component
 * Handles password reset email sending
 */
export default function ForgotPasswordScreen() {
    const { t } = useTranslation();
    const theme = useTheme();
    const typography = useTypography();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();

    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    // Animation values
    const resetButtonScale = useSharedValue(1);
    const fadeInOpacity = useSharedValue(0);

    React.useEffect(() => {
        fadeInOpacity.value = withTiming(1, { duration: 600 });
    }, []);

    const fadeInStyle = useAnimatedStyle(() => ({
        opacity: fadeInOpacity.value,
        transform: [{ translateY: withTiming(fadeInOpacity.value === 1 ? 0 : 30) }],
    }));

    const resetButtonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: resetButtonScale.value }],
    }));

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handlePasswordReset = async () => {
        if (!email.trim()) {
            Alert.alert(
                t('auth.error', 'Error'),
                t('auth.email_required', 'Please enter your email address')
            );
            return;
        }

        if (!validateEmail(email.trim())) {
            Alert.alert(
                t('auth.error', 'Error'),
                t('auth.invalid_email', 'Please enter a valid email address')
            );
            return;
        }

        if (!auth) {
            Alert.alert(
                t('auth.error', 'Error'),
                t('auth.firebase_unavailable', 'Authentication service is not available')
            );
            return;
        }

        setIsLoading(true);

        try {
            await sendPasswordResetEmail(auth, email.trim());
            setEmailSent(true);
        } catch (error: any) {
            console.error('Password reset error:', error);

            let errorMessage = t('auth.reset_error', 'Failed to send reset email. Please try again.');

            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = t('auth.email_not_found', 'No account found with this email address');
                    break;
                case 'auth/invalid-email':
                    errorMessage = t('auth.invalid_email', 'Please enter a valid email address');
                    break;
                case 'auth/too-many-requests':
                    errorMessage = t('auth.too_many_reset_requests', 'Too many reset requests. Please try again later');
                    break;
                case 'auth/network-request-failed':
                    errorMessage = t('auth.network_error', 'Network error. Please check your connection');
                    break;
            }

            Alert.alert(t('auth.error', 'Error'), errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPressIn = () => {
        resetButtonScale.value = withSpring(0.95);
    };

    const handleResetPressOut = () => {
        resetButtonScale.value = withSpring(1);
    };

    const handleBackToLogin = () => {
        router.replace('/(tabs)/account/(auth)/login');
    };

    const handleResendEmail = () => {
        setEmailSent(false);
        handlePasswordReset();
    };

    const isFormValid = email.trim() && validateEmail(email.trim()) && !isLoading;

    if (emailSent) {
        return (
            <ProtectedRoute requireAuth={false}>
                <ThemedSafeAreaView style={styles.container}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardContainer}
                    >
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            <Animated.View style={fadeInStyle}>
                                <View style={styles.header}>
                                    <View style={[styles.logoContainer, { backgroundColor: variants.primary.light }]}>
                                        <ThemedIcon name="mail" size={32} color="primary" />
                                    </View>
                                    <Text style={[typography.h2, styles.title, { color: semanticColors.primary }]}>
                                        {t('auth.email_sent', 'Email Sent')}
                                    </Text>
                                    <Text style={[typography.body, styles.subtitle, { color: semanticColors.secondary }]}>
                                        {t('auth.reset_email_sent_message', 'We have sent a password reset link to your email address')}
                                    </Text>
                                </View>

                                <ModernCard elevated={true} bordered={false} style={styles.successCard}>
                                    <View style={styles.successContent}>
                                        <View style={[styles.emailIconContainer, { backgroundColor: variants.primary.light }]}>
                                            <ThemedIcon name="check-circle" size={24} color="primary" />
                                        </View>
                                        <View style={styles.successText}>
                                            <Text style={[typography.body, { color: semanticColors.primary }]}>
                                                {t('auth.check_your_email', 'Check your email')}
                                            </Text>
                                            <Text style={[typography.label, { color: semanticColors.secondary }]}>
                                                {email}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.instructions}>
                                        <Text style={[typography.body, { color: semanticColors.secondary }]}>
                                            {t('auth.reset_instructions', 'Click the link in the email to reset your password. If you don\'t see the email, check your spam folder.')}
                                        </Text>
                                    </View>

                                    <Pressable
                                        style={[styles.resendButton, { backgroundColor: variants.secondary.light }]}
                                        onPress={handleResendEmail}
                                        android_ripple={{ color: variants.secondary.main + '33' }}
                                    >
                                        <ThemedIcon name="refresh-cw" size={18} color="secondary" />
                                        <Text style={[typography.body, { color: semanticColors.secondary, fontWeight: '500' }]}>
                                            {t('auth.resend_email', 'Resend Email')}
                                        </Text>
                                    </Pressable>
                                </ModernCard>

                                <View style={styles.backContainer}>
                                    <Pressable onPress={handleBackToLogin}>
                                        <Text style={[typography.body, styles.backLink, { color: semanticColors.primary }]}>
                                            ← {t('auth.back_to_login', 'Back to Login')}
                                        </Text>
                                    </Pressable>
                                </View>
                            </Animated.View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </ThemedSafeAreaView>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute requireAuth={false}>
            <ThemedSafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardContainer}
                >
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Animated.View style={fadeInStyle}>
                            <View style={styles.header}>
                                <View style={[styles.logoContainer, { backgroundColor: variants.primary.light }]}>
                                    <ThemedIcon name="key" size={32} color="primary" />
                                </View>
                                <Text style={[typography.h2, styles.title, { color: semanticColors.primary }]}>
                                    {t('auth.forgot_password_title', 'Forgot Password')}
                                </Text>
                                <Text style={[typography.body, styles.subtitle, { color: semanticColors.secondary }]}>
                                    {t('auth.forgot_password_subtitle', 'Enter your email to reset your password')}
                                </Text>
                            </View>

                            <ModernCard
                                elevated={true}
                                bordered={false}
                                style={{
                                    ...styles.formCard,
                                    backgroundColor: semanticColors.surface,
                                    shadowColor: semanticColors.secondary,
                                }}
                            >
                                <View style={styles.form}>
                                    <View style={styles.inputGroup}>
                                        <Text style={[typography.label, styles.label, { color: semanticColors.secondary }]}>
                                            {t('auth.email_label', 'Email')}
                                        </Text>
                                        <ThemedTextInput
                                            style={[styles.textInput, { borderRadius: 12 }]}
                                            placeholder={t('auth.email_placeholder', 'Enter your email')}
                                            value={email}
                                            onChangeText={setEmail}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            editable={!isLoading}
                                        />
                                    </View>

                                    <Animated.View style={[resetButtonAnimatedStyle, { marginTop: 16 }]}>
                                        <AnimatedPressable
                                            style={[
                                                styles.resetButton,
                                                {
                                                    backgroundColor: isFormValid ? semanticColors.primary : semanticColors.secondary,
                                                    borderRadius: 12,
                                                    paddingVertical: 14,
                                                },
                                            ]}
                                            onPress={handlePasswordReset}
                                            onPressIn={handleResetPressIn}
                                            onPressOut={handleResetPressOut}
                                            disabled={!isFormValid}
                                            android_ripple={{ color: theme.colors.surface + '33' }}
                                        >
                                            {isLoading ? (
                                                <View style={styles.loadingContainer}>
                                                    <Text style={[typography.body, styles.resetButtonText, { color: semanticColors.background }]}>
                                                        {t('auth.sending_reset', 'Sending Reset Link...')}
                                                    </Text>
                                                </View>
                                            ) : (
                                                <>
                                                    <ThemedIcon name="send" size={20} color="inverse" />
                                                    <Text style={[typography.body, styles.resetButtonText, { color: semanticColors.background }]}>
                                                        {t('auth.send_reset', 'Send Reset')}
                                                    </Text>
                                                </>
                                            )}
                                        </AnimatedPressable>
                                    </Animated.View>
                                </View>
                            </ModernCard>

                            <View style={[styles.signInContainer, { marginTop: 16 }]}>
                                <Text style={[typography.body, { color: semanticColors.secondary }]}>
                                    {t('auth.already_have_account', 'Already have an account?')}
                                </Text>
                                <Link href="/(tabs)/account/(auth)/login" asChild>
                                    <Pressable disabled={isLoading}>
                                        <Text style={[typography.body, styles.signInLink, { color: semanticColors.primary, marginLeft: 4 }]}>
                                            {t('auth.signin', 'Sign In')}
                                        </Text>
                                    </Pressable>
                                </Link>
                            </View>
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </ThemedSafeAreaView>
        </ProtectedRoute>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardContainer: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
        minHeight: '100%',
    },

    // Header
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        textAlign: 'center',
        marginBottom: 8,
        fontWeight: '600',
    },
    subtitle: {
        textAlign: 'center',
        lineHeight: 20,
    },

    // Form
    formCard: {
        marginBottom: 24,
        borderRadius: 16,
        padding: 24,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontWeight: '500',
        marginBottom: 4,
    },
    textInput: {
        minHeight: 48,
        paddingHorizontal: 16,
    },
    errorText: {
        fontSize: 12,
        marginTop: 4,
    },

    // Reset Button
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 8,
    },
    resetButtonText: {
        fontWeight: '600',
    },
    loadingContainer: {
        alignItems: 'center',
    },

    // Success Screen
    successCard: {
        marginBottom: 24,
    },
    successContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
    },
    emailIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    successText: {
        flex: 1,
        gap: 4,
    },
    instructions: {
        marginBottom: 20,
    },
    resendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 8,
    },

    // Navigation
    signInContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    signInLink: {
        fontWeight: '600',
    },
    backContainer: {
        alignItems: 'center',
    },
    backLink: {
        fontWeight: '500',
    },
}); 