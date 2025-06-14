import React, { useState } from 'react';
import {
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { ThemedIcon } from '@/components/ThemedIcon';
import Animated, {
    interpolate,
    SlideInRight,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Firebase imports
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebase/config';

// Local component imports
import { ModernCard } from '@/components/ModernCard';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedText } from '@/components/ThemedText';
import { useSnackbar } from '@/components/ThemedSnackbar';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { useSemanticColors, useTypography, useColorVariants } from '@/hooks/useThemeColor';

// Constants
const { width } = Dimensions.get('window');

// Animated components
const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedText = Animated.createAnimatedComponent(ThemedText);

// Types
interface FormErrors {
    email?: string;
    password?: string;
}

interface CustomTextInputProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'ascii-capable' | 'numbers-and-punctuation' | 'url' | 'number-pad' | 'name-phone-pad' | 'decimal-pad' | 'twitter' | 'web-search' | 'visible-password';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    error?: string;
    disabled?: boolean;
    icon?: string;
}

// Helper Components
function CustomTextInput({
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry = false,
    keyboardType = 'default',
    autoCapitalize = 'none',
    error,
    disabled = false,
    icon,
}: CustomTextInputProps) {
    const semanticColors = useSemanticColors();
    const typography = useTypography();
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Animation values
    const focusAnim = useSharedValue(0);
    const errorAnim = useSharedValue(0);

    React.useEffect(() => {
        focusAnim.value = withSpring(isFocused ? 1 : 0, {
            damping: 15,
            stiffness: 300
        });
    }, [isFocused]);

    React.useEffect(() => {
        if (error) {
            errorAnim.value = withSequence(
                withTiming(1, { duration: 100 }),
                withSpring(0, { damping: 8, stiffness: 300 })
            );
        }
    }, [error]);

    const containerStyle = useAnimatedStyle(() => ({
        borderColor: error
            ? semanticColors.error
            : isFocused
                ? semanticColors.primary
                : semanticColors.secondary,
        borderWidth: interpolate(focusAnim.value, [0, 1], [1, 2]),
        transform: [{ scale: interpolate(errorAnim.value, [0, 1], [1, 1.02]) }],
    }));

    const labelStyle = useAnimatedStyle(() => ({
        color: error
            ? semanticColors.error
            : isFocused
                ? semanticColors.primary
                : semanticColors.secondary,
    }));

    return (
        <View style={styles.inputContainer}>
            <AnimatedText variant="label" style={[styles.inputLabel, labelStyle]}>
                {label}
            </AnimatedText>

            <AnimatedView style={[styles.inputWrapper, containerStyle]}>
                <BlurView
                    intensity={20}
                    tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={StyleSheet.absoluteFillObject}
                />

                <View style={styles.inputContent}>
                    {icon && (
                        <View style={styles.inputIcon}>
                            <ThemedIcon
                                name={icon as any}
                                size={18}
                                color={error ? "error" : "secondary"}
                            />
                        </View>
                    )}

                    <TextInput
                        style={[
                            typography.body,
                            styles.textInput,
                            { color: semanticColors.primary }
                        ]}
                        value={value}
                        onChangeText={onChangeText}
                        placeholder={placeholder}
                        placeholderTextColor={semanticColors.secondary}
                        secureTextEntry={secureTextEntry && !showPassword}
                        keyboardType={keyboardType}
                        autoCapitalize={autoCapitalize}
                        autoCorrect={false}
                        editable={!disabled}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                    />

                    {secureTextEntry && (
                        <Pressable
                            style={styles.passwordToggle}
                            onPress={() => {
                                setShowPassword(!showPassword);
                                Haptics.selectionAsync();
                            }}
                        >
                            <ThemedIcon
                                name={showPassword ? 'eye-off' : 'eye'}
                                size={18}
                                color="secondary"
                            />
                        </Pressable>
                    )}
                </View>
            </AnimatedView>

            {error && (
                <Animated.View
                    entering={SlideInRight.duration(200)}
                    style={styles.errorContainer}
                >
                    <ThemedIcon name="alert-circle" size={14} color="error" />
                    <ThemedText variant="caption" color="error">
                        {error}
                    </ThemedText>
                </Animated.View>
            )}
        </View>
    );
}

// Main Component
export default function LoginScreen() {
    const { t } = useTranslation();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const { showError, showSuccess, SnackbarComponent } = useSnackbar();

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    // Animation values
    const headerAnim = useSharedValue(0);
    const cardAnim = useSharedValue(0);

    React.useEffect(() => {
        // Staggered entrance animations
        headerAnim.value = withSpring(1, { damping: 20, stiffness: 300 });

        setTimeout(() => {
            cardAnim.value = withSpring(1, { damping: 20, stiffness: 300 });
        }, 200);
    }, []);

    // Form validation
    const validateForm = () => {
        const newErrors: FormErrors = {};

        if (!email.trim()) {
            newErrors.email = t('errors.email_required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = t('errors.invalid_email');
        }

        if (!password.trim()) {
            newErrors.password = t('errors.password_required');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Login handler
    const handleLogin = async () => {
        if (!validateForm()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Firebase authentication
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Login successful:', userCredential.user);

            showSuccess(t('app_errors.welcome_back'));

            // Navigate to account tab instead of tabs root to avoid navigation conflicts
            setTimeout(() => {
                router.replace('/(tabs)/account');
            }, 1000);

        } catch (error: unknown) {
            console.error('Login error:', error);

            // Map Firebase errors to user-friendly messages
            let errorMessage = t('errors.sign_in_error');

            if (error && typeof error === 'object' && 'code' in error) {
                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = t('errors.user_not_found');
                        break;
                    case 'auth/wrong-password':
                        errorMessage = t('errors.wrong_password');
                        break;
                    case 'auth/invalid-credential':
                        errorMessage = t('errors.invalid_credential');
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = t('errors.too_many_requests');
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = t('errors.network_error');
                        break;
                    case 'auth/user-disabled':
                        errorMessage = t('errors.disabled_account');
                        break;
                }
            }

            showError(errorMessage);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsLoading(false);
        }
    };

    // Navigation handlers
    const handleForgotPassword = () => {
        Haptics.selectionAsync();
        router.push('/account/forgot-password');
    };

    const handleSignUp = () => {
        Haptics.selectionAsync();
        router.push('/account/signup');
    };

    // Animation styles
    const headerStyle = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [
            { translateY: interpolate(headerAnim.value, [0, 1], [30, 0]) },
            { scale: interpolate(headerAnim.value, [0, 1], [0.95, 1]) }
        ],
    }));

    const cardStyle = useAnimatedStyle(() => ({
        opacity: cardAnim.value,
        transform: [
            { translateY: interpolate(cardAnim.value, [0, 1], [50, 0]) },
            { scale: interpolate(cardAnim.value, [0, 1], [0.9, 1]) }
        ],
    }));

    return (
        <ThemedSafeAreaView style={styles.container}>
            {/* Background Elements */}
            <View style={styles.backgroundElements}>
                <View style={[
                    styles.backgroundCircle,
                    { backgroundColor: variants.primary.light }
                ]} />
            </View>

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
                    {/* Header Section */}
                    <Animated.View style={[styles.header, headerStyle]}>

                        <ThemedText
                            variant="displayMedium"
                            style={styles.welcomeTitle}
                        >
                            {t('auth.login_title')}
                        </ThemedText>

                        <ThemedText
                            variant="bodyLarge"
                            color="secondary"
                            style={styles.welcomeSubtitle}
                        >
                            {t('auth.login_subtitle')}
                        </ThemedText>
                    </Animated.View>

                    {/* Login Form */}
                    <Animated.View style={cardStyle}>
                        <ModernCard
                            elevated={false}
                            bordered={true}
                        >
                            <View style={styles.formContainer}>
                                <CustomTextInput
                                    label={t('auth.email_label') || 'Email'}
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder={t('auth.email_placeholder')}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    error={errors.email}
                                    icon="mail"
                                />

                                <CustomTextInput
                                    label={t('auth.password_label') || 'Password'}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder={t('auth.password_placeholder')}
                                    secureTextEntry
                                    error={errors.password}
                                    icon="lock"
                                />

                                {/* Forgot Password Link */}
                                <ThemedPressable
                                    variant="ghost"
                                    style={styles.forgotPassword}
                                    onPress={handleForgotPassword}
                                >
                                    <ThemedText
                                        variant="labelMedium"
                                        color="accent"
                                        style={styles.forgotPasswordText}
                                    >
                                        {t('auth.forgot_password_link')}
                                    </ThemedText>
                                </ThemedPressable>

                                {/* Login Button */}
                                <ThemedPressable
                                    variant="primary"
                                    size="lg"
                                    fullWidth
                                    disabled={isLoading}
                                    onPress={handleLogin}
                                    style={styles.loginButton}
                                >
                                    <View style={styles.buttonContent}>
                                        {!isLoading && (
                                            <ThemedIcon
                                                name="log-in"
                                                size={20}
                                                style={{ color: semanticColors.background }}
                                            />
                                        )}
                                        <ThemedText
                                            variant="labelLarge"
                                            style={{ color: semanticColors.background }}
                                        >
                                            {isLoading ? t('app_errors.signing_in') : t('auth.signin')}
                                        </ThemedText>
                                    </View>
                                </ThemedPressable>

                                {/* Sign Up Link */}
                                <ThemedPressable
                                    variant="ghost"
                                    style={styles.signupLink}
                                    onPress={handleSignUp}
                                >
                                    <ThemedText
                                        variant="body"
                                        color="secondary"
                                        style={styles.signupText}
                                    >
                                        {t('auth.signup_link')}
                                    </ThemedText>
                                </ThemedPressable>
                            </View>
                        </ModernCard>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Snackbar */}
            <SnackbarComponent />
        </ThemedSafeAreaView>
    );
}

// Styles
const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 20,
    },
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingVertical: 10,
        justifyContent: 'center',
    },

    // Background
    backgroundElements: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backgroundCircle: {
        width: width * 1.5,
        height: width * 1.5,
        borderRadius: width * 0.75,
        opacity: 0.05,
        position: 'absolute',
    },

    // Header
    header: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    welcomeTitle: {
        textAlign: 'center',
        marginBottom: 8,
    },
    welcomeSubtitle: {
        textAlign: 'center',
        maxWidth: width * 0.8,
    },

    // Form
    loginCard: {
        marginHorizontal: 0,
        borderWidth: 1,
    },
    formContainer: {
        padding: 20,
        gap: 16,
    },

    // Input styling
    inputContainer: {
        gap: 8,
    },
    inputLabel: {
        fontWeight: '600',
    },
    inputWrapper: {
        borderRadius: 16,
        overflow: 'hidden',
        minHeight: 48,
    },
    inputContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        minHeight: 48,
    },
    inputIcon: {
        marginRight: 12,
    },
    textInput: {
        flex: 1,
        height: 24,
    },
    passwordToggle: {
        padding: 8,
        marginLeft: 8,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },

    // Buttons and links
    forgotPassword: {
        alignSelf: 'flex-end',
        paddingVertical: 8,
    },
    forgotPasswordText: {
        fontWeight: '500',
    },
    loginButton: {
        marginTop: 8,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    signupLink: {
        alignSelf: 'center',
        paddingVertical: 12,
    },
    signupText: {
        textAlign: 'center',
    },
});