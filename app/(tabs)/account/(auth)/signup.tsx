import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { theme } from '@/constants/theme';
import { auth } from '@/firebase/config';

export default function SignupScreen() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const colorScheme = useColorScheme() ?? 'light';

    const handleSignup = async () => {
        setEmailError('');
        setPasswordError('');

        if (!email) {
            setEmailError(t('errors.email_required'));
            return;
        }
        if (!password) {
            setPasswordError(t('errors.password_required'));
            return;
        }
        if (password.length < 6) {
            setPasswordError(t('errors.weak_password'));
            return;
        }

        try {
            await auth().createUserWithEmailAndPassword(email, password);
            // Navigate to Account or login on success
            setTimeout(() => {
                router.replace('/login');
            }, 0);
        } catch (error: any) {
            switch (error.code) {
                case 'auth/invalid-email':
                    setEmailError(t('errors.invalid_email'));
                    break;
                case 'auth/email-already-in-use':
                    setEmailError(t('errors.signup_email_in_use'));
                    break;
                case 'auth/weak-password':
                    setPasswordError(t('errors.weak_password'));
                    break;
                case 'auth/operation-not-allowed':
                    setEmailError(t('errors.operation_not_allowed'));
                    break;
                default:
                    setPasswordError(error.message);
                    break;
            }
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme[colorScheme].colors.background }]}>
            <Image style={styles.logo} source={require('@/assets/images/logo.png')} />
            <Text style={[styles.title, { color: theme[colorScheme].colors.text.primary }]}>
                {t('signup.title')}
            </Text>
            <TextInput
                placeholder={t('signup.email_placeholder')}
                placeholderTextColor={theme[colorScheme].colors.placeholder}
                style={[styles.input, { color: theme[colorScheme].colors.text.primary }]}
                value={email}
                onChangeText={text => setEmail(text)}
                keyboardType="email-address"
                autoCapitalize="none"
            />
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            <TextInput
                placeholder={t('signup.password_placeholder')}
                placeholderTextColor={theme[colorScheme].colors.placeholder}
                style={[styles.input, { color: theme[colorScheme].colors.text.primary }]}
                value={password}
                onChangeText={text => setPassword(text)}
                secureTextEntry
            />
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            <TouchableOpacity style={styles.button} onPress={handleSignup}>
                <Text style={[styles.buttonText, { color: theme[colorScheme].colors.buttonText }]}>
                    {t('signup.signup_button')}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginLink}>
                <Text style={[styles.linkText, { color: theme[colorScheme].colors.link }]}>
                    {t('signup.have_account')}{' '}
                    <Text style={[styles.linkText, { fontWeight: 'bold', color: theme[colorScheme].colors.link }]}>
                        {t('signup.login_here')}
                    </Text>
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
    loginLink: {
        marginTop: theme.spacing.lg,
        alignItems: 'center',
    },
    linkText: {
        ...theme.typography.small,
        fontWeight: '500',
    },
});
