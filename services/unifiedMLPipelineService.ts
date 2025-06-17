/**
 * Unified ML Pipeline Service
 * 
 * Orchestrates sequential image and audio ML processing for ObjectIdentCamera.
 * Eliminates race conditions by running operations in a single, controlled pipeline.
 * Provides callbacks for UI updates at each stage.
 */

import { Camera } from 'react-native-vision-camera';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Config } from '@/constants/config';
import { 
    classifyBirdAudioForPipeline as classifyBirdAudio,
    initializeBirdClassifier as initAudioML
} from './ultraSimpleBirdClassifier';
import * as ImageManipulator from 'expo-image-manipulator';

// Core interfaces
export interface Detection {
    frame: { origin: { x: number; y: number }; size: { x: number; y: number } };
    labels: { text: string; confidence: number; index: number }[];
}

export interface AudioPrediction {
    common_name: string;
    scientific_name: string;
    confidence: number;
    index: number;
    assetUrl?: string;
}

export type PipelineState = 
    | 'idle' 
    | 'capturing_image' 
    | 'detecting_objects' 
    | 'classifying_objects' 
    | 'recording_audio' 
    | 'processing_audio' 
    | 'waiting';

export interface PipelineCallbacks {
    // Image ML callbacks
    onImageDetections: (detections: Detection[], imageDims?: { width: number; height: number }) => void;
    onImageProcessingStart: () => void;
    onImageProcessingEnd: () => void;
    onHighConfidenceSave?: () => void;
    
    // Audio ML callbacks
    onAudioPredictions: (predictions: AudioPrediction[]) => void;
    onAudioProcessingStart: () => void;
    onAudioProcessingEnd: () => void;
    
    // General callbacks
    onError: (phase: 'image' | 'audio', error: Error) => void;
    onStateChange: (state: PipelineState) => void;
}

export interface PipelineConfig {
    cameraRef: React.RefObject<Camera>;
    detector: any; // MLKit object detector
    classifier: any; // MLKit image classifier
    hasAudioPermission: boolean;
    hasLocationPermission: boolean;
    location?: { latitude: number; longitude: number };
}

export class UnifiedMLPipelineService {
    private isActive = false;
    private state: PipelineState = 'idle';
    private callbacks: PipelineCallbacks | null = null;
    private config: PipelineConfig;
    private audioRecording: Audio.Recording | null = null;
    private isCapturing = false;
    private lastPhotoUri: string | null = null;

    private static isAnyRecordingActive = false; // Global state

    constructor(config: PipelineConfig) {
        this.config = config;
    }

    setCallbacks(callbacks: PipelineCallbacks): void {
        this.callbacks = callbacks;
    }

    async start(): Promise<void> {
        if (this.isActive) {
            console.log('[UnifiedPipeline] Already running');
            return;
        }

        console.log('[UnifiedPipeline] Starting unified ML pipeline...');
        this.isActive = true;
        
        // Initialize audio ML if needed
        if (this.config.hasAudioPermission) {
            await initAudioML();
        }
        
        // Start the pipeline loop
        this.runPipelineLoop().catch(error => {
            console.error('[UnifiedPipeline] Fatal error:', error);
            this.stop();
        });
    }

    async stop(): Promise<void> {
        console.log('[UnifiedPipeline] Stopping unified ML pipeline...');
        this.isActive = false;
        
        // Clean up any active recording
        if (this.audioRecording) {
            try {
                const status = await this.audioRecording.getStatusAsync();
                if (status.canRecord || status.isRecording) {
                    await this.audioRecording.stopAndUnloadAsync();
                }
            } catch (error) {
                console.warn('[UnifiedPipeline] Audio cleanup error:', error);
            }
            this.audioRecording = null;
        }
        
        this.updateState('idle');
    }

    private updateState(state: PipelineState): void {
        this.state = state;
        this.callbacks?.onStateChange(state);
    }

    private async runPipelineLoop(): Promise<void> {

        // Add a flag to prevent overlapping cycles
        let isProcessing = false;

        while (this.isActive) {
            if (isProcessing) {
                console.log('[UnifiedPipeline] Previous cycle still processing, skipping...');
                await this.delay(1000);
                continue;
            }

            isProcessing = true;
            try {

                console.log('[UnifiedPipeline] Starting main pipeline loop...');
                let cycleCount = 0;

                while (this.isActive) {
                    cycleCount++;
                    const cycleStartTime = Date.now();
                    console.log(`[UnifiedPipeline] === CYCLE ${cycleCount} START ===`);

                    try {
                        // === IMAGE PROCESSING PHASE ===
                        console.log('[UnifiedPipeline] Starting image processing phase...');
                        await this.processImagePhase();

                        // Small delay between phases to prevent resource conflicts
                        console.log('[UnifiedPipeline] Inter-phase delay (300ms)...');
                        await this.delay(300);

                        // === AUDIO PROCESSING PHASE ===
                        if (this.config.hasAudioPermission) {
                            console.log('[UnifiedPipeline] Starting audio processing phase...');
                            await this.processAudioPhase();
                        } else {
                            console.log('[UnifiedPipeline] Skipping audio phase (no permission)');
                        }

                        // === WAIT PHASE ===
                        this.updateState('waiting');
                        const waitTime = Config.camera.pipelineDelay * 1000;
                        const cycleTime = Date.now() - cycleStartTime;
                        console.log(`[UnifiedPipeline] === CYCLE ${cycleCount} COMPLETE (${cycleTime}ms) ===`);
                        console.log(`[UnifiedPipeline] Waiting ${waitTime}ms before next cycle...`);
                        await this.delay(waitTime);

                    } catch (error) {
                        console.error(`[UnifiedPipeline] ❌ Cycle ${cycleCount} error:`, error);
                        console.error('[UnifiedPipeline] Loop error stack:', (error as Error)?.stack);
                        // Continue the loop even on error
                        console.log('[UnifiedPipeline] Recovering from error, waiting 1s...');
                        await this.delay(1000);
                    }
                }

                console.log(`[UnifiedPipeline] Pipeline loop stopped after ${cycleCount} cycles`);

            } finally {
                isProcessing = false;
            }
        }
    }

    private async processImagePhase(): Promise<void> {
        console.log('[UnifiedPipeline] === IMAGE PHASE START ===');
        
        if (!this.config.cameraRef.current) {
            console.log('[UnifiedPipeline] ❌ Camera ref not available');
            return;
        }
        
        if (!this.config.detector) {
            console.log('[UnifiedPipeline] ❌ Object detector not available');
            return;
        }
        
        if (!this.config.classifier) {
            console.log('[UnifiedPipeline] ❌ Image classifier not available');
            return;
        }

        if (this.isCapturing) {
            console.log('[UnifiedPipeline] ⏸Already capturing, skipping image phase');
            return;
        }

        console.log('[UnifiedPipeline] All ML components ready, starting image processing');
        this.callbacks?.onImageProcessingStart();
        this.isCapturing = true;
        
        try {
            // Step 1: Capture Photo with expo-image-manipulator approach
            this.updateState('capturing_image');
            console.log('[UnifiedPipeline] Step 1: Capturing photo...');
            const captureStartTime = Date.now();
            
            const photo = await this.config.cameraRef.current.takePhoto({
                flash: 'off',
                enableShutterSound: false,
            });
            
            if (!photo?.path) {
                throw new Error('No photo path returned from camera');
            }
            
            console.log('Camera photo captured:', photo.path);
            
            // Apply image manipulations (compression, format, etc.)
            const manipResult = await ImageManipulator.manipulateAsync(
                photo.path,
                [],
                { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG }
            );
            
            // Store image dimensions for UI coordinate scaling
            const imageDims = { width: manipResult.width, height: manipResult.height };
            console.log(`Image dimensions: ${imageDims.width}x${imageDims.height}`);
            
            // Save manipulated image to document directory
            let savedPhotoPath: string;
            try {
                const fileName = `photo_${Date.now()}.jpg`;
                const destPath = `${FileSystem.documentDirectory}${fileName}`;
                
                // Copy the manipulated image to document directory
                await FileSystem.copyAsync({
                    from: manipResult.uri,
                    to: destPath
                });
                
                console.log('Photo saved to document directory:', destPath);
                savedPhotoPath = destPath;
                
                // Delete previous photo file (cleanup) if it exists
                if (this.lastPhotoUri) {
                    try {
                        const fileInfo = await FileSystem.getInfoAsync(this.lastPhotoUri);
                        if (fileInfo.exists) {
                            await FileSystem.deleteAsync(this.lastPhotoUri);
                            console.log('Deleted previous photo:', this.lastPhotoUri);
                        }
                    } catch (deleteError) {
                        console.warn('Error deleting previous photo:', deleteError);
                    }
                }
                
                this.lastPhotoUri = savedPhotoPath;
                
            } catch (copyError: unknown) {
                console.error('Error copying photo to document directory:', copyError);
                throw copyError;
            }
            
            const captureTime = Date.now() - captureStartTime;
            console.log(`[UnifiedPipeline] Capture completed in ${captureTime}ms`);
            console.log(`[UnifiedPipeline] Photo URI: ${savedPhotoPath}`);

            // Step 2: Detect Objects
            this.updateState('detecting_objects');
            console.log('[UnifiedPipeline] 🔍 Step 2: Starting object detection...');
            const detectStartTime = Date.now();
            
            const imagePath = savedPhotoPath;
            console.log(`[UnifiedPipeline] 🔍 Detection input: ${imagePath}`);
            
            const objects = await this.config.detector.detectObjects(imagePath);
            const detectTime = Date.now() - detectStartTime;
            console.log(`[UnifiedPipeline] Object detection completed in ${detectTime}ms`);
            console.log(`[UnifiedPipeline] Found ${objects.length} objects`);

            // Step 3: Classify Objects
            this.updateState('classifying_objects');
            console.log('[UnifiedPipeline] Step 3: Starting object classification...');
            console.log(`[UnifiedPipeline] Processing ${objects.length} objects for classification`);
            const classifyStartTime = Date.now();
            
            const enrichedDetections: Detection[] = [];
            
            for (const [index, obj] of objects.entries()) {
                console.log(`[UnifiedPipeline] Processing object ${index + 1}/${objects.length}`);
                
                if (!obj.frame || !obj.frame.origin || !obj.frame.size) {
                    console.warn(`[UnifiedPipeline] ❌ Invalid frame for object ${index}:`, obj);
                    continue;
                }
                
                console.log(`[UnifiedPipeline] Object ${index} frame:`, {
                    origin: obj.frame.origin,
                    size: obj.frame.size
                });
                
                let labels: { text: string; confidence: number; index: number }[] = [];
                let croppedUri = imagePath;
                
                try {
                    // Try to crop the detection
                    console.log(`[UnifiedPipeline] Cropping object ${index}...`);
                    const cropStartTime = Date.now();
                    croppedUri = await this.cropImage(imagePath, obj.frame);
                    const cropTime = Date.now() - cropStartTime;
                    console.log(`[UnifiedPipeline] Crop completed in ${cropTime}ms: ${croppedUri}`);
                } catch (cropError) {
                    console.warn(`[UnifiedPipeline] Crop failed for object ${index}:`, cropError);
                    console.log(`[UnifiedPipeline] Using full image for classification`);
                    croppedUri = imagePath;
                }
                
                try {
                    // Classify the image
                    console.log(`[UnifiedPipeline] Classifying object ${index}...`);
                    const classifyObjStartTime = Date.now();
                    labels = await this.classifyImage(croppedUri);
                    const classifyObjTime = Date.now() - classifyObjStartTime;
                    console.log(`[UnifiedPipeline] Classification completed in ${classifyObjTime}ms`);
                    console.log(`[UnifiedPipeline] Object ${index} labels:`, labels.slice(0, 2));
                    
                    // Log high-confidence detections
                    if (labels.length > 0 && labels[0].confidence >= Config.camera.confidenceThreshold) {
                        console.log(`[UnifiedPipeline] High confidence detection! Object ${index}: ${labels[0].text} (${Math.round(labels[0].confidence * 100)}%)`);
                        // Trigger callback for UI feedback (haptic, etc.)
                        this.callbacks?.onHighConfidenceSave?.();
                    } else if (labels.length > 0) {
                        console.log(`[UnifiedPipeline] 📊 Low confidence detection: ${labels[0].text} (${Math.round(labels[0].confidence * 100)}%) < ${Math.round(Config.camera.confidenceThreshold * 100)}%`);
                    }
                } catch (classifyError) {
                    console.error(`[UnifiedPipeline] ❌ Classification failed for object ${index}:`, classifyError);
                }
                
                // Cleanup crop file
                if (croppedUri !== imagePath) {
                    try {
                        const fileInfo = await FileSystem.getInfoAsync(croppedUri);
                        if (fileInfo.exists) {
                            await FileSystem.deleteAsync(croppedUri);
                            console.log('Deleted crop:', croppedUri);
                        }
                    } catch (err) {
                        console.warn('Could not delete crop file:', err);
                    }
                }
                
                enrichedDetections.push({
                    frame: obj.frame,
                    labels: labels.slice(0, 2) // Top 2 labels for UI
                });
                
                console.log(`[UnifiedPipeline] Object ${index} processed successfully`);
            }
            
            // Run classification on the full image
            try {
                const fullImageLabels = await this.classifyImage(imagePath);
                console.log('[UnifiedPipeline] Full image classification:', fullImageLabels.slice(0, 2));
            } catch (e) {
                console.warn('[UnifiedPipeline] Failed to classify full image:', e);
            }
            
            const classifyTime = Date.now() - classifyStartTime;
            console.log(`[UnifiedPipeline] All object classification completed in ${classifyTime}ms`);
            console.log(`[UnifiedPipeline] Final results: ${enrichedDetections.length} enriched detections`);
            
            // Update UI with detections
            console.log('[UnifiedPipeline] Updating UI with detections...');
            this.callbacks?.onImageDetections(enrichedDetections, imageDims);
            console.log('[UnifiedPipeline] === IMAGE PHASE COMPLETE ===');
            
        } catch (error) {
            console.error('[UnifiedPipeline] ❌ Image phase error:', error);
            console.error('[UnifiedPipeline] Error stack:', (error as Error)?.stack);
            this.callbacks?.onError('image', error as Error);
            // Clear detections on error
            this.callbacks?.onImageDetections([], { width: 0, height: 0 });
            console.log('[UnifiedPipeline] === IMAGE PHASE FAILED ===');
        } finally {
            this.isCapturing = false;
            this.callbacks?.onImageProcessingEnd();
        }
    }

    private async processAudioPhase(): Promise<void> {

        // Check global recording state
        if (UnifiedMLPipelineService.isAnyRecordingActive) {
            console.log('[UnifiedPipeline] Another recording is active, skipping audio phase');
            return;
        }

        UnifiedMLPipelineService.isAnyRecordingActive = true;
        try {

            console.log('[UnifiedPipeline] === AUDIO PHASE START ===');

            if (!this.config.hasAudioPermission) {
                console.log('[UnifiedPipeline] ❌ No audio permission, skipping audio phase');
                return;
            }

            console.log('[UnifiedPipeline] Audio permission granted, starting audio processing');
            this.callbacks?.onAudioProcessingStart();

            try {
                // Step 1: Record Audio
                this.updateState('recording_audio');
                console.log('[UnifiedPipeline] Step 1: Starting audio recording...');
                const recordStartTime = Date.now();

                const recordingUri = await this.recordAudio(3000);
                const recordTime = Date.now() - recordStartTime;
                console.log(`[UnifiedPipeline] Audio recording completed in ${recordTime}ms`);
                console.log(`[UnifiedPipeline] Recording URI: ${recordingUri}`);

                // Step 2: Ensure recording is fully cleaned up before processing
                // (AudioDecoder will create its own Recording for decoding)
                console.log('[UnifiedPipeline] Cleanup delay before processing...');
                await this.delay(500); // Allow more time for cleanup

                // Step 3: Process Audio
                this.updateState('processing_audio');
                console.log('[UnifiedPipeline] Step 2: Starting audio classification...');
                const processStartTime = Date.now();

                const predictions = await classifyBirdAudio(
                    recordingUri,
                    this.config.location
                );

                const processTime = Date.now() - processStartTime;
                console.log(`[UnifiedPipeline] Audio classification completed in ${processTime}ms`);
                console.log(`[UnifiedPipeline] Got ${predictions.length} predictions`);

                // Log prediction details
                if (predictions && predictions.length > 0) {
                    console.log('[UnifiedPipeline] Top predictions:');
                    predictions.slice(0, 3).forEach((pred, idx) => {
                        console.log(`[UnifiedPipeline]   ${idx + 1}. ${pred.common_name} (${pred.scientific_name}) - ${Math.round(pred.confidence * 100)}%`);
                    });
                } else {
                    console.log('[UnifiedPipeline] No predictions above threshold');
                }

                // Update UI with predictions
                console.log('[UnifiedPipeline] Updating UI with audio predictions...');
                if (predictions && predictions.length > 0) {
                    this.callbacks?.onAudioPredictions(predictions.slice(0, 3));
                    console.log(`[UnifiedPipeline] Top result: ${predictions[0].common_name} (${Math.round(predictions[0].confidence * 100)}%)`);
                } else {
                    this.callbacks?.onAudioPredictions([]);
                }

                console.log('[UnifiedPipeline] === AUDIO PHASE COMPLETE ===');

            } catch (error) {
                console.error('[UnifiedPipeline] ❌ Audio phase error:', error);
                console.error('[UnifiedPipeline] Audio error stack:', (error as Error)?.stack);
                this.callbacks?.onError('audio', error as Error);
                // Clear predictions on error
                this.callbacks?.onAudioPredictions([]);
                console.log('[UnifiedPipeline] === AUDIO PHASE FAILED ===');
            } finally {
                this.callbacks?.onAudioProcessingEnd();
            }
        } finally {
            UnifiedMLPipelineService.isAnyRecordingActive = false;
        }
    }

    private async recordAudio(durationMs: number): Promise<string> {
        console.log(`[UnifiedPipeline] Recording audio for ${durationMs}ms...`);

        // Log the current recording instance status
        if (this.audioRecording) {
            console.log('[UnifiedPipeline] Existing recording instance detected, checking status...');
            try {
                const status = await this.audioRecording.getStatusAsync();
                console.log('[UnifiedPipeline] Recording status:', status);
            } catch (error) {
                console.warn('[UnifiedPipeline] Failed to get recording status:', error);
            }
        }

        // Clean up previous recording if needed.
        if (this.audioRecording) {
            console.log('[UnifiedPipeline] Cleaning up previous recording before new preparation...');
            try {
                const status = await this.audioRecording.getStatusAsync();
                if (status.canRecord || status.isRecording) {
                    await this.audioRecording.stopAndUnloadAsync();
                }
            } catch (error) {
                console.warn('[UnifiedPipeline] Previous recording cleanup error:', error);
            }
            this.audioRecording = null;
            // Small delay to ensure resources are released.
            await this.delay(100);
        }

        // Check audio permission.
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                console.error('[UnifiedPipeline] Audio recording permission not granted.');
                return Promise.reject(new Error('Audio recording permission not granted.'));
            }
        } catch (e) {
            console.error('[UnifiedPipeline] Failed to check audio permissions:', e);
            return Promise.reject(new Error('Failed to check audio permissions.'));
        }

        /*

        // DIAGNOSTIC: Check if there are any existing recordings
        console.log('[UnifiedPipeline] DIAGNOSTIC: Checking for existing recordings...');
        const testRecording = new Audio.Recording();
        try {
            await testRecording.prepareToRecordAsync({
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                },
                ios: {
                    extension: '.wav',
                    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
                    audioQuality: 0,
                    sampleRate: 0,
                    numberOfChannels: 0,
                    bitRate: 0,
                },
                web: {
                    mimeType: 'audio/wav',
                },
            });
            try {
                await testRecording.stopAndUnloadAsync();
            } catch (stopError) {
                if (stopError.message.includes('recording not started')) {
                    console.warn('[UnifiedPipeline] DIAGNOSTIC: Test recording was not started, ignoring stop error.');
                } else {
                    throw stopError;
                }
            }
            console.log('[UnifiedPipeline] DIAGNOSTIC: No existing recordings detected');
        } catch (testError) {
            if (testError.message.includes('recording not started')) {
                console.warn('[UnifiedPipeline] DIAGNOSTIC: Test recording error detected but ignored:', testError.message);
            } else {
                console.error('[UnifiedPipeline] DIAGNOSTIC: Existing recording detected!', testError);
                throw new Error('Another Recording exists!');
            }
        }
        
        // Clean up any existing recording
        if (this.audioRecording) {
            console.log('[UnifiedPipeline] Cleaning up previous recording...');
            try {
                const status = await this.audioRecording.getStatusAsync();
                if (status.canRecord || status.isRecording) {
                    await this.audioRecording.stopAndUnloadAsync();
                }
                console.log('[UnifiedPipeline] Previous recording cleaned up');
            } catch (error) {
                console.warn('[UnifiedPipeline] Previous recording cleanup failed:', error);
            }
            this.audioRecording = null;
        }
        
        // Add a small delay to ensure cleanup is complete
        await this.delay(100);

        */

        // Set audio mode
        console.log('[UnifiedPipeline] Setting audio mode...');
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: false,
        });
        console.log('[UnifiedPipeline] Audio mode set successfully');

        // Create and prepare recording
        console.log('[UnifiedPipeline] Creating new recording instance...');
        this.audioRecording = new Audio.Recording();
        console.log('[UnifiedPipeline] Preparing recording configuration...');
        await this.audioRecording.prepareToRecordAsync({
            android: {
                extension: '.m4a',
                outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                audioEncoder: Audio.AndroidAudioEncoder.AAC,
                sampleRate: 48000,
                numberOfChannels: 1,
                bitRate: 128000,
            },
            ios: {
                extension: '.wav',
                outputFormat: Audio.IOSOutputFormat.LINEARPCM,
                audioQuality: Audio.IOSAudioQuality.HIGH,
                sampleRate: 48000,
                numberOfChannels: 1,
                bitRate: 128000,
                linearPCMBitDepth: 16,
                linearPCMIsBigEndian: false,
                linearPCMIsFloat: false,
            },
            web: {
                mimeType: 'audio/wav',
                bitsPerSecond: 128000,
            }
        });
        console.log('[UnifiedPipeline] Recording configuration prepared');

        // Start recording
        console.log('[UnifiedPipeline] Starting audio recording...');
        await this.audioRecording.startAsync();
        console.log(`[UnifiedPipeline] Recording started, will record for ${durationMs}ms`);
        
        // Wait for specified duration
        await this.delay(durationMs);

        // Stop and unload recording.
        console.log('[UnifiedPipeline] Stopping audio recording...');
        try {
            await this.audioRecording.stopAndUnloadAsync();
            const uri = this.audioRecording.getURI();
            console.log(`[UnifiedPipeline] Recording stopped, URI: ${uri}`);
            if (!uri) {
                console.error('[UnifiedPipeline] No recording URI returned from recording');
                throw new Error('No recording URI returned');
            }
            console.log('[UnifiedPipeline] Audio recording completed successfully');
            return uri;
        } finally {
            this.audioRecording = null;
            // Delay to ensure cleanup before next invocation.
            await this.delay(100);
        }
    }

    private async cropImage(
        imageUri: string,
        frame: { origin: { x: number; y: number }; size: { x: number; y: number } }
    ): Promise<string> {
        const cropAction = {
            crop: {
                originX: frame.origin.x,
                originY: frame.origin.y,
                width: frame.size.x,
                height: frame.size.y
            }
        };
        const cropResult = await ImageManipulator.manipulateAsync(
            imageUri,
            [cropAction],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        return cropResult.uri;
    }

    private async classifyImage(imageUri: string): Promise<{ text: string; confidence: number; index: number }[]> {
        const result = await this.config.classifier?.classifyImage(imageUri);
        
        if (!result) return [];
        
        // Handle both string and array results
        let parsedResult;
        if (typeof result === 'string') {
            const parsed = JSON.parse(result);
            parsedResult = Array.isArray(parsed) ? parsed : [];
        } else {
            parsedResult = result ?? [];
        }
        
        return parsedResult;
    }


    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async cleanup(): Promise<void> {
        console.log('[UnifiedPipeline] Starting cleanup...');
        await this.stop();
        
        // Clean up any cached data
        this.callbacks = null;
        
        // Clean up last photo if it exists
        if (this.lastPhotoUri) {
            try {
                const fileInfo = await FileSystem.getInfoAsync(this.lastPhotoUri);
                if (fileInfo.exists) {
                    await FileSystem.deleteAsync(this.lastPhotoUri);
                    console.log('Deleted last photo during cleanup:', this.lastPhotoUri);
                }
            } catch (error) {
                console.warn('Failed to delete last photo during cleanup:', error);
            }
            this.lastPhotoUri = null;
        }
        
        // Clean up old files in document and cache directories
        await this.deleteOldFiles(FileSystem.documentDirectory!, 5); // Files older than 5 minutes
        await this.deleteOldFiles(FileSystem.cacheDirectory!, 5);
        
        console.log('[UnifiedPipeline] Cleanup completed');
    }
    
    private async deleteOldFiles(dirUri: string, maxAgeMinutes: number): Promise<void> {
        try {
            const fileNames = await FileSystem.readDirectoryAsync(dirUri);
            const now = Date.now();
            
            for (const name of fileNames) {
                const fileUri = `${dirUri}${name}`;
                const info = await FileSystem.getInfoAsync(fileUri) as FileSystem.FileInfo & { modificationTime?: number };
                const mod = info.modificationTime;
                if (mod && now - mod * 1000 > maxAgeMinutes * 60 * 1000) {
                    await FileSystem.deleteAsync(fileUri);
                    console.log('Deleted old file:', fileUri);
                }
            }
        } catch (error) {
            console.warn('Failed to clean up old files:', error);
        }
    }
}

// Export singleton instance for convenience
let pipelineInstance: UnifiedMLPipelineService | null = null;

export function createUnifiedPipeline(config: PipelineConfig): UnifiedMLPipelineService {
    pipelineInstance = new UnifiedMLPipelineService(config);
    return pipelineInstance;
}

export function getUnifiedPipeline(): UnifiedMLPipelineService | null {
    return pipelineInstance;
}