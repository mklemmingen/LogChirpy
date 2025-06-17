/**
 * React Hook for whoBIRD-style Live Audio Recording
 * 
 * Integrates the RealTimeAudioRecorder with React components
 * for seamless live bird identification from audio
 */

import { useEffect, useState, useRef } from 'react';
import { useAudioRecorder } from '@siteed/expo-audio-studio';
// Note: Real-time audio services removed - this hook is deprecated
// Use ultraSimpleBirdClassifier directly instead

interface RealTimeAudioConfig {
    sampleRate: number;
    channels: number;
    encoding: string;
    bufferSizeMs: number;
    inferenceIntervalMs: number;
    enableHighPass: boolean;
    streamInterval: number;
}

interface AudioStreamSample {
    samples: Float32Array;
    timestamp: number;
    sampleCount: number;
    sampleRate: number;
    channels: number;
    isValid: boolean;
    bufferPosition: number;
}

interface LivePrediction {
    species: string;
    scientificName: string;
    confidence: number;
    timestamp: number;
    location?: { latitude: number; longitude: number };
    metaModelUsed: boolean;
}

interface RecordingState {
    isRecording: boolean;
    isProcessing: boolean;
    bufferFull: boolean;
    totalPredictions: number;
    averageProcessingTime: number;
}

export interface UseWhoBirdAudioOptions {
    /** Enable automatic start on mount */
    autoStart?: boolean;
    /** Enable GPS location for meta model */
    enableLocation?: boolean;
    /** Custom audio configuration */
    audioConfig?: Partial<RealTimeAudioConfig>;
    /** Prediction callback */
    onPrediction?: (prediction: LivePrediction) => void;
    /** Recording state callback */
    onStateChange?: (state: RecordingState) => void;
}

export interface UseWhoBirdAudioResult {
    /** Start live recording */
    startRecording: () => Promise<boolean>;
    /** Stop live recording */
    stopRecording: () => Promise<void>;
    /** Current recording state */
    recordingState: RecordingState;
    /** Latest prediction */
    latestPrediction: LivePrediction | null;
    /** All predictions from current session */
    predictions: LivePrediction[];
    /** Audio recorder instance for advanced usage */
    audioRecorder: any;
    /** Whether the service is ready */
    isReady: boolean;
    /** Performance metrics */
    metrics: {
        totalPredictions: number;
        averageProcessingTime: number;
        bufferFill: number;
    };
}

/**
 * React Hook for whoBIRD-style live audio recording and bird identification
 * 
 * @example
 * ```tsx
 * function BirdDetector() {
 *   const { 
 *     startRecording, 
 *     stopRecording, 
 *     recordingState, 
 *     predictions 
 *   } = useWhoBirdAudio({
 *     enableLocation: true,
 *     onPrediction: (prediction) => {
 *       console.log('Bird detected:', prediction.species, prediction.confidence);
 *     }
 *   });
 * 
 *   return (
 *     <View>
 *       <Button 
 *         title={recordingState.isRecording ? "Stop" : "Start"}
 *         onPress={recordingState.isRecording ? stopRecording : startRecording}
 *       />
 *       {predictions.map((pred, i) => (
 *         <Text key={i}>{pred.species} ({Math.round(pred.confidence * 100)}%)</Text>
 *       ))}
 *     </View>
 *   );
 * }
 * ```
 */
export function useWhoBirdAudio(options: UseWhoBirdAudioOptions = {}): UseWhoBirdAudioResult {
    const {
        autoStart = false,
        enableLocation = true,
        audioConfig = {},
        onPrediction,
        onStateChange
    } = options;

    // Audio recorder hook from expo-audio-studio
    const audioRecorderHook = useAudioRecorder({
        logger: console
    });

    // State management
    const [recordingState, setRecordingState] = useState<RecordingState>({
        isRecording: false,
        isProcessing: false,
        bufferFull: false,
        totalPredictions: 0,
        averageProcessingTime: 0
    });
    
    const [latestPrediction, setLatestPrediction] = useState<LivePrediction | null>(null);
    const [predictions, setPredictions] = useState<LivePrediction[]>([]);
    const [isReady, setIsReady] = useState(false);

    // Refs for cleanup
    const predictionUnsubscribeRef = useRef<(() => void) | null>(null);
    const stateUnsubscribeRef = useRef<(() => void) | null>(null);

    // Initialize the service
    useEffect(() => {
        let mounted = true;

        const initializeService = async () => {
            try {
                console.log('[useWhoBirdAudio] Initializing live audio service...');
                console.warn('useWhoBirdAudio: Live audio recording service removed. Use ultraSimpleBirdClassifier directly.');
                const initialized = false; // Service removed
                
                if (mounted) {
                    setIsReady(initialized);
                    console.log('[useWhoBirdAudio] Service initialized:', initialized);
                }
            } catch (error) {
                console.error('[useWhoBirdAudio] Initialization failed:', error);
                if (mounted) {
                    setIsReady(false);
                }
            }
        };

        initializeService();

        return () => {
            mounted = false;
        };
    }, []);

    // Set up prediction and state callbacks
    useEffect(() => {
        if (!isReady) return;

        // Subscribe to predictions
        predictionUnsubscribeRef.current = () => {}; // Service removed
        // Prediction subscription disabled - service removed

        // Subscribe to state changes
        stateUnsubscribeRef.current = () => {}; // Service removed
        // State change subscription disabled - service removed

        return () => {
            predictionUnsubscribeRef.current?.();
            stateUnsubscribeRef.current?.();
        };
    }, [isReady, onPrediction, onStateChange]);

    // Auto-start if requested
    useEffect(() => {
        if (autoStart && isReady && !recordingState.isRecording) {
            startRecording();
        }
    }, [autoStart, isReady]);

    // Recording control functions
    const startRecording = async (): Promise<boolean> => {
        try {
            console.log('[useWhoBirdAudio] Starting recording...');
            
            // Clear previous session data
            setPredictions([]);
            setLatestPrediction(null);
            
            console.warn('startRecording: Service removed. Use ultraSimpleBirdClassifier directly.');
            const success = false; // Service removed
            console.log('[useWhoBirdAudio] Recording started:', success);
            
            return success;
        } catch (error) {
            console.error('[useWhoBirdAudio] Failed to start recording:', error);
            return false;
        }
    };

    const stopRecording = async (): Promise<void> => {
        try {
            console.log('[useWhoBirdAudio] Stopping recording...');
            console.warn('stopRecording: Service removed.');
            // liveAudioRecordingService.stopLiveRecording(); // Service removed
            console.log('[useWhoBirdAudio] Recording stopped');
        } catch (error) {
            console.error('[useWhoBirdAudio] Failed to stop recording:', error);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            predictionUnsubscribeRef.current?.();
            stateUnsubscribeRef.current?.();
            console.warn('Cleanup: Service removed.');
            // liveAudioRecordingService.stopLiveRecording(); // Service removed
        };
    }, []);

    // Calculate metrics
    const metrics = {
        totalPredictions: predictions.length,
        averageProcessingTime: recordingState.averageProcessingTime,
        bufferFill: recordingState.bufferFull ? 100 : 0
    };

    return {
        startRecording,
        stopRecording,
        recordingState,
        latestPrediction,
        predictions,
        audioRecorder: audioRecorderHook,
        isReady,
        metrics
    };
}

/**
 * Simplified hook for basic bird detection
 * Just provides start/stop and latest prediction
 */
export function useSimpleBirdDetection() {
    const { startRecording, stopRecording, recordingState, latestPrediction } = useWhoBirdAudio();
    
    return {
        start: startRecording,
        stop: stopRecording,
        isRecording: recordingState.isRecording,
        detection: latestPrediction
    };
}