import React, { createContext, useContext, useState, ReactNode } from 'react';

// Definiere die Struktur eines Log-Eintrags
export interface BirdSpotting {
    imageUri?: string;
    videoUri?: string;
    audioUri?: string;
    textNote?: string;
    gpsLat?: number;
    gpsLng?: number;
    date?: string;
    birdType?: string;
    audioPrediction?: string;
    imagePrediction?: string;
}

interface LogDraftContextType {
    draft: BirdSpotting;
    update: (partialDraft: Partial<BirdSpotting>) => void;
    clear: () => void;
}

const defaultDraft: BirdSpotting = {
    imageUri: '',
    videoUri: '',
    audioUri: '',
    textNote: '',
    gpsLat: 0,
    gpsLng: 0,
    date: new Date().toISOString(),
    birdType: '',
    audioPrediction: '',
    imagePrediction: '',
};

const LogDraftContext = createContext<LogDraftContextType | undefined>(undefined);

export function useLogDraft() {
    const context = useContext(LogDraftContext);
    if (!context) {
        throw new Error('useLogDraft must be inside <LogDraftProvider>');
    }
    return context;
}

export function LogDraftProvider({ children }: { children: ReactNode }) {
    const [draft, setDraft] = useState<BirdSpotting>(defaultDraft);

    const update = (partialDraft: Partial<BirdSpotting>) => {
        setDraft(prev => ({ ...prev, ...partialDraft }));
    };

    const clear = () => {
        setDraft(defaultDraft);
    };

    return (
        <LogDraftContext.Provider value={{ draft, update, clear }}>
            {children}
        </LogDraftContext.Provider>
    );
}

export default useLogDraft;
