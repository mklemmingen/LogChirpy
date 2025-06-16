import React, {createContext, ReactNode, useCallback, useContext, useEffect, useReducer, useState} from "react";
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
  latinBirDex?: string | null;
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
      // Auto-save to storage with error handling
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState)).catch(error => {
        console.error('Failed to save draft:', error);
      });
      return newState;
    case 'CLEAR':
      AsyncStorage.removeItem(STORAGE_KEY).catch(error => {
        console.error('Failed to clear draft:', error);
      });
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
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadDraft = async () => {
      try {
        // Set a shorter timeout for AsyncStorage operations
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('AsyncStorage timeout')), 2000);
        });

        const storagePromise = AsyncStorage.getItem(STORAGE_KEY);
        
        // Race between AsyncStorage and timeout
        const stored = await Promise.race([storagePromise, timeoutPromise]) as string | null;
        
        if (mounted && stored) {
          try {
            const parsed = JSON.parse(stored);
            dispatch({ type: 'LOAD', payload: parsed });
          } catch (parseError) {
            console.error('Failed to parse stored draft:', parseError);
            // Clear corrupted data
            AsyncStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        if (mounted) {
          if (error instanceof Error && error.message === 'AsyncStorage timeout') {
            console.warn('LogDraftContext: AsyncStorage read timeout after 2s');
          } else {
            console.error('Failed to load draft:', error);
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    loadDraft();

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const update = useCallback((partialDraft: Partial<BirdSpotting>) => {
    dispatch({ type: 'UPDATE', payload: partialDraft });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    draft,
    update,
    clear,
    isLoading
  }), [draft, update, clear, isLoading]);

  return (
      <LogDraftContext.Provider value={contextValue}>
        {children}
      </LogDraftContext.Provider>
  );
}

export default LogDraftProvider;