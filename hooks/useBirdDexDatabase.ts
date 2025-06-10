import { useEffect, useState } from 'react';
import { birdDexDB } from '@/services/databaseBirDex';

export function useBirdDexDatabase(localDbReady: boolean = true) {
    const [state, setState] = useState(birdDexDB.getState());

    useEffect(() => {
        const unsubscribe = birdDexDB.subscribe(setState);

        // Auto-initialize if not ready and local DB is ready
        if (state.status === 'uninitialized' && localDbReady) {
            console.log('[BirdDexDB] Starting initialization - local DB is ready');
            birdDexDB.initialize().catch(console.error);
        } else if (!localDbReady) {
            console.log('[BirdDexDB] Waiting for local database to be ready...');
        }

        return unsubscribe;
    }, [state.status, localDbReady]);

    const retry = () => {
        if (localDbReady) {
            console.log('[BirdDexDB] Retrying initialization - local DB is ready');
            birdDexDB.initialize().catch(console.error);
        } else {
            console.warn('[BirdDexDB] Cannot retry - local DB not ready yet');
        }
    };

    return {
        ...state,
        isReady: state.status === 'ready',
        isLoading: state.status === 'initializing',
        hasError: state.status === 'error',
        retry
    };
}