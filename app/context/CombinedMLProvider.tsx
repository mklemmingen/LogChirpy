import React, { useMemo } from 'react';
import {
    ImageLabelingConfig,
    useImageLabelingModels,
    useImageLabelingProvider
} from "@infinitered/react-native-mlkit-image-labeling";

import {
    ObjectDetectionConfig,
    useObjectDetectionModels,
    useObjectDetectionProvider
} from '@infinitered/react-native-mlkit-object-detection';

// ML Models Configuration
const MODELS_OBJECT: ObjectDetectionConfig = {
    ssdmobilenetV1: {
        model: require('../../assets/models/ssd_mobilenet_v1_metadata.tflite'),
        options: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: false,
            classificationConfidenceThreshold: 0.3,
            maxPerObjectLabelCount: 1
        }
    },
    efficientNetlite0int8: {
        model: require('../../assets/models/efficientnet-lite0-int8.tflite'),
        options: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: true,
            classificationConfidenceThreshold: 0.3,
            maxPerObjectLabelCount: 3
        }
    },
};

const MODELS_CLASS: ImageLabelingConfig = {
    birdClassifier: {
        model: require("../../assets/models/birds_mobilenetv2/bird_classifier_metadata.tflite"),
        options: {
            confidenceThreshold: 0.5,
            maxResultCount: 5,
        },
    },
};

interface CombinedMLProviderProps {
    children: React.ReactNode;
}

/**
 * Combined ML Provider that wraps both Image Labeling and Object Detection providers
 * This reduces provider nesting from 2 levels to 1 level for view hierarchy stability
 */
export function CombinedMLProvider({ children }: CombinedMLProviderProps) {
    // Object Detection Configuration
    const objectDetectionConfig = useMemo(() => ({
        assets: MODELS_OBJECT,
        loadDefaultModel: true,
        defaultModelOptions: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: true,
            detectorMode: 'singleImage' as const,
        },
    }), []);

    // Initialize ML Kit models
    const models_class = useImageLabelingModels(MODELS_CLASS);
    const { ImageLabelingModelProvider } = useImageLabelingProvider(models_class);
    
    const models_object = useObjectDetectionModels<typeof MODELS_OBJECT>(objectDetectionConfig);
    const { ObjectDetectionProvider } = useObjectDetectionProvider(models_object);

    // Log initialization status once
    React.useEffect(() => {
        if (models_class && models_object) {
            console.log('[CombinedMLProvider] All ML models initialized successfully');
        }
    }, [models_class, models_object]);

    return (
        <ImageLabelingModelProvider>
            <ObjectDetectionProvider>
                {children}
            </ObjectDetectionProvider>
        </ImageLabelingModelProvider>
    );
}

export type MLModelsConfig = typeof MODELS_OBJECT;