/**
 * Modal Management Context
 * 
 * Centralized modal state management to prevent view hierarchy conflicts.
 * Ensures only one modal can be active at a time.
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { ModalState, ModalContextType, ModalProps, ModalType } from '@/types/modal';

// Modal reducer for state management
type ModalAction = 
  | { type: 'SHOW_MODAL'; payload: ModalProps }
  | { type: 'HIDE_MODAL' };

const modalReducer = (state: ModalState, action: ModalAction): ModalState => {
  switch (action.type) {
    case 'SHOW_MODAL':
      return {
        currentModal: action.payload,
        isVisible: true,
      };
    case 'HIDE_MODAL':
      return {
        currentModal: null,
        isVisible: false,
      };
    default:
      return state;
  }
};

const initialState: ModalState = {
  currentModal: null,
  isVisible: false,
};

// Create context
const ModalContext = createContext<ModalContextType | undefined>(undefined);

// Provider component
interface ModalProviderProps {
  children: React.ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(modalReducer, initialState);

  const showModal = useCallback((modalProps: ModalProps) => {
    // Close any existing modal first with proper cleanup delay
    if (state.isVisible) {
      dispatch({ type: 'HIDE_MODAL' });
      // Longer delay for Android to prevent view conflicts
      setTimeout(() => {
        dispatch({ 
          type: 'SHOW_MODAL', 
          payload: modalProps 
        });
      }, 150);
    } else {
      // Still add small delay for view hierarchy stability
      setTimeout(() => {
        dispatch({ 
          type: 'SHOW_MODAL', 
          payload: modalProps 
        });
      }, 50);
    }
  }, [state.isVisible]);

  const hideModal = useCallback(() => {
    dispatch({ type: 'HIDE_MODAL' });
  }, []);

  const isModalVisible = useCallback((type?: ModalType) => {
    if (!type) return state.isVisible;
    return state.isVisible && state.currentModal?.type === type;
  }, [state.isVisible, state.currentModal?.type]);

  const contextValue: ModalContextType = {
    state,
    showModal,
    hideModal,
    isModalVisible,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
    </ModalContext.Provider>
  );
};

// Hook to use modal context
export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

// Convenience hooks for specific modal types
export const useDatePickerModal = () => {
  const { showModal, hideModal, isModalVisible } = useModal();
  
  return {
    showDatePicker: (props: Extract<ModalProps, { type: 'date-picker' }>['props']) => 
      showModal({ type: 'date-picker', props }),
    hideDatePicker: hideModal,
    isDatePickerVisible: () => isModalVisible('date-picker'),
  };
};

export const useVideoPlayerModal = () => {
  const { showModal, hideModal, isModalVisible } = useModal();
  
  return {
    showVideoPlayer: (props: Extract<ModalProps, { type: 'video-player' }>['props']) => 
      showModal({ type: 'video-player', props }),
    hideVideoPlayer: hideModal,
    isVideoPlayerVisible: () => isModalVisible('video-player'),
  };
};

export const useBirdPredictionsModal = () => {
  const { showModal, hideModal, isModalVisible } = useModal();
  
  return {
    showBirdPredictions: (props: Extract<ModalProps, { type: 'bird-predictions' }>['props']) => 
      showModal({ type: 'bird-predictions', props }),
    hideBirdPredictions: hideModal,
    isBirdPredictionsVisible: () => isModalVisible('bird-predictions'),
  };
};

export const usePhotoPreviewModal = () => {
  const { showModal, hideModal, isModalVisible } = useModal();
  
  return {
    showPhotoPreview: (props: Extract<ModalProps, { type: 'photo-preview' }>['props']) => 
      showModal({ type: 'photo-preview', props }),
    hidePhotoPreview: hideModal,
    isPhotoPreviewVisible: () => isModalVisible('photo-preview'),
  };
};

export const useConfirmationModal = () => {
  const { showModal, hideModal, isModalVisible } = useModal();
  
  return {
    showConfirmation: (props: Extract<ModalProps, { type: 'confirmation' }>['props']) => 
      showModal({ type: 'confirmation', props }),
    hideConfirmation: hideModal,
    isConfirmationVisible: () => isModalVisible('confirmation'),
  };
};

export const useLoadingModal = () => {
  const { showModal, hideModal, isModalVisible } = useModal();
  
  return {
    showLoading: (props: Extract<ModalProps, { type: 'loading' }>['props']) => 
      showModal({ type: 'loading', props }),
    hideLoading: hideModal,
    isLoadingVisible: () => isModalVisible('loading'),
  };
};

// Default export for router compatibility
export default ModalProvider;