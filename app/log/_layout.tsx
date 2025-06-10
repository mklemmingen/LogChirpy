import {Stack} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {LogDraftProvider} from '@/contexts/LogDraftContext';
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

// ML Models Configuration (shared with root layout)
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

// ML Models setup outside component to prevent recreation
const objectDetectionConfig = {
    assets: MODELS_OBJECT,
    loadDefaultModel: true,
    defaultModelOptions: {
        shouldEnableMultipleObjects: true,
        shouldEnableClassification: true,
        detectorMode: 'singleImage' as const,
    },
};

export default function LogLayout() {
    const { t } = useTranslation();

    // Initialize models
    const models_class = useImageLabelingModels(MODELS_CLASS);
    const { ImageLabelingModelProvider } = useImageLabelingProvider(models_class);

    const models = useObjectDetectionModels<typeof MODELS_OBJECT>(objectDetectionConfig);
    const { ObjectDetectionProvider } = useObjectDetectionProvider(models);
    
    return (
        <ImageLabelingModelProvider>
            <ObjectDetectionProvider>
                <LogDraftProvider>
                    <Stack initialRouteName="manual" screenOptions={{
                        headerShown: false,
                        animation: 'slide_from_right',
                    }}>
                        <Stack.Screen name="manual" options={{ headerShown: false, title: t('log_screens.manual_title') }} />
                        <Stack.Screen name="photo" options={{ headerShown: false, title: t('log_screens.photo_title') }} />
                        <Stack.Screen name="video" options={{ headerShown: false, title: t('log_screens.video_title') }} />
                        <Stack.Screen name="audio" options={{ headerShown: false, title: t('log_screens.audio_title') }} />
                        <Stack.Screen name="objectIdentCamera" options={{ headerShown: false, title: t('log_screens.camera_title') }} />
                    </Stack>
                </LogDraftProvider>
            </ObjectDetectionProvider>
        </ImageLabelingModelProvider>
    );
}