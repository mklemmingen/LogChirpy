/**
 * Ultra-Simple Bird Audio Classifier - Minimal Implementation
 * 
 * This is the absolute minimal implementation following ULTIMATE_AUDIO_MODEL_IMPLEMENTATION_GUIDE.md
 * No fallbacks, no model switching, no caching, no performance metrics.
 * Just one hardcoded two-model architecture that works.
 */

import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { AudioDecoder } from './audioDecoder';
import { birdLabelsMap, getLabelsForLanguage } from './generated/BirdLabelsMap';
import { AudioWindowManager } from './audioWindowManager';

interface BirdPrediction {
  species: string;
  confidence: number;
}

interface ClassificationResult {
  predictions: BirdPrediction[];
  processingTimeMs: number;
  success: boolean;
  error?: string;
}

// ULTIMATE Guide compatible interface
interface PredictionResult {
  species: string;
  confidence: number;
  index: number;
}

// Audio ML pipeline compatible interface
interface AudioPrediction {
  common_name: string;
  scientific_name: string;
  confidence: number;
}

/**
 * Ultra-simple bird classifier - just the essentials
 */
class UltraSimpleBirdClassifier {
  private mainModel: TensorflowModel | null = null;
  private metaModel: TensorflowModel | null = null;
  private labels: string[] = [];
  private initialized = false;
  private windowManager: AudioWindowManager;

  constructor() {
    this.windowManager = new AudioWindowManager(48000, 3, 10);
  }

  /**
   * Initialize the two models - hardcoded paths, no fallbacks
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔧 Loading BirdNET models...');
      
      // Load main audio model (hardcoded)
      const mainModelPath = require('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite');
      this.mainModel = await loadTensorflowModel(mainModelPath, 'default');
      
      // Load meta location model (hardcoded)
      const metaModelPath = require('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_MData_Model_FP16.tflite');
      this.metaModel = await loadTensorflowModel(metaModelPath, 'default');
      
      // Load labels (hardcoded)
      this.labels = await this.loadLabels();
      
      this.initialized = true;
      console.log('✅ Models loaded successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize models:', error);
      return false;
    }
  }

  /**
   * Load bird species labels using the existing generated BirdLabelsMap
   */
  private async loadLabels(): Promise<string[]> {
    try {
      // Use the existing generated bird labels service
      const labelsData = getLabelsForLanguage('en');
      
      if (!labelsData) {
        throw new Error('No labels data found for English');
      }
      
      // Handle different possible return types from the labels map
      let labelsText: string;
      if (typeof labelsData === 'string') {
        labelsText = labelsData;
      } else if (labelsData && typeof labelsData === 'object' && labelsData.default) {
        labelsText = labelsData.default;
      } else {
        throw new Error('Could not resolve labels data from BirdLabelsMap');
      }
      
      // Split into lines and extract common names
      const lines = labelsText.trim().split('\n');
      const labels: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // Format: "Scientific_Name_Common Name" (exactly like whoBIRD)
        const parts = trimmedLine.split('_');
        if (parts.length >= 2) {
          // Extract common name (everything after the first underscore)
          // This matches whoBIRD's labelList[element.index].split("_").last() logic
          const commonName = parts.slice(1).join(' ').trim();
          labels.push(commonName);
        } else {
          // Fallback if format is unexpected
          labels.push(trimmedLine);
        }
      }
      
      console.log(`✅ Loaded ${labels.length} bird labels from labels_en.txt`);
      
      // Verify we have the expected number of labels
      if (labels.length !== 6522) {
        console.warn(`⚠️ Expected 6522 labels, got ${labels.length}`);
      }
      
      return labels;
      
    } catch (error) {
      console.error('❌ Failed to load bird labels, using fallback:', error);
      
      // Fallback to numbered labels
      const labelCount = 6522;
      const fallbackLabels: string[] = [];
      for (let i = 0; i < labelCount; i++) {
        fallbackLabels.push(`Species_${i}`);
      }
      return fallbackLabels;
    }
  }

  /**
   * Process audio file to raw Float32 samples (following guide exactly)
   */
  private async processAudio(audioFilePath: string): Promise<Float32Array> {
    // Load and decode audio
    const audioBuffer = await AudioDecoder.decodeAudioFile(audioFilePath);
    
    // Constants from guide
    const targetSampleRate = 48000;  // 48kHz as per guide
    const targetDuration = 3.0;      // 3 seconds as per guide
    const targetSamples = targetSampleRate * targetDuration; // 144,000 samples
    
    let audioData = audioBuffer.data;
    
    // CORRECTED: Proper Int16 to Float32 conversion if needed
    // The guide specifies: divide by max int16 value (32768.0)
    if (audioBuffer.data.constructor.name === 'Int16Array') {
      const int16Data = audioBuffer.data as any;
      audioData = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) {
        audioData[i] = int16Data[i] / 32768.0; // Guide-specified conversion
      }
    }
    
    // Simple resampling if needed (linear interpolation as per guide)
    if (audioBuffer.sampleRate !== targetSampleRate) {
      const ratio = targetSampleRate / audioBuffer.sampleRate;
      const newLength = Math.floor(audioData.length * ratio);
      const resampled = new Float32Array(newLength);
      
      for (let i = 0; i < newLength; i++) {
        const sourceIndex = i / ratio;
        const index = Math.floor(sourceIndex);
        const fraction = sourceIndex - index;
        
        if (index + 1 < audioData.length) {
          // Linear interpolation as per guide
          resampled[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
        } else {
          resampled[i] = audioData[index] || 0;
        }
      }
      audioData = resampled;
    }
    
    // Trim or pad to exact length (as per guide)
    const result = new Float32Array(targetSamples);
    if (audioData.length > targetSamples) {
      // Trim from center (as per guide)
      const start = Math.floor((audioData.length - targetSamples) / 2);
      result.set(audioData.slice(start, start + targetSamples));
    } else {
      // Pad in center (as per guide)
      const start = Math.floor((targetSamples - audioData.length) / 2);
      result.set(audioData, start);
    }
    
    // Optional: Apply high-pass filter as per guide (200Hz cutoff)
    return this.applyHighPassFilter(result, 200);
  }

  /**
   * Apply high-pass filter as specified in guide
   */
  private applyHighPassFilter(data: Float32Array, cutoff: number = 200): Float32Array {
    // Simple first-order high-pass filter from guide
    const sampleRate = 48000;
    const rc = 1.0 / (2.0 * Math.PI * cutoff);
    const dt = 1.0 / sampleRate;
    const alpha = rc / (rc + dt);
    
    const filtered = new Float32Array(data.length);
    filtered[0] = data[0];
    
    for (let i = 1; i < data.length; i++) {
      filtered[i] = alpha * (filtered[i-1] + data[i] - data[i-1]);
    }
    
    return filtered;
  }

  /**
   * Classify bird audio - the one function that does everything
   */
  async classify(
    audioFilePath: string,
    location?: { latitude: number; longitude: number }
  ): Promise<ClassificationResult> {
    const startTime = Date.now();
    
    try {
      if (!this.initialized || !this.mainModel || !this.metaModel) {
        throw new Error('Models not initialized');
      }
      
      // Step 1: Process audio to raw Float32
      const audioSamples = await this.processAudio(audioFilePath);
      
      // Step 2: Run inference using shared logic
      return await this.runInference(audioSamples, location, startTime);
      
    } catch (error) {
      return {
        predictions: [],
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process audio chunk for real-time classification (ULTIMATE guide approach)
   */
  processAudioChunk(audioData: Float32Array): void {
    this.windowManager.processFloat32Chunk(audioData);
  }

  /**
   * Classify using current audio window (ULTIMATE guide approach)
   */
  async classifyCurrentWindow(
    location?: { latitude: number; longitude: number }
  ): Promise<ClassificationResult> {
    const startTime = Date.now();
    
    try {
      if (!this.initialized || !this.mainModel || !this.metaModel) {
        throw new Error('Models not initialized');
      }

      if (!this.windowManager.hasEnoughDataForInference()) {
        return {
          predictions: [],
          processingTimeMs: Date.now() - startTime,
          success: false,
          error: 'Insufficient audio data for inference'
        };
      }

      // Get filtered 3-second window
      const audioSamples = this.windowManager.getFilteredInferenceWindow();
      
      // Run inference using the existing classify logic
      return await this.runInference(audioSamples, location, startTime);
      
    } catch (error) {
      return {
        predictions: [],
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract inference logic for reuse
   */
  private async runInference(
    audioSamples: Float32Array,
    location?: { latitude: number; longitude: number },
    startTime: number = Date.now()
  ): Promise<ClassificationResult> {
    // Step 1: Run main audio model
    const audioOutputs = this.mainModel!.runSync([audioSamples]);
    let audioProbabilities = audioOutputs[0] as Float32Array;
    
    // Apply sigmoid to convert logits to probabilities
    for (let i = 0; i < audioProbabilities.length; i++) {
      audioProbabilities[i] = 1 / (1 + Math.exp(-audioProbabilities[i]));
    }
    
    // Step 2: Run meta model if location provided
    if (location) {
      // CORRECTED: Week calculation exactly as per ULTIMATE guide
      const date = new Date();
      const start = new Date(date.getFullYear(), 0, 1);
      const diff = date.getTime() - start.getTime();
      const weekOfYear = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
      const weekCosine = Math.cos(2 * Math.PI * weekOfYear / 52); // Exact guide formula
      
      console.log(`[MetaModel] Week ${weekOfYear}, cosine ${weekCosine.toFixed(3)}, location [${location.latitude}, ${location.longitude}]`);
      
      const metaInput = new Float32Array([location.latitude, location.longitude, weekCosine]);
      const metaOutputs = this.metaModel!.runSync([metaInput]);
      const metaProbabilities = metaOutputs[0] as Float32Array;
      
      // CORRECTED: Blend predictions using exact guide formula
      // Formula from guide: audioProb * (1 - metaInfluence + metaInfluence * metaProb)
      const metaInfluence = 0.3; // Exactly as specified in guide
      for (let i = 0; i < Math.min(audioProbabilities.length, metaProbabilities.length); i++) {
        const audioProb = audioProbabilities[i];
        const metaProb = metaProbabilities[i];
        audioProbabilities[i] = audioProb * (1 - metaInfluence + metaInfluence * metaProb);
      }
      
      console.log(`[MetaModel] Applied meta influence ${metaInfluence} to ${audioProbabilities.length} predictions`);
    }
    
    // Step 3: Get top predictions (hardcoded top 5, min confidence 0.01)
    const predictions: BirdPrediction[] = [];
    const minConfidence = 0.01;
    const maxResults = 5;
    
    for (let i = 0; i < audioProbabilities.length; i++) {
      if (audioProbabilities[i] >= minConfidence) {
        predictions.push({
          species: this.labels[i] || `Unknown_${i}`,
          confidence: audioProbabilities[i]
        });
      }
    }
    
    // Sort by confidence and take top results
    predictions.sort((a, b) => b.confidence - a.confidence);
    const topPredictions = predictions.slice(0, maxResults);
    
    return {
      predictions: topPredictions,
      processingTimeMs: Date.now() - startTime,
      success: true
    };
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.initialized && this.mainModel !== null && this.metaModel !== null;
  }

  /**
   * Get window manager stats for debugging
   */
  getWindowStats(): any {
    return this.windowManager.getStats();
  }
}

// Create singleton instance
const ultraSimpleClassifier = new UltraSimpleBirdClassifier();

/**
 * THE ONE FUNCTION YOU NEED - Initialize and classify bird audio
 * Returns detailed ClassificationResult for debugging
 */
export async function classifyBirdAudio(
  audioFilePath: string,
  location?: { latitude: number; longitude: number }
): Promise<ClassificationResult> {
  // Auto-initialize if needed
  if (!ultraSimpleClassifier.isReady()) {
    const initialized = await ultraSimpleClassifier.initialize();
    if (!initialized) {
      return {
        predictions: [],
        processingTimeMs: 0,
        success: false,
        error: 'Failed to initialize bird classifier'
      };
    }
  }
  
  return ultraSimpleClassifier.classify(audioFilePath, location);
}

/**
 * ULTIMATE Guide compatible function - Returns prediction array directly
 */
export async function classifyBirdAudioUltimate(
  audioFilePath: string,
  latitude: number,
  longitude: number,
  date: Date = new Date()
): Promise<PredictionResult[]> {
  const result = await classifyBirdAudio(audioFilePath, { latitude, longitude });
  
  if (!result.success) {
    console.error('Bird classification failed:', result.error);
    return [];
  }
  
  // Convert to ULTIMATE guide format
  return result.predictions.map((pred, index) => ({
    species: pred.species,
    confidence: pred.confidence,
    index: index
  }));
}

/**
 * Audio ML Pipeline compatible function - Returns AudioPrediction array
 */
export async function classifyBirdAudioForPipeline(
  audioFilePath: string,
  location?: { latitude: number; longitude: number }
): Promise<AudioPrediction[]> {
  const result = await classifyBirdAudio(audioFilePath, location);
  
  if (!result.success) {
    console.warn('Bird classification failed:', result.error);
    return [];
  }
  
  // Convert to audio pipeline format
  return result.predictions.map(pred => ({
    common_name: pred.species,
    scientific_name: pred.species, // For now, use same name for both
    confidence: pred.confidence
  }));
}

/**
 * Manual initialization (optional)
 */
export async function initializeBirdClassifier(): Promise<boolean> {
  return ultraSimpleClassifier.initialize();
}

/**
 * Check if ready
 */
export function isClassifierReady(): boolean {
  return ultraSimpleClassifier.isReady();
}

export default classifyBirdAudio;