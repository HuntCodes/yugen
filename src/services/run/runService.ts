import { supabase } from '../../lib/supabase';
import { Coord } from '../../hooks/useRunTracking';
import polyline from '@mapbox/polyline';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000; // metres
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface GuidedRunInsert {
  user_id: string;
  training_plan_id?: string;
  distance_m: number;
  duration_s: number;
  coords: Coord[];
  created_at?: string;
  completed_at?: string; // when the run finished
}

export interface Split {
  split_km: number;
  time_s: number;
  pace_s: number; // seconds per km
  distance_m: number;
}

/**
 * Save a guided run to Supabase.
 * Assumes a `guided_runs` table exists with columns:
 *   - id (uuid, default uuid_generate_v4())
 *   - user_id (uuid) FK -> profiles.id
 *   - session_id (uuid) nullable – link to training session if available
 *   - distance_m (numeric)
 *   - duration_s (integer)
 *   - coords (jsonb)
 *   - created_at / updated_at (timestamp)
 */
export const saveGuidedRun = async (run: GuidedRunInsert) => {
  const encodedPolyline = polyline.encode(
    (run.coords || []).map((c) => [c.latitude, c.longitude])
  );

  // Calculate splits and average pace
  const splits = calculateSplits(run.coords);
  const avgPace = calculateAveragePace(run.distance_m, run.duration_s);

  const payload = {
    user_id: run.user_id,
    training_plan_id: run.training_plan_id || null,
    distance_m: run.distance_m,
    duration_s: run.duration_s,
    polyline_encoded: encodedPolyline,
    splits: splits,
    created_at: run.created_at || new Date().toISOString(),
    completed_at: run.completed_at || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('guided_runs')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[runService] Failed to save guided run:', error);
    throw error;
  }

  // If linked to a training session, mark it as completed
  if (run.training_plan_id) {
    try {
      const { error: updateError } = await supabase
        .from('training_plans')
        .update({
          status: 'completed',
        })
        .eq('id', run.training_plan_id);

      if (updateError) {
        console.error('[runService] Failed to update training session:', updateError);
        // Don't throw - guided run was saved successfully
      }
    } catch (err) {
      console.error('[runService] Exception updating training session:', err);
    }
  }

  return data; // Returns the inserted row (including generated id)
};

/**
 * Check if a training session has a completed guided run
 * Returns the guided run data if found, null otherwise
 */
export const getGuidedRunForSession = async (sessionId: string, userId: string) => {
  const { data, error } = await supabase
    .from('guided_runs')
    .select('*')
    .eq('training_plan_id', sessionId)
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[runService] Failed to fetch guided run for session:', error);
    return null;
  }

  // Return first result or null if no results
  return data && data.length > 0 ? data[0] : null;
};

/**
 * Calculate average pace in seconds per kilometer
 */
export const calculateAveragePace = (distanceM: number, durationS: number): number => {
  if (distanceM <= 0) return 0;
  const distanceKm = distanceM / 1000;
  return durationS / distanceKm;
};

/**
 * Format pace from seconds to MM:SS format
 */
export const formatPace = (paceSeconds: number): string => {
  if (paceSeconds <= 0) return '0:00';
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.floor(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Calculate per-kilometer splits from coordinates
 */
export const calculateSplits = (coords: Coord[]): Split[] => {
  if (coords.length < 2) return [];

  const splits: Split[] = [];
  let currentDistance = 0;
  let splitStartIndex = 0;
  let splitNumber = 1;

  for (let i = 1; i < coords.length; i++) {
    const prevCoord = coords[i - 1];
    const currentCoord = coords[i];
    
    // Calculate distance between consecutive points
    const segmentDistance = haversineDistance(
      prevCoord.latitude,
      prevCoord.longitude,
      currentCoord.latitude,
      currentCoord.longitude
    );
    
    currentDistance += segmentDistance;

    // Check if we've completed a kilometer
    if (currentDistance >= 1000) {
      const splitStartTime = coords[splitStartIndex].timestamp;
      const splitEndTime = currentCoord.timestamp;
      const splitDuration = (splitEndTime - splitStartTime) / 1000; // Convert to seconds
      const pace = splitDuration; // seconds per km (since it's 1km)

      splits.push({
        split_km: splitNumber,
        time_s: splitDuration,
        pace_s: pace,
        distance_m: 1000,
      });

      // Reset for next split
      splitNumber++;
      splitStartIndex = i;
      currentDistance = 0;
    }
  }

  // Handle partial final split if there's remaining distance > 100m
  if (currentDistance > 100 && splitStartIndex < coords.length - 1) {
    const splitStartTime = coords[splitStartIndex].timestamp;
    const splitEndTime = coords[coords.length - 1].timestamp;
    const splitDuration = (splitEndTime - splitStartTime) / 1000;
    const pace = (splitDuration / currentDistance) * 1000; // Normalize to per-km pace

    splits.push({
      split_km: splitNumber,
      time_s: splitDuration,
      pace_s: pace,
      distance_m: currentDistance,
    });
  }

  return splits;
}; 