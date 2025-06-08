/**
 * detectionStore.ts - Zustand state management for real-time detection data
 * 
 * Optimized for Android performance with minimal re-renders
 * Handles camera state, ML model state, and detection results
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface BirdDetection {
  id: string;
  timestamp: number;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  species: {
    common_name: string;
    scientific_name: string;
  };
  imageUri?: string;
  audioUri?: string;
}

export interface CameraState {
  isActive: boolean;
  isRecording: boolean;
  device: any; // Camera device
  flash: 'off' | 'on' | 'auto';
  zoom: number;
  focusPoint: { x: number; y: number } | null;
}

export interface MLModelState {
  isLoaded: boolean;
  isProcessing: boolean;
  modelVersion: string;
  lastProcessedFrame: number;
  processingFps: number;
}

interface DetectionStore {
  // Camera state
  camera: CameraState;
  setCameraActive: (active: boolean) => void;
  setCameraDevice: (device: any) => void;
  setCameraFlash: (flash: 'off' | 'on' | 'auto') => void;
  setCameraZoom: (zoom: number) => void;
  setCameraFocus: (point: { x: number; y: number } | null) => void;
  setRecording: (recording: boolean) => void;

  // ML Model state
  model: MLModelState;
  setModelLoaded: (loaded: boolean) => void;
  setModelProcessing: (processing: boolean) => void;
  updateProcessingFps: (fps: number) => void;

  // Detection results
  currentDetections: BirdDetection[];
  detectionHistory: BirdDetection[];
  addDetection: (detection: BirdDetection) => void;
  clearCurrentDetections: () => void;
  clearHistory: () => void;

  // Performance tracking
  performance: {
    frameRate: number;
    memoryUsage: number;
    batteryLevel: number;
  };
  updatePerformance: (metrics: Partial<typeof this.performance>) => void;

  // Settings
  settings: {
    confidenceThreshold: number;
    maxDetectionsPerFrame: number;
    enableGPUAcceleration: boolean;
    enableFrameThrottling: boolean;
    frameThrottleRate: number;
  };
  updateSettings: (settings: Partial<typeof this.settings>) => void;
}

export const useDetectionStore = create<DetectionStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial camera state
    camera: {
      isActive: false,
      isRecording: false,
      device: null,
      flash: 'off',
      zoom: 1,
      focusPoint: null,
    },

    // Camera actions
    setCameraActive: (active) =>
      set((state) => ({
        camera: { ...state.camera, isActive: active },
      })),

    setCameraDevice: (device) =>
      set((state) => ({
        camera: { ...state.camera, device },
      })),

    setCameraFlash: (flash) =>
      set((state) => ({
        camera: { ...state.camera, flash },
      })),

    setCameraZoom: (zoom) =>
      set((state) => ({
        camera: { ...state.camera, zoom: Math.max(1, Math.min(10, zoom)) },
      })),

    setCameraFocus: (focusPoint) =>
      set((state) => ({
        camera: { ...state.camera, focusPoint },
      })),

    setRecording: (isRecording) =>
      set((state) => ({
        camera: { ...state.camera, isRecording },
      })),

    // Initial ML model state
    model: {
      isLoaded: false,
      isProcessing: false,
      modelVersion: '1.0.0',
      lastProcessedFrame: 0,
      processingFps: 0,
    },

    // ML Model actions
    setModelLoaded: (isLoaded) =>
      set((state) => ({
        model: { ...state.model, isLoaded },
      })),

    setModelProcessing: (isProcessing) =>
      set((state) => ({
        model: { ...state.model, isProcessing },
      })),

    updateProcessingFps: (processingFps) =>
      set((state) => ({
        model: { ...state.model, processingFps },
      })),

    // Detection state
    currentDetections: [],
    detectionHistory: [],

    // Detection actions
    addDetection: (detection) =>
      set((state) => {
        const newHistory = [detection, ...state.detectionHistory].slice(0, 1000); // Keep last 1000
        return {
          currentDetections: [detection, ...state.currentDetections].slice(0, state.settings.maxDetectionsPerFrame),
          detectionHistory: newHistory,
        };
      }),

    clearCurrentDetections: () =>
      set({ currentDetections: [] }),

    clearHistory: () =>
      set({ detectionHistory: [] }),

    // Performance tracking
    performance: {
      frameRate: 0,
      memoryUsage: 0,
      batteryLevel: 100,
    },

    updatePerformance: (metrics) =>
      set((state) => ({
        performance: { ...state.performance, ...metrics },
      })),

    // Settings
    settings: {
      confidenceThreshold: 0.7,
      maxDetectionsPerFrame: 5,
      enableGPUAcceleration: true,
      enableFrameThrottling: true,
      frameThrottleRate: 30, // FPS
    },

    updateSettings: (newSettings) =>
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
      })),
  }))
);

// Selectors for optimized component subscriptions
export const useCameraState = () => useDetectionStore((state) => state.camera);
export const useModelState = () => useDetectionStore((state) => state.model);
export const useCurrentDetections = () => useDetectionStore((state) => state.currentDetections);
export const useDetectionHistory = () => useDetectionStore((state) => state.detectionHistory);
export const usePerformanceMetrics = () => useDetectionStore((state) => state.performance);
export const useDetectionSettings = () => useDetectionStore((state) => state.settings);