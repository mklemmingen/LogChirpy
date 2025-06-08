/**
 * Modal System Types
 * 
 * Centralized type definitions for the modal management system.
 */

export type ModalType = 
  | 'date-picker'
  | 'video-player' 
  | 'bird-predictions'
  | 'photo-preview'
  | 'confirmation'
  | 'loading';

export interface BaseModalProps {
  onClose: () => void;
  onConfirm?: () => void;
}

export interface DatePickerModalProps extends BaseModalProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  maximumDate?: Date;
}

export interface VideoPlayerModalProps extends BaseModalProps {
  videoPlayer: any; // Replace with actual video player type
  onRetake?: () => void;
}

export interface BirdPredictionsModalProps extends BaseModalProps {
  predictions: Array<{
    common_name: string;
    scientific_name: string;
    confidence: number;
  }>;
  onSelectPrediction: (prediction: any) => void;
}

export interface PhotoPreviewModalProps extends BaseModalProps {
  imageUri: string;
  detections?: Array<{
    frame: { origin: { x: number; y: number }; size: { x: number; y: number } };
    labels: Array<{ text: string; confidence: number }>;
  }>;
}

export interface ConfirmationModalProps extends BaseModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export interface LoadingModalProps {
  message: string;
  progress?: number;
}

export type ModalProps = 
  | { type: 'date-picker'; props: DatePickerModalProps }
  | { type: 'video-player'; props: VideoPlayerModalProps }
  | { type: 'bird-predictions'; props: BirdPredictionsModalProps }
  | { type: 'photo-preview'; props: PhotoPreviewModalProps }
  | { type: 'confirmation'; props: ConfirmationModalProps }
  | { type: 'loading'; props: LoadingModalProps };

export interface ModalState {
  currentModal: ModalProps | null;
  isVisible: boolean;
}

export interface ModalContextType {
  state: ModalState;
  showModal: (modalProps: ModalProps) => void;
  hideModal: () => void;
  isModalVisible: (type?: ModalType) => boolean;
}