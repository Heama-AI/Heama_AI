import 'dotenv/config';
import { ExpoConfig } from 'expo/config';

export default (): ExpoConfig => ({
  name: 'dementia-care',
  slug: 'dementia-care',
  scheme: 'heama',
  plugins: ['expo-sqlite'],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
