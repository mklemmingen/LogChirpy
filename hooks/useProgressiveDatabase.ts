import { useEffect, useState, useCallback, useRef } from 'react';
import {
    initBirdDexDB,
    isCoreDbReady,
    isFullDbReady,
    type ProgressData
} from '@/services/databaseBirDex';

export interface DatabaseStatus {
    // Core functionality (app is usable)
    isCoreReady: boolean;

    // Full database (all features available)
    isFullReady: boolean;

    // Loading states
    isCoreLoading: boolean;
    isBackgroundLoading: boolean;

    // Progress tracking
    coreProgress: number;
    backgroundProgress: number;

    // User feedback
    currentPhase: 'initializing' | 'core-loading' | 'core-ready' | 'background-loading' | 'complete';
    statusMessage: string;
    estimatedTimeRemaining?: number;

    // Error handling
    error: string | null;

    // Actions
    retryInitialization: () => void;
}

export function useProgressiveDatabase(): DatabaseStatus {
    const [isCoreReady, setIsCoreReady] = useState(isCoreDbReady());
    const [isFullReady, setIsFullReady] = useState(isFullDbReady());
    const [isCoreLoading, setIsCoreLoading] = useState(false);
    const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
    const [coreProgress, setCoreProgress] = useState(0);
    const [backgroundProgress, setBackgroundProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('Initializing database...');
    const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number>();
    const [error, setError] = useState<string | null>(null);

    const initializationAttempted = useRef(false);
    const isInitializing = useRef(false);

    // Determine current phase
    const currentPhase: DatabaseStatus['currentPhase'] = (() => {
        if (error) return 'initializing';
        if (isFullReady) return 'complete';
        if (isCoreReady && isBackgroundLoading) return 'background-loading';
        if (isCoreReady) return 'core-ready';
        if (isCoreLoading) return 'core-loading';
        return 'initializing';
    })();

    // Progress callback for database initialization
    const handleProgress = useCallback((progress: ProgressData) => {
        setCoreProgress(progress.coreProgress || 0);
        setBackgroundProgress(progress.backgroundProgress || 0);
        setStatusMessage(progress.message || '');

        // Update loading states based on phase
        switch (progress.phase) {
            case 'core-loading':
                setIsCoreLoading(true);
                setIsBackgroundLoading(false);
                setEstimatedTimeRemaining(progress.estimatedCoreTime);
                break;

            case 'core-complete':
                setIsCoreReady(true);
                setIsCoreLoading(false);
                setIsBackgroundLoading(true);
                setEstimatedTimeRemaining(progress.estimatedFullTime);
                break;

            case 'background-loading':
                setIsBackgroundLoading(true);
                setEstimatedTimeRemaining(progress.estimatedFullTime);
                break;

            case 'complete':
                setIsFullReady(true);
                setIsBackgroundLoading(false);
                setIsCoreLoading(false);
                setEstimatedTimeRemaining(undefined);
                break;
        }
    }, []);

    // Initialize database
    const initializeDatabase = useCallback(async () => {
        if (isInitializing.current) return;

        isInitializing.current = true;
        setError(null);

        try {
            // Check if already ready
            if (isCoreDbReady()) {
                setIsCoreReady(true);
                setIsCoreLoading(false);
                setCoreProgress(100);

                if (isFullDbReady()) {
                    setIsFullReady(true);
                    setIsBackgroundLoading(false);
                    setBackgroundProgress(100);
                    setStatusMessage('Database ready');
                } else {
                    setIsBackgroundLoading(true);
                    setStatusMessage('Loading additional species...');
                }
            } else {
                setIsCoreLoading(true);
                setStatusMessage('Loading core species...');
            }

            await initBirdDexDB(handleProgress);

        } catch (err) {
            console.error('Database initialization failed:', err);
            setError(err instanceof Error ? err.message : 'Database initialization failed');
            setIsCoreLoading(false);
            setIsBackgroundLoading(false);
        } finally {
            isInitializing.current = false;
        }
    }, [handleProgress]);

    // Retry mechanism
    const retryInitialization = useCallback(() => {
        setError(null);
        setCoreProgress(0);
        setBackgroundProgress(0);
        setIsCoreReady(false);
        setIsFullReady(false);
        initializationAttempted.current = false;
        initializeDatabase();
    }, [initializeDatabase]);

    // Auto-initialize on mount
    useEffect(() => {
        if (!initializationAttempted.current) {
            initializationAttempted.current = true;
            initializeDatabase();
        }
    }, [initializeDatabase]);

    return {
        isCoreReady,
        isFullReady,
        isCoreLoading,
        isBackgroundLoading,
        coreProgress,
        backgroundProgress,
        currentPhase,
        statusMessage,
        estimatedTimeRemaining,
        error,
        retryInitialization
    };
}