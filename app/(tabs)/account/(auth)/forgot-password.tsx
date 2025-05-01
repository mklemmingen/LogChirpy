import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, useColorScheme } from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useThemeColor } from '@/hooks/useThemeColor';
import { auth } from '@/firebase/config';
import { theme } from '@/constants/theme';

export default function ForgotPasswordScreen() {
    const { t } = useTranslation(); // <-- useTranslation here
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

    const handleResetPassword = async () => {
        setEmailError('');
        setResetEmailSent(false);

        if (!email) {
            setEmailError(t('errors.email_required'));
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            setResetEmailSent(true);
        } catch (error: any) {
            switch (error.code) {
                case 'account/invalid-email':
                    setEmailError(t('errors.invalid_email'));
                    break;
                case 'account/user-not-found':
                    setEmailError(t('errors.user_not_found'));
                    break;
                case 'account/too-many-requests':
                    setEmailError(t('errors.too_many_requests'));
                    break;
                default:
                    setEmailError(t('errors.sending_reset_error'));
            }
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
            <View style={styles.logoContainer}>
                <Image
                    source={require('@assets/images/logo_no_bg.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>

            <View style={styles.formContainer}>
                <Text style={[styles.linkText, { color: currentTheme.colors.text.primary }]}>
                    {t('auth.forgot_password_title')}
                </Text>

                {!resetEmailSent ? (
                    <>
                        <Text style={[styles.subtitle, { color: currentTheme.colors.text.primary }]}>
                            {t('auth.forgot_password_instructions')}
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
                                placeholder={t('auth.email_placeholder')}
                                placeholderTextColor={currentTheme.colors.text.primary + '80'}
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    setEmailError('');
                                }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                            {emailError ? (
                                <Text style={[styles.errorText, { color: currentTheme.colors.error }]}>
                                    {emailError}
                                </Text>
                            ) : null}
                        </View>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
                            onPress={handleResetPassword}
                        >
                            <Text style={[styles.buttonText, { color: currentTheme.colors.text.light }]}>
                                {t('auth.send_reset')}
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.successContainer}>
                        <Text style={[styles.successText, { color: currentTheme.colors.primary }]}>
                            {t('auth.email_sent_title')}
                        </Text>
                        <Text style={[styles.successText, { color: currentTheme.colors.text.primary }]}>
                            {t('auth.email_sent_message', { email })}
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.backLink}
                    onPress={() => router.back()}
                >
                    <Text style={[styles.linkText, { color: currentTheme.colors.text.primary }]}>
                        {t('auth.back_to_login')}
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
