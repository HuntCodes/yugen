import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Alert, ScrollView, LayoutChangeEvent } from 'react-native';
import { Text } from '../../components/ui/StyledText';
import { supabase } from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingData } from '../../lib/openai';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/ui/Screen';
import { TrainingSession } from './training/components/types';
import { HeaderBar } from './training/components/HeaderBar';
import { SessionList } from './training/components/SessionList';
import { SessionCard } from './training/components/SessionCard';
import { UpdateSessionModal } from './training/components/UpdateSessionModal';
import { fetchTrainingPlan, generateAndSavePlan, refreshWeeklyPlan, checkNeedsRefresh } from '../../services/plan';
import { fetchProfile } from '../../services/profile/profileService';

// Add this type definition for layout storage
type SessionLayout = { y: number; height: number };

// Function to suggest shoe based on session type
const getSuggestedShoe = (sessionType: string): string => {
  const type = sessionType.toLowerCase();
  // Cloudmonster for easy runs, strength training, long runs
  if (type.includes('easy') || type.includes('strength') || type.includes('long')) {
    return 'Cloudmonster';
  }
  // Cloudboom Echo 4 for speed intervals, hills, fartlek
  else if (type.includes('interval') || type.includes('hill') || type.includes('fartlek') || type.includes('speed')) {
    return 'Cloudboom Echo 4';
  }
  // Default
  return 'Cloudmonster';
};

export default function TrainingPlanScreen() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [updatingDates, setUpdatingDates] = useState(false);
  const [hasOldDates, setHasOldDates] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updatingSession, setUpdatingSession] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextRefreshDate, setNextRefreshDate] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const navigation = useNavigation();

  // Refs for scrolling
  const scrollViewRef = useRef<ScrollView | null>(null);
  const sessionLayoutsRef = useRef<Record<string, SessionLayout>>({});
  const [targetScrollSessionId, setTargetScrollSessionId] = useState<string | null>(null);
  const [isTargetFirstOfWeek, setIsTargetFirstOfWeek] = useState<boolean>(false);
  const [scrollToTargetNeeded, setScrollToTargetNeeded] = useState(false);

  // Function to format date string for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (err) {
      console.error('Error formatting date:', dateString, err);
      return dateString; // Return original if parsing fails
    }
  };

  // Get day of week for a given date
  const getDayOfWeek = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } catch (err) {
      return '';
    }
  };

  // Function to safely parse session data
  const safeParseSession = (session: any): TrainingSession => {
    try {
      return {
        id: session.id || 'unknown-id',
        week_number: typeof session.week_number === 'number' ? session.week_number : 1,
        day_of_week: typeof session.day_of_week === 'number' ? session.day_of_week : 
                    new Date(session.date || new Date()).getDay() || 7, // Convert 0 (Sunday) to 7
        session_type: session.session_type || 'Unknown Type',
        date: session.date || new Date().toISOString(),
        distance: typeof session.distance === 'number' ? session.distance : 0,
        time: typeof session.time === 'number' ? session.time : 0,
        notes: session.notes || '',
        modified: !!session.modified,
        status: session.status || 'not_completed',
        post_session_notes: session.post_session_notes || '',
        suggested_shoe: session.suggested_shoe || ''
      };
    } catch (err) {
      console.error('Error parsing session:', err, session);
      return {
        id: 'error-id',
        week_number: 1,
        day_of_week: 1,
        session_type: 'Error',
        date: new Date().toISOString(),
        distance: 0,
        time: 0,
        notes: 'Error loading session data',
        modified: false,
        status: 'not_completed',
        post_session_notes: ''
      };
    }
  };

  // Function to check if dates are outdated (from a past year)
  const checkForOutdatedDates = (sessions: TrainingSession[]) => {
    const currentYear = new Date().getFullYear();
    const hasOutdated = sessions.some(session => {
      try {
        const sessionDate = new Date(session.date);
        return sessionDate.getFullYear() < currentYear;
      } catch (err) {
        return false;
      }
    });
    
    setHasOldDates(hasOutdated);
    if (hasOutdated) {
      setShowUpdateModal(true);
    }
    return hasOutdated;
  };

  // Calculate next Sunday for plan refresh
  const calculateNextRefreshDate = () => {
    const today = new Date();
    const day = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // If today is not Sunday, find next Sunday
    if (day !== 0) {
      const nextSunday = new Date(today);
      nextSunday.setDate(today.getDate() + (7 - day));
      nextSunday.setHours(7, 0, 0, 0); // 7 AM
      setNextRefreshDate(nextSunday);
    } else {
      // If today is Sunday and it's before 7 AM, refresh is today
      // Otherwise, it's next Sunday
      const refreshToday = today.getHours() < 7;
      
      if (refreshToday) {
        const todayRefresh = new Date(today);
        todayRefresh.setHours(7, 0, 0, 0);
        setNextRefreshDate(todayRefresh);
      } else {
        const nextSunday = new Date(today);
        nextSunday.setDate(today.getDate() + 7);
        nextSunday.setHours(7, 0, 0, 0);
        setNextRefreshDate(nextSunday);
      }
    }
  };

  // Function to update a session
  const handleUpdateSession = async (sessionId: string, updates: Partial<TrainingSession>) => {
    setUpdatingSession(true);
    try {
      const user = supabase.auth.session()?.user;
      if (!user) {
        console.warn("handleSessionUpdate: No user found, cannot update.");
        return;
      }
      
      // Update locally first for immediate UI feedback
      setSessions(prev => 
        prev.map(session => 
          session.id === sessionId 
            ? { 
                ...session,
                ...updates,
                distance: session.distance,
                time: session.time,
                suggested_shoe: session.suggested_shoe,
                session_type: session.session_type,
                date: session.date,
                notes: session.notes
              } 
            : session
        )
      );
      
      // Prepare update object
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      if (updates.status) updateData.status = updates.status;
      if (updates.post_session_notes !== undefined) updateData.post_session_notes = updates.post_session_notes;
      
      // Update Supabase
      const { data: updatedSession, error: updateError } = await supabase
        .from('training_plans')
        .update(updateData)
        .eq('id', sessionId)
        .select();
        
      if (updateError) {
        console.error('🔄 [TrainingPlanScreen] Error updating session:', updateError);
        Alert.alert('Error', 'Failed to update session. Please try again.');
        await fetchSessions(); // Revert local state
      }
    } catch (err: any) {
      console.error('🔄 [TrainingPlanScreen] Error in handleUpdateSession:', err);
      Alert.alert('Error', 'Failed to update session: ' + err.message);
      await fetchSessions(); // Revert local state
    } finally {
      setUpdatingSession(false);
    }
  };

  // Function to update all plan dates to current year
  const updatePlanDates = async () => {
    setUpdatingDates(true);
    setError(null);
    
    try {
      const user = supabase.auth.session()?.user;
      if (!user) throw new Error('Not logged in');
      
      const currentYear = new Date().getFullYear();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const firstSessionOfWeek1 = sessions
        .filter(s => s.week_number === 1)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
      
      if (!firstSessionOfWeek1) throw new Error('Could not find first session to anchor dates');
      
      const updates = sessions.map(session => {
        try {
          const sessionDate = new Date(session.date);
          if (sessionDate.getFullYear() === currentYear) return session;
          
          const firstDate = new Date(firstSessionOfWeek1.date);
          const dayDiff = Math.round((sessionDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
          
          const newDate = new Date(today);
          newDate.setDate(today.getDate() + dayDiff);
          
          return { ...session, date: newDate.toISOString().split('T')[0] };
        } catch (err) {
          console.error('Error updating date for session:', session.id, err);
          return session;
        }
      });
      
      // Batch update (or individual if preferred)
      for (const session of updates) {
        const { error: updateError } = await supabase
          .from('training_plans')
          .update({ date: session.date, updated_at: new Date().toISOString() })
          .eq('id', session.id);
        if (updateError) console.error('Error updating session date:', session.id, updateError);
      }
      
      await fetchSessions(); // Refresh sessions
      setShowUpdateModal(false);
      Alert.alert('Success', 'Training plan dates updated!');
      
    } catch (err: any) {
      console.error('Error updating plan dates:', err);
      setError(`Failed to update plan dates: ${err.message}`);
      Alert.alert('Error', 'Failed to update plan dates.');
    } finally {
      setUpdatingDates(false);
    }
  };

  const generateFallbackPlan = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID not found. Cannot generate fallback plan.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const profileData = await fetchProfile(userId);
      if (!profileData) throw new Error('No profile data found for fallback plan generation');

      const fallbackOnboardingData: OnboardingData = {
        goalType: profileData.goal_description || 'General Fitness',
        raceDate: profileData.race_date,
        raceDistance: profileData.goal_distance,
        experienceLevel: profileData.running_experience || 'Beginner',
        trainingFrequency: profileData.training_frequency || '3 days per week',
        current_mileage: profileData.weekly_volume || '20',
        units: profileData.units || 'km',
        nickname: profileData.display_name || 'Runner',
        trainingPreferences: profileData.training_preferences,
      };
      await generateAndSavePlan(userId, fallbackOnboardingData);
      await fetchSessions();
      Alert.alert("Fallback Plan Generated", "A sample training plan has been generated for you.");
    } catch (err: any) {
      console.error('Error generating fallback plan:', err);
      setError('Failed to generate fallback plan: ' + err.message);
      Alert.alert("Error", "Could not generate a fallback plan. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    sessionLayoutsRef.current = {}; // Clear layouts
    setTargetScrollSessionId(null); // Clear target
    setIsTargetFirstOfWeek(false);
    setScrollToTargetNeeded(false);

    try {
      const user = supabase.auth.session()?.user;
      if (!user) throw new Error('Not logged in');
      setUserId(user.id);

      calculateNextRefreshDate();
      const planSessions = await fetchTrainingPlan(user.id);

      if (!planSessions || planSessions.length === 0) {
        // Don't auto-generate a plan - set an error and let user generate explicitly
        setError('No training plan found. Click the button below to generate your personalized plan.');
        setLoading(false);
        return;
      }

      let processedSessions = planSessions.map(safeParseSession);
      processedSessions = processedSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Recalculate week numbers (assuming this logic is correct)
      if (processedSessions.length > 0) {
          const firstSessionDate = new Date(processedSessions[0].date);
          const firstSessionDay = firstSessionDate.getDay();
          const daysToSubtract = firstSessionDay === 0 ? 6 : firstSessionDay - 1;
          const firstWeekMonday = new Date(firstSessionDate);
          firstWeekMonday.setDate(firstSessionDate.getDate() - daysToSubtract);
          firstWeekMonday.setHours(0, 0, 0, 0);

          processedSessions = processedSessions.map(session => {
            const sessionDate = new Date(session.date);
            const daysDiff = Math.floor((sessionDate.getTime() - firstWeekMonday.getTime()) / (1000 * 60 * 60 * 24));
            const weekNumber = Math.floor(daysDiff / 7) + 1;
            return { ...session, week_number: weekNumber, day_of_week: sessionDate.getDay() || 7 }; // Ensure day_of_week is also correct
          });
      }

      setSessions(processedSessions);

      // --- Find Target Session for Scrolling ---
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
      // console.log(`[AutoScroll Debug] Today's date string: ${todayStr}`);

      let targetSession: TrainingSession | null = null;
      let isFirst = false;

      // Try to find today's session
      const todaySession = processedSessions.find(s => s.date.split('T')[0] === todayStr);

      if (todaySession) {
        // console.log(`[AutoScroll Debug] Found session for today: ${todaySession.id}`);
        targetSession = todaySession;
      } else {
        // console.log("[AutoScroll Debug] No session found for today. Finding next upcoming session.");
        // Find the first session on or after today
        const nextSession = processedSessions.find(s => s.date.split('T')[0] >= todayStr);
        if (nextSession) {
          // console.log(`[AutoScroll Debug] Found next upcoming session: ${nextSession.id} on ${nextSession.date}`);
           targetSession = nextSession;
        } else {
          // console.log("[AutoScroll Debug] No upcoming sessions found.");
        }
      }

      // Determine if the target session is the first of its week
      if (targetSession) {
          setTargetScrollSessionId(targetSession.id);
          const weekNumber = targetSession.week_number;
          // Find the first session explicitly listed for that week number
          const firstSessionOfTargetWeek = processedSessions
              .filter(s => s.week_number === weekNumber)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

          if (firstSessionOfTargetWeek && firstSessionOfTargetWeek.id === targetSession.id) {
              // console.log(`[AutoScroll Debug] Target session ${targetSession.id} is the first of week ${weekNumber}.`);
              isFirst = true;
          } else {
              // console.log(`[AutoScroll Debug] Target session ${targetSession.id} is NOT the first of its week.`);
          }
          setIsTargetFirstOfWeek(isFirst);
          setScrollToTargetNeeded(true);
      }
      // --- End Find Target Session ---

      checkForOutdatedDates(processedSessions);

    } catch (err: any) {
      console.error('Error fetching training plan:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Effect to scroll when needed and layout is available
  useEffect(() => {
    // Only proceed if we need to scroll and have a target ID
    if (!scrollToTargetNeeded || !targetScrollSessionId) {
      return;
    }

    let attemptCount = 0;
    const maxAttempts = 10; // Try for ~1.5 seconds
    let intervalId: NodeJS.Timeout | null = null;

    const tryScroll = () => {
      const layout = sessionLayoutsRef.current[targetScrollSessionId];
      if (layout) {
        // Layout is available, scroll now
        let scrollY = layout.y - 10; // Base position (slightly above the card)
        if (isTargetFirstOfWeek) {
            // console.log("[AutoScroll Debug] Adjusting scroll for week banner.");
            scrollY -= 40; // Subtract extra offset for week banner (adjust value as needed)
        }
        // console.log(`[AutoScroll Debug] Layout found for ${targetScrollSessionId} on attempt ${attemptCount + 1}. Scrolling to y=${scrollY}`, layout);
        scrollViewRef.current?.scrollTo({ y: Math.max(0, scrollY), animated: true }); // Ensure y isn't negative
        setScrollToTargetNeeded(false); // We're done
        if (intervalId) clearInterval(intervalId);
      } else {
        attemptCount++;
        // console.log(`[AutoScroll Debug] Layout for ${targetScrollSessionId} not ready, attempt ${attemptCount}`);
        if (attemptCount >= maxAttempts) {
          // console.log(`[AutoScroll Debug] Max scroll attempts reached for ${targetScrollSessionId}. Giving up.`);
          setScrollToTargetNeeded(false); // Stop trying
          if (intervalId) clearInterval(intervalId);
        }
      }
    };

    tryScroll(); // Check immediately

    if (scrollToTargetNeeded && attemptCount < maxAttempts) {
       intervalId = setInterval(tryScroll, 150); // Check every 150ms
    }

    return () => { if (intervalId) clearInterval(intervalId); };

  }, [targetScrollSessionId, scrollToTargetNeeded, isTargetFirstOfWeek]); // Added isTargetFirstOfWeek dependency

  useFocusEffect(
    useCallback(() => {
      fetchSessions();
    }, [])
  );

  useEffect(() => {
    fetchSessions(); // Initial load
  }, []);

  // Auto-scroll to current day or first upcoming session
  useEffect(() => {
    if (sessions && sessions.length > 0 && scrollViewRef.current && sessionLayoutsRef.current) {
      const todayISO = new Date().toISOString().split('T')[0];
      let targetSessionId: string | null = null;
      let firstUpcomingSessionY: number | null = null;
      let currentDaySessionY: number | null = null;

      // Sort sessions by date to ensure correct identification of current/upcoming
      const sortedSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const session of sortedSessions) {
        if (session.date === todayISO && sessionLayoutsRef.current[session.id]) {
          currentDaySessionY = sessionLayoutsRef.current[session.id].y;
          targetSessionId = session.id;
          break; // Prioritize current day
        }
        if (session.date > todayISO && sessionLayoutsRef.current[session.id]) {
          if (firstUpcomingSessionY === null) { // Find the first upcoming session
            firstUpcomingSessionY = sessionLayoutsRef.current[session.id].y;
            if (!targetSessionId) targetSessionId = session.id; // Set if current day not found
          }
        }
      }

      const targetY = currentDaySessionY ?? firstUpcomingSessionY;

      if (targetY !== null) {
        // Check if the target session is already visible to prevent unnecessary scrolls
        // This requires knowing the scroll view's current scroll position and height, 
        // which is more complex and might not be strictly necessary for a basic auto-scroll.
        // For simplicity, we'll scroll if a target is found.
        console.log(`[TrainingPlanScreen] Auto-scrolling to session ${targetSessionId} at y: ${targetY}`);
        scrollViewRef.current.scrollTo({ y: targetY, animated: true });
      }
    }
  }, [sessions]); // Rerun when sessions change

  const handleSessionLayout = (sessionId: string, event: LayoutChangeEvent) => {
    sessionLayoutsRef.current[sessionId] = event.nativeEvent.layout;
    // console.log('[TrainingPlanScreen] Layout for session', sessionId, event.nativeEvent.layout);
  };

  const renderHeader = () => (
    <View style={{ padding: 16, backgroundColor: '#F0ECEB', borderRadius: 8, marginHorizontal: 16, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Weekly Training Plan</Text>
      </View>
      {nextRefreshDate && (
        <Text style={{ fontSize: 14, color: '#666' }}>
          Next week's plan will be generated on: {nextRefreshDate.toLocaleDateString('en-US', {
            weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'
          })}
        </Text>
      )}
    </View>
  );

  const renderSessionList = () => {
    return (
      <View style={{ flex: 1 }}>
        {renderHeader()}
        <SessionList 
          sessions={sessions}
          formatDate={formatDate}
          getDayOfWeek={getDayOfWeek}
          sessionLayoutsRef={sessionLayoutsRef}
          scrollViewRef={scrollViewRef}
        >
          {(session, formattedDate, dayOfWeek, isModified) => (
            <SessionCard
              key={session.id}
              session={session}
              formattedDate={formattedDate}
              dayOfWeek={dayOfWeek}
              isModified={isModified}
              userId={userId || undefined}
              onUpdateSession={handleUpdateSession}
              onLayout={(event: LayoutChangeEvent) => handleSessionLayout(session.id, event)}
            />
          )}
        </SessionList>
      </View>
    );
  };

  return (
    <Screen style={{ backgroundColor: '#FBF7F6' }}>
      <HeaderBar title="Training Plan" />
      
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ marginTop: 16, color: '#666' }}>Loading your training plan...</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: 'red', marginBottom: 16, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity
            style={{ backgroundColor: '#007AFF', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4 }}
            onPress={retrying ? undefined : fetchSessions}
          >
            <Text style={{ color: 'white' }}>{retrying ? 'Retrying...' : 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
         <ScrollView ref={scrollViewRef} style={{ flex: 1 }}>
            {renderSessionList()}
         </ScrollView>
      )}
      
      {showUpdateModal && !updatingDates && hasOldDates && (
        <UpdateSessionModal
          isVisible={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          onUpdateDates={updatePlanDates}
          isUpdating={updatingDates}
        />
      )}
    </Screen>
  );
} 