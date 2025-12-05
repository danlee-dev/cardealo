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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS } from '../constants/theme';
import { AuthStorage } from '../utils/auth';
import { BackIcon, PlusIcon, BuildingIcon } from '../components/svg';
import { API_URL } from '../utils/api';

const SCREEN_WIDTH = Dimensions.get('window').width;

const DEPARTMENT_COLORS = [
  '#4AA63C', '#2196F3', '#9C27B0', '#FF9800', '#E91E63',
  '#00BCD4', '#795548', '#607D8B', '#3F51B5', '#F44336'
];

interface AdminDepartmentScreenProps {
  cardId: number;
  onBack: () => void;
}

interface Department {
  id: number;
  name: string;
  card_count: number;
  usage_percent: number;
  benefit: number;
  used_amount: number;
  monthly_limit: number;
  color: string;
}

export const AdminDepartmentScreen: React.FC<AdminDepartmentScreenProps> = ({ cardId, onBack }) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptLimit, setDeptLimit] = useState('');
  const [deptColor, setDeptColor] = useState(DEPARTMENT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();

    fetchDepartments();
  }, [cardId]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/corporate/cards/${cardId}/departments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Department fetch failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Animated.spring(slideAnim, {
      toValue: SCREEN_WIDTH,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억원`;
    } else if (amount >= 10000) {
      return `${Math.round(amount / 10000)}만원`;
    }
    return `${amount.toLocaleString()}원`;
  };

  const openCreateModal = () => {
    setEditingDept(null);
    setDeptName('');
    setDeptLimit('200');
    setDeptColor(DEPARTMENT_COLORS[departments.length % DEPARTMENT_COLORS.length]);
    setModalVisible(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setDeptName(dept.name);
    setDeptLimit(String(Math.round(dept.monthly_limit / 10000)));
    setDeptColor(dept.color);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!deptName.trim()) {
      Alert.alert('오류', '부서명을 입력해주세요.');
      return;
    }

    const limitValue = parseInt(deptLimit) * 10000;
    if (isNaN(limitValue) || limitValue <= 0) {
      Alert.alert('오류', '유효한 한도를 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      const token = await AuthStorage.getToken();
      if (!token) return;

      const url = editingDept
        ? `${API_URL}/api/corporate/cards/${cardId}/departments/${editingDept.id}`
        : `${API_URL}/api/corporate/cards/${cardId}/departments`;

      const response = await fetch(url, {
        method: editingDept ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: deptName.trim(),
          monthly_limit: limitValue,
          color: deptColor,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setModalVisible(false);
        fetchDepartments();
      } else {
        Alert.alert('오류', data.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Department save failed:', error);
      Alert.alert('오류', '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const totalSpent = departments.reduce((sum, d) => sum + d.used_amount, 0);
  const totalBenefit = departments.reduce((sum, d) => sum + d.benefit, 0);

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
          <Text style={styles.headerTitle}>부서 관리</Text>
          <TouchableOpacity
            onPress={openCreateModal}
            style={styles.headerAddButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <PlusIcon width={16} height={16} color="#212121" />
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
                  <Text style={styles.summaryLabel}>총 지출</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(totalSpent)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>총 혜택</Text>
                  <Text style={styles.summaryValueGreen}>{formatCurrency(totalBenefit)}</Text>
                </View>
              </View>
            </View>

            {/* Departments List */}
            <View style={styles.listSection}>
              {departments.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconContainer}>
                    <BuildingIcon width={32} height={32} color="#CCCCCC" />
                  </View>
                  <Text style={styles.emptyText}>등록된 부서가 없습니다</Text>
                  <Text style={styles.emptySubText}>상단의 버튼을 눌러 부서를 추가하세요</Text>
                </View>
              ) : (
                departments.map((dept) => (
                  <TouchableOpacity
                    key={dept.id}
                    style={styles.deptCard}
                    onPress={() => openEditModal(dept)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.deptHeader}>
                      <View style={styles.deptNameRow}>
                        <View style={[styles.deptColorDot, { backgroundColor: dept.color }]} />
                        <Text style={styles.deptName}>{dept.name}</Text>
                      </View>
                      <Text style={styles.deptMembers}>{dept.card_count}명</Text>
                    </View>

                    <View style={styles.deptProgressContainer}>
                      <View style={styles.deptProgressBar}>
                        <LinearGradient
                          colors={dept.usage_percent >= 85 ? ['#FF5722', '#FF8A65'] : [dept.color, dept.color + '80']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[
                            styles.deptProgressFill,
                            { width: `${Math.min(dept.usage_percent, 100)}%` }
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.deptFooter}>
                      <View style={styles.deptAmountRow}>
                        <Text style={styles.deptUsed}>{formatCurrency(dept.used_amount)}</Text>
                        <Text style={styles.deptLimit}> / {formatCurrency(dept.monthly_limit)}</Text>
                      </View>
                      <View style={styles.deptBenefitRow}>
                        <Text style={styles.deptBenefitLabel}>혜택</Text>
                        <Text style={styles.deptBenefit}>+{formatCurrency(dept.benefit)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </Animated.View>

      {/* Modal */}
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

            <Text style={styles.modalTitle}>
              {editingDept ? '부서 수정' : '부서 추가'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>부서명</Text>
              <TextInput
                style={styles.formInput}
                value={deptName}
                onChangeText={setDeptName}
                placeholder="예: 마케팅팀"
                placeholderTextColor="#CCCCCC"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>월 한도 (만원)</Text>
              <TextInput
                style={styles.formInput}
                value={deptLimit}
                onChangeText={setDeptLimit}
                placeholder="200"
                placeholderTextColor="#CCCCCC"
                keyboardType="numeric"
              />
              {deptLimit && (
                <Text style={styles.formHint}>
                  = {((parseInt(deptLimit) || 0) * 10000).toLocaleString()}원
                </Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>색상</Text>
              <View style={styles.colorPicker}>
                {DEPARTMENT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      deptColor === color && styles.colorOptionSelected
                    ]}
                    onPress={() => setDeptColor(color)}
                    activeOpacity={0.7}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingDept ? '수정하기' : '추가하기'}
                </Text>
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
  headerAddButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  summaryValueGreen: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#4AA63C',
  },
  listSection: {
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
  deptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
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
  deptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  deptNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deptColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  deptName: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  deptMembers: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  deptProgressContainer: {
    marginBottom: 16,
  },
  deptProgressBar: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  deptProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  deptFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deptAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  deptUsed: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  deptLimit: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  deptBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deptBenefitLabel: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  deptBenefit: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
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
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#212121',
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
