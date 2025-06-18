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
    TextStyle,
    StyleProp,
} from 'react-native';
import { router, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Login screen component
 * Handles user authentication with email and password
 */
export default function LoginScreen() {
    const { t } = useTranslation();
    const theme = useTheme();
    const typography = useTypography();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const { signIn } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

    // Animation values
    const loginButtonScale = useSharedValue(1);
    const fadeInOpacity = useSharedValue(0);

    React.useEffect(() => {
        fadeInOpacity.value = withTiming(1, { duration: 600 });
    }, []);

    const fadeInStyle = useAnimatedStyle(() => ({
        opacity: fadeInOpacity.value,
        transform: [{ translateY: withTiming(fadeInOpacity.value === 1 ? 0 : 30) }],
    }));

    const loginButtonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: loginButtonScale.value }],
    }));

    const clearErrors = () => {
        setErrors({});
    };

    const handleLogin = async () => {
        clearErrors();
        const newErrors: { email?: string; password?: string; general?: string } = {};

        // Always validate both fields
        if (!email.trim()) {
            newErrors.email = t('errors.email_required');
        }

        if (!password.trim()) {
            newErrors.password = t('errors.password_required');
        }

        // Show errors if any field is empty
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsLoading(true);

        try {
            await signIn(email, password);
            router.replace('/(tabs)/account');
        } catch (error: any) {
            console.error('Login error:', error);

            switch (error.code) {
                case 'auth/invalid-email':
                    setErrors({ email: t('errors.invalid_email') });
                    break;
                case 'auth/user-not-found':
                    setErrors({ email: t('errors.user_not_found') });
                    break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    setErrors({ password: t('errors.wrong_password') });
                    break;
                case 'auth/user-disabled':
                    setErrors({ email: t('errors.disabled_account') });
                    break;
                case 'auth/too-many-requests':
                    setErrors({ general: t('errors.too_many_requests') });
                    break;
                case 'auth/network-request-failed':
                    setErrors({ general: t('errors.network_error') });
                    break;
                default:
                    setErrors({ general: t('errors.sign_in_error') });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginPressIn = () => {
        loginButtonScale.value = withSpring(0.95);
    };

    const handleLoginPressOut = () => {
        loginButtonScale.value = withSpring(1);
    };

    const isFormValid = email.trim() && password.trim() && !isLoading;

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
                                    <ThemedIcon name="log-in" size={32} color="primary" />
                                </View>
                                <Text style={[typography.h2, styles.title, { color: semanticColors.primary }]}>
                                    {t('auth.login_title')}
                                </Text>
                                <Text style={[typography.body, styles.subtitle, { color: semanticColors.secondary }]}>
                                    {t('auth.login_subtitle')}
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
                                    {errors.general && (
                                        <View style={styles.errorContainer}>
                                            <Text style={[typography.caption, styles.errorText, { color: semanticColors.error }]}>
                                                {errors.general}
                                            </Text>
                                        </View>
                                    )}

                                    <View style={styles.inputGroup}>
                                        <Text style={[typography.label, styles.inputLabel, { color: semanticColors.secondary }]}>
                                            {t('auth.email_label')}
                                        </Text>
                                        <ThemedTextInput
                                            style={[
                                                styles.textInput,
                                                { borderRadius: 12 },
                                                errors.email ? {
                                                    borderColor: semanticColors.error,
                                                    borderWidth: 1
                                                } : undefined
                                            ]}
                                            placeholder={t('auth.email_placeholder')}
                                            value={email}
                                            onChangeText={(text) => {
                                                setEmail(text);
                                                if (errors.email) clearErrors();
                                            }}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            editable={!isLoading}
                                        />
                                        {errors.email && (
                                            <Text style={[typography.caption, styles.errorText, { color: semanticColors.error }]}>
                                                {errors.email}
                                            </Text>
                                        )}
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={[typography.label, styles.inputLabel, { color: semanticColors.secondary }]}>
                                            {t('auth.password_label')}
                                        </Text>
                                        <View style={styles.passwordContainer}>
                                            <ThemedTextInput
                                                style={[
                                                    styles.textInput,
                                                    styles.passwordInput,
                                                    { borderRadius: 12 },
                                                    errors.password ? {
                                                        borderColor: semanticColors.error,
                                                        borderWidth: 1
                                                    } : undefined
                                                ]}
                                                placeholder={t('auth.password_placeholder')}
                                                value={password}
                                                onChangeText={(text) => {
                                                    setPassword(text);
                                                    if (errors.password) clearErrors();
                                                }}
                                                secureTextEntry={!showPassword}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                editable={!isLoading}
                                            />
                                            <Pressable
                                                style={[styles.passwordToggle, { right: 16 }]}
                                                onPress={() => setShowPassword(!showPassword)}
                                                disabled={isLoading}
                                            >
                                                <ThemedIcon
                                                    name={showPassword ? 'eye-off' : 'eye'}
                                                    size={20}
                                                    color="secondary"
                                                />
                                            </Pressable>
                                        </View>
                                        {errors.password && (
                                            <Text style={[typography.caption, styles.errorText, { color: semanticColors.error }]}>
                                                {errors.password}
                                            </Text>
                                        )}
                                    </View>

                                    <View style={[styles.forgotPasswordContainer, { marginTop: 4 }]}>
                                        <Link href="/(tabs)/account/(auth)/forgot-password" asChild>
                                            <Pressable disabled={isLoading}>
                                                <Text style={[typography.label, styles.forgotPassword, { color: semanticColors.primary }]}>
                                                    {t('auth.forgot_password_link')}
                                                </Text>
                                            </Pressable>
                                        </Link>
                                    </View>

                                    <Animated.View style={[loginButtonAnimatedStyle, { marginTop: 16 }]}>
                                        <AnimatedPressable
                                            style={[
                                                styles.loginButton,
                                                {
                                                    backgroundColor: semanticColors.primary,
                                                    opacity: isFormValid ? 1 : 0.5,
                                                    borderRadius: 12,
                                                    paddingVertical: 14,
                                                },
                                            ]}
                                            onPress={handleLogin}
                                            onPressIn={handleLoginPressIn}
                                            onPressOut={handleLoginPressOut}
                                            android_ripple={{ color: theme.colors.surface + '33' }}
                                        >
                                            {isLoading ? (
                                                <View style={styles.loadingContainer}>
                                                    <Text style={[typography.body, styles.loginButtonText, { color: semanticColors.background }]}>
                                                        {t('app_errors.signing_in')}
                                                    </Text>
                                                </View>
                                            ) : (
                                                <>
                                                    <ThemedIcon
                                                        name="log-in"
                                                        size={20}
                                                        color="inverse"
                                                    />
                                                    <Text style={[typography.body, styles.loginButtonText, { color: semanticColors.background }]}>
                                                        {t('auth.signin')}
                                                    </Text>
                                                </>
                                            )}
                                        </AnimatedPressable>
                                    </Animated.View>
                                </View>
                            </ModernCard>

                            <View style={[styles.signUpContainer, { marginTop: 16 }]}>
                                <Text style={[typography.body, styles.signUpText, { color: semanticColors.secondary }]}>
                                    {t('auth.no_account')}
                                </Text>
                                <Link href="/(tabs)/account/(auth)/signup" asChild>
                                    <Pressable disabled={isLoading}>
                                        <Text style={[typography.body, styles.signUpLink, { color: semanticColors.primary }]}>
                                            {t('auth.signup_link')}
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
        paddingHorizontal: 24,
        paddingVertical: 10,
        justifyContent: 'center',
    },

    // Header
    header: {
        alignItems: 'center',
        paddingVertical: 16,
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
        gap: 20,
    },
    inputGroup: {
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
        minHeight: 48,
        paddingHorizontal: 16,
    },
    passwordContainer: {
        position: 'relative',
    },
    passwordInput: {
        paddingRight: 48,
    },
    passwordToggle: {
        position: 'absolute',
        right: 16,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        width: 40,
    },

    // Forgot Password
    forgotPasswordContainer: {
        alignItems: 'flex-end',
        marginTop: -8,
    },
    forgotPassword: {
        fontWeight: '500',
    },

    // Login Button
    loginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        gap: 8,
        marginTop: 8,
    },
    loginButtonText: {
        fontWeight: '600',
    },
    loadingContainer: {
        alignItems: 'center',
    },

    // Sign Up Link
    signUpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    signUpText: {
        fontWeight: '600',
    },
    signUpLink: {
        fontWeight: '600',
    },

    // Error
    errorContainer: {
        marginBottom: 16,
    },
    errorText: {
        fontWeight: '500',
    },
}); 