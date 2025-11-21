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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BackIcon, BellIcon, SettingsIcon, CardAddIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import { CARD_IMAGES } from '../constants/userCards';
import { CardRegistrationScreen } from './CardRegistrationScreen';
import { AdminAuthScreen } from './AdminAuthScreen';
import { AdminDashboardScreen } from './AdminDashboardScreen';
import { AdminDepartmentScreen } from './AdminDepartmentScreen';
import { CardBenefitScreen } from './CardBenefitScreen';
import { AuthAPI, AuthStorage } from '../utils/auth';
import { CardEditModal } from '../components/CardEditModal';
import { CardPlaceholder } from '../components/CardPlaceholder';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_SECTION_WIDTH = SCREEN_WIDTH - 40;

interface ProfileScreenProps {
  onBack: () => void;
  onLogout?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, onLogout }) => {
  const insets = useSafeAreaInsets();
  const [hasNotification] = useState(true);
  const [showCardRegistration, setShowCardRegistration] = useState(false);
  const [showCardBenefit, setShowCardBenefit] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showAdminDepartment, setShowAdminDepartment] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const [userData, setUserData] = useState<{
    userName: string;
    phoneNumber: string;
    monthlySpending: number;
    monthlySavings: number;
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
  const [isLoading, setIsLoading] = useState(true);
  const [editingCard, setEditingCard] = useState<string | null>(null);

  const handleAdminAuthenticated = () => {
    setShowAdminAuth(false);
    setShowAdminDashboard(true);
  };

  const handleViewDepartments = () => {
    setShowAdminDashboard(false);
    setShowAdminDepartment(true);
  };

  const handleBackToDashboard = () => {
    setShowAdminDepartment(false);
    setShowAdminDashboard(true);
  };

  const handleCloseAdmin = () => {
    setShowAdminDashboard(false);
    setShowAdminDepartment(false);
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
            if (onLogout) {
              onLogout();
            }
          },
        },
      ]
    );
  };

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const token = await AuthStorage.getToken();
      if (!token) {
        console.error('No token found');
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/mypage`, {
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
          cards: data.user.cards || [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    fetchUserData();
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
  }: {
    item: (typeof cardDetails)[0];
  }) => {
    const benefitPercent = (item.benefitLimit.used / item.benefitLimit.total) * 100;
    const performancePercent = (item.performance.current / item.performance.required) * 100;

    return (
      <View style={styles.cardSection}>
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
              {item.discounts.map((discount, index) => (
                <Text key={index} style={styles.discountItem}>
                  {discount}
                </Text>
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
              <LinearGradient
                colors={['#FCC490', '#8586CA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBar, { width: `${100 - benefitPercent}%` }]}
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
              <LinearGradient
                colors={['#22B573', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBar, { width: `${performancePercent}%` }]}
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
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BackIcon width={10} height={16} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerIcon}
          >
            <BellIcon width={20} height={20} hasNotification={hasNotification} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handleLogout}
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
          <Text style={styles.greeting}>안녕하세요, {userData?.userName || '사용자'}님</Text>
          <Text style={styles.phoneNumber}>{userData?.phoneNumber || '010-****-****'}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>이번 달 소비</Text>
              <Text style={styles.statValue}>
                {(userData?.monthlySpending || 0).toLocaleString()}원
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>혜택으로 절약</Text>
              <Text style={styles.statValueGreen}>
                {(userData?.monthlySavings || 0).toLocaleString()}원
              </Text>
            </View>
          </View>
        </View>

        {/* My Deck Report Section */}
        <View style={styles.deckReportSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Deck Report</Text>
            <TouchableOpacity
              style={styles.adminButton}
              onPress={() => setShowAdminAuth(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.adminButtonText}>관리자</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.deckReportContainer}>
            <FlatList
              data={cardDetails}
              renderItem={renderCardSection}
              keyExtractor={(item) => item.name}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_SECTION_WIDTH + 20}
              decelerationRate="fast"
              contentContainerStyle={styles.deckReportList}
              style={styles.deckReportFlatList}
            />
          </View>
        </View>

        {/* Card Registration Section */}
        <TouchableOpacity
          style={styles.registrationSection}
          activeOpacity={0.8}
          onPress={() => setShowCardRegistration(true)}
        >
          <View style={styles.registrationHeader}>
            <CardAddIcon width={24} height={24} />
            <Text style={styles.registrationTitle}>카드 등록하기</Text>
          </View>
          <Text style={styles.registrationSubtitle}>
            새로운 카드를 등록하고 더 많은 혜택을 받아보세요
          </Text>
        </TouchableOpacity>

        {/* Advertisement Section */}
        <View style={styles.adSection}>
          <View style={styles.adChickenContainer}>
            <Image
              source={require('../../assets/images/chicken.png')}
              style={styles.adChickenImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.adContent}>
            <View style={styles.adTextContainer}>
              <Text style={styles.adSubtitle}>이번달 소비 유지하면서</Text>
              <Text style={styles.adTitle}>배달 치킨 한마리{'\n'}더 받기 !</Text>
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
        </View>

        {/* Card Benefit Section */}
        <TouchableOpacity
          style={styles.benefitSection}
          activeOpacity={0.8}
          onPress={() => setShowCardBenefit(true)}
        >
          <Text style={styles.benefitTitle}>내 카드 혜택 상세 보기</Text>
          <Text style={styles.benefitSubtitle}>
            등록된 모든 카드의 혜택을 한눈에 확인하세요
          </Text>
        </TouchableOpacity>

        {/* Cardealo Combination Section */}
        <View style={styles.combinationSection}>
          <Text style={styles.combinationTitle}>
            Cardealo Combination로 최대 혜택 받기
          </Text>
          <Text style={styles.combinationSubtitle}>
            AI가 추천하는 최적의 카드 조합을 확인하세요
          </Text>
          <TouchableOpacity style={styles.combinationButton} activeOpacity={0.8}>
            <Text style={styles.combinationButtonText}>조합 보러가기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </Animated.View>
      {showCardRegistration && (
        <View style={styles.overlay}>
          <CardRegistrationScreen onBack={() => setShowCardRegistration(false)} />
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
      {showAdminDashboard && (
        <View style={styles.overlay}>
          <AdminDashboardScreen
            onClose={handleCloseAdmin}
            onViewDepartments={handleViewDepartments}
          />
        </View>
      )}
      {showAdminDepartment && (
        <View style={styles.overlay}>
          <AdminDepartmentScreen onBack={handleBackToDashboard} />
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

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 20,
  },
  scrollView: {
    flex: 1,
  },
  userInfoSection: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 8,
  },
  phoneNumber: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginBottom: 24,
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
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  statValueGreen: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#4AA63C',
  },
  deckReportSection: {
    marginTop: 20,
    paddingBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  adminButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#9C27B0',
    borderRadius: 6,
  },
  adminButtonText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
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
    paddingVertical: 10,
  },
  cardSection: {
    width: CARD_SECTION_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginRight: 20,
    marginVertical: 5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardTopArea: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  cardImage: {
    width: 80,
    height: 50,
    borderRadius: 8,
    marginRight: 15,
  },
  cardImagePlaceholder: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImagePlaceholderText: {
    fontSize: 12,
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
    marginBottom: 10,
  },
  cardName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#212121',
    flex: 1,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#666666',
  },
  discountList: {
    gap: 4,
  },
  discountItem: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
  },
  cardBottomArea: {
    gap: 15,
  },
  progressItem: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#212121',
  },
  progressValue: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  registrationSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#212121',
    borderRadius: 16,
  },
  registrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  registrationTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  registrationSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#CCCCCC',
  },
  adSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    height: 160,
    backgroundColor: '#FFFAED',
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    paddingLeft: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  adChickenContainer: {
    width: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  adChickenImage: {
    width: 120,
    height: 120,
  },
  adContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  adTextContainer: {
    gap: 4,
  },
  adSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  adTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
    lineHeight: 24,
  },
  adCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adCardImage: {
    width: 60,
    height: 38,
    borderRadius: 4,
  },
  adCardName: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
  },
  benefitSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#4AA63C',
    borderRadius: 16,
  },
  benefitTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  benefitSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  combinationSection: {
    marginHorizontal: 20,
    marginBottom: 40,
    padding: 24,
    backgroundColor: '#212121',
    borderRadius: 16,
  },
  combinationTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  combinationSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#CCCCCC',
    marginBottom: 20,
  },
  combinationButton: {
    backgroundColor: '#4AA63C',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  combinationButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
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
