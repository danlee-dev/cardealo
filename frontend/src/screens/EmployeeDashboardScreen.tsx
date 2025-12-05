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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS } from '../constants/theme';
import { AuthStorage } from '../utils/auth';
import { BackIcon } from '../components/svg';
import { API_URL } from '../utils/api';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DepartmentInfo {
  id: number;
  name: string;
  monthly_limit: number;
  used_amount: number;
  usage_percent: number;
  color: string;
  is_my_department: boolean;
}

interface EmployeeDashboardData {
  card: {
    id: number;
    name: string;
    company: string;
    total_limit: number;
    total_used: number;
  };
  my_info: {
    role: string;
    monthly_limit: number;
    used_amount: number;
    remaining: number;
    usage_percent: number;
    department: DepartmentInfo | null;
  };
  departments_overview: DepartmentInfo[];
}

interface EmployeeDashboardScreenProps {
  onBack: () => void;
}

export const EmployeeDashboardScreen: React.FC<EmployeeDashboardScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EmployeeDashboardData | null>(null);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();

    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/corporate/employee/dashboard`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setData(result);
      }
    } catch (error) {
      console.error('Employee dashboard fetch failed:', error);
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
      return `${(amount / 100000000).toFixed(1)}억`;
    } else if (amount >= 10000) {
      return `${Math.round(amount / 10000)}만`;
    }
    return amount.toLocaleString();
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return '관리자';
      case 'manager': return '매니저';
      case 'member': return '직원';
      default: return '직원';
    }
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return '#EF4444';
    if (percent >= 70) return '#F59E0B';
    return '#2E7D32';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.animatedContainer,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#212121" />
          </View>
        </Animated.View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.animatedContainer,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          <View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 24 : 0) + 10 }]}>
            <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <BackIcon width={10} height={16} />
            </TouchableOpacity>
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>데이터를 불러올 수 없습니다</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchDashboardData}>
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  }

  const usagePercent = data.my_info.usage_percent;
  const remainingPercent = 100 - usagePercent;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.animatedContainer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 24 : 0) + 10 }]}>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <BackIcon width={10} height={16} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>법인카드</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Card Info */}
          <View style={styles.cardInfoSection}>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeText}>{data.card.company}</Text>
            </View>
            <Text style={styles.cardName}>{data.card.name}</Text>
            <Text style={styles.roleLabel}>{getRoleLabel(data.my_info.role)}</Text>
          </View>

          {/* My Usage Stats */}
          <View style={styles.usageSection}>
            <Text style={styles.sectionTitle}>내 사용 현황</Text>

            <View style={styles.usageCard}>
              <View style={styles.usageMainRow}>
                <View style={styles.usageMainItem}>
                  <Text style={styles.usageMainLabel}>사용액</Text>
                  <Text style={styles.usageMainValue}>
                    {formatCurrency(data.my_info.used_amount)}
                    <Text style={styles.usageMainUnit}>원</Text>
                  </Text>
                </View>
                <View style={styles.usageDivider} />
                <View style={styles.usageMainItem}>
                  <Text style={styles.usageMainLabel}>잔여한도</Text>
                  <Text style={[styles.usageMainValue, styles.remainingValue]}>
                    {formatCurrency(data.my_info.remaining)}
                    <Text style={[styles.usageMainUnit, styles.remainingUnit]}>원</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>한도 사용률</Text>
                  <Text style={[styles.progressPercent, { color: getUsageColor(usagePercent) }]}>
                    {usagePercent}%
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${Math.min(usagePercent, 100)}%`,
                        backgroundColor: getUsageColor(usagePercent)
                      }
                    ]}
                  />
                </View>
                <View style={styles.progressLegend}>
                  <Text style={styles.progressLegendText}>
                    월 한도: {formatCurrency(data.my_info.monthly_limit)}원
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* My Department */}
          {data.my_info.department && (
            <View style={styles.departmentSection}>
              <Text style={styles.sectionTitle}>내 부서</Text>
              <View style={styles.myDepartmentCard}>
                <View style={styles.departmentHeader}>
                  <View style={[styles.departmentColorDot, { backgroundColor: data.my_info.department.color }]} />
                  <Text style={styles.departmentName}>{data.my_info.department.name}</Text>
                </View>
                <View style={styles.departmentStats}>
                  <View style={styles.departmentStatItem}>
                    <Text style={styles.departmentStatLabel}>부서 사용액</Text>
                    <Text style={styles.departmentStatValue}>{formatCurrency(data.my_info.department.used_amount)}원</Text>
                  </View>
                  <View style={styles.departmentStatItem}>
                    <Text style={styles.departmentStatLabel}>부서 한도</Text>
                    <Text style={styles.departmentStatValue}>{formatCurrency(data.my_info.department.monthly_limit)}원</Text>
                  </View>
                </View>
                <View style={styles.departmentProgressContainer}>
                  <View style={styles.departmentProgressBar}>
                    <View
                      style={[
                        styles.departmentProgressFill,
                        {
                          width: `${Math.min(data.my_info.department.usage_percent, 100)}%`,
                          backgroundColor: data.my_info.department.color
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.departmentProgressText}>{data.my_info.department.usage_percent}%</Text>
                </View>
              </View>
            </View>
          )}

          {/* All Departments Overview */}
          {data.departments_overview.length > 0 && (
            <View style={styles.overviewSection}>
              <Text style={styles.sectionTitle}>부서별 현황</Text>
              <View style={styles.overviewCard}>
                {data.departments_overview.map((dept, index) => (
                  <View
                    key={dept.id}
                    style={[
                      styles.overviewItem,
                      index < data.departments_overview.length - 1 && styles.overviewItemBorder,
                      dept.is_my_department && styles.overviewItemHighlight
                    ]}
                  >
                    <View style={styles.overviewItemHeader}>
                      <View style={styles.overviewItemLeft}>
                        <View style={[styles.overviewColorDot, { backgroundColor: dept.color }]} />
                        <Text style={[
                          styles.overviewItemName,
                          dept.is_my_department && styles.overviewItemNameHighlight
                        ]}>
                          {dept.name}
                          {dept.is_my_department && <Text style={styles.myDeptBadge}> (내 부서)</Text>}
                        </Text>
                      </View>
                      <Text style={[
                        styles.overviewItemPercent,
                        { color: getUsageColor(dept.usage_percent) }
                      ]}>
                        {dept.usage_percent}%
                      </Text>
                    </View>
                    <View style={styles.overviewProgressBar}>
                      <View
                        style={[
                          styles.overviewProgressFill,
                          {
                            width: `${Math.min(dept.usage_percent, 100)}%`,
                            backgroundColor: dept.color
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.overviewItemAmount}>
                      {formatCurrency(dept.used_amount)}원 / {formatCurrency(dept.monthly_limit)}원
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Tips Section */}
          <View style={styles.tipsSection}>
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>사용 안내</Text>
              <View style={styles.tipItem}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>월 한도 초과 시 결제가 제한됩니다</Text>
              </View>
              <View style={styles.tipItem}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>영수증은 마이페이지에서 스캔할 수 있습니다</Text>
              </View>
              <View style={styles.tipItem}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>한도는 매월 1일에 초기화됩니다</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
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
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: '#666666',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#212121',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
  },
  // Card Info Section
  cardInfoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  cardBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    marginBottom: 12,
  },
  cardBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  cardName: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  roleLabel: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#2E7D32',
  },
  // Usage Section
  usageSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  usageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  usageMainRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  usageMainItem: {
    flex: 1,
    alignItems: 'center',
  },
  usageDivider: {
    width: 1,
    backgroundColor: '#EEEEEE',
    marginHorizontal: 16,
  },
  usageMainLabel: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#888888',
    marginBottom: 8,
  },
  usageMainValue: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
  },
  usageMainUnit: {
    fontSize: 16,
    fontFamily: FONTS.medium,
  },
  remainingValue: {
    color: '#2E7D32',
  },
  remainingUnit: {
    color: '#2E7D32',
  },
  progressSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  progressPercent: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#EEEEEE',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressLegend: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  progressLegendText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  // Department Section
  departmentSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  myDepartmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  departmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  departmentColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  departmentName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
  },
  departmentStats: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  departmentStatItem: {
    flex: 1,
  },
  departmentStatLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#888888',
    marginBottom: 4,
  },
  departmentStatValue: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  departmentProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  departmentProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#EEEEEE',
    borderRadius: 3,
    overflow: 'hidden',
  },
  departmentProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  departmentProgressText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#666666',
    minWidth: 40,
    textAlign: 'right',
  },
  // Overview Section
  overviewSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  overviewItem: {
    padding: 16,
  },
  overviewItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  overviewItemHighlight: {
    backgroundColor: '#F8FFF8',
  },
  overviewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  overviewItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  overviewItemName: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  overviewItemNameHighlight: {
    color: '#2E7D32',
  },
  myDeptBadge: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#2E7D32',
  },
  overviewItemPercent: {
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  overviewProgressBar: {
    height: 4,
    backgroundColor: '#EEEEEE',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  overviewProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  overviewItemAmount: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  // Tips Section
  tipsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tipsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tipsTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCCCCC',
    marginRight: 10,
    marginTop: 6,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#666666',
    lineHeight: 18,
  },
});
