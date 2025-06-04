import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestore, auth } from '@/firebase/config';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt: any;
  updatedAt: any;
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    notificationsEnabled?: boolean;
  };
  stats?: {
    totalObservations?: number;
    totalSpecies?: number;
    lifelist?: string[];
  };
}

export class UserProfileService {
  private static getUserRef(uid: string) {
    return doc(firestore, 'users', uid);
  }

  static async createUserProfile(uid: string, email: string | null): Promise<UserProfile> {
    const userRef = this.getUserRef(uid);
    
    const newProfile: UserProfile = {
      uid,
      email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      preferences: {
        theme: 'system',
        language: 'en',
        notificationsEnabled: true,
      },
      stats: {
        totalObservations: 0,
        totalSpecies: 0,
        lifelist: [],
      },
    };

    await setDoc(userRef, newProfile);
    return newProfile;
  }

  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userRef = this.getUserRef(uid);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }

    // If profile doesn't exist, create it
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === uid) {
      return await this.createUserProfile(uid, currentUser.email);
    }

    return null;
  }

  static async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    const userRef = this.getUserRef(uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  static async updateUserStats(uid: string, stats: Partial<UserProfile['stats']>): Promise<void> {
    const userRef = this.getUserRef(uid);
    const currentProfile = await this.getUserProfile(uid);
    
    if (!currentProfile) {
      throw new Error('User profile not found');
    }

    await updateDoc(userRef, {
      stats: {
        ...currentProfile.stats,
        ...stats,
      },
      updatedAt: serverTimestamp(),
    });
  }

  static async updateUserPreferences(uid: string, preferences: Partial<UserProfile['preferences']>): Promise<void> {
    const userRef = this.getUserRef(uid);
    const currentProfile = await this.getUserProfile(uid);
    
    if (!currentProfile) {
      throw new Error('User profile not found');
    }

    await updateDoc(userRef, {
      preferences: {
        ...currentProfile.preferences,
        ...preferences,
      },
      updatedAt: serverTimestamp(),
    });
  }

  static async addSpeciesToLifelist(uid: string, speciesCode: string): Promise<void> {
    const currentProfile = await this.getUserProfile(uid);
    
    if (!currentProfile) {
      throw new Error('User profile not found');
    }

    const lifelist = currentProfile.stats?.lifelist || [];
    
    if (!lifelist.includes(speciesCode)) {
      await this.updateUserStats(uid, {
        lifelist: [...lifelist, speciesCode],
        totalSpecies: lifelist.length + 1,
      });
    }
  }
}