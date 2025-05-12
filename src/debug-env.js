import Constants from 'expo-constants';

export function debugEnvironment() {
  console.log('===== ENVIRONMENT DEBUG =====');
  console.log({
    // From process.env
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'exists' : 'missing',
    EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY ? 'exists' : 'missing',
    
    // From Constants
    expoConfigExtra: Constants.expoConfig?.extra ? {
      supabaseUrl: Constants.expoConfig?.extra?.supabaseUrl,
      hasAnonKey: !!Constants.expoConfig?.extra?.supabaseAnonKey,
      hasOpenAIKey: !!Constants.expoConfig?.extra?.OPENAI_API_KEY,
    } : 'missing',
    
    // Direct values for testing
    directSupabaseUrl: 'https://tdwtacijcmpfnwlovlxh.supabase.co'
  });
  console.log('=============================');
}

export async function testSupabaseConnection() {
  const supabaseUrl = "https://tdwtacijcmpfnwlovlxh.supabase.co";
  
  console.log('===== TESTING SUPABASE CONNECTION =====');
  console.log('Testing direct connection to Supabase URL:', supabaseUrl);
  
  try {
    // First try a simple GET request to the domain
    const domainResponse = await fetch(`${supabaseUrl}/`, {
      method: 'GET',
    });
    
    console.log('Domain connection test result:', {
      status: domainResponse.status,
      ok: domainResponse.ok
    });
    
    // Now test the edge function endpoint with a simple OPTIONS request
    const optionsResponse = await fetch(`${supabaseUrl}/functions/v1/ephemeral-key`, {
      method: 'OPTIONS',
    });
    
    console.log('Edge function OPTIONS test result:', {
      status: optionsResponse.status,
      ok: optionsResponse.ok
    });
    
    console.log('===== CONNECTION TEST COMPLETE =====');
    return {
      domainTest: domainResponse.ok,
      edgeFunctionTest: optionsResponse.ok
    };
  } catch (error) {
    console.error('Connection test failed:', error);
    console.log('===== CONNECTION TEST FAILED =====');
    return {
      domainTest: false,
      edgeFunctionTest: false,
      error: error.message
    };
  }
} 