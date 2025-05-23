import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, SafeAreaView, Image, Alert, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../components/ui/StyledText';
import { useNavigation, useScrollToTop, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../../navigation/TabNavigator';
import { supabase } from '../../lib/supabase';
import { fetchProfile, fetchCoach } from '../../services/profile/profileService';
import { useAuth } from '../../context/AuthContext';
import { Coach } from '../../types/coach';
import { TrainingCardMini } from './components/TrainingCardMini';
import { ChatMini } from './components/ChatMini';
import { MileageGraphCard } from './components/MileageGraphCard';
import { TrainingSession } from './training/components/types';
import { COACHES } from '../../lib/constants/coaches';
import { useChatFlow, ChatMessage } from '../../hooks/useChatFlow';
import { useMileageData } from '../../hooks/training/useMileageData';
import { fetchTrainingPlan, applyPlanUpdate } from '../../services/plan/planService';
import { fetchChatHistory } from '../../services/chat/chatService';
import { PlanUpdate } from '../../types/planUpdate';
import { Feather } from '@expo/vector-icons';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';
import { useFont, SkFont } from '@shopify/react-native-skia';
import interMedium from '../../assets/fonts/Inter-Medium.ttf';

// Import js-joda for robust local date handling
import { LocalDate, DayOfWeek, TemporalAdjusters, ZoneId } from '@js-joda/core';
import '@js-joda/timezone'; // Required for ZoneId.systemDefault() and other timezone operations

// Import the actual DailyVoiceChat component
import DailyVoiceChat from '../../components/chat/DailyVoiceChat';
import { VoiceCheckIn } from './components/VoiceCheckIn';

// Map of coach IDs to images
const coachImages = {
  'craig': require('../../assets/craig.jpg'),
  'thomas': require('../../assets/thomas.jpg'),
  'dathan': require('../../assets/dathan.jpg'),
};

// Default coach if none is selected
const DEFAULT_COACH: Coach = {
  id: 'craig',
  name: 'Craig Mottram',
  vibe: 'Motivational and high energy',
  philosophy: 'Run fast, rest hard. Recovery is key.',
  personalityBlurb: 'Aussie legend. Straight talker. Big on consistency.',
  image: 'craig.jpg'
};

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

export function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const { session } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [coach, setCoach] = useState<Coach>(DEFAULT_COACH);
  const [upcomingSessions, setUpcomingSessions] = useState<TrainingSession[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [joinDate, setJoinDate] = useState<Date | null>(null);
  const [isDailyVoiceModeActive, setIsDailyVoiceModeActive] = useState(false);
  const graphFont = useFont(interMedium, 10);
  
  const { isTyping, error: chatError, processUserMessage } = useChatFlow();
  const weeklyMileage = useMileageData(upcomingSessions);

  // State for managing the plan update process
  const [planUpdateStatus, setPlanUpdateStatus] = useState({
    needsUpdate: false,
    isLoading: false,
    message: '',
    targetDateForGeneration: null as string | null, // ADDED: Date string (YYYY-MM-DD) for the Monday of the week to generate
  });
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

  const loadChatHistory = useCallback(async (userId: string) => {
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
  }, [setChatMessages]);

  useEffect(() => {
    fetchUserData();
  }, [session]);

  useEffect(() => {
    // Load existing chat messages when session is available
    if (session?.user) {
      loadChatHistory(session.user.id);
    }
  }, [session, loadChatHistory]);

  const fetchUserData = useCallback(async () => {
    if (!session?.user) {
      console.log('fetchUserData: No user session found.');
      setLoading(false);
      setProfile(null);
      setCoach(DEFAULT_COACH);
      setUpcomingSessions([]);
      setChatMessages([]);
      setJoinDate(null);
      setPlanUpdateStatus({ needsUpdate: false, isLoading: false, message: '', targetDateForGeneration: null }); // Reset plan status
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching user data for user:', session.user.id);
      const profileData = await fetchProfile(session.user.id);
      setProfile(profileData);
      
      if (profileData?.created_at) {
        setJoinDate(new Date(profileData.created_at));
      } else if (session.user.created_at) {
        setJoinDate(new Date(session.user.created_at));
      }
      
      try {
        const trainingPlan = await fetchTrainingPlan(session.user.id);
        if (trainingPlan && trainingPlan.length > 0) {
          const updatedPlan = trainingPlan.map(session => ({
            ...session,
            suggested_shoe: session.suggested_shoe || getSuggestedShoe(session.session_type),
            status: session.status || 'not_completed' as const
          }));
          setUpcomingSessions(updatedPlan as TrainingSession[]);
        } else {
          setUpcomingSessions([]);
        }
      } catch (error) {
        console.error('Error fetching training plan:', error);
        setUpcomingSessions([]);
      }
      
      if (profileData?.coach_id) {
        const coachId = await fetchCoach(session.user.id);
        console.log('Found coach ID:', coachId);
        
        if (coachId) {
          const foundCoach = COACHES.find(c => c.id === coachId);
          
          if (foundCoach) {
            console.log('Setting coach:', foundCoach.name);
            setCoach(foundCoach);
          } else {
            console.log('Coach ID not found in COACHES list, using default');
            setCoach(DEFAULT_COACH);
          }
        }
      } else {
        console.log('No coach ID in profile, using default coach');
        setCoach(DEFAULT_COACH);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setCoach(DEFAULT_COACH);
      setProfile(null);
      setJoinDate(null);
    } finally {
      setLoading(false);
    }
  }, [session, setLoading, setProfile, setCoach, setUpcomingSessions, setChatMessages, setJoinDate, setPlanUpdateStatus, getSuggestedShoe]);

  // New useEffect to check for plan updates when upcomingSessions are loaded or profile changes
  useEffect(() => {
    // Only check if we have a profile and the initial load of sessions isn't pending (or has completed)
    // The original upcomingSessions.length > 0 might be too restrictive if a user has NO plan yet.
    // Let fetchUserData complete first.
    if (profile && !loading) { 
      checkIfPlanUpdateNeeded();
    }
  }, [profile, loading]); // Removed upcomingSessions, check when profile is loaded and initial loading is done

  const checkIfPlanUpdateNeeded = useCallback(async () => {
    if (!session?.user || !profile) {
      console.log('[checkIfPlanUpdateNeeded] No session or profile.');
      return;
    }

    const now = Date.now();
    // Debounce: if already checked recently, and no update is flagged or error shown, skip.
    if (lastPlanCheckTimestamp && (now - lastPlanCheckTimestamp < 60000) && 
        !planUpdateStatus.needsUpdate && 
        !(planUpdateStatus.message && planUpdateStatus.message.toLowerCase().includes('error'))) {
      console.log('[checkIfPlanUpdateNeeded] Debounced.');
      return;
    }
    setLastPlanCheckTimestamp(now);
    console.log('[checkIfPlanUpdateNeeded] Running check...');

    try {
      const systemZone = ZoneId.systemDefault();
      const userLocalToday = LocalDate.now(systemZone);
      const dayOfWeek = userLocalToday.dayOfWeek();

      const currentWeekMonday = userLocalToday.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
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
        const sessionsInNextWeek = upcomingSessions.filter(s => {
          const sessionDate = s.date; 
          return sessionDate >= nextWeekMondayString && sessionDate <= nextWeekSundayString;
        });

        if (sessionsInNextWeek.length < 1) {
          console.log('[checkIfPlanUpdateNeeded] Next week plan is missing. Flagging for generation.');
          planNeedsGenerating = true;
          dateStringToPassToEdgeFunction = nextWeekMondayString;
          messageForUser = "New plan for next week needed. Generating...";
        } else {
          console.log('[checkIfPlanUpdateNeeded] Plan for next week is already in place.');
          relevantWeekStatusMessage = "Plan for next week is in place.";
        }
      } else { // Monday to Saturday: Only check current week if completely empty.
        console.log('[checkIfPlanUpdateNeeded] Today is Mon-Sat, checking for CURRENT week (only if empty).');
        const sessionsInCurrentWeek = upcomingSessions.filter(s => {
          const sessionDate = s.date; 
          return sessionDate >= currentWeekMondayString && sessionDate <= currentWeekSundayString;
        });

        if (sessionsInCurrentWeek.length < 1) {
          console.log('[checkIfPlanUpdateNeeded] Current week plan is completely missing. Flagging for generation.');
          planNeedsGenerating = true;
          dateStringToPassToEdgeFunction = currentWeekMondayString;
          messageForUser = "Current week's plan missing. Generating...";
        } else {
          console.log('[checkIfPlanUpdateNeeded] Plan for current week is (at least partially) in place.');
        }
      }

      if (planNeedsGenerating && dateStringToPassToEdgeFunction) {
        console.log(`[checkIfPlanUpdateNeeded] Needs update for ${dateStringToPassToEdgeFunction}. Message: ${messageForUser}`);
        if (!planUpdateStatus.isLoading) { // Only set if not already loading from a previous trigger
        setPlanUpdateStatus({
          needsUpdate: true,
                isLoading: false, // This will be set to true by the effect that calls handleRequestWeeklyPlanUpdate
          message: messageForUser,
          targetDateForGeneration: dateStringToPassToEdgeFunction,
        });
        }
      } else {
        console.log(`[checkIfPlanUpdateNeeded] No plan generation needed. Status: ${relevantWeekStatusMessage}`);
        if (planUpdateStatus.needsUpdate || (relevantWeekStatusMessage && planUpdateStatus.message !== relevantWeekStatusMessage)) {
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
      setPlanUpdateStatus(prev => ({
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
}, [session, profile, upcomingSessions, lastPlanCheckTimestamp, planUpdateStatus.isLoading, planUpdateStatus.needsUpdate, planUpdateStatus.message]);

  // useEffect to actually call the Edge Function when an update is needed and not already loading.
  useEffect(() => {
    if (planUpdateStatus.needsUpdate && planUpdateStatus.targetDateForGeneration && !planUpdateStatus.isLoading) {
      // Immediately set isLoading to true to prevent multiple invocations from rapid state changes.
      // The message is already set by checkIfPlanUpdateNeeded.
      setPlanUpdateStatus(prev => ({ ...prev, isLoading: true })); 
      handleRequestWeeklyPlanUpdate(planUpdateStatus.targetDateForGeneration);
    }
  }, [planUpdateStatus]); // Depends on the entire planUpdateStatus object

  const handleRequestWeeklyPlanUpdate = async (targetMonday: string) => {
    if (!session?.user) {
      Alert.alert("Error", "You must be logged in to update the plan.");
      setPlanUpdateStatus({ isLoading: false, needsUpdate: false, message: 'User not logged in.', targetDateForGeneration: null });
      return;
    }

    console.log(`[handleRequestWeeklyPlanUpdate] Requesting plan update for week starting: ${targetMonday}`);
    setPlanUpdateStatus({ isLoading: true, needsUpdate: false, message: `Generating plan for week of ${targetMonday}...`, targetDateForGeneration: targetMonday });

    try {
      // Corrected: The body should be a stringified JSON object for this type of invocation.
      const { data, error: functionInvokeError } = await supabase.functions.invoke('fn_request_weekly_plan_update', {
        body: JSON.stringify({ clientLocalDateString: targetMonday }), 
      });

      console.log('[handleRequestWeeklyPlanUpdate] Edge function response:', { data, functionInvokeError });

      if (functionInvokeError) {
        console.error('Edge function invocation error:', functionInvokeError.message);
        Alert.alert("Error", `Failed to request plan update: ${functionInvokeError.message}`);
        setPlanUpdateStatus({ isLoading: false, needsUpdate: true, message: `Error: ${functionInvokeError.message}`, targetDateForGeneration: targetMonday });
        return;
      }

      if (data && data.error) { // Check for error returned in the data payload
        console.error('Edge function returned an error:', data.error);
        Alert.alert("Error", `Plan update failed: ${data.error}`);
        setPlanUpdateStatus({ isLoading: false, needsUpdate: true, message: `Error: ${data.error}`, targetDateForGeneration: targetMonday });
        return;
      }
      
      if (data && !data.success) { // Handle cases where success is explicitly false but no detailed error given
        console.warn('Edge function reported failure without specific error:', data);
        Alert.alert("Plan Update Issue", data.message || "The plan update could not be completed as expected. Please try again later.");
        setPlanUpdateStatus({ isLoading: false, needsUpdate: true, message: data.message || "Update process reported an issue.", targetDateForGeneration: targetMonday });
        return;
      }

      Alert.alert("Plan Update Requested", data.message || "Your training plan is being updated. This may take a moment.");
      setPlanUpdateStatus({ isLoading: false, needsUpdate: false, message: data.message || 'Plan update request sent.', targetDateForGeneration: null });
      
      setTimeout(() => {
        fetchUserData(); 
      }, 3000);

    } catch (e: any) {
      console.error('Client-side error calling edge function:', e);
      Alert.alert("Update Error", `An unexpected error occurred: ${e.message}`);
      setPlanUpdateStatus({ isLoading: false, needsUpdate: true, message: `Client error: ${e.message}`, targetDateForGeneration: targetMonday });
    }
  };

  const handleSessionUpdate = async (sessionId: string, updates: Partial<TrainingSession>) => {
    const user = supabase.auth.session()?.user;
    if (!user) {
        console.warn("handleSessionUpdate: No user found, cannot update.");
        return; 
    }

    setUpcomingSessions(prev => 
      prev.map(session => {
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
            status: updates.status || session.status
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
          updated_at: new Date().toISOString()
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
    if (!session?.user) {
      Alert.alert("Not signed in", "Please sign in to chat with your coach");
      return;
    }

    const userMessage: ChatMessage = { sender: 'user', message };
    setChatMessages(prev => [...prev, userMessage]);
    setWaitingForResponse(true);

    try {
      await processUserMessage(
        message, 
        session.user.id, 
        profile, 
        upcomingSessions,
        handleCoachResponse,
        fetchUserData
      );
    } catch (error) {
      console.error('Error processing message:', error);
      handleCoachResponse({
        sender: 'coach',
        message: 'Sorry, I had trouble processing your message. Please try again.'
      });
    }
  };
  
  const handleCoachResponse = (response: ChatMessage) => {
    console.log('Received coach response:', response);
    setChatMessages(prev => [...prev, response]);
    setWaitingForResponse(false);
  };

  const handleDailyVoiceSessionComplete = useCallback((conversationHistory: ChatMessage[], confirmedPlanUpdate?: PlanUpdate) => {
    console.log('Daily voice session complete. History:', conversationHistory);
    if (confirmedPlanUpdate) {
      console.log('Plan update confirmed:', confirmedPlanUpdate);
    }
    setIsDailyVoiceModeActive(false); 
  }, []);

  const handleDailyVoiceError = useCallback((errorMessage: string) => {
    console.error('Daily voice chat error:', errorMessage);
    Alert.alert("Voice Chat Error", errorMessage || "An unexpected error occurred in voice chat.");
    setIsDailyVoiceModeActive(false); 
  }, []);

  const handleDailyVoiceClose = useCallback(() => {
    setIsDailyVoiceModeActive(false);
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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FBF7F6] px-6 justify-center items-center">
        <MinimalSpinner size={48} color="#BDBDBD" thickness={3} />
      </SafeAreaView>
    );
  }

  if (!profile && !loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FBF7F6] px-6 justify-center items-center p-4">
        <Text className="text-red-500 text-center">Failed to load user profile. Please try logging out and back in.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FBF7F6' }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={{ marginBottom: 32, marginTop: 16 }}>
          <View className="px-6 pt-4 pb-2">
            <View className="flex-row items-center mb-1">
              <View className="w-16 h-16 rounded-full bg-purple-500 items-center justify-center mr-4">
                <Text className="text-white text-3xl font-bold">
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
        
        <View style={{ marginBottom: 32 }}>
          <TrainingCardMini 
            sessions={upcomingSessions}
            onSessionUpdate={handleSessionUpdate}
            navigation={navigation}
          />
        </View>
        
        <View style={{ ...styles.chatSectionContainer, marginBottom: 32, marginTop: 0 /* Resetting marginTop as marginBottom is now used */ }}> 
          {isDailyVoiceModeActive ? (
            <DailyVoiceChat
              coachId={coach.id}
              coachName={coach.name}
              coachAvatar={coachImages[coach.id as keyof typeof coachImages] || require('../../assets/placeholder.png')}
              coachVibe={coach.vibe}
              coachPhilosophy={coach.philosophy}
              coachPersonalityBlurb={coach.personalityBlurb}
              userId={session?.user?.id || ''}
              profile={profile}
              currentTrainingPlan={upcomingSessions}
              onSessionComplete={handleDailyVoiceSessionComplete}
              onError={handleDailyVoiceError}
              onClose={handleDailyVoiceClose}
              isVisible={isDailyVoiceModeActive}
              refreshHomeScreen={refreshHomeData}
              // onSpeakingStateChange={(isSpeaking, speaker) => console.log('Speaker:', speaker, 'isSpeaking:', isSpeaking)}
            />
          ) : (
            <View>
              <VoiceCheckIn
                coachId={coach.id}
                coachName={coach.name}
                imageMap={coachImages as Record<string, any>}
                onActivateVoice={() => setIsDailyVoiceModeActive(true)}
              />
              <ChatMini 
                coachName={coach.name}
                coachId={coach.id}
                imageMap={coachImages as Record<string, any>}
                onMessageSend={handleSendMessage}
                isTyping={isTyping || waitingForResponse} 
                messages={chatMessages}
              />
            </View>
          )}
        </View>
        
        <View className="px-4 mt-6 pt-2">
          <Text className="font-bold text-xl mb-3">Your Progress</Text>
          {!graphFont ? (
            <View style={{ height: 340, justifyContent: 'center', alignItems: 'center' }} className="bg-white rounded-lg p-4 shadow-sm">
              <MinimalSpinner />
              <Text className="text-sm text-text-secondary mt-2">Loading graph...</Text>
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
        {!planUpdateStatus.isLoading && planUpdateStatus.message && !planUpdateStatus.needsUpdate && (
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