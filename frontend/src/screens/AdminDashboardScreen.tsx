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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS } from '../constants/theme';
import { AuthStorage } from '../utils/auth';
import { BackIcon, ChevronRightIcon, BuildingIcon, UsersIcon } from '../components/svg';
import { API_URL } from '../utils/api';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CorporateCard {
  id: number;
  card_name: string;
  card_number: string;
  card_company: string;
  monthly_limit: number;
  used_amount: number;
  benefit_summary: string;
  departments: Array<{
    id: number;
    name: string;
    monthly_limit: number;
    used_amount: number;
    color: string;
  }>;
  total_members: number;
  active_members: number;
}

interface DashboardStats {
  total_spent: number;
  total_benefit: number;
  active_cards: number;
  total_departments: number;
  benefit_rate: number;
}

interface DepartmentStats {
  id: number;
  name: string;
  card_count: number;
  monthly_limit: number;
  used_amount: number;
  usage_percent: number;
  benefit: number;
  color: string;
}

interface AdminDashboardScreenProps {
  cardId: number;
  cards: CorporateCard[];
  onClose: () => void;
  onViewDepartments: () => void;
  onViewMembers: () => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({
  cardId,
  cards,
  onClose,
  onViewDepartments,
  onViewMembers
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [departments, setDepartments] = useState<DepartmentStats[]>([]);
  const [selectedCardId, setSelectedCardId] = useState(cardId);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();

    fetchDashboardData();
  }, [selectedCardId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/corporate/dashboard/${selectedCardId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Dashboard fetch failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Animated.spring(slideAnim, {
      toValue: SCREEN_WIDTH,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start(() => {
      onClose();
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

  const selectedCard = cards.find(c => c.id === selectedCardId);

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
            onPress={handleClose}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BackIcon width={10} height={16} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>관리자</Text>
          <View style={styles.headerPlaceholder} />
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
            {/* Card Selector */}
            {cards.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.cardSelector}
                contentContainerStyle={styles.cardSelectorContent}
              >
                {cards.map((card) => (
                  <TouchableOpacity
                    key={card.id}
                    style={[
                      styles.cardTab,
                      selectedCardId === card.id && styles.cardTabActive
                    ]}
                    onPress={() => setSelectedCardId(card.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.cardTabText,
                      selectedCardId === card.id && styles.cardTabTextActive
                    ]}>
                      {card.card_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Main Stats */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionLabel}>{selectedCard?.card_name} 이번 달 현황</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>총 지출</Text>
                  <Text style={styles.statValue}>{formatCurrency(stats?.total_spent || 0)}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>총 혜택</Text>
                  <Text style={styles.statValueGreen}>{formatCurrency(stats?.total_benefit || 0)}</Text>
                </View>
              </View>
            </View>

            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <View style={styles.quickStatCard}>
                <Text style={styles.quickStatValue}>{stats?.active_cards || 0}</Text>
                <Text style={styles.quickStatLabel}>활성 카드</Text>
              </View>
              <View style={styles.quickStatCard}>
                <Text style={styles.quickStatValue}>{stats?.total_departments || 0}</Text>
                <Text style={styles.quickStatLabel}>부서</Text>
              </View>
              <View style={styles.quickStatCard}>
                <Text style={[styles.quickStatValue, { color: '#4AA63C' }]}>{stats?.benefit_rate || 0}%</Text>
                <Text style={styles.quickStatLabel}>혜택률</Text>
              </View>
            </View>

            {/* Departments Section */}
            {departments.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>부서별 현황</Text>
                </View>

                {departments.slice(0, 3).map((dept) => (
                  <View key={dept.id} style={styles.deptCard}>
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
                      <Text style={[
                        styles.deptProgressText,
                        dept.usage_percent >= 85 && styles.deptProgressWarning
                      ]}>
                        {dept.usage_percent}%
                      </Text>
                    </View>

                    <View style={styles.deptFooter}>
                      <Text style={styles.deptAmount}>
                        {formatCurrency(dept.used_amount)} / {formatCurrency(dept.monthly_limit)}
                      </Text>
                      <Text style={styles.deptBenefit}>
                        +{formatCurrency(dept.benefit)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionSection}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onViewDepartments}
                activeOpacity={0.7}
              >
                <View style={styles.actionButtonIcon}>
                  <BuildingIcon width={22} height={22} color="#212121" />
                </View>
                <View style={styles.actionButtonContent}>
                  <Text style={styles.actionButtonTitle}>부서별 지출 현황</Text>
                  <Text style={styles.actionButtonSubtitle}>부서 관리 및 한도 설정</Text>
                </View>
                <ChevronRightIcon width={8} height={14} color="#CCCCCC" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={onViewMembers}
                activeOpacity={0.7}
              >
                <View style={styles.actionButtonIcon}>
                  <UsersIcon width={22} height={22} color="#212121" />
                </View>
                <View style={styles.actionButtonContent}>
                  <Text style={styles.actionButtonTitle}>직원 관리</Text>
                  <Text style={styles.actionButtonSubtitle}>직원 초대 및 권한 설정</Text>
                </View>
                <ChevronRightIcon width={8} height={14} color="#CCCCCC" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
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
  headerPlaceholder: {
    width: 10,
  },
  scrollView: {
    flex: 1,
  },
  cardSelector: {
    marginBottom: 16,
  },
  cardSelectorContent: {
    paddingHorizontal: 20,
  },
  cardTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    marginRight: 8,
  },
  cardTabActive: {
    backgroundColor: '#212121',
  },
  cardTabText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  cardTabTextActive: {
    color: '#FFFFFF',
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  statValueGreen: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#4AA63C',
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  quickStatValue: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  deptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
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
    marginBottom: 12,
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
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  deptMembers: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  deptProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  deptProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    marginRight: 12,
    overflow: 'hidden',
  },
  deptProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  deptProgressText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: '#212121',
    width: 45,
    textAlign: 'right',
  },
  deptProgressWarning: {
    color: '#FF5722',
  },
  deptFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deptAmount: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  deptBenefit: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
  },
  actionSection: {
    paddingHorizontal: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  actionButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 4,
  },
  actionButtonSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  actionButtonArrow: {
    fontSize: 18,
    color: '#CCCCCC',
    marginLeft: 12,
  },
});
