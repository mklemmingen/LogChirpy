import {Stack} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {LogDraftProvider} from '@/contexts/LogDraftContext';

export default function LogLayout() {
    const { t } = useTranslation();
    
    return (
        <LogDraftProvider>
            <Stack initialRouteName="manual" screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}>
                <Stack.Screen name="manual" options={{ headerShown: false, title: t('log_screens.manual_title') }} />
                <Stack.Screen name="photo" options={{ headerShown: false, title: t('log_screens.photo_title') }} />
                <Stack.Screen name="video" options={{ headerShown: false, title: t('log_screens.video_title') }} />
                <Stack.Screen name="audio" options={{ headerShown: false, title: t('log_screens.audio_title') }} />
            </Stack>
        </LogDraftProvider>
    );
}