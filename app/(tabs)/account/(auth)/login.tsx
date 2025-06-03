import React, {useState} from 'react';
import {
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {BlurView} from 'expo-blur';
import {Feather} from '@expo/vector-icons';
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
import {signInWithEmailAndPassword} from 'firebase/auth';
import {auth} from '@/firebase/config';

// Local component imports
import {ModernCard} from '@/components/ModernCard';
import {PrimaryButton, ThemedPressable} from '@/components/ThemedPressable';
import {ThemedText} from '@/components/ThemedText';
import {useSnackbar} from '@/components/ThemedSnackbar';
import {useColorVariants, useSemanticColors, useTypography,} from '@/hooks/useThemeColor';

// Constants
const { width, height } = Dimensions.get('window');

// Animated components
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// Types
interface FormErrors {
    email?: string;
    password?: string;
}

interface ModernTextInputProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    secureTextEntry?: boolean;
    keyboardType?: any;
    autoCapitalize?: any;
    error?: string;
    disabled?: boolean;
    icon?: string;
}

// Helper Components
function LoginBirdAnimation() {
    const semanticColors = useSemanticColors();
    const floatAnim = useSharedValue(0);

    React.useEffect(() => {
        floatAnim.value = withSequence(
            withTiming(1, { duration: 2000 }),
            withSpring(0, { damping: 15, stiffness: 300 })
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: interpolate(floatAnim.value, [0, 1], [0, -12]) },
            { rotate: `${interpolate(floatAnim.value, [0, 1], [0, 5])}deg` }
        ],
        opacity: interpolate(floatAnim.value, [0, 1], [0.6, 1]),
    }));

    return (
        <Animated.View style={[styles.floatingBird, animatedStyle]}>
            <Feather name="feather" size={24} color={semanticColors.primary} />
        </Animated.View>
    );
}

function ModernTextInput({
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
                         }: ModernTextInputProps) {
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
                : semanticColors.border,
        borderWidth: interpolate(focusAnim.value, [0, 1], [1, 2]),
        transform: [{ scale: interpolate(errorAnim.value, [0, 1], [1, 1.02]) }],
    }));

    const labelStyle = useAnimatedStyle(() => ({
        color: error
            ? semanticColors.error
            : isFocused
                ? semanticColors.primary
                : semanticColors.textSecondary,
    }));

    return (
        <View style={styles.inputContainer}>
            <Animated.Text style={[typography.labelMedium, styles.inputLabel, labelStyle]}>
                {label}
            </Animated.Text>

            <Animated.View style={[styles.inputWrapper, containerStyle]}>
                <BlurView
                    intensity={20}
                    tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={StyleSheet.absoluteFillObject}
                />

                <View style={styles.inputContent}>
                    {icon && (
                        <View style={styles.inputIcon}>
                            <Feather
                                name={icon as any}
                                size={18}
                                color={error ? semanticColors.error : semanticColors.textSecondary}
                            />
                        </View>
                    )}

                    <AnimatedTextInput
                        style={[
                            typography.bodyMedium,
                            styles.textInput,
                            { color: semanticColors.text }
                        ]}
                        value={value}
                        onChangeText={onChangeText}
                        placeholder={placeholder}
                        placeholderTextColor={semanticColors.textTertiary}
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
                            <Feather
                                name={showPassword ? 'eye-off' : 'eye'}
                                size={18}
                                color={semanticColors.textSecondary}
                            />
                        </Pressable>
                    )}
                </View>
            </Animated.View>

            {error && (
                <Animated.View
                    entering={SlideInRight.duration(200)}
                    style={styles.errorContainer}
                >
                    <Feather name="alert-circle" size={14} color={semanticColors.error} />
                    <Text style={[typography.labelSmall, { color: semanticColors.error }]}>
                        {error}
                    </Text>
                </Animated.View>
            )}
        </View>
    );
}

// Main Component
export default function ModernLoginScreen() {
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

            showSuccess('Welcome back!');

            // Navigate to main app
            setTimeout(() => {
                router.replace('/(tabs)');
            }, 1000);

        } catch (error: any) {
            console.error('Login error:', error);

            // Map Firebase errors to user-friendly messages
            let errorMessage = t('errors.sign_in_error');

            if (error?.code) {
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
        <SafeAreaView style={[styles.container, { backgroundColor: semanticColors.background }]}>
            {/* Background Elements */}
            <View style={styles.backgroundElements}>
                <View style={[
                    styles.backgroundCircle,
                    { backgroundColor: variants.primarySubtle }
                ]} />
                <LoginBirdAnimation />
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
                        <View style={[styles.logoContainer, { backgroundColor: variants.primarySubtle }]}>
                            <Feather name="feather" size={40} color={semanticColors.primary} />
                        </View>

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
                            variant="glass"
                        >
                            <View style={styles.formContainer}>
                                <ModernTextInput
                                    label={t('auth.email_label') || 'Email'}
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder={t('auth.email_placeholder')}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    error={errors.email}
                                    icon="mail"
                                />

                                <ModernTextInput
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
                                <PrimaryButton
                                    size="large"
                                    fullWidth
                                    loading={isLoading}
                                    disabled={isLoading}
                                    onPress={handleLogin}
                                    style={styles.loginButton}
                                    glowOnHover
                                >
                                    <View style={styles.buttonContent}>
                                        {!isLoading && (
                                            <Feather
                                                name="log-in"
                                                size={20}
                                                color={semanticColors.onPrimary}
                                            />
                                        )}
                                        <ThemedText
                                            variant="labelLarge"
                                            style={{ color: semanticColors.onPrimary }}
                                        >
                                            {isLoading ? 'Signing In...' : t('auth.signin')}
                                        </ThemedText>
                                    </View>
                                </PrimaryButton>

                                {/* Sign Up Link */}
                                <ThemedPressable
                                    variant="ghost"
                                    style={styles.signupLink}
                                    onPress={handleSignUp}
                                >
                                    <ThemedText
                                        variant="bodyMedium"
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
        </SafeAreaView>
    );
}

// Styles
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
        paddingHorizontal: 24,
        paddingBottom: 40,
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
    floatingBird: {
        position: 'absolute',
        top: height * 0.15,
        right: width * 0.1,
    },

    // Header
    header: {
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 40,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
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
        padding: 32,
        gap: 24,
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
        minHeight: 56,
    },
    inputContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        minHeight: 56,
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