import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, SafeAreaView, Image, Alert, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/StyledText';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
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
  
  const { isTyping, error: chatError, processUserMessage } = useChatFlow();
  const weeklyMileage = useMileageData(upcomingSessions);

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

  const fetchUserData = async () => {
    if (!session?.user) {
      console.log('fetchUserData: No user session found.');
      setLoading(false);
      setProfile(null);
      setCoach(DEFAULT_COACH);
      setUpcomingSessions([]);
      setChatMessages([]);
      setJoinDate(null);
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
    <SafeAreaView className="flex-1 bg-[#FBF7F6]">
      <ScrollView ref={scrollRef} className="flex-1">
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
        
        <TrainingCardMini 
          sessions={upcomingSessions}
          onSessionUpdate={handleSessionUpdate}
          navigation={navigation}
        />
        
        <View className="mx-6 mt-2 mb-4">
          <Text className="font-bold text-xl mb-3">Chat with Coach</Text>
          <ChatMini
            coachName={coach.name}
            coachId={coach.id}
            imageMap={coachImages}
            onMessageSend={handleSendMessage}
            isTyping={isTyping || waitingForResponse}
            messages={chatMessages}
          />
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
      </ScrollView>
    </SafeAreaView>
  );
} 