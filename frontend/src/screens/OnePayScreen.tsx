import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  FlatList,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BackIcon, RefreshIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import { CARD_IMAGES } from '../constants/userCards';
import { AuthStorage } from '../utils/auth';
import { CardPlaceholder } from '../components/CardPlaceholder';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = 140;
const CARD_SPACING = 20;
const SIDE_PADDING = 20;

interface OnePayScreenProps {
  onBack: () => void;
  selectedStore?: {
    name: string;
    category: string;
  } | null;
}

export const OnePayScreen: React.FC<OnePayScreenProps> = ({ onBack, selectedStore }) => {
  const [displayMode, setDisplayMode] = useState<'barcode' | 'qr'>('barcode');
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [userCards, setUserCards] = useState<Array<{
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
  }>>([]);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [barcodeImage, setBarcodeImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'waiting' | 'completed' | 'failed' | 'cancelled'>('idle');
  const [paymentResult, setPaymentResult] = useState<{
    merchant_name: string;
    final_amount: number;
    discount_amount: number;
    benefit_text: string;
  } | null>(null);
  const [qrTimestamp, setQrTimestamp] = useState<number | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const cardListRef = useRef<FlatList>(null);
  const cardScaleAnims = useRef<Animated.Value[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const successScaleAnim = useRef(new Animated.Value(0)).current;

  const fetchUserCards = async () => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/mypage`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('User cards data:', data);
      if (data.success && data.user.cards) {
        // 최근 등록 순으로 정렬 (cid 내림차순)
        const sortedCards = [...data.user.cards].sort((a, b) => b.cid - a.cid);
        console.log('Cards (sorted by recent):', sortedCards);
        setUserCards(sortedCards);
        cardScaleAnims.current = sortedCards.map(() => new Animated.Value(1));
      }
    } catch (error) {
      console.error('Failed to fetch user cards:', error);
      Alert.alert('오류', '카드 정보를 불러올 수 없습니다');
    }
  };

  const generateCode = async () => {
    if (userCards.length === 0) return;

    try {
      setIsLoading(true);
      const token = await AuthStorage.getToken();
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다');
        return;
      }

      const selectedCard = userCards[selectedCardIndex];
      console.log('Generating QR for card:', selectedCard.cid);
      console.log('Backend URL:', BACKEND_URL);

      const response = await fetch(`${BACKEND_URL}/api/qr/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          card_id: selectedCard.cid,
          type: 'qr',
        }),
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText.substring(0, 200));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('JSON parse error:', e);
        Alert.alert('오류', `서버 응답 오류: ${response.status}\n${responseText.substring(0, 100)}`);
        return;
      }

      if (data.success) {
        setQrImage(data.qr_image);
        setBarcodeImage(data.barcode_image);
        setTimeLeft(data.expires_in || 300);
        setQrTimestamp(data.timestamp);
        setPaymentStatus('idle'); // QR 생성 직후는 idle 상태
        stopPaymentPolling(); // 이전 polling 정리
        startPaymentPolling(data.timestamp);
      } else {
        Alert.alert('오류', `QR 코드 생성 실패: ${data.error || data.message || '알 수 없는 오류'}`);
      }
    } catch (error: any) {
      console.error('Failed to generate code:', error);
      Alert.alert('오류', `QR 코드 생성 중 오류: ${error.message || error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startPaymentPolling = async (timestamp: number) => {
    let scanChecked = false; // QR 스캔 확인 완료 여부

    const checkPayment = async () => {
      try {
        const token = await AuthStorage.getToken();
        if (!token) return;

        // 1단계: QR 스캔 상태 확인 (스캔 확인 전까지만)
        if (!scanChecked) {
          const scanResponse = await fetch(`${BACKEND_URL}/api/qr/scan-status?timestamp=${timestamp}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          const scanData = await scanResponse.json();

          if (scanData.status === 'scanned' || scanData.status === 'processing') {
            // QR이 스캔됨 - 이제 "결제 대기 중..." 표시
            setPaymentStatus('waiting');
            scanChecked = true;
          } else if (scanData.status === 'completed') {
            // 이미 완료됨 (빠른 결제)
            scanChecked = true;
          } else if (scanData.status === 'failed') {
            // 타임아웃 또는 실패
            setPaymentStatus('failed');
            stopPaymentPolling();
            setTimeout(() => {
              setPaymentStatus('idle');
              generateCode(); // QR 재생성
            }, 2000);
            return;
          } else if (scanData.status === 'cancelled') {
            // 관리자가 취소
            setPaymentStatus('cancelled');
            stopPaymentPolling();
            setTimeout(() => {
              setPaymentStatus('idle');
              generateCode(); // QR 재생성
            }, 2000);
            return;
          }
          // 'waiting' 상태면 계속 대기
        }

        // 2단계: 결제 완료 확인 (스캔 확인 후에만)
        if (scanChecked) {
          const response = await fetch(`${BACKEND_URL}/api/payment/recent`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();
          if (data.new_payment) {
            setPaymentResult({
              merchant_name: data.merchant_name,
              final_amount: data.final_amount,
              discount_amount: data.discount_amount,
              benefit_text: data.benefit_text,
            });
            setPaymentStatus('completed');
            stopPaymentPolling();

            Animated.spring(successScaleAnim, {
              toValue: 1,
              useNativeDriver: true,
              friction: 7,
            }).start();

            setTimeout(() => {
              setPaymentStatus('idle');
              setPaymentResult(null);
              successScaleAnim.setValue(0);
              generateCode(); // QR 자동 갱신
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Failed to check payment:', error);
      }
    };

    checkPayment();
    pollingRef.current = setInterval(checkPayment, 2000);
  };

  const stopPaymentPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    fetchUserCards();
  }, []);

  useEffect(() => {
    if (userCards.length > 0) {
      generateCode();
    }
  }, [userCards, selectedCardIndex]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          generateCode();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      stopPaymentPolling();
    };
  }, [userCards, selectedCardIndex]);

  useEffect(() => {
    if (cardScaleAnims.current.length > 0) {
      cardScaleAnims.current.forEach((anim, index) => {
        Animated.spring(anim, {
          toValue: index === selectedCardIndex ? 1.1 : 1,
          useNativeDriver: true,
          friction: 7,
        }).start();
      });
    }
  }, [selectedCardIndex]);

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / (CARD_WIDTH + CARD_SPACING));
    if (index >= 0 && index < userCards.length && index !== selectedCardIndex) {
      setSelectedCardIndex(index);
    }
  };

  const handleCardPress = (index: number) => {
    setSelectedCardIndex(index);
    cardListRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.5,
    });
  };

  const handleRefresh = () => {
    generateCode();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const cardDetails = userCards.map((card) => {
    let benefits: string[] = [];
    if (card.card_benefit) {
      const lines = card.card_benefit.split(/[/\n]/).map(line => line.trim()).filter(line => line.length > 0);
      benefits = lines.slice(0, 3).map(line => {
        return line.length > 50 ? line.substring(0, 50) + '...' : line;
      });
    }

    return {
      cid: card.cid,
      name: card.card_name,
      image: CARD_IMAGES[card.card_name],
      discounts: benefits,
      benefitLimit: {
        used: card.used_amount || 0,
        total: card.monthly_limit || 300000,
      },
      performance: {
        current: card.monthly_performance || 0,
        required: card.card_pre_month_money || 0,
      },
    };
  });

  const selectedCard = cardDetails.length > 0 ? cardDetails[selectedCardIndex] : null;
  const benefitPercent = selectedCard ? (selectedCard.benefitLimit.used / selectedCard.benefitLimit.total) * 100 : 0;
  const performancePercent = selectedCard ? (selectedCard.performance.current / selectedCard.performance.required) * 100 : 0;

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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BackIcon width={10} height={16} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>One Pay</Text>
        <View style={{ width: 10 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      {/* Toggle Buttons */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            displayMode === 'barcode' && styles.toggleButtonActive,
          ]}
          onPress={() => setDisplayMode('barcode')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.toggleText,
              displayMode === 'barcode' && styles.toggleTextActive,
            ]}
          >
            바코드
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            displayMode === 'qr' && styles.toggleButtonActive,
          ]}
          onPress={() => setDisplayMode('qr')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.toggleText,
              displayMode === 'qr' && styles.toggleTextActive,
            ]}
          >
            QR코드
          </Text>
        </TouchableOpacity>
      </View>

      {/* Barcode/QR Display */}
      <View style={styles.codeDisplayContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>코드 생성 중...</Text>
          </View>
        ) : displayMode === 'barcode' ? (
          <View style={styles.barcodeContainer}>
            {barcodeImage ? (
              <Image
                source={{ uri: barcodeImage }}
                style={styles.barcodeImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.noCodeText}>바코드를 생성할 수 없습니다</Text>
            )}
          </View>
        ) : (
          <View style={styles.qrContainer}>
            {qrImage ? (
              <Image
                source={{ uri: qrImage }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.noCodeText}>QR 코드를 생성할 수 없습니다</Text>
            )}
          </View>
        )}
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
          <TouchableOpacity onPress={handleRefresh} activeOpacity={0.7}>
            <RefreshIcon width={20} height={20} color="#C23E38" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Selected Card Info */}
      {selectedCard && (
        <View style={styles.cardInfoContainer}>
          <View style={styles.cardHeader}>
            {selectedCard.image ? (
              <Image source={selectedCard.image} style={styles.selectedCardImage} />
            ) : (
              <CardPlaceholder
                cardName={selectedCard.name}
                benefit={selectedCard.discounts[0] || ''}
                width={100}
                height={62}
              />
            )}
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardName}>{selectedCard.name}</Text>
              <View style={styles.discountList}>
                {selectedCard.discounts.map((discount, index) => (
                  <Text key={index} style={styles.discountItem}>
                    {discount}
                  </Text>
                ))}
              </View>
            </View>
          </View>

          {/* Benefit Limit Progress */}
          <View style={styles.progressItem}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>혜택한도</Text>
              <Text style={styles.progressValue}>
                {selectedCard.benefitLimit.used.toLocaleString()}원 /{' '}
                {selectedCard.benefitLimit.total.toLocaleString()}원
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
            <Text style={styles.progressSubtext}>
              실적 / 혜택한도
            </Text>
          </View>

          {/* Performance Progress */}
          <View style={styles.progressItem}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>실적</Text>
              <Text style={styles.progressValue}>
                {selectedCard.performance.current.toLocaleString()}원 /{' '}
                {selectedCard.performance.required.toLocaleString()}원
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
      )}

      {/* Card Selection Scroll */}
      <View style={styles.cardSelectionSection}>
        <View style={styles.cardScrollContainer}>
          <FlatList
            ref={cardListRef}
            data={cardDetails}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.name}
            contentContainerStyle={styles.cardList}
            snapToInterval={CARD_WIDTH + CARD_SPACING}
            decelerationRate="fast"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            getItemLayout={(data, index) => ({
              length: CARD_WIDTH + CARD_SPACING,
              offset: (CARD_WIDTH + CARD_SPACING) * index,
              index,
            })}
            renderItem={({ item, index }) => (
              <Animated.View
                style={{
                  transform: [{ scale: cardScaleAnims.current[index] || new Animated.Value(1) }],
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.cardItem,
                    index === selectedCardIndex && styles.cardItemSelected,
                  ]}
                  onPress={() => handleCardPress(index)}
                  activeOpacity={0.8}
                >
                  {item.image ? (
                    <Image source={item.image} style={styles.cardThumbnail} />
                  ) : (
                    <CardPlaceholder
                      cardName={item.name}
                      benefit={item.discounts[0] || ''}
                      width={100}
                      height={62}
                    />
                  )}
                  <Text
                    style={[
                      styles.cardItemName,
                      index === selectedCardIndex && styles.cardItemNameSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          />
        </View>
      </View>
      </ScrollView>

      {/* Payment Waiting Overlay */}
      {paymentStatus === 'waiting' && (
        <View style={styles.overlayContainer}>
          <View style={styles.overlayContent}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.overlayTitle}>결제 대기 중</Text>
            <Text style={styles.overlaySubtitle}>가맹점에서 QR 코드를 스캔해주세요</Text>
          </View>
        </View>
      )}

      {/* Payment Success Overlay */}
      {paymentStatus === 'completed' && paymentResult && (
        <View style={styles.overlayContainer}>
          <View style={styles.overlayContent}>
            <Animated.View style={{ transform: [{ scale: successScaleAnim }] }}>
              <View style={styles.successIconContainer}>
                <Text style={styles.successIcon}>✓</Text>
              </View>
            </Animated.View>
            <Text style={styles.successTitle}>결제 완료</Text>
            <Text style={styles.successSubtitle}>{paymentResult.merchant_name}</Text>
            <View style={styles.amountContainer}>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>할인 금액</Text>
                <Text style={styles.discountAmount}>
                  -{paymentResult.discount_amount.toLocaleString()}원
                </Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>최종 결제</Text>
                <Text style={styles.finalAmount}>
                  {paymentResult.final_amount.toLocaleString()}원
                </Text>
              </View>
            </View>
            <Text style={styles.benefitText}>{paymentResult.benefit_text}</Text>
          </View>
        </View>
      )}

      {/* Payment Failed Overlay */}
      {paymentStatus === 'failed' && (
        <View style={styles.overlayContainer}>
          <View style={styles.overlayContent}>
            <View style={styles.failedIconContainer}>
              <Text style={styles.failedIcon}>✕</Text>
            </View>
            <Text style={styles.failedTitle}>결제 실패</Text>
            <Text style={styles.overlaySubtitle}>시간 초과 또는 오류가 발생했습니다</Text>
          </View>
        </View>
      )}

      {/* Payment Cancelled Overlay */}
      {paymentStatus === 'cancelled' && (
        <View style={styles.overlayContainer}>
          <View style={styles.overlayContent}>
            <View style={styles.failedIconContainer}>
              <Text style={styles.failedIcon}>✕</Text>
            </View>
            <Text style={styles.failedTitle}>결제 취소</Text>
            <Text style={styles.overlaySubtitle}>가맹점에서 결제를 취소했습니다</Text>
          </View>
        </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#212121',
  },
  toggleText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#999999',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  codeDisplayContainer: {
    marginHorizontal: 20,
    marginBottom: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    minHeight: 250,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  noCodeText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
    textAlign: 'center',
  },
  barcodeContainer: {
    alignItems: 'center',
    width: '100%',
  },
  barcodeImage: {
    width: SCREEN_WIDTH - 60,
    height: 140,
    marginBottom: 12,
  },
  codeNumber: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#C23E38',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    alignSelf: 'flex-end',
  },
  timerText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#C23E38',
  },
  cardInfoContainer: {
    marginHorizontal: 20,
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
  },
  selectedCardImage: {
    width: 100,
    height: 75,
    borderRadius: 8,
    marginRight: 15,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 10,
  },
  discountList: {
    gap: 4,
  },
  discountItem: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
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
  progressSubtext: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#999999',
    textAlign: 'right',
  },
  cardSelectionSection: {
    paddingTop: 10,
    paddingBottom: 30,
    overflow: 'visible',
  },
  cardScrollContainer: {
    height: 200,
    overflow: 'visible',
  },
  cardList: {
    paddingHorizontal: (SCREEN_WIDTH - CARD_WIDTH) / 2,
    alignItems: 'center',
  },
  cardItem: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F8F8F8',
  },
  cardItemSelected: {
    backgroundColor: '#212121',
  },
  cardThumbnail: {
    width: 100,
    height: 62,
    borderRadius: 8,
    marginBottom: 12,
  },
  cardItemName: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    marginTop: 10,
    color: '#666666',
    textAlign: 'center',
  },
  cardItemNameSelected: {
    color: '#FFFFFF',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    width: SCREEN_WIDTH - 80,
    maxWidth: 320,
  },
  overlayTitle: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginTop: 24,
    marginBottom: 8,
  },
  overlaySubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
    textAlign: 'center',
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 48,
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginTop: 24,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginBottom: 24,
  },
  amountContainer: {
    width: '100%',
    backgroundColor: '#F5F8FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  discountAmount: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#2563EB',
  },
  finalAmount: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  benefitText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#999999',
    textAlign: 'center',
  },
  failedIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failedIcon: {
    fontSize: 48,
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
  },
  failedTitle: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginTop: 24,
    marginBottom: 8,
  },
});
