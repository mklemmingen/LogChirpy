import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

export function HapticTab({ children, onPress, ...props }: any) {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [audioModeOK, setAudioModeOK] = useState(false);

    useEffect(() => {
        async function loadSound() {
            // Preload the sound once when component mounts
            const { sound } = await Audio.Sound.createAsync(
                require('@/assets/sounds/click.mp3'),
                { shouldPlay: false }
            );
            setSound(sound);

            // Configure Audio mode: allow playing only when not muted
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: false, // don't play sound in iOS silent mode
                staysActiveInBackground: false,
            });

            setAudioModeOK(true);
        }

        // loadSound(); # commented out for now TODO

        return () => {
            sound?.unloadAsync(); // Clean up
        };
    }, []);

    const handlePress = async (e: any) => {
        try {
            // Always trigger haptic feedback
            await Haptics.selectionAsync();

            if (audioModeOK && sound) {
                const status = await sound.getStatusAsync();
                if (status.isLoaded) {
                    await sound.replayAsync(); // Play only if allowed
                }
            }
        } catch (error) {
            console.warn('HapticTab press error:', error);
        }

        if (onPress) {
            onPress(e);
        }
    };

    return (
        <Pressable onPress={handlePress} {...props}>
            {children}
        </Pressable>
    );
}
