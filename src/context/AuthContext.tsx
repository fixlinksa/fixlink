'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '@/lib/db';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  needsOnboarding: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
  needsOnboarding: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(userRef, async (userSnap) => {
      if (userSnap.exists()) {
        const profileData = userSnap.data() as UserProfile;
        
        // Auto-revert expired trials
        if (profileData.tierStatus === 'trial' && profileData.tierTrialExpiresAt) {
           const expiry = profileData.tierTrialExpiresAt.toDate 
             ? profileData.tierTrialExpiresAt.toDate() 
             : new Date(profileData.tierTrialExpiresAt);
           
           if (new Date() > expiry) {
              const baseTier = profileData.preTrialTier || 'starter';
              await updateDoc(userRef, {
                tier: baseTier,
                tierStatus: 'active',
                tierTrialExpiresAt: null,
                preTrialTier: null
              });
              return; // next snapshot will update state
           }
        }
        setProfile(profileData);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Profile listener error:", error);
      setLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user]);

  const handleSignOut = async () => {
    await firebaseSignOut(auth);
  };

  const isAdmin = profile?.role === 'admin';
  const needsOnboarding = !!user && (!profile || !profile.onboardingCompleted);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signOut: handleSignOut, 
      isAdmin, 
      needsOnboarding 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
