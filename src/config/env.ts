/**
 * NeuroCalm & Fokus — Environment Configuration & Type Safety
 *
 * Provides strongly-typed access to environment variables, validation,
 * and safe diagnostics without leaking secrets into logs or client telemetry.
 */

export interface SupabaseEnvConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  isConfigured: boolean;
  mode: 'cloud' | 'local_only';
}

export interface SanitizedEnvSummary {
  mode: 'cloud' | 'local_only';
  isConfigured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  maskedUrl: string | null;
  maskedAnonKey: string | null;
}

/**
 * Safely resolves raw environment dictionary across both Vite (import.meta.env)
 * and Node.js testing/scripts (globalThis.process.env) without requiring Node.js globals.
 */
function resolveRuntimeEnv(): Record<string, string | undefined> {
  const metaEnv = typeof import.meta !== 'undefined'
    ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    : undefined;

  const globalScope = globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  };
  const procEnv = typeof globalScope.process !== 'undefined'
    ? globalScope.process.env
    : undefined;

  return {
    VITE_SUPABASE_URL: metaEnv?.VITE_SUPABASE_URL ?? procEnv?.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: metaEnv?.VITE_SUPABASE_ANON_KEY ?? procEnv?.VITE_SUPABASE_ANON_KEY,
  };
}

/**
 * Validates whether a provided string represents a valid HTTP/HTTPS URL.
 */
export function isValidSupabaseUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Validates whether a provided anon key is non-empty and not a known dummy placeholder.
 */
export function isValidAnonKey(key: unknown): boolean {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 20) return false;
  if (trimmed.includes('placeholder') || trimmed.includes('your-anon-key')) return false;
  return true;
}

/**
 * Evaluates environment configuration from a raw dictionary (defaulting to resolved runtime env).
 */
export function parseSupabaseEnv(rawEnv?: Record<string, string | undefined>): SupabaseEnvConfig {
  const source = rawEnv ?? resolveRuntimeEnv();
  const rawUrl = source.VITE_SUPABASE_URL?.trim() || null;
  const rawKey = source.VITE_SUPABASE_ANON_KEY?.trim() || null;

  const validUrl = isValidSupabaseUrl(rawUrl) ? rawUrl : null;
  const validKey = isValidAnonKey(rawKey) ? rawKey : null;

  const isConfigured = Boolean(validUrl && validKey);

  return {
    supabaseUrl: validUrl,
    supabaseAnonKey: validKey,
    isConfigured,
    mode: isConfigured ? 'cloud' : 'local_only',
  };
}

/**
 * Cached active configuration evaluated at application startup.
 */
let cachedConfig: SupabaseEnvConfig | null = null;

export function getSupabaseEnvConfig(): SupabaseEnvConfig {
  if (!cachedConfig) {
    cachedConfig = parseSupabaseEnv();
  }
  return cachedConfig;
}

/**
 * Returns true if both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present and valid.
 * When false, the application operates purely in offline, local-first mode.
 */
export function isCloudSyncConfigured(): boolean {
  return getSupabaseEnvConfig().isConfigured;
}

/**
 * Generates a sanitized summary of environment status suitable for diagnostic logs
 * or support panels without exposing secret values.
 */
export function getSanitizedEnvSummary(config: SupabaseEnvConfig = getSupabaseEnvConfig()): SanitizedEnvSummary {
  const maskKey = (key: string | null): string | null => {
    if (!key) return null;
    if (key.length <= 12) return '***';
    return `${key.slice(0, 6)}...${key.slice(-4)} (${key.length} chars)`;
  };

  const maskUrl = (url: string | null): string | null => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const hostParts = parsed.hostname.split('.');
      if (hostParts.length > 2) {
        return `${parsed.protocol}//${hostParts[0].slice(0, 4)}***.${hostParts.slice(1).join('.')}`;
      }
      return `${parsed.protocol}//${parsed.hostname}`;
    } catch {
      return 'invalid-url';
    }
  };

  return {
    mode: config.mode,
    isConfigured: config.isConfigured,
    hasUrl: Boolean(config.supabaseUrl),
    hasAnonKey: Boolean(config.supabaseAnonKey),
    maskedUrl: maskUrl(config.supabaseUrl),
    maskedAnonKey: maskKey(config.supabaseAnonKey),
  };
}
