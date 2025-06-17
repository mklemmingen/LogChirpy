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
import * as Haptics from 'expo-haptics';
import { Config } from '@/constants/config';
import { capturePhoto, saveClassifiedImage } from './cameraOperationsService';
import { ensureGalleryDirectory, copyFileWithProperUri } from './uriUtils';
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
    onImageDetections: (detections: Detection[]) => void;
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

        console.log('[UnifiedPipeline] 🚀 Starting unified ML pipeline...');
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
        console.log('[UnifiedPipeline] 🛑 Stopping unified ML pipeline...');
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
        console.log('[UnifiedPipeline] 🔄 Starting main pipeline loop...');
        let cycleCount = 0;
        
        while (this.isActive) {
            cycleCount++;
            const cycleStartTime = Date.now();
            console.log(`[UnifiedPipeline] === CYCLE ${cycleCount} START ===`);
            
            try {
                // === IMAGE PROCESSING PHASE ===
                console.log('[UnifiedPipeline] 🖼️ Starting image processing phase...');
                await this.processImagePhase();
                
                // Small delay between phases to prevent resource conflicts
                console.log('[UnifiedPipeline] ⏳ Inter-phase delay (300ms)...');
                await this.delay(300);
                
                // === AUDIO PROCESSING PHASE ===
                if (this.config.hasAudioPermission) {
                    console.log('[UnifiedPipeline] 🎵 Starting audio processing phase...');
                    await this.processAudioPhase();
                } else {
                    console.log('[UnifiedPipeline] ⏭️ Skipping audio phase (no permission)');
                }
                
                // === WAIT PHASE ===
                this.updateState('waiting');
                const waitTime = Config.camera.pipelineDelay * 1000;
                const cycleTime = Date.now() - cycleStartTime;
                console.log(`[UnifiedPipeline] === CYCLE ${cycleCount} COMPLETE (${cycleTime}ms) ===`);
                console.log(`[UnifiedPipeline] 💤 Waiting ${waitTime}ms before next cycle...`);
                await this.delay(waitTime);
                
            } catch (error) {
                console.error(`[UnifiedPipeline] ❌ Cycle ${cycleCount} error:`, error);
                console.error('[UnifiedPipeline] Loop error stack:', error?.stack);
                // Continue the loop even on error
                console.log('[UnifiedPipeline] 🔄 Recovering from error, waiting 1s...');
                await this.delay(1000);
            }
        }
        
        console.log(`[UnifiedPipeline] 🛑 Pipeline loop stopped after ${cycleCount} cycles`);
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
            console.log('[UnifiedPipeline] ⏸️ Already capturing, skipping image phase');
            return;
        }

        console.log('[UnifiedPipeline] ✅ All ML components ready, starting image processing');
        this.callbacks?.onImageProcessingStart();
        this.isCapturing = true;
        
        try {
            // Step 1: Capture Photo
            this.updateState('capturing_image');
            console.log('[UnifiedPipeline] 📸 Step 1: Capturing photo...');
            const captureStartTime = Date.now();
            
            const photoResult = await capturePhoto(this.config.cameraRef, { 
                manual: false, 
                quality: 0.3 
            });
            
            const captureTime = Date.now() - captureStartTime;
            console.log(`[UnifiedPipeline] 📸 Capture completed in ${captureTime}ms`);
            
            if (!photoResult.success || !photoResult.uri) {
                console.error('[UnifiedPipeline] ❌ Photo capture failed:', photoResult.error);
                throw new Error(photoResult.error || 'Photo capture failed');
            }
            
            console.log('[UnifiedPipeline] ✅ Photo captured successfully');
            console.log(`[UnifiedPipeline] 📁 Photo URI: ${photoResult.uri}`);
            console.log(`[UnifiedPipeline] 📊 Processing time: ${photoResult.processingTime}ms`);

            // Step 2: Detect Objects (use original camera file directly)
            this.updateState('detecting_objects');
            console.log('[UnifiedPipeline] 🔍 Step 2: Starting object detection...');
            const detectStartTime = Date.now();
            
            // Use the original camera file path directly for ML processing
            const cameraFilePath = photoResult.uri.replace('file://', '');
            console.log(`[UnifiedPipeline] 🔍 Detection input: ${cameraFilePath}`);
            
            const objects = await this.config.detector.detectObjects(cameraFilePath);
            const detectTime = Date.now() - detectStartTime;
            console.log(`[UnifiedPipeline] ✅ Object detection completed in ${detectTime}ms`);
            console.log(`[UnifiedPipeline] 🎯 Found ${objects.length} objects`);

            // Step 3: Classify Objects
            this.updateState('classifying_objects');
            console.log('[UnifiedPipeline] 🧠 Step 3: Starting object classification...');
            console.log(`[UnifiedPipeline] 🧠 Processing ${objects.length} objects for classification`);
            const classifyStartTime = Date.now();
            
            const enrichedDetections: Detection[] = [];
            
            for (const [index, obj] of objects.entries()) {
                console.log(`[UnifiedPipeline] 🧠 Processing object ${index + 1}/${objects.length}`);
                
                if (!obj.frame || !obj.frame.origin || !obj.frame.size) {
                    console.warn(`[UnifiedPipeline] ❌ Invalid frame for object ${index}:`, obj);
                    continue;
                }
                
                console.log(`[UnifiedPipeline] 📐 Object ${index} frame:`, {
                    origin: obj.frame.origin,
                    size: obj.frame.size
                });
                
                let labels: { text: string; confidence: number; index: number }[] = [];
                let croppedUri = photoResult.uri;
                
                try {
                    // Try to crop the detection
                    console.log(`[UnifiedPipeline] ✂️ Cropping object ${index}...`);
                    const cropStartTime = Date.now();
                    croppedUri = await this.cropDetectionImage(cameraFilePath, obj.frame);
                    const cropTime = Date.now() - cropStartTime;
                    console.log(`[UnifiedPipeline] ✅ Crop completed in ${cropTime}ms: ${croppedUri}`);
                } catch (cropError) {
                    console.warn(`[UnifiedPipeline] ❌ Crop failed for object ${index}:`, cropError);
                    console.log(`[UnifiedPipeline] 🔄 Using full image for classification`);
                    croppedUri = cameraFilePath;
                }
                
                try {
                    // Classify the image
                    console.log(`[UnifiedPipeline] 🎯 Classifying object ${index}...`);
                    const classifyObjStartTime = Date.now();
                    labels = await this.classifyImage(croppedUri);
                    const classifyObjTime = Date.now() - classifyObjStartTime;
                    console.log(`[UnifiedPipeline] ✅ Classification completed in ${classifyObjTime}ms`);
                    console.log(`[UnifiedPipeline] 🏷️ Object ${index} labels:`, labels.slice(0, 2));
                    
                    // Save high-confidence detections
                    if (labels.length > 0 && labels[0].confidence >= Config.camera.confidenceThreshold) {
                        console.log(`[UnifiedPipeline] 💾 High confidence detection! Saving object ${index}: ${labels[0].text} (${Math.round(labels[0].confidence * 100)}%)`);
                        try {
                            await this.saveHighConfidenceDetection(
                                photoResult.uri,
                                croppedUri,
                                { frame: obj.frame, labels },
                                index
                            );
                            this.callbacks?.onHighConfidenceSave?.();
                            console.log(`[UnifiedPipeline] ✅ High confidence detection saved successfully`);
                        } catch (saveError) {
                            console.error(`[UnifiedPipeline] ❌ Failed to save high confidence detection:`, saveError);
                        }
                    } else if (labels.length > 0) {
                        console.log(`[UnifiedPipeline] 📊 Low confidence detection: ${labels[0].text} (${Math.round(labels[0].confidence * 100)}%) < ${Math.round(Config.camera.confidenceThreshold * 100)}%`);
                    }
                } catch (classifyError) {
                    console.error(`[UnifiedPipeline] ❌ Classification failed for object ${index}:`, classifyError);
                }
                
                enrichedDetections.push({
                    frame: obj.frame,
                    labels: labels.slice(0, 2) // Top 2 labels for UI
                });
                
                console.log(`[UnifiedPipeline] ✅ Object ${index} processed successfully`);
            }
            
            const classifyTime = Date.now() - classifyStartTime;
            console.log(`[UnifiedPipeline] ✅ All object classification completed in ${classifyTime}ms`);
            console.log(`[UnifiedPipeline] 📋 Final results: ${enrichedDetections.length} enriched detections`);
            
            // Update UI with detections
            console.log('[UnifiedPipeline] 🔄 Updating UI with detections...');
            this.callbacks?.onImageDetections(enrichedDetections);
            console.log('[UnifiedPipeline] === IMAGE PHASE COMPLETE ===');
            
        } catch (error) {
            console.error('[UnifiedPipeline] ❌ Image phase error:', error);
            console.error('[UnifiedPipeline] Error stack:', error?.stack);
            this.callbacks?.onError('image', error as Error);
            // Clear detections on error
            this.callbacks?.onImageDetections([]);
            console.log('[UnifiedPipeline] === IMAGE PHASE FAILED ===');
        } finally {
            this.isCapturing = false;
            this.callbacks?.onImageProcessingEnd();
        }
    }

    private async processAudioPhase(): Promise<void> {
        console.log('[UnifiedPipeline] === AUDIO PHASE START ===');
        
        if (!this.config.hasAudioPermission) {
            console.log('[UnifiedPipeline] ❌ No audio permission, skipping audio phase');
            return;
        }

        console.log('[UnifiedPipeline] ✅ Audio permission granted, starting audio processing');
        this.callbacks?.onAudioProcessingStart();
        
        try {
            // Step 1: Record Audio
            this.updateState('recording_audio');
            console.log('[UnifiedPipeline] 🎤 Step 1: Starting audio recording...');
            const recordStartTime = Date.now();
            
            const recordingUri = await this.recordAudio(3000);
            const recordTime = Date.now() - recordStartTime;
            console.log(`[UnifiedPipeline] ✅ Audio recording completed in ${recordTime}ms`);
            console.log(`[UnifiedPipeline] 🎵 Recording URI: ${recordingUri}`);

            // Step 2: Ensure recording is fully cleaned up before processing
            // (AudioDecoder will create its own Recording for decoding)
            console.log('[UnifiedPipeline] 🔄 Cleanup delay before processing...');
            await this.delay(100); // Allow time for cleanup
            
            // Step 3: Process Audio
            this.updateState('processing_audio');
            console.log('[UnifiedPipeline] 🧠 Step 2: Starting audio classification...');
            const processStartTime = Date.now();
            
            const predictions = await classifyBirdAudio(
                recordingUri,
                this.config.location
            );
            
            const processTime = Date.now() - processStartTime;
            console.log(`[UnifiedPipeline] ✅ Audio classification completed in ${processTime}ms`);
            console.log(`[UnifiedPipeline] 🎯 Got ${predictions.length} predictions`);
            
            // Log prediction details
            if (predictions && predictions.length > 0) {
                console.log('[UnifiedPipeline] 🏆 Top predictions:');
                predictions.slice(0, 3).forEach((pred, idx) => {
                    console.log(`[UnifiedPipeline]   ${idx + 1}. ${pred.common_name} (${pred.scientific_name}) - ${Math.round(pred.confidence * 100)}%`);
                });
            } else {
                console.log('[UnifiedPipeline] 📊 No predictions above threshold');
            }
            
            // Update UI with predictions
            console.log('[UnifiedPipeline] 🔄 Updating UI with audio predictions...');
            if (predictions && predictions.length > 0) {
                this.callbacks?.onAudioPredictions(predictions.slice(0, 3));
                console.log(`[UnifiedPipeline] 🥇 Top result: ${predictions[0].common_name} (${Math.round(predictions[0].confidence * 100)}%)`);
            } else {
                this.callbacks?.onAudioPredictions([]);
            }
            
            console.log('[UnifiedPipeline] === AUDIO PHASE COMPLETE ===');
            
        } catch (error) {
            console.error('[UnifiedPipeline] ❌ Audio phase error:', error);
            console.error('[UnifiedPipeline] Audio error stack:', error?.stack);
            this.callbacks?.onError('audio', error as Error);
            // Clear predictions on error
            this.callbacks?.onAudioPredictions([]);
            console.log('[UnifiedPipeline] === AUDIO PHASE FAILED ===');
        } finally {
            this.callbacks?.onAudioProcessingEnd();
        }
    }

    private async recordAudio(durationMs: number): Promise<string> {
        console.log(`[UnifiedPipeline] 🎤 Recording audio for ${durationMs}ms...`);
        
        // Clean up any existing recording
        if (this.audioRecording) {
            console.log('[UnifiedPipeline] 🧹 Cleaning up previous recording...');
            try {
                await this.audioRecording.stopAndUnloadAsync();
                console.log('[UnifiedPipeline] ✅ Previous recording cleaned up');
            } catch (error) {
                console.warn('[UnifiedPipeline] ❌ Previous recording cleanup failed:', error);
            }
            this.audioRecording = null;
        }

        // Set audio mode
        console.log('[UnifiedPipeline] 🔧 Setting audio mode...');
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: false,
        });
        console.log('[UnifiedPipeline] ✅ Audio mode set successfully');

        // Create and prepare recording
        console.log('[UnifiedPipeline] 🎙️ Creating new recording instance...');
        this.audioRecording = new Audio.Recording();
        
        console.log('[UnifiedPipeline] ⚙️ Preparing recording configuration...');
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
        console.log('[UnifiedPipeline] ✅ Recording configuration prepared');

        // Start recording
        console.log('[UnifiedPipeline] ▶️ Starting audio recording...');
        await this.audioRecording.startAsync();
        console.log(`[UnifiedPipeline] 🔴 Recording started, will record for ${durationMs}ms`);
        
        // Wait for specified duration
        await this.delay(durationMs);
        
        // Stop recording
        console.log('[UnifiedPipeline] ⏹️ Stopping audio recording...');
        await this.audioRecording.stopAndUnloadAsync();
        const uri = this.audioRecording.getURI();
        console.log(`[UnifiedPipeline] ✅ Recording stopped, URI: ${uri}`);
        
        this.audioRecording = null;
        
        if (!uri) {
            console.error('[UnifiedPipeline] ❌ No recording URI returned from recording');
            throw new Error('No recording URI returned');
        }
        
        console.log('[UnifiedPipeline] 🎵 Audio recording completed successfully');
        return uri;
    }

    private async cropDetectionImage(
        imageUri: string,
        frame: { origin: { x: number; y: number }; size: { x: number; y: number } }
    ): Promise<string> {
        const { origin, size } = frame;
        
        // Validate coordinates
        if (origin.x < 0 || origin.y < 0 || size.x <= 0 || size.y <= 0) {
            throw new Error('Invalid crop coordinates');
        }
        
        // Detect if coordinates are normalized (0-1) or pixel coordinates
        const isNormalized = origin.x <= 1 && origin.y <= 1 && size.x <= 1 && size.y <= 1;
        
        let cropX, cropY, cropWidth, cropHeight;
        
        if (isNormalized) {
            // Scale normalized coordinates to assumed image dimensions
            const imageWidth = 1080;
            const imageHeight = 1920;
            
            cropX = Math.round(origin.x * imageWidth);
            cropY = Math.round(origin.y * imageHeight);
            cropWidth = Math.round(size.x * imageWidth);
            cropHeight = Math.round(size.y * imageHeight);
        } else {
            cropX = Math.round(origin.x);
            cropY = Math.round(origin.y);
            cropWidth = Math.round(size.x);
            cropHeight = Math.round(size.y);
        }
        
        // Ensure minimum crop size
        cropWidth = Math.max(cropWidth, 50);
        cropHeight = Math.max(cropHeight, 50);
        
        const result = await ImageManipulator.manipulateAsync(
            imageUri,
            [{
                crop: {
                    originX: cropX,
                    originY: cropY,
                    width: cropWidth,
                    height: cropHeight
                }
            }],
            { 
                compress: 0.8, 
                format: ImageManipulator.SaveFormat.JPEG 
            }
        );
        
        return result.uri;
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

    private async saveHighConfidenceDetection(
        originalImageUri: string,
        croppedImageUri: string,
        detection: Detection,
        detectionIndex: number
    ): Promise<void> {
        try {
            const bestLabel = detection.labels[0];
            if (!bestLabel) return;

            console.log(`[UnifiedPipeline] Saving high-confidence detection: ${bestLabel.text} (${Math.round(bestLabel.confidence * 100)}%)`);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const safeLabel = bestLabel.text.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const confidenceStr = Math.round(bestLabel.confidence * 100).toString().padStart(3, '0');
            
            const galleryDir = await ensureGalleryDirectory();
            
            // Save original full screenshot
            const originalFilename = `detection_full_${safeLabel}_conf${confidenceStr}_${timestamp}_${Date.now()}.jpg`;
            const originalDestPath = `${galleryDir}${originalFilename}`;
            await copyFileWithProperUri(originalImageUri, originalDestPath);
            
            // Save cropped object image
            const croppedFilename = `detection_crop_${safeLabel}_conf${confidenceStr}_${timestamp}_${Date.now()}_crop.jpg`;
            const croppedDestPath = `${galleryDir}${croppedFilename}`;
            await copyFileWithProperUri(croppedImageUri, croppedDestPath);
            
            // Haptic feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
        } catch (error) {
            console.error('[UnifiedPipeline] Failed to save detection:', error);
        }
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
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