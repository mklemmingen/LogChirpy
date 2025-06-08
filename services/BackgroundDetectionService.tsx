import { AppRegistry, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BackgroundDetectionTask {
  scheduleBackgroundDetection: () => void;
  stopBackgroundDetection: () => void;
  getCachedImages: () => Promise<string[]>;
  processImageOffline: (imagePath: string) => Promise<any>;
  syncDetectionResults: () => Promise<void>;
}

class BackgroundDetectionService implements BackgroundDetectionTask {
  private static instance: BackgroundDetectionService;
  private isScheduled = false;

  static getInstance(): BackgroundDetectionService {
    if (!BackgroundDetectionService.instance) {
      BackgroundDetectionService.instance = new BackgroundDetectionService();
    }
    return BackgroundDetectionService.instance;
  }

  scheduleBackgroundDetection() {
    if (this.isScheduled || Platform.OS !== 'android') return;

    console.log('Scheduling background bird detection service...');
    
    try {
      // Mock background worker implementation
      // In production, this would use react-native-background-worker or similar
      this.simulateBackgroundWork();
      this.isScheduled = true;
      
      console.log('Background detection service scheduled successfully');
    } catch (error) {
      console.error('Failed to schedule background detection:', error);
    }
  }

  stopBackgroundDetection() {
    if (!this.isScheduled) return;
    
    console.log('Stopping background detection service...');
    this.isScheduled = false;
  }

  private simulateBackgroundWork() {
    // Simulate periodic background processing
    setInterval(async () => {
      if (!this.isScheduled) return;
      
      try {
        console.log('Running background detection task...');
        
        const cachedImages = await this.getCachedImages();
        console.log(`Processing ${cachedImages.length} cached images`);
        
        for (const image of cachedImages.slice(0, 3)) { // Process max 3 images
          await this.processImageOffline(image);
        }
        
        await this.syncDetectionResults();
        
        console.log('Background detection task completed');
      } catch (error) {
        console.error('Background detection error:', error);
      }
    }, 900000); // 15 minutes (Android minimum for background tasks)
  }

  async getCachedImages(): Promise<string[]> {
    try {
      const cachedImagesJson = await AsyncStorage.getItem('cached_bird_images');
      if (cachedImagesJson) {
        return JSON.parse(cachedImagesJson);
      }
      return [];
    } catch (error) {
      console.error('Error retrieving cached images:', error);
      return [];
    }
  }

  async processImageOffline(imagePath: string): Promise<any> {
    try {
      console.log(`Processing offline image: ${imagePath}`);
      
      // Mock offline processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockResult = {
        imagePath,
        detections: [
          {
            species: 'Common Bird',
            confidence: 0.75,
            timestamp: new Date().toISOString(),
            processed_offline: true
          }
        ],
        processedAt: new Date().toISOString()
      };
      
      // Store result for later sync
      await this.storeOfflineResult(mockResult);
      
      return mockResult;
    } catch (error) {
      console.error(`Error processing image ${imagePath}:`, error);
      throw error;
    }
  }

  async syncDetectionResults(): Promise<void> {
    try {
      console.log('Syncing offline detection results...');
      
      const offlineResults = await this.getOfflineResults();
      
      if (offlineResults.length === 0) {
        console.log('No offline results to sync');
        return;
      }
      
      // Mock sync to cloud/database
      console.log(`Syncing ${offlineResults.length} offline results`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Clear synced results
      await AsyncStorage.removeItem('offline_detection_results');
      
      console.log('Offline results synced successfully');
    } catch (error) {
      console.error('Error syncing detection results:', error);
    }
  }

  private async storeOfflineResult(result: any): Promise<void> {
    try {
      const existingResults = await this.getOfflineResults();
      existingResults.push(result);
      
      await AsyncStorage.setItem(
        'offline_detection_results',
        JSON.stringify(existingResults)
      );
    } catch (error) {
      console.error('Error storing offline result:', error);
    }
  }

  private async getOfflineResults(): Promise<any[]> {
    try {
      const resultsJson = await AsyncStorage.getItem('offline_detection_results');
      return resultsJson ? JSON.parse(resultsJson) : [];
    } catch (error) {
      console.error('Error retrieving offline results:', error);
      return [];
    }
  }
}

// Background task for headless execution
const BackgroundDetectionTask = async () => {
  console.log('Executing background bird detection task...');
  
  try {
    const service = BackgroundDetectionService.getInstance();
    
    // Process any pending offline images
    const cachedImages = await service.getCachedImages();
    
    for (const image of cachedImages.slice(0, 2)) {
      await service.processImageOffline(image);
    }
    
    // Sync results when possible
    await service.syncDetectionResults();
    
    console.log('Background task completed successfully');
  } catch (error) {
    console.error('Background task failed:', error);
  }
};

// Register the background task for React Native
if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('BirdDetectionWorker', () => BackgroundDetectionTask);
}

export default BackgroundDetectionService;