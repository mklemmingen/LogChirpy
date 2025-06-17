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
 * Signup screen component
 * Handles user registration with email and password
 */
export default function SignupScreen() {
    const { t } = useTranslation();
    const theme = useTheme();
    const typography = useTypography();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const { signUp } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Animation values
    const signupButtonScale = useSharedValue(1);
    const fadeInOpacity = useSharedValue(0);

    React.useEffect(() => {
        fadeInOpacity.value = withTiming(1, { duration: 600 });
    }, []);

    const fadeInStyle = useAnimatedStyle(() => ({
        opacity: fadeInOpacity.value,
        transform: [{ translateY: withTiming(fadeInOpacity.value === 1 ? 0 : 30) }],
    }));

    const signupButtonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: signupButtonScale.value }],
    }));

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePassword = (password: string) => {
        return password.length >= 6;
    };

    const getPasswordStrength = (password: string) => {
        if (password.length === 0) return { strength: 0, label: '' };
        if (password.length < 6) return { strength: 1, label: t('auth.passwordWeak', 'Weak') };
        if (password.length < 8) return { strength: 2, label: t('auth.passwordFair', 'Fair') };
        if (password.length >= 8 && /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            return { strength: 4, label: t('auth.passwordStrong', 'Strong') };
        }
        return { strength: 3, label: t('auth.passwordGood', 'Good') };
    };

    const passwordStrength = getPasswordStrength(password);

    const handleSignup = async () => {
        if (!displayName.trim()) {
            Alert.alert(
                t('auth.error', 'Error'),
                t('auth.name_required', 'Please enter your name')
            );
            return;
        }

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

        if (!password.trim()) {
            Alert.alert(
                t('auth.error', 'Error'),
                t('auth.password_required', 'Please enter a password')
            );
            return;
        }

        if (!validatePassword(password)) {
            Alert.alert(
                t('auth.error', 'Error'),
                t('auth.password_too_short', 'Password must be at least 6 characters long')
            );
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert(
                t('auth.error', 'Error'),
                t('auth.passwords_dont_match', 'Passwords do not match')
            );
            return;
        }

        setIsLoading(true);

        try {
            await signUp(email, password, displayName);
            router.replace('/(tabs)/account');
        } catch (error: any) {
            console.error('Signup error:', error);

            let errorMessage = t('errors.signup_error', 'Failed to create account. Please try again.');

            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = t('errors.signup_email_in_use', 'This email is already registered');
                    break;
                case 'auth/invalid-email':
                    errorMessage = t('errors.invalid_email', 'Please enter a valid email address');
                    break;
                case 'auth/weak-password':
                    errorMessage = t('errors.weak_password', 'Password is too weak');
                    break;
                case 'auth/network-request-failed':
                    errorMessage = t('errors.network_error', 'Network error. Please check your connection');
                    break;
            }

            Alert.alert(t('errors.error', 'Error'), errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignupPressIn = () => {
        signupButtonScale.value = withSpring(0.95);
    };

    const handleSignupPressOut = () => {
        signupButtonScale.value = withSpring(1);
    };

    const isFormValid =
        displayName.trim() &&
        email.trim() &&
        validateEmail(email.trim()) &&
        password.trim() &&
        validatePassword(password) &&
        confirmPassword.trim() &&
        password === confirmPassword &&
        !isLoading;

    const getPasswordStrengthColor = (strength: number) => {
        switch (strength) {
            case 1: return '#ff4444';
            case 2: return '#ffaa00';
            case 3: return '#00aa00';
            case 4: return '#00cc00';
            default: return semanticColors.secondary;
        }
    };

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
                                <Feather name="user-plus" size={32} color={semanticColors.primary} />
                            </View>
                            <Text style={[typography.h2, styles.title, { color: semanticColors.primary }]}>
                                {t('auth.signup_title', 'Sign Up')}
                            </Text>
                            <Text style={[typography.body, styles.subtitle, { color: semanticColors.secondary }]}>
                                {t('auth.signup_subtitle', 'Sign up to start using LogChirpy')}
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
                                        {t('auth.name_label', 'Display Name')}
                                    </Text>
                                    <ThemedTextInput
                                        style={[styles.textInput, { borderRadius: 12 }]}
                                        placeholder={t('auth.name_placeholder', 'Enter your name')}
                                        value={displayName}
                                        onChangeText={setDisplayName}
                                        autoCapitalize="words"
                                        autoCorrect={false}
                                        editable={!isLoading}
                                    />
                                </View>

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

                                <View style={styles.inputGroup}>
                                    <Text style={[typography.label, styles.label, { color: semanticColors.secondary }]}>
                                        {t('app_errors.confirm_password_required', 'Confirm Password')}
                                    </Text>
                                    <View style={styles.passwordContainer}>
                                        <ThemedTextInput
                                            style={[styles.textInput, styles.passwordInput, { borderRadius: 12 }]}
                                            placeholder={t('app_errors.confirm_password_placeholder', 'Confirm your password')}
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            secureTextEntry={!showConfirmPassword}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            editable={!isLoading}
                                        />
                                        <Pressable
                                            style={[styles.passwordToggle, { right: 16 }]}
                                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                            disabled={isLoading}
                                        >
                                            <Feather
                                                name={showConfirmPassword ? 'eye-off' : 'eye'}
                                                size={20}
                                                color={semanticColors.secondary}
                                            />
                                        </Pressable>
                                    </View>
                                </View>

                                <Animated.View style={[signupButtonAnimatedStyle, { marginTop: 16 }]}>
                                    <AnimatedPressable
                                        style={[
                                            styles.signupButton,
                                            {
                                                backgroundColor: isFormValid ? semanticColors.primary : semanticColors.secondary,
                                                borderRadius: 12,
                                                paddingVertical: 14,
                                            },
                                        ]}
                                        onPress={handleSignup}
                                        onPressIn={handleSignupPressIn}
                                        onPressOut={handleSignupPressOut}
                                        disabled={!isFormValid}
                                        android_ripple={{ color: theme.colors.surface + '33' }}
                                    >
                                        {isLoading ? (
                                            <View style={styles.loadingContainer}>
                                                <Text style={[typography.body, styles.signupButtonText, { color: semanticColors.background }]}>
                                                    {t('auth.signingUp', 'Signing Up...')}
                                                </Text>
                                            </View>
                                        ) : (
                                            <>
                                                <Feather name="user-plus" size={20} color={semanticColors.background} />
                                                <Text style={[typography.body, styles.signupButtonText, { color: semanticColors.background }]}>
                                                    {t('auth.signup', 'Sign Up')}
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
    errorText: {
        fontSize: 12,
        marginTop: 4,
    },

    // Password Strength
    passwordStrength: {
        marginTop: 8,
        gap: 6,
    },
    strengthBar: {
        flexDirection: 'row',
        gap: 4,
    },
    strengthSegment: {
        flex: 1,
        height: 3,
        borderRadius: 2,
    },
    strengthLabel: {
        fontSize: 12,
        fontWeight: '500',
    },

    // Signup Button
    signupButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 8,
    },
    signupButtonText: {
        fontWeight: '600',
    },
    loadingContainer: {
        alignItems: 'center',
    },

    // Sign In Link
    signInContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    signInLink: {
        fontWeight: '600',
    },
}); 