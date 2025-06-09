import React from 'react';
import { View, StyleSheet } from 'react-native';

import { SessionDetails } from './SessionDetails';
import { SessionHeader } from './SessionHeader';
import { SessionNotes } from './SessionNotes';
import { SessionStatusControls } from './SessionStatusControls';
import { Text } from '../../../../../components/ui/StyledText';
import { useSessionCard } from '../../../../../hooks/training/useSessionCard';
import { TrainingSession } from '../types';

interface SessionCardProps {
  session: TrainingSession;
  formattedDate: string;
  userId?: string;
  onUpdateSession?: (sessionId: string, updates: Partial<TrainingSession>) => Promise<void>;
}

/**
 * A card component displaying training session details and controls
 */
export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  formattedDate,
  userId,
  onUpdateSession,
}) => {
  const {
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
    getStatusDisplayText,

    // Actions
    handleStatusUpdate,
    handleSaveNotes,
    handleOpenNotesModal,
    handleCancelNotes,
  } = useSessionCard(session, formattedDate, userId, onUpdateSession);

  return (
    <View
      style={[
        styles.container,
        {
          borderLeftColor:
            typeof sessionTypeColors === 'string' ? sessionTypeColors : sessionTypeColors.text,
        },
      ]}>
      <SessionHeader
        displayDate={displayDate}
        sessionType={session.session_type}
        isModified={!!session.modified}
        typeColor={
          typeof sessionTypeColors === 'string' ? sessionTypeColors : sessionTypeColors.text
        }
        formattedDate={formattedDate}
      />

      <View style={styles.titleContainer}>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <View style={styles.statusInner}>
            <Text style={[styles.statusText, { color: statusInfo.text }]}>
              {getStatusDisplayText(status)}
            </Text>
          </View>
        </View>

        <Text style={styles.titleText}>{title}</Text>
      </View>

      <SessionDetails
        distance={session.distance}
        time={session.time}
        suggestedShoe={suggestedShoe}
        suggestedLocation={session.suggested_location}
        description={description}
      />

      <SessionStatusControls
        status={status}
        isUpdating={isUpdating}
        onStatusUpdate={handleStatusUpdate}
      />

      <SessionNotes
        notes={notes}
        sessionNotes={session.post_session_notes || ''}
        isEditing={isEditingNotes}
        isUpdating={isUpdating}
        title={title}
        formattedDate={formattedDate}
        onOpenNotes={handleOpenNotesModal}
        onChangeNotes={setNotes}
        onSaveNotes={handleSaveNotes}
        onCancelNotes={handleCancelNotes}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  titleContainer: {
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827', // Primary text color
    marginBottom: 4,
  },
});
