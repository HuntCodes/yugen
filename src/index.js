// Environment testing script
// Run this with: node src/index.js

// Import process to access environment variables
const process = require('process');

function testEnvironment() {
  console.log('===== ENVIRONMENT VARIABLES TEST =====');
  console.log({
    // OpenAI API Keys
    EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY ? 'exists (length: ' + process.env.EXPO_PUBLIC_OPENAI_API_KEY.length + ')' : 'missing',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'exists (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'missing',
    
    // Supabase with EXPO_PUBLIC prefix
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'missing',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'exists (length: ' + process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.length + ')' : 'missing',
    
    // Supabase without EXPO_PUBLIC prefix
    SUPABASE_URL: process.env.SUPABASE_URL || 'missing',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'exists (length: ' + process.env.SUPABASE_ANON_KEY.length + ')' : 'missing',
    
    // EAS Project ID
    EAS_PROJECT_ID: process.env.EAS_PROJECT_ID || 'missing'
  });
  
  // Check if essential values are missing
  const missingValues = [];
  
  if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY) missingValues.push('EXPO_PUBLIC_OPENAI_API_KEY');
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) missingValues.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) missingValues.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  
  if (missingValues.length > 0) {
    console.log('\n⚠️ MISSING CRITICAL ENVIRONMENT VARIABLES:');
    console.log(missingValues.join(', '));
    console.log('\nPlease ensure your .env file has these values in the correct format (no quotes or commas)');
    console.log('Example format: EXPO_PUBLIC_OPENAI_API_KEY=sk-xxxx...');
  } else {
    console.log('\n✅ All critical environment variables are present');
  }
  
  console.log('===================================');
}

// Run the test
testEnvironment(); 