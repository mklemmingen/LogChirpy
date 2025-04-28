import React from 'react';
import { View } from 'react-native';
import {Stack} from "expo-router";

export default function VideoCapture() {
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View>
                {/* Restlicher Inhalt */}
            </View>
        </>
    );
}