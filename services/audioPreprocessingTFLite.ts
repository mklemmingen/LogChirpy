/**
 * Audio Preprocessing Service for TensorFlow Lite BirdNET Model
 * 
 * Converts audio files to mel-spectrograms suitable for BirdNET v2.4 TensorFlow Lite model.
 * This implementation processes audio to match the exact input requirements of the BirdNET model.
 */

import { AudioDecoder } from './audioDecoder';

export interface AudioPreprocessingConfig {
  sampleRate: number;        // Target sample rate (48kHz for BirdNET)
  windowSize: number;        // FFT window size
  hopLength: number;         // Hop length for STFT
  nMels: number;            // Number of mel filter banks
  fMin: number;             // Minimum frequency
  fMax: number;             // Maximum frequency
  duration: number;         // Target duration in seconds
  normalize: boolean;       // Whether to normalize audio
}

export interface ProcessedAudioData {
  melSpectrogram: Float32Array;  // Flattened mel-spectrogram data
  shape: [number, number, number, number]; // [batch, height, width, channels]
  metadata: {
    originalSampleRate: number;
    duration: number;
    processingTime: number;
  };
}

export class AudioPreprocessingTFLite {
  private static config: AudioPreprocessingConfig = {
    sampleRate: 48000,      // BirdNET v2.4 uses 48kHz
    windowSize: 2048,       // FFT window size (for low-freq channel)
    hopLength: 278,         // Hop length for low-freq (as per BirdNET docs)
    nMels: 96,             // 96 mel bins per channel (BirdNET v2.4 spec)
    fMin: 0,               // Minimum frequency for low-freq channel
    fMax: 3000,            // Maximum frequency for low-freq channel (3kHz)
    duration: 3.0,         // 3-second audio clips
    normalize: true,       // Normalize audio to [-1, 1]
  };

  // BirdNET v2.4 uses dual-channel spectrograms
  private static configHighFreq: AudioPreprocessingConfig = {
    sampleRate: 48000,
    windowSize: 1024,      // Smaller window for high-freq channel
    hopLength: 280,        // Hop length for high-freq
    nMels: 96,             // 96 mel bins per channel
    fMin: 500,             // 500 Hz minimum for high-freq channel
    fMax: 15000,           // 15 kHz maximum for high-freq channel
    duration: 3.0,
    normalize: true,
  };

  /**
   * Process audio file to mel-spectrogram for BirdNET TFLite model
   */
  static async processAudioFile(audioUri: string): Promise<ProcessedAudioData> {
    const startTime = Date.now();
    
    try {
      console.log('Processing audio for TensorFlow Lite...');
      
      // Step 1: Load and decode audio file
      const audioData = await this.loadAudioFile(audioUri);
      
      // Step 2: Resample to target sample rate if needed
      const resampledData = await this.resampleAudio(audioData);
      
      // Step 3: Trim or pad to target duration
      const trimmedData = this.trimOrPadAudio(resampledData);
      
      // Step 4: Generate mel-spectrogram compatible with current model
      const melSpectrogram = await this.generateCompatibleMelSpectrogram(trimmedData);
      
      // Step 5: Format for TensorFlow Lite (add batch and channel dimensions)
      const formattedData = this.formatForTFLite(melSpectrogram);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`Audio processing completed in ${processingTime}ms`);
      
      return {
        melSpectrogram: formattedData,
        shape: [1, 224, 224, 3], // [batch, height, width, channels] - Current model format
        metadata: {
          originalSampleRate: audioData.sampleRate,
          duration: trimmedData.length / this.config.sampleRate,
          processingTime,
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
   * Generate mel-spectrogram compatible with current model format [224, 224, 3]
   */
  private static async generateCompatibleMelSpectrogram(audioData: Float32Array): Promise<Float32Array> {
    console.log('Generating mel-spectrogram compatible with current model (224x224x3)...');
    
    // For now, generate a single-channel spectrogram and replicate it across 3 channels
    const singleChannelSpec = await this.generateSingleChannelMelSpectrogram(audioData, {
      ...this.config,
      nMels: 224, // Height should be 224
    });
    
    // Reshape to 224x224 and replicate across 3 channels
    const height = 224;
    const width = 224;
    const channels = 3;
    
    const compatibleData = new Float32Array(height * width * channels);
    
    // Fill the compatible format by replicating and reshaping the single channel data
    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        // Get value from single channel spec (with bounds checking)
        const sourceIndex = h * Math.min(width, Math.floor(singleChannelSpec.length / height)) + Math.min(w, Math.floor(singleChannelSpec.length / height) - 1);
        const value = sourceIndex < singleChannelSpec.length ? singleChannelSpec[sourceIndex] : 0;
        
        const outputIndex = (h * width + w) * channels;
        
        // Replicate across 3 channels (RGB-like format)
        compatibleData[outputIndex] = value;     // Channel 0
        compatibleData[outputIndex + 1] = value; // Channel 1  
        compatibleData[outputIndex + 2] = value; // Channel 2
      }
    }
    
    console.log(`Compatible mel-spectrogram generated: ${height}x${width}x${channels}`);
    return compatibleData;
  }

  /**
   * Generate dual-channel mel-spectrograms for BirdNET v2.4 (unused for now)
   */
  private static async generateDualChannelMelSpectrogram(audioData: Float32Array): Promise<Float32Array> {
    console.log('Generating dual-channel mel-spectrograms for BirdNET v2.4...');
    
    // Generate low-frequency channel (0-3kHz)
    const lowFreqSpectrogram = await this.generateSingleChannelMelSpectrogram(audioData, this.config);
    
    // Generate high-frequency channel (500Hz-15kHz)
    const highFreqSpectrogram = await this.generateSingleChannelMelSpectrogram(audioData, this.configHighFreq);
    
    // Combine into dual-channel format: [height, width, channels]
    // BirdNET v2.4 expects 96x511 for each channel
    const height = 96;
    const width = 511;
    const channels = 2;
    
    const dualChannelData = new Float32Array(height * width * channels);
    
    // Interleave the two channels
    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        const index = h * width + w;
        const outputIndex = (h * width + w) * channels;
        
        // Channel 0: Low frequency (0-3kHz)
        if (index < lowFreqSpectrogram.length) {
          dualChannelData[outputIndex] = lowFreqSpectrogram[index];
        }
        
        // Channel 1: High frequency (500Hz-15kHz)
        if (index < highFreqSpectrogram.length) {
          dualChannelData[outputIndex + 1] = highFreqSpectrogram[index];
        }
      }
    }
    
    console.log(`Dual-channel mel-spectrogram generated: ${height}x${width}x${channels}`);
    return dualChannelData;
  }

  /**
   * Generate single-channel mel-spectrogram from audio data
   */
  private static async generateSingleChannelMelSpectrogram(audioData: Float32Array, config: AudioPreprocessingConfig): Promise<Float32Array> {
    console.log(`Generating mel-spectrogram (${config.fMin}-${config.fMax}Hz)...`);
    
    // Normalize audio if requested
    if (config.normalize) {
      const maxVal = Math.max(...Array.from(audioData).map(Math.abs));
      if (maxVal > 0) {
        for (let i = 0; i < audioData.length; i++) {
          audioData[i] /= maxVal;
        }
      }
    }
    
    // Calculate number of frames to get 511 width for BirdNET v2.4
    const numFrames = Math.floor((audioData.length - config.windowSize) / config.hopLength) + 1;
    const spectrogramWidth = Math.min(numFrames, 511); // BirdNET v2.4 expects 511 width
    
    // Initialize mel-spectrogram
    const melSpectrogram = new Float32Array(config.nMels * spectrogramWidth);
    
    // Generate mel filter bank with the specific config
    const melFilters = this.generateMelFilterBankForConfig(config);
    
    // Process each frame
    for (let frame = 0; frame < spectrogramWidth; frame++) {
      const startSample = frame * config.hopLength;
      
      // Extract frame
      const frameData = new Float32Array(config.windowSize);
      for (let i = 0; i < config.windowSize; i++) {
        if (startSample + i < audioData.length) {
          frameData[i] = audioData[startSample + i];
        }
      }
      
      // Apply window function (Hann window)
      for (let i = 0; i < config.windowSize; i++) {
        const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (config.windowSize - 1));
        frameData[i] *= window;
      }
      
      // Compute FFT magnitude spectrum
      const spectrum = this.computeFFTMagnitudeForConfig(frameData, config);
      
      // Apply mel filter bank
      for (let mel = 0; mel < config.nMels; mel++) {
        let melValue = 0;
        for (let bin = 0; bin < spectrum.length; bin++) {
          melValue += spectrum[bin] * melFilters[mel][bin];
        }
        
        // Apply log scale and store
        melSpectrogram[mel * spectrogramWidth + frame] = Math.log(Math.max(melValue, 1e-10));
      }
    }
    
    // Normalize mel-spectrogram
    this.normalizeMelSpectrogram(melSpectrogram);
    
    console.log(`Mel-spectrogram generated: ${this.config.nMels}x${spectrogramWidth}`);
    
    return melSpectrogram;
  }

  /**
   * Generate mel filter bank for specific config
   */
  private static generateMelFilterBankForConfig(config: AudioPreprocessingConfig): Float32Array[] {
    const numBins = config.windowSize / 2 + 1;
    const melFilters: Float32Array[] = [];
    
    // Convert Hz to mel scale
    const melMin = this.hzToMel(config.fMin);
    const melMax = this.hzToMel(config.fMax);
    
    // Create mel points
    const melPoints: number[] = [];
    for (let i = 0; i <= config.nMels + 1; i++) {
      melPoints.push(melMin + (melMax - melMin) * i / (config.nMels + 1));
    }
    
    // Convert mel points to Hz
    const hzPoints = melPoints.map(mel => this.melToHz(mel));
    
    // Convert Hz to bin indices
    const binPoints = hzPoints.map(hz => Math.floor(hz * config.windowSize / config.sampleRate));
    
    // Create triangular filters
    for (let mel = 0; mel < config.nMels; mel++) {
      const filter = new Float32Array(numBins);
      
      const leftBin = binPoints[mel];
      const centerBin = binPoints[mel + 1];
      const rightBin = binPoints[mel + 2];
      
      // Left slope
      for (let bin = leftBin; bin < centerBin && bin < numBins; bin++) {
        if (centerBin > leftBin) {
          filter[bin] = (bin - leftBin) / (centerBin - leftBin);
        }
      }
      
      // Right slope
      for (let bin = centerBin; bin < rightBin && bin < numBins; bin++) {
        if (rightBin > centerBin) {
          filter[bin] = (rightBin - bin) / (rightBin - centerBin);
        }
      }
      
      melFilters.push(filter);
    }
    
    return melFilters;
  }

  /**
   * Generate mel filter bank (legacy method)
   */
  private static generateMelFilterBank(): Float32Array[] {
    const numBins = this.config.windowSize / 2 + 1;
    const melFilters: Float32Array[] = [];
    
    // Convert Hz to mel scale
    const melMin = this.hzToMel(this.config.fMin);
    const melMax = this.hzToMel(this.config.fMax);
    
    // Create mel points
    const melPoints: number[] = [];
    for (let i = 0; i <= this.config.nMels + 1; i++) {
      melPoints.push(melMin + (melMax - melMin) * i / (this.config.nMels + 1));
    }
    
    // Convert mel points to Hz
    const hzPoints = melPoints.map(mel => this.melToHz(mel));
    
    // Convert Hz to bin indices
    const binPoints = hzPoints.map(hz => Math.floor(hz * this.config.windowSize / this.config.sampleRate));
    
    // Create triangular filters
    for (let mel = 0; mel < this.config.nMels; mel++) {
      const filter = new Float32Array(numBins);
      
      const leftBin = binPoints[mel];
      const centerBin = binPoints[mel + 1];
      const rightBin = binPoints[mel + 2];
      
      // Left slope
      for (let bin = leftBin; bin < centerBin && bin < numBins; bin++) {
        if (centerBin > leftBin) {
          filter[bin] = (bin - leftBin) / (centerBin - leftBin);
        }
      }
      
      // Right slope
      for (let bin = centerBin; bin < rightBin && bin < numBins; bin++) {
        if (rightBin > centerBin) {
          filter[bin] = (rightBin - bin) / (rightBin - centerBin);
        }
      }
      
      melFilters.push(filter);
    }
    
    return melFilters;
  }

  /**
   * Compute FFT magnitude spectrum for specific config
   */
  private static computeFFTMagnitudeForConfig(frameData: Float32Array, config: AudioPreprocessingConfig): Float32Array {
    const n = frameData.length;
    
    // Ensure input size is power of 2 for optimal FFT performance
    const fftSize = this.nextPowerOfTwo(n);
    const paddedData = new Float32Array(fftSize);
    paddedData.set(frameData);
    
    try {
      // Use fft-js library for efficient FFT computation
      const { FFT } = require('fft-js');
      
      // Convert to complex format expected by fft-js
      const complexInput: [number, number][] = [];
      for (let i = 0; i < fftSize; i++) {
        complexInput.push([paddedData[i] || 0, 0]); // [real, imaginary]
      }
      
      // Perform FFT
      const complexOutput = FFT(complexInput);
      
      // Compute magnitude spectrum (only positive frequencies)
      const spectrum = new Float32Array(Math.floor(fftSize / 2) + 1);
      for (let i = 0; i < spectrum.length; i++) {
        const real = complexOutput[i][0];
        const imag = complexOutput[i][1];
        spectrum[i] = Math.sqrt(real * real + imag * imag);
      }
      
      return spectrum;
      
    } catch (error) {
      console.warn('FFT-JS not available, using simplified approach', error);
      // Fallback to simplified magnitude calculation
      const spectrum = new Float32Array(Math.floor(fftSize / 2) + 1);
      for (let i = 0; i < spectrum.length; i++) {
        spectrum[i] = Math.abs(paddedData[i] || 0);
      }
      return spectrum;
    }
  }

  /**
   * Compute FFT magnitude spectrum using proper FFT implementation (legacy)
   */
  private static computeFFTMagnitude(frameData: Float32Array): Float32Array {
    const n = frameData.length;
    
    // Ensure input size is power of 2 for optimal FFT performance
    const fftSize = this.nextPowerOfTwo(n);
    const paddedData = new Float32Array(fftSize);
    paddedData.set(frameData);
    
    try {
      // Use fft-js library for efficient FFT computation
      const { FFT } = require('fft-js');
      
      // Convert to complex format expected by fft-js
      const complexInput: [number, number][] = [];
      for (let i = 0; i < fftSize; i++) {
        complexInput.push([paddedData[i] || 0, 0]); // [real, imaginary]
      }
      
      // Perform FFT
      const complexOutput = FFT(complexInput);
      
      // Compute magnitude spectrum (only positive frequencies)
      const spectrum = new Float32Array(Math.floor(fftSize / 2) + 1);
      for (let i = 0; i < spectrum.length; i++) {
        const real = complexOutput[i][0];
        const imag = complexOutput[i][1];
        spectrum[i] = Math.sqrt(real * real + imag * imag);
      }
      
      return spectrum;
    } catch (error) {
      console.error('FFT computation failed, falling back to naive DFT:', error);
      return this.computeNaiveDFT(frameData);
    }
  }

  /**
   * Fallback naive DFT implementation (for error cases only)
   */
  private static computeNaiveDFT(frameData: Float32Array): Float32Array {
    const n = frameData.length;
    const spectrum = new Float32Array(Math.floor(n / 2) + 1);
    
    for (let k = 0; k < spectrum.length; k++) {
      let real = 0;
      let imag = 0;
      
      for (let t = 0; t < n; t++) {
        const angle = -2 * Math.PI * k * t / n;
        real += frameData[t] * Math.cos(angle);
        imag += frameData[t] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  /**
   * Find next power of 2 for optimal FFT performance
   */
  private static nextPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }

  /**
   * Convert Hz to mel scale
   */
  private static hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  /**
   * Convert mel scale to Hz
   */
  private static melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
   * Normalize mel-spectrogram
   */
  private static normalizeMelSpectrogram(melSpectrogram: Float32Array): void {
    // Find min and max values
    let min = Infinity;
    let max = -Infinity;
    
    for (let i = 0; i < melSpectrogram.length; i++) {
      min = Math.min(min, melSpectrogram[i]);
      max = Math.max(max, melSpectrogram[i]);
    }
    
    // Normalize to [-1, 1] range
    const range = max - min;
    if (range > 0) {
      for (let i = 0; i < melSpectrogram.length; i++) {
        melSpectrogram[i] = 2 * (melSpectrogram[i] - min) / range - 1;
      }
    }
  }

  /**
   * Format mel-spectrogram for TensorFlow Lite input
   */
  private static formatForTFLite(melSpectrogram: Float32Array): Float32Array {
    // BirdNET expects input shape [1, 224, 224, 3]
    // We need to convert our mel-spectrogram to this format
    
    const batchSize = 1;
    const height = this.config.nMels; // 224
    const width = 224;
    const channels = 3;
    
    const totalSize = batchSize * height * width * channels;
    const formattedData = new Float32Array(totalSize);
    
    // Copy mel-spectrogram data to all 3 channels (RGB format)
    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        const melIndex = h * width + w;
        const melValue = melIndex < melSpectrogram.length ? melSpectrogram[melIndex] : 0;
        
        // Copy to all 3 channels
        for (let c = 0; c < channels; c++) {
          const outputIndex = h * width * channels + w * channels + c;
          formattedData[outputIndex] = melValue;
        }
      }
    }
    
    console.log(`Formatted for TFLite: [${batchSize}, ${height}, ${width}, ${channels}]`);
    
    return formattedData;
  }

  /**
   * Update preprocessing configuration
   */
  static updateConfig(newConfig: Partial<AudioPreprocessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Audio preprocessing config updated:', this.config);
  }

  /**
   * Get current configuration
   */
  static getConfig(): AudioPreprocessingConfig {
    return { ...this.config };
  }
}