import { useState, useEffect } from "react";
import { getAllBirdSpottings, insertBirdSpotting, syncUnsyncedSpottings } from "@/services/database";

export function useDatabase() {
    const [birdSpottings, setBirdSpottings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        refreshSpottings();
    }, []);

    async function refreshSpottings() {
        try {
            const spottings = await getAllBirdSpottings();
            setBirdSpottings(spottings as any[]);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load bird spottings', error);
        }
    }

    async function addSpotting(entry: any) {
        try {
            await insertBirdSpotting(entry);
            await refreshSpottings();
        } catch (error) {
            console.error('Failed to insert bird spotting', error);
        }
    }

    async function syncSpottings() {
        try {
            await syncUnsyncedSpottings();
            await refreshSpottings();
        } catch (error) {
            console.error('Failed to sync spottings', error);
        }
    }

    return {
        birdSpottings,
        loading,
        addSpotting,
        syncSpottings,
        refreshSpottings,
    };
}
