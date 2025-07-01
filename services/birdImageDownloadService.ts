/**
 * Bird Image Download Service
 * 
 * Handles downloading bird images from GitHub to local app storage.
 * Provides sequential download with progress tracking for initial app setup.
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { genusLoaders } from './generated/genusIndex';

const BIRD_IMAGES_DIR = `${FileSystem.documentDirectory}birdImages/`;
const DOWNLOAD_COMPLETE_KEY = 'bird_images_downloaded';
const DOWNLOAD_PROGRESS_KEY = 'bird_images_download_progress';

export interface DownloadProgress {
  totalImages: number;
  downloadedImages: number;
  currentGenus?: string;
  isComplete: boolean;
}

class BirdImageDownloadService {
  private isDownloading = false;
  private abortController: AbortController | null = null;

  /**
   * Check if all bird images have been downloaded
   */
  async isDownloadComplete(): Promise<boolean> {
    try {
      const complete = await AsyncStorage.getItem(DOWNLOAD_COMPLETE_KEY);
      return complete === 'true';
    } catch (error) {
      console.error('Error checking download status:', error);
      return false;
    }
  }

  /**
   * Get current download progress
   */
  async getDownloadProgress(): Promise<DownloadProgress | null> {
    try {
      const progress = await AsyncStorage.getItem(DOWNLOAD_PROGRESS_KEY);
      return progress ? JSON.parse(progress) : null;
    } catch (error) {
      console.error('Error getting download progress:', error);
      return null;
    }
  }

  /**
   * Save download progress
   */
  private async saveProgress(progress: DownloadProgress): Promise<void> {
    try {
      await AsyncStorage.setItem(DOWNLOAD_PROGRESS_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving download progress:', error);
    }
  }

  /**
   * Ensure bird images directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(BIRD_IMAGES_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(BIRD_IMAGES_DIR, { intermediates: true });
    }
  }

  /**
   * Download a single image
   */
  private async downloadImage(filename: string, url: string): Promise<boolean> {
    try {
      const localPath = `${BIRD_IMAGES_DIR}${filename}`;
      
      // Check if already exists
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        return true;
      }

      // Download from GitHub
      const downloadResult = await FileSystem.downloadAsync(url, localPath);
      
      if (downloadResult.status === 200) {
        return true;
      } else {
        console.error(`Failed to download ${filename}: HTTP ${downloadResult.status}`);
        return false;
      }
    } catch (error) {
      console.error(`Error downloading ${filename}:`, error);
      return false;
    }
  }

  /**
   * Count total images across all genera
   */
  private async countTotalImages(): Promise<number> {
    let total = 0;
    const genera = Object.keys(genusLoaders);
    
    for (const genus of genera) {
      try {
        const loader = genusLoaders[genus];
        const module = loader();
        const genusMap = module.default || {};
        total += Object.keys(genusMap).filter(key => genusMap[key] !== null).length;
      } catch (error) {
        console.error(`Error loading genus ${genus}:`, error);
      }
    }
    
    return total;
  }

  /**
   * Download all bird images sequentially
   */
  async downloadAllImages(
    onProgress?: (current: number, total: number, currentGenus?: string) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (this.isDownloading) {
      console.warn('Download already in progress');
      return;
    }

    // Check if already downloaded
    const isComplete = await this.isDownloadComplete();
    if (isComplete) {
      console.log('Bird images already downloaded');
      onComplete?.();
      return;
    }

    this.isDownloading = true;
    this.abortController = new AbortController();

    try {
      await this.ensureDirectoryExists();

      // Get or restore progress
      let progress = await this.getDownloadProgress();
      if (!progress) {
        const totalImages = await this.countTotalImages();
        progress = {
          totalImages,
          downloadedImages: 0,
          isComplete: false
        };
      }

      const genera = Object.keys(genusLoaders);
      let downloadedImages = progress.downloadedImages;

      // Download each genus
      for (const genus of genera) {
        if (this.abortController.signal.aborted) {
          throw new Error('Download aborted');
        }

        progress.currentGenus = genus;
        
        try {
          const loader = genusLoaders[genus];
          const module = loader();
          const genusMap = module.default || {};

          // Download each image in the genus
          for (const [filename, url] of Object.entries(genusMap)) {
            if (this.abortController.signal.aborted) {
              throw new Error('Download aborted');
            }

            if (url && typeof url === 'string') {
              const success = await this.downloadImage(filename, url);
              if (success) {
                downloadedImages++;
                progress.downloadedImages = downloadedImages;
                
                // Update progress
                onProgress?.(downloadedImages, progress.totalImages, genus);
                
                // Save progress periodically (every 10 images)
                if (downloadedImages % 10 === 0) {
                  await this.saveProgress(progress);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing genus ${genus}:`, error);
        }
      }

      // Mark as complete
      await AsyncStorage.setItem(DOWNLOAD_COMPLETE_KEY, 'true');
      progress.isComplete = true;
      await this.saveProgress(progress);
      
      console.log(`Downloaded ${downloadedImages} bird images successfully`);
      onComplete?.();
      
    } catch (error) {
      console.error('Error downloading bird images:', error);
      onError?.(error as Error);
    } finally {
      this.isDownloading = false;
      this.abortController = null;
    }
  }

  /**
   * Abort ongoing download
   */
  abortDownload(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Check if a specific image exists locally
   */
  async imageExists(filename: string): Promise<boolean> {
    try {
      const localPath = `${BIRD_IMAGES_DIR}${filename}`;
      const info = await FileSystem.getInfoAsync(localPath);
      return info.exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get local image URI
   */
  getLocalImageUri(filename: string): string {
    return `${BIRD_IMAGES_DIR}${filename}`;
  }

  /**
   * Download a single image if needed
   */
  async ensureImageDownloaded(filename: string, url: string): Promise<string | null> {
    try {
      await this.ensureDirectoryExists();
      
      const localPath = `${BIRD_IMAGES_DIR}${filename}`;
      const exists = await this.imageExists(filename);
      
      if (exists) {
        return localPath;
      }

      const success = await this.downloadImage(filename, url);
      return success ? localPath : null;
    } catch (error) {
      console.error(`Error ensuring image ${filename}:`, error);
      return null;
    }
  }

  /**
   * Clear all downloaded images (for debugging/reset)
   */
  async clearAllImages(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(BIRD_IMAGES_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(BIRD_IMAGES_DIR, { idempotent: true });
      }
      
      await AsyncStorage.removeItem(DOWNLOAD_COMPLETE_KEY);
      await AsyncStorage.removeItem(DOWNLOAD_PROGRESS_KEY);
      
      console.log('All bird images cleared');
    } catch (error) {
      console.error('Error clearing images:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalImages: number;
    downloadedImages: number;
    storageUsedMB: number;
  }> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(BIRD_IMAGES_DIR);
      if (!dirInfo.exists) {
        return { totalImages: 0, downloadedImages: 0, storageUsedMB: 0 };
      }

      const files = await FileSystem.readDirectoryAsync(BIRD_IMAGES_DIR);
      const downloadedImages = files.length;

      // Estimate storage (rough calculation)
      const avgImageSizeKB = 50; // Estimated average
      const storageUsedMB = (downloadedImages * avgImageSizeKB) / 1024;

      const totalImages = await this.countTotalImages();

      return {
        totalImages,
        downloadedImages,
        storageUsedMB: Math.round(storageUsedMB * 10) / 10
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return { totalImages: 0, downloadedImages: 0, storageUsedMB: 0 };
    }
  }
}

// Create singleton instance
export const birdImageDownloadService = new BirdImageDownloadService();

// Convenience exports
export const downloadAllBirdImages = (
  onProgress?: (current: number, total: number, currentGenus?: string) => void,
  onComplete?: () => void,
  onError?: (error: Error) => void
) => birdImageDownloadService.downloadAllImages(onProgress, onComplete, onError);

export const isDownloadComplete = () => birdImageDownloadService.isDownloadComplete();
export const getDownloadProgress = () => birdImageDownloadService.getDownloadProgress();
export const ensureImageDownloaded = (filename: string, url: string) => 
  birdImageDownloadService.ensureImageDownloaded(filename, url);
export const getLocalImageUri = (filename: string) => birdImageDownloadService.getLocalImageUri(filename);
export const getBirdImageStorageStats = () => birdImageDownloadService.getStorageStats();