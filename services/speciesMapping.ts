/**
 * Species Mapping Service - Bridges whoBIRD audio predictions with BirDex database
 * 
 * This service maps audio model predictions to our comprehensive BirDex database,
 * enabling rich species metadata lookup and cross-referencing between systems.
 */

import {BirdDexRecord, searchBirdsByName} from './databaseBirDex';

// Audio prediction interfaces from ultraSimpleBirdClassifier
export interface AudioPrediction {
  common_name: string;
  scientific_name: string;
  confidence: number;
  index: number;
  assetUrl?: string;
}

export interface BirdPrediction {
  commonName: string;
  scientificName: string;
  confidence: number;
  index: number;
}

// Enhanced prediction with BirDex data
export interface EnrichedBirdPrediction extends BirdPrediction {
  birdexRecord?: BirdDexRecord;
  macaulayUrl?: string;
  isValidSpecies: boolean;
  speciesCode?: string;
  family?: string;
  order?: string;
}

export interface EnrichedAudioPrediction extends AudioPrediction {
  birdexRecord?: BirdDexRecord;
  isValidSpecies: boolean;
  speciesCode?: string;
  family?: string;
  order?: string;
}

/**
 * Species mapping cache to avoid repeated database lookups
 */
class SpeciesCache {
  private cache = new Map<string, BirdDexRecord | null>();
  private lastClearTime = Date.now();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  get(scientificName: string): BirdDexRecord | null | undefined {
    this.clearExpiredCache();
    return this.cache.get(scientificName);
  }

  set(scientificName: string, record: BirdDexRecord | null): void {
    this.cache.set(scientificName, record);
  }

  private clearExpiredCache(): void {
    const now = Date.now();
    if (now - this.lastClearTime > this.CACHE_TTL) {
      this.cache.clear();
      this.lastClearTime = now;
    }
  }

  getStats(): { size: number; lastClear: Date } {
    return {
      size: this.cache.size,
      lastClear: new Date(this.lastClearTime)
    };
  }
}

const speciesCache = new SpeciesCache();

/**
 * Normalize scientific name for database lookup
 * Handles common variations and format differences
 */
function normalizeScientificName(scientificName: string): string {
  return scientificName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s]/g, '') // Remove special characters
    .trim();
}

/**
 * Find BirDex record by scientific name with fuzzy matching
 */
async function findBirdDexRecord(scientificName: string): Promise<BirdDexRecord | null> {
  try {
    // Check cache first
    const cached = speciesCache.get(scientificName);
    if (cached !== undefined) {
      return cached;
    }

    // Try searching by scientific name using the available search function
    let results = searchBirdsByName(scientificName, 1);
    let record = results.length > 0 ? results[0] : null;
    
    if (!record) {
      // Try searching for a broader match by using part of the scientific name
      const nameParts = scientificName.split(' ');
      if (nameParts.length > 1) {
        // Try searching with just the genus
        results = searchBirdsByName(nameParts[0], 10);
        record = results.find((bird: BirdDexRecord) => 
          normalizeScientificName(bird.scientific_name) === normalizeScientificName(scientificName)
        ) || null;
      }
    }

    // Cache the result (even if null)
    speciesCache.set(scientificName, record);
    return record;

  } catch (error) {
    console.warn('[SpeciesMapping] Error finding BirDex record:', error);
    speciesCache.set(scientificName, null);
    return null;
  }
}

/**
 * Generate Macaulay Library URL from asset URL
 */
function extractMacaulayUrl(assetUrl?: string): string | undefined {
  if (!assetUrl || assetUrl.includes('NO_ASSET')) {
    return undefined;
  }
  return assetUrl;
}

/**
 * Enrich a single bird prediction with BirDex data
 */
export async function enrichBirdPrediction(prediction: BirdPrediction): Promise<EnrichedBirdPrediction> {
  const birdexRecord = await findBirdDexRecord(prediction.scientificName);
  
  return {
    ...prediction,
    birdexRecord: birdexRecord || undefined,
    isValidSpecies: birdexRecord !== null,
    speciesCode: birdexRecord?.species_code,
    family: birdexRecord?.family,
    order: birdexRecord?.order_
  };
}

/**
 * Enrich a single audio prediction with BirDex data
 */
export async function enrichAudioPrediction(prediction: AudioPrediction): Promise<EnrichedAudioPrediction> {
  const birdexRecord = await findBirdDexRecord(prediction.scientific_name);
  
  return {
    ...prediction,
    birdexRecord: birdexRecord || undefined,
    isValidSpecies: birdexRecord !== null,
    speciesCode: birdexRecord?.species_code,
    family: birdexRecord?.family,
    order: birdexRecord?.order_
  };
}

/**
 * Enrich multiple bird predictions with BirDex data
 * Processes predictions in parallel for better performance
 */
export async function enrichBirdPredictions(predictions: BirdPrediction[]): Promise<EnrichedBirdPrediction[]> {
  const enrichPromises = predictions.map(pred => enrichBirdPrediction(pred));
  return Promise.all(enrichPromises);
}

/**
 * Enrich multiple audio predictions with BirDex data
 * Processes predictions in parallel for better performance
 */
export async function enrichAudioPredictions(predictions: AudioPrediction[]): Promise<EnrichedAudioPrediction[]> {
  const enrichPromises = predictions.map(pred => enrichAudioPrediction(pred));
  return Promise.all(enrichPromises);
}

/**
 * Get species statistics from enriched predictions
 */
export function getSpeciesStats(enrichedPredictions: (EnrichedBirdPrediction | EnrichedAudioPrediction)[]): {
  total: number;
  validSpecies: number;
  unknownSpecies: number;
  withBirdexData: number;
  withMacaulayUrls: number;
  familyDistribution: { [family: string]: number };
  orderDistribution: { [order: string]: number };
} {
  const stats = {
    total: enrichedPredictions.length,
    validSpecies: 0,
    unknownSpecies: 0,
    withBirdexData: 0,
    withMacaulayUrls: 0,
    familyDistribution: {} as { [family: string]: number },
    orderDistribution: {} as { [order: string]: number }
  };

  enrichedPredictions.forEach(pred => {
    if (pred.isValidSpecies) {
      stats.validSpecies++;
    } else {
      stats.unknownSpecies++;
    }

    if (pred.birdexRecord) {
      stats.withBirdexData++;
      
      const family = pred.birdexRecord.family;
      const order = pred.birdexRecord.order_;
      
      if (family) {
        stats.familyDistribution[family] = (stats.familyDistribution[family] || 0) + 1;
      }
      
      if (order) {
        stats.orderDistribution[order] = (stats.orderDistribution[order] || 0) + 1;
      }
    }

    // Check for Macaulay URLs
    if ('assetUrl' in pred && pred.assetUrl && !pred.assetUrl.includes('NO_ASSET')) {
      stats.withMacaulayUrls++;
    } else if ('macaulayUrl' in pred && pred.macaulayUrl) {
      stats.withMacaulayUrls++;
    }
  });

  return stats;
}

/**
 * Filter predictions by confidence threshold
 */
export function filterByConfidence<T extends { confidence: number }>(
  predictions: T[], 
  minConfidence: number = 0.1
): T[] {
  return predictions.filter(pred => pred.confidence >= minConfidence);
}

/**
 * Filter predictions to only include valid species (with BirDex records)
 */
export function filterValidSpecies<T extends { isValidSpecies: boolean }>(predictions: T[]): T[] {
  return predictions.filter(pred => pred.isValidSpecies);
}

/**
 * Sort predictions by confidence (descending)
 */
export function sortByConfidence<T extends { confidence: number }>(predictions: T[]): T[] {
  return [...predictions].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): { size: number; lastClear: Date } {
  return speciesCache.getStats();
}

/**
 * Convert whoBIRD index to scientific name lookup
 * This creates a mapping that can be used for direct index-to-species resolution
 */
export async function createIndexToSpeciesMap(
  labels: string[], 
  scientificNames: string[]
): Promise<Map<number, { commonName: string; scientificName: string; birdexRecord?: BirdDexRecord }>> {
  const indexMap = new Map();
  
  for (let i = 0; i < Math.min(labels.length, scientificNames.length); i++) {
    const commonName = labels[i];
    const scientificName = scientificNames[i];
    const birdexRecord = await findBirdDexRecord(scientificName);
    
    indexMap.set(i, {
      commonName,
      scientificName,
      birdexRecord
    });
  }
  
  console.log(`[SUCCESS] Created index-to-species map for ${indexMap.size} species`);
  return indexMap;
}

/**
 * Validate that whoBIRD model indices align with expected species
 * Useful for debugging and verification
 */
export async function validateSpeciesAlignment(
  predictions: (BirdPrediction | AudioPrediction)[]
): Promise<{
  totalPredictions: number;
  validSpecies: number;
  invalidSpecies: number;
  missingInBirdex: string[];
  errors: string[];
}> {
  const result = {
    totalPredictions: predictions.length,
    validSpecies: 0,
    invalidSpecies: 0,
    missingInBirdex: [] as string[],
    errors: [] as string[]
  };

  for (const pred of predictions) {
    try {
      const scientificName = 'scientific_name' in pred ? pred.scientific_name : pred.scientificName;
      const birdexRecord = await findBirdDexRecord(scientificName);
      
      if (birdexRecord) {
        result.validSpecies++;
      } else {
        result.invalidSpecies++;
        result.missingInBirdex.push(scientificName);
      }
    } catch (error) {
      result.errors.push(`Error validating ${JSON.stringify(pred)}: ${error}`);
    }
  }

  return result;
}