import {Stack} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {LogDraftProvider} from '../context/LogDraftContext';

export default function LogLayout() {
    const { t } = useTranslation();
    
    return (
        <LogDraftProvider>
            <Stack initialRouteName="manual" screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                // Critical: Prevent view hierarchy conflicts for camera screens
                // Note: unmountOnBlur not available in current React Navigation version
                // Using freezeOnBlur alternative for memory management
            }}>
                <Stack.Screen name="manual" options={{ 
                    headerShown: false, 
                    title: t('log_screens.manual_title'),
                    // Enhanced cleanup for manual screen (may contain camera components)
                    animation: 'none',
                }} />
                <Stack.Screen name="photo" options={{ 
                    headerShown: false, 
                    title: t('log_screens.photo_title'),
                    // Critical: Disable animations to prevent view hierarchy issues
                    animation: 'none',
                }} />
                <Stack.Screen name="video" options={{ 
                    headerShown: false, 
                    title: t('log_screens.video_title'),
                    // Critical: Disable animations for camera screens
                    animation: 'none',
                }} />
                <Stack.Screen name="audio" options={{ 
                    headerShown: false, 
                    title: t('log_screens.audio_title'),
                    animation: 'none',
                }} />
                <Stack.Screen name="camera" options={{ 
                    headerShown: false, 
                    title: t('log_screens.camera_title'),
                    // Critical: Disable animations for camera screens
                    animation: 'none',
                }} />
                <Stack.Screen name="objectIdentCamera" options={{ 
                    headerShown: false, 
                    title: t('log_screens.object_camera_title'),
                    // Critical: Disable animations for ML camera screens
                    animation: 'none',
                }} />
            </Stack>
        </LogDraftProvider>
    );
}