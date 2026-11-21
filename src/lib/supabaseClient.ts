/**
 * NeuroCalm & Fokus — Centralized Supabase Client Module
 *
 * Provides a singleton SupabaseClient instance when environment configuration
 * is present. If configuration is missing (e.g. offline or unconfigured local mode),
 * the module handles it gracefully without throwing runtime errors or disrupting
 * the local-first application lifecycle.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnvConfig } from '../config/env';

let clientInstance: SupabaseClient | null = null;
let initializationAttempted = false;

/**
 * Initializes and returns the Supabase client singleton, or null if unconfigured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (initializationAttempted) {
    return clientInstance;
  }

  initializationAttempted = true;
  const config = getSupabaseEnvConfig();

  if (!config.isConfigured || !config.supabaseUrl || !config.supabaseAnonKey) {
    // Graceful offline fallback: unconfigured cloud sync is a normal operating state.
    clientInstance = null;
    return null;
  }

  try {
    clientInstance = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'neurocalm_supabase_auth',
      },
      global: {
        headers: {
          'x-client-info': 'neurocalm-fokus-web/0.1.0',
        },
      },
    });
  } catch (error) {
    console.warn('[Supabase] Failed to initialize Supabase client:', error);
    clientInstance = null;
  }

  return clientInstance;
}

/**
 * Direct reference to the client singleton (evaluated lazily or null if unconfigured).
 */
export const supabaseClient: SupabaseClient | null = getSupabaseClient();

/**
 * Helper that returns the active SupabaseClient or throws a descriptive error
 * if invoked when cloud sync is not configured.
 */
export function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      'Supabase client requested but cloud synchronization is not configured. ' +
      'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
    );
  }
  return client;
}
