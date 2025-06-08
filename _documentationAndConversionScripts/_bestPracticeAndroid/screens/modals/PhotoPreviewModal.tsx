/**
 * PhotoPreviewModal.tsx - Photo preview and editing modal
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { Surface, Text, Button } from 'react-native-paper';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  imageUri?: string;
}

export default function PhotoPreviewModal({ isVisible, onClose, imageUri }: Props) {
  return (
    <Modal isVisible={isVisible} onBackdropPress={onClose} style={styles.modal}>
      <Surface style={styles.content}>
        <Text variant="headlineSmall">Photo Preview</Text>
        <Text>Image: {imageUri}</Text>
        <Button onPress={onClose}>Close</Button>
      </Surface>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { margin: 0 },
  content: { flex: 1, padding: 20 },
});