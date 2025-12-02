import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS } from '../constants/theme';
import { AuthStorage } from '../utils/auth';
import { BackIcon } from '../components/svg';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';
const SCREEN_WIDTH = Dimensions.get('window').width;

interface AdminMembersScreenProps {
  cardId: number;
  departments: Array<{ id: number; name: string; color: string }>;
  onBack: () => void;
}

interface Member {
  id: number;
  invited_email: string;
  role: 'admin' | 'member';
  monthly_limit: number;
  used_amount: number;
  status: 'pending' | 'active' | 'inactive';
  invited_at: string | null;
  joined_at: string | null;
  user: {
    user_name: string;
    user_email: string;
  } | null;
  department: {
    id: number;
    name: string;
  } | null;
}

export const AdminMembersScreen: React.FC<AdminMembersScreenProps> = ({
  cardId,
  departments,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLimit, setInviteLimit] = useState('50');
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(
        `${BACKEND_URL}/api/corporate/cards/${cardId}/members`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 10000) {
      return `${Math.round(amount / 10000)}만원`;
    }
    return `${amount.toLocaleString()}원`;
  };

  const openInviteModal = () => {
    setInviteEmail('');
    setInviteLimit('50');
    setSelectedDeptId(departments.length > 0 ? departments[0].id : null);
    setModalVisible(true);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('오류', '이메일을 입력해주세요.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      Alert.alert('오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }

    const limitValue = parseInt(inviteLimit) * 10000;
    if (isNaN(limitValue) || limitValue <= 0) {
      Alert.alert('오류', '유효한 한도를 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(
        `${BACKEND_URL}/api/corporate/cards/${cardId}/members`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            department_id: selectedDeptId,
            monthly_limit: limitValue,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setModalVisible(false);
        fetchMembers();
        Alert.alert('완료', '초대가 전송되었습니다.');
      } else {
        Alert.alert('오류', data.error || '초대에 실패했습니다.');
      }
    } catch (error) {
      console.error('Invite failed:', error);
      Alert.alert('오류', '초대 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const activeMembers = members.filter((m) => m.status === 'active');
  const pendingMembers = members.filter((m) => m.status === 'pending');

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BackIcon width={10} height={16} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>직원 관리</Text>
          <TouchableOpacity
            onPress={openInviteModal}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.addText}>초대</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#9C27B0" />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Summary */}
            <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{activeMembers.length}</Text>
                  <Text style={styles.summaryLabel}>활성 직원</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{pendingMembers.length}</Text>
                  <Text style={styles.summaryLabel}>대기 중</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{members.length}</Text>
                  <Text style={styles.summaryLabel}>전체</Text>
                </View>
              </View>
            </View>

            {/* Pending Members */}
            {pendingMembers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>초대 대기</Text>
                {pendingMembers.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberLeft}>
                      <View style={styles.avatarPending}>
                        <Text style={styles.avatarText}>?</Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberEmail}>{member.invited_email}</Text>
                        <View style={styles.memberMeta}>
                          <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>대기 중</Text>
                          </View>
                          {member.department && (
                            <Text style={styles.memberDept}>{member.department.name}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                    <Text style={styles.memberLimit}>{formatCurrency(member.monthly_limit)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Active Members */}
            {activeMembers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>활성 직원</Text>
                {activeMembers.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberLeft}>
                      <View style={styles.avatarActive}>
                        <Text style={styles.avatarText}>
                          {member.user?.user_name?.charAt(0) || 'U'}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName}>
                            {member.user?.user_name || member.invited_email}
                          </Text>
                          {member.role === 'admin' && (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminBadgeText}>관리자</Text>
                            </View>
                          )}
                        </View>
                        {member.department && (
                          <Text style={styles.memberDept}>{member.department.name}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.memberRight}>
                      <Text style={styles.memberUsed}>{formatCurrency(member.used_amount)}</Text>
                      <Text style={styles.memberLimitSmall}>/ {formatCurrency(member.monthly_limit)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {members.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>등록된 직원이 없습니다</Text>
                <Text style={styles.emptySubText}>상단의 '초대' 버튼을 눌러 직원을 추가하세요</Text>
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>

      {/* Invite Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>직원 초대</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>이메일</Text>
              <TextInput
                style={styles.formInput}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="example@company.com"
                placeholderTextColor="#CCCCCC"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>월 한도 (만원)</Text>
              <TextInput
                style={styles.formInput}
                value={inviteLimit}
                onChangeText={setInviteLimit}
                placeholder="50"
                placeholderTextColor="#CCCCCC"
                keyboardType="numeric"
              />
              {inviteLimit && (
                <Text style={styles.formHint}>
                  = {((parseInt(inviteLimit) || 0) * 10000).toLocaleString()}원
                </Text>
              )}
            </View>

            {departments.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>부서</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.deptPicker}
                  contentContainerStyle={styles.deptPickerContent}
                >
                  <TouchableOpacity
                    style={[
                      styles.deptOption,
                      selectedDeptId === null && styles.deptOptionSelected,
                    ]}
                    onPress={() => setSelectedDeptId(null)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.deptOptionText,
                        selectedDeptId === null && styles.deptOptionTextSelected,
                      ]}
                    >
                      미지정
                    </Text>
                  </TouchableOpacity>
                  {departments.map((dept) => (
                    <TouchableOpacity
                      key={dept.id}
                      style={[
                        styles.deptOption,
                        selectedDeptId === dept.id && styles.deptOptionSelected,
                      ]}
                      onPress={() => setSelectedDeptId(dept.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.deptColorDot, { backgroundColor: dept.color }]} />
                      <Text
                        style={[
                          styles.deptOptionText,
                          selectedDeptId === dept.id && styles.deptOptionTextSelected,
                        ]}
                      >
                        {dept.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleInvite}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>초대 보내기</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  animatedContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  addText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#9C27B0',
  },
  scrollView: {
    flex: 1,
  },
  summarySection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E0E0E0',
  },
  summaryValue: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#999999',
    marginBottom: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarPending: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#212121',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberEmail: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: '#212121',
    marginBottom: 4,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#FF9800',
  },
  adminBadge: {
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
  },
  adminBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#9C27B0',
  },
  memberDept: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  memberRight: {
    alignItems: 'flex-end',
  },
  memberLimit: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  memberUsed: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  memberLimitSmall: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: '#666666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
    marginBottom: 10,
  },
  formInput: {
    height: 52,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: '#212121',
  },
  formHint: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginTop: 6,
  },
  deptPicker: {
    marginHorizontal: -24,
  },
  deptPickerContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  deptOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  deptOptionSelected: {
    backgroundColor: '#212121',
  },
  deptColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  deptOptionText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  deptOptionTextSelected: {
    color: '#FFFFFF',
  },
  saveButton: {
    height: 52,
    backgroundColor: '#212121',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
});
