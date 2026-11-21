import assert from 'node:assert';
import {
  isValidSupabaseUrl,
  isValidAnonKey,
  parseSupabaseEnv,
  getSanitizedEnvSummary,
  isCloudSyncConfigured,
} from '../src/config/env';
import { getSupabaseClient, requireSupabaseClient } from '../src/lib/supabaseClient';

console.log('--- Starting Phase SYNC-1A Supabase Foundation Tests ---');

// 1. URL Validation
{
  assert.strictEqual(isValidSupabaseUrl(undefined), false, 'Undefined URL should be invalid');
  assert.strictEqual(isValidSupabaseUrl(''), false, 'Empty string URL should be invalid');
  assert.strictEqual(isValidSupabaseUrl('not-a-url'), false, 'Malformed URL should be invalid');
  assert.strictEqual(isValidSupabaseUrl('ftp://example.com'), false, 'FTP URL should be invalid');
  assert.strictEqual(isValidSupabaseUrl('https://example.supabase.co'), true, 'HTTPS Supabase URL should be valid');
  assert.strictEqual(isValidSupabaseUrl('http://127.0.0.1:54321'), true, 'Local Supabase CLI URL should be valid');
  console.log('✓ URL validation logic correctly identifies valid and invalid URLs');
}

// 2. Anon Key Validation
{
  assert.strictEqual(isValidAnonKey(undefined), false, 'Undefined key should be invalid');
  assert.strictEqual(isValidAnonKey(''), false, 'Empty key should be invalid');
  assert.strictEqual(isValidAnonKey('short'), false, 'Key shorter than 20 chars should be invalid');
  assert.strictEqual(isValidAnonKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder_anon_key_only'), false, 'Placeholder key should be rejected');
  assert.strictEqual(isValidAnonKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here'), false, 'Template key should be rejected');
  assert.strictEqual(
    isValidAnonKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eCIsInJvbGUiOiJhbm9uIn0.abcdefghijklmnopqrstuvwxyz1234567890'),
    true,
    'Realistically formatted JWT anon key should be accepted'
  );
  console.log('✓ Anon key validation properly screens out empty and template placeholders');
}

// 3. Environment Parsing
{
  // Unconfigured / Default state
  const unconfigured = parseSupabaseEnv({
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_ANON_KEY: '',
  });
  assert.strictEqual(unconfigured.isConfigured, false);
  assert.strictEqual(unconfigured.mode, 'local_only');
  assert.strictEqual(unconfigured.supabaseUrl, null);
  assert.strictEqual(unconfigured.supabaseAnonKey, null);

  // Partial configuration (URL only)
  const partialUrl = parseSupabaseEnv({
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: '',
  });
  assert.strictEqual(partialUrl.isConfigured, false);
  assert.strictEqual(partialUrl.mode, 'local_only');

  // Partial configuration (Placeholder key)
  const placeholderKey = parseSupabaseEnv({
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder_anon_key_only',
  });
  assert.strictEqual(placeholderKey.isConfigured, false);
  assert.strictEqual(placeholderKey.mode, 'local_only');

  // Full valid configuration
  const validKeyStr = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.abcdefghijklmnopqrstuvwxyz123456';
  const fullyConfigured = parseSupabaseEnv({
    VITE_SUPABASE_URL: 'https://xyzcompany.supabase.co',
    VITE_SUPABASE_ANON_KEY: validKeyStr,
  });
  assert.strictEqual(fullyConfigured.isConfigured, true);
  assert.strictEqual(fullyConfigured.mode, 'cloud');
  assert.strictEqual(fullyConfigured.supabaseUrl, 'https://xyzcompany.supabase.co');
  assert.strictEqual(fullyConfigured.supabaseAnonKey, validKeyStr);

  console.log('✓ Environment parsing cleanly handles unconfigured, partial, and valid states');
}

// 4. Safe Diagnostic Redaction
{
  const validKeyStr = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.abcdefghijklmnopqrstuvwxyz123456';
  const config = parseSupabaseEnv({
    VITE_SUPABASE_URL: 'https://xyzcompany.supabase.co',
    VITE_SUPABASE_ANON_KEY: validKeyStr,
  });

  const summary = getSanitizedEnvSummary(config);
  assert.strictEqual(summary.mode, 'cloud');
  assert.strictEqual(summary.isConfigured, true);
  assert.strictEqual(summary.hasUrl, true);
  assert.strictEqual(summary.hasAnonKey, true);

  // Assert secret is NEVER exposed in raw form
  assert(!summary.maskedAnonKey?.includes(validKeyStr), 'Sanitized summary must not contain raw anon key');
  assert(summary.maskedAnonKey?.includes('...'), 'Sanitized anon key must be truncated/masked');
  assert(summary.maskedUrl?.includes('***'), 'Sanitized URL host must be partially masked');

  console.log('✓ Diagnostic redaction masks credentials and prevents log leakage');
}

// 5. Supabase Client Unconfigured State
{
  // In our local test environment without .env.local, cloud sync is unconfigured
  const client = getSupabaseClient();
  if (!isCloudSyncConfigured()) {
    assert.strictEqual(client, null, 'getSupabaseClient() must return null when unconfigured');

    // requireSupabaseClient() must throw a controlled, descriptive error
    assert.throws(
      () => {
        requireSupabaseClient();
      },
      /cloud synchronization is not configured/,
      'requireSupabaseClient() must throw helpful message when unconfigured'
    );
    console.log('✓ Unconfigured client state returns null safely and throws descriptive error on explicit require');
  } else {
    assert.notStrictEqual(client, null, 'getSupabaseClient() must return a client when configured');
    console.log('✓ Configured client instance initialized successfully');
  }
}

console.log('--- Phase SYNC-1A Supabase Foundation Tests Completed Successfully ---');
