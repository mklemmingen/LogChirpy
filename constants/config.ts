export interface CameraConfig {
    pipelineDelay: number;           // seconds between captures
    confidenceThreshold: number;    // confidence threshold for saving
    showSettings: boolean;          // show settings UI overlay
}

export const Config = {
    gpsLoggingEnabled: true, // default true
    
    // Camera AI Detection Settings
    camera: {
        pipelineDelay: 0.5,          // default 0.5 seconds - balanced speed
        confidenceThreshold: 0.75,   // default 75% confidence - normal strictness
        showSettings: false,         // default hide settings overlay
    } as CameraConfig,
};

// Storage keys for persistence
export const STORAGE_KEYS = {
    gpsLogging: 'gps-logging',
    cameraPipelineDelay: 'camera-pipeline-delay',
    cameraConfidenceThreshold: 'camera-confidence-threshold',
    cameraShowSettings: 'camera-show-settings',
} as const;
