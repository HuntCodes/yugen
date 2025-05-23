import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Alert, ScrollView, LayoutChangeEvent, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from '../../components/ui/StyledText';
import { supabase } from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingData } from '../../lib/openai';
import { useNavigation, useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { Screen } from '../../components/ui/Screen';
import { TrainingSession } from './training/components/types';
import { HeaderBar } from './training/components/HeaderBar';
import { SessionList, SessionListProps } from './training/components/SessionList';
import { SessionCard } from './training/components/SessionCard';
import { UpdateSessionModal, UpdateSessionModalProps } from './training/components/UpdateSessionModal';
import { fetchTrainingPlan, generateAndSavePlan, refreshWeeklyPlan, checkNeedsRefresh } from '../../services/plan';
import { fetchProfile } from '../../services/profile/profileService';
import TrainingOutlookView from './training/components/TrainingOutlookView';
import { formatDate as formatDateUtil, getDayOfWeek as getDayOfWeekUtil } from '../../lib/utils/dateUtils';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';

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

type TabView = 'Schedule' | 'Outlook';

// Custom compact header component
const CompactHeaderBar = ({ title }: { title: string }) => {
  return (
    <View style={compactHeaderStyles.header}>
      <Text style={compactHeaderStyles.headerTitle}>{title}</Text>
    </View>
  );
};

// Compact header styles
const compactHeaderStyles = StyleSheet.create({
  header: {
    backgroundColor: '#FBF7F6',
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 4,
    minHeight: 46,
  },
  headerTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 'bold',
    color: '#333333',
  },
});

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

  const [activeTab, setActiveTab] = useState<TabView>('Schedule');
  const [tabContainerWidth, setTabContainerWidth] = useState(0); // For slider animation
  const slideAnim = useRef(new Animated.Value(0)).current; // Initial position for Schedule

  useScrollToTop(scrollViewRef); // For tapping tab bar to scroll to top

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
  const safeParseSession = (session: any, currentUserId: string): TrainingSession => {
    try {
      return {
        id: session.id || `unknown-${Math.random().toString(36).substring(7)}`,
        week_number: typeof session.week_number === 'number' ? session.week_number : 1,
        day_of_week: typeof session.day_of_week === 'number' ? session.day_of_week : new Date(session.date || Date.now()).getUTCDay() || 7,
        session_type: session.session_type || 'Workout',
        date: session.date || new Date().toISOString().split('T')[0],
        distance: typeof session.distance === 'number' ? session.distance : 0,
        time: typeof session.time === 'number' ? session.time : 0,
        notes: session.notes || '',
        status: session.status || 'not_completed',
        phase: session.phase || 'Base',
        post_session_notes: session.post_session_notes || '',
        modified: session.modified || false,
        user_id: session.user_id || currentUserId,
      } as TrainingSession;
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

  const loadData = useCallback(async (scrollToSessionId?: string) => {
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
        setError('No training plan found. You can generate one from settings or your coach chat.');
        setSessions([]);
        setLoading(false);
        return;
      }

      let processedSessions = planSessions.map(s => safeParseSession(s, user.id));
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
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData(); // Initial load
  }, [loadData]);

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

  const handleSessionUpdate = async (sessionId: string, updates: Partial<TrainingSession>) => {
    setSessions(prevSessions =>
      prevSessions.map(s => (s.id === sessionId ? { ...s, ...updates } : s))
    );
    try {
      const { error: updateError } = await supabase
        .from('training_plans')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (updateError) throw updateError;
    } catch (e: any) {
      console.error('Failed to update session:', e);
      Alert.alert('Error', 'Failed to update session. Please try again.');
      await loadData(); 
    }
  };

  const handleGenerateFallback = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID not found.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const profile = await fetchProfile(userId);
      if (!profile) throw new Error('No profile data for fallback.');
      const fallbackOnboardingData: OnboardingData = {
        goalType: profile.goal_type || 'General Fitness',
        raceDate: profile.race_date,
        raceDistance: profile.race_distance,
        experienceLevel: profile.experience_level || 'Beginner',
        trainingFrequency: profile.current_frequency || '3 days/week',
        current_mileage: String(profile.current_mileage || '20'),
        units: profile.units || 'km',
        nickname: profile.nickname || 'Runner',
        userStartDate: new Date().toISOString().split('T')[0],
      };
      await generateAndSavePlan(userId, fallbackOnboardingData);
      await loadData();
      Alert.alert("Fallback Plan Generated", "A sample training plan has been generated for you.");
    } catch (err: any) {
      setError('Failed to generate fallback plan: ' + err.message);
      Alert.alert("Error", "Could not generate fallback plan. " + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  let content;
  if (loading && !retrying) {
    content = <View style={styles.centeredMessageContainer}><MinimalSpinner size={48} thickness={3} /></View>;
  } else if (error && sessions.length === 0) {
    content = (
      <View style={styles.centeredMessageContainer}>
        <Text style={styles.errorText}>{error}</Text>
        {userId && (
          <TouchableOpacity onPress={handleGenerateFallback} style={styles.button}>
            <Text style={styles.buttonText}>Generate Sample Plan</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  } else if (activeTab === 'Schedule') {
    if (sessions.length === 0 && !error) {
      content = (
        <View style={styles.centeredMessageContainer}>
          <Text style={styles.infoText}>No training sessions found.</Text>
          {userId && (
            <TouchableOpacity onPress={handleGenerateFallback} style={styles.button}>
              <Text style={styles.buttonText}>Generate Sample Plan</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    } else {
      content = (
        <ScrollView ref={scrollViewRef}>
          <SessionList
            sessions={sessions}
            formatDate={formatDateUtil}
            getDayOfWeek={getDayOfWeekUtil}
            sessionLayoutsRef={sessionLayoutsRef}
            scrollViewRef={scrollViewRef}
          >
            {(session, formattedDate, dayOfWeek, isModified) => (
              <SessionCard
                session={session}
                formattedDate={formattedDate}
                dayOfWeek={dayOfWeek}
                isModified={isModified}
                onUpdateSession={handleSessionUpdate}
                userId={userId || undefined}
              />
            )}
          </SessionList>
        </ScrollView>
      );
    }
  } else if (activeTab === 'Outlook') {
    content = <TrainingOutlookView />;
  }

  useEffect(() => {
    if (tabContainerWidth > 0) {
      const targetValue = activeTab === 'Schedule' ? 0 : tabContainerWidth / 2;
      Animated.spring(slideAnim, {
        toValue: targetValue,
        stiffness: 150, // Adjust for springiness
        damping: 20,    // Adjust for springiness
        useNativeDriver: true, // translateX is supported
      }).start();
    }
  }, [activeTab, tabContainerWidth, slideAnim]);

  return (
    <Screen style={{ backgroundColor: '#FBF7F6' }}>
      <View style={styles.flexOne}>
        <CompactHeaderBar title="Training Plan" />
        <View 
          style={styles.tabBarContainer}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            setTabContainerWidth(width);
          }}
        >
          {tabContainerWidth > 0 && (
            <Animated.View
              style={[
                styles.activeTabSlider, // New style for the sliding pill
                {
                  width: tabContainerWidth / 2,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            />
          )}
          <TouchableOpacity 
            style={styles.tabButton} // Simplified style
            onPress={() => setActiveTab('Schedule')}
          >
            <Text style={[styles.tabText, activeTab === 'Schedule' ? styles.activeTabText : styles.inactiveTabText]}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.tabButton} // Simplified style
            onPress={() => setActiveTab('Outlook')}
          >
            <Text style={[styles.tabText, activeTab === 'Outlook' ? styles.activeTabText : styles.inactiveTabText]}>Outlook</Text>
          </TouchableOpacity>
        </View>
        {content}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  tabBarContainer: {
    flexDirection: 'row',
    padding: 4, // Adjusted padding for the container to house the pill correctly
    backgroundColor: '#FBF7F6', // Match screen background, or a very light gray like #F0F0F0
    borderRadius: 9999,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    position: 'relative', // For absolute positioning of the slider
    height: 44, // Define a fixed height for the container, e.g., py-1.5 + text. Adjust as needed.
  },
  activeTabSlider: { 
    position: 'absolute',
    top: 4, // Corresponds to parent padding
    bottom: 4, // Corresponds to parent padding
    // height is implicitly (parentHeight - top - bottom)
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5, // Slightly smaller shadow
    elevation: 2,      // Slightly smaller elevation
  },
  tabButton: {
    flex: 1,             
    alignItems: 'center',
    justifyContent: 'center',
    // paddingVertical: 10, // Padding is now on the container and slider implicitly defines height
    borderRadius: 9999, // For touch ripple if any
    zIndex: 1, // Ensure buttons are clickable over the slider background (if it had no text)
  },
  tabText: { // General style for tab text, color will be overridden
    fontSize: 16,
    textAlign: 'center',
  },
  activeTabText: {
    color: '#000000',
    fontWeight: '600',
  },
  inactiveTabText: {
    color: '#000000', // Or a more muted color like '#4B5563' if desired
    fontWeight: '500',
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    textAlign: 'center',
    color: '#EF4444', 
    fontSize: 16,
    marginBottom: 16,
  },
  infoText: {
    textAlign: 'center',
    color: '#6B7280', 
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#3B82F6', 
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 