import {Stack} from 'expo-router';
import {useSemanticColors} from '@/hooks/useThemeColor';

export default function AccountLayout() {
    const semanticColors = useSemanticColors();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: {
                    backgroundColor: semanticColors.background,
                },
            }}
        >
            <Stack.Screen
                name="(auth)"
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="profile"
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="index"
                options={{
                    headerShown: false,
                }}
            />
        </Stack>
    );
}
