import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, useColorScheme } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { auth } from '@/firebase/config';
import { theme } from '@/constants/theme';
import Section from "@/components/Section";

export default function LoginScreen() {
    const { t } = useTranslation(); // <-- useTranslation here
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                router.replace('/(tabs)');
            }
        });

        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
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

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // jump to the root of the Account stack
            /* give React-Native one frame to finish its transition
            before we unmount this screen */
            setTimeout(() => {
                router.replace('/(tabs)/account');   // land on the Account tab
            }, 0);
        } catch (error: any) {
            switch (error.code) {
                case 'account/invalid-email':
                    setEmailError(t('errors.invalid_email'));
                    break;
                case 'account/user-disabled':
                    setEmailError(t('errors.disabled_account'));
                    break;
                case 'account/user-not-found':
                    setEmailError(t('errors.user_not_found'));
                    break;
                case 'account/wrong-password':
                    setPasswordError(t('errors.wrong_password'));
                    break;
                case 'account/too-many-requests':
                    setPasswordError(t('errors.too_many_requests'));
                    break;
                case 'account/invalid-credential':
                    setPasswordError(t('errors.invalid_credential'));
                    break;
                case 'account/network-request-failed':
                    setPasswordError(t('errors.network_error'));
                    break;
                default:
                    setPasswordError(t('errors.sign_in_error'));
            }
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
            <View style={styles.logoContainer}>
                <Image
                    source={require('../../../../assets/images/logo_no_bg.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>

            <View style={styles.formContainer}>
                <Text style={[styles.linkText, { color: currentTheme.colors.text.primary }]}>
                    {t('auth.login_title')}
                </Text>
                <Text style={[styles.subtitle, { color: currentTheme.colors.text.primary }]}>
                    {t('auth.login_subtitle')}
                </Text>

                <Section>
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

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: currentTheme.colors.background,
                                    borderColor: passwordError ? currentTheme.colors.error : currentTheme.colors.border,
                                    color: currentTheme.colors.text.primary
                                }
                            ]}
                            placeholder={t('auth.password_placeholder')}
                            placeholderTextColor={currentTheme.colors.text.primary + '80'}
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                setPasswordError('');
                            }}
                            secureTextEntry
                        />
                        {passwordError ? (
                            <Text style={[styles.errorText, { color: currentTheme.colors.error }]}>
                                {passwordError}
                            </Text>
                        ) : null}
                    </View>
                </Section>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
                    onPress={handleLogin}
                >
                    <Text style={[styles.buttonText, { color: currentTheme.colors.text.light }]}>
                        {t('auth.signin')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.forgotPasswordLink}
                    onPress={() => router.push('/(tabs)/account/(auth)/forgot-password')}
                >
                    <Text style={[styles.linkText, { color: currentTheme.colors.text.primary }]}>
                        {t('auth.forgot_password_link')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.signupLink}
                    onPress={() => router.push('/(tabs)/account/(auth)/signup')}
                >
                    <Text style={[styles.linkText, { color: currentTheme.colors.text.primary }]}>
                        {t('auth.signup_link')}
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
    forgotPasswordLink: {
        marginTop: theme.spacing.md,
        alignItems: 'center',
    },
    signupLink: {
        marginTop: theme.spacing.md,
        alignItems: 'center',
    },
    linkText: {
        ...theme.typography.small,
        fontWeight: '500',
    },
});
