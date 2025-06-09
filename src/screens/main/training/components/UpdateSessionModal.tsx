import React from 'react';
import { View, Modal, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';

import { MinimalSpinner } from '../../../../components/ui/MinimalSpinner';
import { Text } from '../../../../components/ui/StyledText';

export interface UpdateSessionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onUpdateDates: () => Promise<void>;
  isUpdating: boolean;
}

export const UpdateSessionModal: React.FC<UpdateSessionModalProps> = ({
  isVisible,
  onClose,
  onUpdateDates,
  isUpdating,
}) => {
  return (
    <Modal animationType="slide" transparent visible={isVisible} onRequestClose={onClose}>
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Outdated Training Plan</Text>

          <Text style={styles.modalText}>
            Your training plan contains dates from a previous year. Would you like to update all
            dates to the current year?
          </Text>

          <View style={styles.buttonContainer}>
            {isUpdating ? (
              <MinimalSpinner size={20} color="#007AFF" thickness={2} />
            ) : (
              <>
                <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Not Now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.buttonUpdate]}
                  onPress={onUpdateDates}>
                  <Text style={styles.updateButtonText}>Update Dates</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '85%',
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalText: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    borderRadius: 8,
    padding: 10,
    elevation: 2,
    minWidth: '45%',
    paddingVertical: 12,
  },
  buttonCancel: {
    backgroundColor: '#f0f0f0',
  },
  buttonUpdate: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  updateButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
