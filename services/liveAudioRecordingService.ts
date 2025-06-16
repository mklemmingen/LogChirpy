/**
 * Live Audio Recording Service - whoBIRD Implementation
 * 
 * Based on whoBIRD guide: Implements continuous audio recording with circular buffer
 * - 48kHz, 16-bit PCM, mono audio recording
 * - Circular buffer for live classification
 * - 800ms inference intervals
 * - Raw Float32 audio input (NOT mel-spectrograms)
 * - GPS location integration for meta model
 */

import * as Location from 'expo-location';
import { fastTfliteBirdClassifier } from './fastTfliteBirdClassifier';
import { 
    RealTimeAudioRecorder, 
    createRealTimeAudioRecorder,
    type RealTimeAudioConfig,
    type AudioStreamSample 
} from './realTimeAudioRecorder';

export interface LiveAudioConfig {
    sampleRate: number;          // 48000 Hz (whoBIRD standard)
    channels: number;            // 1 (mono)
    bitDepth: number;           // 16-bit
    bufferSizeMs: number;       // 3000ms (3 seconds for BirdNET)
    inferenceIntervalMs: number; // 800ms (whoBIRD recommendation)
    enableLocationMeta: boolean; // Use GPS for meta model
    metaInfluence: number;      // 0-1, influence of meta model
}

export interface AudioBuffer {
    samples: Float32Array;
    timestamp: number;
    sampleRate: number;
    channels: number;
}

export interface LivePrediction {
    species: string;
    scientificName: string;
    confidence: number;
    timestamp: number;
    location?: { latitude: number; longitude: number };
    metaModelUsed: boolean;
}

export interface RecordingState {
    isRecording: boolean;
    isProcessing: boolean;
    bufferFull: boolean;
    totalPredictions: number;
    averageProcessingTime: number;
    currentLocation?: { latitude: number; longitude: number };
}

class LiveAudioRecordingService {
    private config: LiveAudioConfig = {
        sampleRate: 48000,    // 48kHz as per whoBIRD
        channels: 1,          // Mono
        bitDepth: 16,         // 16-bit PCM
        bufferSizeMs: 3000,   // 3 seconds for BirdNET
        inferenceIntervalMs: 800, // 800ms intervals
        enableLocationMeta: true,
        metaInfluence: 0.5
    };

    private audioRecorder: RealTimeAudioRecorder | null = null;
    private circularBuffer: Float32Array;
    private bufferWriteIndex = 0;
    private bufferSamples: number;
    private isInitialized = false;
    private isRecording = false;
    private isProcessing = false;
    private inferenceTimer: NodeJS.Timeout | null = null;
    private locationWatcher: Location.LocationSubscription | null = null;
    private currentLocation: { latitude: number; longitude: number } | null = null;

    // Performance tracking
    private totalInferences = 0;
    private totalProcessingTime = 0;
    private predictionCallbacks: Array<(prediction: LivePrediction) => void> = [];
    private stateCallbacks: Array<(state: RecordingState) => void> = [];

    constructor() {
        // Calculate buffer size in samples
        this.bufferSamples = Math.floor(
            (this.config.sampleRate * this.config.bufferSizeMs) / 1000
        );
        this.circularBuffer = new Float32Array(this.bufferSamples);
        
        console.log('LiveAudioRecordingService initialized:', {
            bufferSizeSamples: this.bufferSamples,
            bufferSizeMs: this.config.bufferSizeMs,
            sampleRate: this.config.sampleRate,
            inferenceInterval: this.config.inferenceIntervalMs
        });
    }

    /**
     * Initialize the live audio recording service
     */
    async initialize(): Promise<boolean> {
        try {
            console.log('Initializing live audio recording service...');

            // Create real-time audio recorder with whoBIRD configuration
            const audioConfig: RealTimeAudioConfig = {
                sampleRate: this.config.sampleRate as 48000,
                channels: 1,
                encoding: 'pcm_16bit',
                bufferSizeMs: this.config.bufferSizeMs,
                inferenceIntervalMs: this.config.inferenceIntervalMs,
                enableHighPass: true, // whoBIRD uses high-pass filtering
                streamInterval: 100 // Emit audio data every 100ms for responsiveness
            };

            this.audioRecorder = createRealTimeAudioRecorder(audioConfig);
            
            // Initialize the recorder with a mock hook for non-React usage
            // In React components, this would be replaced with useAudioRecorder
            const mockHook = {
                startRecording: async () => ({ fileUri: '', mimeType: 'audio/wav' }),
                stopRecording: async () => ({ fileUri: '', filename: '', durationMs: 0, size: 0, mimeType: 'audio/wav', channels: 1, bitDepth: 16, sampleRate: 48000 }),
                isRecording: false,
                isPaused: false,
                durationMs: 0,
                size: 0
            };
            this.audioRecorder.initializeWithHook(mockHook);

            // Set up audio stream callback
            this.audioRecorder.setAudioCallback(this.handleAudioStream.bind(this));
            
            // Set up state callback
            this.audioRecorder.setStateCallback((state) => {
                console.log('Audio recorder state:', state);
                this.notifyStateChange();
            });

            // Initialize the bird classifier
            const classifierReady = await fastTfliteBirdClassifier.initialize();
            if (!classifierReady) {
                throw new Error('Failed to initialize bird classifier');
            }

            this.isInitialized = true;
            console.log('Live audio recording service initialized successfully');
            return true;

        } catch (error) {
            console.error('Failed to initialize live audio recording:', error);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Start live audio recording with continuous classification
     */
    async startLiveRecording(hasLocationPermission: boolean = false): Promise<boolean> {
        try {
            if (!this.isInitialized) {
                throw new Error('Service not initialized. Call initialize() first.');
            }

            if (this.isRecording) {
                console.warn('Already recording');
                return true;
            }

            console.log('Starting live audio recording...');

            // Start location tracking if permission granted
            if (hasLocationPermission && this.config.enableLocationMeta) {
                await this.startLocationTracking();
            }

            // Start real-time audio recording
            const recordingStarted = await this.audioRecorder!.startRecording();
            if (!recordingStarted) {
                throw new Error('Failed to start real-time audio recording');
            }

            this.isRecording = true;
            console.log('Live recording started successfully');

            // Note: With real-time audio streaming, inference happens automatically
            // via the audio stream callback. We keep the timer as a fallback.
            this.startInferenceTimer();

            this.notifyStateChange();
            return true;

        } catch (error) {
            console.error('Failed to start live recording:', error);
            this.isRecording = false;
            this.notifyStateChange();
            return false;
        }
    }

    /**
     * Stop live audio recording
     */
    async stopLiveRecording(): Promise<void> {
        try {
            console.log('Stopping live audio recording...');

            // Stop inference timer
            if (this.inferenceTimer) {
                clearInterval(this.inferenceTimer);
                this.inferenceTimer = null;
            }

            // Stop real-time audio recording
            if (this.audioRecorder) {
                try {
                    await this.audioRecorder.stopRecording();
                    await this.audioRecorder.dispose();
                } catch (error) {
                    console.warn('Error stopping audio recorder:', error);
                }
                this.audioRecorder = null;
            }

            // Stop location tracking
            if (this.locationWatcher) {
                this.locationWatcher.remove();
                this.locationWatcher = null;
            }

            this.isRecording = false;
            this.isProcessing = false;
            console.log('Live recording stopped');

            this.notifyStateChange();

        } catch (error) {
            console.error('Error stopping live recording:', error);
        }
    }

    /**
     * Start GPS location tracking for meta model
     */
    private async startLocationTracking(): Promise<void> {
        try {
            console.log('Starting GPS location tracking for meta model...');

            // Get initial location
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            this.currentLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            };

            console.log('Initial location:', this.currentLocation);

            // Watch for location changes
            this.locationWatcher = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 30000, // Update every 30 seconds
                    distanceInterval: 100, // Update every 100 meters
                },
                (location) => {
                    this.currentLocation = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude
                    };
                    console.log('Location updated:', this.currentLocation);
                }
            );

        } catch (error) {
            console.warn('Failed to start location tracking:', error);
            this.currentLocation = null;
        }
    }

    /**
     * Start the inference timer for continuous classification
     */
    private startInferenceTimer(): void {
        this.inferenceTimer = setInterval(async () => {
            if (this.isRecording && !this.isProcessing) {
                await this.performInference();
            }
        }, this.config.inferenceIntervalMs);

        console.log(`Inference timer started: ${this.config.inferenceIntervalMs}ms intervals`);
    }

    /**
     * Handle real-time audio stream from native recorder
     * This replaces the periodic inference timer approach
     */
    private async handleAudioStream(sample: AudioStreamSample): Promise<void> {
        if (this.isProcessing || !sample.isValid) {
            return;
        }

        try {
            this.isProcessing = true;
            const startTime = Date.now();

            console.log('Processing audio stream:', {
                sampleCount: sample.sampleCount,
                sampleRate: sample.sampleRate,
                timestamp: sample.timestamp
            });

            // Use the samples directly from the real-time recorder
            // The RealTimeAudioRecorder already handles the circular buffer
            const audioSamples = sample.samples;

            if (audioSamples.length === 0) {
                console.log('No audio samples in stream');
                return;
            }

            // Update our local circular buffer (for compatibility)
            this.addSamplesToBuffer(audioSamples);

            // Run classification on the audio stream
            console.log('Running inference on real-time audio stream...');

            const result = await fastTfliteBirdClassifier.classifyBirdAudio(
                audioSamples,
                undefined, // No URI for live audio
                this.currentLocation || undefined
            );

            // Process results
            if (result.results.length > 0) {
                const topResult = result.results[0];
                const prediction: LivePrediction = {
                    species: topResult.species,
                    scientificName: topResult.scientificName,
                    confidence: topResult.confidence,
                    timestamp: sample.timestamp,
                    location: this.currentLocation || undefined,
                    metaModelUsed: result.metadata.metaModelUsed || false
                };

                console.log('Live prediction from real-time stream:', {
                    species: prediction.species,
                    confidence: Math.round(prediction.confidence * 100) + '%',
                    metaUsed: prediction.metaModelUsed,
                    streamTimestamp: sample.timestamp
                });

                // Notify callbacks
                this.notifyPrediction(prediction);
            }

            // Update performance metrics
            const processingTime = Date.now() - startTime;
            this.updatePerformanceMetrics(processingTime);

        } catch (error) {
            console.error('Audio stream inference failed:', error);
        } finally {
            this.isProcessing = false;
            this.notifyStateChange();
        }
    }

    /**
     * Perform bird classification on current buffer (legacy method)
     * Now primarily used for fallback scenarios
     */
    private async performInference(): Promise<void> {
        if (this.isProcessing || !this.audioRecorder?.isCurrentlyRecording()) {
            return;
        }

        // This method is now primarily for fallback
        // The main inference happens in handleAudioStream
        console.log('Legacy inference method called - audio stream should handle this');
    }

    /**
     * Extract audio samples from current recording using native-style processor
     * Based on whoBIRD implementation: AudioRecord → ShortArray → FloatBuffer
     * 
     * NOTE: This method is now deprecated in favor of real-time audio streaming.
     * The RealTimeAudioRecorder handles audio extraction via native callbacks.
     */
    private async extractAudioSamples(): Promise<Float32Array> {
        // With the new RealTimeAudioRecorder, audio samples are provided
        // directly via the handleAudioStream callback. This method is kept
        // for backwards compatibility but should not be the primary path.
        
        if (this.circularBuffer.length === 0) {
            console.warn('Circular buffer is empty - using real-time stream instead');
            return new Float32Array(0);
        }

        // Extract the current buffer state as Float32Array (whoBIRD style)
        const samples = new Float32Array(this.bufferSamples);
        
        // Copy from circular buffer with proper indexing
        for (let i = 0; i < this.bufferSamples; i++) {
            const bufferIndex = (this.bufferWriteIndex + i) % this.bufferSamples;
            samples[i] = this.circularBuffer[bufferIndex];
        }

        return samples;
    }

    /**
     * Add new audio samples to the circular buffer
     */
    private addSamplesToBuffer(samples: Float32Array): void {
        for (let i = 0; i < samples.length; i++) {
            this.circularBuffer[this.bufferWriteIndex % this.bufferSamples] = samples[i];
            this.bufferWriteIndex++;
        }
    }

    /**
     * Update performance metrics
     */
    private updatePerformanceMetrics(processingTime: number): void {
        this.totalInferences++;
        this.totalProcessingTime += processingTime;
        console.log(`Inference #${this.totalInferences}: ${processingTime}ms`);
    }

    /**
     * Subscribe to live predictions
     */
    onPrediction(callback: (prediction: LivePrediction) => void): () => void {
        this.predictionCallbacks.push(callback);
        return () => {
            const index = this.predictionCallbacks.indexOf(callback);
            if (index > -1) {
                this.predictionCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Subscribe to recording state changes
     */
    onStateChange(callback: (state: RecordingState) => void): () => void {
        this.stateCallbacks.push(callback);
        return () => {
            const index = this.stateCallbacks.indexOf(callback);
            if (index > -1) {
                this.stateCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Notify prediction callbacks
     */
    private notifyPrediction(prediction: LivePrediction): void {
        this.predictionCallbacks.forEach(callback => {
            try {
                callback(prediction);
            } catch (error) {
                console.warn('Prediction callback error:', error);
            }
        });
    }

    /**
     * Notify state change callbacks
     */
    private notifyStateChange(): void {
        const state: RecordingState = {
            isRecording: this.isRecording,
            isProcessing: this.isProcessing,
            bufferFull: this.bufferWriteIndex >= this.bufferSamples,
            totalPredictions: this.totalInferences,
            averageProcessingTime: this.totalInferences > 0 
                ? Math.round(this.totalProcessingTime / this.totalInferences) 
                : 0,
            currentLocation: this.currentLocation || undefined
        };

        this.stateCallbacks.forEach(callback => {
            try {
                callback(state);
            } catch (error) {
                console.warn('State callback error:', error);
            }
        });
    }

    /**
     * Get current recording state
     */
    getState(): RecordingState {
        return {
            isRecording: this.isRecording,
            isProcessing: this.isProcessing,
            bufferFull: this.bufferWriteIndex >= this.bufferSamples,
            totalPredictions: this.totalInferences,
            averageProcessingTime: this.totalInferences > 0 
                ? Math.round(this.totalProcessingTime / this.totalInferences) 
                : 0,
            currentLocation: this.currentLocation || undefined
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<LiveAudioConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('Live audio config updated:', newConfig);
    }

    /**
     * Cleanup and dispose
     */
    async dispose(): Promise<void> {
        await this.stopLiveRecording();
        this.predictionCallbacks = [];
        this.stateCallbacks = [];
        console.log('LiveAudioRecordingService disposed');
    }

    /**
     * Check if service is ready
     */
    isReady(): boolean {
        return this.isInitialized && fastTfliteBirdClassifier.isReady();
    }
}

// Export singleton instance
export const liveAudioRecordingService = new LiveAudioRecordingService();

// Convenience functions
export const initializeLiveAudio = () => liveAudioRecordingService.initialize();
export const startLiveRecording = (hasLocationPermission?: boolean) => 
    liveAudioRecordingService.startLiveRecording(hasLocationPermission);
export const stopLiveRecording = () => liveAudioRecordingService.stopLiveRecording();
export const getLiveAudioState = () => liveAudioRecordingService.getState();