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
import { BackIcon, RefreshIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import { CARD_IMAGES } from '../constants/userCards';
import { AuthStorage } from '../utils/auth';
import { CardPlaceholder } from '../components/CardPlaceholder';
import { API_URL } from '../utils/api';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_INFO_WIDTH = SCREEN_WIDTH - 56; // Card width with spacing
const CARD_INFO_SPACING = 12; // Spacing between cards
const CARD_INFO_TOTAL_WIDTH = CARD_INFO_WIDTH + CARD_INFO_SPACING; // Total width including spacing
const ROULETTE_MULTIPLIER = 10; // How many times to repeat cards for infinite scroll effect

interface OnePayScreenProps {
  onBack: () => void;
  selectedStore?: {
    name: string;
    category: string;
  } | null;
  preSelectedCardId?: number | string | null;
}

export const OnePayScreen: React.FC<OnePayScreenProps> = ({ onBack, selectedStore, preSelectedCardId }) => {
  const [displayMode, setDisplayMode] = useState<'barcode' | 'qr'>('barcode');
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const toggleSlideAnim = useRef(new Animated.Value(0)).current;
  const timerPulseAnim = useRef(new Animated.Value(1)).current;

  // Roulette animation states
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleComplete, setShuffleComplete] = useState(!preSelectedCardId);
  const [userCards, setUserCards] = useState<Array<{
    cid: number | string;
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
    is_corporate?: boolean;
    card_company?: string;
    department?: string;
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
  const carouselRef = useRef<FlatList>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const successScaleAnim = useRef(new Animated.Value(0)).current;

  // Roulette scroll animation
  const scrollAnimValue = useRef(new Animated.Value(0)).current;
  const rouletteStarted = useRef(false);

  const fetchUserCards = async () => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/mypage`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('User cards data:', data);
      if (data.success && data.user) {
        const personalCards = data.user.cards || [];

        // Normalize corporate cards to match personal card structure
        const corporateCards = (data.user.corporate_cards || []).map((corp: any) => ({
          cid: corp.cid,
          card_name: corp.card_name,
          card_benefit: corp.card_benefit || '',
          card_pre_month_money: 0,
          card_pre_YN: true,
          monthly_limit: corp.monthly_limit || 0,
          used_amount: corp.used_amount || 0,
          monthly_performance: 0,
          is_corporate: true,
          card_company: corp.card_company,
          department: corp.department,
        }));

        // Combine personal and corporate cards
        const allCards = [...personalCards, ...corporateCards];
        console.log('All cards (personal + corporate):', allCards);
        setUserCards(allCards);
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
      console.log('Backend URL:', API_URL);

      const response = await fetch(`${API_URL}/api/qr/generate`, {
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
        setPaymentStatus('idle');
        stopPaymentPolling();
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
    let scanChecked = false;

    const checkPayment = async () => {
      try {
        const token = await AuthStorage.getToken();
        if (!token) return;

        // Always check scan status for failed/cancelled
        const scanResponse = await fetch(`${API_URL}/api/qr/scan-status?timestamp=${timestamp}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const scanData = await scanResponse.json();

        // Check for failed/cancelled first (can happen at any time)
        if (scanData.status === 'failed') {
          setPaymentStatus('failed');
          stopPaymentPolling();
          setTimeout(() => {
            setPaymentStatus('idle');
            generateCode();
          }, 2000);
          return;
        } else if (scanData.status === 'cancelled') {
          setPaymentStatus('cancelled');
          stopPaymentPolling();
          setTimeout(() => {
            setPaymentStatus('idle');
            generateCode();
          }, 2000);
          return;
        }

        // Update scan checked status
        if (!scanChecked) {
          if (scanData.status === 'scanned' || scanData.status === 'processing') {
            setPaymentStatus('waiting');
            scanChecked = true;
          } else if (scanData.status === 'completed') {
            scanChecked = true;
          }
        }

        if (scanChecked) {
          const response = await fetch(`${API_URL}/api/payment/recent`, {
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
              generateCode();
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
    if (userCards.length > 0 && shuffleComplete) {
      generateCode();
    }
  }, [userCards, selectedCardIndex, shuffleComplete]);

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

    // Timer pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(timerPulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(timerPulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      pulseAnimation.stop();
      stopPaymentPolling();
    };
  }, [userCards, selectedCardIndex]);

  // Infinite right-scroll roulette animation when preSelectedCardId is provided
  useEffect(() => {
    if (preSelectedCardId && userCards.length > 0 && !shuffleComplete && !rouletteStarted.current) {
      const targetIndex = userCards.findIndex(card => card.cid === preSelectedCardId);
      if (targetIndex === -1) {
        setShuffleComplete(true);
        return;
      }

      rouletteStarted.current = true;
      setIsShuffling(true);

      const totalCards = userCards.length;
      const cardWidth = CARD_INFO_TOTAL_WIDTH;

      // For infinite right scroll effect:
      // We repeat cards ROULETTE_MULTIPLIER times
      // Start from the beginning, scroll through several full rotations to the right
      // End at the target card position (in the middle set of repeated cards)

      const fullRotations = Math.floor(ROULETTE_MULTIPLIER / 2); // How many full rotations
      const targetPositionInMiddle = (fullRotations * totalCards + targetIndex) * cardWidth;

      // Reset scroll position
      scrollAnimValue.setValue(0);

      // Small delay to ensure FlatList is ready
      setTimeout(() => {
        // Listen to animation value changes and update scroll position
        const listenerId = scrollAnimValue.addListener(({ value }) => {
          carouselRef.current?.scrollToOffset({
            offset: value,
            animated: false,
          });
        });

        // Animate with easing - starts fast, ends slow (like a real roulette spinning right)
        Animated.timing(scrollAnimValue, {
          toValue: targetPositionInMiddle,
          duration: 3000,
          useNativeDriver: false,
          easing: (t) => {
            // Custom easing: fast start, very slow end (cubic ease-out)
            return 1 - Math.pow(1 - t, 3);
          },
        }).start(() => {
          scrollAnimValue.removeListener(listenerId);
          setIsShuffling(false);
          setShuffleComplete(true);
          setSelectedCardIndex(targetIndex);

          // Scroll to the actual position in the middle set for clean state
          setTimeout(() => {
            const middleSetStartIndex = fullRotations * totalCards;
            carouselRef.current?.scrollToOffset({
              offset: (middleSetStartIndex + targetIndex) * cardWidth,
              animated: false,
            });
          }, 50);
        });
      }, 100);
    }
  }, [preSelectedCardId, userCards, shuffleComplete]);

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  const handleCarouselScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isShuffling) return;

    const scrollPosition = event.nativeEvent.contentOffset.x;
    const cardWidth = CARD_INFO_TOTAL_WIDTH;
    const totalCards = userCards.length;

    // Calculate which card is closest to center
    const rawIndex = Math.round(scrollPosition / cardWidth);
    const index = rawIndex % totalCards;

    if (index >= 0 && index < totalCards && index !== selectedCardIndex) {
      setSelectedCardIndex(index);
    }
  };

  const handleCardPress = (index: number) => {
    if (isShuffling) return;

    const actualIndex = index % userCards.length;
    setSelectedCardIndex(actualIndex);

    const cardWidth = CARD_INFO_TOTAL_WIDTH;
    carouselRef.current?.scrollToOffset({
      offset: index * cardWidth,
      animated: true,
    });
  };

  const handleRefresh = () => {
    generateCode();
  };

  const handleToggleMode = (mode: 'barcode' | 'qr') => {
    if (mode === displayMode) return;
    setDisplayMode(mode);
    Animated.spring(toggleSlideAnim, {
      toValue: mode === 'barcode' ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
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
      is_corporate: card.is_corporate || false,
    };
  });

  // Create repeated cards for infinite scroll effect
  const repeatedCards: Array<{
    cid: number | string;
    name: string;
    image: any;
    discounts: string[];
    benefitLimit: { used: number; total: number };
    performance: { current: number; required: number };
    uniqueKey: string;
    originalIndex: number;
    is_corporate?: boolean;
  }> = [];
  for (let i = 0; i < ROULETTE_MULTIPLIER; i++) {
    cardDetails.forEach((card, index) => {
      repeatedCards.push({
        ...card,
        uniqueKey: `${i}-${index}`,
        originalIndex: index,
      });
    });
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
          <View style={styles.toggleTrack}>
            <Animated.View
              style={[
                styles.toggleIndicator,
                {
                  transform: [{
                    translateX: toggleSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [2, (SCREEN_WIDTH - 48) / 2],
                    })
                  }]
                }
              ]}
            />
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => handleToggleMode('barcode')}
              activeOpacity={1}
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
              style={styles.toggleButton}
              onPress={() => handleToggleMode('qr')}
              activeOpacity={1}
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
        </View>

        {/* Barcode/QR Display */}
        <View style={styles.codeDisplayContainer}>
          <View style={styles.codeDisplayInner}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#212121" />
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
          </View>
          <View style={styles.timerSection}>
            <View style={styles.timerBadge}>
              <Animated.View style={[styles.timerDot, { opacity: timerPulseAnim }]} />
              <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              activeOpacity={0.7}
            >
              <RefreshIcon width={16} height={16} color="#666666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Card Info Carousel */}
        {cardDetails.length > 0 && (
          <View style={styles.cardInfoCarouselSection}>
            <FlatList
              ref={carouselRef}
              data={repeatedCards}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.uniqueKey}
              contentContainerStyle={styles.cardInfoCarouselContent}
              snapToInterval={CARD_INFO_TOTAL_WIDTH}
              decelerationRate="fast"
              onScroll={handleCarouselScroll}
              scrollEventThrottle={16}
              scrollEnabled={!isShuffling}
              pagingEnabled={false}
              getItemLayout={(_data, index) => ({
                length: CARD_INFO_TOTAL_WIDTH,
                offset: CARD_INFO_TOTAL_WIDTH * index,
                index,
              })}
              initialScrollIndex={Math.floor(ROULETTE_MULTIPLIER / 2) * cardDetails.length}
              onScrollToIndexFailed={() => {}}
              renderItem={({ item, index }) => {
                const cardBenefitPercent = (item.benefitLimit.used / item.benefitLimit.total) * 100;
                const cardPerformancePercent = (item.performance.current / item.performance.required) * 100;

                return (
                  <TouchableOpacity
                    style={styles.cardInfoCard}
                    onPress={() => handleCardPress(index)}
                    activeOpacity={0.95}
                    disabled={isShuffling}
                  >
                    <View style={styles.cardInfoHeader}>
                      <Text style={styles.cardInfoTitle}>카드 정보</Text>
                    </View>

                    <View style={styles.cardHeader}>
                      <View style={styles.cardImageWrapper}>
                        {item.image ? (
                          <Image source={item.image} style={styles.selectedCardImage} />
                        ) : (
                          <CardPlaceholder
                            cardName={item.name}
                            benefit={item.discounts[0] || ''}
                            width={80}
                            height={50}
                          />
                        )}
                      </View>
                      <View style={styles.cardHeaderText}>
                        <View style={styles.cardNameRow}>
                          <Text style={styles.cardName}>{item.name}</Text>
                          {item.is_corporate && (
                            <View style={styles.corporateBadge}>
                              <Text style={styles.corporateBadgeText}>법인</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.discountList}>
                          {item.discounts.slice(0, 2).map((discount: string, idx: number) => (
                            <View key={idx} style={styles.discountItemWrapper}>
                              <View style={styles.discountDot} />
                              <Text style={styles.discountItem} numberOfLines={1} ellipsizeMode="tail">{discount}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>

                    <View style={styles.progressSection}>
                      {/* Benefit Limit Progress */}
                      <View style={styles.progressItem}>
                        <View style={styles.progressHeader}>
                          <Text style={styles.progressLabel}>혜택한도</Text>
                          <Text style={styles.progressValue}>
                            <Text style={styles.progressValueHighlight}>
                              {(item.benefitLimit.total - item.benefitLimit.used).toLocaleString()}
                            </Text>
                            <Text style={styles.progressValueUnit}>원 남음</Text>
                          </Text>
                        </View>
                        <View style={styles.progressBarContainer}>
                          <View
                            style={[
                              styles.progressBar,
                              styles.progressBarBenefit,
                              { width: `${100 - cardBenefitPercent}%` }
                            ]}
                          />
                        </View>
                        <Text style={styles.progressSubtext}>
                          {item.benefitLimit.used.toLocaleString()} / {item.benefitLimit.total.toLocaleString()}원 사용
                        </Text>
                      </View>

                      {/* Performance Progress */}
                      <View style={styles.progressItem}>
                        <View style={styles.progressHeader}>
                          <Text style={styles.progressLabel}>전월실적</Text>
                          <Text style={styles.progressValue}>
                            <Text style={[
                              styles.progressValueHighlight,
                              cardPerformancePercent >= 100 && styles.progressValueSuccess
                            ]}>
                              {cardPerformancePercent >= 100 ? '달성' : `${Math.round(cardPerformancePercent)}%`}
                            </Text>
                          </Text>
                        </View>
                        <View style={styles.progressBarContainer}>
                          <View
                            style={[
                              styles.progressBar,
                              styles.progressBarPerformance,
                              cardPerformancePercent >= 100 && styles.progressBarSuccess,
                              { width: `${Math.min(cardPerformancePercent, 100)}%` }
                            ]}
                          />
                        </View>
                        <Text style={styles.progressSubtext}>
                          {item.performance.current.toLocaleString()} / {item.performance.required.toLocaleString()}원
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Scroll Indicator */}
            <View style={styles.indicatorContainer}>
              {cardDetails.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    index === selectedCardIndex && styles.indicatorActive,
                  ]}
                />
              ))}
            </View>
          </View>
        )}
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
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: '#212121',
    letterSpacing: -0.3,
  },
  toggleContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  toggleTrack: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 2,
    position: 'relative',
  },
  toggleIndicator: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: '50%',
    backgroundColor: '#212121',
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    zIndex: 1,
  },
  toggleText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#888888',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  codeDisplayContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  codeDisplayInner: {
    alignItems: 'center',
    minHeight: 240,
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#888888',
    letterSpacing: -0.2,
  },
  noCodeText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#AAAAAA',
    textAlign: 'center',
  },
  barcodeContainer: {
    alignItems: 'center',
    width: '100%',
  },
  barcodeImage: {
    width: SCREEN_WIDTH - 72,
    height: 160,
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
  },
  qrImage: {
    width: 180,
    height: 180,
  },
  timerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  timerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  timerText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: '#212121',
    letterSpacing: 0.5,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfoCarouselSection: {
    marginBottom: 12,
  },
  cardInfoCarouselContent: {
    paddingLeft: 20,
    paddingRight: 20 - CARD_INFO_SPACING,
  },
  cardInfoCard: {
    width: CARD_INFO_WIDTH,
    marginRight: CARD_INFO_SPACING,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  indicatorActive: {
    backgroundColor: '#212121',
    width: 24,
  },
  cardInfoHeader: {
    marginBottom: 12,
  },
  cardInfoTitle: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: '#888888',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    overflow: 'hidden',
  },
  cardImageWrapper: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 4,
    marginRight: 12,
  },
  selectedCardImage: {
    width: 80,
    height: 50,
    borderRadius: 4,
  },
  cardHeaderText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  cardName: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: '#212121',
    letterSpacing: -0.3,
  },
  corporateBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  corporateBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  discountList: {
    gap: 4,
    overflow: 'hidden',
  },
  discountItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  discountDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#22C55E',
    flexShrink: 0,
  },
  discountItem: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: '#666666',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  progressSection: {
    paddingTop: 12,
    gap: 10,
  },
  progressItem: {
    gap: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#666666',
  },
  progressValue: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#888888',
  },
  progressValueHighlight: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  progressValueUnit: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  progressValueSuccess: {
    color: '#22C55E',
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressBarBenefit: {
    backgroundColor: '#212121',
  },
  progressBarPerformance: {
    backgroundColor: '#888888',
  },
  progressBarSuccess: {
    backgroundColor: '#22C55E',
  },
  progressSubtext: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: '#AAAAAA',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: SCREEN_WIDTH - 64,
    maxWidth: 340,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  overlayTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginTop: 20,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  overlaySubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 18,
  },
  successIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 36,
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginTop: 20,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
    marginBottom: 20,
  },
  amountContainer: {
    width: '100%',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  discountAmount: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#22C55E',
  },
  finalAmount: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  benefitText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#AAAAAA',
    textAlign: 'center',
    marginTop: 4,
  },
  failedIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failedIcon: {
    fontSize: 36,
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
  },
  failedTitle: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginTop: 20,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
});
