/**
 * Advanced Audio Filtering Service for Bird Recognition
 * 
 * This service provides comprehensive audio filtering specifically designed
 * to enhance bird call detection and reduce background noise that causes
 * false classifications (like "SIREN" with low confidence).
 */

export interface AudioFilterConfig {
    // High-pass filter to remove low-frequency noise
    highPassCutoff: number; // Hz
    
    // Low-pass filter to focus on bird frequency range
    lowPassCutoff: number; // Hz
    
    // Noise gate to eliminate quiet background noise
    noiseGateThreshold: number; // 0-1
    
    // Dynamic range compression to normalize bird calls
    compressionRatio: number; // 1-10
    compressionThreshold: number; // 0-1
    
    // Spectral noise reduction
    spectralReduction: boolean;
    
    // Adaptive gain control
    adaptiveGain: boolean;
    targetRMS: number; // 0-1
}

export const BIRD_OPTIMIZED_CONFIG: AudioFilterConfig = {
    // Most bird calls are above 500Hz, filter out low-frequency rumble
    highPassCutoff: 500,
    
    // Most bird calls are below 12kHz, filter out high-frequency noise
    lowPassCutoff: 12000,
    
    // Remove quiet background noise (adjust based on environment)
    noiseGateThreshold: 0.05,
    
    // Moderate compression to even out volume differences
    compressionRatio: 3.0,
    compressionThreshold: 0.3,
    
    // Enable advanced noise reduction
    spectralReduction: true,
    
    // Normalize audio levels for consistent ML processing
    adaptiveGain: true,
    targetRMS: 0.15
};

export class AudioFilter {
    private sampleRate: number;
    private config: AudioFilterConfig;
    
    // Filter state variables
    private highPassState: { x1: number; x2: number; y1: number; y2: number } = { x1: 0, x2: 0, y1: 0, y2: 0 };
    private lowPassState: { x1: number; x2: number; y1: number; y2: number } = { x1: 0, x2: 0, y1: 0, y2: 0 };
    private compressionState: { envelope: number } = { envelope: 0 };
    private noiseProfile: Float32Array | null = null;
    
    constructor(sampleRate: number, config: AudioFilterConfig = BIRD_OPTIMIZED_CONFIG) {
        this.sampleRate = sampleRate;
        this.config = config;
        this.resetFilterState();
    }
    
    /**
     * Apply comprehensive audio filtering optimized for bird recognition
     */
    public filterAudio(input: Float32Array): Float32Array {
        console.log('[AudioFilter] Starting audio filtering pipeline...');
        
        let filtered = new Float32Array(input);
        
        // 1. Pre-processing: Remove DC offset
        filtered = this.removeDCOffset(filtered);
        console.log('[AudioFilter] ✓ DC offset removed');
        
        // 2. High-pass filter: Remove low-frequency rumble and wind noise
        filtered = this.applyHighPassFilter(filtered);
        console.log('[AudioFilter] ✓ High-pass filter applied (cutoff: ' + this.config.highPassCutoff + 'Hz)');
        
        // 3. Low-pass filter: Remove high-frequency noise above bird range
        filtered = this.applyLowPassFilter(filtered);
        console.log('[AudioFilter] ✓ Low-pass filter applied (cutoff: ' + this.config.lowPassCutoff + 'Hz)');
        
        // 4. Spectral noise reduction: Remove consistent background noise
        if (this.config.spectralReduction) {
            filtered = this.applySpectralNoiseReduction(filtered);
            console.log('[AudioFilter] ✓ Spectral noise reduction applied');
        }
        
        // 5. Noise gate: Remove quiet background noise
        filtered = this.applyNoiseGate(filtered);
        console.log('[AudioFilter] ✓ Noise gate applied (threshold: ' + this.config.noiseGateThreshold + ')');
        
        // 6. Dynamic range compression: Normalize volume levels
        filtered = this.applyCompression(filtered);
        console.log('[AudioFilter] ✓ Compression applied (ratio: ' + this.config.compressionRatio + ')');
        
        // 7. Adaptive gain control: Normalize for ML processing
        if (this.config.adaptiveGain) {
            filtered = this.applyAdaptiveGain(filtered);
            console.log('[AudioFilter] ✓ Adaptive gain applied (target RMS: ' + this.config.targetRMS + ')');
        }
        
        // 8. Final limiting: Prevent clipping
        filtered = this.applyLimiter(filtered);
        console.log('[AudioFilter] ✓ Limiter applied');
        
        // Log filtering statistics
        const inputRMS = this.calculateRMS(input);
        const outputRMS = this.calculateRMS(filtered);
        const inputPeak = this.calculatePeak(input);
        const outputPeak = this.calculatePeak(filtered);
        
        console.log('[AudioFilter] Filtering complete:');
        console.log(`  Input RMS: ${(inputRMS * 100).toFixed(1)}%, Peak: ${(inputPeak * 100).toFixed(1)}%`);
        console.log(`  Output RMS: ${(outputRMS * 100).toFixed(1)}%, Peak: ${(outputPeak * 100).toFixed(1)}%`);
        console.log(`  Gain applied: ${(20 * Math.log10(outputRMS / Math.max(inputRMS, 0.001))).toFixed(1)} dB`);
        
        return filtered;
    }
    
    /**
     * Remove DC offset (constant bias) from audio signal
     */
    private removeDCOffset(input: Float32Array): Float32Array {
        // Calculate DC offset
        let dcOffset = 0;
        for (let i = 0; i < input.length; i++) {
            dcOffset += input[i];
        }
        dcOffset /= input.length;
        
        // Remove DC offset
        const output = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
            output[i] = input[i] - dcOffset;
        }
        
        return output;
    }
    
    /**
     * Apply high-pass filter to remove low-frequency noise
     * Uses 2nd order Butterworth filter
     */
    private applyHighPassFilter(input: Float32Array): Float32Array {
        const output = new Float32Array(input.length);
        const fc = this.config.highPassCutoff;
        const dt = 1.0 / this.sampleRate;
        
        // Calculate filter coefficients
        const rc = 1.0 / (2.0 * Math.PI * fc);
        const alpha = rc / (rc + dt);
        
        // Second-order high-pass filter coefficients
        const a = alpha * alpha;
        const b1 = 2.0 * a;
        const b2 = -a;
        const a1 = 2.0 * alpha - 1.0;
        const a2 = -(alpha - 1.0) * (alpha - 1.0);
        
        for (let i = 0; i < input.length; i++) {
            const x0 = input[i];
            
            // Apply filter equation: y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
            const y0 = a * x0 + b1 * this.highPassState.x1 + b2 * this.highPassState.x2 
                     - a1 * this.highPassState.y1 - a2 * this.highPassState.y2;
            
            output[i] = y0;
            
            // Update state
            this.highPassState.x2 = this.highPassState.x1;
            this.highPassState.x1 = x0;
            this.highPassState.y2 = this.highPassState.y1;
            this.highPassState.y1 = y0;
        }
        
        return output;
    }
    
    /**
     * Apply low-pass filter to remove high-frequency noise
     * Uses 2nd order Butterworth filter
     */
    private applyLowPassFilter(input: Float32Array): Float32Array {
        const output = new Float32Array(input.length);
        const fc = this.config.lowPassCutoff;
        const dt = 1.0 / this.sampleRate;
        
        // Calculate filter coefficients
        const rc = 1.0 / (2.0 * Math.PI * fc);
        const alpha = dt / (rc + dt);
        
        // Second-order low-pass filter coefficients
        const a = alpha * alpha;
        const b1 = 2.0 * a;
        const b2 = a;
        const a1 = 2.0 * alpha - 1.0;
        const a2 = (alpha - 1.0) * (alpha - 1.0);
        
        for (let i = 0; i < input.length; i++) {
            const x0 = input[i];
            
            // Apply filter equation
            const y0 = a * x0 + b1 * this.lowPassState.x1 + b2 * this.lowPassState.x2 
                     - a1 * this.lowPassState.y1 - a2 * this.lowPassState.y2;
            
            output[i] = y0;
            
            // Update state
            this.lowPassState.x2 = this.lowPassState.x1;
            this.lowPassState.x1 = x0;
            this.lowPassState.y2 = this.lowPassState.y1;
            this.lowPassState.y1 = y0;
        }
        
        return output;
    }
    
    /**
     * Apply spectral noise reduction using simple spectral subtraction
     */
    private applySpectralNoiseReduction(input: Float32Array): Float32Array {
        // For real-time processing, we use a simplified spectral noise reduction
        // This estimates noise from quiet sections and reduces it
        
        // Estimate noise floor from quietest 10% of samples
        const sortedMagnitudes = Array.from(input).map(Math.abs).sort((a, b) => a - b);
        const noiseFloor = sortedMagnitudes[Math.floor(sortedMagnitudes.length * 0.1)];
        
        const output = new Float32Array(input.length);
        const reductionFactor = 0.3; // Reduce noise by 70%
        
        for (let i = 0; i < input.length; i++) {
            const magnitude = Math.abs(input[i]);
            
            if (magnitude > noiseFloor * 2) {
                // Signal is likely above noise floor
                output[i] = input[i];
            } else {
                // Reduce noise component
                output[i] = input[i] * reductionFactor;
            }
        }
        
        return output;
    }
    
    /**
     * Apply noise gate to remove quiet background noise
     */
    private applyNoiseGate(input: Float32Array): Float32Array {
        const output = new Float32Array(input.length);
        const threshold = this.config.noiseGateThreshold;
        const attackTime = 0.001; // 1ms attack
        const releaseTime = 0.01;  // 10ms release
        
        let gateState = 0; // 0 = closed, 1 = open
        const attackSamples = Math.floor(attackTime * this.sampleRate);
        const releaseSamples = Math.floor(releaseTime * this.sampleRate);
        
        for (let i = 0; i < input.length; i++) {
            const magnitude = Math.abs(input[i]);
            
            // Gate logic
            if (magnitude > threshold) {
                // Open gate gradually
                gateState = Math.min(1, gateState + 1 / attackSamples);
            } else {
                // Close gate gradually
                gateState = Math.max(0, gateState - 1 / releaseSamples);
            }
            
            output[i] = input[i] * gateState;
        }
        
        return output;
    }
    
    /**
     * Apply dynamic range compression
     */
    private applyCompression(input: Float32Array): Float32Array {
        const output = new Float32Array(input.length);
        const threshold = this.config.compressionThreshold;
        const ratio = this.config.compressionRatio;
        const attackTime = 0.003; // 3ms
        const releaseTime = 0.1;   // 100ms
        
        const attackCoeff = Math.exp(-1 / (attackTime * this.sampleRate));
        const releaseCoeff = Math.exp(-1 / (releaseTime * this.sampleRate));
        
        for (let i = 0; i < input.length; i++) {
            const inputLevel = Math.abs(input[i]);
            
            // Update envelope detector
            if (inputLevel > this.compressionState.envelope) {
                this.compressionState.envelope = inputLevel + (this.compressionState.envelope - inputLevel) * attackCoeff;
            } else {
                this.compressionState.envelope = inputLevel + (this.compressionState.envelope - inputLevel) * releaseCoeff;
            }
            
            // Calculate compression gain
            let gainReduction = 1.0;
            if (this.compressionState.envelope > threshold) {
                const overThreshold = this.compressionState.envelope - threshold;
                const compressedOverThreshold = overThreshold / ratio;
                gainReduction = (threshold + compressedOverThreshold) / this.compressionState.envelope;
            }
            
            output[i] = input[i] * gainReduction;
        }
        
        return output;
    }
    
    /**
     * Apply adaptive gain control to normalize audio levels
     */
    private applyAdaptiveGain(input: Float32Array): Float32Array {
        const currentRMS = this.calculateRMS(input);
        
        if (currentRMS < 0.001) {
            // Audio is too quiet, return as-is to avoid amplifying noise
            return new Float32Array(input);
        }
        
        const targetRMS = this.config.targetRMS;
        const gainFactor = targetRMS / currentRMS;
        
        // Limit gain to prevent excessive amplification
        const maxGain = 10.0; // 20dB max gain
        const limitedGain = Math.min(gainFactor, maxGain);
        
        const output = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
            output[i] = input[i] * limitedGain;
        }
        
        return output;
    }
    
    /**
     * Apply limiter to prevent clipping
     */
    private applyLimiter(input: Float32Array): Float32Array {
        const output = new Float32Array(input.length);
        const limit = 0.95; // Prevent clipping with some headroom
        
        for (let i = 0; i < input.length; i++) {
            if (input[i] > limit) {
                output[i] = limit;
            } else if (input[i] < -limit) {
                output[i] = -limit;
            } else {
                output[i] = input[i];
            }
        }
        
        return output;
    }
    
    /**
     * Calculate RMS (Root Mean Square) level
     */
    private calculateRMS(input: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < input.length; i++) {
            sum += input[i] * input[i];
        }
        return Math.sqrt(sum / input.length);
    }
    
    /**
     * Calculate peak level
     */
    private calculatePeak(input: Float32Array): number {
        let peak = 0;
        for (let i = 0; i < input.length; i++) {
            const abs = Math.abs(input[i]);
            if (abs > peak) {
                peak = abs;
            }
        }
        return peak;
    }
    
    /**
     * Reset filter state (call between different audio clips)
     */
    public resetFilterState(): void {
        this.highPassState = { x1: 0, x2: 0, y1: 0, y2: 0 };
        this.lowPassState = { x1: 0, x2: 0, y1: 0, y2: 0 };
        this.compressionState = { envelope: 0 };
        this.noiseProfile = null;
        console.log('[AudioFilter] Filter state reset');
    }
    
    /**
     * Analyze audio and suggest optimal filter settings
     */
    public analyzeAudio(input: Float32Array): {
        suggestedConfig: Partial<AudioFilterConfig>;
        analysis: {
            rmsLevel: number;
            peakLevel: number;
            spectralCentroid: number;
            dynamicRange: number;
            noiseFloor: number;
        };
    } {
        const rmsLevel = this.calculateRMS(input);
        const peakLevel = this.calculatePeak(input);
        const dynamicRange = peakLevel / Math.max(rmsLevel, 0.001);
        
        // Calculate spectral centroid (simplified)
        let weightedSum = 0;
        let magnitudeSum = 0;
        for (let i = 0; i < Math.min(input.length, 1024); i++) {
            const magnitude = Math.abs(input[i]);
            const frequency = (i / 1024) * (this.sampleRate / 2);
            weightedSum += magnitude * frequency;
            magnitudeSum += magnitude;
        }
        const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
        
        // Estimate noise floor
        const sortedMagnitudes = Array.from(input).map(Math.abs).sort((a, b) => a - b);
        const noiseFloor = sortedMagnitudes[Math.floor(sortedMagnitudes.length * 0.1)];
        
        // Suggest optimal settings based on analysis
        const suggestedConfig: Partial<AudioFilterConfig> = {};
        
        if (spectralCentroid < 2000) {
            // Low-frequency content, increase high-pass cutoff
            suggestedConfig.highPassCutoff = 800;
        }
        
        if (rmsLevel < 0.05) {
            // Quiet audio, reduce noise gate threshold
            suggestedConfig.noiseGateThreshold = Math.max(0.01, noiseFloor * 2);
        }
        
        if (dynamicRange > 10) {
            // High dynamic range, increase compression
            suggestedConfig.compressionRatio = 4.0;
        }
        
        return {
            suggestedConfig,
            analysis: {
                rmsLevel,
                peakLevel,
                spectralCentroid,
                dynamicRange,
                noiseFloor
            }
        };
    }
}

/**
 * Convenience function to apply bird-optimized filtering with app config
 */
export function filterAudioForBirds(input: Float32Array, sampleRate: number = 48000): Float32Array {
    // Import config here to avoid circular dependencies
    const { Config } = require('../constants/config');
    
    if (!Config.audioFilter.enabled) {
        console.log('[AudioFilter] Audio filtering disabled in config');
        return input;
    }
    
    // Adjust configuration based on app settings
    const config = { ...BIRD_OPTIMIZED_CONFIG };
    
    // Adjust noise sensitivity
    const sensitivity = Config.audioFilter.noiseSensitivity;
    config.noiseGateThreshold = 0.02 + (sensitivity * 0.08); // 0.02-0.10 range
    config.compressionRatio = 2.0 + (sensitivity * 2.0);     // 2.0-4.0 range
    
    // Adjust for bird frequency mode
    if (Config.audioFilter.birdFrequencyMode) {
        config.highPassCutoff = 500 + (sensitivity * 300);   // 500-800 Hz
        config.lowPassCutoff = 12000 - (sensitivity * 2000); // 10000-12000 Hz
        config.spectralReduction = true;
    } else {
        config.highPassCutoff = 200;  // More permissive
        config.lowPassCutoff = 16000; // Wider frequency range
        config.spectralReduction = sensitivity > 0.5;
    }
    
    console.log('[AudioFilter] Using adaptive config:', {
        sensitivity: sensitivity.toFixed(2),
        birdMode: Config.audioFilter.birdFrequencyMode,
        highPass: config.highPassCutoff + 'Hz',
        lowPass: config.lowPassCutoff + 'Hz',
        noiseGate: config.noiseGateThreshold.toFixed(3)
    });
    
    const filter = new AudioFilter(sampleRate, config);
    return filter.filterAudio(input);
}

/**
 * Convenience function with custom config
 */
export function filterAudioWithConfig(
    input: Float32Array, 
    sampleRate: number, 
    config: Partial<AudioFilterConfig>
): Float32Array {
    const fullConfig = { ...BIRD_OPTIMIZED_CONFIG, ...config };
    const filter = new AudioFilter(sampleRate, fullConfig);
    return filter.filterAudio(input);
}