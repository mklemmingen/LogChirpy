/**
 * Genus Image Loader Service
 * 
 * Provides dynamic loading of bird images organized by genus (first word of Latin name).
 * This replaces the monolithic BirdImageMap.ts to solve build memory issues.
 * 
 * Features:
 * - Dynamic imports of genus-specific image maps
 * - Memory-efficient caching of loaded genera
 * - Fallback handling for missing genera
 * - Compatible API with existing birdImageService
 */

import { genusLoaders, hasGenusMap, getGenusFilename } from './generated/genusIndex';

export interface GenusImageMap {
  [filename: string]: any;
}

class GenusImageLoader {
  private genusCache = new Map<string, GenusImageMap>();
  private loadingPromises = new Map<string, Promise<GenusImageMap>>();

  /**
   * Extract genus (first word) from Latin scientific name
   */
  private extractGenus(latinName: string): string | null {
    if (!latinName || typeof latinName !== 'string') {
      return null;
    }
    const parts = latinName.trim().split(' ');
    return parts[0] || null;
  }

  /**
   * Generate expected filename from Latin name
   */
  private generateExpectedFilename(latinName: string): string {
    // Convert Latin name to expected filename format
    const normalized = latinName.toLowerCase().replace(/\s+/g, '_');
    return `${normalized}.webp`;
  }

  /**
   * Load genus image map dynamically
   */
  private async loadGenusMap(genus: string): Promise<GenusImageMap> {
    // Check if already loading
    const existingPromise = this.loadingPromises.get(genus);
    if (existingPromise) {
      return existingPromise;
    }

    // Check cache first
    const cached = this.genusCache.get(genus);
    if (cached) {
      return cached;
    }

    // Create loading promise
    const loadingPromise = this.performGenusLoad(genus);
    this.loadingPromises.set(genus, loadingPromise);

    try {
      const genusMap = await loadingPromise;
      this.genusCache.set(genus, genusMap);
      return genusMap;
    } finally {
      this.loadingPromises.delete(genus);
    }
  }

  /**
   * Perform the actual genus loading
   */
  private async performGenusLoad(genus: string): Promise<GenusImageMap> {
    try {
      if (!hasGenusMap(genus)) {
        console.warn(`No genus map available for: ${genus}`);
        return {};
      }

      const loader = genusLoaders[genus];
      if (!loader) {
        console.warn(`No loader function for genus: ${genus}`);
        return {};
      }

      const module = await loader();
      const genusMap = module.default || {};
      
      console.log(`✅ Loaded genus map for ${genus}: ${Object.keys(genusMap).length} images`);
      return genusMap;
    } catch (error) {
      console.error(`Failed to load genus map for ${genus}:`, error);
      return {};
    }
  }

  /**
   * Get bird image source synchronously (only works with cached genus maps)
   * Returns the require() statement or null if genus not cached
   */
  getBirdImageSourceSync(latinName: string): any {
    if (!latinName || typeof latinName !== 'string') {
      return null;
    }

    const genus = this.extractGenus(latinName);
    if (!genus) {
      console.warn(`Could not extract genus from: ${latinName}`);
      return null;
    }

    // Only work with cached genus maps for synchronous access
    const genusMap = this.genusCache.get(genus);
    if (!genusMap) {
      // Genus not cached yet - return null for backwards compatibility
      // Components can fall back to async loading if needed
      return null;
    }

    // Try multiple filename strategies
    const strategies = [
      // Direct filename lookup (most common case)
      latinName.toLowerCase().replace(/\s+/g, '_') + '.webp',
      latinName.toLowerCase().replace(/\s+/g, '_') + '.jpg',
      
      // Try with subspecies truncation (first 2 words only)
      ...(latinName.split(' ').length > 2 ? [
        latinName.split(' ').slice(0, 2).join(' ').toLowerCase().replace(/\s+/g, '_') + '.webp',
        latinName.split(' ').slice(0, 2).join(' ').toLowerCase().replace(/\s+/g, '_') + '.jpg'
      ] : [])
    ];

    // Try each strategy
    for (const filename of strategies) {
      if (genusMap[filename] && genusMap[filename] !== null) {
        return genusMap[filename];
      }
    }

    // Try case variations for exact matches
    for (const [filename, imageSource] of Object.entries(genusMap)) {
      if (imageSource !== null) {
        const baseFilename = filename.replace(/\.(webp|jpg)$/i, '');
        const expectedBase = latinName.toLowerCase().replace(/\s+/g, '_');
        
        if (baseFilename === expectedBase) {
          return imageSource;
        }
        
        // Try subspecies match
        if (latinName.split(' ').length > 2) {
          const baseSpecies = latinName.split(' ').slice(0, 2).join(' ').toLowerCase().replace(/\s+/g, '_');
          if (baseFilename === baseSpecies) {
            return imageSource;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get bird image source by Latin scientific name (async version)
   * Returns the require() statement needed for React Native Image component
   */
  async getBirdImageSource(latinName: string): Promise<any> {
    if (!latinName || typeof latinName !== 'string') {
      return null;
    }

    const genus = this.extractGenus(latinName);
    if (!genus) {
      console.warn(`Could not extract genus from: ${latinName}`);
      return null;
    }

    try {
      const genusMap = await this.loadGenusMap(genus);
      
      // Try multiple filename strategies
      const strategies = [
        // Direct filename lookup (most common case)
        latinName.toLowerCase().replace(/\s+/g, '_') + '.webp',
        latinName.toLowerCase().replace(/\s+/g, '_') + '.jpg',
        
        // Try with subspecies truncation (first 2 words only)
        ...(latinName.split(' ').length > 2 ? [
          latinName.split(' ').slice(0, 2).join(' ').toLowerCase().replace(/\s+/g, '_') + '.webp',
          latinName.split(' ').slice(0, 2).join(' ').toLowerCase().replace(/\s+/g, '_') + '.jpg'
        ] : [])
      ];

      // Try each strategy
      for (const filename of strategies) {
        if (genusMap[filename] && genusMap[filename] !== null) {
          return genusMap[filename];
        }
      }

      // Try case variations for exact matches
      for (const [filename, imageSource] of Object.entries(genusMap)) {
        if (imageSource !== null) {
          const baseFilename = filename.replace(/\.(webp|jpg)$/i, '');
          const expectedBase = latinName.toLowerCase().replace(/\s+/g, '_');
          
          if (baseFilename === expectedBase) {
            return imageSource;
          }
          
          // Try subspecies match
          if (latinName.split(' ').length > 2) {
            const baseSpecies = latinName.split(' ').slice(0, 2).join(' ').toLowerCase().replace(/\s+/g, '_');
            if (baseFilename === baseSpecies) {
              return imageSource;
            }
          }
        }
      }

      console.log(`No image found for ${latinName} in genus ${genus}`);
      return null;
    } catch (error) {
      console.error(`Error loading image for ${latinName}:`, error);
      return null;
    }
  }

  /**
   * Synchronous check if a bird image might be available
   * Note: This is a best-effort check without loading the genus
   */
  hasGenusAvailable(latinName: string): boolean {
    const genus = this.extractGenus(latinName);
    return genus ? hasGenusMap(genus) : false;
  }

  /**
   * Preload a genus map (useful for performance optimization)
   */
  async preloadGenus(genus: string): Promise<boolean> {
    try {
      await this.loadGenusMap(genus);
      return true;
    } catch (error) {
      console.error(`Failed to preload genus ${genus}:`, error);
      return false;
    }
  }

  /**
   * Preload multiple genera (useful for commonly accessed species)
   */
  async preloadGenera(genera: string[]): Promise<{ loaded: string[], failed: string[] }> {
    const results = await Promise.allSettled(
      genera.map(genus => this.preloadGenus(genus).then(success => ({ genus, success })))
    );

    const loaded: string[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        loaded.push(genera[index]);
      } else {
        failed.push(genera[index]);
      }
    });

    return { loaded, failed };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      loadedGenera: this.genusCache.size,
      currentlyLoading: this.loadingPromises.size,
      cachedGenera: Array.from(this.genusCache.keys()),
      totalMemoryMB: Math.round(
        (Array.from(this.genusCache.values()).reduce((acc, map) => acc + Object.keys(map).length, 0) * 0.1) // Rough estimate
      )
    };
  }

  /**
   * Clear the genus cache (useful for memory management)
   */
  clearCache(): void {
    this.genusCache.clear();
    this.loadingPromises.clear();
    console.log('Genus image cache cleared');
  }

  /**
   * Clear cache for specific genus
   */
  clearGenusCache(genus: string): void {
    this.genusCache.delete(genus);
    console.log(`Cleared cache for genus: ${genus}`);
  }
}

// Create singleton instance
export const genusImageLoader = new GenusImageLoader();

// Convenience functions
export const getBirdImageSource = (latinName: string) => genusImageLoader.getBirdImageSource(latinName);
export const getBirdImageSourceSync = (latinName: string) => genusImageLoader.getBirdImageSourceSync(latinName);
export const hasGenusAvailable = (latinName: string) => genusImageLoader.hasGenusAvailable(latinName);
export const preloadGenus = (genus: string) => genusImageLoader.preloadGenus(genus);
export const preloadGenera = (genera: string[]) => genusImageLoader.preloadGenera(genera);
export const getGenusLoaderStats = () => genusImageLoader.getCacheStats();
export const clearGenusCache = () => genusImageLoader.clearCache();

export default genusImageLoader;