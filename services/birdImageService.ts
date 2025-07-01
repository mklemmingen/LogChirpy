/**
 * Bird Image Service
 * 
 * Provides access to bird images by Latin scientific name.
 * Uses the local bird image manifest and assets to retrieve image URIs.
 */

import birdManifest from '../assets/images/bird_images_manifest.json';
import { genusImageLoader } from './genusImageLoader';
import { getLocalImageUri, ensureImageDownloaded } from './birdImageDownloadService';
import { genusLoaders } from './generated/genusIndex';
import * as FileSystem from 'expo-file-system';

export interface BirdImageInfo {
  latinName: string;
  commonName: string;
  imageFile: string | null;
  hasImage: boolean;
  family: string;
  speciesCode: string;
}

export interface BirdImageResult {
  imageUri: string | null;
  info: BirdImageInfo | null;
  found: boolean;
}

class BirdImageService {
  private imageCache = new Map<string, BirdImageResult>();
  private readonly basePath = '../assets/images/birds/';

  /**
   * Get bird image URI by Latin scientific name
   */
  getBirdImage(latinName: string): BirdImageResult {
    if (!latinName) {
      return {
        imageUri: null,
        info: null,
        found: false
      };
    }

    // Normalize for cache key
    const cacheKey = latinName.toLowerCase().trim();
    
    // Check cache first
    const cached = this.imageCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Try multiple lookup strategies
    let birdData = null;
    let foundLatinName = latinName;
    
    // 1. Try exact match
    birdData = (birdManifest.images as any)[latinName];
    
    // 2. Try with proper case (capitalize first letter of each word)
    if (!birdData) {
      const properCase = latinName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      birdData = (birdManifest.images as any)[properCase];
      if (birdData) foundLatinName = properCase;
    }
    
    // 3. For subspecies, try base species (first 2 words)
    if (!birdData && latinName.split(' ').length > 2) {
      const baseSpecies = latinName.split(' ').slice(0, 2).join(' ');
      // Try with original case
      birdData = (birdManifest.images as any)[baseSpecies];
      if (birdData) {
        foundLatinName = baseSpecies;
      } else {
        // Try with proper case
        const baseSpeciesProper = baseSpecies
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        birdData = (birdManifest.images as any)[baseSpeciesProper];
        if (birdData) foundLatinName = baseSpeciesProper;
      }
    }
    
    // 4. Try case variations as last resort
    if (!birdData) {
      const variations = [
        latinName.toLowerCase(),
        latinName.toUpperCase(),
        latinName.charAt(0).toUpperCase() + latinName.slice(1).toLowerCase()
      ];
      
      for (const variant of variations) {
        birdData = (birdManifest.images as any)[variant];
        if (birdData) {
          foundLatinName = variant;
          break;
        }
      }
    }
    
    // If still not found, return not found result
    if (!birdData) {
      const result: BirdImageResult = {
        imageUri: null,
        info: null,
        found: false
      };
      this.imageCache.set(cacheKey, result);
      return result;
    }

    // Build the result with found data
    const info: BirdImageInfo = {
      latinName: foundLatinName,
      commonName: birdData.common_name,
      imageFile: birdData.image_file,
      hasImage: birdData.has_image,
      family: birdData.family,
      speciesCode: birdData.species_code
    };

    let imageUri: string | null = null;
    if (birdData.has_image && birdData.image_file) {
      // For React Native, we need to use require() for local assets
      // We'll return the path and let the component handle the require()
      imageUri = `${this.basePath}${birdData.image_file}`;
    }

    const result: BirdImageResult = {
      imageUri,
      info,
      found: true
    };

    this.imageCache.set(cacheKey, result);
    return result;
  }

  /**
   * Get bird image source for React Native Image component
   * Returns synchronously but triggers background download if needed
   */
  getBirdImageSource(latinName: string): any {
    const result = this.getBirdImage(latinName);
    
    if (!result.found || !result.info) {
      return null;
    }

    const filename = result.info.imageFile;
    if (!filename) {
      return null;
    }

    try {
      // Always return the local URI immediately
      const localUri = getLocalImageUri(filename);
      
      // Trigger background download if image doesn't exist
      this.triggerBackgroundDownload(latinName, filename);
      
      // Return local URI for React Native Image component
      return { uri: localUri };
    } catch (error) {
      console.warn('Failed to get bird image:', filename, error);
      return null;
    }
  }

  /**
   * Trigger background download if image doesn't exist locally
   */
  private async triggerBackgroundDownload(latinName: string, filename: string): Promise<void> {
    try {
      // Check if image already exists
      const exists = await (async () => {
        try {
          const info = await FileSystem.getInfoAsync(getLocalImageUri(filename));
          return info.exists;
        } catch {
          return false;
        }
      })();

      if (exists) {
        return; // Image already exists, no need to download
      }

      // Try to get the image URL from genus map
      const genus = latinName.split(' ')[0];
      const genusLoader = genusLoaders[genus];
      
      if (genusLoader) {
        const genusModule = genusLoader();
        const genusMap = genusModule.default || {};
        const githubUrl = genusMap[filename];
        
        if (githubUrl && typeof githubUrl === 'string') {
          // Download in background - don't await
          ensureImageDownloaded(filename, githubUrl).then(
            (uri) => {
              if (uri) {
                console.log(`Downloaded missing image: ${filename}`);
              }
            },
            (error) => {
              console.warn(`Failed to download ${filename}:`, error);
            }
          );
        }
      }
    } catch (error) {
      // Silently fail - this is a background operation
      console.warn('Background download error:', error);
    }
  }


  /**
   * Search for birds by common name (fuzzy search)
   */
  searchBirdsByCommonName(query: string): BirdImageInfo[] {
    if (!query || query.length < 2) {
      return [];
    }

    const results: BirdImageInfo[] = [];
    const queryLower = query.toLowerCase();

    Object.entries(birdManifest.images as any).forEach(([latinName, birdData]: [string, any]) => {
      if (birdData.common_name.toLowerCase().includes(queryLower)) {
        results.push({
          latinName,
          commonName: birdData.common_name,
          imageFile: birdData.image_file,
          hasImage: birdData.has_image,
          family: birdData.family,
          speciesCode: birdData.species_code
        });
      }
    });

    return results.sort((a, b) => a.commonName.localeCompare(b.commonName));
  }

  /**
   * Get all available bird images
   */
  getAllAvailableBirds(): BirdImageInfo[] {
    const birds: BirdImageInfo[] = [];

    Object.entries(birdManifest.images as any).forEach(([latinName, birdData]: [string, any]) => {
      birds.push({
        latinName,
        commonName: birdData.common_name,
        imageFile: birdData.image_file,
        hasImage: birdData.has_image,
        family: birdData.family,
        speciesCode: birdData.species_code
      });
    });

    return birds.sort((a, b) => a.commonName.localeCompare(b.commonName));
  }

  /**
   * Get birds with images only
   */
  getBirdsWithImages(): BirdImageInfo[] {
    return this.getAllAvailableBirds().filter(bird => bird.hasImage);
  }

  /**
   * Get statistics about the bird image collection
   */
  getStats() {
    const total = Object.keys(birdManifest.images as any).length;
    const withImages = this.getBirdsWithImages().length;
    
    return {
      totalSpecies: total,
      speciesWithImages: withImages,
      coveragePercentage: Math.round((withImages / total) * 100),
      lastUpdated: birdManifest.generated_at
    };
  }

  /**
   * Clear the image cache
   */
  clearCache(): void {
    this.imageCache.clear();
    console.log('Bird image cache cleared');
  }
}

// Create singleton instance
export const birdImageService = new BirdImageService();

// Convenience functions
export const getBirdImage = (latinName: string) => birdImageService.getBirdImage(latinName);
export const getBirdImageSource = (latinName: string) => birdImageService.getBirdImageSource(latinName);
export const searchBirdImages = (query: string) => birdImageService.searchBirdsByCommonName(query);
export const getBirdsWithImages = () => birdImageService.getBirdsWithImages();
export const getBirdImageStats = () => birdImageService.getStats();