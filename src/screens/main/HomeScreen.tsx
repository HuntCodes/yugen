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
import { MileageGraph } from '../../components/training/MileageGraph';
import { TrainingSession } from './training/components/types';
import { COACHES } from '../../lib/constants/coaches';
import { useChatFlow, ChatMessage } from '../../hooks/useChatFlow';
import { useMileageData } from '../../hooks/training/useMileageData';
import { fetchTrainingPlan, applyPlanUpdate } from '../../services/plan/planService';
import { fetchChatHistory } from '../../services/chat/chatService';
import { PlanUpdate } from '../../types/planUpdate';
import { Feather } from '@expo/vector-icons';

// Import js-joda for robust local date handling
import { LocalDate, DayOfWeek, TemporalAdjusters, ZoneId } from '@js-joda/core';
import '@js-joda/timezone'; // Required for ZoneId.systemDefault() and other timezone operations

// Import the actual DailyVoiceChat component
import DailyVoiceChat from '../../components/chat/DailyVoiceChat';

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

  useEffect(() => {
    fetchUserData();
  }, [session]);

  useEffect(() => {
    // Load existing chat messages when session is available
    if (session?.user) {
      loadChatHistory(session.user.id);
    }
  }, [session]);

  const loadChatHistory = async (userId: string) => {
    try {
      const history = await fetchChatHistory(userId);
      if (history && history.length > 0) {
        setChatMessages(history);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

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
    if (profile && upcomingSessions.length > 0) { // Check only when we have some plan data
      checkIfPlanUpdateNeeded();
    }
  }, [profile, upcomingSessions]);

  const checkIfPlanUpdateNeeded = useCallback(async () => {
    if (!session?.user || !profile) return;
    if (planUpdateStatus.isLoading) return;

    const now = Date.now();
    // Adjust debounce logic slightly: if needsUpdate is already true, allow re-check more readily
    // or if an error message is shown.
    if (lastPlanCheckTimestamp && (now - lastPlanCheckTimestamp < 60000) && !planUpdateStatus.needsUpdate && !planUpdateStatus.message.toLowerCase().includes('error')) {
      return;
    }
    setLastPlanCheckTimestamp(now);

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
      let messageForUser = ''; // Message when initiating generation
      let relevantWeekStatusMessage = ''; // Message if plan is already in place

      if (dayOfWeek === DayOfWeek.SUNDAY) {
        // On Sunday, check if NEXT week's plan (next Mon to next Sun) is missing.
        const sessionsInNextWeek = upcomingSessions.filter(s => {
          const sessionDate = s.date; // YYYY-MM-DD
          return sessionDate >= nextWeekMondayString && sessionDate <= nextWeekSundayString;
        });

        if (sessionsInNextWeek.length < 1) {
          planNeedsGenerating = true;
          dateStringToPassToEdgeFunction = nextWeekMondayString; // Tell EF to generate for next week's Monday
          messageForUser = "New plan for next week required. Initiating generation...";
        } else {
          relevantWeekStatusMessage = "Plan for next week is in place.";
        }
      } else { // Monday to Saturday
        // On other days (Mon-Sat), check if CURRENT week's plan (current Mon to current Sun) is missing.
        const sessionsInCurrentWeek = upcomingSessions.filter(s => {
          const sessionDate = s.date; // YYYY-MM-DD
          return sessionDate >= currentWeekMondayString && sessionDate <= currentWeekSundayString;
        });

        if (sessionsInCurrentWeek.length < 1) {
          planNeedsGenerating = true;
          dateStringToPassToEdgeFunction = currentWeekMondayString; // Tell EF to generate for current week's Monday
          messageForUser = "New plan for the current week required. Initiating generation...";
        } else {
          relevantWeekStatusMessage = "Plan for current week is in place.";
        }
      }

      if (planNeedsGenerating) {
        setPlanUpdateStatus({
          needsUpdate: true,
          isLoading: false,
          message: messageForUser,
          targetDateForGeneration: dateStringToPassToEdgeFunction,
        });
      } else {
        // Plan is in place for the relevant period.
        // Only update message if not loading and no error, or if message was the "initiating" one.
        if (!planUpdateStatus.isLoading) {
           // If current message is an error and needsUpdate is false, keep error. Else, show "in place" message.
          const shouldUpdateMessage = !(planUpdateStatus.message.toLowerCase().includes('error') && !planUpdateStatus.needsUpdate);

          setPlanUpdateStatus(prev => ({
            ...prev,
            needsUpdate: false,
            message: shouldUpdateMessage ? relevantWeekStatusMessage : prev.message,
            targetDateForGeneration: null,
          }));
        }
      }
    } catch (error) {
      console.error('[PlanCheck] Error in checkIfPlanUpdateNeeded:', error);
      setPlanUpdateStatus({
        needsUpdate: false, // Or true if you want to retry on error
        isLoading: false,
        message: 'Error checking plan status.',
        targetDateForGeneration: null,
      });
    }
  }, [session, profile, upcomingSessions, planUpdateStatus.isLoading, planUpdateStatus.message, planUpdateStatus.needsUpdate, lastPlanCheckTimestamp, setPlanUpdateStatus]);

  // Check for plan update on initial load and when sessions/profile data changes
  useEffect(() => {
    if (profile && session?.user) { // Ensure profile and session are loaded
        checkIfPlanUpdateNeeded();
    }
  }, [profile, upcomingSessions, session, checkIfPlanUpdateNeeded]);

  // Also check on screen focus, in case the user navigates away and comes back
  useFocusEffect(
    useCallback(() => {
      if (session?.user && profile) {
        checkIfPlanUpdateNeeded();
      }
    }, [session, profile, checkIfPlanUpdateNeeded])
  );

  const handleRequestWeeklyPlanUpdate = useCallback(async (targetDateForGeneration?: string | null) => {
    if (!session?.user) {
      Alert.alert('Not Signed In', 'Please sign in to update your plan.');
      return;
    }
    // Preserve the "Initiating generation..." message if it was set, otherwise use default.
    setPlanUpdateStatus(prev => ({
      ...prev, // Important to spread prev to keep targetDateForGeneration if it was set
      needsUpdate: false,
      isLoading: true,
      message: prev.message.startsWith("New plan for") ? prev.message : 'Requesting new weekly plan...',
      // targetDateForGeneration is already part of prev or passed in
    }));
    
    const systemZone = ZoneId.systemDefault();
    // clientLocalDateString will be the specific Monday (if passed) or today's date.
    // The Edge Function's getMondayUtc will correctly use this Monday or find the Monday of the week this date is in.
    const clientLocalDateString = targetDateForGeneration || LocalDate.now(systemZone).toString();

    try {
      console.log(`[HomeScreen] Calling fn_request_weekly_plan_update with clientLocalDateString (target Monday or today): ${clientLocalDateString}`);
      const { data, error } = await supabase.functions.invoke('fn_request_weekly_plan_update', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientLocalDateString: clientLocalDateString }),
      });
      if (error) {
        console.error('[HomeScreen] Error calling Edge Function fn_request_weekly_plan_update:', error);
        Alert.alert('Error', `Failed to update weekly plan: ${error.message || 'Unknown error'}`);
        setPlanUpdateStatus({
          needsUpdate: true, // Suggest re-evaluation
          isLoading: false,
          message: `Error: ${error.message || 'Plan update failed.'}`,
          targetDateForGeneration: targetDateForGeneration !== undefined ? targetDateForGeneration : null, // Keep target for context, ensure null if undefined
        });
      } else {
        console.log('[HomeScreen] Edge Function fn_request_weekly_plan_update success:', data);
        Alert.alert('Success', data.message || 'Weekly plan update request processed! Fetching new plan...');
        setPlanUpdateStatus({
          needsUpdate: false,
          isLoading: false,
          message: data.message || 'Plan requested successfully!',
          targetDateForGeneration: null, // Clear target after success
        });
        await fetchUserData(); // Refresh data
      }
    } catch (e: any) {
      console.error('[HomeScreen] Exception calling Edge Function fn_request_weekly_plan_update:', e);
      Alert.alert('Error', `An exception occurred: ${e.message || 'Unknown error'}`);
      setPlanUpdateStatus({
        needsUpdate: true, // Suggest re-evaluation
        isLoading: false,
        message: `Exception: ${e.message || 'Plan update failed.'}`,
        targetDateForGeneration: targetDateForGeneration !== undefined ? targetDateForGeneration : null, // Keep target for context, ensure null if undefined
      });
    }
  }, [session, fetchUserData]); // supabase is global, ZoneId, LocalDate are stable, fetchUserData is useCallback-wrapped

  // useEffect to automatically trigger plan update if needed
  useEffect(() => {
    if (planUpdateStatus.needsUpdate && !planUpdateStatus.isLoading && session?.user) {
      handleRequestWeeklyPlanUpdate(planUpdateStatus.targetDateForGeneration);
    }
    // Add planUpdateStatus.targetDateForGeneration to dependency array
  }, [planUpdateStatus.needsUpdate, planUpdateStatus.isLoading, planUpdateStatus.targetDateForGeneration, session?.user, handleRequestWeeklyPlanUpdate]);

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
        handleCoachResponse
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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FBF7F6] px-6 justify-center items-center">
        <ActivityIndicator size="large" color="#000000" />
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
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
              // onSpeakingStateChange={(isSpeaking, speaker) => console.log('Speaker:', speaker, 'isSpeaking:', isSpeaking)}
            />
          ) : (
            <View>
              <View style={styles.voiceModeToggleContainer}>
                {coach && coachImages[coach.id as keyof typeof coachImages] && (
                  <View className="relative mb-2">
                    <Image source={coachImages[coach.id as keyof typeof coachImages]} style={styles.coachAvatarSmall} />
                    <View 
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"
                    />
                  </View>
                )}
                <TouchableOpacity 
                  className="flex-row items-center bg-purple-500 py-3 px-5 rounded-full shadow-md mb-2.5" 
                  onPress={() => setIsDailyVoiceModeActive(true)}
                >
                  <Feather name="mic" size={24} color="white" />
                  <Text className="text-white ml-2 text-base font-bold font-inter">Check in with your coach</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {/* This will switch to text chat, which is the default when isDailyVoiceModeActive is false */ setIsDailyVoiceModeActive(false);}}>
                   {/* Text chat is the default, so this button might not be needed if voice is overlay or separate section */}
                </TouchableOpacity>
              </View>
               <ChatMini 
                coachName={coach.name}
                coachId={coach.id}
                imageMap={coachImages as Record<string, any>}
                onMessageSend={handleSendMessage}
                isTyping={isTyping || waitingForResponse} 
                messages={chatMessages}
              />
              {/* <TouchableOpacity onPress={() => setIsDailyVoiceModeActive(true)} style={styles.switchToVoiceMessageButton}> 
                  <Text style={styles.switchToVoiceMessageText}>Or, talk to your coach instead</Text>
              </TouchableOpacity> */}
            </View>
          )}
        </View>
        
        <View className="px-6 pt-2 pb-4">
          <Text className="font-bold text-xl mb-3">Your Progress</Text>
          {weeklyMileage && weeklyMileage.length > 0 ? (
            <MileageGraph 
              weeklyData={weeklyMileage} 
              preferredUnit={profile?.preferred_unit || 'km'}
            />
          ) : (
            <Text className="text-gray-500 text-center py-4">No mileage data yet.</Text>
          )}
        </View>

        {/* Plan Update UI */}
        {planUpdateStatus.isLoading && (
          <View style={styles.planUpdateContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
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
    marginHorizontal: 16,
    // marginTop: 24, // Will be controlled by inline style
    // backgroundColor: 'white', // ChatMini might have its own background
    // borderRadius: 12,
    // padding: 16,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.05,
    // shadowRadius: 2,
    // elevation: 2,
  },
  voiceModeToggleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 32,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 12,
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