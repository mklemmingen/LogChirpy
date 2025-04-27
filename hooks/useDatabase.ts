/* hooks/useDatabase.ts
   works with the sync-only services/database.ts */
import { useEffect, useState, useCallback } from 'react';
import {
    getBirdSpottings,
    insertBirdSpotting,
    syncUnsyncedSpottings,
} from '@/services/database';

export function useDatabase(limit = 50) {
    const [birdSpottings, setBirdSpottings] = useState<any[]>([]);
    const [loading,       setLoading]       = useState(true);

    /* ------------------------------------------------------------------ */
    /*  initial load                                                      */
    /* ------------------------------------------------------------------ */
    useEffect(() => { refreshSpottings(); }, [limit]);

    /* ------------------------------------------------------------------ */
    /*  helpers                                                           */
    /* ------------------------------------------------------------------ */
    const refreshSpottings = useCallback(() => {
        try {
            setLoading(true);
            /* getBirdSpottings is synchronous – no await needed */
            const rows = getBirdSpottings(limit, 'DESC');
            setBirdSpottings(rows);
        } catch (err) {
            console.error('DB refresh failed', err);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    const addSpotting = useCallback((entry: any) => {
        try {
            insertBirdSpotting(entry);   // synchronous insert
            refreshSpottings();          // reflect the change
        } catch (err) {
            console.error('Insert failed', err);
        }
    }, [refreshSpottings]);

    const syncSpottings = useCallback(async () => {
        try {
            await syncUnsyncedSpottings(); // still async (network I/O)
            refreshSpottings();
        } catch (err) {
            console.error('Sync failed', err);
        }
    }, [refreshSpottings]);

    /* ------------------------------------------------------------------ */
    /*  public API                                                        */
    /* ------------------------------------------------------------------ */
    return { birdSpottings, loading, addSpotting, syncSpottings, refreshSpottings };
}
