import React from 'react';
import { View, TextInput, Modal, StyleSheet } from 'react-native';

import { Button } from '../../../../../components/ui/Button';
import { Text } from '../../../../../components/ui/StyledText';

interface SessionNotesProps {
  notes: string;
  sessionNotes: string;
  isEditing: boolean;
  isUpdating: boolean;
  title: string;
  formattedDate: string;
  onOpenNotes: () => void;
  onChangeNotes: (text: string) => void;
  onSaveNotes: () => void;
  onCancelNotes: () => void;
}

/**
 * Component for displaying and editing session notes
 */
export const SessionNotes: React.FC<SessionNotesProps> = ({
  notes,
  sessionNotes,
  isEditing,
  isUpdating,
  title,
  formattedDate,
  onOpenNotes,
  onChangeNotes,
  onSaveNotes,
  onCancelNotes,
}) => {
  return (
    <>
      {/* Display existing notes if available */}
      {sessionNotes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Your Notes:</Text>
          <Text style={styles.notesText}>{sessionNotes}</Text>
        </View>
      )}

      {/* Button to add notes */}
      <View style={styles.footer}>
        <Button title="Add Notes" onPress={onOpenNotes} variant="secondary" size="small" />
      </View>

      {/* Notes editing modal */}
      <Modal visible={isEditing} transparent animationType="slide" onRequestClose={onCancelNotes}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{title || `Session - ${formattedDate}`}</Text>

            <Text style={styles.modalLabel}>Post-Session Notes:</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={onChangeNotes}
              multiline
              placeholder="How did this workout feel? Any challenges or successes?"
              placeholderTextColor="#999"
            />

            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="outline" size="small" onPress={onCancelNotes} />
              <Button
                title="Save"
                variant="primary"
                size="small"
                loading={isUpdating}
                disabled={isUpdating}
                onPress={onSaveNotes}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
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
    color: '#6B7280', // Secondary text color
  },
  notesText: {
    fontSize: 14,
    color: '#111827', // Primary text color
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
    backgroundColor: '#FFFFFF',
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
    color: '#111827', // Primary text color
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#6B7280', // Secondary text color
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB', // Border color
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    color: '#111827', // Primary text color
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
