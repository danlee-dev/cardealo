import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Animated,
  Dimensions,
  Platform,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { BackIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import { AuthAPI, AuthStorage } from '../utils/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../utils/api';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  userName?: string;
  userPhone?: string;
}

// Setting Item Component
const SettingItem = ({
  label,
  value,
  onPress,
  showArrow = true,
  isLast = false,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  isLast?: boolean;
}) => (
  <TouchableOpacity
    style={[styles.settingItem, isLast && styles.settingItemLast]}
    onPress={onPress}
    activeOpacity={0.6}
    disabled={!onPress}
  >
    <Text style={styles.settingLabel}>{label}</Text>
    <View style={styles.settingRight}>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      {showArrow && onPress && <Text style={styles.settingArrow}>›</Text>}
    </View>
  </TouchableOpacity>
);

// Toggle Setting Item Component
const ToggleItem = ({
  label,
  description,
  value,
  onValueChange,
  isLast = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  isLast?: boolean;
}) => (
  <View style={[styles.settingItem, styles.toggleItem, isLast && styles.settingItemLast]}>
    <View style={styles.toggleTextContainer}>
      <Text style={styles.settingLabel}>{label}</Text>
      {description && <Text style={styles.toggleDescription}>{description}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#E0E0E0', true: '#1A1A1A' }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="#E0E0E0"
    />
  </View>
);

// Section Header Component
const SectionHeader = ({ title }: { title: string }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onLogout,
  userName = '사용자',
  userPhone = '010-****-****',
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Settings state
  const [notifications, setNotifications] = useState({
    push: true,
    benefits: true,
    payments: true,
    marketing: false,
  });

  const [security, setSecurity] = useState({
    biometric: false,
    autoLock: true,
  });

  const [preferences, setPreferences] = useState({
    defaultPayment: 'qr', // 'qr' | 'barcode'
  });

  // Edit modals
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);
  const [newName, setNewName] = useState(userName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            await AuthAPI.logout();
            onLogout();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '계정 삭제',
      '정말 계정을 삭제하시겠습니까?\n모든 데이터가 영구적으로 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            Alert.alert('안내', '계정 삭제 요청이 접수되었습니다.');
          },
        },
      ]
    );
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      Alert.alert('오류', '이름을 입력해주세요.');
      return;
    }
    try {
      const token = await AuthStorage.getToken();
      const response = await fetch(`${API_URL}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_name: newName.trim() }),
      });

      if (response.ok) {
        Alert.alert('완료', '이름이 변경되었습니다.');
        setShowNameEdit(false);
      } else {
        Alert.alert('오류', '이름 변경에 실패했습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '네트워크 오류가 발생했습니다.');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('오류', '모든 필드를 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('오류', '새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('오류', '비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    try {
      const token = await AuthStorage.getToken();
      const response = await fetch(`${API_URL}/api/user/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (response.ok) {
        Alert.alert('완료', '비밀번호가 변경되었습니다.');
        setShowPasswordEdit(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await response.json();
        Alert.alert('오류', data.error || '비밀번호 변경에 실패했습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '네트워크 오류가 발생했습니다.');
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX: slideAnim }] },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BackIcon width={10} height={18} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>설정</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <SectionHeader title="계정" />
        <View style={styles.sectionContainer}>
          <SettingItem
            label="이름"
            value={userName}
            onPress={() => {
              setNewName(userName);
              setShowNameEdit(true);
            }}
          />
          <SettingItem
            label="전화번호"
            value={userPhone}
            showArrow={false}
          />
          <SettingItem
            label="비밀번호 변경"
            onPress={() => setShowPasswordEdit(true)}
            isLast
          />
        </View>

        {/* Notification Section */}
        <SectionHeader title="알림" />
        <View style={styles.sectionContainer}>
          <ToggleItem
            label="푸시 알림"
            description="앱 알림을 받습니다"
            value={notifications.push}
            onValueChange={(v) => setNotifications(prev => ({ ...prev, push: v }))}
          />
          <ToggleItem
            label="혜택 알림"
            description="카드 혜택 정보를 받습니다"
            value={notifications.benefits}
            onValueChange={(v) => setNotifications(prev => ({ ...prev, benefits: v }))}
          />
          <ToggleItem
            label="결제 알림"
            description="결제 내역을 알려드립니다"
            value={notifications.payments}
            onValueChange={(v) => setNotifications(prev => ({ ...prev, payments: v }))}
          />
          <ToggleItem
            label="마케팅 알림"
            description="프로모션 및 이벤트 정보"
            value={notifications.marketing}
            onValueChange={(v) => setNotifications(prev => ({ ...prev, marketing: v }))}
            isLast
          />
        </View>

        {/* Security Section */}
        <SectionHeader title="보안" />
        <View style={styles.sectionContainer}>
          <ToggleItem
            label="생체 인증"
            description="Face ID / Touch ID로 로그인"
            value={security.biometric}
            onValueChange={(v) => setSecurity(prev => ({ ...prev, biometric: v }))}
          />
          <ToggleItem
            label="자동 잠금"
            description="앱 전환 시 잠금"
            value={security.autoLock}
            onValueChange={(v) => setSecurity(prev => ({ ...prev, autoLock: v }))}
            isLast
          />
        </View>

        {/* Payment Preferences */}
        <SectionHeader title="결제 설정" />
        <View style={styles.sectionContainer}>
          <SettingItem
            label="기본 결제 방식"
            value={preferences.defaultPayment === 'qr' ? 'QR 코드' : '바코드'}
            onPress={() => {
              Alert.alert(
                '기본 결제 방식',
                '결제 시 기본으로 표시할 방식을 선택하세요',
                [
                  {
                    text: 'QR 코드',
                    onPress: () => setPreferences(prev => ({ ...prev, defaultPayment: 'qr' })),
                  },
                  {
                    text: '바코드',
                    onPress: () => setPreferences(prev => ({ ...prev, defaultPayment: 'barcode' })),
                  },
                  { text: '취소', style: 'cancel' },
                ]
              );
            }}
            isLast
          />
        </View>

        {/* Support Section */}
        <SectionHeader title="지원" />
        <View style={styles.sectionContainer}>
          <SettingItem
            label="도움말"
            onPress={() => Alert.alert('도움말', '준비 중입니다.')}
          />
          <SettingItem
            label="문의하기"
            onPress={() => Alert.alert('문의하기', 'support@cardealo.com')}
          />
          <SettingItem
            label="이용약관"
            onPress={() => Alert.alert('이용약관', '준비 중입니다.')}
          />
          <SettingItem
            label="개인정보 처리방침"
            onPress={() => Alert.alert('개인정보 처리방침', '준비 중입니다.')}
            isLast
          />
        </View>

        {/* App Info */}
        <SectionHeader title="앱 정보" />
        <View style={styles.sectionContainer}>
          <SettingItem
            label="버전"
            value="1.0.0"
            showArrow={false}
            isLast
          />
        </View>

        {/* Account Actions */}
        <View style={styles.accountActionsContainer}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutButtonText}>로그아웃</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteAccountText}>계정 삭제</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Name Edit Modal */}
      <Modal
        visible={showNameEdit}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameEdit(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>이름 변경</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="새 이름 입력"
              placeholderTextColor="#999999"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowNameEdit(false)}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleSaveName}
              >
                <Text style={styles.modalConfirmText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Edit Modal */}
      <Modal
        visible={showPasswordEdit}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordEdit(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>비밀번호 변경</Text>
            <TextInput
              style={styles.modalInput}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="현재 비밀번호"
              placeholderTextColor="#999999"
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="새 비밀번호"
              placeholderTextColor="#999999"
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="새 비밀번호 확인"
              placeholderTextColor="#999999"
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowPasswordEdit(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleChangePassword}
              >
                <Text style={styles.modalConfirmText}>변경</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 60,
    bottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  headerLeft: {
    width: 60,
    alignItems: 'flex-start',
    zIndex: 1,
  },
  headerRight: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#888888',
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#1A1A1A',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingValue: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  settingArrow: {
    fontSize: 18,
    fontFamily: FONTS.medium,
    color: '#CCCCCC',
  },
  toggleItem: {
    minHeight: 56,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  toggleDescription: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#888888',
    marginTop: 2,
  },
  accountActionsContainer: {
    marginTop: 32,
    marginHorizontal: 16,
    gap: 12,
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  logoutButtonText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  deleteAccountButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteAccountText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#B91C1C',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#666666',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
});
