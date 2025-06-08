/**
 * Modal Renderer Component
 * 
 * Centralized modal rendering system that ensures only one modal
 * is rendered at a time, preventing view hierarchy conflicts.
 */

import React from 'react';
import { Modal } from 'react-native';

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

  if (!state.isVisible || !state.currentModal) {
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
      visible={state.isVisible}
      transparent={true}
      onRequestClose={hideModal}
      style={{
        zIndex: Z_LAYERS.MODALS,
      }}
    >
      {renderModalContent()}
    </Modal>
  );
};