/**
 * DetectionStore.ts - Zustand state management for Android 2025 patterns
 * 
 * Lightweight state management optimized for real-time ML detection
 * Replaces Context API for better performance and minimal re-renders
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface Detection {
  id: string;
  timestamp: number;
  type: 'object' | 'image' | 'audio';
  birdName?: string;
  confidence?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  imageUri?: string;
  audioUri?: string;
  metadata?: Record<string, any>;
}

export interface CameraState {
  isActive: boolean;
  isReady: boolean;
  fps: number;
  processingTime: number;
  lastFrameTime: number;
}

export interface MLModelState {
  isLoaded: boolean;
  isProcessing: boolean;
  modelType: 'efficientnet' | 'mobilenet' | 'birdnet';
  gpuAcceleration: boolean;
  nnapiEnabled: boolean;
  memoryUsage: number;
}

export interface PerformanceMetrics {
  frameRate: number;
  memoryUsage: number;
  batteryLevel: number;
  processingFPS: number;
  averageInferenceTime: number;
}

export interface AppSettings {
  enableGPUAcceleration: boolean;
  enableNNAPI: boolean;
  maxFPS: number;
  audioRecordingEnabled: boolean;
  locationEnabled: boolean;
  language: string;
  theme: 'light' | 'dark' | 'auto';
}

interface DetectionStore {
  // Detection data
  detections: Detection[];
  currentDetection: Detection | null;
  
  // Camera state
  camera: CameraState;
  
  // ML Model state
  mlModel: MLModelState;
  
  // Performance metrics
  performance: PerformanceMetrics;
  
  // App settings
  settings: AppSettings;
  
  // Actions
  addDetection: (detection: Omit<Detection, 'id' | 'timestamp'>) => void;
  updateDetection: (id: string, updates: Partial<Detection>) => void;
  removeDetection: (id: string) => void;
  clearDetections: () => void;
  setCurrentDetection: (detection: Detection | null) => void;
  
  // Camera actions
  setCameraActive: (isActive: boolean) => void;
  setCameraReady: (isReady: boolean) => void;
  updateCameraMetrics: (metrics: Partial<CameraState>) => void;
  
  // ML Model actions
  setMLModelLoaded: (isLoaded: boolean) => void;
  setMLModelProcessing: (isProcessing: boolean) => void;
  updateMLModelState: (state: Partial<MLModelState>) => void;
  
  // Performance actions
  updatePerformanceMetrics: (metrics: Partial<PerformanceMetrics>) => void;
  
  // Settings actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  
  // Utility actions
  reset: () => void;
}

const initialCameraState: CameraState = {
  isActive: false,
  isReady: false,
  fps: 30,
  processingTime: 0,
  lastFrameTime: 0,
};

const initialMLModelState: MLModelState = {
  isLoaded: false,
  isProcessing: false,
  modelType: 'efficientnet',
  gpuAcceleration: false,
  nnapiEnabled: false,
  memoryUsage: 0,
};

const initialPerformanceMetrics: PerformanceMetrics = {
  frameRate: 0,
  memoryUsage: 0,
  batteryLevel: 100,
  processingFPS: 0,
  averageInferenceTime: 0,
};

const initialAppSettings: AppSettings = {
  enableGPUAcceleration: true,
  enableNNAPI: true,
  maxFPS: 60,
  audioRecordingEnabled: true,
  locationEnabled: true,
  language: 'en',
  theme: 'auto',
};

export const useDetectionStore = create<DetectionStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    detections: [],
    currentDetection: null,
    camera: initialCameraState,
    mlModel: initialMLModelState,
    performance: initialPerformanceMetrics,
    settings: initialAppSettings,
    
    // Detection actions
    addDetection: (detection) => {
      const newDetection: Detection = {
        ...detection,
        id: `detection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };
      
      set((state) => ({
        detections: [newDetection, ...state.detections].slice(0, 1000), // Keep max 1000 detections
        currentDetection: newDetection,
      }));
    },
    
    updateDetection: (id, updates) => {
      set((state) => ({
        detections: state.detections.map(detection =>
          detection.id === id ? { ...detection, ...updates } : detection
        ),
      }));
    },
    
    removeDetection: (id) => {
      set((state) => ({
        detections: state.detections.filter(detection => detection.id !== id),
        currentDetection: state.currentDetection?.id === id ? null : state.currentDetection,
      }));
    },
    
    clearDetections: () => {
      set({ detections: [], currentDetection: null });
    },
    
    setCurrentDetection: (detection) => {
      set({ currentDetection: detection });
    },
    
    // Camera actions
    setCameraActive: (isActive) => {
      set((state) => ({
        camera: { ...state.camera, isActive },
      }));
    },
    
    setCameraReady: (isReady) => {
      set((state) => ({
        camera: { ...state.camera, isReady },
      }));
    },
    
    updateCameraMetrics: (metrics) => {
      set((state) => ({
        camera: { ...state.camera, ...metrics },
      }));
    },
    
    // ML Model actions
    setMLModelLoaded: (isLoaded) => {
      set((state) => ({
        mlModel: { ...state.mlModel, isLoaded },
      }));
    },
    
    setMLModelProcessing: (isProcessing) => {
      set((state) => ({
        mlModel: { ...state.mlModel, isProcessing },
      }));
    },
    
    updateMLModelState: (updates) => {
      set((state) => ({
        mlModel: { ...state.mlModel, ...updates },
      }));
    },
    
    // Performance actions
    updatePerformanceMetrics: (metrics) => {
      set((state) => ({
        performance: { ...state.performance, ...metrics },
      }));
    },
    
    // Settings actions
    updateSettings: (updates) => {
      set((state) => ({
        settings: { ...state.settings, ...updates },
      }));
    },
    
    // Utility actions

    reset: () => {
      set({
        detections: [],
        currentDetection: null,
        camera: initialCameraState,
        mlModel: initialMLModelState,
        performance: initialPerformanceMetrics,
        settings: initialAppSettings,
      });
    },
  }))
);

// Selectors for optimized subscriptions
export const selectDetections = (state: DetectionStore) => state.detections;
export const selectCurrentDetection = (state: DetectionStore) => state.currentDetection;
export const selectCameraState = (state: DetectionStore) => state.camera;
export const selectMLModelState = (state: DetectionStore) => state.mlModel;
export const selectPerformanceMetrics = (state: DetectionStore) => state.performance;
export const selectAppSettings = (state: DetectionStore) => state.settings;

// Computed selectors
export const selectIsSystemReady = (state: DetectionStore) => 
  state.camera.isReady && state.mlModel.isLoaded;

export const selectRecentDetections = (state: DetectionStore) => 
  state.detections.slice(0, 10);

export const selectDetectionsByType = (type: Detection['type']) => (state: DetectionStore) =>
  state.detections.filter(detection => detection.type === type);

export const selectPerformanceStatus = (state: DetectionStore) => {
  const { frameRate, memoryUsage, processingFPS } = state.performance;
  const { maxFPS } = state.settings;
  
  const performanceScore = (frameRate / maxFPS) * 0.4 + 
                          ((100 - memoryUsage) / 100) * 0.3 + 
                          (processingFPS / maxFPS) * 0.3;
  
  return {
    score: performanceScore,
    status: performanceScore > 0.8 ? 'excellent' : 
            performanceScore > 0.6 ? 'good' : 
            performanceScore > 0.4 ? 'fair' : 'poor'
  };
};

export default useDetectionStore;