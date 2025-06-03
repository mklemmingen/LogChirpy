import { useEffect, useState } from 'react';
import { birdDexDB } from '@/services/databaseBirDex';

export function useBirdDexDatabase() {
    const [state, setState] = useState(birdDexDB.getState());

    useEffect(() => {
        const unsubscribe = birdDexDB.subscribe(setState);

        // Auto-initialize if not ready
        if (state.status === 'uninitialized') {
            birdDexDB.initialize().catch(console.error);
        }

        return unsubscribe;
    }, []);

    const retry = () => {
        birdDexDB.initialize().catch(console.error);
    };

    return {
        ...state,
        isReady: state.status === 'ready',
        isLoading: state.status === 'initializing',
        hasError: state.status === 'error',
        retry
    };
}