export interface CameraConfig {
    pipelineDelay: number;           // seconds between captures
    confidenceThreshold: number;    // confidence threshold for saving
    showSettings: boolean;          // show settings UI overlay
}

export interface AudioFilterConfig {
    enabled: boolean;               // enable advanced audio filtering
    noiseSensitivity: number;       // 0-1, higher = more aggressive noise removal
    birdFrequencyMode: boolean;     // optimize for bird frequency range
}

export const Config = {
    gpsLoggingEnabled: true, // default true
    
    // Camera AI Detection Settings
    camera: {
        pipelineDelay: 0.5,          // default 0.5 seconds - balanced speed
        confidenceThreshold: 0.75,   // default 75% confidence - normal strictness
        showSettings: false,         // default hide settings overlay
    } as CameraConfig,
    
    // Audio Processing Settings
    audioFilter: {
        enabled: true,               // enable advanced filtering by default
        noiseSensitivity: 0.7,       // moderate noise removal (0-1)
        birdFrequencyMode: true,     // optimize for bird frequencies
    } as AudioFilterConfig,
};

// Storage keys for persistence
export const STORAGE_KEYS = {
    gpsLogging: 'gps-logging',
    cameraPipelineDelay: 'camera-pipeline-delay',
    cameraConfidenceThreshold: 'camera-confidence-threshold',
    cameraShowSettings: 'camera-show-settings',
    audioFilterEnabled: 'audio-filter-enabled',
    audioFilterNoiseSensitivity: 'audio-filter-noise-sensitivity',
    audioFilterBirdMode: 'audio-filter-bird-mode',
} as const;
