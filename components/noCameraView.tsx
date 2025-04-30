import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';

interface NoCameraErrorViewProps {
    onRetry: () => void;  // A function that is triggered when the user presses retry
}

export const NoCameraErrorView: React.FC<NoCameraErrorViewProps> = ({ onRetry }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.errorMessage}>No Camera Found</Text>
            <Text style={styles.suggestion}>
                Please check your device's camera settings or permissions.
            </Text>
            <Button title="Retry" onPress={onRetry} />
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
