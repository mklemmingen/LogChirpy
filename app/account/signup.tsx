import { useState, useEffect } from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet, Image, useColorScheme} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { auth } from '@/firebase/config';

export default function SignupScreen() {
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

    const handleSignup = async () => {
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

        if (password.length < 6) {
            setPasswordError('Password must be at least 6 characters long');
            return;
        }

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            router.replace('/(tabs)');
        } catch (error: any) {
            switch (error.code) {
                case 'auth/invalid-email':
                    setEmailError('Please enter a valid email address');
                    break;
                case 'auth/email-already-in-use':
                    setEmailError('This email is already registered. Please sign in instead');
                    break;
                case 'auth/weak-password':
                    setPasswordError('Password is too weak. Please use a stronger password');
                    break;
                case 'auth/operation-not-allowed':
                    setEmailError('Email/password accounts are not enabled');
                    break;
                case 'auth/network-request-failed':
                    setEmailError('Network error. Please check your connection');
                    break;
                default:
                    setEmailError('An error occurred during sign up');
            }
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
            <View style={styles.logoContainer}>
                <Image
                    source={require('../../assets/images/logo_no_bg.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>

            <View style={styles.formContainer}>
                <Text style={[styles.title, { color: currentTheme.colors.text.primary }]}>Create Account</Text>
                <Text style={[styles.subtitle, { color: currentTheme.colors.text.primary }]}>Join LogChirpy today</Text>

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
                    onPress={handleSignup}
                >
                    <Text style={[styles.buttonText, { color: currentTheme.colors.text.light }]}>Sign Up</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.loginLink}
                    onPress={() => router.push('//account/login')}
                >
                    <Text style={[styles.linkText, { color: currentTheme.colors.text.primary }]}>
                        Already have an account? Sign in
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
    loginLink: {
        marginTop: theme.spacing.lg,
        alignItems: 'center',
    },
    linkText: {
        ...theme.typography.small,
        fontWeight: '500',
    },
}); 