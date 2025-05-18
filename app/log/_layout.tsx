import { Stack } from 'expo-router';
import { LogDraftProvider } from '../context/LogDraftContext';

export default function LogLayout() {
    return (
        <LogDraftProvider>
            <Stack initialRouteName="manual" screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}>
                <Stack.Screen name="manual" options={{ headerShown: false, title: 'TODO translate manual input / saving entry' }} />
                <Stack.Screen name="photo" options={{ headerShown: false, title: 'TODO translate take the photo' }} />
                <Stack.Screen name="video" options={{ headerShown: false, title: 'TODO translate take a video' }} />
                <Stack.Screen name="audio" options={{ headerShown: false, title: 'TODO translate record an audio' }} />
            </Stack>
        </LogDraftProvider>
    );
}