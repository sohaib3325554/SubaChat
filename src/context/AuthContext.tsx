import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, syncUserProfile, setUserStatus, testFirestoreConnection } from '../lib/firebase';
import { 
  signInWithGoogleGmail, 
  getCachedGmailAccessToken, 
  setCachedGmailAccessToken 
} from '../lib/gmail';
import { UserProfile } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  gmailToken: string | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, displayName: string, avatarUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  quickDemoLogin: (email: string, pass: string, name: string, avatar: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  connectGmail: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(() => getCachedGmailAccessToken());

  // Initial test connection to satisfy skill requirement
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Verify that user token can be retrieved without throwing token-service error
          await user.getIdToken();
          setCurrentUser(user);
          try {
            const profile = await syncUserProfile(user);
            setUserProfile(profile);

            // Mark user as online
            await setUserStatus(user.uid, 'online');
          } catch (err) {
            console.error('Error syncing user profile:', err);
            setUserProfile((prev) => prev || {
              uid: user.uid,
              displayName: user.displayName || user.email?.split('@')[0] || 'User',
              email: (user.email || '').toLowerCase().trim(),
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
              status: 'online',
              lastSeen: new Date(),
              createdAt: new Date(),
              bio: 'Hey there! I am using subachat.'
            });
          }
        } catch (tokenErr: any) {
          console.warn('Auth token validation note:', tokenErr);
          const isTokenApiError = tokenErr?.message?.includes('token-service-api') || 
                                  tokenErr?.message?.includes('securetoken.googleapis.com');
          if (isTokenApiError) {
            setAuthError('Firebase Token Service is finalizing setup. Please wait a moment and sign in.');
            try {
              await signOut(auth);
            } catch {
              // ignore
            }
            setCurrentUser(null);
            setUserProfile(null);
          } else {
            setCurrentUser(user);
          }
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        // Clear cached token on signout per workspace integration skill
        setCachedGmailAccessToken(null);
        setGmailToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to live User Profile updates (e.g. status changes, displayName)
  useEffect(() => {
    if (!currentUser) return;
    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribeSnapshot = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    });

    return () => unsubscribeSnapshot();
  }, [currentUser]);

  // Track window focus/unload for online presence
  useEffect(() => {
    if (!currentUser) return;

    const handleBeforeUnload = () => {
      setUserStatus(currentUser.uid, 'offline');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setUserStatus(currentUser.uid, 'online');
      } else {
        setUserStatus(currentUser.uid, 'offline');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser]);

  const mapAuthError = (err: any): string => {
    const code = err?.code || '';
    const message = err?.message || '';

    if (code.includes('token-service-api') || message.includes('securetoken.googleapis.com') || message.includes('token-service-api')) {
      return 'Firebase Token Service is finalizing setup on Google Cloud (propagates within 1-2 minutes). Please wait a moment and try again.';
    }

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password. Please verify and try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Please log in instead.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in popup was closed before completing.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Access is temporarily locked. Please try again shortly.';
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not enabled in Firebase Console. Please test with the demo accounts or enable Email/Password provider.';
      default:
        return err?.message || 'Authentication failed. Please try again.';
    }
  };

  const login = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      await setUserStatus(cred.user.uid, 'online');
    } catch (err: any) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const register = async (email: string, pass: string, displayName: string, avatarUrl?: string) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const photo = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`;
      
      await updateProfile(cred.user, {
        displayName: displayName.trim(),
        photoURL: photo
      });

      const profile = await syncUserProfile(cred.user, displayName.trim(), photo);
      setUserProfile(profile);
    } catch (err: any) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const { user, accessToken } = await signInWithGoogleGmail();
      setGmailToken(accessToken);
      const profile = await syncUserProfile(user, user.displayName || undefined, user.photoURL || undefined);
      setUserProfile(profile);
      await setUserStatus(user.uid, 'online');
    } catch (err: any) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const connectGmail = async (): Promise<string> => {
    setAuthError(null);
    try {
      const { accessToken } = await signInWithGoogleGmail();
      setGmailToken(accessToken);
      return accessToken;
    } catch (err: any) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const quickDemoLogin = async (email: string, pass: string, name: string, avatar: string) => {
    setAuthError(null);
    try {
      // Try to sign in first
      try {
        await signInWithEmailAndPassword(auth, email, pass);
      } catch (signInErr: any) {
        if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
          // If not exists, create it automatically
          const cred = await createUserWithEmailAndPassword(auth, email, pass);
          await updateProfile(cred.user, { displayName: name, photoURL: avatar });
          await syncUserProfile(cred.user, name, avatar);
        } else {
          throw signInErr;
        }
      }
    } catch (err: any) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    if (currentUser) {
      await setUserStatus(currentUser.uid, 'offline');
    }
    setCachedGmailAccessToken(null);
    setGmailToken(null);
    await signOut(auth);
    setUserProfile(null);
  };

  const clearError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        authError,
        gmailToken,
        login,
        register,
        logout,
        clearError,
        quickDemoLogin,
        loginWithGoogle,
        connectGmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
