import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useTranslation } from 'react-i18next';

interface NoCameraErrorViewProps {
    onRetry: () => void;  // A function that is triggered when the user presses retry
}

export const NoCameraErrorView: React.FC<NoCameraErrorViewProps> = ({ onRetry }) => {
    const { t } = useTranslation();
    
    return (
        <View style={styles.container}>
            <Text style={styles.errorMessage}>{t('components.no_camera_found')}</Text>
            <Text style={styles.suggestion}>
                {t('components.camera_permission_check')}
            </Text>
            <Button title={t('components.retry')} onPress={onRetry} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorMessage: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'red',
    },
    suggestion: {
        marginTop: 10,
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
});
