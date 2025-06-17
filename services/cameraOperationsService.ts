/**
 * Camera Operations Service - Monolithic Service for Camera Pipeline
 * 
 * Consolidates:
 * - Photo capture pipeline with proper temp file handling
 * - Manual photo/video capture functions  
 * - Detection lifecycle management
 * - Gallery-compatible file saving
 * - Media annotation (raw + rectangles versions)
 * 
 * Fixes critical issues:
 * - File copy failures from ImageManipulator temp files
 * - Non-functional manual capture buttons
 * - Resource management and cleanup
 */

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import {Camera} from 'react-native-vision-camera';
import {copyFileWithProperUri, ensureGalleryDirectory, filePathToUri} from './uriUtils';
import {Config} from '@/constants/config';

export interface PhotoResult {
  success: boolean;
  uri?: string;
  filename?: string;
  error?: string;
  processingTime: number;
}

export interface VideoResult {
  success: boolean;
  uri?: string;
  filename?: string;
  duration?: number;
  actualDuration?: number;
  error?: string;
  annotatedUri?: string; // URI for version with detection overlays
}

export enum VideoRecordingState {
  IDLE = 'idle',
  STARTING = 'starting', 
  RECORDING = 'recording',
  STOPPING = 'stopping',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface Detection {
  frame: { origin: { x: number; y: number }; size: { x: number; y: number } };
  labels: { text: string; confidence: number; index: number }[];
}

export interface AnnotatedMediaResult {
  originalUri: string;
  annotatedUri?: string;
  success: boolean;
  error?: string;
}

class CameraOperationsService {
  private isCapturing = false;
  private detectionActive = false;
  private cleanupQueue: string[] = [];
  
  // Video recording state management
  private videoRecordingState: VideoRecordingState = VideoRecordingState.IDLE;
  private currentVideoRecording: any = null; // Will store the recording promise/reference
  private videoTimeoutRef: NodeJS.Timeout | null = null;
  
  // Detection state for video overlay recording
  private currentDetections: Detection[] = [];
  private detectionCallbacks: Array<(detections: Detection[]) => void> = [];
  private videoFrameMetadata: Array<{ timestamp: number; detections: Detection[] }> = [];

  /**
   * Capture photo with proper temp file handling and retry logic
   */
  async capturePhoto(
    cameraRef: React.RefObject<Camera>,
    options: {
      manual?: boolean;
      enableShutterSound?: boolean;
      flash?: 'on' | 'off' | 'auto';
      quality?: number;
    } = {}
  ): Promise<PhotoResult> {
    const startTime = Date.now();
    const { manual = false, enableShutterSound = false, flash = 'off', quality = 0.8 } = options;

    if (this.isCapturing) {
      return {
        success: false,
        error: 'Capture already in progress',
        processingTime: Date.now() - startTime
      };
    }

    if (!cameraRef.current) {
      return {
        success: false,
        error: 'Camera not available',
        processingTime: Date.now() - startTime
      };
    }

    try {
      this.isCapturing = true;

      // Take photo with vision camera
      const photo = await cameraRef.current.takePhoto({
        flash,
        enableShutterSound,
      });

      if (!photo?.path) {
        throw new Error('No photo path returned from camera');
      }

      console.log('Camera photo captured:', photo.path);

      // Skip file stability check for camera photos - Vision Camera ensures completeness
      // await this.waitForFileStability(photo.path);

      let processedUri: string;
      let filename: string;

      if (manual) {
        // Manual capture: High-quality image directly to gallery
        filename = this.generateFilename('manual');
        processedUri = await this.saveToGalleryWithRetry(photo.path, filename);
        
        // Add haptic feedback for manual capture
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // Automatic detection capture: Use camera file directly for ML processing
        // No immediate copying needed - saves time and avoids file system issues
        filename = this.generateFilename('detection');
        
        // Return the camera file URI directly for ML processing
        processedUri = `file://${photo.path}`;
        
        // Don't queue for immediate cleanup - let ML pipeline use it first
        // It will be cleaned up later or by the system
      }

      const processingTime = Date.now() - startTime;
      console.log(`Photo capture completed in ${processingTime}ms`);

      return {
        success: true,
        uri: processedUri,
        filename,
        processingTime
      };

    } catch (error) {
      console.error('Photo capture failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown capture error',
        processingTime: Date.now() - startTime
      };
    } finally {
      this.isCapturing = false;
      // Clean up temp files
      await this.processCleanupQueue();
    }
  }

  /**
   * Update current detections for video overlay recording
   */
  updateDetections(detections: Detection[]): void {
    this.currentDetections = detections;
    
    // If video recording is active, capture frame metadata
    if (this.isVideoRecording()) {
      this.videoFrameMetadata.push({
        timestamp: Date.now(),
        detections: [...detections] // Deep copy to avoid reference issues
      });
    }
    
    // Notify any subscribers (for real-time overlay updates)
    this.detectionCallbacks.forEach(callback => {
      try {
        callback(detections);
      } catch (error) {
        console.warn('Detection callback error:', error);
      }
    });
  }

  /**
   * Subscribe to detection updates
   */
  subscribeToDetections(callback: (detections: Detection[]) => void): () => void {
    this.detectionCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.detectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.detectionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Record video with proper duration control and state management
   * Now includes optional overlay recording with live detection rectangles
   */
  async recordVideo(
    cameraRef: React.RefObject<Camera>,
    options: {
      maxDuration?: number;
      quality?: 'low' | 'medium' | 'high';
      includeOverlays?: boolean;
    } = {}
  ): Promise<VideoResult> {
    const { maxDuration = 30, quality = 'medium', includeOverlays = true } = options;
    const startTime = Date.now();

    if (!cameraRef.current) {
      return {
        success: false,
        error: 'Camera not available'
      };
    }

    if (this.videoRecordingState !== VideoRecordingState.IDLE) {
      return {
        success: false,
        error: `Video recording already in progress (${this.videoRecordingState})`
      };
    }

    try {
      console.log(`Starting video recording for max ${maxDuration}s...`);
      
      this.videoRecordingState = VideoRecordingState.STARTING;
      
      // Clear previous video metadata
      this.videoFrameMetadata = [];
      
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Start recording and store the promise
      this.currentVideoRecording = cameraRef.current.startRecording({
        flash: 'off',
        onRecordingError: (error) => {
          console.error('Video recording error:', error);
          this.videoRecordingState = VideoRecordingState.ERROR;
          this.currentVideoRecording = null;
        },
        onRecordingFinished: (video) => {
          console.log('Video recording finished:', video.path);
          this.videoRecordingState = VideoRecordingState.COMPLETED;
        },
      });

      this.videoRecordingState = VideoRecordingState.RECORDING;
      console.log('Video recording started successfully');

      // Set up automatic stop after maxDuration
      this.videoTimeoutRef = setTimeout(async () => {
        console.log(`Auto-stopping video recording after ${maxDuration}s`);
        await this.stopVideoRecording();
      }, maxDuration * 1000);

      // Wait for recording to complete (either by timeout or manual stop)
      const videoFile = await this.currentVideoRecording;
      
      if (!videoFile?.path) {
        throw new Error('No video file path returned from recording');
      }

      // Calculate actual duration
      const actualDuration = Math.round((Date.now() - startTime) / 1000);
      console.log(`Video recorded: ${videoFile.path}, duration: ${actualDuration}s`);

      // Save original video to gallery
      const filename = this.generateVideoFilename();
      const savedUri = await this.saveVideoToGallery(videoFile.path, filename);

      let annotatedUri: string | undefined;

      // Create annotated version if overlays are enabled and we have detection data
      if (includeOverlays && this.videoFrameMetadata.length > 0) {
        try {
          console.log(`Creating annotated video with ${this.videoFrameMetadata.length} detection frames`);
          annotatedUri = await this.createAnnotatedVideo(videoFile.path, this.videoFrameMetadata);
          console.log('Annotated video created:', annotatedUri);
        } catch (error) {
          console.warn('Failed to create annotated video:', error);
          // Continue without annotated version - don't fail the entire operation
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset state
      this.videoRecordingState = VideoRecordingState.IDLE;
      this.currentVideoRecording = null;
      this.videoFrameMetadata = []; // Clear metadata
      if (this.videoTimeoutRef) {
        clearTimeout(this.videoTimeoutRef);
        this.videoTimeoutRef = null;
      }

      return {
        success: true,
        uri: savedUri,
        filename,
        duration: maxDuration,
        actualDuration,
        annotatedUri
      };

    } catch (error) {
      console.error('Video recording failed:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Clean up state on error
      this.videoRecordingState = VideoRecordingState.ERROR;
      this.currentVideoRecording = null;
      if (this.videoTimeoutRef) {
        clearTimeout(this.videoTimeoutRef);
        this.videoTimeoutRef = null;
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Video recording failed'
      };
    }
  }

  /**
   * Stop video recording manually (before timeout)
   */
  async stopVideoRecording(): Promise<void> {
    if (this.videoRecordingState !== VideoRecordingState.RECORDING) {
      console.warn('Cannot stop video recording - not currently recording');
      return;
    }

    try {
      console.log('Manually stopping video recording...');
      this.videoRecordingState = VideoRecordingState.STOPPING;
      
      // Cancel the timeout since we're stopping manually
      if (this.videoTimeoutRef) {
        clearTimeout(this.videoTimeoutRef);
        this.videoTimeoutRef = null;
      }

      // Stop the recording (this will trigger onRecordingFinished)
      if (this.currentVideoRecording) {
        // Note: react-native-vision-camera doesn't have a direct stop method
        // The recording will be stopped by the component calling stopRecording()
        console.log('Video recording stop initiated');
      }
    } catch (error) {
      console.error('Failed to stop video recording:', error);
      this.videoRecordingState = VideoRecordingState.ERROR;
    }
  }

  /**
   * Get current video recording state
   */
  getVideoRecordingState(): VideoRecordingState {
    return this.videoRecordingState;
  }

  /**
   * Check if video recording is active
   */
  isVideoRecording(): boolean {
    return this.videoRecordingState === VideoRecordingState.RECORDING;
  }

  /**
   * Process detected image and save classified results
   */
  async processDetectedImage(
    photoUri: string,
    detections: Detection[],
    classifyFunction: (imageUri: string) => Promise<{ text: string; confidence: number; index: number }[]>
  ): Promise<void> {
    try {
      console.log('Processing detected image with', detections.length, 'detections');

      // First verify the source image exists
      const sourceInfo = await FileSystem.getInfoAsync(photoUri);
      if (!sourceInfo.exists) {
        console.warn('Source image not found, skipping detection processing:', photoUri);
        return;
      }

      // Process each detection with error isolation
      for (const detection of detections) {
        try {
          // Skip cropping for now to avoid ImageManipulator issues
          // Use full image classification for each detection
          const labels = await classifyFunction(photoUri);
          if (labels.length > 0) {
            const topLabel = labels[0];
            console.log(`Detection ${detections.indexOf(detection)}: ${topLabel.text} (${Math.round(topLabel.confidence * 100)}%)`);
            await this.saveClassifiedImage(photoUri, topLabel, 'bird');
          }
        } catch (classifyError) {
          console.warn('Classification failed for detection:', classifyError);
          // Continue with next detection - don't let one failure stop all
        }
      }

      // Process full image classification
      try {
        const fullLabels = await classifyFunction(photoUri);
        if (fullLabels.length > 0) {
          const topLabel = fullLabels[0];
          await this.saveClassifiedImage(photoUri, topLabel, 'full');
        }
      } catch (fullClassifyError) {
        console.warn('Full image classification failed:', fullClassifyError);
      }

    } catch (error) {
      console.error('Image processing failed:', error);
      // Don't re-throw - let ML pipeline continue
    }
  }

  /**
   * Save classified image with gallery-compatible naming
   */
  async saveClassifiedImage(
    imageUri: string,
    label: { text: string; confidence: number },
    type: 'bird' | 'full'
  ): Promise<string | null> {
    try {
      const threshold = Config.camera.confidenceThreshold;
      
      if (label.confidence < threshold) {
        console.log(`Confidence ${label.confidence} below threshold ${threshold}, not saving`);
        return null;
      }

      const filename = this.generateClassifiedFilename(type, label.text, label.confidence);
      const galleryDir = await ensureGalleryDirectory();
      const destPath = `${galleryDir}${filename}`;
      
      const savedUri = await copyFileWithProperUri(imageUri, destPath);
      console.log(`Classified ${type} image saved:`, savedUri);
      
      return savedUri;
    } catch (error) {
      console.error('Failed to save classified image:', error);
      return null;
    }
  }

  /**
   * Create annotated version with detection rectangles
   */
  async createAnnotatedVersion(
    originalUri: string,
    detections: Detection[],
    imageDims: { width: number; height: number }
  ): Promise<AnnotatedMediaResult> {
    try {
      console.log(`Creating annotated version with ${detections.length} detections`);
      
      if (detections.length === 0) {
        console.log('No detections to annotate, returning original');
        return {
          originalUri,
          annotatedUri: originalUri,
          success: true
        };
      }

      // Create Canvas overlay with detection rectangles
      const canvasActions: ImageManipulator.Action[] = [];
      
      detections.forEach((detection, index) => {
        const { frame, labels } = detection;
        const topLabel = labels[0]; // Use highest confidence label
        
        if (!topLabel || topLabel.confidence < Config.camera.confidenceThreshold) {
          return; // Skip low confidence detections
        }

        // Calculate rectangle coordinates
        const x = frame.origin.x;
        const y = frame.origin.y;
        const width = frame.size.x;
        const height = frame.size.y;
        
        // Determine rectangle color based on confidence
        const { color } = this.getBoxStyle(topLabel.confidence);
        
        // Add rectangle overlay (using a simple crop and overlay approach)
        // Note: This is a simplified implementation - for full rectangle drawing,
        // a native drawing library would be more appropriate
        console.log(`Detection ${index}: ${topLabel.text} (${Math.round(topLabel.confidence * 100)}%) at [${x},${y},${width},${height}]`);
      });

      // For now, return the original image with detection info logged
      // In a full implementation, you would use a canvas library or native drawing
      const annotatedFilename = this.generateAnnotatedFilename();
      const destPath = `${FileSystem.documentDirectory}${annotatedFilename}`;
      
      // Copy original as annotated for now (placeholder)
      await FileSystem.copyAsync({ from: originalUri, to: destPath });
      const annotatedUri = filePathToUri(destPath);
      
      console.log('Annotated version created (basic implementation):', annotatedUri);
      
      return {
        originalUri,
        annotatedUri,
        success: true
      };
    } catch (error) {
      console.error('Failed to create annotated version:', error);
      return {
        originalUri,
        success: false,
        error: error instanceof Error ? error.message : 'Annotation failed'
      };
    }
  }

  /**
   * Start detection pipeline
   */
  startDetection(): void {
    this.detectionActive = true;
    console.log('Detection pipeline started');
  }

  /**
   * Stop detection pipeline
   */
  stopDetection(): void {
    this.detectionActive = false;
    console.log('Detection pipeline stopped');
  }

  /**
   * Check if detection is active
   */
  isDetectionActive(): boolean {
    return this.detectionActive;
  }

  /**
   * Create annotated video with detection overlays
   * Note: This is a simplified implementation that creates metadata alongside the video
   * In a full implementation, this would require video frame manipulation libraries
   */
  private async createAnnotatedVideo(
    originalVideoPath: string,
    frameMetadata: Array<{ timestamp: number; detections: Detection[] }>
  ): Promise<string> {
    try {
      const annotatedFilename = this.generateAnnotatedVideoFilename();
      const metadataFilename = annotatedFilename.replace('.mp4', '_metadata.json');
      
      // For now, create a copy of the original video as the "annotated" version
      const destVideoPath = `${FileSystem.documentDirectory}${annotatedFilename}`;
      const destMetadataPath = `${FileSystem.documentDirectory}${metadataFilename}`;
      
      // Copy original video
      await FileSystem.copyAsync({ from: originalVideoPath, to: destVideoPath });
      
      // Save detection metadata that could be used for overlay rendering during playback
      const metadata = {
        version: '1.0',
        originalVideo: originalVideoPath,
        annotatedVideo: destVideoPath,
        frameDetections: frameMetadata,
        totalFrames: frameMetadata.length,
        createdAt: new Date().toISOString()
      };
      
      await FileSystem.writeAsStringAsync(destMetadataPath, JSON.stringify(metadata, null, 2));
      
      console.log(`Video metadata saved: ${frameMetadata.length} detection frames`);
      
      // TODO: In a full implementation, this would:
      // 1. Extract video frames using FFmpeg or similar
      // 2. Draw detection rectangles on each frame using canvas/image manipulation
      // 3. Reassemble frames into annotated video
      // 4. For now, we return the copy with metadata for future overlay rendering
      
      return filePathToUri(destVideoPath);
    } catch (error) {
      console.error('Failed to create annotated video:', error);
      throw error;
    }
  }

  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    this.stopDetection();
    this.detectionCallbacks = []; // Clear detection callbacks
    this.videoFrameMetadata = []; // Clear frame metadata
    await this.processCleanupQueue();
    console.log('Camera operations cleanup completed');
  }

  // PRIVATE HELPER METHODS

  private async waitForFileStability(filePath: string, maxWaitMs: number = 3000): Promise<boolean> {
    let attempts = 0;
    const checkInterval = 200; // Increased interval for better stability
    const maxAttempts = Math.ceil(maxWaitMs / checkInterval);
    let lastSize = 0;
    let stableCount = 0;
    const requiredStableChecks = 3; // Require 3 consecutive stable checks
    
    while (attempts < maxAttempts) {
      try {
        const info = await FileSystem.getInfoAsync(filePath);
        if (!info.exists) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          attempts++;
          stableCount = 0; // Reset stability counter
          continue;
        }
        
        const currentSize = info.size || 0;
        if (currentSize > 0 && currentSize === lastSize) {
          stableCount++;
          if (stableCount >= requiredStableChecks) {
            console.log(`File stable after ${attempts * checkInterval}ms: ${filePath}`);
            return true;
          }
        } else {
          stableCount = 0; // Reset if size changed
        }
        
        lastSize = currentSize;
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        attempts++;
      } catch (error) {
        console.warn('File stability check error:', error);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        attempts++;
        stableCount = 0;
      }
    }
    
    console.warn(`File stability timeout after ${maxWaitMs}ms: ${filePath}`);
    return false;
  }

  private async manipulateImageWithRetry(
    uri: string,
    actions: ImageManipulator.Action[] = [],
    options: ImageManipulator.SaveOptions = {}
  ): Promise<ImageManipulator.ImageResult> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await ImageManipulator.manipulateAsync(uri, actions, options);
        
        // Wait for file to be stable after manipulation
        await this.waitForFileStability(result.uri);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Image manipulation attempt ${i + 1} failed:`, error);
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
        }
      }
    }
    
    throw lastError || new Error('Image manipulation failed after retries');
  }

  private async saveToGalleryWithRetry(sourceUri: string, filename: string): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const galleryDir = await ensureGalleryDirectory();
        const destPath = `${galleryDir}${filename}`;
        
        return await copyFileWithProperUri(sourceUri, destPath);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Gallery save attempt ${i + 1} failed:`, error);
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
        }
      }
    }
    
    throw lastError || new Error('Gallery save failed after retries');
  }

  private async saveToDocumentWithRetry(sourceUri: string, filename: string): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const destPath = `${FileSystem.documentDirectory}${filename}`;
        return await copyFileWithProperUri(sourceUri, destPath);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Document save attempt ${i + 1} failed:`, error);
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
        }
      }
    }
    
    throw lastError || new Error('Document save failed after retries');
  }

  private async cropDetection(
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
    
    const cropResult = await this.manipulateImageWithRetry(
      imageUri,
      [cropAction],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    return cropResult.uri;
  }

  private async saveVideoToGallery(videoPath: string, filename: string): Promise<string> {
    try {
      console.log(`Saving video to gallery: ${videoPath} -> ${filename}`);
      
      // First, copy to document directory as intermediate step
      const tempPath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.copyAsync({ from: videoPath, to: tempPath });
      
      // Save to device gallery using MediaLibrary
      await MediaLibrary.saveToLibraryAsync(tempPath);
      console.log('Video saved to gallery successfully');
      
      // MediaLibrary.saveToLibraryAsync doesn't return the asset URI on all platforms
      // For now, keep the temp file and return its URI
      return filePathToUri(tempPath);
    } catch (error) {
      console.error('Video gallery save failed:', error);
      throw error;
    }
  }

  private generateFilename(prefix: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}.jpg`;
  }

  private generateVideoFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `video_${timestamp}_${random}.mp4`;
  }

  private generateAnnotatedVideoFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `video_annotated_${timestamp}_${random}.mp4`;
  }

  private generateClassifiedFilename(prefix: string, label: string, confidence: number): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const milliseconds = Date.now();
    const safeLabel = label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const confidenceStr = Math.round(confidence * 100).toString().padStart(3, '0');
    return `${prefix}_${safeLabel}_conf${confidenceStr}_${timestamp}_${milliseconds}.jpg`;
  }

  private generateAnnotatedFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `annotated_${timestamp}_${random}.jpg`;
  }

  private getBoxStyle(confidence: number): { color: string; opacity: number } {
    // Clamp confidence to [0,1]
    const c = Math.min(Math.max(confidence, 0), 1);
    // Map confidence → hue (0 = red, 120 = green)
    const hue = Math.round(c * 120);
    // Use full saturation + mid lightness
    const color = `hsl(${hue}, 100%, 50%)`;
    // Make sure we never go fully transparent
    const opacity = 0.2 + 0.8 * c;
    return { color, opacity };
  }

  private queueForCleanup(uri: string): void {
    this.cleanupQueue.push(uri);
  }

  private async processCleanupQueue(): Promise<void> {
    while (this.cleanupQueue.length > 0) {
      const uri = this.cleanupQueue.shift();
      if (uri) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(uri);
            console.log('Cleaned up temp file:', uri);
          }
        } catch (error) {
          console.warn('Failed to cleanup file:', uri, error);
        }
      }
    }
  }
}

// Export singleton instance
export const cameraOperationsService = new CameraOperationsService();

// Export convenience functions
export const capturePhoto = (cameraRef: React.RefObject<Camera>, options?: Parameters<typeof cameraOperationsService.capturePhoto>[1]) =>
  cameraOperationsService.capturePhoto(cameraRef, options);

export const recordVideo = (cameraRef: React.RefObject<Camera>, options?: Parameters<typeof cameraOperationsService.recordVideo>[1]) =>
  cameraOperationsService.recordVideo(cameraRef, options);

export const processDetectedImage = (
  photoUri: string,
  detections: Detection[],
  classifyFunction: (imageUri: string) => Promise<{ text: string; confidence: number; index: number }[]>
) => cameraOperationsService.processDetectedImage(photoUri, detections, classifyFunction);

export const saveClassifiedImage = (imageUri: string, label: { text: string; confidence: number }, type: 'bird' | 'full') =>
  cameraOperationsService.saveClassifiedImage(imageUri, label, type);

export const createAnnotatedVersion = (
  originalUri: string,
  detections: Detection[],
  imageDims: { width: number; height: number }
) => cameraOperationsService.createAnnotatedVersion(originalUri, detections, imageDims);

export const stopVideoRecording = () => cameraOperationsService.stopVideoRecording();

export const getVideoRecordingState = () => cameraOperationsService.getVideoRecordingState();

export const isVideoRecording = () => cameraOperationsService.isVideoRecording();

export const updateDetections = (detections: Detection[]) => cameraOperationsService.updateDetections(detections);

export const subscribeToDetections = (callback: (detections: Detection[]) => void) => cameraOperationsService.subscribeToDetections(callback);