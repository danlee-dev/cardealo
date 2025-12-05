import React, { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  Platform,
  InteractionManager,
} from 'react-native';
import { FONTS, COLORS } from '../constants/theme';

// Android-specific constants
const IS_ANDROID = Platform.OS === 'android';
const TYPEWRITER_INTERVAL = IS_ANDROID ? 50 : 35; // Slower on Android to reduce renders
const CARD_TRANSITION_DURATION = IS_ANDROID ? 400 : 450;
const DOT_ANIMATION_DURATION = IS_ANDROID ? 200 : 250;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const CARD_HEIGHT = 140;

interface LoadingCard {
  id: number;
  title: string;
  subtitle: string;
  iconType: 'search' | 'card' | 'route' | 'optimize';
  bgColor: string;
}

const LOADING_CARDS: LoadingCard[] = [
  {
    id: 1,
    title: '최적의 장소 찾는 중',
    subtitle: '회원님의 취향에 맞는 장소를 검색하고 있어요',
    iconType: 'search',
    bgColor: '#393A39',
  },
  {
    id: 2,
    title: '카드 혜택 분석 중',
    subtitle: '등록된 카드로 받을 수 있는 혜택을 계산해요',
    iconType: 'card',
    bgColor: '#555555',
  },
  {
    id: 3,
    title: '최적 경로 계산 중',
    subtitle: '가장 효율적인 이동 경로를 찾고 있어요',
    iconType: 'route',
    bgColor: '#444444',
  },
  {
    id: 4,
    title: '코스 최적화 중',
    subtitle: '예산과 시간을 고려해 코스를 구성해요',
    iconType: 'optimize',
    bgColor: '#4A4A4A',
  },
];

const STATUS_MESSAGES = [
  '주변 장소 데이터 수집 중...',
  '카테고리별 장소 필터링 중...',
  '사용자 선호도 분석 중...',
  '카드 혜택 매칭 중...',
  '할인율 계산 중...',
  '최적 경로 탐색 중...',
  '이동 시간 계산 중...',
  '코스 조합 생성 중...',
  '최종 추천 코스 선정 중...',
];

// Memoized icon components to prevent unnecessary re-renders on Android
const SearchIconSimple = memo(() => (
  <View style={iconStyles.container}>
    <View style={iconStyles.searchCircle} />
    <View style={iconStyles.searchHandle} />
  </View>
));

const CardIconSimple = memo(() => (
  <View style={iconStyles.container}>
    <View style={iconStyles.cardShape}>
      <View style={iconStyles.cardChip} />
      <View style={iconStyles.cardLine} />
    </View>
  </View>
));

const RouteIconSimple = memo(() => (
  <View style={iconStyles.container}>
    <View style={iconStyles.routeDot} />
    <View style={iconStyles.routeLine} />
    <View style={iconStyles.routeDot} />
    <View style={iconStyles.routeLine} />
    <View style={iconStyles.routeDot} />
  </View>
));

const OptimizeIconSimple = memo(() => (
  <View style={iconStyles.container}>
    <View style={iconStyles.optimizeOuter}>
      <View style={iconStyles.optimizeInner} />
    </View>
  </View>
));

const iconStyles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  searchHandle: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    width: 8,
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    transform: [{ rotate: '45deg' }],
  },
  cardShape: {
    width: 32,
    height: 22,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    padding: 4,
  },
  cardChip: {
    width: 8,
    height: 6,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  cardLine: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 1,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  routeLine: {
    width: 2,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  optimizeOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optimizeInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});

// Pre-create icon elements to avoid recreation on each render
const ICON_ELEMENTS = {
  search: <SearchIconSimple />,
  card: <CardIconSimple />,
  route: <RouteIconSimple />,
  optimize: <OptimizeIconSimple />,
};

const getIcon = (type: LoadingCard['iconType']) => ICON_ELEMENTS[type];

interface Props {
  visible: boolean;
}

const CourseLoadingViewComponent: React.FC<Props> = ({ visible }) => {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');

  // Animations
  const cardTranslateX = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const nextCardTranslateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const nextCardScale = useRef(new Animated.Value(0.85)).current;
  const nextCardOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Card transition animation
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      // On Android, reduce concurrent animations for smoother performance
      const fadeOutDuration = IS_ANDROID ? 300 : 350;

      Animated.parallel([
        Animated.timing(cardTranslateX, {
          toValue: -SCREEN_WIDTH,
          duration: CARD_TRANSITION_DURATION,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 0.85,
          duration: CARD_TRANSITION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: fadeOutDuration,
          useNativeDriver: true,
        }),
        Animated.timing(nextCardTranslateX, {
          toValue: 0,
          duration: CARD_TRANSITION_DURATION,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(nextCardScale, {
          toValue: 1,
          duration: CARD_TRANSITION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(nextCardOpacity, {
          toValue: 1,
          duration: fadeOutDuration,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Use InteractionManager on Android to ensure smooth state update
        if (IS_ANDROID) {
          InteractionManager.runAfterInteractions(() => {
            setCurrentCardIndex((prev) => (prev + 1) % LOADING_CARDS.length);
            cardTranslateX.setValue(0);
            cardScale.setValue(1);
            cardOpacity.setValue(1);
            nextCardTranslateX.setValue(SCREEN_WIDTH);
            nextCardScale.setValue(0.85);
            nextCardOpacity.setValue(0);
          });
        } else {
          setCurrentCardIndex((prev) => (prev + 1) % LOADING_CARDS.length);
          cardTranslateX.setValue(0);
          cardScale.setValue(1);
          cardOpacity.setValue(1);
          nextCardTranslateX.setValue(SCREEN_WIDTH);
          nextCardScale.setValue(0.85);
          nextCardOpacity.setValue(0);
        }
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [visible]);

  // Status text streaming effect
  useEffect(() => {
    if (!visible) return;

    const statusInterval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
      setDisplayedText('');
    }, 2200);

    return () => clearInterval(statusInterval);
  }, [visible]);

  // Typewriter effect - optimized for Android
  useEffect(() => {
    if (!visible) return;

    const targetText = STATUS_MESSAGES[statusIndex];
    let charIndex = 0;
    let isCancelled = false;

    // On Android, use requestAnimationFrame-like batching for smoother updates
    const typeNextChar = () => {
      if (isCancelled) return;

      if (charIndex <= targetText.length) {
        setDisplayedText(targetText.substring(0, charIndex));
        charIndex++;
        setTimeout(typeNextChar, TYPEWRITER_INTERVAL);
      }
    };

    // Delay start slightly on Android to let other animations settle
    const startDelay = IS_ANDROID ? 50 : 0;
    const startTimeout = setTimeout(typeNextChar, startDelay);

    return () => {
      isCancelled = true;
      clearTimeout(startTimeout);
    };
  }, [statusIndex, visible]);

  // Dot animation - reduced complexity on Android
  useEffect(() => {
    if (!visible) return;

    const dotDelay = IS_ANDROID ? 100 : 120;

    const animateDots = () => {
      const animations = dotAnims.map((anim, index) =>
        Animated.sequence([
          Animated.delay(index * dotDelay),
          Animated.timing(anim, {
            toValue: 1,
            duration: DOT_ANIMATION_DURATION,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: DOT_ANIMATION_DURATION,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
        ])
      );

      Animated.loop(Animated.stagger(dotDelay, animations)).start();
    };

    animateDots();
  }, [visible]);

  // Pulse animation for icon - reduced on Android
  useEffect(() => {
    if (!visible) return;

    const pulseScale = IS_ANDROID ? 1.05 : 1.08;
    const pulseDuration = IS_ANDROID ? 900 : 800;

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: pulseScale,
          duration: pulseDuration,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: pulseDuration,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [visible]);

  // Shimmer animation - slower on Android
  useEffect(() => {
    if (!visible) return;

    const shimmerDuration = IS_ANDROID ? 1500 : 1200;

    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: shimmerDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [visible]);

  // Progress bar animation - uses translateX instead of width for native driver support
  useEffect(() => {
    if (!visible) return;

    // On Android, use native driver by animating translateX instead of width
    Animated.loop(
      Animated.sequence([
        Animated.timing(progressWidth, {
          toValue: 1,
          duration: IS_ANDROID ? 1600 : 1800,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(progressWidth, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [visible]);

  // Cleanup all animations when visibility changes or component unmounts
  useEffect(() => {
    if (!visible) {
      // Stop all animations when not visible
      cardTranslateX.stopAnimation();
      cardScale.stopAnimation();
      cardOpacity.stopAnimation();
      nextCardTranslateX.stopAnimation();
      nextCardScale.stopAnimation();
      nextCardOpacity.stopAnimation();
      progressWidth.stopAnimation();
      pulseAnim.stopAnimation();
      shimmerAnim.stopAnimation();
      dotAnims.forEach(anim => anim.stopAnimation());

      // Reset states
      setCurrentCardIndex(0);
      setStatusIndex(0);
      setDisplayedText('');
    }
  }, [visible]);

  // Memoize card data to prevent unnecessary recalculations
  const currentCard = useMemo(() => LOADING_CARDS[currentCardIndex], [currentCardIndex]);
  const nextCard = useMemo(() => LOADING_CARDS[(currentCardIndex + 1) % LOADING_CARDS.length], [currentCardIndex]);

  if (!visible) return null;

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-CARD_WIDTH, CARD_WIDTH],
  });

  return (
    <View style={styles.container}>
      {/* Card Carousel */}
      <View style={styles.carouselContainer}>
        {/* Current Card */}
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              transform: [
                { translateX: cardTranslateX },
                { scale: cardScale },
              ],
              opacity: cardOpacity,
            },
          ]}
        >
          <View style={[styles.card, { backgroundColor: currentCard.bgColor }]}>
            {/* Shimmer effect */}
            <Animated.View
              style={[
                styles.shimmer,
                { transform: [{ translateX: shimmerTranslate }] },
              ]}
            />

            <View style={styles.cardContent}>
              <Animated.View
                style={[
                  styles.iconWrapper,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                {getIcon(currentCard.iconType)}
              </Animated.View>
              <Text style={styles.cardTitle}>{currentCard.title}</Text>
              <Text style={styles.cardSubtitle}>{currentCard.subtitle}</Text>
            </View>

            {/* Progress bar - uses translateX for native driver support */}
            <View style={styles.cardProgress}>
              <Animated.View
                style={[
                  styles.cardProgressFill,
                  {
                    transform: [
                      {
                        translateX: progressWidth.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-CARD_WIDTH, 0],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
          </View>
        </Animated.View>

        {/* Next Card */}
        <Animated.View
          style={[
            styles.cardWrapper,
            styles.nextCard,
            {
              transform: [
                { translateX: nextCardTranslateX },
                { scale: nextCardScale },
              ],
              opacity: nextCardOpacity,
            },
          ]}
        >
          <View style={[styles.card, { backgroundColor: nextCard.bgColor }]}>
            <View style={styles.cardContent}>
              <View style={styles.iconWrapper}>
                {getIcon(nextCard.iconType)}
              </View>
              <Text style={styles.cardTitle}>{nextCard.title}</Text>
              <Text style={styles.cardSubtitle}>{nextCard.subtitle}</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Card indicators */}
      <View style={styles.indicators}>
        {LOADING_CARDS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              currentCardIndex === index && styles.indicatorActive,
            ]}
          />
        ))}
      </View>

      {/* Status section */}
      <View style={styles.statusContainer}>
        <View style={styles.dotsContainer}>
          {dotAnims.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -6],
                      }),
                    },
                  ],
                  opacity: anim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 1, 0.3],
                  }),
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.statusTextContainer}>
          <Text style={styles.statusText}>{displayedText}</Text>
          <Animated.Text
            style={[
              styles.cursor,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 0, 1],
                }),
              },
            ]}
          >
            |
          </Animated.Text>
        </View>
      </View>

      {/* Bottom hint */}
      <Text style={styles.hintText}>
        AI가 최적의 코스를 찾고 있어요
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  carouselContainer: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT + 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardWrapper: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  nextCard: {
    zIndex: -1,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 24,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: [{ skewX: '-20deg' }],
  },
  cardContent: {
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 17,
  },
  cardProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  cardProgressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  indicators: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  indicatorActive: {
    backgroundColor: COLORS.primary,
    width: 20,
  },
  statusContainer: {
    marginTop: 28,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.primary,
  },
  statusTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 18,
  },
  statusText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  cursor: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    marginLeft: 1,
  },
  hintText: {
    marginTop: 20,
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
});

// Memoize the entire component to prevent unnecessary re-renders
export const CourseLoadingView = memo(CourseLoadingViewComponent);
export default CourseLoadingView;
