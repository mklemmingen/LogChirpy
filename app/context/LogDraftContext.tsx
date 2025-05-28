import React, {createContext, ReactNode, useContext, useReducer, useCallback, useState, useEffect} from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';

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

type LogAction =
    | { type: 'UPDATE'; payload: Partial<BirdSpotting> }
    | { type: 'CLEAR' }
    | { type: 'LOAD'; payload: BirdSpotting };

const STORAGE_KEY = 'logchirpy_draft';

function logReducer(state: BirdSpotting, action: LogAction): BirdSpotting {
  switch (action.type) {
    case 'UPDATE':
      const newState = { ...state, ...action.payload };
      // Auto-save to storage
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return newState;
    case 'CLEAR':
      AsyncStorage.removeItem(STORAGE_KEY);
      return {};
    case 'LOAD':
      return action.payload;
    default:
      return state;
  }
}

interface LogDraftContextType {
  draft: BirdSpotting;
  update: (partialDraft: Partial<BirdSpotting>) => void;
  clear: () => void;
  isLoading: boolean;
}

const LogDraftContext = createContext<LogDraftContextType | undefined>(undefined);

export function useLogDraft() {
  const context = useContext(LogDraftContext);
  if (!context) {
    throw new Error("useLogDraft must be inside <LogDraftProvider>");
  }
  return context;
}

export function LogDraftProvider({ children }: { children: ReactNode }) {
  const [draft, dispatch] = useReducer(logReducer, {});
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          dispatch({ type: 'LOAD', payload: JSON.parse(stored) });
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadDraft();
  }, []);

  const update = useCallback((partialDraft: Partial<BirdSpotting>) => {
    dispatch({ type: 'UPDATE', payload: partialDraft });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  return (
      <LogDraftContext.Provider value={{ draft, update, clear, isLoading }}>
        {children}
      </LogDraftContext.Provider>
  );
}