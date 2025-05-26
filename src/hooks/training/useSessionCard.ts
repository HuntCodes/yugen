import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { TrainingSession } from '../../screens/main/training/components/types';
import { colors } from '../../styles/colors';
import { processWorkoutNotes } from '../../services/summary/workoutNoteService';
import { supabase } from '../../lib/api/supabase';
import { getSuggestedShoe } from '../../lib/utils/training/shoeRecommendations';

// Define session status type
type AppSessionStatus = 'completed' | 'missed' | 'planned' | 'not_completed' | 'skipped';

export function useSessionCard(
  session: TrainingSession,
  formattedDate: string,
  userId?: string,
  onUpdateSession?: (sessionId: string, updates: Partial<TrainingSession>) => Promise<void>
) {
  // Map existing status values to our app's status values
  const mapStatus = (status?: string): AppSessionStatus => {
    if (status === 'completed') return 'completed';
    if (status === 'missed') return 'missed';
    if (status === 'skipped') return 'skipped';
    if (status === 'not_completed') return 'not_completed';
    return 'planned';
  };
  
  const [status, setStatus] = useState<AppSessionStatus>(mapStatus(session.status));
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState(session.post_session_notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Helper function to get color for session type
  const getSessionTypeColor = (sessionType: string) => {
    const type = sessionType.toLowerCase();
    
    // Easy/Recovery runs
    if (type.includes('easy') || type.includes('recovery')) {
      return colors.easy;
    }
    // Speed/Power work
    else if (type.includes('interval') || type.includes('speed') || type.includes('track') || 
             type.includes('hill') || type.includes('strides')) {
      return colors.interval;
    }
    // Threshold/Tempo work
    else if (type.includes('tempo') || type.includes('threshold') || type.includes('fartlek') ||
             type.includes('progressive') || type.includes('race pace')) {
      return colors.interval;
    }
    // Long runs and time trials
    else if (type.includes('long') || type.includes('time trial')) {
      return colors.long;
    }
    // Cross training and strength
    else if (type.includes('cross') || type.includes('strength')) {
      return colors.cross;
    }
    // Rest and recovery
    else if (type.includes('rest')) {
      return colors.rest;
    }
    // Race day
    else if (type.includes('race day')) {
      return colors.long; // Use long run color for race day
    }
    // Default for any unmatched types
    return colors.interval;
  };

  // Get status display info
  const getStatusInfo = (status: AppSessionStatus) => {
    switch (status) {
      case 'completed':
        return colors.statusBadge.completed;
      case 'missed':
      case 'skipped':
        return colors.statusBadge.missed;
      case 'not_completed':
      case 'planned':
      default:
        return colors.statusBadge.planned;
    }
  };

  // Get display text for status
  const getStatusDisplayText = (status: AppSessionStatus) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'missed': return 'Missed';
      case 'skipped': return 'Skipped';
      case 'not_completed': return 'Not Completed';
      case 'planned': return 'Planned';
      default: return 'Planned';
    }
  };

  // Handle status updates
  const handleStatusUpdate = async (newStatus: AppSessionStatus) => {
    if (!onUpdateSession) return;
    
    setIsUpdating(true);
    try {
      // If clicking the same status that's already active, set to not_completed
      // Otherwise set to the new status
      const updatedStatus = status === newStatus ? 'not_completed' : newStatus;
      await onUpdateSession(session.id, { 
        status: updatedStatus,
        // Ensure we're passing back all the necessary session data
        distance: session.distance,
        time: session.time,
        suggested_shoe: session.suggested_shoe,
        session_type: session.session_type,
        date: session.date,
        notes: session.notes,
        post_session_notes: session.post_session_notes
      });
      setStatus(updatedStatus);
    } catch (error) {
      Alert.alert('Update Failed', 'Failed to update session status');
      console.error('Failed to update session status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Save notes
  const handleSaveNotes = async () => {
    if (!onUpdateSession) return;
    
    setIsUpdating(true);
    try {
      // First update the session with new notes
      await onUpdateSession(session.id, { post_session_notes: notes });
      
      // Then process and summarize the notes if they're not empty
      if (notes && notes.trim() !== '') {
        // Check if we have a userId prop
        if (userId) {
          // Process and summarize the notes
          await processWorkoutNotes(session.id, notes, userId);
        } else {
          // Fallback to retrieve current user for processing notes
          const currentUser = supabase.auth.user();
          if (currentUser && currentUser.id) {
            await processWorkoutNotes(session.id, notes, currentUser.id);
          } else {
            console.error('🔍 [SessionCard] User not found, cannot process notes');
          }
        }
      }
      
      setIsEditingNotes(false);
    } catch (error) {
      console.error('🔍 [SessionCard] Error in handleSaveNotes:', error);
      Alert.alert('Update Failed', 'Failed to save notes');
    } finally {
      setIsUpdating(false);
    }
  };

  // Open notes modal
  const handleOpenNotesModal = () => {
    setIsEditingNotes(true);
  };

  // Close notes modal and reset to original notes
  const handleCancelNotes = () => {
    setNotes(session.post_session_notes || '');
    setIsEditingNotes(false);
  };

  // Calculate derived values
  const sessionTypeColors = getSessionTypeColor(session.session_type);
  const statusInfo = getStatusInfo(status);
  const suggestedShoe = session.suggested_shoe || getSuggestedShoe(session.session_type) || undefined;
  const displayDate = session.scheduled_date || session.date;
  const title = session.title || `${session.session_type} - ${formattedDate}`;
  const description = session.description || session.notes;

  return {
    // State
    status,
    isUpdating,
    notes,
    setNotes,
    isEditingNotes,
    
    // Derived values
    sessionTypeColors,
    statusInfo,
    suggestedShoe,
    displayDate,
    title,
    description,
    
    // Helper functions
    getStatusDisplayText,
    
    // Actions
    handleStatusUpdate,
    handleSaveNotes,
    handleOpenNotesModal,
    handleCancelNotes,
    setIsEditingNotes
  };
} 