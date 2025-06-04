// Audio preprocessing for bird classification
// Converts audio files to mel-spectrograms for the BirdNET model

import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import * as tf from '@tensorflow/tfjs';
// @ts-ignore - fft-js doesn't have type definitions
import { fft } from 'fft-js';

export interface AudioProcessingConfig {
  sampleRate: number;
  windowSize: number;
  hopSize: number;
  melFilters: number;
  targetWidth: number;
  targetHeight: number;
  normalizeAudio: boolean;
}

export interface ProcessedAudio {
  melSpectrogram: tf.Tensor4D;
  originalSampleRate: number;
  duration: number;
  metadata: {
    shape: number[];
    min: number;
    max: number;
  };
}

export class AudioPreprocessingService {
  private static defaultConfig: AudioProcessingConfig = {
    sampleRate: 22050,        // Standard for bird audio analysis
    windowSize: 1024,         // FFT window size
    hopSize: 512,             // Hop size for STFT
    melFilters: 128,          // Number of mel filter banks
    targetWidth: 224,         // Target spectrogram width
    targetHeight: 224,        // Target spectrogram height
    normalizeAudio: true,     // Whether to normalize audio
  };

  private static config: AudioProcessingConfig = { ...this.defaultConfig };

  static updateConfig(newConfig: Partial<AudioProcessingConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  static resetConfig() {
    this.config = { ...this.defaultConfig };
  }

  // Convert audio file to mel-spectrogram for bird classification
  static async processAudioFile(audioUri: string): Promise<ProcessedAudio> {
    try {
      const audioData = await this.loadAudioFile(audioUri);
      const resampledData = await this.resampleAudio(audioData);
      const stftData = this.computeSTFT(resampledData);
      const melSpectrogram = this.computeMelSpectrogram(stftData);
      const tensor = await this.convertToTensor(melSpectrogram);
      const finalTensor = this.normalizeTensor(tensor) as tf.Tensor4D;
      
      return {
        melSpectrogram: finalTensor,
        originalSampleRate: audioData.sampleRate,
        duration: audioData.duration,
        metadata: {
          shape: finalTensor.shape,
          min: (await finalTensor.min().data())[0],
          max: (await finalTensor.max().data())[0],
        },
      };
    } catch (error) {
      console.error('Audio processing error:', error);
      throw new Error(`Failed to process audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // TODO: Replace with actual audio decoder (currently generates mock data)
  private static async loadAudioFile(audioUri: string): Promise<{
    data: Float32Array;
    sampleRate: number;
    duration: number;
  }> {
    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error('Audio file not found');
      }

      // Mock bird audio data for testing - replace with real decoder
      const mockSampleRate = 22050;
      const mockDuration = 3.0;
      const mockSampleCount = Math.floor(mockSampleRate * mockDuration);
      
      const mockData = new Float32Array(mockSampleCount);
      for (let i = 0; i < mockSampleCount; i++) {
        const t = i / mockSampleRate;
        const freq1 = 2000 + 1000 * Math.sin(t * 0.5);
        const freq2 = 4000 + 2000 * Math.sin(t * 0.3);
        mockData[i] = 
          0.3 * Math.sin(2 * Math.PI * freq1 * t) +
          0.2 * Math.sin(2 * Math.PI * freq2 * t) +
          0.1 * (Math.random() - 0.5);
      }

      return {
        data: mockData,
        sampleRate: mockSampleRate,
        duration: mockDuration,
      };
    } catch (error) {
      throw new Error(`Failed to load audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Basic linear interpolation resampling
  private static async resampleAudio(audioData: {
    data: Float32Array;
    sampleRate: number;
    duration: number;
  }): Promise<Float32Array> {
    const { data, sampleRate } = audioData;
    const targetSampleRate = this.config.sampleRate;

    if (sampleRate === targetSampleRate) {
      return data;
    }

    // Linear interpolation resampling
    const ratio = targetSampleRate / sampleRate;
    const newLength = Math.floor(data.length * ratio);
    const resampled = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i / ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      if (index + 1 < data.length) {
        resampled[i] = data[index] * (1 - fraction) + data[index + 1] * fraction;
      } else {
        resampled[i] = data[index] || 0;
      }
    }

    return resampled;
  }

  // STFT with Hann windowing for frequency analysis
  private static computeSTFT(audioData: Float32Array): number[][] {
    const { windowSize, hopSize } = this.config;
    const numFrames = Math.floor((audioData.length - windowSize) / hopSize) + 1;
    const stftData: number[][] = [];

    const window = this.createHannWindow(windowSize);

    for (let frame = 0; frame < numFrames; frame++) {
      const start = frame * hopSize;
      const windowedData = new Array(windowSize);

      for (let i = 0; i < windowSize; i++) {
        const sampleIndex = start + i;
        const sample = sampleIndex < audioData.length ? audioData[sampleIndex] : 0;
        windowedData[i] = sample * window[i];
      }

      const fftResult = fft(windowedData);
      const magnitudes = fftResult.slice(0, windowSize / 2).map((complex: any) => {
        const real = complex[0];
        const imag = complex[1];
        return Math.sqrt(real * real + imag * imag);
      });

      stftData.push(magnitudes);
    }

    return stftData;
  }

  private static createHannWindow(size: number): number[] {
    const window = new Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
    }
    return window;
  }

  // Convert frequency spectrum to mel-scale for better bird classification
  private static computeMelSpectrogram(stftData: number[][]): number[][] {
    const { sampleRate, melFilters } = this.config;
    const fftSize = (stftData[0]?.length || 0) * 2;
    
    const melFilterBank = this.createMelFilterBank(melFilters, fftSize, sampleRate);
    const melSpectrogram: number[][] = [];
    
    for (const frame of stftData) {
      const melFrame = new Array(melFilters).fill(0);
      
      for (let m = 0; m < melFilters; m++) {
        for (let f = 0; f < frame.length; f++) {
          melFrame[m] += frame[f] * melFilterBank[m][f];
        }
        melFrame[m] = Math.log(Math.max(melFrame[m], 1e-10)); // Log scale
      }
      
      melSpectrogram.push(melFrame);
    }

    return melSpectrogram;
  }

  // Build triangular mel-scale filters for frequency binning
  private static createMelFilterBank(numFilters: number, fftSize: number, sampleRate: number): number[][] {
    const numFreqBins = Math.floor(fftSize / 2);
    const melFilterBank: number[][] = [];

    const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
    const melToHz = (mel: number) => 700 * (Math.pow(10, mel / 2595) - 1);

    const minMel = hzToMel(0);
    const maxMel = hzToMel(sampleRate / 2);
    const melPoints = new Array(numFilters + 2);
    
    for (let i = 0; i <= numFilters + 1; i++) {
      melPoints[i] = melToHz(minMel + (maxMel - minMel) * i / (numFilters + 1));
    }

    const binPoints = melPoints.map(freq => Math.floor((fftSize + 1) * freq / sampleRate));

    // Build triangular filters
    for (let m = 0; m < numFilters; m++) {
      const filter = new Array(numFreqBins).fill(0);
      
      for (let f = binPoints[m]; f < binPoints[m + 2]; f++) {
        if (f < binPoints[m + 1]) {
          filter[f] = (f - binPoints[m]) / (binPoints[m + 1] - binPoints[m]);
        } else {
          filter[f] = (binPoints[m + 2] - f) / (binPoints[m + 2] - binPoints[m + 1]);
        }
      }
      
      melFilterBank.push(filter);
    }

    return melFilterBank;
  }

  // Convert to tensor and resize for model input (224x224x3)
  private static async convertToTensor(melSpectrogram: number[][]): Promise<tf.Tensor3D> {
    const { targetWidth, targetHeight } = this.config;
    
    const freqBins = melSpectrogram[0]?.length || 0;
    const timeFrames = melSpectrogram.length;
    
    // Transpose: frequency x time format
    const spectrogramData = new Array(freqBins);
    for (let f = 0; f < freqBins; f++) {
      spectrogramData[f] = new Array(timeFrames);
      for (let t = 0; t < timeFrames; t++) {
        spectrogramData[f][t] = melSpectrogram[t][f];
      }
    }

    let tensor = tf.tensor2d(spectrogramData);
    const tensor3d = tensor.expandDims(2) as tf.Tensor3D;
    const resizedTensor = tf.image.resizeBilinear(
      tensor3d, 
      [targetHeight, targetWidth]
    ) as tf.Tensor3D;

    // Convert to RGB (repeat channel 3 times)
    const rgbTensor = tf.concat([resizedTensor, resizedTensor, resizedTensor], 2);
    tensor.dispose();
    tensor3d.dispose();
    resizedTensor.dispose();
    
    return rgbTensor as tf.Tensor3D;
  }

  // Normalize to [0,1] and add batch dimension
  private static normalizeTensor(tensor: tf.Tensor3D): tf.Tensor4D {
    const batchTensor = tensor.expandDims(0) as tf.Tensor4D;
    
    if (!this.config.normalizeAudio) {
      return batchTensor;
    }

    const min = batchTensor.min();
    const max = batchTensor.max();
    const range = max.sub(min);
    
    const normalizedTensor = batchTensor.sub(min).div(range.add(1e-8));
    min.dispose();
    max.dispose();
    range.dispose();
    
    return normalizedTensor as tf.Tensor4D;
  }

  // Debug info about processed audio
  static async getProcessingStats(processedAudio: ProcessedAudio): Promise<{
    inputShape: number[];
    dataRange: { min: number; max: number };
    memoryUsage: number;
    duration: number;
  }> {
    const { melSpectrogram, duration, metadata } = processedAudio;
    
    return {
      inputShape: metadata.shape,
      dataRange: { min: metadata.min, max: metadata.max },
      memoryUsage: melSpectrogram.size * 4, // 4 bytes per float32
      duration,
    };
  }
}