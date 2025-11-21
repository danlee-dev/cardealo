import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { BackIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import { AuthStorage } from '../utils/auth';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';
const SCREEN_WIDTH = Dimensions.get('window').width;

interface CardBenefit {
  category: string;
  places: any[];
  discount_type: string;
  discount_value: number;
  max_discount: number;
  pre_month_config: any;
  limit_config: any;
  places_display: string;
  discount_display: string;
  limit_display: string;
  max_discount_display: string;
}

interface CardBenefitScreenProps {
  onBack: () => void;
}

export const CardBenefitScreen: React.FC<CardBenefitScreenProps> = ({ onBack }) => {
  const [benefits, setBenefits] = useState<Record<string, CardBenefit[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const slideAnim = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    fetchBenefits();
  }, []);

  const fetchBenefits = async () => {
    try {
      setIsLoading(true);
      const token = await AuthStorage.getToken();
      if (!token) {
        console.error('No token found');
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/card/benefit`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.success && data.data) {
        setBenefits(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch benefits:', error);
    } finally {
      setIsLoading(false);
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

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BackIcon width={10} height={16} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>카드 혜택 상세</Text>
        <View style={{ width: 10 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4AA63C" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {Object.keys(benefits).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>등록된 카드가 없습니다.</Text>
            </View>
          ) : (
            Object.entries(benefits).map(([cardName, cardBenefits]) => (
              <View key={cardName} style={styles.cardSection}>
                <Text style={styles.cardName}>{cardName}</Text>
                {cardBenefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <View style={styles.benefitHeader}>
                      <Text style={styles.benefitPlaces}>{benefit.places_display}</Text>
                      <Text style={styles.benefitDiscount}>
                        {benefit.discount_display}
                      </Text>
                    </View>
                    <View style={styles.benefitDetails}>
                      {benefit.max_discount_display && (
                        <Text style={styles.benefitDetailText}>
                          {benefit.max_discount_display}
                        </Text>
                      )}
                      {benefit.limit_display && (
                        <Text style={styles.benefitDetailText}>
                          {benefit.limit_display}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Animated.View>
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
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  cardSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  cardName: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 16,
  },
  benefitItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  benefitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitPlaces: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#212121',
    flex: 1,
  },
  benefitDiscount: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#4AA63C',
  },
  benefitDetails: {
    gap: 4,
  },
  benefitDetailText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
});
