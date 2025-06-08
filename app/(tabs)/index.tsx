import React from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, Card, FAB } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { SimpleBirdAnimation } from '@/components/animations/SimpleBirdAnimation';

const { width, height } = Dimensions.get('window');

interface FeatureAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  primary?: boolean;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  
  const styles = createStyles();



  const features: FeatureAction[] = [
    {
      id: 'detection',
      title: 'Real-time Detection',
      description: 'Use AI to detect birds in real-time',
      icon: 'camera-burst',
      route: '/detection',
      primary: true,
    },
    {
      id: 'photo',
      title: 'Photo Logging',
      description: 'Log birds from photos',
      icon: 'camera',
      route: '/log/photo',
    },
    {
      id: 'audio',
      title: 'Audio Recording',
      description: 'Record and identify bird sounds',
      icon: 'microphone',
      route: '/log/audio',
    },
    {
      id: 'manual',
      title: 'Manual Entry',
      description: 'Manually log bird sightings',
      icon: 'pencil',
      route: '/log/manual',
    },
  ];

  const handleFeaturePress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  const renderFeatureCard = (feature: FeatureAction, index: number) => {
    const isPrimary = feature.primary;

    return (
      <Card 
        key={feature.id}
        style={[styles.card, isPrimary && styles.primaryCard]}
        mode={isPrimary ? 'elevated' : 'outlined'}
        onPress={() => handleFeaturePress(feature.route)}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
                name={feature.icon as any}
                size={32}
                color={isPrimary ? '#4CAF50' : '#757575'}
            />
          </View>
          
          <View style={styles.cardTextContent}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              {feature.title}
            </Text>
            <Text variant="bodyMedium" style={styles.cardDescription}>
              {feature.description}
            </Text>
          </View>
          
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#757575"
          />
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <SimpleBirdAnimation numberOfBirds={3} enabled={true} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Text variant="displayMedium" style={styles.heroTitle}>
            Welcome to LogChirpy
          </Text>
          <Text variant="bodyLarge" style={styles.heroSubtitle}>
            Start logging your bird sightings
          </Text>
        </View>

        <View style={styles.featuresSection}>
          {features.map((feature, index) => renderFeatureCard(feature, index))}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
    minHeight: height * 0.3,
    justifyContent: 'center',
  },
  heroTitle: {
    marginBottom: 10,
    textAlign: 'center',
    color: '#2E7D32',
  },
  heroSubtitle: {
    textAlign: 'center',
    color: '#757575',
    maxWidth: width * 0.85,
  },
  featuresSection: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    marginBottom: 8,
  },
  primaryCard: {
    backgroundColor: '#E8F5E8',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardTextContent: {
    flex: 1,
  },
  cardTitle: {
    marginBottom: 4,
    fontWeight: 'bold',
  },
  cardDescription: {
    color: '#757575',
  },
});