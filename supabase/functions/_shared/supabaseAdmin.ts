// supabase/functions/_shared/supabaseAdmin.ts
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is not set in environment variables.');
}
if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
}

export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
