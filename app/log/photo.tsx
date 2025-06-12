import React from 'react';
import {StyleSheet, useColorScheme, View} from 'react-native';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {launchImageLibrary, ImagePickerResponse, MediaType, ImageLibraryOptions} from 'react-native-image-picker';
import * as Haptics from 'expo-haptics';
import {ThemedIcon} from '@/components/ThemedIcon';

import {ThemedView} from '@/components/ThemedView';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedText} from '@/components/ThemedText';
import {theme} from '@/constants/theme';
import {useLogDraft} from '@/contexts/LogDraftContext';
import { filePathToUri } from '@/services/uriUtils';

export default function PhotoCapture() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? 'light';
  const pal = theme[colorScheme];
  const { update } = useLogDraft();

  const handleGalleryPick = async () => {
    try {
      const options: ImageLibraryOptions = {
        mediaType: 'photo',
        maxWidth: 2048,
        maxHeight: 2048,
        includeBase64: false,
        selectionLimit: 1,
      };

      launchImageLibrary(options, (response: ImagePickerResponse) => {
        if (response.didCancel || response.errorMessage) {
          if (response.errorMessage) {
            console.error('Image picker error:', response.errorMessage);
          }
          return;
        }

        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          if (asset.uri) {
            // Ensure proper URI formatting for React Native Image component
            update({ imageUri: filePathToUri(asset.uri) });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          }
        }
      });
    } catch (error) {
      console.error('Gallery picker error:', error);
    }
  };

  const handleCameraLaunch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/log/camera');
  };

  return (
      <ThemedView style={[styles.container, { backgroundColor: pal.colors.background.primary }]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: pal.colors.primary + '20' }]}>
              <ThemedIcon name="camera" size={48} color="primary" />
            </View>

            <ThemedText variant="displaySmall" style={styles.title}>
              {t('photo.add_photo')}
            </ThemedText>

            <ThemedText variant="bodyLarge" color="secondary" style={styles.subtitle}>
              {t('photo.capture_description')}
            </ThemedText>
          </View>

          <View style={styles.actions}>
            <ThemedPressable
                variant="primary"
                size="lg"
                onPress={handleCameraLaunch}
                style={styles.actionButton}
            >
              <ThemedIcon name="camera" size={24} color="primary" />
              <ThemedText variant="labelLarge" color="primary">
                {t('photo.take_photos')}
              </ThemedText>
            </ThemedPressable>

            <ThemedPressable
                variant="secondary"
                size="lg"
                onPress={handleGalleryPick}
                style={styles.actionButton}
            >
              <ThemedIcon name="image" size={24} color="primary" />
              <ThemedText variant="labelLarge" color="primary">
                {t('photo.choose_existing')}
              </ThemedText>
            </ThemedPressable>
          </View>
        </View>
      </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 48,
  },
  header: {
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    gap: 12,
  },
});