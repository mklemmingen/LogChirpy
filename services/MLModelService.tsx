import React from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface Detection {
  class: string;
  confidence: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface MLState {
  model: any | null;
  detections: Detection[];
  isProcessing: boolean;
  isModelLoaded: boolean;
  error: string | null;
  
  loadMLModel: () => Promise<void>;
  processFrame: (frame: any) => Promise<void>;
  cleanup: () => void;
}

export const useMLStore = create<MLState>()(
  subscribeWithSelector((set, get) => ({
    model: null,
    detections: [],
    isProcessing: false,
    isModelLoaded: false,
    error: null,

    loadMLModel: async () => {
      try {
        console.log('Loading mock TensorFlow Lite model...');
        
        const mockModel = {
          id: 'bird_detection_android_v4',
          version: '2025.1',
          format: 'tflite',
          enableGPU: true,
          numThreads: 4,
          enableXNNPack: true,
          useNNAPI: true,
          maxBatchSize: 1
        };
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        set({ model: mockModel, isModelLoaded: true, error: null });
        console.log('Mock TensorFlow Lite model loaded successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        set({ error: errorMessage, isModelLoaded: false });
        console.error('Failed to load ML model:', errorMessage);
      }
    },

    processFrame: async (frame: any) => {
      const { model, isProcessing } = get();
      
      if (!model || isProcessing) return;
      
      try {
        set({ isProcessing: true });
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const mockDetections: Detection[] = Math.random() > 0.7 ? [
          {
            class: 'Northern Cardinal',
            confidence: 0.89,
            bounds: {
              x: Math.random() * 0.3,
              y: Math.random() * 0.3,
              width: 0.2 + Math.random() * 0.2,
              height: 0.2 + Math.random() * 0.2,
            }
          }
        ] : [];
        
        set({ detections: mockDetections, isProcessing: false });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Processing error';
        set({ error: errorMessage, isProcessing: false });
      }
    },

    cleanup: () => {
      const { model } = get();
      if (model) {
        console.log('Cleaning up ML model resources');
      }
      set({ 
        model: null, 
        detections: [], 
        isProcessing: false,
        isModelLoaded: false 
      });
    }
  }))
);

export function MLModelProvider({ children }: { children: React.ReactNode }) {
  const loadMLModel = useMLStore(state => state.loadMLModel);
  
  React.useEffect(() => {
    loadMLModel();
    
    return () => {
      useMLStore.getState().cleanup();
    };
  }, [loadMLModel]);
  
  return <>{children}</>;
}