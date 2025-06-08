import React, {useEffect, useRef, useState} from 'react';
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
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import SafeBlurView from '@/components/ui/SafeBlurView';
import { ThemedIcon } from '@/components/ThemedIcon';
import * as Haptics from 'expo-haptics';
import {useIsFocused} from '@react-navigation/native';
import {SafeViewManager} from '@/components/SafeViewManager';

// Firebase imports
import {signInWithEmailAndPassword} from 'firebase/auth';
import {auth} from '@/firebase/config';

// Local component imports
import {ModernCard} from '@/components/ModernCard';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedText} from '@/components/ThemedText';
import {ThemedSnackbar, useSnackbar} from '@/components/ThemedSnackbar';
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import {useTheme, useSemanticColors, useTypography, useColorVariants} from '@/hooks/useThemeColor';
// import { useAuth } from '@/app/context/AuthContext';


// Get screen width for styles
const { width } = Dimensions.get('window');

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
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'ascii-capable' | 'numbers-and-punctuation' | 'url' | 'number-pad' | 'name-phone-pad' | 'decimal-pad' | 'twitter' | 'web-search' | 'visible-password';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    error?: string;
    disabled?: boolean;
    icon?: string;
}

// Helper Components

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




    const containerStyle = {
        borderColor: error
            ? semanticColors.error
            : isFocused
                ? semanticColors.primary
                : semanticColors.secondary,
        borderWidth: isFocused ? 2 : 1,
    };

    const labelStyle = {
        color: error
            ? semanticColors.error
            : isFocused
                ? semanticColors.primary
                : semanticColors.secondary,
    };

    return (
        <View style={styles.inputContainer}>
            <ThemedText variant="label" style={[styles.inputLabel, labelStyle]}>
                {label}
            </ThemedText>

            <View style={[styles.inputWrapper, containerStyle]}>
                <SafeBlurView
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
            </View>

            {error && (
                <View style={styles.errorContainer}>
                    <ThemedIcon name="alert-circle" size={14} color="error" />
                    <ThemedText variant="caption" color="error">
                        {error}
                    </ThemedText>
                </View>
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
    const dimensions = useResponsiveDimensions();
    const isFocused = useIsFocused();

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);
    
    if (!isFocused) {
        return null;
    }

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    
    // Memory leak prevention
    const mountedRef = useRef(true);


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

    // Enhanced login handler with memory leak prevention
    const handleLogin = async () => {
        if (!validateForm()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (mountedRef.current) {
            setIsLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        try {
            // Firebase authentication
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Login successful:', userCredential.user);

            if (mountedRef.current) {
                showSuccess('Welcome back!');

                // Immediate navigation to avoid SafeViewManager timing conflicts
                // No setTimeout needed as navigation should be immediate after auth success
                router.replace('/(tabs)/account');
            }

        } catch (error: unknown) {
            console.error('Login error:', error);

            if (!mountedRef.current) return;

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
            if (mountedRef.current) {
                setIsLoading(false);
            }
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



    return (
        <SafeViewManager enabled={isFocused}>
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
                    <View style={styles.header}>
                        <View style={[styles.logoContainer, { backgroundColor: variants.primary.light }]}>
                            <ThemedIcon name="feather" size={40} color="accent" />
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
                    </View>

                    {/* Login Form */}
                    <View>
                        <ModernCard
                            elevated={false}
                            bordered={true}
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
                                            {isLoading ? 'Signing In...' : t('auth.signin')}
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
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Snackbar */}
            <SnackbarComponent />
            </ThemedSafeAreaView>
        </SafeViewManager>
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