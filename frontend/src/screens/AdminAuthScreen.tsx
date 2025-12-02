import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS } from '../constants/theme';
import { AuthStorage } from '../utils/auth';
import { BackIcon } from '../components/svg';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';
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

interface AdminAuthScreenProps {
  onAuthenticated: (cards: CorporateCard[]) => void;
  onCancel: () => void;
}

export const AdminAuthScreen: React.FC<AdminAuthScreenProps> = ({ onAuthenticated, onCancel }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [corporateCards, setCorporateCards] = useState<CorporateCard[]>([]);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) {
        setLoading(false);
        setIsAdmin(false);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/corporate/is-admin`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.is_admin) {
        const cardsResponse = await fetch(`${BACKEND_URL}/api/corporate/cards`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const cardsData = await cardsResponse.json();

        if (cardsData.success && cardsData.cards.length > 0) {
          setIsAdmin(true);
          setCorporateCards(cardsData.cards);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Admin check failed:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    if (corporateCards.length > 0) {
      onAuthenticated(corporateCards);
    }
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

  if (loading) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#212121" />
        </View>
      </Animated.View>
    );
  }

  if (!isAdmin) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={handleCancel}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BackIcon width={10} height={16} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainerDenied}>
            <Text style={styles.iconText}>!</Text>
          </View>

          <Text style={styles.title}>접근 권한 없음</Text>
          <Text style={styles.subtitle}>
            법인카드 관리자만 접근할 수 있습니다.{'\n'}
            법인카드를 등록하면 관리자 기능을 사용할 수 있습니다.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={handleCancel}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BackIcon width={10} height={16} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.iconTextCheck}>O</Text>
        </View>

        <Text style={styles.title}>관리자 인증 완료</Text>
        <Text style={styles.subtitle}>
          법인카드 {corporateCards.length}개를 관리할 수 있습니다.
        </Text>

        <View style={styles.cardList}>
          {corporateCards.map((card) => (
            <View key={card.id} style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <Text style={styles.cardItemName}>{card.card_name}</Text>
                <Text style={styles.cardItemCompany}>{card.card_company}</Text>
              </View>
              <Text style={styles.cardItemMembers}>{card.active_members}명 활동</Text>
            </View>
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleProceed}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>대시보드 열기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>취소</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#212121',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 32,
  },
  iconContainerDenied: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  iconText: {
    fontSize: 32,
    fontFamily: FONTS.bold,
    color: '#666666',
  },
  iconTextCheck: {
    fontSize: 32,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#212121',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  cardList: {
    width: '100%',
    marginBottom: 32,
  },
  cardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
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
  cardItemLeft: {
    flex: 1,
  },
  cardItemName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 4,
  },
  cardItemCompany: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  cardItemMembers: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    height: 52,
    backgroundColor: '#212121',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  secondaryButton: {
    height: 52,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
});
