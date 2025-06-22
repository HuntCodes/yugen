import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  LayoutChangeEvent,
} from 'react-native';

import { TrainingSession, SessionStatus } from './types';
import { Button } from '../../../../components/ui/Button';
import { Text } from '../../../../components/ui/StyledText';
import { supabase } from '../../../../lib/supabase';
import { formatDate } from '../../../../lib/utils/dateUtils';
import {
  getSuggestedShoe,
  getProductIdFromShoeName,
} from '../../../../lib/utils/training/shoeRecommendations';
import { TabParamList } from '../../../../navigation/TabNavigator';
import { processWorkoutNotes } from '../../../../services/summary/workoutNoteService';
import { colors } from '../../../../styles/colors';
import { getGuidedRunForSession } from '../../../../services/run';
import MapView, { Polyline } from 'react-native-maps';
import polyline from '@mapbox/polyline';

// Update SessionStatus type to match what's used in the app
type AppSessionStatus = 'completed' | 'missed' | 'planned' | 'not_completed' | 'skipped';

export interface SessionCardProps {
  session: TrainingSession;
  formattedDate: string;
  dayOfWeek: string;
  isModified?: boolean;
  userId?: string;
  onUpdateSession?: (sessionId: string, updates: Partial<TrainingSession>) => Promise<void>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  formattedDate,
  dayOfWeek,
  isModified = false,
  userId,
  onUpdateSession,
  onLayout,
}) => {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();

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
  const [guidedRun, setGuidedRun] = useState<any>(null);
  const [loadingGuidedRun, setLoadingGuidedRun] = useState(true);

  // Helper function to get color for session type
  const getSessionTypeColor = (sessionType: string) => {
    const type = sessionType.toLowerCase();
    if (type.includes('easy') || type.includes('recovery') || type.includes('double')) {
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
        post_session_notes: session.post_session_notes,
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

  // Handle shoe recommendation click
  const handleShoeClick = (shoeName: string) => {
    const productId = getProductIdFromShoeName(shoeName);
    if (productId) {
      navigation.navigate('Gear', { highlightProductId: productId });
    }
  };

  // Additional: Launch guided run
  const handleGuidedRun = () => {
    // Navigate to setup screen with sessionId
    // Using any to avoid TS type issues across nested navigators
    (navigation as any).navigate('GuidedRunSetup', { sessionId: session.id });
  };

  const sessionTypeColors = getSessionTypeColor(session.session_type);
  const statusInfo = getStatusInfo(status);

  const suggestedShoe =
    session.suggested_shoe || getSuggestedShoe(session.session_type) || 'No recommendation';
  const displayDate = session.scheduled_date || session.date;
  const title = session.title || `${session.session_type} - ${formattedDate}`;
  const description = session.description || session.notes;

  // Get display text for status
  const getStatusDisplayText = (status: AppSessionStatus) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'missed':
        return 'Missed';
      case 'skipped':
        return 'Skipped';
      case 'not_completed':
        return 'Not Completed';
      case 'planned':
        return 'Planned';
      default:
        return 'Planned';
    }
  };

  // Check for completed guided run
  useEffect(() => {
    const checkGuidedRun = async () => {
      if (!userId || !session.id) return;
      
      setLoadingGuidedRun(true);
      try {
        const run = await getGuidedRunForSession(session.id, userId);
        setGuidedRun(run);
        // If guided run exists, ensure session shows as completed
        if (run && onUpdateSession) {
          await onUpdateSession(session.id, { status: 'completed' });
          setStatus('completed');
        }
      } catch (error) {
        console.error('[SessionCard] Error checking guided run:', error);
      } finally {
        setLoadingGuidedRun(false);
      }
    };

    checkGuidedRun();
  }, [session.id, userId]);

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatDate(displayDate)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isModified && (
            <View
              style={[styles.statusBadge, { backgroundColor: colors.modified, marginRight: 8 }]}>
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
          <TouchableOpacity onPress={() => handleShoeClick(suggestedShoe)}>
            <Text style={[styles.detailValue, styles.clickableShoe]}>{suggestedShoe}</Text>
          </TouchableOpacity>
        </View>
        {session.suggested_location && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Suggested Location:</Text>
            <Text style={styles.detailValue}>{session.suggested_location}</Text>
          </View>
        )}
      </View>

      {description && <Text style={styles.description}>{description}</Text>}

      {/* Status buttons */}
      <View style={styles.statusButtons}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            styles.completedButton,
            status === 'completed' && styles.completedButtonActive,
          ]}
          disabled={isUpdating}
          onPress={() => handleStatusUpdate('completed')}>
          <Text
            style={[
              styles.statusButtonText,
              status === 'completed' && styles.statusButtonTextActive,
            ]}>
            Completed
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            styles.skippedButton,
            status === 'skipped' && styles.skippedButtonActive,
          ]}
          disabled={isUpdating}
          onPress={() => handleStatusUpdate('skipped')}>
          <Text
            style={[
              styles.statusButtonText,
              status === 'skipped' && styles.statusButtonTextActive,
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
        {guidedRun ? (
          <View>
            <View style={styles.runMapContainer}>
              {guidedRun.polyline_encoded && (
                <MapView
                  style={styles.runMap}
                  initialRegion={(() => {
                    const decoded = polyline.decode(guidedRun.polyline_encoded);
                    if (!decoded || decoded.length === 0) {
                      return { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 };
                    }

                    const lats = decoded.map((c: number[]) => c[0]);
                    const lngs = decoded.map((c: number[]) => c[1]);
                    const minLat = Math.min(...lats);
                    const maxLat = Math.max(...lats);
                    const minLng = Math.min(...lngs);
                    const maxLng = Math.max(...lngs);

                    const midLat = (minLat + maxLat) / 2;
                    const midLng = (minLng + maxLng) / 2;

                    // Add some padding so the path isn't flush to the edges
                    const latDelta = Math.max((maxLat - minLat) * 1.2, 0.01);
                    const lngDelta = Math.max((maxLng - minLng) * 1.2, 0.01);

                    return {
                      latitude: midLat,
                      longitude: midLng,
                      latitudeDelta: latDelta,
                      longitudeDelta: lngDelta,
                    };
                  })()}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  pointerEvents="none"
                >
                  <Polyline
                    coordinates={polyline.decode(guidedRun.polyline_encoded).map(
                      ([lat, lng]: [number, number]) => ({ latitude: lat, longitude: lng })
                    )}
                    strokeWidth={3}
                    strokeColor="#60A5FA"
                  />
                </MapView>
              )}
            </View>
          </View>
        ) : (
          // Show run button if no guided run completed
          <Button
            title="Run with your teammate"
            onPress={handleGuidedRun}
            variant="secondary"
            fullWidth
            size="small"
            style={{ paddingTop: 9, paddingBottom: 9 }}
            textStyle={{ fontFamily: 'Inter_400Regular', fontSize: 14, fontWeight: '500' }}
          />
        )}
        <Button
          title="Add Notes"
          onPress={handleOpenNotesModal}
          variant="secondary"
          size="small"
          style={{ alignSelf: 'flex-start' }}
        />
      </View>

      {/* Notes editing modal */}
      <Modal
        visible={isEditingNotes}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditingNotes(false)}>
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
    alignItems: 'flex-start',
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
    flexShrink: 1,
    flexWrap: 'wrap',
    textAlign: 'right',
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  statusButtons: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 8,
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
    flexDirection: 'column',
    gap: 12,
    marginTop: 4,
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
  clickableShoe: {
    color: colors.info,
  },
  runMapContainer: {
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  runMap: {
    flex: 1,
  },
});
