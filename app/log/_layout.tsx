import React from 'react';
import { Stack } from 'expo-router';
import { LogDraftProvider } from '../context/LogDraftContext';

export default function LogLayout({ children }: { children: React.ReactNode }) {
    return (
        <LogDraftProvider>
            <Stack screenOptions={{ headerShown: false }}>
                {children}
            </Stack>
        </LogDraftProvider>
    );
}
