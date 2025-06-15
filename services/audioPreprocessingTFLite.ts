/**
 * Audio Preprocessing Service for TensorFlow Lite BirdNET Model
 * 
 * CORRECTED IMPLEMENTATION: Processes audio to raw Float32 samples for BirdNET v2.4 TensorFlow Lite models.
 * Based on whoBIRD analysis - BirdNET models expect raw audio samples, NOT mel-spectrograms!
 * Mel-spectrograms are only used for visualization purposes.
 */

import { AudioDecoder } from './audioDecoder';

export interface AudioPreprocessingConfig {
  sampleRate: number;        // Target sample rate (48kHz for BirdNET)
  duration: number;         // Target duration in seconds (3 seconds for BirdNET)
  bitDepth: number;         // Audio bit depth (16-bit PCM)
  channels: number;         // Number of channels (1 for mono)
  highPassFilter: boolean;  // Optional high-pass filtering
  normalize: boolean;       // Whether to normalize audio to prevent clipping
}

export interface ProcessedAudioData {
  processedData: Float32Array;  // Raw Float32 audio samples for main model
  shape: number[]; // Audio sample shape [1, num_samples]
  metadata: {
    originalSampleRate: number;
    duration: number;
    processingTime: number;
    processingType: 'raw_audio' | 'metadata_features'; // Simplified to only raw audio or metadata
    modelInputShape: number[];
    sampleCount: number;
  };
}

export class AudioPreprocessingTFLite {
  // CORRECTED: whoBIRD-based configuration for raw audio processing
  private static config: AudioPreprocessingConfig = {
    sampleRate: 48000,      // BirdNET v2.4 uses 48kHz (industry standard)
    duration: 3.0,         // 3-second audio clips (144,000 samples at 48kHz)
    bitDepth: 16,          // 16-bit PCM
    channels: 1,           // Mono audio
    highPassFilter: false, // Optional Butterworth high-pass filter
    normalize: false,      // Avoid normalization for raw audio (preserve original signal)
  };

  // CORRECTED: Circular buffer for continuous recording (whoBIRD pattern)
  private static circularBuffer: Int16Array | null = null;
  private static writeIndex: number = 0;
  private static isRecording: boolean = false;

  /**
   * Process audio file for BirdNET TFLite model - CORRECTED: Raw audio approach
   * Based on whoBIRD analysis: BirdNET models expect raw Float32 audio samples
   */
  static async processAudioFile(audioUri: string, modelInputShape?: number[]): Promise<ProcessedAudioData> {
    const startTime = Date.now();
    
    try {
      console.log('Processing audio for TensorFlow Lite (raw audio approach)...');
      
      // Step 1: Load and decode audio file
      const audioData = await this.loadAudioFile(audioUri);
      
      // Step 2: Resample to target sample rate if needed (48kHz for BirdNET)
      const resampledData = await this.resampleAudio(audioData);
      
      // Step 3: Trim or pad to target duration (3 seconds)
      const trimmedData = this.trimOrPadAudio(resampledData);
      
      // Step 4: CORRECTED - Process based on model type
      const { processedData, shape, processingType } = await this.processForModelType(trimmedData, modelInputShape);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`Audio processing completed in ${processingTime}ms using ${processingType}`);
      console.log(`Output shape: [${shape.join(', ')}], samples: ${processedData.length}`);
      
      return {
        processedData,
        shape,
        metadata: {
          originalSampleRate: audioData.sampleRate,
          duration: trimmedData.length / this.config.sampleRate,
          processingTime,
          processingType,
          modelInputShape: modelInputShape || [1, 144000], // Default to 3 seconds at 48kHz
          sampleCount: processedData.length,
        },
      };
      
    } catch (error) {
      console.error('Audio preprocessing failed:', error);
      throw new Error(`Audio preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load audio file and extract raw audio data
   */
  private static async loadAudioFile(audioUri: string): Promise<{ data: Float32Array; sampleRate: number }> {
    try {
      console.log('Loading audio file with AudioDecoder...');
      
      // Use the new AudioDecoder for proper audio decoding
      const audioBuffer = await AudioDecoder.decodeAudioFile(audioUri);
      
      console.log(`Audio loaded: ${audioBuffer.data.length} samples at ${audioBuffer.sampleRate}Hz`);
      
      return {
        data: audioBuffer.data,
        sampleRate: audioBuffer.sampleRate,
      };
      
    } catch (error) {
      console.error('Failed to load audio file:', error);
      throw error;
    }
  }

  /**
   * Resample audio to target sample rate
   */
  private static async resampleAudio(audioData: { data: Float32Array; sampleRate: number }): Promise<Float32Array> {
    const { data, sampleRate } = audioData;
    
    if (sampleRate === this.config.sampleRate) {
      console.log('Audio already at target sample rate');
      return data;
    }
    
    console.log(`Resampling from ${sampleRate}Hz to ${this.config.sampleRate}Hz`);
    
    // Simple linear interpolation resampling
    const ratio = this.config.sampleRate / sampleRate;
    const outputLength = Math.floor(data.length * ratio);
    const resampledData = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i / ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;
      
      if (index + 1 < data.length) {
        // Linear interpolation
        resampledData[i] = data[index] * (1 - fraction) + data[index + 1] * fraction;
      } else {
        resampledData[i] = data[index] || 0;
      }
    }
    
    return resampledData;
  }

  /**
   * Trim or pad audio to target duration
   */
  private static trimOrPadAudio(audioData: Float32Array): Float32Array {
    const targetSamples = Math.floor(this.config.duration * this.config.sampleRate);
    
    if (audioData.length === targetSamples) {
      return audioData;
    }
    
    const result = new Float32Array(targetSamples);
    
    if (audioData.length > targetSamples) {
      // Trim audio (take from middle)
      const startIndex = Math.floor((audioData.length - targetSamples) / 2);
      result.set(audioData.slice(startIndex, startIndex + targetSamples));
      console.log(`Audio trimmed to ${this.config.duration}s`);
    } else {
      // Pad audio (center it)
      const startIndex = Math.floor((targetSamples - audioData.length) / 2);
      result.set(audioData, startIndex);
      console.log(`Audio padded to ${this.config.duration}s`);
    }
    
    return result;
  }

  /**
   * CORRECTED: Process audio data based on model type - Raw audio for main models, metadata for location models
   */
  private static async processForModelType(audioData: Float32Array, modelInputShape?: number[]): Promise<{
    processedData: Float32Array;
    shape: number[];
    processingType: 'raw_audio' | 'metadata_features';
  }> {
    if (!modelInputShape || modelInputShape.length === 0) {
      console.warn('No model input shape provided, using raw audio processing');
      return this.processRawAudio(audioData);
    }
    
    const totalElements = modelInputShape.reduce((acc, dim) => acc * (dim === -1 ? 1 : Math.abs(dim)), 1);
    
    console.log(`Processing audio for model shape: [${modelInputShape.join(', ')}], total elements: ${totalElements}`);
    
    // CORRECTED: Determine processing type based on whoBIRD patterns
    if (totalElements <= 10) {
      // Meta/location model (1-10 elements) - expects [latitude, longitude, week_of_year]
      console.log('Detected metadata model - generating location/temporal features');
      return this.generateMetadataFeatures(totalElements);
    } else {
      // Main audio model (10K+ elements) - expects raw Float32 audio samples
      console.log('Detected main audio model - using raw Float32 audio samples');
      return this.processRawAudio(audioData);
    }
  }

  /**
   * CORRECTED: Process raw audio samples for main BirdNET models
   * Based on whoBIRD analysis: Main models expect raw Float32 audio samples (Short → Float conversion)
   */
  private static processRawAudio(audioData: Float32Array): {
    processedData: Float32Array;
    shape: number[];
    processingType: 'raw_audio';
  } {
    console.log(`Processing raw audio: ${audioData.length} samples`);
    
    // CORRECTED: Simple Short → Float conversion (no complex preprocessing)
    const processedData = new Float32Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      let sample = audioData[i];
      
      // Optional high-pass filtering (configurable)
      if (this.config.highPassFilter) {
        sample = this.applyHighPassFilter(sample, i);
      }
      
      // Direct conversion - no normalization (preserve original signal)
      processedData[i] = sample;
    }
    
    console.log(`Raw audio processed: ${processedData.length} Float32 samples`);
    
    return {
      processedData,
      shape: [1, processedData.length], // [batch_size, num_samples]
      processingType: 'raw_audio'
    };
  }

  /**
   * Generate metadata features for location/temporal models (BirdNET Meta models)
   */
  private static generateMetadataFeatures(targetSize: number = 3): {
    processedData: Float32Array;
    shape: number[];
    processingType: 'metadata_features';
  } {
    console.log(`Generating ${targetSize} metadata features for BirdNET Meta model`);
    
    const features = new Float32Array(targetSize);
    
    if (targetSize === 3) {
      // BirdNET Meta model expects: [latitude, longitude, week_of_year_cosine]
      const locationMeta = (this as any).locationMetadata;
      const now = locationMeta?.date || new Date();
      const dayOfYear = this.getDayOfYear(now);
      const week = Math.ceil(dayOfYear * 48.0 / 366.0); // 48-week model year
      const weekCosine = Math.cos((week * 7.5) * Math.PI / 180) + 1.0; // 0-2 range
      
      features[0] = locationMeta?.latitude || 0.0;  // Use provided latitude or default
      features[1] = locationMeta?.longitude || 0.0; // Use provided longitude or default
      features[2] = weekCosine;                      // Week of year (cosine-transformed)
      
      console.log('Generated BirdNET Meta features:', {
        latitude: features[0],
        longitude: features[1], 
        week_cosine: features[2],
        source: locationMeta ? 'provided' : 'default'
      });
    } else {
      // For other sizes, fill with appropriate metadata
      for (let i = 0; i < targetSize; i++) {
        features[i] = 0.5; // Neutral default values
      }
    }
    
    return {
      processedData: features,
      shape: [1, targetSize],
      processingType: 'metadata_features'
    };
  }

  /**
   * Simple high-pass filter implementation (optional)
   */
  private static applyHighPassFilter(sample: number, index: number): number {
    // Simple first-order high-pass filter (placeholder)
    // In production, this should be a proper Butterworth filter like whoBIRD uses
    const alpha = 0.95; // High-pass filter coefficient
    const previousSample = index > 0 ? sample : 0;
    return alpha * (sample - previousSample);
  }

  /**
   * Calculate day of year for week calculation
   */
  private static getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Update preprocessing configuration for raw audio processing
   */
  static updateConfig(newConfig: Partial<AudioPreprocessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Audio preprocessing config updated (raw audio mode):', this.config);
  }

  /**
   * Update location/temporal metadata for Meta models
   */
  static updateLocationMetadata(latitude: number, longitude: number, date?: Date): void {
    // Store location metadata for use in generateMetadataFeatures
    (this as any).locationMetadata = {
      latitude,
      longitude,
      date: date || new Date()
    };
    console.log('Location metadata updated:', { latitude, longitude, date: date || new Date() });
  }

  /**
   * Get current audio processing statistics
   */
  static getProcessingStats(): {
    sampleRate: number;
    duration: number;
    expectedSamples: number;
    processingMode: 'raw_audio';
  } {
    return {
      sampleRate: this.config.sampleRate,
      duration: this.config.duration,
      expectedSamples: this.config.sampleRate * this.config.duration,
      processingMode: 'raw_audio'
    };
  }

  /**
   * Get current configuration
   */
  static getConfig(): AudioPreprocessingConfig {
    return { ...this.config };
  }

  // ======= CIRCULAR BUFFER MANAGEMENT (whoBIRD pattern) =======
  
  /**
   * Initialize circular buffer for continuous recording
   */
  static initializeCircularBuffer(): void {
    const bufferSize = this.config.sampleRate * this.config.duration; // 144,000 samples for 3s at 48kHz
    this.circularBuffer = new Int16Array(bufferSize);
    this.writeIndex = 0;
    console.log(`Circular buffer initialized: ${bufferSize} samples (${this.config.duration}s at ${this.config.sampleRate}Hz)`);
  }

  /**
   * Add new audio samples to circular buffer (whoBIRD pattern)
   */
  static addSamplesToCircularBuffer(newSamples: Int16Array): void {
    if (!this.circularBuffer) {
      this.initializeCircularBuffer();
    }

    if (!this.circularBuffer) return;

    // Copy new samples into circular buffer
    for (let i = 0; i < newSamples.length; i++) {
      this.circularBuffer[this.writeIndex] = newSamples[i];
      this.writeIndex = (this.writeIndex + 1) % this.circularBuffer.length;
    }

    console.log(`Added ${newSamples.length} samples to circular buffer`);
  }

  /**
   * Extract inference window from circular buffer (whoBIRD pattern)
   */
  static extractInferenceWindow(): Int16Array | null {
    if (!this.circularBuffer) {
      console.warn('Circular buffer not initialized');
      return null;
    }

    const windowSize = this.circularBuffer.length;
    const window = new Int16Array(windowSize);
    
    // Extract full window starting from current write position (oldest data first)
    for (let i = 0; i < windowSize; i++) {
      const readIndex = (this.writeIndex + i) % windowSize;
      window[i] = this.circularBuffer[readIndex];
    }

    console.log(`Extracted inference window: ${windowSize} samples`);
    return window;
  }

  /**
   * Process circular buffer data for model inference
   */
  static async processCircularBufferForInference(): Promise<ProcessedAudioData | null> {
    const audioWindow = this.extractInferenceWindow();
    if (!audioWindow) {
      return null;
    }

    // Convert Int16Array to Float32Array
    const floatAudio = new Float32Array(audioWindow.length);
    for (let i = 0; i < audioWindow.length; i++) {
      floatAudio[i] = audioWindow[i];
    }

    // Process with raw audio method
    const { processedData, shape } = this.processRawAudio(floatAudio);
    
    return {
      processedData,
      shape,
      metadata: {
        originalSampleRate: this.config.sampleRate,
        duration: this.config.duration,
        processingTime: 0, // Immediate processing
        processingType: 'raw_audio',
        modelInputShape: shape,
        sampleCount: processedData.length,
      },
    };
  }

  /**
   * Start continuous recording mode
   */
  static startContinuousRecording(): void {
    this.isRecording = true;
    this.initializeCircularBuffer();
    console.log('Continuous recording started (whoBIRD mode)');
  }

  /**
   * Stop continuous recording mode
   */
  static stopContinuousRecording(): void {
    this.isRecording = false;
    console.log('Continuous recording stopped');
  }

  /**
   * Check if in continuous recording mode
   */
  static isContinuousRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Clear circular buffer
   */
  static clearCircularBuffer(): void {
    if (this.circularBuffer) {
      this.circularBuffer.fill(0);
      this.writeIndex = 0;
      console.log('Circular buffer cleared');
    }
  }

  /**
   * Get circular buffer statistics
   */
  static getCircularBufferStats(): {
    initialized: boolean;
    size: number;
    writeIndex: number;
    isRecording: boolean;
    fillPercentage: number;
  } {
    return {
      initialized: this.circularBuffer !== null,
      size: this.circularBuffer?.length || 0,
      writeIndex: this.writeIndex,
      isRecording: this.isRecording,
      fillPercentage: this.circularBuffer ? (this.writeIndex / this.circularBuffer.length) * 100 : 0
    };
  }
}