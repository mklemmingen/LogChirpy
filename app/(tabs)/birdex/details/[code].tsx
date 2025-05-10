import React, { useEffect, useState } from 'react';
import {
    SafeAreaView, ScrollView, Text, StyleSheet,
    Pressable, ActivityIndicator, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DB } from '@/services/databaseBirDex';
import { type BirdDexRecord } from '@/services/databaseBirDex';

export default function BirdDexDetail() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const [rec, setRec] = useState<(BirdDexRecord & { hasBeenLogged: 0|1 })|null>(null);

    useEffect(() => {
        try {
            const db = DB();
            const stmt = db.prepareSync(`
                SELECT
                    b.*,
                    CASE WHEN EXISTS(
                        SELECT 1 FROM bird_spottings s
                        WHERE s.latinBirDex = b.scientific_name
                    ) THEN 1 ELSE 0 END AS hasBeenLogged
                FROM birddex b
                WHERE b.species_code = ?
                    LIMIT 1;
            `);
            const rows = stmt.executeSync(code).getAllSync() as any[];
            stmt.finalizeSync();
            if (rows.length) setRec(rows[0]);
            else Alert.alert(t('birddex.error'), t('birddex.notFound'));
        } catch (e) {
            console.error(e);
            Alert.alert(t('birddex.error'), t('birddex.loadDetailFailed'));
        }
    }, [code]);

    if (!rec) {
        return (
            <SafeAreaView style={styles.center}>
                <ActivityIndicator size="large" />
            </SafeAreaView>
        );
    }

    // pick translation column
    const lang = i18n.language.split('-')[0];
    const localized = {
        de: rec.german_name,
        es: rec.spanish_name,
        uk: rec.ukrainian_name,
        ar: rec.arabic_name
    }[lang] || '';
    const displayName = localized || rec.english_name;

    return (
        <SafeAreaView style={styles.container}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Text style={styles.backTxt}>{t('birddex.back')}</Text>
            </Pressable>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>{displayName}</Text>
                <Text style={styles.subTitle}>{rec.scientific_name}</Text>

                <Text style={styles.field}>
                    <Text style={styles.label}>{t('birddex.category')}: </Text>
                    {rec.category}
                </Text>
                <Text style={styles.field}>
                    <Text style={styles.label}>{t('birddex.family')}: </Text>
                    {rec.family}
                </Text>
                <Text style={styles.field}>
                    <Text style={styles.label}>{t('birddex.range')}: </Text>
                    {rec.range}
                </Text>
                <Text style={styles.field}>
                    <Text style={styles.label}>{t('birddex.status')}: </Text>
                    {rec.extinct === 'yes'
                        ? t('birddex.extinct', { year: rec.extinct_year || '?' })
                        : t('birddex.notExtinct')}
                </Text>

                <Text style={styles.label}>{t('birddex.translations')}:</Text>
                {['English','German','Spanish','Ukrainian','Arabic'].map((lbl, i) => {
                    const key = (['english_name','german_name','spanish_name','ukrainian_name','arabic_name'] as const)[i];
                    return (
                        <Text key={key} style={styles.field}>
                            • {lbl}: {rec[key] || t('birddex.none')}
                        </Text>
                    );
                })}

                <Text style={styles.field}>
                    <Text style={styles.label}>{t('birddex.logged')}: </Text>
                    {rec.hasBeenLogged ? '✅' : t('birddex.no')}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container:  { flex: 1, padding: 16 },
    center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backBtn:    { marginBottom: 12 },
    backTxt:    { fontSize: 16, color: '#007AFF' },

    content:    { paddingBottom: 32 },
    title:      { fontSize: 28, fontWeight: '700', marginBottom: 4 },
    subTitle:   { fontSize: 18, fontStyle: 'italic', marginBottom: 16 },

    label:      { fontWeight: '600' },
    field:      { fontSize: 16, marginBottom: 8 },
});
