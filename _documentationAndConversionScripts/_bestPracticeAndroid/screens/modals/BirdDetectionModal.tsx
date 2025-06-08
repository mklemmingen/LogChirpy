/**
 * BirdDetectionModal.tsx - Detection results modal
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { Surface, Text, Button } from 'react-native-paper';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  detection?: any;
}

export default function BirdDetectionModal({ isVisible, onClose, detection }: Props) {
  return (
    <Modal isVisible={isVisible} onBackdropPress={onClose} style={styles.modal}>
      <Surface style={styles.content}>
        <Text variant="headlineSmall">Detection Result</Text>
        {detection && (
          <View>
            <Text>{detection.species.common_name}</Text>
            <Text>Confidence: {(detection.confidence * 100).toFixed(1)}%</Text>
          </View>
        )}
        <Button onPress={onClose}>Close</Button>
      </Surface>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { justifyContent: 'center', margin: 20 },
  content: { padding: 20, borderRadius: 8 },
});