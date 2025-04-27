import { useState, useEffect } from "react";
import { View, Text, Image, StyleSheet, ActivityIndicator, ScrollView, useColorScheme } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getSpottingById } from "@/services/database"; // <-- we will add this
import { theme } from "@/constants/theme";

export default function ArchiveDetailScreen() {
    const { id } = useLocalSearchParams();
    const [spotting, setSpotting] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

    useEffect(() => {
        async function loadSpotting() {
            try {
                const entry = await getSpottingById(Number(id));
                setSpotting(entry);
            } catch (error) {
                console.error('Failed to load spotting', error);
            } finally {
                setLoading(false);
            }
        }
        loadSpotting();
    }, [id]);

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={currentTheme.colors.primary} />
            </View>
        );
    }

    if (!spotting) {
        return (
            <View style={styles.centered}>
                <Text>No spotting found.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={{ flex: 1, backgroundColor: currentTheme.colors.background }}>
            <View style={styles.container}>
                {spotting.image_uri ? (
                    <Image source={{ uri: spotting.image_uri }} style={styles.image} />
                ) : null}
                <Text style={[styles.title, { color: currentTheme.colors.text.primary }]}>
                    {spotting.bird_type}
                </Text>
                <Text style={[styles.subtitle, { color: currentTheme.colors.text.secondary }]}>
                    {new Date(spotting.date).toLocaleString()}
                </Text>

                <Text style={[styles.body, { color: currentTheme.colors.text.primary }]}>
                    Notes: {spotting.text_note || "None"}
                </Text>

                <Text style={[styles.body, { color: currentTheme.colors.text.primary }]}>
                    GPS: {spotting.gps_lat}, {spotting.gps_lng}
                </Text>

                <Text style={[styles.body, { color: currentTheme.colors.text.primary }]}>
                    Image Prediction: {spotting.image_prediction || "N/A"}
                </Text>

                <Text style={[styles.body, { color: currentTheme.colors.text.primary }]}>
                    Audio Prediction: {spotting.audio_prediction || "N/A"}
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    image: {
        width: "100%",
        height: 200,
        borderRadius: theme.borderRadius.lg,
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 12,
    },
    body: {
        fontSize: 16,
        marginBottom: 8,
    }
});
