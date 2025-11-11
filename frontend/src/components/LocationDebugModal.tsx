import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert } from 'react-native';
import { FONTS, COLORS } from '../constants/theme';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:5001';

interface LocationDebugModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSet: (latitude: number, longitude: number) => void;
  onReset: () => void;
  onForceIndoor: () => void;
  isForceIndoor: boolean;
}

export const LocationDebugModal: React.FC<LocationDebugModalProps> = ({
  visible,
  onClose,
  onLocationSet,
  onReset,
  onForceIndoor,
  isForceIndoor,
}) => {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCoordinateSubmit = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('오류', '유효한 위도/경도를 입력해주세요.');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('오류', '위도는 -90~90, 경도는 -180~180 범위여야 합니다.');
      return;
    }

    onLocationSet(lat, lng);
    onClose();
    setLatitude('');
    setLongitude('');
    setAddress('');
  };

  const handleAddressSubmit = async () => {
    if (!address.trim()) {
      Alert.alert('오류', '주소를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/geocode`, {
        params: { address: address.trim() },
      });

      if (response.data && response.data.latitude && response.data.longitude) {
        onLocationSet(response.data.latitude, response.data.longitude);
        onClose();
        setLatitude('');
        setLongitude('');
        setAddress('');
      } else {
        Alert.alert('오류', '주소를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('주소 변환 실패:', error);
      Alert.alert('오류', '주소 변환에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    onReset();
    onClose();
    setLatitude('');
    setLongitude('');
    setAddress('');
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
          <Text style={styles.title}>위치 디버그</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>좌표 입력</Text>
            <TextInput
              style={styles.input}
              placeholder="위도 (예: 37.5856)"
              placeholderTextColor="#999999"
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="경도 (예: 127.0292)"
              placeholderTextColor="#999999"
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleCoordinateSubmit}
              activeOpacity={0.7}
            >
              <Text style={styles.submitButtonText}>좌표 설정</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>주소 입력</Text>
            <TextInput
              style={styles.input}
              placeholder="주소 (예: 서울특별시 성북구 안암로 145)"
              placeholderTextColor="#999999"
              value={address}
              onChangeText={setAddress}
            />
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleAddressSubmit}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.submitButtonText}>
                {loading ? '변환 중...' : '주소 설정'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>발표용 디버그</Text>
            <TouchableOpacity
              style={[
                styles.forceIndoorButton,
                isForceIndoor && styles.forceIndoorButtonActive
              ]}
              onPress={onForceIndoor}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.forceIndoorButtonText,
                isForceIndoor && styles.forceIndoorButtonTextActive
              ]}>
                {isForceIndoor ? '건물 내부 모드 ON' : '건물 내부 강제 인식'}
              </Text>
            </TouchableOpacity>
            {isForceIndoor && (
              <Text style={styles.forceIndoorHint}>
                현재 건물 내부로 강제 인식됩니다
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.resetButton]}
              onPress={handleReset}
              activeOpacity={0.7}
            >
              <Text style={styles.resetButtonText}>초기화</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.closeButton]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#333333',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#666666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#333333',
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#FF6B6B',
  },
  resetButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  closeButton: {
    backgroundColor: '#E0E0E0',
  },
  closeButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#666666',
  },
  forceIndoorButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  forceIndoorButtonActive: {
    backgroundColor: '#4CAF50',
  },
  forceIndoorButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#4CAF50',
  },
  forceIndoorButtonTextActive: {
    color: '#FFFFFF',
  },
  forceIndoorHint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#4CAF50',
    marginTop: 8,
    textAlign: 'center',
  },
});
