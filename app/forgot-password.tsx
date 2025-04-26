import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { auth } from '@/firebase/config';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

    const handleResetPassword = async () => {
        setEmailError('');
        setResetEmailSent(false);

        if (!email) {
            setEmailError('Please enter your email address');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            setResetEmailSent(true);
        } catch (error: any) {
            switch (error.code) {
                case 'auth/invalid-email':
                    setEmailError('Please enter a valid email address');
                    break;
                case 'auth/user-not-found':
                    setEmailError('No account found with this email');
                    break;
                case 'auth/too-many-requests':
                    setEmailError('Too many requests. Please try again later');
                    break;
                default:
                    setEmailError('Error sending password reset email');
            }
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
            <View style={styles.logoContainer}>
                <Image
                    source={require('../assets/images/logo_no_bg.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>

            <View style={styles.formContainer}>
                <Text style={[styles.title, { color: currentTheme.colors.text.primary }]}>Reset Password</Text>
                {!resetEmailSent ? (
                    <>
                        <Text style={[styles.subtitle, { color: currentTheme.colors.text.primary }]}>
                            Enter your email address and we'll send you instructions to reset your password
                        </Text>

                        <View style={styles.inputContainer}>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: currentTheme.colors.background,
                                        borderColor: emailError ? currentTheme.colors.error : currentTheme.colors.border,
                                        color: currentTheme.colors.text.primary
                                    }
                                ]}
                                placeholder="Email"
                                placeholderTextColor={currentTheme.colors.text.primary + '80'}
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    setEmailError('');
                                }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                            {emailError ? <Text style={[styles.errorText, { color: currentTheme.colors.error }]}>{emailError}</Text> : null}
                        </View>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
                            onPress={handleResetPassword}
                        >
                            <Text style={[styles.buttonText, { color: currentTheme.colors.text.light }]}>Send Reset Link</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.successContainer}>
                        <Text style={[styles.successTitle, { color: currentTheme.colors.primary }]}>Email Sent!</Text>
                        <Text style={[styles.successText, { color: currentTheme.colors.text.primary }]}>
                            We've sent password reset instructions to {email}. Please check your email inbox and follow the instructions to reset your password.
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.backLink}
                    onPress={() => router.back()}
                >
                    <Text style={[styles.linkText, { color: currentTheme.colors.text.primary }]}>
                        Back to Sign In
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: theme.spacing.lg,
    },
    logoContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: 200,
        height: 200,
    },
    formContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        ...theme.typography.h1,
        marginBottom: theme.spacing.xs,
    },
    subtitle: {
        ...theme.typography.body,
        marginBottom: theme.spacing.xl,
        opacity: 0.7,
    },
    inputContainer: {
        marginBottom: theme.spacing.md,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: theme.borderRadius.lg,
        paddingHorizontal: theme.spacing.md,
        ...theme.typography.body,
    },
    errorText: {
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
    successContainer: {
        alignItems: 'center',
        padding: theme.spacing.lg,
    },
    successTitle: {
        ...theme.typography.h2,
        marginBottom: theme.spacing.md,
    },
    successText: {
        ...theme.typography.body,
        textAlign: 'center',
        lineHeight: 24,
    },
    button: {
        height: 50,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: theme.spacing.xs,
    },
    buttonText: {
        ...theme.typography.body,
        fontWeight: '600',
    },
    backLink: {
        marginTop: theme.spacing.xl,
        alignItems: 'center',
    },
    linkText: {
        ...theme.typography.small,
        fontWeight: '500',
    },
}); 