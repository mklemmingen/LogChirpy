/**
 * Photo Storage Service for LogChirpy
 * 
 * service for managing photo storage across app directory and device gallery.
 * Integrates with existing uriUtils and gallery system.
 */

import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import {ensureGalleryDirectory, filePathToUri} from './uriUtils';

export interface PhotoSaveResult {
    appUri: string;
    filename: string;
    size: number;
    success: boolean;
    error?: string;
}

class PhotoStorageService {
    private readonly PHOTO_PREFIX = 'logchirpy_photo_';
    private readonly GALLERY_DIR = 'gallery/';

    /**
     * Generate a unique filename for photos
     */
    generateFilename(prefix: string = 'photo'): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const random = Math.random().toString(36).substring(2, 8);
        return `${this.PHOTO_PREFIX}${prefix}_${timestamp}_${random}.jpg`;
    }

    /**
     * Save photo to app directory for gallery.tsx access
     */
    async saveToAppDirectory(sourceUri: string, filename?: string): Promise<string> {
        try {
            // Ensure gallery directory exists
            await ensureGalleryDirectory();

            // Generate filename if not provided
            const photoFilename = filename || this.generateFilename();
            
            // Create destination path in gallery directory
            const galleryDir = `${FileSystem.documentDirectory}${this.GALLERY_DIR}`;
            const destPath = `${galleryDir}${photoFilename}`;

            // Copy file to app directory
            await FileSystem.copyAsync({
                from: sourceUri,
                to: destPath
            });

            // Return proper URI
            return filePathToUri(destPath);
        } catch (error) {
            console.error('Failed to save to app directory:', error);
            throw new Error(`Failed to save photo to app directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Save photo to device gallery (Photos app)
     */
    async saveToDeviceGallery(appUri: string): Promise<void> {
        try {
            // Request media library permissions
            const { status } = await MediaLibrary.requestPermissionsAsync();
            
            if (status !== 'granted') {
                console.warn('Media library permission not granted, skipping device gallery save');
                return;
            }

            // Save to device gallery
            await MediaLibrary.saveToLibraryAsync(appUri);
            console.log('Photo saved to device gallery successfully');
        } catch (error) {
            console.error('Failed to save to device gallery:', error);
            // Don't throw error - device gallery save is optional
        }
    }

    /**
     * Save high-confidence detection image with proper classification metadata
     */
    async saveDetectionImage(
        sourceUri: string,
        label: { text: string; confidence: number },
        type: 'bird' | 'full',
        confidenceThreshold: number
    ): Promise<PhotoSaveResult> {
        if (label.confidence < confidenceThreshold) {
            return {
                appUri: '',
                filename: '',
                size: 0,
                success: false,
                error: `Confidence ${label.confidence} below threshold ${confidenceThreshold}`
            };
        }

        try {
            // Generate specialized filename for detection
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const milliseconds = Date.now();
            const safeLabel = label.text.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const confidenceStr = Math.round(label.confidence * 100).toString().padStart(3, '0');
            const filename = `${type}_${safeLabel}_conf${confidenceStr}_${timestamp}_${milliseconds}.jpg`;

            // Save to app directory with detection metadata
            const result = await this.savePhoto(sourceUri, {
                filename,
                saveToDevice: false, // Don't auto-save detections to device gallery
                addMetadata: false  // We'll add custom detection metadata
            });

            if (result.success) {
                // Add detection-specific metadata
                await this.addDetectionMetadata(result.appUri, label, type);
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                appUri: '',
                filename: '',
                size: 0,
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Complete photo save workflow - saves to both app and device gallery
     */
    async savePhoto(sourceUri: string, options: {
        saveToDevice?: boolean;
        filename?: string;
        addMetadata?: boolean;
    } = {}): Promise<PhotoSaveResult> {
        const { saveToDevice = true, filename, addMetadata = true } = options;

        try {
            // 1. Save to app directory (required for gallery.tsx)
            const appUri = await this.saveToAppDirectory(sourceUri, filename);

            // 2. Get file info
            const fileInfo = await FileSystem.getInfoAsync(appUri);
            const photoFilename = filename || this.extractFilename(appUri);
            const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

            // 3. Save to device gallery (optional)
            if (saveToDevice) {
                try {
                    await this.saveToDeviceGallery(appUri);
                } catch (error) {
                    console.warn('Device gallery save failed, continuing...', error);
                }
            }

            // 4. Add metadata if requested
            if (addMetadata) {
                await this.addPhotoMetadata(appUri);
            }

            return {
                appUri,
                filename: photoFilename,
                size: fileSize,
                success: true
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Photo save failed:', errorMessage);
            
            return {
                appUri: '',
                filename: filename || 'unknown',
                size: 0,
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Add metadata to photo for gallery.tsx integration
     */
    private async addPhotoMetadata(photoUri: string): Promise<void> {
        try {
            // Create metadata file alongside photo
            const metadataPath = photoUri.replace('.jpg', '.meta.json');
            
            const metadata = {
                timestamp: new Date().toISOString(),
                type: 'manual_capture',
                source: 'camera',
                classification: null,
                confidence: null,
                processed: false
            };

            await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(metadata));
        } catch (error) {
            console.warn('Failed to add photo metadata:', error);
            // Don't throw - metadata is optional
        }
    }

    /**
     * Add detection-specific metadata to photo
     */
    private async addDetectionMetadata(
        photoUri: string,
        label: { text: string; confidence: number },
        type: 'bird' | 'full'
    ): Promise<void> {
        try {
            // Create metadata file alongside photo
            const metadataPath = photoUri.replace('.jpg', '.meta.json');
            
            const metadata = {
                timestamp: new Date().toISOString(),
                type: 'detection',
                detectionType: type,
                source: 'ml_pipeline',
                classification: label.text,
                confidence: label.confidence,
                processed: true
            };

            await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(metadata));
        } catch (error) {
            console.warn('Failed to add detection metadata:', error);
            // Don't throw - metadata is optional
        }
    }

    /**
     * Extract filename from URI
     */
    private extractFilename(uri: string): string {
        return uri.split('/').pop() || 'unknown.jpg';
    }

    /**
     * Cleanup temporary photo files
     */
    async cleanupTempFile(uri: string): Promise<void> {
        try {
            // Only cleanup if it's a temp file (contains 'cache' or 'tmp')
            if (uri.includes('cache') || uri.includes('tmp')) {
                const fileInfo = await FileSystem.getInfoAsync(uri);
                if (fileInfo.exists) {
                    await FileSystem.deleteAsync(uri);
                    console.log('Cleaned up temp file:', uri);
                }
            }
        } catch (error) {
            console.warn('Failed to cleanup temp file:', error);
            // Don't throw - cleanup is optional
        }
    }

    /**
     * Get all photos from app gallery directory
     */
    async getAppGalleryPhotos(): Promise<string[]> {
        try {
            const galleryDir = `${FileSystem.documentDirectory}${this.GALLERY_DIR}`;
            const files = await FileSystem.readDirectoryAsync(galleryDir);
            
            // Filter for image files and return full URIs
            return files
                .filter(file => file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg') || file.toLowerCase().endsWith('.png'))
                .map(file => filePathToUri(`${galleryDir}${file}`))
                .sort()
                .reverse(); // Newest first
        } catch (error) {
            console.error('Failed to read app gallery:', error);
            return [];
        }
    }

    /**
     * Check if storage is available
     */
    async checkStorageAvailable(): Promise<boolean> {
        try {
            const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
            const requiredSpace = 10 * 1024 * 1024; // 10MB minimum
            return freeDiskStorage > requiredSpace;
        } catch (error) {
            console.error('Failed to check storage:', error);
            return false;
        }
    }
}

// Export singleton instance
export const photoStorageService = new PhotoStorageService();

// Export convenience functions
export const savePhoto = (sourceUri: string, options?: Parameters<typeof photoStorageService.savePhoto>[1]) => 
    photoStorageService.savePhoto(sourceUri, options);

export const saveDetectionImage = (
    sourceUri: string,
    label: { text: string; confidence: number },
    type: 'bird' | 'full',
    confidenceThreshold: number
) => photoStorageService.saveDetectionImage(sourceUri, label, type, confidenceThreshold);

export const generatePhotoFilename = (prefix?: string) => 
    photoStorageService.generateFilename(prefix);

export const getAppGalleryPhotos = () => 
    photoStorageService.getAppGalleryPhotos();

export const cleanupTempFile = (uri: string) => 
    photoStorageService.cleanupTempFile(uri);