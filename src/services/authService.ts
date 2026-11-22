/**
 * NeuroCalm & Fokus — Authentication Service
 * Phase CLOUD-2: Safe user identity, session management, and password reset.
 */

import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClient';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type AuthListener = (state: AuthState) => void;
const listeners = new Set<AuthListener>();

let currentAuthState: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
};

let isInitialized = false;

function notifyListeners(): void {
  for (const listener of listeners) {
    listener({ ...currentAuthState });
  }
}

/**
 * Initializes the auth listener and checks for an active session.
 */
export function initAuth(): void {
  if (isInitialized) return;
  isInitialized = true;

  const client = getSupabaseClient();
  if (!client) {
    currentAuthState = {
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
    };
    notifyListeners();
    return;
  }

  client.auth
    .getSession()
    .then(({ data }: { data: { session: Session | null } }) => {
      currentAuthState = {
        user: data.session?.user ?? null,
        session: data.session,
        isAuthenticated: Boolean(data.session),
        isLoading: false,
      };
      notifyListeners();
    })
    .catch((err: unknown) => {
      console.warn('[AuthService] Error retrieving initial session:', err);
      currentAuthState.isLoading = false;
      notifyListeners();
    });

  client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
    currentAuthState = {
      user: session?.user ?? null,
      session: session,
      isAuthenticated: Boolean(session),
      isLoading: false,
    };
    notifyListeners();
  });
}

/**
 * Subscribes to auth state changes.
 */
export function subscribeAuthState(listener: AuthListener): () => void {
  initAuth();
  listeners.add(listener);
  listener({ ...currentAuthState });
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns current snapshot of auth state.
 */
export function getAuthState(): AuthState {
  initAuth();
  return { ...currentAuthState };
}

/**
 * Returns active user ID or null if unauthenticated.
 */
export function getActiveUserId(): string | null {
  initAuth();
  return currentAuthState.user?.id ?? null;
}

export function setAuthStateForTesting(state: Partial<AuthState>): void {
  isInitialized = true;
  currentAuthState = {
    ...currentAuthState,
    ...state,
  };
  notifyListeners();
}

/**
 * Signs in with email and password.
 */
export async function signInWithEmail(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: Boolean(data.session) };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown authentication error' };
  }
}

/**
 * Signs up with email and password.
 */
export async function signUpWithEmail(email: string, password: string): Promise<{ success: boolean; requiresEmailConfirmation?: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  try {
    const { data, error } = await client.auth.signUp({ email: email.trim(), password });
    if (error) {
      return { success: false, error: error.message };
    }
    const hasSession = Boolean(data.session);
    return {
      success: Boolean(data.user),
      requiresEmailConfirmation: !hasSession,
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown sign-up error' };
  }
}

/**
 * Sends a password reset email instructions link.
 */
export async function resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  try {
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown password reset error' };
  }
}

/**
 * Signs out the current user while preserving local-first storage.
 */
export async function signOutUser(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.auth.signOut();
  } catch (err) {
    console.warn('[AuthService] Sign out error:', err);
  }
}
