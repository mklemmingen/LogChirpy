/**
 * Bird Image Download Service
 * 
 * Handles downloading bird images from GitHub to local app storage.
 * Provides sequential download with progress tracking for initial app setup.
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { unzip } from 'react-native-zip-archive';
import { genusLoaders } from './generated/genusIndex';

const BIRD_IMAGES_DIR = `${FileSystem.documentDirectory}birdImages/`;
const DOWNLOAD_COMPLETE_KEY = 'bird_images_downloaded';
const DOWNLOAD_PROGRESS_KEY = 'bird_images_download_progress';
const DOWNLOAD_TIMEOUT_MS = 10000; // 10 seconds per image download
const ZIP_DOWNLOAD_TIMEOUT_MS = 300000; // 5 minutes for zip download
const CONCURRENT_DOWNLOADS = 3; // Number of simultaneous downloads
const RATE_LIMIT_DELAY_MS = 100; // Delay between starting new downloads (100ms = 10 downloads/second)

// GitHub URLs for bird image zip files
const BIRD_ZIP_URLS = [
  'https://github.com/mklemmingen/LogChirpy/raw/main/assets/images/birds/_birds1.zip',
  'https://github.com/mklemmingen/LogChirpy/raw/main/assets/images/birds/_birds2.zip'
];

export interface DownloadProgress {
  totalImages: number;
  downloadedImages: number;
  currentGenus?: string;
  isComplete: boolean;
}

interface DownloadTask {
  filename: string;
  url: string;
  genus: string;
}

class BirdImageDownloadService {
  private isDownloading = false;
  private abortController: AbortController | null = null;
  private downloadQueue: DownloadTask[] = [];
  private activeDownloads = new Set<Promise<boolean>>();

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
   * Check network connectivity
   */
  private async isNetworkAvailable(): Promise<boolean> {
    try {
      const networkState = await NetInfo.fetch();
      return networkState.isConnected === true && networkState.isInternetReachable === true;
    } catch (error) {
      console.error('Network check failed:', error);
      return false;
    }
  }

  /**
   * Download and extract ZIP files containing bird images
   */
  private async downloadAndExtractZips(
    onProgress?: (current: number, total: number, currentGenus?: string) => void
  ): Promise<number> {
    console.log('Starting ZIP download and extraction process');
    let extractedImageCount = 0;
    
    try {
      await this.ensureDirectoryExists();
      
      for (let i = 0; i < BIRD_ZIP_URLS.length; i++) {
        const zipUrl = BIRD_ZIP_URLS[i];
        const zipName = `_birds${i + 1}.zip`;
        
        console.log(`Downloading ${zipName} from ${zipUrl}`);
        
        // Update progress for download phase
        onProgress?.(extractedImageCount, 9331, `Downloading ${zipName}`);
        
        // Download ZIP file
        const zipPath = `${FileSystem.documentDirectory}${zipName}`;
        const downloadPromise = FileSystem.downloadAsync(zipUrl, zipPath);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('ZIP download timeout')), ZIP_DOWNLOAD_TIMEOUT_MS)
        );

        const downloadResult = await Promise.race([downloadPromise, timeoutPromise]);
        
        if (downloadResult.status !== 200) {
          console.error(`Failed to download ${zipName}: HTTP ${downloadResult.status}`);
          continue;
        }

        console.log(`Successfully downloaded ${zipName}, now extracting...`);
        
        // Update progress for extraction phase
        onProgress?.(extractedImageCount, 9331, `Extracting ${zipName}`);
        
        // Extract ZIP file
        await zip.unzip(zipPath, BIRD_IMAGES_DIR);
        
        // Count extracted files in this zip
        const extractedFiles = await this.countExtractedFiles();
        extractedImageCount = extractedFiles;
        
        // Update progress after extraction
        onProgress?.(extractedImageCount, 9331, `Extracted ${zipName}`);
        
        // Clean up ZIP file
        await FileSystem.deleteAsync(zipPath, { idempotent: true });
        
        console.log(`Successfully extracted ${zipName} - total images: ${extractedImageCount}`);
      }
      
      return extractedImageCount;
    } catch (error) {
      console.error('Error during ZIP download and extraction:', error);
      return extractedImageCount;
    }
  }

  /**
   * Count how many images have been extracted
   */
  private async countExtractedFiles(): Promise<number> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(BIRD_IMAGES_DIR);
      if (!dirInfo.exists) {
        return 0;
      }
      
      const files = await FileSystem.readDirectoryAsync(BIRD_IMAGES_DIR);
      // Count only image files (webp, jpg, png)
      const imageFiles = files.filter(file => 
        file.toLowerCase().endsWith('.webp') || 
        file.toLowerCase().endsWith('.jpg') || 
        file.toLowerCase().endsWith('.png')
      );
      
      return imageFiles.length;
    } catch (error) {
      console.error('Error counting extracted files:', error);
      return 0;
    }
  }

  /**
   * Download a single image with timeout
   */
  private async downloadImage(filename: string, url: string): Promise<boolean> {
    try {
      const localPath = `${BIRD_IMAGES_DIR}${filename}`;
      
      // Check if already exists
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        return true;
      }

      // Download from GitHub with timeout
      const downloadPromise = FileSystem.downloadAsync(url, localPath);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Download timeout')), DOWNLOAD_TIMEOUT_MS)
      );

      const downloadResult = await Promise.race([downloadPromise, timeoutPromise]);
      
      if (downloadResult.status === 200) {
        return true;
      } else {
        console.error(`Failed to download ${filename}: HTTP ${downloadResult.status}`);
        return false;
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Download timeout') {
        console.error(`Timeout downloading ${filename}`);
      } else {
        console.error(`Error downloading ${filename}:`, error);
      }
      return false;
    }
  }

  /**
   * Process download queue with concurrent downloads and rate limiting
   */
  private async processConcurrentDownloads(
    onProgress?: (current: number, total: number, currentGenus?: string) => void
  ): Promise<number> {
    let downloadedCount = 0;
    const totalTasks = this.downloadQueue.length;
    
    while (this.downloadQueue.length > 0 && !this.abortController?.signal.aborted) {
      // Start new downloads up to the concurrent limit
      while (this.activeDownloads.size < CONCURRENT_DOWNLOADS && this.downloadQueue.length > 0) {
        const task = this.downloadQueue.shift();
        if (!task) break;

        // Rate limiting: small delay between starting downloads
        if (this.activeDownloads.size > 0) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
        }

        const downloadPromise = this.downloadImage(task.filename, task.url)
          .then(success => {
            if (success) {
              downloadedCount++;
              onProgress?.(downloadedCount, totalTasks, task.genus);
            }
            return success;
          })
          .finally(() => {
            this.activeDownloads.delete(downloadPromise);
          });

        this.activeDownloads.add(downloadPromise);
      }

      // Wait for at least one download to complete before continuing
      if (this.activeDownloads.size > 0) {
        await Promise.race(this.activeDownloads);
      }
    }

    // Wait for all remaining downloads to complete
    if (this.activeDownloads.size > 0) {
      await Promise.all(this.activeDownloads);
    }

    return downloadedCount;
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

    // Check network connectivity
    const networkAvailable = await this.isNetworkAvailable();
    if (!networkAvailable) {
      console.warn('No internet connection - skipping image download');
      onError?.(new Error('No internet connection available'));
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

      // Try ZIP download first for bulk image extraction
      console.log('Attempting bulk ZIP download and extraction...');
      const extractedImageCount = await this.downloadAndExtractZips(
        (current, total, currentOperation) => {
          progress.downloadedImages = current;
          onProgress?.(current, total, currentOperation);
        }
      );

      console.log(`ZIP extraction completed. Extracted ${extractedImageCount} images.`);

      // Check if ZIP download was successful (extracted most images)
      const expectedImageCount = await this.countTotalImages();
      const successRate = extractedImageCount / expectedImageCount;
      
      if (successRate >= 0.85) { // If 85%+ of images were extracted successfully
        console.log(`ZIP download successful (${Math.round(successRate * 100)}% success rate). Skipping individual downloads.`);
        progress.downloadedImages = extractedImageCount;
        progress.totalImages = extractedImageCount;
      } else {
        console.log(`ZIP download incomplete (${Math.round(successRate * 100)}% success rate). Falling back to individual downloads for missing images.`);
        
        // Build download queue for missing images only
        this.downloadQueue = [];
        const genera = Object.keys(genusLoaders);
        
        for (const genus of genera) {
          try {
            const loader = genusLoaders[genus];
            const module = loader();
            const genusMap = module.default || {};

            // Add missing images from this genus to the queue
            for (const [filename, url] of Object.entries(genusMap)) {
              if (url && typeof url === 'string') {
                const exists = await this.imageExists(filename);
                if (!exists) {
                  this.downloadQueue.push({ filename, url, genus });
                }
              }
            }
          } catch (error) {
            console.error(`Error loading genus ${genus}:`, error);
          }
        }

        console.log(`Queued ${this.downloadQueue.length} missing images for individual download`);

        if (this.downloadQueue.length > 0) {
          // Process remaining downloads concurrently
          const downloadedCount = await this.processConcurrentDownloads(
            (current, total, genus) => {
              const totalDownloaded = extractedImageCount + current;
              progress.downloadedImages = totalDownloaded;
              
              // Update progress
              onProgress?.(totalDownloaded, progress.totalImages, genus);
              
              // Save progress periodically (every 10 images)
              if (totalDownloaded % 10 === 0) {
                this.saveProgress(progress);
              }
            }
          );
          
          progress.downloadedImages = extractedImageCount + downloadedCount;
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