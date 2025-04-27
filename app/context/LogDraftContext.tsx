import React, { createContext, useContext, useState } from 'react';

export type Draft = {
    imageUri?: string;
    videoUri?: string;
    audioUri?: string;
    imagePrediction?: string;
    audioPrediction?: string;
    birdType?: string;
    textNote?: string;
    date?: string;   // ISO
    gpsLat?: number;
    gpsLng?: number;
};

type Ctx = {
    draft: Draft;
    update: (partial: Partial<Draft>) => void;
    clear: () => void;
};

const DraftCtx = createContext<Ctx | null>(null);

export function LogDraftProvider({ children }: { children: React.ReactNode }) {
    const [draft, setDraft] = useState<Draft>({});

    return (
        <DraftCtx.Provider
            value={{
                draft,
                update: p => setDraft(d => ({ ...d, ...p })),
                clear: () => setDraft({}),
            }}
        >
            {children}
        </DraftCtx.Provider>
    );
}

export const useLogDraft = () => {
    const ctx = useContext(DraftCtx);
    if (!ctx) throw new Error('useLogDraft must be inside <LogDraftProvider>');
    return ctx;
};