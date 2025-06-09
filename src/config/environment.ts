import Constants from 'expo-constants';

/**
 * Environment configuration with type safety
 */
interface Environment {
  openAIApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/**
 * Get environment variables with fallbacks
 */
export const getEnvironment = (): Environment => {
  return {
    // First check process.env (for .env files), then Constants.expoConfig.extra (for app.json)
    openAIApiKey:
      process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
      (Constants.expoConfig?.extra?.OPENAI_API_KEY as string) ||
      '',

    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      (Constants.expoConfig?.extra?.supabaseUrl as string) ||
      '',

    supabaseAnonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      (Constants.expoConfig?.extra?.supabaseAnonKey as string) ||
      '',
  };
};

/**
 * Environment singleton
 */
export const environment = getEnvironment();
