import React from 'react';
import { Stack } from 'expo-router';

export default function LogLayout({ children }: { children: React.ReactNode }) {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            {children}
        </Stack>
    );
}
