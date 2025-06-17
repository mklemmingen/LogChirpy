import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/firebase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { UserProfileService } from '@/services/userProfile';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    // Handle case where Firebase auth is not available
    if (!auth) {
      console.warn('[Auth] Firebase auth not available - running in offline mode');
      setIsLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser);

        // Store auth state for persistence
        if (firebaseUser) {
          await AsyncStorage.setItem('auth:hasUser', 'true');
        } else {
          await AsyncStorage.removeItem('auth:hasUser');
        }

        setIsLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('[Auth] Error setting up auth state listener:', error);
      setIsLoading(false);
    }
  }, []);

  const signOut = async () => {
    if (!auth) {
      console.warn('[Auth] Cannot sign out - Firebase auth not available');
      return;
    }

    try {
      await firebaseSignOut(auth);
      await AsyncStorage.removeItem('auth:hasUser');
    } catch (error) {
      console.error(t('app_errors.error_signing_out'), error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!auth) {
      throw new Error(t('app_errors.firebase_not_available', 'Authentication service is not available'));
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error('[Auth] Sign in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    if (!auth) {
      throw new Error(t('app_errors.firebase_not_available', 'Authentication service is not available'));
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: displayName.trim(),
      });

      try {
        await UserProfileService.createUserProfile(user.uid, user.email);
      } catch (profileError) {
        console.warn('[Auth] Failed to create user profile:', profileError);
      }
    } catch (error) {
      console.error('[Auth] Sign up error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    if (!auth) {
      throw new Error(t('app_errors.firebase_not_available', 'Authentication service is not available'));
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error) {
      console.error('[Auth] Password reset error:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    if (!auth) {
      console.warn('[Auth] Cannot refresh user - Firebase auth not available');
      return;
    }

    const currentUser = auth.currentUser;
    if (currentUser) {
      await currentUser.reload();
      setUser({ ...currentUser });
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signOut,
    signIn,
    signUp,
    resetPassword,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;