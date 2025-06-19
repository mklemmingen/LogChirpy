import React from 'react';
import { Stack } from 'expo-router';
import { Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function BirdexLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: true,
                headerRight: () => (
                    <Pressable onPress={() => router.push('/birdex/quiz')} style={{ marginRight: 12 }}>
                        <Feather name="award" size={24} color="black" />
                    </Pressable>
                ),
            }}
        />
    );
}