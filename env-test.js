// Simple environment variable test script
// Run with: node env-test.js
console.log('===== ENVIRONMENT VARIABLES TEST =====');

// Get all environment variables
const envVars = process.env;

// Check for OpenAI API key
const openaiKey = envVars.EXPO_PUBLIC_OPENAI_API_KEY || envVars.OPENAI_API_KEY;
console.log(
  'OpenAI API Key:',
  openaiKey ? `Present (${openaiKey.substring(0, 10)}...)` : 'Missing'
);

// Check for Supabase URL
const supabaseUrl = envVars.EXPO_PUBLIC_SUPABASE_URL || envVars.SUPABASE_URL;
console.log('Supabase URL:', supabaseUrl || 'Missing');

// Check for Supabase Anon Key
const supabaseKey = envVars.EXPO_PUBLIC_SUPABASE_ANON_KEY || envVars.SUPABASE_ANON_KEY;
console.log(
  'Supabase Anon Key:',
  supabaseKey ? `Present (${supabaseKey.substring(0, 10)}...)` : 'Missing'
);

// Check for EAS Project ID
console.log('EAS Project ID:', envVars.EAS_PROJECT_ID || 'Missing');

console.log('\nFormat issues in .env can cause environment variables to be missing.');
console.log('In .env files:');
console.log('- DO NOT use quotes around values');
console.log('- DO NOT use commas between entries');
console.log('- Each variable should be on its own line');
console.log('- Variable names should not have spaces');

console.log('\nCorrect format example:');
console.log('EXPO_PUBLIC_OPENAI_API_KEY=sk-abc123...');
console.log('EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co');
console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...');

console.log('\n===== TEST COMPLETE =====');
