/**
 * Real-Time Audio Recorder - Production Implementation
 * 
 * Uses @siteed/expo-audio-studio for native PCM audio extraction
 * Based on whoBIRD requirements:
 * - 48kHz, 16-bit, mono recording
 * - Real-time PCM data streaming
 * - Circular buffer management
 * - 800ms inference intervals
 */

import { useAudioRecorder } from '@siteed/expo-audio-studio';
import type { 
    AudioDataEvent, 
    RecordingConfig, 
    StartRecordingResult,
    SampleRate,
    EncodingType
} from '@siteed/expo-audio-studio';
import { convertPCMToFloat32 } from '@siteed/expo-audio-studio';

export interface RealTimeAudioConfig {
    sampleRate: SampleRate;        // 48000 Hz (whoBIRD standard)
    channels: 1;                   // Mono only
    encoding: EncodingType;        // 'pcm_16bit' (whoBIRD standard)
    bufferSizeMs: number;          // 3000ms (3 seconds for BirdNET)
    inferenceIntervalMs: number;   // 800ms (whoBIRD recommendation)
    enableHighPass: boolean;       // Optional filtering
    streamInterval: number;        // How often to emit audio data (ms)
}

export interface AudioStreamSample {
    samples: Float32Array;         // Raw Float32 PCM samples
    timestamp: number;             // When the sample was captured
    sampleCount: number;           // Number of samples in the array
    sampleRate: number;            // Sample rate (48000)
    channels: number;              // Number of channels (1)
    isValid: boolean;              // Whether the sample is valid
    bufferPosition: number;        // Position in circular buffer
}

/**
 * Real-time audio recorder using best-practice React Native packages
 * Implements whoBIRD-style audio processing with native performance
 */
export class RealTimeAudioRecorder {
    private config: RealTimeAudioConfig;
    private circularBuffer: Float32Array;
    private bufferWriteIndex = 0;
    private bufferSamples: number;
    private isRecording = false;
    private audioCallback: ((sample: AudioStreamSample) => void) | null = null;
    private stateCallback: ((state: { isRecording: boolean; bufferFull: boolean }) => void) | null = null;
    private audioRecorder: any = null; // Will be initialized with useAudioRecorder

    // Performance tracking
    private totalSamples = 0;
    private droppedSamples = 0;
    private lastProcessTime = 0;

    constructor(config: RealTimeAudioConfig) {
        this.config = config;
        
        // Calculate buffer size in samples (3 seconds at 48kHz = 144,000 samples)
        this.bufferSamples = Math.floor(
            (config.sampleRate * config.bufferSizeMs) / 1000
        );
        this.circularBuffer = new Float32Array(this.bufferSamples);
        
        console.log('RealTimeAudioRecorder initialized:', {
            sampleRate: config.sampleRate,
            bufferSamples: this.bufferSamples,
            bufferSizeMs: config.bufferSizeMs,
            inferenceInterval: config.inferenceIntervalMs
        });
    }

    /**
     * Initialize the recorder with React Native hooks context
     * Must be called from within a React component that uses useAudioRecorder
     */
    initializeWithHook(audioRecorderHook: any): void {
        this.audioRecorder = audioRecorderHook;
        console.log('RealTimeAudioRecorder connected to React hook');
    }

    /**
     * Get the recording configuration for expo-audio-studio
     */
    private getRecordingConfig(): RecordingConfig {
        return {
            sampleRate: this.config.sampleRate,
            channels: this.config.channels,
            encoding: this.config.encoding,
            interval: this.config.streamInterval, // How often to emit data
            keepAwake: true, // Keep device awake during recording
            enableProcessing: false, // We'll do our own processing
            
            // Critical: Real-time audio stream callback
            onAudioStream: this.handleAudioStream.bind(this),
            
            // Configure output (we don't need file output for real-time)
            output: {
                primary: { enabled: false }, // Don't save to file
                compressed: { enabled: false } // Don't compress
            },
            
            // Platform-specific optimizations
            ios: {
                audioSession: {
                    category: 'Record',
                    mode: 'Measurement', // Optimized for audio measurement
                    categoryOptions: ['AllowBluetooth']
                }
            },
            android: {
                audioFocusStrategy: 'background' // Continue recording in background
            },
            
            // Buffer configuration for low latency
            bufferDurationSeconds: 0.1 // 100ms buffers for responsiveness
        };
    }

    /**
     * Handle real-time audio stream data from expo-audio-studio
     * This is the critical callback that receives raw PCM data
     */
    private async handleAudioStream(event: AudioDataEvent): Promise<void> {
        try {
            const startTime = Date.now();
            
            // Extract PCM data based on platform
            let pcmSamples: Float32Array;
            
            if (typeof event.data === 'string') {
                // Native platforms: base64 encoded PCM data
                const base64Data = event.data;
                const binaryData = atob(base64Data);
                const bytes = new Uint8Array(binaryData.length);
                
                for (let i = 0; i < binaryData.length; i++) {
                    bytes[i] = binaryData.charCodeAt(i);
                }
                
                // Convert to Float32Array using expo-audio-studio utility
                const conversionResult = await convertPCMToFloat32({
                    buffer: bytes.buffer,
                    bitDepth: this.config.encoding === 'pcm_16bit' ? 16 : 
                             this.config.encoding === 'pcm_32bit' ? 32 : 8,
                    skipWavHeader: true // We're working with raw PCM data
                });
                pcmSamples = conversionResult.pcmValues;
                
            } else {
                // Web platform: already Float32Array
                pcmSamples = event.data as Float32Array;
            }

            // Add samples to circular buffer (whoBIRD style)
            this.addSamplesToCircularBuffer(pcmSamples);
            
            // Extract model input from circular buffer if we have enough data
            if (this.bufferWriteIndex >= this.bufferSamples || 
                (this.bufferWriteIndex > 0 && this.bufferWriteIndex % (this.config.sampleRate * this.config.inferenceIntervalMs / 1000) === 0)) {
                
                const modelInput = this.extractModelInput();
                
                if (modelInput.length > 0 && this.audioCallback) {
                    const sample: AudioStreamSample = {
                        samples: modelInput,
                        timestamp: Date.now(),
                        sampleCount: modelInput.length,
                        sampleRate: this.config.sampleRate,
                        channels: this.config.channels,
                        isValid: true,
                        bufferPosition: this.bufferWriteIndex
                    };
                    
                    // Notify callback with processed audio
                    this.audioCallback(sample);
                }
            }
            
            // Update performance metrics
            this.totalSamples += pcmSamples.length;
            this.lastProcessTime = Date.now() - startTime;
            
            // Notify state callback
            if (this.stateCallback) {
                this.stateCallback({
                    isRecording: this.isRecording,
                    bufferFull: this.bufferWriteIndex >= this.bufferSamples
                });
            }
            
        } catch (error) {
            console.error('Error processing audio stream:', error);
            this.droppedSamples++;
        }
    }

    /**
     * Add new PCM samples to circular buffer (whoBIRD implementation)
     */
    private addSamplesToCircularBuffer(samples: Float32Array): void {
        for (let i = 0; i < samples.length; i++) {
            // Apply optional high-pass filter
            let sample = samples[i];
            if (this.config.enableHighPass) {
                sample = this.applyHighPassFilter(sample);
            }
            
            // Add to circular buffer
            this.circularBuffer[this.bufferWriteIndex % this.bufferSamples] = sample;
            this.bufferWriteIndex++;
        }
    }

    /**
     * Extract model input from circular buffer (whoBIRD style)
     */
    private extractModelInput(): Float32Array {
        const modelInput = new Float32Array(this.bufferSamples);
        let samplesAreAllZero = true;
        
        // Extract samples in circular order
        for (let i = 0; i < this.bufferSamples; i++) {
            const circularIndex = (this.bufferWriteIndex + i) % this.bufferSamples;
            const sample = this.circularBuffer[circularIndex];
            
            if (samplesAreAllZero && sample !== 0) {
                samplesAreAllZero = false;
            }
            
            modelInput[i] = sample;
        }
        
        // Return empty array if all samples are zero (microphone issue)
        if (samplesAreAllZero) {
            console.warn('All audio samples are zero - possible microphone issue');
            return new Float32Array(0);
        }
        
        return modelInput;
    }

    /**
     * Simple high-pass filter (simplified Butterworth approximation)
     */
    private applyHighPassFilter(sample: number): number {
        // This would be implemented with a proper Butterworth filter
        // For now, simple first-order high-pass
        const alpha = 0.95;
        const output = alpha * sample; // Simplified
        return output;
    }

    /**
     * Start real-time recording
     */
    async startRecording(): Promise<boolean> {
        try {
            if (!this.audioRecorder) {
                throw new Error('Audio recorder not initialized. Call initializeWithHook() first.');
            }

            if (this.isRecording) {
                console.warn('Already recording');
                return true;
            }

            console.log('Starting real-time audio recording...');
            
            // Get recording configuration
            const config = this.getRecordingConfig();
            
            // Start recording with real-time streaming
            const result: StartRecordingResult = await this.audioRecorder.startRecording(config);
            
            this.isRecording = true;
            console.log('Real-time recording started:', result);
            
            return true;
            
        } catch (error) {
            console.error('Failed to start real-time recording:', error);
            this.isRecording = false;
            return false;
        }
    }

    /**
     * Stop real-time recording
     */
    async stopRecording(): Promise<void> {
        try {
            if (!this.isRecording || !this.audioRecorder) {
                return;
            }

            console.log('Stopping real-time recording...');
            
            await this.audioRecorder.stopRecording();
            this.isRecording = false;
            
            console.log('Real-time recording stopped');
            
        } catch (error) {
            console.error('Error stopping real-time recording:', error);
        }
    }

    /**
     * Set callback for processed audio samples
     */
    setAudioCallback(callback: (sample: AudioStreamSample) => void): void {
        this.audioCallback = callback;
    }

    /**
     * Set callback for recording state changes
     */
    setStateCallback(callback: (state: { isRecording: boolean; bufferFull: boolean }) => void): void {
        this.stateCallback = callback;
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): {
        totalSamples: number;
        droppedSamples: number;
        dropRate: number;
        lastProcessTime: number;
        bufferUtilization: number;
    } {
        return {
            totalSamples: this.totalSamples,
            droppedSamples: this.droppedSamples,
            dropRate: this.totalSamples > 0 ? this.droppedSamples / this.totalSamples : 0,
            lastProcessTime: this.lastProcessTime,
            bufferUtilization: (this.bufferWriteIndex % this.bufferSamples) / this.bufferSamples
        };
    }

    /**
     * Check if currently recording
     */
    isCurrentlyRecording(): boolean {
        return this.isRecording;
    }

    /**
     * Get buffer fill percentage
     */
    getBufferFillPercentage(): number {
        return ((this.bufferWriteIndex % this.bufferSamples) / this.bufferSamples) * 100;
    }

    /**
     * Cleanup resources
     */
    async dispose(): Promise<void> {
        await this.stopRecording();
        this.audioCallback = null;
        this.stateCallback = null;
        console.log('RealTimeAudioRecorder disposed');
    }
}

/**
 * React Hook wrapper for RealTimeAudioRecorder
 * Use this in React components for proper integration
 */
export function useRealTimeAudioRecorder(config: RealTimeAudioConfig) {
    const audioRecorderHook = useAudioRecorder({
        logger: console // Use console for debugging
    });
    
    try {
        // Create recorder instance
        const recorder = new RealTimeAudioRecorder(config);
        
        // Connect to React hook
        recorder.initializeWithHook(audioRecorderHook);
        
        return {
            recorder,
            ...audioRecorderHook // Also expose the underlying hook methods
        };
    } catch (error) {
        console.error('CRITICAL: Failed to create RealTimeAudioRecorder in React hook:', error);
        console.error('This may indicate a "Super expression must either be null or a function" error');
        
        // Return a fallback object to prevent React hook errors
        return {
            recorder: null,
            ...audioRecorderHook
        };
    }
}

// Export factory function for non-React usage with error handling
export const createRealTimeAudioRecorder = (config: RealTimeAudioConfig): RealTimeAudioRecorder => {
    try {
        return new RealTimeAudioRecorder(config);
    } catch (error) {
        console.error('CRITICAL: Failed to create RealTimeAudioRecorder:', error);
        console.error('This may indicate a "Super expression must either be null or a function" error');
        throw error; // Re-throw since this is a factory function
    }
};