import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

interface HapticTabProps extends Omit<React.ComponentProps<typeof Pressable>, 'onPress'> {
  children: React.ReactNode;
  onPress?: () => void;
}

export function HapticTab({ children, onPress, ...props }: HapticTabProps) {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [audioModeOK, setAudioModeOK] = useState(false);

    useEffect(() => {
        async function loadSoundAsync() { // eslint-disable-line @typescript-eslint/no-unused-vars
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

        // loadSoundAsync(); # commented out for now TODO

        return () => {
            sound?.unloadAsync(); // Clean up
        };
    }, [sound]);

    const handlePress = async () => {
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
            onPress();
        }
    };

    return (
        <Pressable onPress={handlePress} {...props}>
            {children}
        </Pressable>
    );
}
