/**
 * Bird Image Service
 * 
 * Provides access to bird images by Latin scientific name.
 * Uses the local bird image manifest and assets to retrieve image URIs.
 */

import birdManifest from '../assets/images/birds/bird_images_manifest.json';

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

    // Check cache first
    const cached = this.imageCache.get(latinName.toLowerCase());
    if (cached) {
      return cached;
    }

    // Search in manifest
    const birdData = (birdManifest.images as any)[latinName];
    
    if (!birdData) {
      const result: BirdImageResult = {
        imageUri: null,
        info: null,
        found: false
      };
      this.imageCache.set(latinName.toLowerCase(), result);
      return result;
    }

    const info: BirdImageInfo = {
      latinName: latinName,
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

    this.imageCache.set(latinName.toLowerCase(), result);
    return result;
  }

  /**
   * Get bird image source for React Native Image component
   * Returns the require() statement needed for local assets
   */
  getBirdImageSource(latinName: string): any {
    const result = this.getBirdImage(latinName);
    
    if (!result.found || !result.imageUri) {
      return null;
    }

    // For local assets, we need to dynamically require based on the filename
    const filename = result.info?.imageFile;
    if (!filename) {
      return null;
    }

    try {
      // Map common bird image files to their require statements
      const imageMap: { [key: string]: any } = {
        'apteryx_australis.webp': require('../assets/images/birds/apteryx_australis.webp'),
        'apteryx_mantelli.webp': require('../assets/images/birds/apteryx_mantelli.webp'),
        'apteryx_owenii.webp': require('../assets/images/birds/apteryx_owenii.webp'),
        'apteryx_rowi.webp': require('../assets/images/birds/apteryx_rowi.webp'),
        'casuarius_bennetti.webp': require('../assets/images/birds/casuarius_bennetti.webp'),
        'casuarius_casuarius.webp': require('../assets/images/birds/casuarius_casuarius.webp'),
        'casuarius_unappendiculatus.webp': require('../assets/images/birds/casuarius_unappendiculatus.webp'),
        'crypturellus_berlepschi.webp': require('../assets/images/birds/crypturellus_berlepschi.webp'),
        'crypturellus_cinereus.webp': require('../assets/images/birds/crypturellus_cinereus.webp'),
        'crypturellus_duidae.webp': require('../assets/images/birds/crypturellus_duidae.webp'),
        'crypturellus_obsoletus.webp': require('../assets/images/birds/crypturellus_obsoletus.webp'),
        'crypturellus_soui.webp': require('../assets/images/birds/crypturellus_soui.webp'),
        'crypturellus_strigulosus.webp': require('../assets/images/birds/crypturellus_strigulosus.webp'),
        'crypturellus_transfasciatus.webp': require('../assets/images/birds/crypturellus_transfasciatus.webp'),
        'crypturellus_undulatus.webp': require('../assets/images/birds/crypturellus_undulatus.webp'),
        'dromaius_novaehollandiae.webp': require('../assets/images/birds/dromaius_novaehollandiae.webp'),
        'nothocercus_bonapartei.webp': require('../assets/images/birds/nothocercus_bonapartei.webp'),
        'nothocercus_nigrocapillus.webp': require('../assets/images/birds/nothocercus_nigrocapillus.webp'),
        'rhea_americana.webp': require('../assets/images/birds/rhea_americana.webp'),
        'rhea_pennata.webp': require('../assets/images/birds/rhea_pennata.webp'),
        'struthio_camelus.webp': require('../assets/images/birds/struthio_camelus.webp'),
        'struthio_molybdophanes.webp': require('../assets/images/birds/struthio_molybdophanes.webp'),
        'tinamus_guttatus.webp': require('../assets/images/birds/tinamus_guttatus.webp'),
        'tinamus_major.webp': require('../assets/images/birds/tinamus_major.webp'),
        'tinamus_osgoodi.webp': require('../assets/images/birds/tinamus_osgoodi.webp'),
        'tinamus_solitarius.webp': require('../assets/images/birds/tinamus_solitarius.webp'),
        'tinamus_tao.webp': require('../assets/images/birds/tinamus_tao.webp')
      };

      return imageMap[filename] || null;
    } catch (error) {
      console.warn('Failed to load bird image:', filename, error);
      return null;
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