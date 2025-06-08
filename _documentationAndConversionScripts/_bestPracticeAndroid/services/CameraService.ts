/**
 * CameraService.ts - Vision Camera v4 optimized service
 * 
 * Implements Android-specific camera patterns with frame processors
 * Handles memory management and performance optimization
 */

import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useFrameProcessor } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import { useDetectionStore } from '../store/detectionStore';
import { MLModelManager } from './MLModelManager';

export class CameraService {
  private static instance: CameraService;
  private camera: Camera | null = null;
  private isProcessing = false;
  private frameCount = 0;
  private lastFpsUpdate = Date.now();

  static getInstance(): CameraService {
    if (!CameraService.instance) {
      CameraService.instance = new CameraService();
    }
    return CameraService.instance;
  }

  // Android-optimized frame processor
  createFrameProcessor() {
    const { settings, addDetection, updatePerformance } = useDetectionStore.getState();
    
    return useFrameProcessor((frame) => {
      'worklet';
      
      // Frame throttling for Android performance
      if (settings.enableFrameThrottling) {
        this.frameCount++;
        const now = Date.now();
        const elapsed = now - this.lastFpsUpdate;
        
        if (elapsed >= 1000) {
          const fps = (this.frameCount * 1000) / elapsed;
          runOnJS(updatePerformance)({ frameRate: fps });
          this.frameCount = 0;
          this.lastFpsUpdate = now;
          
          // Skip frames if exceeding target rate
          if (fps > settings.frameThrottleRate) {
            return;
          }
        }
      }

      // Prevent concurrent processing
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        // Process frame with ML model
        const detections = MLModelManager.processFrame(frame);
        
        if (detections && detections.length > 0) {
          // Filter by confidence threshold
          const validDetections = detections.filter(
            detection => detection.confidence >= settings.confidenceThreshold
          );
          
          if (validDetections.length > 0) {
            runOnJS(addDetection)(validDetections[0]); // Add best detection
          }
        }
      } catch (error) {
        console.error('Frame processing error:', error);
      } finally {
        this.isProcessing = false;
      }
    }, [settings.confidenceThreshold, settings.frameThrottleRate]);
  }

  // Android-optimized camera configuration
  getCameraConfig() {
    return {
      // Android-specific optimizations
      androidPreviewViewType: 'texture-view' as const, // Better performance than surface-view
      pixelFormat: 'yuv' as const, // Optimal for ML processing
      
      // Format selection for Android
      format: {
        photoAspectRatio: 16/9,
        photoResolution: 'max',
        videoAspectRatio: 16/9,
        videoResolution: 'hd-1280x720', // Balance between quality and performance
        maxFps: 30, // Conservative for Android battery life
      },
      
      // Performance settings
      enableBufferCompression: true,
      enableDepthData: false, // Disable for better performance
      enablePortraitEffectsMatteDelivery: false,
      
      // Android memory management
      enableHighQualityPhotos: false, // Use for better performance
      enableZoomGesture: true,
      enableFpsGraph: __DEV__, // Only in development
    };
  }

  // Camera lifecycle management
  async startCamera() {
    const { setCameraActive, setModelLoaded } = useDetectionStore.getState();
    
    try {
      // Load ML model first
      await MLModelManager.loadModel();
      setModelLoaded(true);
      
      // Activate camera
      setCameraActive(true);
      
      return true;
    } catch (error) {
      console.error('Failed to start camera:', error);
      return false;
    }
  }

  async stopCamera() {
    const { setCameraActive, setModelLoaded, clearCurrentDetections } = useDetectionStore.getState();
    
    try {
      // Clean up resources
      setCameraActive(false);
      clearCurrentDetections();
      
      // Unload model to free memory
      await MLModelManager.unloadModel();
      setModelLoaded(false);
      
      return true;
    } catch (error) {
      console.error('Failed to stop camera:', error);
      return false;
    }
  }

  // Memory cleanup for Android
  cleanup() {
    this.isProcessing = false;
    this.frameCount = 0;
    this.camera = null;
  }
}

// Hook for camera permissions
export function useCameraService() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraService = CameraService.getInstance();

  const startCamera = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return false;
    }
    
    return cameraService.startCamera();
  };

  const stopCamera = () => cameraService.stopCamera();

  return {
    hasPermission,
    device,
    startCamera,
    stopCamera,
    frameProcessor: cameraService.createFrameProcessor(),
    cameraConfig: cameraService.getCameraConfig(),
  };
}