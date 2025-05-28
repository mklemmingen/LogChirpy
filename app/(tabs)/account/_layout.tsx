import React from 'react';
import {Stack} from 'expo-router';

export default function AccountLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        />
    );
}
