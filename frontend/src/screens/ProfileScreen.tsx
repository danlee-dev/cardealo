import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { BackIcon, BellIcon, SettingsIcon, CardAddIcon, ReceiptIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import { CARD_IMAGES } from '../constants/userCards';
import { CardRegistrationScreen } from './CardRegistrationScreen';
import { ReceiptScanScreen } from './ReceiptScanScreen';
import { SettingsScreen } from './SettingsScreen';
import { AdminAuthScreen } from './AdminAuthScreen';
import { AdminDashboardScreen } from './AdminDashboardScreen';
import { AdminDepartmentScreen } from './AdminDepartmentScreen';
import { AdminMembersScreen } from './AdminMembersScreen';
import { EmployeeDashboardScreen } from './EmployeeDashboardScreen';
import { CardBenefitScreen } from './CardBenefitScreen';
import { NotificationScreen } from './NotificationScreen';
import { CorporateCardRegistrationScreen } from './CorporateCardRegistrationScreen';
import { AuthStorage } from '../utils/auth';
import { CardEditModal } from '../components/CardEditModal';
import { CardPlaceholder } from '../components/CardPlaceholder';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../utils/api';

// Animated pressable button component
const AnimatedPressable = ({ children, onPress, style, disabled }: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  disabled?: boolean;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_SECTION_WIDTH = SCREEN_WIDTH - 40;

interface ProfileScreenProps {
  onBack: () => void;
  onLogout?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, onLogout }) => {
  const insets = useSafeAreaInsets();
  const [showCardRegistration, setShowCardRegistration] = useState(false);
  const [showReceiptScan, setShowReceiptScan] = useState(false);
  const [showCardBenefit, setShowCardBenefit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showAdminDepartment, setShowAdminDepartment] = useState(false);
  const [showAdminMembers, setShowAdminMembers] = useState(false);
  const [showEmployeeDashboard, setShowEmployeeDashboard] = useState(false);
  const [corporateCards, setCorporateCards] = useState<any[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [corporateRole, setCorporateRole] = useState<'none' | 'admin' | 'employee'>('none');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const [userData, setUserData] = useState<{
    userName: string;
    phoneNumber: string;
    monthlySpending: number;
    monthlySavings: number;
    isCorporateUser: boolean;
    isBusiness: boolean;
    cards: Array<{
      cid: number;
      card_name: string;
      card_benefit: string;
      card_pre_month_money: number;
      card_pre_YN: boolean;
      monthly_limit?: number;
      used_amount?: number;
      monthly_performance?: number;
      daily_count?: number;
      monthly_count?: number;
      last_used_date?: string | null;
      reset_date?: string | null;
    }>;
  } | null>(null);
  const [showCorporateCardRegistration, setShowCorporateCardRegistration] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCard, setEditingCard] = useState<string | null>(null);

  const handleAdminAuthenticated = (cards: any[]) => {
    setShowAdminAuth(false);
    setCorporateCards(cards);
    if (cards.length > 0) {
      setSelectedCardId(cards[0].id);
    }
    setShowAdminDashboard(true);
  };

  const handleViewDepartments = () => {
    setShowAdminDashboard(false);
    setShowAdminDepartment(true);
  };

  const handleViewMembers = () => {
    setShowAdminDashboard(false);
    setShowAdminMembers(true);
  };

  const handleBackToDashboard = () => {
    setShowAdminDepartment(false);
    setShowAdminMembers(false);
    setShowAdminDashboard(true);
  };

  const handleCloseAdmin = () => {
    setShowAdminDashboard(false);
    setShowAdminDepartment(false);
    setShowAdminMembers(false);
  };

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const token = await AuthStorage.getToken();
      if (!token) {
        console.error('No token found');
        return;
      }

      const response = await fetch(`${API_URL}/api/mypage`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.success && data.user) {
        setUserData({
          userName: data.user.user_name || '사용자',
          phoneNumber: data.user.user_phone || '010-****-****',
          monthlySpending: data.user.monthly_spending || 0,
          monthlySavings: data.user.monthly_savings || 0,
          isCorporateUser: data.user.is_corporate_user || false,
          isBusiness: data.user.isBusiness || false,
          cards: data.user.cards || [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setUnreadNotificationCount(data.unread_count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const fetchCorporateRole = async () => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/corporate/is-employee`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        if (data.is_admin) {
          setCorporateRole('admin');
        } else if (data.is_employee) {
          setCorporateRole('employee');
        } else {
          setCorporateRole('none');
        }
      }
    } catch (error) {
      console.error('Failed to fetch corporate role:', error);
    }
  };


  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    fetchUserData();
    fetchUnreadCount();
    fetchCorporateRole();
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

  const handleCardScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / (CARD_SECTION_WIDTH + 16));
    if (index !== currentCardIndex && index >= 0) {
      setCurrentCardIndex(index);
    }
  };

  const cardDetails = userData?.cards.map((card) => {
    // 혜택 텍스트를 줄 단위로 분리하고 처음 3개만 표시
    let benefits: string[] = [];
    if (card.card_benefit) {
      const lines = card.card_benefit.split(/[/\n]/).map(line => line.trim()).filter(line => line.length > 0);
      benefits = lines.slice(0, 3).map(line => {
        // 각 줄이 너무 길면 50자로 제한
        return line.length > 50 ? line.substring(0, 50) + '...' : line;
      });
    }

    return {
      id: card.cid,
      name: card.card_name,
      image: CARD_IMAGES[card.card_name],
      discounts: benefits,
      benefitLimit: {
        used: card.used_amount || 0,
        total: card.monthly_limit || 300000, // Default 30만원 if not set
      },
      performance: {
        current: card.monthly_performance || 0,
        required: card.card_pre_month_money || 0,
      },
      // Original card data for CardPlaceholder
      cardBenefit: card.card_benefit,
      cardPreMoney: card.card_pre_month_money,
    };
  }) || [];

  const renderCardSection = ({
    item,
    index,
  }: {
    item: (typeof cardDetails)[0];
    index: number;
  }) => {
    const benefitPercent = (item.benefitLimit.used / item.benefitLimit.total) * 100;
    const performancePercent = (item.performance.current / item.performance.required) * 100;
    const isLastItem = index === (cardDetails?.length || 0) - 1;

    return (
      <View style={[styles.cardSection, isLastItem && styles.cardSectionLast]}>
        <View style={styles.cardTopArea}>
          {item.image ? (
            <Image source={item.image} style={styles.cardImage} />
          ) : (
            <CardPlaceholder
              cardName={item.name}
              benefit={item.cardBenefit}
              preMoney={item.cardPreMoney}
              width={120}
              height={75}
              style={styles.cardImage}
            />
          )}
          <View style={styles.cardInfo}>
            <View style={styles.cardNameRow}>
              <Text style={styles.cardName}>{item.name}</Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditingCard(item.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.editButtonText}>수정</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.discountList}>
              {item.discounts.slice(0, 2).map((discount, index) => (
                <View key={index} style={styles.discountItemWrapper}>
                  <View style={styles.discountDot} />
                  <Text style={styles.discountItem} numberOfLines={1} ellipsizeMode="tail">
                    {discount}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.cardBottomArea}>
          <View style={styles.progressItem}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>혜택한도</Text>
              <Text style={styles.progressValue}>
                {item.benefitLimit.used.toLocaleString()}원 /{' '}
                {item.benefitLimit.total.toLocaleString()}원
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View
                style={[styles.progressBar, styles.progressBarBenefit, { width: `${Math.min(100 - benefitPercent, 100)}%` }]}
              />
            </View>
          </View>

          <View style={styles.progressItem}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>실적</Text>
              <Text style={styles.progressValue}>
                {item.performance.current.toLocaleString()}원 /{' '}
                {item.performance.required.toLocaleString()}원
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View
                style={[styles.progressBar, styles.progressBarPerformance, { width: `${Math.min(performancePercent, 100)}%` }]}
              />
            </View>
          </View>

        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: slideAnim }],
          },
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
          <Text style={styles.headerTitle}>마이페이지</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerIconBtn}
            onPress={() => setShowNotifications(true)}
          >
            <BellIcon width={20} height={20} hasNotification={unreadNotificationCount > 0} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => setShowSettings(true)}
          >
            <SettingsIcon width={20} height={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info Section */}
        <View style={styles.userInfoSection}>
          <View style={styles.userInfoTop}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {(userData?.userName || '사용자').charAt(0)}
              </Text>
            </View>
            <View style={styles.userInfoText}>
              <Text style={styles.greeting}>{userData?.userName || '사용자'}님</Text>
              <Text style={styles.phoneNumber}>{userData?.phoneNumber || '010-****-****'}</Text>
            </View>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>이번 달 소비</Text>
              <Text style={styles.statValue}>
                {(userData?.monthlySpending || 0).toLocaleString()}<Text style={styles.statUnit}>원</Text>
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabelGreen}>혜택으로 절약</Text>
              <Text style={styles.statValueGreen}>
                {(userData?.monthlySavings || 0).toLocaleString()}<Text style={styles.statUnitGreen}>원</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* My Deck Report Section */}
        <View style={styles.deckReportSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>My Deck Report</Text>
              <TouchableOpacity
                style={styles.addCardTag}
                onPress={() => setShowCardRegistration(true)}
                activeOpacity={0.7}
              >
                <CardAddIcon width={12} height={12} color="#666666" />
                <Text style={styles.addCardTagText}>등록</Text>
              </TouchableOpacity>
            </View>
            {corporateRole === 'admin' && (
              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => setShowAdminAuth(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.adminButtonText}>관리자</Text>
              </TouchableOpacity>
            )}
            {corporateRole === 'employee' && (
              <TouchableOpacity
                style={styles.employeeButton}
                onPress={() => setShowEmployeeDashboard(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.employeeButtonText}>법인카드</Text>
              </TouchableOpacity>
            )}
            {userData?.isBusiness && corporateRole === 'none' && (
              <TouchableOpacity
                style={styles.businessRegisterButton}
                onPress={() => setShowCorporateCardRegistration(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.businessRegisterButtonText}>법인카드 등록</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.deckReportContainer}>
            <FlatList
              data={cardDetails}
              renderItem={renderCardSection}
              keyExtractor={(item) => item.name}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_SECTION_WIDTH + 16}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={styles.deckReportList}
              style={styles.deckReportFlatList}
              onScroll={handleCardScroll}
              scrollEventThrottle={16}
            />
            {cardDetails.length > 1 && (
              <View style={styles.paginationDots}>
                {cardDetails.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      currentCardIndex === index && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Receipt Scan - Corporate Users Only */}
        {corporateRole !== 'none' && (
          <AnimatedPressable
            style={styles.receiptScanSection}
            onPress={() => setShowReceiptScan(true)}
          >
            <View style={styles.receiptScanContent}>
              <View style={styles.receiptScanLeft}>
                <View style={styles.receiptScanIconContainer}>
                  <ReceiptIcon width={22} height={22} color="#FFFFFF" />
                </View>
                <View style={styles.receiptScanTextContainer}>
                  <Text style={styles.receiptScanTitle}>영수증 스캔</Text>
                  <Text style={styles.receiptScanSubtitle}>법인카드 사용 내역을 자동으로 기록하세요</Text>
                </View>
              </View>
              <View style={styles.receiptScanArrow}>
                <Text style={styles.receiptScanArrowText}>›</Text>
              </View>
            </View>
          </AnimatedPressable>
        )}

        {/* Advertisement Section */}
        <AnimatedPressable style={styles.adSection}>
          <View style={styles.adChickenContainer}>
            <Image
              source={require('../../assets/images/chicken.png')}
              style={styles.adChickenImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.adContent}>
            <View style={styles.adTextContainer}>
              <Text style={styles.adLabel}>추천 카드</Text>
              <Text style={styles.adTitle}>배달 치킨 한마리{'\n'}더 받기</Text>
            </View>
            <View style={styles.adCardContainer}>
              <Image
                source={require('../../assets/images/card-baemin-hyundai.png')}
                style={styles.adCardImage}
                resizeMode="contain"
              />
              <Text style={styles.adCardName}>배민 한 그릇 카드</Text>
            </View>
          </View>
        </AnimatedPressable>

        {/* Card Benefit Section */}
        <AnimatedPressable
          style={styles.benefitSection}
          onPress={() => setShowCardBenefit(true)}
        >
          <View style={styles.benefitContent}>
            <View>
              <Text style={styles.benefitTitle}>내 카드 혜택 상세 보기</Text>
              <Text style={styles.benefitSubtitle}>
                등록된 모든 카드의 혜택을 한눈에 확인하세요
              </Text>
            </View>
            <View style={styles.benefitArrow}>
              <Text style={styles.benefitArrowText}>→</Text>
            </View>
          </View>
        </AnimatedPressable>

        {/* Cardealo Combination Section */}
        <View style={styles.combinationSection}>
          <View style={styles.combinationHeader}>
            <Text style={styles.combinationLabel}>AI 추천</Text>
          </View>
          <Text style={styles.combinationTitle}>
            최적의 카드 조합 찾기
          </Text>
          <Text style={styles.combinationSubtitle}>
            AI가 분석한 맞춤 카드 조합을 확인하세요
          </Text>
          <AnimatedPressable style={styles.combinationButton}>
            <Text style={styles.combinationButtonText}>조합 보러가기</Text>
          </AnimatedPressable>
        </View>
      </ScrollView>
      </Animated.View>
      {showCardRegistration && (
        <View style={styles.overlay}>
          <CardRegistrationScreen onBack={() => {
            setShowCardRegistration(false);
            // 카드 등록 후 데이터 새로고침
            fetchUserData();
          }} />
        </View>
      )}
      {showReceiptScan && (
        <View style={styles.overlay}>
          <ReceiptScanScreen
            onBack={() => setShowReceiptScan(false)}
            onSaved={() => fetchUserData()}
          />
        </View>
      )}
      {showAdminAuth && (
        <View style={styles.overlay}>
          <AdminAuthScreen
            onAuthenticated={handleAdminAuthenticated}
            onCancel={() => setShowAdminAuth(false)}
          />
        </View>
      )}
      {showAdminDashboard && selectedCardId && (
        <View style={styles.overlay}>
          <AdminDashboardScreen
            cardId={selectedCardId}
            cards={corporateCards}
            onClose={handleCloseAdmin}
            onViewDepartments={handleViewDepartments}
            onViewMembers={handleViewMembers}
          />
        </View>
      )}
      {showAdminDepartment && selectedCardId && (
        <View style={styles.overlay}>
          <AdminDepartmentScreen cardId={selectedCardId} onBack={handleBackToDashboard} />
        </View>
      )}
      {showAdminMembers && selectedCardId && (
        <View style={styles.overlay}>
          <AdminMembersScreen
            cardId={selectedCardId}
            departments={corporateCards.find(c => c.id === selectedCardId)?.departments || []}
            onBack={handleBackToDashboard}
          />
        </View>
      )}
      {showEmployeeDashboard && (
        <View style={styles.overlay}>
          <EmployeeDashboardScreen
            onBack={() => setShowEmployeeDashboard(false)}
          />
        </View>
      )}
      {showCorporateCardRegistration && (
        <View style={styles.overlay}>
          <CorporateCardRegistrationScreen
            onClose={() => setShowCorporateCardRegistration(false)}
            onSuccess={() => {
              fetchUserData();
              fetchCorporateRole();
            }}
          />
        </View>
      )}
      {editingCard && (
        <CardEditModal
          visible={true}
          cardName={editingCard}
          onClose={() => setEditingCard(null)}
          onCardUpdated={() => {
            fetchUserData();
            setEditingCard(null);
          }}
        />
      )}
      {showCardBenefit && (
        <View style={styles.overlay}>
          <CardBenefitScreen onBack={() => setShowCardBenefit(false)} />
        </View>
      )}
      {showSettings && (
        <View style={styles.overlay}>
          <SettingsScreen
            onBack={() => setShowSettings(false)}
            onLogout={() => {
              setShowSettings(false);
              if (onLogout) {
                onLogout();
              }
            }}
            userName={userData?.userName}
            userPhone={userData?.phoneNumber}
          />
        </View>
      )}
      {showNotifications && (
        <View style={styles.overlay}>
          <NotificationScreen
            onBack={() => {
              setShowNotifications(false);
              fetchUnreadCount();
            }}
          />
        </View>
      )}

    </View>
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
    textAlign: 'center',
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  headerLeft: {
    width: 60,
    alignItems: 'flex-start',
    zIndex: 1,
  },
  headerRight: {
    width: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    zIndex: 1,
  },
  headerIconBtn: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  // User Info Section
  userInfoSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  userInfoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  userInfoText: {
    flex: 1,
  },
  greeting: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  phoneNumber: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E5E5',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#888888',
    marginBottom: 6,
  },
  statLabelGreen: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#2E7D32',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
  },
  statUnit: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#1A1A1A',
  },
  statValueGreen: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#2E7D32',
  },
  statUnitGreen: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#2E7D32',
  },
  // Deck Report Section
  deckReportSection: {
    marginTop: 8,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  addCardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  addCardTagText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  adminButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  adminButtonText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  employeeButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#2E7D32',
    borderRadius: 8,
  },
  employeeButtonText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  businessRegisterButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#1565C0',
    borderRadius: 8,
  },
  businessRegisterButtonText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  deckReportContainer: {
    overflow: 'visible',
  },
  deckReportFlatList: {
    overflow: 'visible',
  },
  deckReportList: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  paginationDotActive: {
    backgroundColor: '#1A1A1A',
    width: 16,
  },
  cardSection: {
    width: CARD_SECTION_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginRight: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardSectionLast: {
    marginRight: 0,
  },
  cardTopArea: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  cardImage: {
    width: 76,
    height: 48,
    borderRadius: 8,
    marginRight: 14,
  },
  cardImagePlaceholder: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImagePlaceholderText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#999999',
  },
  cardInfo: {
    flex: 1,
  },
  cardNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardName: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    flex: 1,
    letterSpacing: -0.2,
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  discountList: {
    gap: 4,
  },
  discountItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#2E7D32',
    marginRight: 6,
  },
  discountItem: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#666666',
    flex: 1,
  },
  cardBottomArea: {
    gap: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  progressItem: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  progressValue: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#EEEEEE',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarBenefit: {
    backgroundColor: '#1A1A1A',
  },
  progressBarPerformance: {
    backgroundColor: '#2E7D32',
  },
  // Receipt Scan Section (Corporate Users)
  receiptScanSection: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  receiptScanContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptScanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  receiptScanIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  receiptScanIcon: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  receiptScanTextContainer: {
    flex: 1,
  },
  receiptScanTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
    marginBottom: 3,
  },
  receiptScanSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  receiptScanArrow: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptScanArrowText: {
    fontSize: 22,
    fontFamily: FONTS.medium,
    color: '#CCCCCC',
  },
  registrationSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
  },
  registrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  registrationTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  registrationSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#AAAAAA',
  },
  // Ad Section
  adSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    height: 140,
    backgroundColor: '#FBF8F4',
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  adChickenContainer: {
    width: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adChickenImage: {
    width: 100,
    height: 100,
  },
  adContent: {
    flex: 1,
    paddingVertical: 16,
    paddingRight: 16,
    justifyContent: 'space-between',
  },
  adTextContainer: {
    gap: 2,
  },
  adLabel: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#888888',
    marginBottom: 4,
  },
  adTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  adCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adCardImage: {
    width: 52,
    height: 33,
    borderRadius: 4,
  },
  adCardName: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  // Benefit Section
  benefitSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 18,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
  },
  benefitContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  benefitTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  benefitSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.7)',
  },
  benefitArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitArrowText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
  },
  // Combination Section
  combinationSection: {
    marginHorizontal: 20,
    marginBottom: 40,
    padding: 20,
    backgroundColor: '#FBF8F4',
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  combinationHeader: {
    marginBottom: 8,
  },
  combinationLabel: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: '#2E7D32',
    letterSpacing: 0.3,
  },
  combinationTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  combinationSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#888888',
    marginBottom: 16,
    lineHeight: 18,
  },
  combinationButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  combinationButtonText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  paymentButton: {
    marginTop: 15,
    paddingVertical: 14,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  paymentButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalContent: {
    width: SCREEN_WIDTH - 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 10,
        },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  qrModalTitle: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  qrModalCloseButton: {
    padding: 8,
  },
  qrModalCloseText: {
    fontSize: 24,
    color: '#666666',
  },
  qrModalCardName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#2563EB',
    marginBottom: 20,
  },
  qrCodeContainer: {
    width: 250,
    height: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  qrCodeImage: {
    width: 240,
    height: 240,
  },
  qrErrorText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
    textAlign: 'center',
  },
  qrTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  qrTimerLabel: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  qrTimerValue: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#EF4444',
  },
  qrInstructionText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
  },
});
