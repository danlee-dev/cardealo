import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FONTS } from '../constants/theme';
import { AuthStorage } from '../utils/auth';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';

interface CardEditModalProps {
  visible: boolean;
  cardName: string;
  onClose: () => void;
  onCardUpdated: () => void;
}

export const CardEditModal: React.FC<CardEditModalProps> = ({
  visible,
  cardName,
  onClose,
  onCardUpdated,
}) => {
  const [newCardName, setNewCardName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = async () => {
    if (!newCardName.trim()) {
      Alert.alert('오류', '새 카드 이름을 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      const token = await AuthStorage.getToken();
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/card/edit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          old_card_name: cardName,
          new_card_name: newCardName.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('성공', '카드가 수정되었습니다.', [
          {
            text: '확인',
            onPress: () => {
              onCardUpdated();
              onClose();
            },
          },
        ]);
      } else {
        Alert.alert('오류', data.error || '카드 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to edit card:', error);
      Alert.alert('오류', '카드 수정 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      '카드 삭제',
      '정말 이 카드를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const token = await AuthStorage.getToken();
              if (!token) {
                Alert.alert('오류', '로그인이 필요합니다.');
                return;
              }

              const response = await fetch(`${BACKEND_URL}/api/card/del`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  card_name: cardName,
                }),
              });

              const data = await response.json();
              if (data.success) {
                Alert.alert('성공', '카드가 삭제되었습니다.', [
                  {
                    text: '확인',
                    onPress: () => {
                      onCardUpdated();
                      onClose();
                    },
                  },
                ]);
              } else {
                Alert.alert('오류', data.error || '카드 삭제에 실패했습니다.');
              }
            } catch (error) {
              console.error('Failed to delete card:', error);
              Alert.alert('오류', '카드 삭제 중 오류가 발생했습니다.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>카드 수정</Text>

          <View style={styles.currentCardSection}>
            <Text style={styles.label}>현재 카드</Text>
            <Text style={styles.currentCardName}>{cardName}</Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.label}>새 카드 이름</Text>
            <TextInput
              style={styles.input}
              value={newCardName}
              onChangeText={setNewCardName}
              placeholder="새 카드 이름을 입력하세요"
              placeholderTextColor="#999999"
              editable={!isLoading}
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.editButton]}
              onPress={handleEdit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.editButtonText}>수정</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={isLoading}
          >
            <Text style={styles.deleteButtonText}>카드 삭제</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 24,
    textAlign: 'center',
  },
  currentCardSection: {
    marginBottom: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
    marginBottom: 8,
  },
  currentCardName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#212121',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: '#212121',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#666666',
  },
  editButton: {
    backgroundColor: '#4AA63C',
  },
  editButtonText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  deleteButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  deleteButtonText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#FF3B30',
  },
});
