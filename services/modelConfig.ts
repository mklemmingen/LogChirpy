/**
 * Model Configuration System for whoBIRD TFLite Models
 * 
 * Manages different BirdNET Global 6K v2.4 models for different use cases:
 * - Balanced FP16: Fast inference for real-time applications
 * - High Accuracy FP32: Maximum precision for detailed analysis
 */

export enum ModelType {
  BALANCED_FP16 = 'balanced_fp16',
  HIGH_ACCURACY_FP32 = 'high_accuracy_fp32',
  LEGACY = 'legacy' // Current 400-species model for backward compatibility
}

export interface ModelConfiguration {
  path: any; // require() path for the model
  name: string;
  description: string;
  fileSize: string;
  precision: 'FP16' | 'FP32';
  expectedClasses: number;
  recommendedUse: string[];
  performance: {
    speed: 'fast' | 'medium' | 'slow';
    accuracy: 'good' | 'high' | 'maximum';
    memoryUsage: 'low' | 'medium' | 'high';
  };
}

export class ModelConfig {
  private static readonly configurations: Record<ModelType, ModelConfiguration> = {
    [ModelType.BALANCED_FP16]: {
      path: require('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP16.tflite'),
      name: 'BirdNET Global 6K v2.4 FP16',
      description: 'Balanced model with good accuracy and fast inference',
      fileSize: '25MB',
      precision: 'FP16',
      expectedClasses: 6522,
      recommendedUse: ['real-time detection', 'camera pipeline', 'continuous monitoring'],
      performance: {
        speed: 'fast',
        accuracy: 'high',
        memoryUsage: 'medium'
      }
    },
    
    [ModelType.HIGH_ACCURACY_FP32]: {
      path: require('../assets/models/whoBIRD-TFlite-master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite'),
      name: 'BirdNET Global 6K v2.4 FP32',
      description: 'High-precision model for maximum accuracy',
      fileSize: '49MB',
      precision: 'FP32',
      expectedClasses: 6522,
      recommendedUse: ['manual identification', 'detailed analysis', 'research'],
      performance: {
        speed: 'medium',
        accuracy: 'maximum',
        memoryUsage: 'high'
      }
    },
    
    [ModelType.LEGACY]: {
      path: require('../assets/models/birdnet/birdnet_v24.tflite'),
      name: 'BirdNET Legacy v2.4',
      description: 'Legacy 400-species model for backward compatibility',
      fileSize: '~10MB',
      precision: 'FP32',
      expectedClasses: 400,
      recommendedUse: ['legacy support', 'limited species detection'],
      performance: {
        speed: 'fast',
        accuracy: 'good',
        memoryUsage: 'low'
      }
    }
  };

  /**
   * Get configuration for a specific model type
   */
  static getConfiguration(modelType: ModelType): ModelConfiguration {
    const config = this.configurations[modelType];
    if (!config) {
      throw new Error(`No configuration found for model type: ${modelType}`);
    }
    return config;
  }

  /**
   * Get the model path for a specific type
   */
  static getModelPath(modelType: ModelType): any {
    return this.getConfiguration(modelType).path;
  }

  /**
   * Get all available model types
   */
  static getAvailableModels(): ModelType[] {
    return Object.values(ModelType);
  }

  /**
   * Get recommended model for a specific use case
   */
  static getRecommendedModel(useCase: 'real-time' | 'manual' | 'research'): ModelType {
    switch (useCase) {
      case 'real-time':
        return ModelType.BALANCED_FP16;
      case 'manual':
      case 'research':
        return ModelType.HIGH_ACCURACY_FP32;
      default:
        return ModelType.BALANCED_FP16;
    }
  }

  /**
   * Compare two models and return the performance difference
   */
  static compareModels(modelA: ModelType, modelB: ModelType): {
    speed: string;
    accuracy: string;
    memory: string;
  } {
    const configA = this.getConfiguration(modelA);
    const configB = this.getConfiguration(modelB);
    
    return {
      speed: this.comparePerformanceMetric(configA.performance.speed, configB.performance.speed),
      accuracy: this.comparePerformanceMetric(configA.performance.accuracy, configB.performance.accuracy),
      memory: this.comparePerformanceMetric(configA.performance.memoryUsage, configB.performance.memoryUsage)
    };
  }

  private static comparePerformanceMetric(a: string, b: string): string {
    const ranks = { low: 1, fast: 1, good: 1, medium: 2, high: 3, slow: 3, maximum: 4 };
    const rankA = ranks[a as keyof typeof ranks] || 2;
    const rankB = ranks[b as keyof typeof ranks] || 2;
    
    if (rankA === rankB) return 'similar';
    return rankA > rankB ? 'higher' : 'lower';
  }

  /**
   * Validate if a model type is compatible with expected use case
   */
  static validateModelForUseCase(modelType: ModelType, useCase: string): boolean {
    const config = this.getConfiguration(modelType);
    return config.recommendedUse.some(use => 
      use.toLowerCase().includes(useCase.toLowerCase())
    );
  }

  /**
   * Get model information for logging/debugging
   */
  static getModelInfo(modelType: ModelType): string {
    const config = this.getConfiguration(modelType);
    return `${config.name} (${config.fileSize}, ${config.precision}, ${config.expectedClasses} classes)`;
  }
}