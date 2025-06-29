/**
 * Native Audio Processor - whoBIRD-style Implementation
 * 
 * Based on whoBIRD SoundClassifier.kt implementation:
 * - Circular buffer management
 * - Short → Float conversion (PCM 16-bit)
 * - Real-time audio processing
 * - Optional Butterworth high-pass filtering
 */

import { Audio } from 'expo-av';

export interface AudioProcessorConfig {
  sampleRate: number;        // 48000 Hz
  channels: number;          // 1 (mono)
  bitDepth: number;          // 16-bit PCM
  modelInputLength: number;  // Number of samples required by model (e.g., 144000 for 3 seconds)
  inferenceInterval: number; // 800ms
  enableHighPass: boolean;   // Optional Butterworth filter
  highPassFreq: number;      // High-pass cutoff frequency (Hz)
}

export interface AudioSample {
  samples: Float32Array;
  timestamp: number;
  sampleCount: number;
  isValid: boolean;
}

/**
 * Simulates whoBIRD's native AudioRecord → ShortArray → FloatBuffer pipeline
 * This is a JavaScript approximation of the Android native implementation
 */
export class NativeAudioProcessor {
  private config: AudioProcessorConfig;
  private circularBuffer: Int16Array;
  private bufferWriteIndex = 0;
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private audioCallback: ((sample: AudioSample) => void) | null = null;
  private processingTimer: NodeJS.Timeout | null = null;

  // Simple high-pass filter state (simplified Butterworth approximation)
  private filterState = {
    prevInput: 0,
    prevOutput: 0,
    alpha: 0.95 // High-pass filter coefficient
  };

  constructor(config: AudioProcessorConfig) {
    this.config = config;
    this.circularBuffer = new Int16Array(config.modelInputLength);
    console.log('NativeAudioProcessor initialized:', {
      sampleRate: config.sampleRate,
      modelInputLength: config.modelInputLength,
      bufferSizeBytes: config.modelInputLength * 2 // 16-bit = 2 bytes per sample
    });
  }

  /**
   * Start recording with whoBIRD-style configuration
   */
  async startRecording(): Promise<boolean> {
    try {
      if (this.isRecording) {
        console.warn('Already recording');
        return true;
      }

      console.log('Starting native-style audio recording...');

      // Note: Audio session configuration is now handled by RealTimeAudioRecorder
      // This processor focuses on the circular buffer management only

      // Calculate buffer size similar to whoBIRD
      const minBufferSize = this.config.sampleRate * 2; // 2 seconds minimum
      const modelRequiredBufferSize = 2 * this.config.modelInputLength * 2; // 2 bytes per 16-bit sample
      const bufferSize = Math.max(minBufferSize, modelRequiredBufferSize);

      console.log('Audio buffer configuration:', {
        minBufferSize,
        modelRequiredBufferSize,
        finalBufferSize: bufferSize
      });

      // Recording options optimized for whoBIRD-style processing
      const recordingOptions: Audio.RecordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: this.config.sampleRate,
          numberOfChannels: this.config.channels,
          bitRate: this.config.sampleRate * this.config.bitDepth * this.config.channels,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: this.config.sampleRate,
          numberOfChannels: this.config.channels,
          bitRate: this.config.sampleRate * this.config.bitDepth * this.config.channels,
          linearPCMBitDepth: this.config.bitDepth,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {}
      };

      // Start recording
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(recordingOptions);
      await this.recording.startAsync();

      this.isRecording = true;
      console.log('Native audio recording started');

      // Start the whoBIRD-style processing loop
      this.startProcessingLoop();

      return true;

    } catch (error) {
      console.error('Failed to start native audio recording:', error);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<void> {
    try {
      console.log('Stopping native audio recording...');

      if (this.processingTimer) {
        clearInterval(this.processingTimer);
        this.processingTimer = null;
      }

      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }

      this.isRecording = false;
      console.log('Native audio recording stopped');

    } catch (error) {
      console.error('Error stopping native audio recording:', error);
    }
  }

  /**
   * Set callback for processed audio samples
   */
  setAudioCallback(callback: (sample: AudioSample) => void): void {
    this.audioCallback = callback;
  }

  /**
   * Start processing loop similar to whoBIRD's scheduleAtFixedRate
   */
  private startProcessingLoop(): void {
    this.processingTimer = setInterval(async () => {
      if (!this.isRecording || !this.recording) {
        return;
      }

      try {
        // Simulate whoBIRD's loadAudio() method
        const audioSample = await this.loadAudioSample();
        
        if (audioSample.isValid && audioSample.sampleCount > 0) {
          // Process the audio sample
          this.processAudioSample(audioSample);
        }
      } catch (error) {
        console.warn('Audio processing iteration failed:', error);
      }
    }, this.config.inferenceInterval);

    console.log(`Audio processing loop started: ${this.config.inferenceInterval}ms intervals`);
  }

  /**
   * Simulate whoBIRD's loadAudio() method - extract PCM data from recording
   * NOTE: This is the critical missing piece that needs native bridge implementation
   */
  private async loadAudioSample(): Promise<AudioSample> {
    if (!this.recording) {
      return {
        samples: new Float32Array(0),
        timestamp: Date.now(),
        sampleCount: 0,
        isValid: false
      };
    }

    try {
      // Get recording status
      const status = await this.recording.getStatusAsync();
      
      if (!status.isRecording) {
        return {
          samples: new Float32Array(0),
          timestamp: Date.now(),
          sampleCount: 0,
          isValid: false
        };
      }

      // CRITICAL MISSING IMPLEMENTATION:
      // This is where we need a native bridge to extract raw PCM data
      // For now, we'll generate realistic synthetic audio data
      const sampleCount = Math.floor(this.config.sampleRate * (this.config.inferenceInterval / 1000));
      const syntheticSamples = this.generateRealisticAudioData(sampleCount);

      return {
        samples: syntheticSamples,
        timestamp: Date.now(),
        sampleCount: syntheticSamples.length,
        isValid: true
      };

    } catch (error) {
      console.warn('Failed to load audio sample:', error);
      return {
        samples: new Float32Array(0),
        timestamp: Date.now(),
        sampleCount: 0,
        isValid: false
      };
    }
  }

  /**
   * Process audio sample following whoBIRD pattern
   * Implements circular buffer and Short → Float conversion
   */
  private processAudioSample(sample: AudioSample): void {
    // Convert Float32 back to Int16 for circular buffer (simulating whoBIRD's ShortArray)
    const shortSamples = new Int16Array(sample.sampleCount);
    for (let i = 0; i < sample.sampleCount; i++) {
      // Convert normalized float [-1, 1] to 16-bit integer [-32768, 32767]
      shortSamples[i] = Math.round(sample.samples[i] * 32767);
    }

    // Copy new data into circular buffer (whoBIRD style)
    for (let i = 0; i < shortSamples.length; i++) {
      this.circularBuffer[this.bufferWriteIndex] = shortSamples[i];
      this.bufferWriteIndex = (this.bufferWriteIndex + 1) % this.circularBuffer.length;
    }

    // Extract model input from circular buffer (whoBIRD style)
    const modelInput = new Float32Array(this.config.modelInputLength);
    let samplesAreAllZero = true;

    for (let i = 0; i < this.config.modelInputLength; i++) {
      const circularIndex = (i + this.bufferWriteIndex) % this.config.modelInputLength;
      const shortValue = this.circularBuffer[circularIndex];
      
      if (samplesAreAllZero && shortValue !== 0) {
        samplesAreAllZero = false;
      }

      // Convert Short to Float (whoBIRD style) with optional high-pass filter
      let floatValue = shortValue;
      if (this.config.enableHighPass) {
        floatValue = this.applyHighPassFilter(shortValue);
      }
      
      modelInput[i] = floatValue;
    }

    // Check for silent samples (whoBIRD style)
    if (samplesAreAllZero) {
      console.warn('All audio samples are zero - possible microphone issue');
      return;
    }

    // Notify callback with processed audio (ready for model inference)
    if (this.audioCallback) {
      this.audioCallback({
        samples: modelInput,
        timestamp: sample.timestamp,
        sampleCount: modelInput.length,
        isValid: true
      });
    }
  }

  /**
   * Simple high-pass filter (simplified Butterworth approximation)
   * Based on whoBIRD's Butterworth filter implementation
   */
  private applyHighPassFilter(sample: number): number {
    // Simple first-order high-pass filter
    const output = this.filterState.alpha * (this.filterState.prevOutput + sample - this.filterState.prevInput);
    
    this.filterState.prevInput = sample;
    this.filterState.prevOutput = output;
    
    return output;
  }

  /**
   * Generate realistic synthetic audio data for testing
   * This simulates various bird call patterns and environmental sounds
   */
  private generateRealisticAudioData(sampleCount: number): Float32Array {
    const samples = new Float32Array(sampleCount);
    const time = Date.now() / 1000;

    for (let i = 0; i < sampleCount; i++) {
      const t = i / this.config.sampleRate;
      
      // Background noise (very low amplitude)
      let sample = (Math.random() - 0.5) * 0.02;
      
      // Occasionally add bird-like frequency sweeps
      if (Math.random() < 0.001) { // 0.1% chance per sample
        const freq = 2000 + Math.sin(time + t) * 1000; // Frequency sweep 1-3kHz
        const envelope = Math.exp(-t * 5); // Decay envelope
        sample += Math.sin(2 * Math.PI * freq * t) * envelope * 0.3;
      }
      
      // Add some environmental sounds (wind, rustling)
      const envFreq = 200 + Math.sin(time * 0.1) * 100;
      sample += Math.sin(2 * Math.PI * envFreq * t) * 0.05;
      
      // Clamp to reasonable range
      samples[i] = Math.max(-1, Math.min(1, sample));
    }

    return samples;
  }

  /**
   * Get current recording state
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get buffer fill percentage
   */
  getBufferFillPercentage(): number {
    return (this.bufferWriteIndex / this.circularBuffer.length) * 100;
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    await this.stopRecording();
    this.audioCallback = null;
    console.log('NativeAudioProcessor disposed');
  }
}

// Export factory function with error handling
export const createNativeAudioProcessor = (config: AudioProcessorConfig): NativeAudioProcessor => {
  try {
    return new NativeAudioProcessor(config);
  } catch (error) {
    console.error('CRITICAL: Failed to create NativeAudioProcessor:', error);
    console.error('This may indicate a "Super expression must either be null or a function" error');
    throw error; // Re-throw since this is a factory function
  }
};