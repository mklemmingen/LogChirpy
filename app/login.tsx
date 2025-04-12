import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { auth } from '@/firebase/config';

export default function LoginScreen() {
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
            setEmailError('Email is required');
            return;
        }

        if (!password) {
            setPasswordError('Password is required');
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.replace('/(tabs)');
        } catch (error: any) {
            switch (error.code) {
                case 'auth/invalid-email':
                    setEmailError('Please enter a valid email address');
                    break;
                case 'auth/user-disabled':
                    setEmailError('This account has been disabled');
                    break;
                case 'auth/user-not-found':
                    setEmailError('No account found with this email');
                    break;
                case 'auth/wrong-password':
                    setPasswordError('Incorrect password');
                    break;
                case 'auth/too-many-requests':
                    setPasswordError('Too many failed attempts. Please try again later');
                    break;
                case 'auth/invalid-credential':
                    setPasswordError('Wrong email or password');
                    break;
                case 'auth/network-request-failed':
                    setPasswordError('Network error. Please check your connection');
                    break;
                default:
                    setPasswordError('An error occurred during sign in');
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
                <Text style={[styles.title, { color: currentTheme.colors.text.primary }]}>Welcome Back</Text>
                <Text style={[styles.subtitle, { color: currentTheme.colors.text.primary }]}>Sign in to continue</Text>

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
                        placeholder="Password"
                        placeholderTextColor={currentTheme.colors.text.primary + '80'}
                        value={password}
                        onChangeText={(text) => {
                            setPassword(text);
                            setPasswordError('');
                        }}
                        secureTextEntry
                    />
                    {passwordError ? <Text style={[styles.errorText, { color: currentTheme.colors.error }]}>{passwordError}</Text> : null}
                </View>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
                    onPress={handleLogin}
                >
                    <Text style={[styles.buttonText, { color: currentTheme.colors.text.light }]}>Sign In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.signupLink}
                    onPress={() => router.push('/signup')}
                >
                    <Text style={[styles.linkText, { color: currentTheme.colors.text.primary }]}>
                        Don't have an account? Sign up
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
    signupLink: {
        marginTop: theme.spacing.lg,
        alignItems: 'center',
    },
    linkText: {
        ...theme.typography.small,
        fontWeight: '500',
    },
}); 