/**
 * NeuroCalm & Fokus — React Hook for Authentication
 * Phase CLOUD-2: Reactive access to user session, sign-in, sign-up, sign-out, and reset.
 */

import { useState, useEffect } from 'react';
import {
  AuthState,
  getAuthState,
  subscribeAuthState,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  resetPasswordForEmail,
} from '../services/authService';

export function useAuth() {
  const [state, setState] = useState<AuthState>(getAuthState());

  useEffect(() => {
    const unsubscribe = subscribeAuthState(setState);
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    signIn: signInWithEmail,
    signUp: signUpWithEmail,
    signOut: signOutUser,
    resetPassword: resetPasswordForEmail,
  };
}
