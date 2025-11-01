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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BackIcon, RefreshIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import { USER_CARDS, CARD_IMAGES } from '../constants/userCards';

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
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes in seconds
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const cardListRef = useRef<FlatList>(null);
  const cardScaleAnims = useRef(
    USER_CARDS.map(() => new Animated.Value(1))
  ).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    // Start timer
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 180; // Reset to 3 minutes
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Animate cards based on selected index
    cardScaleAnims.forEach((anim, index) => {
      Animated.spring(anim, {
        toValue: index === selectedCardIndex ? 1.1 : 1,
        useNativeDriver: true,
        friction: 7,
      }).start();
    });
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
    if (index >= 0 && index < USER_CARDS.length && index !== selectedCardIndex) {
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
    setTimeLeft(180); // Reset to 3 minutes
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Mock card details
  const cardDetails = USER_CARDS.map((cardName) => ({
    name: cardName,
    image: CARD_IMAGES[cardName],
    discounts: [
      '편의점 10% 할인',
      '카페 20% 할인',
      '주유 리터당 100원 할인',
    ],
    benefitLimit: {
      used: 150000,
      total: 300000,
    },
    performance: {
      current: 450000,
      required: 500000,
    },
  }));

  const selectedCard = cardDetails[selectedCardIndex];
  const benefitPercent = (selectedCard.benefitLimit.used / selectedCard.benefitLimit.total) * 100;
  const performancePercent = (selectedCard.performance.current / selectedCard.performance.required) * 100;

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
        {displayMode === 'barcode' ? (
          <View style={styles.barcodeContainer}>
            <Image
              source={require('../../assets/images/sample-bar-code.png')}
              style={styles.barcodeImage}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={styles.qrContainer}>
            <Image
              source={require('../../assets/images/sample-qr-code.png')}
              style={styles.qrImage}
              resizeMode="contain"
            />
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
      <View style={styles.cardInfoContainer}>
        <View style={styles.cardHeader}>
          <Image source={selectedCard.image} style={styles.selectedCardImage} />
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
                  transform: [{ scale: cardScaleAnims[index] }],
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
                  <Image source={item.image} style={styles.cardThumbnail} />
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
  },
  selectedCardImage: {
    width: 110,
    height: 70,
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
    color: '#666666',
    textAlign: 'center',
  },
  cardItemNameSelected: {
    color: '#FFFFFF',
  },
});
