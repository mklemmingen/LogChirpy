/**
 * Global Audio Manager Service
 * 
 * Manages all audio playback instances across the app to prevent conflicts
 * and "Player does not exist" errors. Ensures only one audio plays at a time.
 */

import { Audio } from 'expo-av';

interface AudioInstance {
    id: string;
    sound: Audio.Sound;
    component: string;
    uri: string;
}

class AudioManager {
    private static instance: AudioManager;
    private activeAudio: AudioInstance | null = null;
    private readonly audioMode = {
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
    };

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    /**
     * Play audio with automatic cleanup of any existing audio
     */
    async playAudio(
        uri: string, 
        component: string, 
        options?: { shouldPlay?: boolean; isLooping?: boolean }
    ): Promise<Audio.Sound> {
        console.log(`[AudioManager] Playing audio from ${component}: ${uri}`);
        
        // Stop any currently playing audio
        await this.stopCurrentAudio();

        // Set consistent audio mode
        try {
            await Audio.setAudioModeAsync(this.audioMode);
        } catch (modeError) {
            console.warn('[AudioManager] Failed to set audio mode:', modeError);
        }

        // Create new audio instance
        const { sound } = await Audio.Sound.createAsync({ uri }, options);
        const id = `${component}-${Date.now()}`;
        
        this.activeAudio = { id, sound, component, uri };
        
        // Set up auto-cleanup on finish
        sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
                this.cleanupAudio(id);
            }
        });

        return sound;
    }

    /**
     * Stop currently playing audio
     */
    async stopCurrentAudio(): Promise<void> {
        if (this.activeAudio) {
            console.log(`[AudioManager] Stopping audio from ${this.activeAudio.component}`);
            
            try {
                const status = await this.activeAudio.sound.getStatusAsync();
                if (status.isLoaded) {
                    await this.activeAudio.sound.stopAsync();
                    await this.activeAudio.sound.unloadAsync();
                }
            } catch (error) {
                console.warn('[AudioManager] Error stopping audio:', error);
            } finally {
                this.activeAudio = null;
            }
        }
    }

    /**
     * Clean up specific audio instance
     */
    async cleanupAudio(id: string): Promise<void> {
        if (this.activeAudio && this.activeAudio.id === id) {
            console.log(`[AudioManager] Cleaning up audio: ${id}`);
            
            try {
                await this.activeAudio.sound.unloadAsync();
            } catch (error) {
                console.warn('[AudioManager] Error during cleanup:', error);
            } finally {
                this.activeAudio = null;
            }
        }
    }

    /**
     * Check if audio is currently playing
     */
    isPlaying(): boolean {
        return this.activeAudio !== null;
    }

    /**
     * Get current audio info
     */
    getCurrentAudio(): { component: string; uri: string } | null {
        return this.activeAudio 
            ? { component: this.activeAudio.component, uri: this.activeAudio.uri }
            : null;
    }

    /**
     * Stop all audio on app background/focus loss
     */
    async stopAllAudio(): Promise<void> {
        console.log('[AudioManager] Stopping all audio');
        await this.stopCurrentAudio();
    }
}

// Export singleton instance
export const audioManager = AudioManager.getInstance();

/**
 * Convenience function for simple audio playback
 */
export async function playAudioSafe(
    uri: string, 
    component: string,
    options?: { shouldPlay?: boolean; isLooping?: boolean }
): Promise<Audio.Sound> {
    return audioManager.playAudio(uri, component, options);
}

/**
 * Convenience function to stop current audio
 */
export async function stopCurrentAudio(): Promise<void> {
    return audioManager.stopCurrentAudio();
}