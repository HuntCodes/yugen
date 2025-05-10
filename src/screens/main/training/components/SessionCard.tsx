import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, TextInput, StyleSheet, Alert, Modal } from 'react-native';
import { Text } from '../../../../components/ui/StyledText';
import { TrainingSession, SessionStatus } from './types';
import { formatDate } from '../../../../utils/dateUtils';
import { Button } from '../../../../components/ui/Button';
import { colors } from '../../../../styles/colors';
import { processWorkoutNotes } from '../../../../services/summary/workoutNoteService';
import { supabase } from '../../../../lib/api/supabase';

// Update SessionStatus type to match what's used in the app
type AppSessionStatus = 'completed' | 'missed' | 'planned' | 'not_completed' | 'skipped';

export interface SessionCardProps {
  session: TrainingSession;
  formattedDate: string;
  dayOfWeek: string;
  isModified?: boolean;
  userId?: string;
  onUpdateSession?: (sessionId: string, updates: Partial<TrainingSession>) => Promise<void>;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  formattedDate,
  dayOfWeek,
  isModified = false,
  userId,
  onUpdateSession
}) => {
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
    if (type.includes('easy') || type.includes('recovery')) {
      return colors.easy;
    } else if (type.includes('interval') || type.includes('speed') || type.includes('tempo')) {
      return colors.interval;
    } else if (type.includes('long')) {
      return colors.long;
    } else if (type.includes('cross') || type.includes('strength')) {
      return colors.cross;
    } else if (type.includes('rest')) {
      return colors.rest;
    }
    return colors.interval; // Default
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

  const sessionTypeColors = getSessionTypeColor(session.session_type);
  const statusInfo = getStatusInfo(status);

  // Get suggested shoe based on session type
  const getSuggestedShoe = (sessionType: string) => {
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

  const suggestedShoe = session.suggested_shoe || getSuggestedShoe(session.session_type);
  const displayDate = session.scheduled_date || session.date;
  const title = session.title || `${session.session_type} - ${formattedDate}`;
  const description = session.description || session.notes;

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

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatDate(displayDate)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isModified && (
            <View style={[styles.statusBadge, { backgroundColor: colors.modified, marginRight: 8 }]}>
              <Text style={styles.statusText}>Modified</Text>
            </View>
          )}
        <View style={[styles.statusBadge, { backgroundColor: sessionTypeColors.dot }]}>
          <Text style={styles.statusText}>{session.session_type}</Text>
          </View>
        </View>
      </View>
      
      <Text style={styles.title}>{title}</Text>
      
      {/* Session details */}
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Distance:</Text>
          <Text style={styles.detailValue}>{session.distance}km</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Time:</Text>
          <Text style={styles.detailValue}>{session.time} min</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Suggested Shoe:</Text>
          <Text style={styles.detailValue}>{suggestedShoe}</Text>
        </View>
      </View>
      
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
      
      {/* Status buttons */}
      <View style={styles.statusButtons}>
        <TouchableOpacity 
          style={[
            styles.statusButton,
            styles.completedButton,
            status === 'completed' && styles.completedButtonActive
          ]}
          disabled={isUpdating}
          onPress={() => handleStatusUpdate('completed')}
        >
          <Text style={[
            styles.statusButtonText,
            status === 'completed' && styles.statusButtonTextActive
          ]}>
            Completed
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.statusButton,
            styles.skippedButton,
            status === 'skipped' && styles.skippedButtonActive
          ]}
          disabled={isUpdating}
          onPress={() => handleStatusUpdate('skipped')}
        >
          <Text style={[
            styles.statusButtonText,
            status === 'skipped' && styles.statusButtonTextActive
          ]}>
            Skipped
          </Text>
        </TouchableOpacity>
      </View>
      
      {session.post_session_notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Your Notes:</Text>
          <Text style={styles.notesText}>{session.post_session_notes}</Text>
        </View>
      )}
      
      <View style={styles.footer}>
        <Button 
          title="Add Notes" 
          onPress={handleOpenNotesModal}
          variant="secondary"
          size="small"
        />
      </View>
      
      {/* Notes editing modal */}
      <Modal
        visible={isEditingNotes}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditingNotes(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {session.session_type} - {formattedDate}
            </Text>
            
            <Text style={styles.modalLabel}>Post-Session Notes:</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="How did this workout feel? Any challenges or successes?"
              placeholderTextColor="#999"
            />
            
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="outline"
                size="small"
                onPress={() => {
                  setNotes(session.post_session_notes || '');
                  setIsEditingNotes(false);
                }}
              />
              <Button
                title="Save"
                variant="primary"
                size="small"
                loading={isUpdating}
                disabled={isUpdating}
                onPress={handleSaveNotes}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  date: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: colors.text.primary,
  },
  detailsContainer: {
    marginBottom: 12,
    backgroundColor: '#F0ECEB',
    padding: 12,
    borderRadius: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  statusButtons: {
    flexDirection: 'row',
    marginVertical: 12,
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F0ECEB',
    alignItems: 'center',
  },
  completedButton: {
    // Remove border
  },
  skippedButton: {
    // Remove border
  },
  statusButtonActive: {
    // Remove this style as we'll handle active states individually
  },
  completedButtonActive: {
    backgroundColor: colors.success,
  },
  skippedButtonActive: {
    backgroundColor: colors.error,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  notesContainer: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F0ECEB',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: colors.text.secondary,
  },
  notesText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: colors.text.primary,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: colors.text.secondary,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    color: colors.text.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modifiedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  modifiedText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
}); 