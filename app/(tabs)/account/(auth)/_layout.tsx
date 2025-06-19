import React from 'react';
import {Stack} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useSemanticColors} from '@/hooks/useThemeColor';

export default function AuthLayout() {
    const { t } = useTranslation();
    const semanticColors = useSemanticColors();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: {
                    backgroundColor: semanticColors.background,
                },
            }}
        >
            <Stack.Screen
                name="login"
                options={{
                    title: t('auth.signin', 'Sign In'),
                }}
            />
            <Stack.Screen
                name="signup"
                options={{
                    title: t('auth.signup', 'Sign Up'),
                }}
            />
            <Stack.Screen
                name="forgot-password"
                options={{
                    title: t('auth.forgot_password', 'Forgot Password'),
                }}
            />
        </Stack>
    );
} 