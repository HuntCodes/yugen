import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Get Supabase URL and Service Role Key from Deno environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is not set in the environment.');
}
if (!supabaseServiceRoleKey) {
  // Depending on your use case, you might want to use SUPABASE_ANON_KEY for client-side operations
  // but for admin tasks from edge functions, service role key is typical.
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in the environment.');
}

// Create and export the Supabase client instance.
// This instance will be used by other Deno services for database operations.
export const arqué = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    // It's generally good practice to disable auto-refreshing tokens on the server-side.
    // The Edge Function will authenticate using the user's JWT passed in the Authorization header.
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

console.log('[_shared/arquéClient.ts] Supabase client (arqué) initialized.');
