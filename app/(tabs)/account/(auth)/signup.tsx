import React, {useRef, useState} from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import {useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import { ThemedIcon } from '@/components/ThemedIcon';
import Animated, {useAnimatedStyle, useSharedValue, withSpring, withTiming,} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Firebase imports
import {createUserWithEmailAndPassword} from 'firebase/auth';
import {auth} from '@/firebase/config';
import { UserProfileService } from '@/services/userProfile';

import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ModernCard} from '@/components/ModernCard';
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import {useSnackbar} from '@/components/ThemedSnackbar';
import {useColorVariants, useMotionValues, useSemanticColors, useTheme, useTypography,} from '@/hooks/useThemeColor';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface FormField {
    value: string;
    error: string;
    focused: boolean;
    valid: boolean;
}

interface FormState {
    email: FormField;
    password: FormField;
    confirmPassword: FormField;
}

export default function ModernSignupScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const theme = useTheme();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const motion = useMotionValues();
    const { showError, showSuccess, SnackbarComponent } = useSnackbar();

    // Form state
    const [formState, setFormState] = useState<FormState>({
        email: { value: '', error: '', focused: false, valid: false },
        password: { value: '', error: '', focused: false, valid: false },
        confirmPassword: { value: '', error: '', focused: false, valid: false },
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

    // Refs for input navigation
    const emailRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);
    const confirmPasswordRef = useRef<TextInput>(null);

    // Animation values
    const containerOpacity = useSharedValue(0);
    const contentTranslateY = useSharedValue(30);
    const headerScale = useSharedValue(0.9);

    React.useEffect(() => {
        // Entrance animation
        containerOpacity.value = withTiming(1, { duration: 300 });
        contentTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        headerScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }, []);

    // Validation functions
    const validateEmail = (email: string): { valid: boolean; error: string } => {
        if (!email) return { valid: false, error: t('errors.email_required') };
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return { valid: false, error: t('errors.invalid_email') };
        return { valid: true, error: '' };
    };

    const validatePassword = (password: string): { valid: boolean; error: string } => {
        if (!password) return { valid: false, error: t('errors.password_required') };
        if (password.length < 6) return { valid: false, error: t('errors.weak_password') };
        return { valid: true, error: '' };
    };

    const validateConfirmPassword = (password: string, confirmPassword: string): { valid: boolean; error: string } => {
        if (!confirmPassword) return { valid: false, error: t('app_errors.confirm_password_required') };
        if (password !== confirmPassword) return { valid: false, error: t('app_errors.passwords_do_not_match') };
        return { valid: true, error: '' };
    };

    // Update form field
    const updateField = (field: keyof FormState, value: string) => {
        let validation = { valid: false, error: '' };

        switch (field) {
            case 'email':
                validation = validateEmail(value);
                break;
            case 'password':
                validation = validatePassword(value);
                break;
            case 'confirmPassword':
                validation = validateConfirmPassword(formState.password.value, value);
                break;
        }

        setFormState(prev => ({
            ...prev,
            [field]: {
                ...prev[field],
                value,
                ...validation,
            }
        }));
    };

    // Handle field focus
    const handleFocus = (field: keyof FormState) => {
        Haptics.selectionAsync();
        setFormState(prev => ({
            ...prev,
            [field]: { ...prev[field], focused: true }
        }));
    };

    const handleBlur = (field: keyof FormState) => {
        setFormState(prev => ({
            ...prev,
            [field]: { ...prev[field], focused: false }
        }));
    };

    // Handle signup with Firebase
    const handleSignup = async () => {
        // Validate all fields
        const emailValidation = validateEmail(formState.email.value);
        const passwordValidation = validatePassword(formState.password.value);
        const confirmPasswordValidation = validateConfirmPassword(
            formState.password.value,
            formState.confirmPassword.value
        );

        if (!emailValidation.valid || !passwordValidation.valid || !confirmPasswordValidation.valid) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showError('Please fix the errors in the form');
            return;
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Firebase signup
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                formState.email.value,
                formState.password.value
            );

            console.log(t('app_errors.user_created'), userCredential.user);

            // Create user profile in Firestore
            await UserProfileService.createUserProfile(
                userCredential.user.uid,
                userCredential.user.email
            );

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showSuccess('Account created successfully!');

            // Navigate to account tab instead of tabs root to avoid navigation conflicts
            setTimeout(() => {
                router.replace('/(tabs)/account');
            }, 1000);

        } catch (error: unknown) {
            console.error(t('app_errors.signup_error'), error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            // Handle Firebase auth errors
            let errorMessage = t('errors.signup_error');
            
            // Type check for Firebase auth error
            if (error && typeof error === 'object' && 'code' in error) {
                const firebaseError = error as { code: string; message?: string };
                switch (firebaseError.code) {
                case 'auth/email-already-in-use':
                    errorMessage = t('errors.signup_email_in_use');
                    break;
                case 'auth/weak-password':
                    errorMessage = t('errors.weak_password');
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = t('errors.operation_not_allowed');
                    break;
                case 'auth/network-request-failed':
                    errorMessage = t('errors.network_error');
                    break;
                case 'auth/invalid-email':
                    errorMessage = t('errors.invalid_email');
                    break;
                case 'auth/too-many-requests':
                    errorMessage = t('errors.too_many_requests');
                    break;
                default:
                    errorMessage = firebaseError.message || t('errors.signup_error');
                }
            } else {
                errorMessage = error instanceof Error ? error.message : t('errors.signup_error');
            }

            showError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Get input style based on state
    const getInputStyle = (field: FormField) => {
        if (field.error && !field.focused) {
            return {
                borderColor: semanticColors.error,
                backgroundColor: variants.secondary.light,
            };
        }
        if (field.focused) {
            return {
                borderColor: semanticColors.primary,
                backgroundColor: semanticColors.surface,
            };
        }
        if (field.valid) {
            return {
                borderColor: semanticColors.success,
                backgroundColor: semanticColors.surface,
            };
        }
        return {
            borderColor: semanticColors.secondary,
            backgroundColor: semanticColors.surface,
        };
    };

    // Animated styles
    const containerStyle = useAnimatedStyle(() => ({
        opacity: containerOpacity.value,
        transform: [{ translateY: contentTranslateY.value }],
    }));

    const headerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: headerScale.value }],
    }));

    const isFormValid = formState.email.valid && formState.password.valid && formState.confirmPassword.valid;

    return (
        <ThemedSafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Animated.View style={[styles.content, containerStyle]}>
                        {/* Header Section */}
                        <Animated.View style={[styles.header, headerStyle]}>
                            <View style={[styles.logoContainer, { backgroundColor: variants.primary.light }]}>
                                <ThemedIcon name="feather" size={32} color="accent" />
                            </View>

                            <ThemedText variant="displayMedium" style={styles.title}>
                                {t('auth.signup_title')}
                            </ThemedText>

                            <ThemedText
                                variant="bodyLarge"
                                color="secondary"
                                style={styles.subtitle}
                            >
                                {t('auth.signup_subtitle')}
                            </ThemedText>
                        </Animated.View>

                        {/* Form Card */}
                        <ModernCard elevated={false} bordered={true} style={styles.formCard}>
                            <View style={styles.form}>
                                {/* Email Field */}
                                <View style={styles.inputGroup}>
                                    <ThemedText variant="label" style={styles.inputLabel}>
                                        {t('auth.email_placeholder')}
                                    </ThemedText>
                                    <View style={[styles.inputContainer, getInputStyle(formState.email)]}>
                                        <ThemedIcon
                                            name="mail"
                                            size={20}
                                            color={formState.email.focused ? "accent" : "secondary"}
                                        />
                                        <AnimatedTextInput
                                            ref={emailRef}
                                            style={[styles.textInput, { color: semanticColors.primary }]}
                                            placeholder={t('auth.email_placeholder')}
                                            placeholderTextColor={semanticColors.secondary}
                                            value={formState.email.value}
                                            onChangeText={(text) => updateField('email', text)}
                                            onFocus={() => handleFocus('email')}
                                            onBlur={() => handleBlur('email')}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoComplete="email"
                                            returnKeyType="next"
                                            onSubmitEditing={() => passwordRef.current?.focus()}
                                        />
                                        {formState.email.valid && (
                                            <ThemedIcon name="check" size={20} color="success" />
                                        )}
                                    </View>
                                    {formState.email.error ? (
                                        <ThemedText variant="caption" color="error" style={styles.errorText}>
                                            {formState.email.error}
                                        </ThemedText>
                                    ) : null}
                                </View>

                                {/* Password Field */}
                                <View style={styles.inputGroup}>
                                    <ThemedText variant="label" style={styles.inputLabel}>
                                        {t('auth.password_placeholder')}
                                    </ThemedText>
                                    <View style={[styles.inputContainer, getInputStyle(formState.password)]}>
                                        <ThemedIcon
                                            name="lock"
                                            size={20}
                                            color={formState.password.focused ? "accent" : "secondary"}
                                        />
                                        <AnimatedTextInput
                                            ref={passwordRef}
                                            style={[styles.textInput, { color: semanticColors.primary }]}
                                            placeholder={t('auth.password_placeholder')}
                                            placeholderTextColor={semanticColors.secondary}
                                            value={formState.password.value}
                                            onChangeText={(text) => updateField('password', text)}
                                            onFocus={() => handleFocus('password')}
                                            onBlur={() => handleBlur('password')}
                                            secureTextEntry={!isPasswordVisible}
                                            autoComplete="new-password"
                                            returnKeyType="next"
                                            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                                        />
                                        <Pressable
                                            onPress={() => {
                                                setIsPasswordVisible(!isPasswordVisible);
                                                Haptics.selectionAsync();
                                            }}
                                            style={styles.eyeButton}
                                        >
                                            <ThemedIcon
                                                name={isPasswordVisible ? "eye-off" : "eye"}
                                                size={20}
                                                color="secondary"
                                            />
                                        </Pressable>
                                    </View>
                                    {formState.password.error ? (
                                        <ThemedText variant="caption" color="error" style={styles.errorText}>
                                            {formState.password.error}
                                        </ThemedText>
                                    ) : null}
                                </View>

                                {/* Confirm Password Field */}
                                <View style={styles.inputGroup}>
                                    <ThemedText variant="label" style={styles.inputLabel}>
                                        Confirm Password
                                    </ThemedText>
                                    <View style={[styles.inputContainer, getInputStyle(formState.confirmPassword)]}>
                                        <ThemedIcon
                                            name="shield"
                                            size={20}
                                            color={formState.confirmPassword.focused ? "accent" : "secondary"}
                                        />
                                        <AnimatedTextInput
                                            ref={confirmPasswordRef}
                                            style={[styles.textInput, { color: semanticColors.primary }]}
                                            placeholder={t('app_errors.confirm_password_placeholder')}
                                            placeholderTextColor={semanticColors.secondary}
                                            value={formState.confirmPassword.value}
                                            onChangeText={(text) => updateField('confirmPassword', text)}
                                            onFocus={() => handleFocus('confirmPassword')}
                                            onBlur={() => handleBlur('confirmPassword')}
                                            secureTextEntry={!isConfirmPasswordVisible}
                                            autoComplete="new-password"
                                            returnKeyType="done"
                                            onSubmitEditing={handleSignup}
                                        />
                                        <Pressable
                                            onPress={() => {
                                                setIsConfirmPasswordVisible(!isConfirmPasswordVisible);
                                                Haptics.selectionAsync();
                                            }}
                                            style={styles.eyeButton}
                                        >
                                            <ThemedIcon
                                                name={isConfirmPasswordVisible ? "eye-off" : "eye"}
                                                size={20}
                                                color="secondary"
                                            />
                                        </Pressable>
                                    </View>
                                    {formState.confirmPassword.error ? (
                                        <ThemedText variant="caption" color="error" style={styles.errorText}>
                                            {formState.confirmPassword.error}
                                        </ThemedText>
                                    ) : null}
                                </View>

                                {/* Sign Up Button */}
                                <ThemedPressable
                                    variant="primary"
                                    size="lg"
                                    fullWidth
                                    onPress={handleSignup}
                                    disabled={!isFormValid || isLoading}
                                    style={styles.signupButton}
                                >
                                    {isLoading ? (
                                        <ThemedIcon name="loader" size={20} color="primary" />
                                    ) : (
                                        <ThemedIcon name="user-plus" size={20} color="primary" />
                                    )}
                                    <ThemedText variant="labelLarge" color="primary">
                                        {isLoading ? 'Creating Account...' : t('auth.signup')}
                                    </ThemedText>
                                </ThemedPressable>
                            </View>
                        </ModernCard>

                        {/* Footer Links */}
                        <View style={styles.footer}>
                            <ThemedPressable
                                variant="ghost"
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    router.back();
                                }}
                                style={styles.footerButton}
                            >
                                <ThemedText variant="body" color="secondary">
                                    {t('auth.already_have_account')}
                                </ThemedText>
                            </ThemedPressable>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            <SnackbarComponent />
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
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    content: {
        alignItems: 'center',
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
    },

    // Header
    header: {
        alignItems: 'center',
        marginBottom: 32,
        gap: 16,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        lineHeight: 24,
    },

    // Form
    formCard: {
        width: '100%',
        marginBottom: 24,
    },
    form: {
        padding: 24,
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    inputLabel: {
        fontWeight: '600',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
        gap: 12,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '400',
    },
    eyeButton: {
        padding: 4,
    },
    errorText: {
        color: '#F44336',
        marginTop: 4,
    },
    signupButton: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },

    // Footer
    footer: {
        alignItems: 'center',
        gap: 16,
    },
    footerButton: {
        paddingVertical: 8,
    },
});