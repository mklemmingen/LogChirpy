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
import { Feather } from '@expo/vector-icons';

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

    // Animation values
    const loginButtonScale = useSharedValue(1);
    const fadeInOpacity = useSharedValue(0);

    React.useEffect(() => {
        fadeInOpacity.value = withTiming(1, { duration: 600 });
    }, []);

    React.useEffect(() => {
        console.log('login page render');
    });

    const fadeInStyle = useAnimatedStyle(() => ({
        opacity: fadeInOpacity.value,
        transform: [{ translateY: withTiming(fadeInOpacity.value === 1 ? 0 : 30) }],
    }));

    const loginButtonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: loginButtonScale.value }],
    }));

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert(
                t('auth.error', 'Error'),
                t('auth.fillAllFields', 'Please fill in all fields')
            );
            return;
        }

        setIsLoading(true);

        try {
            await signIn(email, password);
            router.replace('/(tabs)/account');
        } catch (error: any) {
            console.error('Login error:', error);

            let errorMessage = t('auth.loginError', 'Failed to sign in. Please try again.');

            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    errorMessage = t('auth.invalidCredentials', 'Invalid email or password');
                    break;
                case 'auth/user-disabled':
                    errorMessage = t('auth.accountDisabled', 'This account has been disabled');
                    break;
                case 'auth/too-many-requests':
                    errorMessage = t('auth.tooManyAttempts', 'Too many failed attempts. Please try again later');
                    break;
                case 'auth/network-request-failed':
                    errorMessage = t('auth.networkError', 'Network error. Please check your connection');
                    break;
            }

            Alert.alert(t('auth.error', 'Error'), errorMessage);
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
                                <Feather name="log-in" size={32} color={semanticColors.primary} />
                            </View>
                            <Text style={[typography.h2, styles.title, { color: semanticColors.primary }]}>
                                {t('auth.login_title', 'Sign In')}
                            </Text>
                            <Text style={[typography.body, styles.subtitle, { color: semanticColors.secondary }]}>
                                {t('auth.login_subtitle', 'Welcome back')}
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

                                <View style={styles.inputGroup}>
                                    <Text style={[typography.label, styles.label, { color: semanticColors.secondary }]}>
                                        {t('auth.password_label', 'Password')}
                                    </Text>
                                    <View style={styles.passwordContainer}>
                                        <ThemedTextInput
                                            style={[styles.textInput, styles.passwordInput, { borderRadius: 12 }]}
                                            placeholder={t('auth.password_placeholder', 'Enter your password')}
                                            value={password}
                                            onChangeText={setPassword}
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
                                            <Feather
                                                name={showPassword ? 'eye-off' : 'eye'}
                                                size={20}
                                                color={semanticColors.secondary}
                                            />
                                        </Pressable>
                                    </View>
                                </View>

                                <View style={[styles.forgotPasswordContainer, { marginTop: 4 }]}>
                                    <Link href="/(tabs)/account/(auth)/forgot-password" asChild>
                                        <Pressable disabled={isLoading}>
                                            <Text style={[typography.label, styles.forgotPassword, { color: semanticColors.primary }]}>
                                                {t('auth.forgot_password_link', 'Forgot Password?')}
                                            </Text>
                                        </Pressable>
                                    </Link>
                                </View>

                                <Animated.View style={[loginButtonAnimatedStyle, { marginTop: 16 }]}>
                                    <AnimatedPressable
                                        style={[
                                            styles.loginButton,
                                            {
                                                backgroundColor: isFormValid ? semanticColors.primary : semanticColors.secondary,
                                                borderRadius: 12,
                                                paddingVertical: 14,
                                            },
                                        ]}
                                        onPress={handleLogin}
                                        onPressIn={handleLoginPressIn}
                                        onPressOut={handleLoginPressOut}
                                        disabled={!isFormValid}
                                        android_ripple={{ color: theme.colors.surface + '33' }}
                                    >
                                        {isLoading ? (
                                            <View style={styles.loadingContainer}>
                                                <Text style={[typography.body, styles.loginButtonText, { color: semanticColors.background }]}>
                                                    {t('app_errors.signing_in', 'Signing In...')}
                                                </Text>
                                            </View>
                                        ) : (
                                            <>
                                                <Feather name="log-in" size={20} color={semanticColors.background} />
                                                <Text style={[typography.body, styles.loginButtonText, { color: semanticColors.background }]}>
                                                    {t('auth.signin', 'Sign In')}
                                                </Text>
                                            </>
                                        )}
                                    </AnimatedPressable>
                                </Animated.View>
                            </View>
                        </ModernCard>

                        <View style={[styles.signUpContainer, { marginTop: 16 }]}>
                            <Text style={[typography.body, { color: semanticColors.secondary }]}>
                                {t('auth.no_account', "Don't have an account?")}
                            </Text>
                            <Link href="/(tabs)/account/(auth)/signup" asChild>
                                <Pressable disabled={isLoading}>
                                    <Text style={[typography.body, styles.signUpLink, { color: semanticColors.primary, marginLeft: 4 }]}>
                                        {t('auth.signup_link', 'Sign Up')}
                                    </Text>
                                </Pressable>
                            </Link>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ThemedSafeAreaView>
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
        gap: 20,
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
    signUpLink: {
        fontWeight: '600',
    },
}); 