/**
 * Audio Window Manager - ULTIMATE Guide Implementation
 * 
 * Implements the circular buffer and 3-second window management
 * exactly as specified in ULTIMATE_AUDIO_MODEL_IMPLEMENTATION_GUIDE.md
 */

interface AudioBuffer {
  data: Float32Array;
  sampleRate: number;
  channels: number;
  duration: number;
}

export class AudioWindowManager {
  private buffer: Float32Array;
  private writePosition: number = 0;
  private readonly sampleRate: number;
  private readonly windowSize: number; // 144,000 samples (3s @ 48kHz)
  private readonly bufferSize: number; // 10 second buffer

  constructor(sampleRate: number = 48000, windowDurationSeconds: number = 3, bufferDurationSeconds: number = 10) {
    this.sampleRate = sampleRate;
    this.windowSize = sampleRate * windowDurationSeconds; // 144,000 samples for 3 seconds
    this.bufferSize = sampleRate * bufferDurationSeconds; // 480,000 samples for 10 seconds
    this.buffer = new Float32Array(this.bufferSize);
    
    console.log(`[AudioWindow] Initialized: ${this.windowSize} samples window, ${this.bufferSize} samples buffer`);
  }

  /**
   * Convert Int16 PCM to Float32 as per ULTIMATE guide
   */
  processAudioChunk(pcmData: Int16Array): void {
    for (let i = 0; i < pcmData.length; i++) {
      // Guide formula: divide by max int16 value (32768.0)
      this.buffer[this.writePosition] = pcmData[i] / 32768.0;
      this.writePosition = (this.writePosition + 1) % this.buffer.length;
    }
  }

  /**
   * Process raw Float32 audio data directly
   */
  processFloat32Chunk(audioData: Float32Array): void {
    for (let i = 0; i < audioData.length; i++) {
      this.buffer[this.writePosition] = audioData[i];
      this.writePosition = (this.writePosition + 1) % this.buffer.length;
    }
  }

  /**
   * Extract 3-second window for inference - ULTIMATE guide implementation
   */
  getInferenceWindow(): Float32Array {
    const window = new Float32Array(this.windowSize);
    
    // Get the most recent 3 seconds
    let readPos = (this.writePosition - this.windowSize + this.buffer.length) % this.buffer.length;
    
    for (let i = 0; i < this.windowSize; i++) {
      window[i] = this.buffer[readPos];
      readPos = (readPos + 1) % this.buffer.length;
    }
    
    return window;
  }

  /**
   * Apply high-pass filter as specified in ULTIMATE guide
   */
  applyHighPassFilter(data: Float32Array, cutoff: number = 200): Float32Array {
    // Simple first-order high-pass filter from guide
    const rc = 1.0 / (2.0 * Math.PI * cutoff);
    const dt = 1.0 / this.sampleRate;
    const alpha = rc / (rc + dt);
    
    const filtered = new Float32Array(data.length);
    filtered[0] = data[0];
    
    for (let i = 1; i < data.length; i++) {
      filtered[i] = alpha * (filtered[i-1] + data[i] - data[i-1]);
    }
    
    return filtered;
  }

  /**
   * Get filtered inference window ready for model input
   */
  getFilteredInferenceWindow(): Float32Array {
    const rawWindow = this.getInferenceWindow();
    return this.applyHighPassFilter(rawWindow, 200);
  }

  /**
   * Check if buffer has enough data for inference
   */
  hasEnoughDataForInference(): boolean {
    // We need at least one full window worth of data
    return this.writePosition >= this.windowSize || 
           (this.writePosition < this.windowSize && this.buffer[this.bufferSize - 1] !== 0);
  }

  /**
   * Get current buffer fill percentage
   */
  getBufferFillPercentage(): number {
    return (this.writePosition / this.bufferSize) * 100;
  }

  /**
   * Reset the buffer
   */
  reset(): void {
    this.buffer.fill(0);
    this.writePosition = 0;
    console.log('[AudioWindow] Buffer reset');
  }

  /**
   * Get buffer statistics for debugging
   */
  getStats(): {
    bufferSize: number;
    windowSize: number;
    writePosition: number;
    fillPercentage: number;
    sampleRate: number;
  } {
    return {
      bufferSize: this.bufferSize,
      windowSize: this.windowSize,
      writePosition: this.writePosition,
      fillPercentage: this.getBufferFillPercentage(),
      sampleRate: this.sampleRate,
    };
  }
}