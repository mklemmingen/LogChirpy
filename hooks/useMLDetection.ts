import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { fastTfliteBirdClassifier } from '@/services/fastTfliteBirdClassifier';
// Note: MLKit service integration will be added when the service is available

interface MLDetectionResult {
  label: string;
  confidence: number;
  timestamp: number;
}

interface MLDetectionConfig {
  enableGPU: boolean;
  confidenceThreshold: number;
  maxResults: number;
  enableFastTFLite: boolean;
  enableMLKit: boolean;
}

interface UseMLDetectionReturn {
  isDetecting: boolean;
  results: MLDetectionResult[];
  startDetection: () => Promise<void>;
  stopDetection: () => void;
  processImage: (imagePath: string) => Promise<MLDetectionResult[]>;
  clearResults: () => void;
  config: MLDetectionConfig;
  updateConfig: (config: Partial<MLDetectionConfig>) => void;
  performance: {
    avgProcessingTime: number;
    totalDetections: number;
    gpuAccelerated: boolean;
  };
}

/**
 * Unified ML Detection Hook for Android with GPU Acceleration
 * Orchestrates FastTFLite and MLKit services with Fragment lifecycle management
 */
export function useMLDetection(): UseMLDetectionReturn {
  const [isDetecting, setIsDetecting] = useState(false);
  const [results, setResults] = useState<MLDetectionResult[]>([]);
  const [config, setConfig] = useState<MLDetectionConfig>({
    enableGPU: Platform.OS === 'android',
    confidenceThreshold: 0.3,
    maxResults: 5,
    enableFastTFLite: true,
    enableMLKit: true,
  });

  // Performance tracking
  const [performance, setPerformance] = useState({
    avgProcessingTime: 0,
    totalDetections: 0,
    gpuAccelerated: false,
  });

  // Detection state management
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processingTimesRef = useRef<number[]>([]);
  const isProcessingRef = useRef(false);

  // Cleanup on unmount (Fragment lifecycle compatibility)
  useEffect(() => {
    return () => {
      stopDetection();
      clearResults();
    };
  }, []);

  // GPU availability check
  useEffect(() => {
    if (Platform.OS === 'android' && config.enableGPU) {
      checkGPUAvailability();
    }
  }, [config.enableGPU]);

  const checkGPUAvailability = useCallback(async () => {
    try {
      // Check actual GPU availability
      const gpuAvailable = await fastTfliteBirdClassifier.isGPUAvailable();
      setPerformance(prev => ({
        ...prev,
        gpuAccelerated: gpuAvailable,
      }));
    } catch (error) {
      console.warn('[useMLDetection] GPU availability check failed:', error);
      setPerformance(prev => ({
        ...prev,
        gpuAccelerated: false,
      }));
    }
  }, []);

  const processImage = useCallback(async (imagePath: string): Promise<MLDetectionResult[]> => {
    if (isProcessingRef.current) {
      return [];
    }

    isProcessingRef.current = true;
    const startTime = Date.now();

    try {
      const detectionPromises: Promise<MLDetectionResult[]>[] = [];

      // FastTFLite detection with GPU acceleration
      if (config.enableFastTFLite) {
        const fastTFLitePromise = (async () => {
          try {
            // For image classification, we use the classifyImage method
            // Note: BirdNet model is designed for audio, so this is a placeholder
            const results = await fastTfliteBirdClassifier.classifyImage(imagePath, {
              enableGPU: config.enableGPU,
              confidenceThreshold: config.confidenceThreshold,
              maxResults: config.maxResults,
            });
            
            // Convert BirdClassificationResult to MLDetectionResult
            return results.map(result => ({
              label: result.species,
              confidence: result.confidence,
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error('FastTFLite detection error:', error);
            // Return empty array on error to allow other detectors to continue
            return [];
          }
        })();
        
        detectionPromises.push(fastTFLitePromise);
      }

      // MLKit detection as fallback/comparison
      if (config.enableMLKit) {
        // Import mlkitBirdClassifier when available
        const mlkitPromise = (async () => {
          try {
            // TODO: Replace with actual MLKit service call when available
            // const { mlkitBirdClassifier } = await import('@/services/mlkitBirdClassifier');
            // const results = await mlkitBirdClassifier.classifyImage(imagePath, options);
            
            // For now, return mock data
            return [
              { label: 'MLKit: Cardinal', confidence: 0.78, timestamp: Date.now() },
            ];
          } catch (error) {
            console.error('MLKit detection error:', error);
            return [];
          }
        })();
        
        detectionPromises.push(mlkitPromise);
      }

      // Wait for all detections and merge results
      const allResults = await Promise.all(detectionPromises);
      const mergedResults = allResults.flat();

      // Remove duplicates and sort by confidence
      const uniqueResults = mergedResults
        .filter((result, index, self) => 
          index === self.findIndex(r => r.label === result.label)
        )
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, config.maxResults);

      // Update performance metrics
      const processingTime = Date.now() - startTime;
      processingTimesRef.current.push(processingTime);
      
      if (processingTimesRef.current.length > 10) {
        processingTimesRef.current.shift();
      }

      const avgTime = processingTimesRef.current.reduce((a, b) => a + b, 0) / processingTimesRef.current.length;
      
      setPerformance(prev => ({
        ...prev,
        avgProcessingTime: avgTime,
        totalDetections: prev.totalDetections + 1,
      }));

      return uniqueResults;

    } catch (error) {
      console.error('[useMLDetection] Image processing failed:', error);
      return [];
    } finally {
      isProcessingRef.current = false;
    }
  }, [config]);

  const startDetection = useCallback(async () => {
    if (isDetecting) {
      return;
    }

    try {
      // Check camera permissions
      const cameraPermission = await Camera.getCameraPermissionStatus();
      if (cameraPermission !== 'granted') {
        throw new Error('Camera permission not granted');
      }

      setIsDetecting(true);
      console.log('[useMLDetection] Starting continuous detection');

      // Start detection interval (Fragment-safe)
      detectionIntervalRef.current = setInterval(async () => {
        try {
          // This would typically process frames from camera
          // For now, we just maintain the detection state
          console.log('[useMLDetection] Detection cycle active');
        } catch (error) {
          console.error('[useMLDetection] Detection cycle error:', error);
        }
      }, 1000) as any;

    } catch (error) {
      console.error('[useMLDetection] Failed to start detection:', error);
      setIsDetecting(false);
    }
  }, [isDetecting]);

  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    setIsDetecting(false);
    isProcessingRef.current = false;
    console.log('[useMLDetection] Detection stopped');
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    processingTimesRef.current = [];
    setPerformance(prev => ({
      ...prev,
      avgProcessingTime: 0,
      totalDetections: 0,
    }));
  }, []);

  const updateConfig = useCallback((newConfig: Partial<MLDetectionConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...newConfig,
    }));
  }, []);

  return {
    isDetecting,
    results,
    startDetection,
    stopDetection,
    processImage,
    clearResults,
    config,
    updateConfig,
    performance,
  };
}