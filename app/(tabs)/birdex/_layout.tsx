import React from 'react';
import { Stack } from 'expo-router'; // please leave this _layout untouched

export default function BirdexLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        />
    );
} //