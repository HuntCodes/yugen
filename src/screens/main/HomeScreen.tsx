import { Feather } from '@expo/vector-icons';
import { LocalDate, DayOfWeek, TemporalAdjusters, ZoneId } from '@js-joda/core';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, useScrollToTop, useFocusEffect } from '@react-navigation/native';
import { useFont, SkFont } from '@shopify/react-native-skia';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  AppState,
  AppStateStatus,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { ChatMini } from './components/ChatMini';
import { MileageGraphCard } from './components/MileageGraphCard';
import { TrainingCardMini } from './components/TrainingCardMini';
import interMedium from '../../assets/fonts/Inter-Medium.ttf';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';
import { Text } from '../../components/ui/StyledText';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { TabParamList } from '../../navigation/TabNavigator';
import { fetchProfile, fetchCoach } from '../../services/profile/profileService';
import { Coach } from '../../types/coach';
import { TrainingSession } from './training/components/types';
import { COACHES } from '../../lib/constants/coaches';
import { useChatFlow, ChatMessage } from '../../hooks/useChatFlow';
import { useMileageData } from '../../hooks/training/useMileageData';
import { fetchTrainingPlan, applyPlanUpdate } from '../../services/plan/planService';
import { fetchChatHistory } from '../../services/chat/chatService';
import { PlanUpdate } from '../../types/planUpdate';
import { useAutoNotificationSetup } from '../../hooks/notifications/useAutoNotificationSetup';
import { useNotifications } from '../../hooks/notifications/useNotifications';

// DEBUG: Import notification debug functions
import { debugNotifications, scheduleTestNotifications, scheduleImmediateTest, clearAndRescheduleNotifications } from '../../services/notifications/debugNotifications';

// Import js-joda for robust local date handling
import '@js-joda/timezone'; // Required for ZoneId.systemDefault() and other timezone operations

// Import the actual DailyVoiceChat component
import DailyVoiceChat from '../../components/chat/DailyVoiceChat';
import { getSuggestedShoe } from '../../lib/utils/training/shoeRecommendations';

// Import weather hook (still needed for passing data to TrainingCardMini)
import { useWeather } from '../../hooks/useWeather';

// Import notification service
import { rescheduleAllNotificationsForNext14Days } from '../../services/notifications/notificationService';

// Map of coach IDs to images
const coachImages = {
  craig: require('../../assets/craig.jpg'),
  thomas: require('../../assets/thomas.jpg'),
  dathan: require('../../assets/dathan.jpg'),
};

// Default coach if none is selected
const DEFAULT_COACH: Coach = {
  id: 'craig',
  name: 'Craig Mottram',
  vibe: 'Motivational and high energy',
  philosophy: 'Run fast, rest hard. Recovery is key.',
  personalityBlurb: 'Aussie legend. Straight talker. Big on consistency.',
  image: 'craig.jpg',
};

export function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const { session } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const appState = useRef(AppState.currentState);
  useScrollToTop(scrollRef);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [coach, setCoach] = useState<Coach>(DEFAULT_COACH);
  const [upcomingSessions, setUpcomingSessions] = useState<TrainingSession[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [joinDate, setJoinDate] = useState<Date | null>(null);
  const [isDailyVoiceModeActive, setIsDailyVoiceModeActive] = useState(false);
  const [voiceStarting, setVoiceStarting] = useState(false);
  const graphFont = useFont(interMedium, 10);

  const { isTyping, error: chatError, processUserMessage } = useChatFlow();
  const weeklyMileage = useMileageData(upcomingSessions);

  // Add weather hook
  const {
    weatherData,
    isLoading: weatherLoading,
    error: weatherError,
    hasLocationPermission,
    requestPermission,
    refreshWeather,
    location,
  } = useWeather();

  // Auto-setup notifications for new and existing users
  useAutoNotificationSetup();

  // NEW: Get notification refresh function
  const { refreshNotifications } = useNotifications();

  // State for managing the plan update process
  const [planUpdateStatus, setPlanUpdateStatus] = useState({
    needsUpdate: false,
    isLoading: false,
    message: '',
    targetDateForGeneration: null as string | null, // ADDED: Date string (YYYY-MM-DD) for the Monday of the week to generate
  });

  // Track when the last plan check actually executed (for debounce inside the check function)
  const [lastPlanCheckTimestamp, setLastPlanCheckTimestamp] = useState<number | null>(null);

  // Function to determine the greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Function to format join date to just show the year
  const formatJoinYear = (date: Date | null) => {
    if (!date) return '2023'; // Fallback
    return date.getFullYear().toString();
  };

  const loadChatHistory = useCallback(
    async (userId: string) => {
      if (!userId) {
        console.error('[HomeScreen] Cannot load chat history: User ID is missing.');
        return;
      }

      try {
        console.log('[HomeScreen] Loading chat history for user:', userId);
        const history = await fetchChatHistory(userId);
        if (history && history.length > 0) {
          console.log('[HomeScreen] Loaded', history.length, 'chat messages.');
          setChatMessages(history);
        } else {
          console.log('[HomeScreen] No chat history found.');
          setChatMessages([]);
        }
      } catch (error) {
        console.error('[HomeScreen] Error loading chat history:', error);
      }
    },
    [setChatMessages]
  );

  useEffect(() => {
    // Load existing chat messages when session is available
    if (session?.user) {
      loadChatHistory(session.user.id);
    }
  }, [session, loadChatHistory]);

  const fetchUserData = useCallback(async () => {
    if (!session?.user) {
      console.warn('fetchUserData: No session user found.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('fetchUserData: Fetching data for user:', session.user.id);

      // Fetch profile
      const userProfile = await fetchProfile(session.user.id);
      console.log('fetchUserData: Profile fetched:', userProfile);
      setProfile(userProfile);

      // Fetch training plan
      const trainingPlan = await fetchTrainingPlan(session.user.id);
      console.log('fetchUserData: Training plan fetched with', trainingPlan.length, 'sessions');
      setUpcomingSessions(trainingPlan);
    } catch (err: any) {
      console.error('fetchUserData: Error fetching user data:', err);
      setError(err.message || 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, [session]);

  // New useEffect to manage loading state - wait for both user data and weather data
  useEffect(() => {
    // If there's no session or we're still fetching user data, keep loading
    if (!session?.user || !profile) {
      return;
    }

    // If user has location permission but weather is still loading, keep loading
    if (hasLocationPermission === true && weatherLoading) {
      console.log('[HomeScreen] Waiting for weather data to load...');
      return;
    }

    // If location permission is null (still checking), keep loading
    if (hasLocationPermission === null) {
      console.log('[HomeScreen] Waiting for location permission check...');
      return;
    }

    // All required data is ready - hide loading spinner
    console.log('[HomeScreen] All data ready, hiding loading spinner');
    setLoading(false);
  }, [session, profile, hasLocationPermission, weatherLoading]);

  // Fetch user data when session changes
  useEffect(() => {
    fetchUserData();
  }, [session, fetchUserData]);

  // AppState listener to reload screen when app comes back from background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('[HomeScreen] AppState changed from', appState.current, 'to', nextAppState);

      if (nextAppState === 'active' && appState.current !== 'active') {
        console.log('[HomeScreen] App came back from background - refreshing data only');

        // Just refresh data, don't interfere with voice chat at all
        fetchUserData();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    console.log('[HomeScreen] AppState listener added, current state:', AppState.currentState);

    return () => {
      console.log('[HomeScreen] AppState listener removed');
      subscription?.remove();
    };
  }, [fetchUserData]);

  // New useEffect to check for plan updates when upcomingSessions are loaded or profile changes
  useEffect(() => {
    // Only check if we have a profile and the initial load of sessions isn't pending (or has completed)
    // The original upcomingSessions.length > 0 might be too restrictive if a user has NO plan yet.
    // Let fetchUserData complete first.
    if (profile && !loading) {
      checkIfPlanUpdateNeeded();
    }
  }, [profile, loading, upcomingSessions]);

  const checkIfPlanUpdateNeeded = useCallback(async () => {
    if (!session?.user || !profile) {
      console.log('[checkIfPlanUpdateNeeded] No session or profile.');
      return;
    }

    const now = Date.now();
    // Debounce: if already checked recently, and no update is flagged or error shown, skip.
    if (
      lastPlanCheckTimestamp !== null &&
      now - lastPlanCheckTimestamp < 60000 &&
      !planUpdateStatus.needsUpdate &&
      !(planUpdateStatus.message && planUpdateStatus.message.toLowerCase().includes('error'))
    ) {
      console.log('[checkIfPlanUpdateNeeded] Debounced.');
      return;
    }

    // Record that we are performing a check now
    setLastPlanCheckTimestamp(now);

    console.log('[checkIfPlanUpdateNeeded] Running check...');

    try {
      const systemZone = ZoneId.systemDefault();
      const userLocalToday = LocalDate.now(systemZone);
      const dayOfWeek = userLocalToday.dayOfWeek();

      const currentWeekMonday = userLocalToday.with(
        TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)
      );
      const currentWeekSunday = currentWeekMonday.plusDays(6);
      const currentWeekMondayString = currentWeekMonday.toString();
      const currentWeekSundayString = currentWeekSunday.toString();

      const nextWeekMonday = currentWeekMonday.plusDays(7);
      const nextWeekSunday = nextWeekMonday.plusDays(6);
      const nextWeekMondayString = nextWeekMonday.toString();
      const nextWeekSundayString = nextWeekSunday.toString();

      let planNeedsGenerating = false;
      let dateStringToPassToEdgeFunction = '';
      let messageForUser = '';
      let relevantWeekStatusMessage = '';

      // On SUNDAY: check for NEXT week if it's empty
      if (dayOfWeek === DayOfWeek.SUNDAY) {
        console.log('[checkIfPlanUpdateNeeded] Today is Sunday, checking for NEXT week.');
        const sessionsInNextWeek = upcomingSessions.filter((s) => {
          const sessionDate = s.date;
          return sessionDate >= nextWeekMondayString && sessionDate <= nextWeekSundayString;
        });

        if (sessionsInNextWeek.length < 1) {
          console.log(
            '[checkIfPlanUpdateNeeded] Next week plan is missing. Flagging for generation.'
          );
          planNeedsGenerating = true;
          dateStringToPassToEdgeFunction = nextWeekMondayString;
          messageForUser = 'New plan for next week needed. Generating...';
        } else {
          console.log('[checkIfPlanUpdateNeeded] Plan for next week is already in place.');
          relevantWeekStatusMessage = 'Plan for next week is in place.';
        }
      } else {
        // Monday to Saturday: Only check current week if completely empty.
        console.log(
          '[checkIfPlanUpdateNeeded] Today is Mon-Sat, checking for CURRENT week (only if empty).'
        );
        const sessionsInCurrentWeek = upcomingSessions.filter((s) => {
          const sessionDate = s.date;
          return sessionDate >= currentWeekMondayString && sessionDate <= currentWeekSundayString;
        });

        if (sessionsInCurrentWeek.length < 1) {
          console.log(
            '[checkIfPlanUpdateNeeded] Current week plan is completely missing. Flagging for generation.'
          );
          planNeedsGenerating = true;
          dateStringToPassToEdgeFunction = currentWeekMondayString;
          messageForUser = "Current week's plan missing. Generating...";
        } else {
          console.log(
            '[checkIfPlanUpdateNeeded] Plan for current week is (at least partially) in place.'
          );
          relevantWeekStatusMessage = 'Plan for current week is in place.';
        }
      }

      if (planNeedsGenerating && dateStringToPassToEdgeFunction) {
        console.log(
          `[checkIfPlanUpdateNeeded] Needs update for ${dateStringToPassToEdgeFunction}. Message: ${messageForUser}`
        );
        if (!planUpdateStatus.isLoading) {
          // Only set if not already loading from a previous trigger
          setPlanUpdateStatus({
            needsUpdate: true,
            isLoading: false, // This will be set to true by the effect that calls handleRequestWeeklyPlanUpdate
            message: messageForUser,
            targetDateForGeneration: dateStringToPassToEdgeFunction,
          });
        }
      } else {
        console.log(
          `[checkIfPlanUpdateNeeded] No plan generation needed. Status: ${relevantWeekStatusMessage}`
        );
        if (
          planUpdateStatus.needsUpdate ||
          (relevantWeekStatusMessage && planUpdateStatus.message !== relevantWeekStatusMessage)
        ) {
          setPlanUpdateStatus({
            needsUpdate: false,
            isLoading: false,
            message: '', // Don't set the message to the label
            targetDateForGeneration: null,
          });
        }
      }
    } catch (error) {
      console.error('[checkIfPlanUpdateNeeded] Error:', error);
      setPlanUpdateStatus((prev) => ({
        ...prev,
        isLoading: false, // Ensure loading is false on error
        needsUpdate: false, // Don't keep trying if check itself failed
        message: 'Error checking plan status.',
      }));
    }
    // Key dependencies for re-running the check.
    // upcomingSessions is important because its content determines if a plan is needed.
    // profile is needed for session.user.
    // planUpdateStatus itself (or parts of it) to avoid re-running if already processing or recently decided.
  }, [
    session,
    profile,
    upcomingSessions,
    lastPlanCheckTimestamp,
    planUpdateStatus.isLoading,
    planUpdateStatus.needsUpdate,
    planUpdateStatus.message,
  ]);

  // useEffect to actually call the Edge Function when an update is needed and not already loading.
  useEffect(() => {
    if (
      planUpdateStatus.needsUpdate &&
      planUpdateStatus.targetDateForGeneration &&
      !planUpdateStatus.isLoading
    ) {
      // Immediately set isLoading to true to prevent multiple invocations from rapid state changes.
      // The message is already set by checkIfPlanUpdateNeeded.
      setPlanUpdateStatus((prev) => ({ ...prev, isLoading: true }));
      handleRequestWeeklyPlanUpdate(planUpdateStatus.targetDateForGeneration);
    }
  }, [planUpdateStatus]); // Depends on the entire planUpdateStatus object

  const handleRequestWeeklyPlanUpdate = async (targetMonday: string, attempt = 1) => {
    if (!session?.user) {
      Alert.alert('Error', 'You must be logged in to update the plan.');
      setPlanUpdateStatus({
        isLoading: false,
        needsUpdate: false,
        message: 'User not logged in.',
        targetDateForGeneration: null,
      });
      return;
    }

    // Connectivity check
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.log('[handleRequestWeeklyPlanUpdate] No network connection. Will retry in 5s');
      setPlanUpdateStatus({
        isLoading: false,
        needsUpdate: true,
        message: 'Waiting for connection…',
        targetDateForGeneration: targetMonday,
      });
      setTimeout(() => handleRequestWeeklyPlanUpdate(targetMonday, attempt), 5000);
      return;
    }

    if (attempt === 1) {
      console.log(
        `[handleRequestWeeklyPlanUpdate] Requesting plan update for week starting: ${targetMonday}`
      );
      setPlanUpdateStatus({
        isLoading: true,
        needsUpdate: false,
        message: `Generating plan for week of ${targetMonday}...`,
        targetDateForGeneration: targetMonday,
      });
    } else {
      console.log(`[handleRequestWeeklyPlanUpdate] Retry attempt ${attempt}`);
    }

    try {
      // include location if available
      const requestBody: Record<string, any> = {
        clientLocalDateString: targetMonday,
      };
      if (location?.latitude !== undefined && location?.longitude !== undefined) {
        requestBody.latitude = location.latitude;
        requestBody.longitude = location.longitude;
      }

      const { data, error: functionInvokeError } = await supabase.functions.invoke(
        'fn_request_weekly_plan_update',
        {
          body: JSON.stringify(requestBody),
        }
      );

      console.log('[handleRequestWeeklyPlanUpdate] Edge function response:', {
        data,
        functionInvokeError,
      });

      if (functionInvokeError) {
        console.error('Edge function invocation error:', functionInvokeError.message);
        Alert.alert('Error', `Failed to request plan update: ${functionInvokeError.message}`);
        setPlanUpdateStatus({
          isLoading: false,
          needsUpdate: true,
          message: `Error: ${functionInvokeError.message}`,
          targetDateForGeneration: targetMonday,
        });
        return;
      }

      if (data && data.error) {
        // Check for error returned in the data payload
        console.error('Edge function returned an error:', data.error);
        Alert.alert('Error', `Plan update failed: ${data.error}`);
        setPlanUpdateStatus({
          isLoading: false,
          needsUpdate: true,
          message: `Error: ${data.error}`,
          targetDateForGeneration: targetMonday,
        });
        return;
      }

      if (data && !data.success) {
        // Handle cases where success is explicitly false but no detailed error given
        console.warn('Edge function reported failure without specific error:', data);
        Alert.alert(
          'Plan Update Issue',
          data.message ||
            'The plan update could not be completed as expected. Please try again later.'
        );
        setPlanUpdateStatus({
          isLoading: false,
          needsUpdate: true,
          message: data.message || 'Update process reported an issue.',
          targetDateForGeneration: targetMonday,
        });
        return;
      }

      Alert.alert(
        'Plan Update Requested',
        data.message || 'Your training plan is being updated. This may take a moment.'
      );
      setPlanUpdateStatus({
        isLoading: false,
        needsUpdate: false,
        message: data.message || 'Plan update request sent.',
        targetDateForGeneration: null,
      });

      // NEW: Reschedule notifications after successful plan update
      if (session?.user && profile?.coach_id) {
        try {
          await rescheduleAllNotificationsForNext14Days(session.user!.id, profile.coach_id);
          console.log('[HomeScreen] Notifications rescheduled after plan update');
        } catch (notificationError) {
          console.error('[HomeScreen] Error rescheduling notifications after plan update:', notificationError);
        }
      }

      setTimeout(() => {
        fetchUserData();
      }, 3000);
    } catch (e: any) {
      console.error('Client-side error calling edge function:', e);

      const isNetworkErr =
        e instanceof TypeError &&
        typeof e.message === 'string' &&
        e.message.toLowerCase().includes('network request failed');

      if (isNetworkErr && attempt < 3) {
        console.log(`[handleRequestWeeklyPlanUpdate] Network error – retrying in ${attempt * 5}s`);
        setPlanUpdateStatus({
          isLoading: false,
          needsUpdate: true,
          message: 'Network unavailable… retrying',
          targetDateForGeneration: targetMonday,
        });
        setTimeout(() => handleRequestWeeklyPlanUpdate(targetMonday, attempt + 1), attempt * 5000);
        return;
      }

      Alert.alert('Update Error', `An unexpected error occurred: ${e.message}`);
      setPlanUpdateStatus({
        isLoading: false,
        needsUpdate: true,
        message: `Client error: ${e.message}`,
        targetDateForGeneration: targetMonday,
      });
    }
  };

  const handleSessionUpdate = async (sessionId: string, updates: Partial<TrainingSession>) => {
    const user = supabase.auth.session()?.user;
    if (!user) {
      console.warn('handleSessionUpdate: No user found, cannot update.');
      return;
    }

    setUpcomingSessions((prev) =>
      prev.map((session) => {
        if (session.id === sessionId) {
          const isCompleted = updates.status === 'completed';
          return {
            ...session,
            ...updates,
            modified: isCompleted,
            distance: session.distance,
            time: session.time,
            suggested_shoe: session.suggested_shoe,
            session_type: session.session_type,
            date: session.date,
            notes: session.notes,
            status: updates.status || session.status,
          };
        }
        return session;
      })
    );

    try {
      const { error: updateError } = await supabase
        .from('training_plans')
        .update({
          status: updates.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('Error updating session:', updateError);
        Alert.alert('Error', 'Failed to update session. Please try again.');

        const trainingPlan = await fetchTrainingPlan(user.id);
        if (trainingPlan) {
          setUpcomingSessions(trainingPlan);
        }
      }
    } catch (error) {
      console.error('Error updating session:', error);
      Alert.alert('Error', 'Failed to update session');

      const trainingPlan = await fetchTrainingPlan(user.id);
      if (trainingPlan) {
        setUpcomingSessions(trainingPlan);
      }
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!session?.user || !profile?.coach_id) return;

    const newUserMessage: ChatMessage = {
      sender: 'user',
      message,
      timestamp: Date.now(),
    };

    setChatMessages((prevMessages) => [...prevMessages, newUserMessage]);
    setWaitingForResponse(true);

    await processUserMessage(
      newUserMessage, // Pass the entire ChatMessage object
      session.user!.id,
      profile,
      upcomingSessions,
      handleCoachResponse,
      async () => {
        await fetchUserData();
        try {
          await rescheduleAllNotificationsForNext14Days(session.user!.id, profile.coach_id);
          console.log('[HomeScreen] Notifications rescheduled after chat/voice plan adjustment');
        } catch (notificationError) {
          console.error('[HomeScreen] Error rescheduling notifications after chat/voice plan adjustment:', notificationError);
        }
      },
      weatherData
    );
    setWaitingForResponse(false);
  };

  const handleCoachResponse = (response: ChatMessage) => {
    console.log('🏠 [HomeScreen] handleCoachResponse CALLED:', {
      sender: response.sender,
      messageLength: response.message?.length || 0,
      messagePreview: response.message?.substring(0, 100) + (response.message?.length > 100 ? '...' : ''),
      timestamp: response.timestamp,
      currentChatMessagesCount: chatMessages.length
    });
    setChatMessages((prevMessages) => {
      const newMessages = [...prevMessages, response];
      console.log('🏠 [HomeScreen] UPDATING chatMessages:', {
        previousCount: prevMessages.length,
        newCount: newMessages.length,
        newMessage: {
          sender: response.sender,
          messagePreview: response.message?.substring(0, 50) + '...'
        }
      });
      return newMessages;
    });
  };

  const handleDailyVoiceSessionComplete = useCallback(async () => {
    console.log('[HomeScreen] DailyVoiceChat session completed - refreshing home data');
    setIsDailyVoiceModeActive(false);
    setVoiceStarting(false); // Reset voice starting state
    // Refresh both user data and chat history after voice session is complete
    await fetchUserData();
    if (session?.user) {
      await loadChatHistory(session.user.id);
    }
  }, [fetchUserData, session, loadChatHistory]);

  const handleDailyVoiceError = useCallback(
    (error: string) => {
      console.error('[HomeScreen] DailyVoiceChat error:', error);
      setIsDailyVoiceModeActive(false);
      setVoiceStarting(false); // Reset voice starting state on error
      // Refresh chat history in case partial conversation was saved
      if (session?.user) {
        loadChatHistory(session.user.id);
      }
    },
    [session, loadChatHistory]
  );

  const handleDailyVoiceClose = useCallback(async () => {
    console.log('[HomeScreen] DailyVoiceChat closed by user');
    setIsDailyVoiceModeActive(false);
    setVoiceStarting(false); // Reset voice starting state
    // Refresh chat history in case conversation was saved before closing
    if (session?.user) {
      await loadChatHistory(session.user.id);
    }
  }, [session, loadChatHistory]);

  const handleActivateVoice = useCallback(() => {
    setVoiceStarting(true);
    // Small delay to show the disabled state before activating voice
    setTimeout(() => {
      setIsDailyVoiceModeActive(true);
      setVoiceStarting(false); // Reset since voice chat is now active
    }, 100);
  }, []);

  // New function to refresh data including chat messages
  const refreshHomeData = useCallback(async () => {
    console.log('[HomeScreen] Refreshing home data...');
    if (session?.user) {
      try {
        // Refresh all user data
        await fetchUserData();
        // Refresh chat history
        await loadChatHistory(session.user.id);
        console.log('[HomeScreen] All data refreshed successfully.');
      } catch (error) {
        console.error('[HomeScreen] Error refreshing home data:', error);
      }
    }
  }, [session, loadChatHistory, fetchUserData]);

  // Add useFocusEffect to refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[HomeScreen] Screen focused, refreshing data...');
      refreshHomeData();
    }, [refreshHomeData])
  );

  // Check and request location permission for existing users
  useEffect(() => {
    const checkLocationForExistingUsers = async () => {
      // Only check if we have a session and profile (user is logged in)
      if (session?.user && profile && hasLocationPermission === false) {
        // Small delay to avoid overwhelming the user with permission requests
        setTimeout(() => {
          console.log('[HomeScreen] Requesting location permission for existing user...');
          requestPermission();
        }, 2000);
      }
    };

    checkLocationForExistingUsers();
  }, [session, profile, hasLocationPermission, requestPermission]);

  // Debounced notification reschedule on app open/profile load
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    if (session?.user && profile?.coach_id) {
      const userId = session.user.id;
      const coachId = profile.coach_id;
      // Debounce to avoid excessive calls on rapid re-renders
      timeout = setTimeout(() => {
        rescheduleAllNotificationsForNext14Days(userId, coachId)
          .then(() => {
            console.log('[HomeScreen] Notifications rescheduled for next 14 days (app open/profile loaded)');
          })
          .catch((err) => {
            console.error('[HomeScreen] Error rescheduling notifications:', err);
          });
      }, 1000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [session?.user, profile?.coach_id]);

  // NEW: Update coach and join date when profile data is loaded
  useEffect(() => {
    if (!profile) return;

    // Update coach based on profile.coach_id
    if (profile.coach_id) {
      const selectedCoach = COACHES.find((c) => c.id === profile.coach_id);
      if (selectedCoach) {
        setCoach(selectedCoach);
      } else {
        // Fallback to default if something goes wrong
        setCoach(DEFAULT_COACH);
      }
    }

    // Update join date (use profile.created_at if available, otherwise fallback to session)
    if (profile.created_at) {
      setJoinDate(new Date(profile.created_at));
    } else if (session?.user?.created_at) {
      setJoinDate(new Date(session.user.created_at));
    }
  }, [profile?.coach_id, profile?.created_at]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#FBF7F6] px-6">
        <MinimalSpinner size={48} color="#BDBDBD" thickness={3} />
      </SafeAreaView>
    );
  }

  if (!profile && !loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#FBF7F6] p-4 px-6">
        <Text className="text-center text-red-500">
          Failed to load user profile. Please try logging out and back in.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF7F6' }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header Section */}
        <View style={{ marginBottom: 16, marginTop: 16 }}>
          <View className="px-6 pb-2 pt-4">
            <View className="mb-1 flex-row items-center">
              <View className="mr-4 h-16 w-16 items-center justify-center rounded-full bg-purple-500">
                <Text className="text-3xl font-bold text-white">
                  {profile?.nickname?.charAt(0) || profile?.email?.charAt(0) || 'J'}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-purple-500">
                  {getGreeting()}, {profile?.nickname || profile?.email?.split('@')[0] || 'Runner'}
                </Text>
                <Text className="text-gray-500">On member since {formatJoinYear(joinDate)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Upcoming Sessions Section - Moved to top */}
        <View className="mb-4">
          <TrainingCardMini
            sessions={upcomingSessions}
            onSessionUpdate={handleSessionUpdate}
            navigation={navigation}
            weatherData={weatherData}
          />
        </View>

        {/* Chat Section - Now includes voice functionality */}
        {!isDailyVoiceModeActive && (
          <View style={{ ...styles.chatSectionContainer, marginBottom: 16, marginTop: 0 }}>
            <ChatMini
              coachName={coach.name}
              coachId={coach.id}
              imageMap={coachImages as Record<string, any>}
              onMessageSend={handleSendMessage}
              isTyping={isTyping || waitingForResponse}
              messages={chatMessages}
              onVoiceActivate={handleActivateVoice}
              voiceStarting={voiceStarting}
              isDailyVoiceModeActive={isDailyVoiceModeActive}
            />
          </View>
        )}

        {/* Voice Chat Section - Only show when voice is active */}
        {isDailyVoiceModeActive && (
          <View style={{ ...styles.chatSectionContainer, marginBottom: 16, marginTop: 0 }}>
            <View className="h-[450px] items-center justify-center rounded-lg bg-white p-4 shadow-sm">
              <DailyVoiceChat
                coachId={coach.id}
                coachName={coach.name}
                coachAvatar={
                  coachImages[coach.id as keyof typeof coachImages] ||
                  require('../../assets/placeholder.png')
                }
                coachVibe={coach.vibe}
                coachPhilosophy={coach.philosophy}
                coachPersonalityBlurb={coach.personalityBlurb}
                userId={session?.user?.id || ''}
                profile={profile}
                currentTrainingPlan={upcomingSessions}
                weatherData={weatherData}
                onSessionComplete={handleDailyVoiceSessionComplete}
                onError={handleDailyVoiceError}
                onClose={handleDailyVoiceClose}
                isVisible={isDailyVoiceModeActive}
                refreshHomeScreen={refreshHomeData}
              />
            </View>
          </View>
        )}

        <View className="mt-6 px-4 pt-2">
          <Text className="mb-3 text-xl font-bold">Your Progress</Text>
          {!graphFont ? (
            <View
              style={{ height: 340, justifyContent: 'center', alignItems: 'center' }}
              className="rounded-lg bg-white p-4 shadow-sm">
              <MinimalSpinner />
              <Text className="text-text-secondary mt-2 text-sm">Loading graph...</Text>
            </View>
          ) : (
            <MileageGraphCard
              weeklyData={weeklyMileage}
              preferredUnit={profile?.units || 'km'}
              font={graphFont}
            />
          )}
        </View>

        {/* Plan Update UI */}
        {planUpdateStatus.isLoading && (
          <View style={styles.planUpdateContainer}>
            <MinimalSpinner size={24} color="#BDBDBD" thickness={2} />
            <Text style={styles.planUpdateText}>{planUpdateStatus.message}</Text>
          </View>
        )}
        {!planUpdateStatus.isLoading &&
          planUpdateStatus.message &&
          !planUpdateStatus.needsUpdate && (
            <View style={styles.planUpdateContainer}>
              <Text style={styles.planUpdateText}>{planUpdateStatus.message}</Text>
            </View>
          )}
        {/* End Plan Update UI */}
      </ScrollView>
    </SafeAreaView>
  );
}

// Add styles for the new elements
const styles = StyleSheet.create({
  chatSectionContainer: {
    marginHorizontal: 24,
    paddingHorizontal: 0,
  },
  voiceModeToggleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 32,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  coachAvatarSmall: {
    width: 60,
    height: 60,
    borderRadius: 30,
    // marginBottom: 8, // Removed as wrapper will handle margin
    borderWidth: 2,
    borderColor: 'white',
  },
  /* voiceButton: { // No longer needed, Tailwind classes used directly
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5D3FD3', 
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    elevation: 3, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    marginBottom: 10, 
  },
  voiceButtonText: { // No longer needed, Tailwind classes used directly
    color: 'white',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold',
  }, */
  switchToVoiceMessageButton: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  switchToVoiceMessageText: {
    color: '#5D3FD3',
    fontSize: 14,
    fontWeight: '500',
  },
  dailyVoiceChatContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 450, // Same as ChatMini for consistency during placeholder phase
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  placeholderText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
  },
  endVoiceChatButton: {
    backgroundColor: '#FF6347', // Tomato color for end button
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  planUpdateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: '#E9E9EB', // Neutral background
  },
  planUpdateNeeded: {
    backgroundColor: '#FFD699', // Light orange to indicate action needed
    justifyContent: 'space-between',
  },
  planUpdateText: {
    fontSize: 14,
    color: '#3C3C43',
    flexShrink: 1, // Allow text to shrink if button is present
    marginRight: 8,
  },
  planUpdateNeededText: {
    fontWeight: 'bold',
    color: '#BF5B04', // Darker orange for text
  },
  planUpdateButton: {
    backgroundColor: '#007AFF', // Standard iOS blue
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  planUpdateButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
