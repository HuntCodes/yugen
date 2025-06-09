import { useState, useEffect } from 'react';

import { useAuth } from '../../context/AuthContext';
import { fetchProfile } from '../../services/profile/profileService';
// We'll use a more general type for profile for now, assuming fields exist.
// TODO: Define a comprehensive Profile type in src/types/profile.ts later

interface ProfileDataFromService {
  race_date?: string | null;
  // plan_start_date?: string | null; // This field might not exist directly
  created_at?: string; // Expect this from Supabase (selects '*')
  nickname?: string;
  current_mileage?: string;
  current_frequency?: string;
  units?: 'km' | 'miles';
  experience_level?: string;
  goal_type?: string;
  // Add other fields from the 'profiles' table that fetchProfile might return
  // For example, from OnboardingProfile if they are part of the main profile table:
  // For example, from OnboardingProfile if they are part of the main profile table:
}

export interface TrainingOutlookData {
  raceDate?: string | null;
  planStartDate?: string | null;
}

export function useTrainingOutlook() {
  const { session } = useAuth();
  const [outlookData, setOutlookData] = useState<TrainingOutlookData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfileData() {
      if (!session?.user?.id) {
        setLoading(false);
        // setError('User not authenticated.'); // Optional: set error if session is critical path here
        return;
      }

      try {
        setLoading(true);
        const profile = (await fetchProfile(session.user.id)) as ProfileDataFromService;
        if (profile) {
          // Use created_at for planStartDate, formatting it to YYYY-MM-DD
          const planStartDateFromCreatedAt = profile.created_at
            ? new Date(profile.created_at).toISOString().split('T')[0]
            : undefined;

          setOutlookData({
            raceDate: profile.race_date,
            planStartDate: planStartDateFromCreatedAt, // Use formatted created_at
          });
        } else {
          setError('Profile not found.');
        }
      } catch (e: any) {
        console.error('[useTrainingOutlook] Error fetching profile:', e);
        setError(e.message || 'Failed to load profile data for outlook.');
      } finally {
        setLoading(false);
      }
    }

    loadProfileData();
  }, [session]);

  return { outlookData, loading, error };
}
