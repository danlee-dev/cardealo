import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Animated, Dimensions } from 'react-native';
import { FONTS, COLORS } from '../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface AdminAuthScreenProps {
  onAuthenticated: () => void;
  onCancel: () => void;
}

export const AdminAuthScreen: React.FC<AdminAuthScreenProps> = ({ onAuthenticated, onCancel }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const ADMIN_PASSWORD = 'admin1234'; // 비밀번호: admin1234

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAuth = async () => {
    if (!password) {
      Alert.alert('오류', '비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);

    // 임시 인증 로직 (실제로는 백엔드 API 호출)
    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        setLoading(false);
        onAuthenticated();
      } else {
        setLoading(false);
        Alert.alert('인증 실패', '비밀번호가 올바르지 않습니다.');
        setPassword('');
      }
    }, 500);
  };

  const handleCancel = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onCancel();
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleCancel}
        activeOpacity={0.7}
      >
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      <View style={styles.iconContainer}>
        <View style={styles.lockIcon} />
      </View>

      <Text style={styles.title}>관리자 인증</Text>
      <Text style={styles.subtitle}>보안을 위해 관리자 비밀번호를{'\n'}한 번 더 입력해주세요</Text>

      <View style={styles.formContainer}>
        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          style={styles.input}
          placeholder="관리자 비밀번호를 입력해주세요"
          placeholderTextColor="#999999"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleAuth}
          returnKeyType="done"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.authButton, loading && styles.authButtonDisabled]}
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.authButtonText}>
            {loading ? '인증 중...' : '관리자 인증'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>취소</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  backButtonText: {
    fontSize: 24,
    color: '#000000',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  lockIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 48,
  },
  formContainer: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  authButton: {
    height: 52,
    backgroundColor: '#9C27B0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  authButtonDisabled: {
    backgroundColor: '#D1C4E9',
  },
  authButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  cancelButton: {
    height: 52,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
});
