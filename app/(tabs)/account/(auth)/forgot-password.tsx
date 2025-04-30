import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { theme } from '@/constants/theme';
import { auth } from '@/firebase/config';

export default function ForgotPasswordScreen() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const colorScheme = useColorScheme() ?? 'light';

    const handleResetPassword = async () => {
        setEmailError('');
        setResetEmailSent(false);

        if (!email) {
            setEmailError(t('errors.email_required'));
            return;
        }

        try {
            await auth().sendPasswordResetEmail(email);
            setResetEmailSent(true);
        } catch (error: any) {
            switch (error.code) {
                case 'auth/invalid-email':
                    setEmailError(t('errors.invalid_email'));
                    break;
                case 'auth/user-not-found':
                    setEmailError(t('errors.user_not_found'));
                    break;
                default:
                    setEmailError(error.message);
                    break;
            }
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme[colorScheme].colors.background }]}>
            <Image style={styles.logo} source={require('@/assets/images/logo.png')} />
            <Text style={[styles.title, { color: theme[colorScheme].colors.text }]}>
                {t('forgotPassword.title')}
            </Text>
            <TextInput
                placeholder={t('forgotPassword.email_placeholder')}
                placeholderTextColor={theme[colorScheme].colors.placeholder}
                style={[styles.input, { color: theme[colorScheme].colors.text.primary }]}
                value={email}
                onChangeText={text => setEmail(text)}
                keyboardType="email-address"
                autoCapitalize="none"
            />
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            {resetEmailSent && <Text style={styles.successText}>{t('forgotPassword.reset_email_sent')}</Text>}
            <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
                <Text style={[styles.buttonText, { color: theme[colorScheme].colors.buttonText }]}>
                    {t('forgotPassword.send_button')}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/login')} style={styles.backLink}>
                <Text style={[styles.linkText, { color: theme[colorScheme].colors.link }]}>
                    {t('forgotPassword.back_to_login')}
                </Text>
            </TouchableOpacity>
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