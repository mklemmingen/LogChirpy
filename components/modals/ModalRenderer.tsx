/**
 * Modal Renderer Component
 * 
 * Centralized modal rendering system that ensures only one modal
 * is rendered at a time, preventing view hierarchy conflicts.
 */

import React, { useCallback, useState } from 'react';
import { Modal } from 'react-native';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import NavigationErrorBoundary from '@/components/NavigationErrorBoundary';

import { useModal } from '@/app/context/ModalContext';
import { DatePickerModal } from './DatePickerModal';
import { VideoPlayerModal } from './VideoPlayerModal';
import { BirdPredictionsModal } from './BirdPredictionsModal';
import { PhotoPreviewModal } from './PhotoPreviewModal';
import { ConfirmationModal } from './ConfirmationModal';
import { LoadingModal } from './LoadingModal';
import { Z_LAYERS } from '@/constants/layers';

export const ModalRenderer: React.FC = () => {
  const { state, hideModal } = useModal();
  const isFocused = useIsFocused();
  const [isVisible, setIsVisible] = useState(false);

  // Focus-based modal visibility with navigation awareness
  useFocusEffect(
    useCallback(() => {
      if (state.isVisible && isFocused) {
        setIsVisible(true);
      }
      
      return () => {
        // Force cleanup on screen blur to prevent hierarchy conflicts
        setIsVisible(false);
        if (state.isVisible) {
          hideModal();
        }
      };
    }, [state.isVisible, isFocused, hideModal])
  );

  // Don't render if screen not focused or modal not visible
  if (!isFocused || !isVisible || !state.currentModal) {
    return null;
  }

  const { type, props } = state.currentModal;

  const renderModalContent = () => {
    switch (type) {
      case 'date-picker':
        return <DatePickerModal {...props} />;
      
      case 'video-player':
        return <VideoPlayerModal {...props} />;
      
      case 'bird-predictions':
        return <BirdPredictionsModal {...props} />;
      
      case 'photo-preview':
        return <PhotoPreviewModal {...props} />;
      
      case 'confirmation':
        return <ConfirmationModal {...props} />;
      
      case 'loading':
        return <LoadingModal {...props} />;
      
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      onRequestClose={hideModal}
      animationType="fade"
      statusBarTranslucent={true} // Prevent StatusBar conflicts
      style={{
        zIndex: Z_LAYERS.MODALS,
      }}
    >
      <NavigationErrorBoundary>
        {renderModalContent()}
      </NavigationErrorBoundary>
    </Modal>
  );
};