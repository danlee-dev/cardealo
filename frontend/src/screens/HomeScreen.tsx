import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Platform, Alert, TextInput, Keyboard, TouchableWithoutFeedback, Image, StatusBar, FlatList, Animated } from 'react-native';
import { NaverMapView, NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SearchIcon, StarsIcon, CafeIcon, CoffeeIcon, FoodIcon, CartIcon, CardsIcon, LocationMarkerIcon, StorePinIcon, StarIcon, MyLocationIcon } from '../components/svg';
import { FONTS, COLORS } from '../constants/theme';
import * as Location from 'expo-location';
import axios from 'axios';
import { USER_CARDS, API_URL, CARD_IMAGES } from '../constants/userCards';
import { getMerchantLogo } from '../constants/merchantImages';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileScreen } from './ProfileScreen';
import { OnePayScreen } from './OnePayScreen';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CategoryButton {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface StoreCard {
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  distance: number;
  phone?: string;
  building_name?: string;
  top_card?: {
    card: string;
    score: number;
    benefit: string;
  };
}

interface CardRecommendation {
  rank: number;
  card: string;
  score: number;
  discount_rate: number;
  discount_amount: number;
  monthly_limit: number;
  point_rate: number;
  pre_month_money: number;
  benefit_summary: string;
}

export const HomeScreen: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreCard | null>(null);
  const [recommendations, setRecommendations] = useState<CardRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(16);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [favoriteStores, setFavoriteStores] = useState<Set<string>>(new Set());
  const [showProfile, setShowProfile] = useState(false);
  const [showOnePay, setShowOnePay] = useState(false);
  const [isInsideBuilding, setIsInsideBuilding] = useState(false);
  const [filterSort, setFilterSort] = useState<'benefit' | 'distance' | 'recommend'>('recommend');
  const [filterOrder, setFilterOrder] = useState<'asc' | 'desc'>('desc');
  const [filterOpenOnly, setFilterOpenOnly] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<any>(null);
  const cameraChangeTimeout = useRef<NodeJS.Timeout | null>(null);
  const cardScrollRef = useRef<FlatList>(null);
  const isScrollingToCard = useRef(false);
  const snapPoints = useMemo(() => ['25%', '50%', '85%'], []);

  // 카드 애니메이션 값 배열
  const cardScaleAnims = useRef(
    USER_CARDS.map(() => new Animated.Value(1))
  ).current;

  // Progress section 애니메이션 (height 기반)
  const progressHeightAnim = useRef(new Animated.Value(0)).current;

  // 로딩 애니메이션 (점 3개)
  const loadingDot1 = useRef(new Animated.Value(0)).current;
  const loadingDot2 = useRef(new Animated.Value(0)).current;
  const loadingDot3 = useRef(new Animated.Value(0)).current;

  // 혜택 레벨 계산 (상위 20%, 중위, 하위 20%)
  const getBenefitLevel = (score: number, allScores: number[]): 'high' | 'medium' | 'low' => {
    if (allScores.length === 0) return 'medium';

    const sortedScores = [...allScores].sort((a, b) => b - a);
    const topIndex = Math.floor(sortedScores.length * 0.2);
    const bottomIndex = Math.floor(sortedScores.length * 0.8);

    const topThreshold = sortedScores[topIndex];
    const bottomThreshold = sortedScores[bottomIndex];

    if (score >= topThreshold) return 'high';
    if (score <= bottomThreshold) return 'low';
    return 'medium';
  };

  // Sample performance data (실제로는 API에서 받아와야 함)
  const getSamplePerformanceData = (rec: CardRecommendation) => {
    // Sample current performance (60-90% of required)
    const currentPerformance = rec.pre_month_money > 0
      ? Math.floor(rec.pre_month_money * (0.6 + Math.random() * 0.3))
      : 0;

    // Sample used benefit (30-70% of limit)
    const usedBenefit = rec.monthly_limit > 0
      ? Math.floor(rec.monthly_limit * (0.3 + Math.random() * 0.4))
      : 0;

    return {
      currentPerformance,
      requiredPerformance: rec.pre_month_money,
      usedBenefit,
      totalBenefitLimit: rec.monthly_limit,
      remainingBenefit: rec.monthly_limit - usedBenefit,
    };
  };

  const categories: CategoryButton[] = [
    { id: 'favorites', label: '즐겨찾기', icon: <StarsIcon width={16} height={16} color="#333333" /> },
    { id: 'cafe', label: '카페', icon: <CoffeeIcon width={16} height={16} color="#333333" /> },
    { id: 'restaurant', label: '음식점', icon: <FoodIcon width={16} height={16} color="#333333" /> },
    { id: 'mart', label: '마트', icon: <CartIcon width={16} height={16} color="#333333" /> },
    { id: 'convenience', label: '편의점', icon: <CafeIcon width={16} height={16} color="#333333" /> },
  ];

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const toggleFavorite = (storeName: string) => {
    const newFavorites = new Set(favoriteStores);
    if (newFavorites.has(storeName)) {
      newFavorites.delete(storeName);
    } else {
      newFavorites.add(storeName);
    }
    setFavoriteStores(newFavorites);
    // TODO: 백엔드 API 준비되면 서버에 저장
  };

  // 로딩 애니메이션 효과
  useEffect(() => {
    if (loading) {
      const createDotAnimation = (dot: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const animation = Animated.parallel([
        createDotAnimation(loadingDot1, 0),
        createDotAnimation(loadingDot2, 150),
        createDotAnimation(loadingDot3, 300),
      ]);

      animation.start();

      return () => animation.stop();
    }
  }, [loading]);

  // 카드 선택 애니메이션
  useEffect(() => {
    USER_CARDS.forEach((_, index) => {
      if (index === selectedCardIndex) {
        // 선택된 카드 확대
        Animated.spring(cardScaleAnims[index], {
          toValue: 1.3,
          useNativeDriver: true,
          tension: 40,
          friction: 7,
        }).start();
      } else {
        // 다른 카드 원래 크기
        Animated.spring(cardScaleAnims[index], {
          toValue: 1,
          useNativeDriver: true,
          tension: 40,
          friction: 7,
        }).start();
      }
    });

    // Progress section 슬라이드 애니메이션
    progressHeightAnim.setValue(0);
    Animated.timing(progressHeightAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false, // height 애니메이션은 useNativeDriver false
    }).start();
  }, [selectedCardIndex]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '위치 권한이 필요합니다.');
        const defaultCoords = { latitude: 37.5856, longitude: 127.0292 };
        setUserLocation(defaultCoords);
        fetchNearbyStores(defaultCoords.latitude, defaultCoords.longitude);
        return;
      }

      // Try to get last known position first (faster)
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const coords = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };

        // Check if location is in USA (emulator default), use Korea instead
        if (coords.latitude > 36 && coords.latitude < 38 && coords.longitude > -123 && coords.longitude < -121) {
          console.log('[Location] 에뮬레이터 기본 위치 감지 (미국), 안암역으로 변경');
          const koreaCoords = { latitude: 37.5856, longitude: 127.0292 };
          setUserLocation(koreaCoords);
          fetchNearbyStores(koreaCoords.latitude, koreaCoords.longitude);
        } else {
          setUserLocation(coords);
          fetchNearbyStores(coords.latitude, coords.longitude);
        }
        return;
      }

      // If no last known position, get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // Check if location is in USA (emulator default), use Korea instead
      if (coords.latitude > 36 && coords.latitude < 38 && coords.longitude > -123 && coords.longitude < -121) {
        console.log('[Location] 에뮬레이터 기본 위치 감지 (미국), 안암역으로 변경');
        const koreaCoords = { latitude: 37.5856, longitude: 127.0292 };
        setUserLocation(koreaCoords);
        fetchNearbyStores(koreaCoords.latitude, koreaCoords.longitude);
      } else {
        setUserLocation(coords);
        fetchNearbyStores(coords.latitude, coords.longitude);
      }
    } catch (error) {
      console.error('위치 가져오기 실패:', error);
      const defaultCoords = { latitude: 37.5856, longitude: 127.0292 };
      setUserLocation(defaultCoords);
      fetchNearbyStores(defaultCoords.latitude, defaultCoords.longitude);
      console.log('안암역을 기본 위치로 사용합니다.');
    }
  };

  const fetchNearbyStores = async (lat: number, lng: number, radius: number = 500) => {
    try {
      console.log(`[fetchNearbyStores] 요청 위치: ${lat}, ${lng}, radius: ${radius}m`);
      console.log(`[fetchNearbyStores] 사용자 위치: ${userLocation?.latitude}, ${userLocation?.longitude}`);

      const response = await axios.get(`${API_URL}/api/nearby-recommendations`, {
        params: {
          lat,
          lng,
          user_lat: userLocation?.latitude || lat,
          user_lng: userLocation?.longitude || lng,
          radius,
          cards: USER_CARDS.join(','),
        },
      });

      console.log(`[fetchNearbyStores] 응답 받음: ${response.data.stores.length}개 가맹점`);

      // 백엔드에서 건물 감지 정보를 받아옴
      const isIndoor = response.data.indoor || false;

      setIsInsideBuilding(isIndoor);

      if (isIndoor) {
        console.log(`[Building Detection] 건물 내부 감지됨`);
      }

      setStores(response.data.stores);
    } catch (error) {
      console.error('API 호출 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCameraChange = (event: any) => {
    const { latitude, longitude, zoom } = event;
    setCurrentZoom(zoom);

    // Debounce: 지도 이동이 끝난 후 1초 뒤에 검색
    if (cameraChangeTimeout.current) {
      clearTimeout(cameraChangeTimeout.current);
    }

    cameraChangeTimeout.current = setTimeout(() => {
      // Zoom level에 따라 검색 반경 조정
      let radius = 500;
      if (zoom < 14) {
        radius = 2000; // 줌 아웃 시 넓은 범위
      } else if (zoom < 15) {
        radius = 1000;
      }

      console.log(`[Camera] 지도 이동 완료: ${latitude}, ${longitude}, zoom=${zoom}`);
      fetchNearbyStores(latitude, longitude, radius);
    }, 1000);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    Keyboard.dismiss();

    try {
      const response = await axios.get(`${API_URL}/api/search-place`, {
        params: {
          query: searchQuery,
        },
      });

      if (response.data.location) {
        const { latitude, longitude, name } = response.data.location;
        console.log(`[Search] 검색 결과: ${name} at ${latitude}, ${longitude}`);

        // Move map to search result
        if (mapRef.current) {
          mapRef.current.animateCameraTo({
            latitude,
            longitude,
            zoom: 16,
            duration: 500,
          });
        }

        // Fetch nearby stores at search location
        fetchNearbyStores(latitude, longitude, 500);
      } else {
        Alert.alert('검색 결과 없음', '검색 결과를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('[Search] 검색 실패:', error);
      Alert.alert('오류', '검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleMarkerClick = async (store: StoreCard) => {
    Keyboard.dismiss();
    setSelectedStore(store);
    setSelectedCardIndex(0);
    setLoadingRecommendations(true);
    bottomSheetRef.current?.snapToIndex(2);

    // Move map camera to store location
    if (mapRef.current) {
      mapRef.current.animateCameraTo({
        latitude: store.latitude,
        longitude: store.longitude,
        zoom: 17,
        duration: 500,
      });
    }

    try {
      const response = await axios.post(`${API_URL}/api/merchant-recommendations`, {
        merchant_name: store.name,
        category: store.category,
        user_cards: USER_CARDS,
      });

      setRecommendations(response.data.recommendations);
    } catch (error) {
      console.error('상세 혜택 조회 실패:', error);
      Alert.alert('오류', '상세 혜택 정보를 가져올 수 없습니다.');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleScrollEnd = (event: any) => {
    // 스크롤이 완전히 끝났을 때만 카드 선택 업데이트
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const cardWidth = 150; // 카드 너비(120) + 간격(30)
    const index = Math.round(scrollPosition / cardWidth);
    setSelectedCardIndex(Math.min(Math.max(index, 0), USER_CARDS.length - 1));

    // 프로그래밍 방식 스크롤 플래그 해제
    isScrollingToCard.current = false;
  };

  const handleRecommendationCardClick = (cardName: string) => {
    const cardIndex = USER_CARDS.indexOf(cardName);
    if (cardIndex !== -1) {
      isScrollingToCard.current = true;
      setSelectedCardIndex(cardIndex);
      cardScrollRef.current?.scrollToIndex({
        index: cardIndex,
        animated: true
      });
    }
  };

  const moveToMyLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateCameraTo({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        zoom: 16,
        duration: 500,
      });
    }
  };

  const renderCardItem = ({ item: cardName, index }: { item: string; index: number }) => {
    const isLast = index === USER_CARDS.length - 1;

    return (
      <Animated.View
        style={[
          styles.cardSelectorItem,
          !isLast && { marginRight: 30 },
          {
            transform: [{ scale: cardScaleAnims[index] }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            // 즉시 선택 및 스크롤 (애니메이션 포함)
            isScrollingToCard.current = true;
            setSelectedCardIndex(index);
            cardScrollRef.current?.scrollToIndex({
              index,
              animated: true
            });
          }}
          style={styles.cardSelectorTouchable}
        >
          {CARD_IMAGES[cardName] ? (
            <Image
              source={CARD_IMAGES[cardName]}
              style={styles.cardSelectorImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.cardPlaceholder}>
              <Text style={styles.cardPlaceholderText}>카드</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderLoadingDots = () => {
    const dotScale = (dot: Animated.Value) => dot.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.5],
    });

    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingDot, { transform: [{ scale: dotScale(loadingDot1) }] }]} />
        <Animated.View style={[styles.loadingDot, { transform: [{ scale: dotScale(loadingDot2) }] }]} />
        <Animated.View style={[styles.loadingDot, { transform: [{ scale: dotScale(loadingDot3) }] }]} />
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <View style={styles.container}>
        <NaverMapView
          ref={mapRef}
          style={styles.map}
          initialCamera={{
            latitude: userLocation?.latitude || 37.5856,
            longitude: userLocation?.longitude || 127.0292,
            zoom: 16,
          }}
          onCameraChanged={handleCameraChange}
        >
        {(() => {
          const filteredStores = stores.filter(store => !selectedCategory || store.category === selectedCategory);
          const allScores = filteredStores
            .map(store => store.top_card?.score || 0)
            .filter(score => score > 0);

          return filteredStores.map((store, index) => {
            // 줌 레벨에 따라 마커 표시 여부 결정 (간단한 클러스터링)
            const showMarker = currentZoom >= 14 || index % 3 === 0;

            if (!showMarker) return null;

            const score = store.top_card?.score || 0;
            const benefitLevel = score > 0 ? getBenefitLevel(score, allScores) : 'medium';

            return (
              <NaverMapMarkerOverlay
                key={`${store.name}-${index}`}
                latitude={store.latitude}
                longitude={store.longitude}
                onTap={() => handleMarkerClick(store)}
                anchor={{ x: 0.5, y: 1 }}
                width={currentZoom >= 15 ? 32 : 24}
                height={currentZoom >= 15 ? 32 : 24}
                caption={currentZoom >= 15 ? {
                  text: store.name,
                  textSize: 12,
                  color: '#333333',
                  haloColor: '#FFFFFF',
                } : undefined}
              >
                <View style={{
                  width: currentZoom >= 15 ? 32 : 24,
                  height: currentZoom >= 15 ? 32 : 24
                }}>
                  <StorePinIcon
                    width={currentZoom >= 15 ? 32 : 24}
                    height={currentZoom >= 15 ? 32 : 24}
                    benefitLevel={benefitLevel}
                  />
                </View>
              </NaverMapMarkerOverlay>
            );
          });
        })()}
        {userLocation && (
          <NaverMapMarkerOverlay
            latitude={userLocation.latitude}
            longitude={userLocation.longitude}
            anchor={{ x: 0.5, y: 0.5 }}
            width={46}
            height={44}
          >
            <View style={{ width: 46, height: 44 }}>
              <LocationMarkerIcon width={46} height={44} />
            </View>
          </NaverMapMarkerOverlay>
        )}
      </NaverMapView>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <SearchIcon width={20} height={20} color="#999999" />
          <TextInput
            style={styles.searchInput}
            placeholder="장소, 주소 검색"
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            editable={!isSearching}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearButton}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.myPageButton}
          onPress={() => setShowProfile(true)}
          activeOpacity={0.7}
        >
          <CardsIcon width={44} height={44} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryOverlay}
        contentContainerStyle={styles.categoryContainer}
        onScrollBeginDrag={() => Keyboard.dismiss()}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryButton,
              selectedCategory === category.id && styles.categoryButtonActive,
            ]}
            onPress={() => {
              Keyboard.dismiss();
              setSelectedCategory(selectedCategory === category.id ? null : category.id);
            }}
          >
            {category.icon}
            <Text style={[
              styles.categoryText,
              selectedCategory === category.id && styles.categoryTextActive,
            ]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={moveToMyLocation}
        activeOpacity={0.8}
      >
        <MyLocationIcon width={24} height={24} color="#000000" />
      </TouchableOpacity>

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        onAnimate={() => Keyboard.dismiss()}
        handleIndicatorStyle={{
          backgroundColor: '#D0D0D0',
          width: 40,
          height: 4,
        }}
        style={{
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -4,
          },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 8,
        }}
        enableContentPanningGesture={false}
        topInset={StatusBar.currentHeight || 0}
      >
        <View style={styles.bottomSheetContainer}>
          <TouchableOpacity
            style={styles.onePayButton}
            onPress={() => {
              Keyboard.dismiss();
              setShowOnePay(true);
            }}
          >
            <Text style={styles.onePayText}>ONE PAY</Text>
          </TouchableOpacity>

          {selectedStore ? (
            <>
              <View style={styles.cardSelectorWrapper}>
                <FlatList
                  ref={cardScrollRef}
                  data={USER_CARDS}
                  renderItem={renderCardItem}
                  keyExtractor={(_item, index) => `card-${index}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cardSelectorContent}
                  snapToInterval={150}
                  decelerationRate="fast"
                  onMomentumScrollEnd={handleScrollEnd}
                  onScrollEndDrag={handleScrollEnd}
                  getItemLayout={(_data, index) => ({
                    length: 150,
                    offset: 150 * index,
                    index,
                  })}
                  style={styles.cardSelectorFlatList}
                />
              </View>

              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setSelectedStore(null);
                  setRecommendations([]);
                  setSelectedCardIndex(0);
                  bottomSheetRef.current?.snapToIndex(1);
                }}
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>← 목록으로</Text>
              </TouchableOpacity>

              <View style={styles.storeHeaderContainer}>
                <View style={styles.storeNameRow}>
                  <Text style={styles.storeName}>{selectedStore.name}</Text>
                  <TouchableOpacity
                    onPress={() => toggleFavorite(selectedStore.name)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <StarIcon
                      width={24}
                      height={24}
                      filled={favoriteStores.has(selectedStore.name)}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.storeAddress}>{selectedStore.address}</Text>
              </View>
            </>
          ) : (
            loading ? renderLoadingDots() : (
              isInsideBuilding ? (
                <Text style={[styles.bottomSheetTitle, { fontFamily: FONTS.bold, textAlign: 'center' }]}>
                  여기서 결제 중이신가요?
                </Text>
              ) : (
                <View style={styles.filterContainer}>
                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setFilterOpenOnly(!filterOpenOnly)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterButtonText, filterOpenOnly && styles.filterButtonTextActive]}>
                      영업중
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => {
                      if (filterSort === 'benefit') {
                        setFilterOrder(filterOrder === 'desc' ? 'asc' : 'desc');
                      } else {
                        setFilterSort('benefit');
                        setFilterOrder('desc');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterButtonText, filterSort === 'benefit' && styles.filterButtonTextActive]}>
                      혜택순 {filterSort === 'benefit' && (filterOrder === 'desc' ? '▼' : '▲')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => {
                      if (filterSort === 'distance') {
                        setFilterOrder(filterOrder === 'desc' ? 'asc' : 'desc');
                      } else {
                        setFilterSort('distance');
                        setFilterOrder('asc');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterButtonText, filterSort === 'distance' && styles.filterButtonTextActive]}>
                      거리순 {filterSort === 'distance' && (filterOrder === 'asc' ? '▲' : '▼')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => {
                      if (filterSort === 'recommend') {
                        setFilterOrder(filterOrder === 'desc' ? 'asc' : 'desc');
                      } else {
                        setFilterSort('recommend');
                        setFilterOrder('desc');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterButtonText, filterSort === 'recommend' && styles.filterButtonTextActive]}>
                      추천순 {filterSort === 'recommend' && (filterOrder === 'desc' ? '▼' : '▲')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            )
          )}

          <BottomSheetScrollView
            contentContainerStyle={{
              paddingHorizontal: 8,
              paddingBottom: 15,
              backgroundColor: COLORS.background,
            }}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => Keyboard.dismiss()}
          >
            {selectedStore ? (
              <>

                {loadingRecommendations ? (
                  <Text style={styles.loadingText}>카드 혜택 조회 중...</Text>
                ) : (
                  <>
                    <Text style={styles.recommendationsTitle}>내 카드 혜택 순위</Text>
                    {recommendations.map((rec) => {
                      const selectedCardName = USER_CARDS[selectedCardIndex];
                      const isSelectedCard = rec.card === selectedCardName;
                      const performanceData = getSamplePerformanceData(rec);

                      return (
                        <View key={rec.rank}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => handleRecommendationCardClick(rec.card)}
                            style={[
                              styles.recommendationCard,
                              isSelectedCard && styles.recommendationCardSelected
                            ]}
                          >
                            <View style={styles.rankBadge}>
                              <Text style={styles.rankText}>{rec.rank}</Text>
                            </View>

                            <View style={styles.recommendationInfo}>
                              <Text style={styles.recommendationCardName}>{rec.card}</Text>
                              <Text style={styles.benefitSummary}>{rec.benefit_summary}</Text>

                              <View style={styles.benefitDetails}>
                                {CARD_IMAGES[rec.card] && (
                                  <Image
                                    source={CARD_IMAGES[rec.card]}
                                    style={styles.recommendationCardImage}
                                    resizeMode="contain"
                                  />
                                )}
                                <View style={styles.benefitDetailsText}>
                                  {rec.discount_rate > 0 && (
                                    <Text style={styles.benefitDetail}>할인율: {rec.discount_rate}%</Text>
                                  )}
                                  {rec.discount_amount > 0 && (
                                    <Text style={styles.benefitDetail}>
                                      최대 할인: {rec.discount_amount.toLocaleString()}원
                                    </Text>
                                  )}
                                  {rec.point_rate > 0 && (
                                    <Text style={styles.benefitDetail}>적립: {rec.point_rate}%</Text>
                                  )}
                                  {rec.pre_month_money > 0 && (
                                    <Text style={styles.benefitDetailCondition}>
                                      조건: 전월 {(rec.pre_month_money / 10000).toFixed(0)}만원 이상
                                    </Text>
                                  )}
                                </View>
                              </View>
                            </View>

                            <View style={styles.scoreContainer}>
                              <Text style={styles.scoreText}>{rec.score}</Text>
                              <Text style={styles.scoreLabel}>점</Text>
                            </View>
                          </TouchableOpacity>

                          {isSelectedCard && (
                            <Animated.View
                              style={[
                                styles.progressSection,
                                {
                                  maxHeight: progressHeightAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 200],
                                  }),
                                  opacity: progressHeightAnim,
                                },
                              ]}
                            >
                              <View style={styles.progressRow}>
                                {/* 실적 Progress */}
                                <View style={styles.progressItem}>
                                  <Text style={styles.progressLabel}>실적</Text>
                                  {performanceData.requiredPerformance > 0 ? (
                                    <>
                                      <View style={styles.progressBarContainer}>
                                        <View style={styles.progressBarBackground}>
                                          <LinearGradient
                                            colors={['#22B573', '#FFFFFF']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={[
                                              styles.progressBarFill,
                                              {
                                                width: `${Math.min(
                                                  (performanceData.currentPerformance /
                                                    performanceData.requiredPerformance) *
                                                    100,
                                                  100
                                                )}%`,
                                              },
                                            ]}
                                          />
                                        </View>
                                      </View>
                                      <Text style={styles.progressText}>
                                        {performanceData.currentPerformance.toLocaleString()}원 /{' '}
                                        {performanceData.requiredPerformance.toLocaleString()}원
                                      </Text>
                                    </>
                                  ) : (
                                    <Text style={styles.progressTextNoData}>-</Text>
                                  )}
                                </View>

                                {/* 혜택한도 Progress */}
                                <View style={styles.progressItem}>
                                  <Text style={styles.progressLabel}>혜택한도</Text>
                                  {performanceData.totalBenefitLimit > 0 ? (
                                    <>
                                      <View style={styles.progressBarContainer}>
                                        <View style={styles.progressBarBackground}>
                                          <LinearGradient
                                            colors={['#FCC490', '#8586CA']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={[
                                              styles.progressBarFill,
                                              {
                                                width: `${Math.min(
                                                  (performanceData.usedBenefit /
                                                    performanceData.totalBenefitLimit) *
                                                    100,
                                                  100
                                                )}%`,
                                              },
                                            ]}
                                          />
                                        </View>
                                      </View>
                                      <Text style={styles.progressText}>
                                        잔여 {performanceData.remainingBenefit.toLocaleString()}원 /{' '}
                                        {performanceData.totalBenefitLimit.toLocaleString()}원
                                      </Text>
                                    </>
                                  ) : (
                                    <Text style={styles.progressTextNoData}>-</Text>
                                  )}
                                </View>
                              </View>
                            </Animated.View>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}
              </>
            ) : (
              <>
                {stores
                  .filter(store => {
                    // 카테고리 필터
                    if (selectedCategory && store.category !== selectedCategory) return false;

                    // 영업중 필터 (현재는 모든 가게가 영업중이라고 가정)
                    // TODO: 백엔드에서 영업시간 데이터 받아와서 필터링

                    return true;
                  })
                  .sort((a, b) => {
                    // 정렬
                    if (filterSort === 'distance') {
                      return filterOrder === 'asc'
                        ? a.distance - b.distance
                        : b.distance - a.distance;
                    } else if (filterSort === 'benefit') {
                      const scoreA = a.top_card?.score || 0;
                      const scoreB = b.top_card?.score || 0;
                      return filterOrder === 'desc'
                        ? scoreB - scoreA
                        : scoreA - scoreB;
                    } else if (filterSort === 'recommend') {
                      // 추천순은 기본적으로 top_card의 score 기준
                      const scoreA = a.top_card?.score || 0;
                      const scoreB = b.top_card?.score || 0;
                      return filterOrder === 'desc'
                        ? scoreB - scoreA
                        : scoreA - scoreB;
                    }
                    return 0;
                  })
                  .map((store, index) => (
                    <TouchableOpacity
                      key={`${store.name}-${index}`}
                      style={styles.storeCard}
                      onPress={() => {
                        Keyboard.dismiss();
                        handleMarkerClick(store);
                      }}
                    >
                      {getMerchantLogo(store.name) ? (
                        <Image
                          source={getMerchantLogo(store.name)}
                          style={styles.merchantLogo}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.storePlaceholder}>
                          <Text style={styles.storePlaceholderText}>
                            {store.name.charAt(0)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.storeInfo}>
                        <Text style={styles.storeCardName}>{store.name}</Text>
                        {!isInsideBuilding && (
                          <Text style={styles.storeDistance}>
                            {store.distance < 1000
                              ? `${Math.round(store.distance)}m`
                              : `${(store.distance / 1000).toFixed(1)}km`}
                          </Text>
                        )}
                        {store.top_card ? (
                          <>
                            <Text style={styles.cardName} numberOfLines={1} ellipsizeMode="tail">
                              {store.top_card.card}
                            </Text>
                            <Text style={styles.benefitText}>
                              {store.top_card.benefit.split(' • ')[0]}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.noBenefitText}>혜택 없음</Text>
                        )}
                      </View>

                      {store.top_card && CARD_IMAGES[store.top_card.card] && (
                        <Image
                          source={CARD_IMAGES[store.top_card.card]}
                          style={styles.cardImage}
                          resizeMode="contain"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
              </>
            )}
          </BottomSheetScrollView>
        </View>
      </BottomSheet>
        </View>
      </TouchableWithoutFeedback>
      {showProfile && (
        <View style={styles.profileOverlay}>
          <ProfileScreen onBack={() => setShowProfile(false)} />
        </View>
      )}
      {showOnePay && (
        <View style={styles.profileOverlay}>
          <OnePayScreen onBack={() => setShowOnePay(false)} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    width: '100%',
    height: SCREEN_HEIGHT,
  },
  searchContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  myPageButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: '#333333',
    paddingVertical: 0,
  },
  clearButton: {
    fontSize: 20,
    color: '#999999',
    marginRight: 8,
  },
  categoryOverlay: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
  },
  categoryContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryButtonActive: {
    backgroundColor: '#FFF0B3',
    borderColor: '#FFF0B3',
  },
  categoryText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#333333',
  },
  categoryTextActive: {
    color: '#333333',
  },
  bottomSheetContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    overflow: 'visible',
  },
  onePayButton: {
    backgroundColor: '#000000',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  onePayText: {
    fontSize: 24,
    fontFamily: FONTS.museoModerno,
    color: COLORS.background,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  bottomSheetContent: {
    paddingHorizontal: 8,
    backgroundColor: COLORS.background,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#333333',
    marginBottom: 4,
    marginHorizontal: 20,
  },
  backButton: {
    marginLeft: 10,
    marginRight: 20,
    marginBottom: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  storeHeaderContainer: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  storeName: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#333333',
    flex: 1,
  },
  storeAddress: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 20,
  },
  recommendationsTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#333333',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  cardSelectorWrapper: {
    height: 120,
    marginTop: 0,
    marginBottom: 0,
  },
  cardSelectorFlatList: {
    flex: 1,
  },
  cardSelectorContent: {
    paddingHorizontal: (Dimensions.get('window').width - 156) / 2, // 120 * 1.3 = 156
    alignItems: 'center',
    paddingVertical: 20,
  },
  cardSelectorItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSelectorTouchable: {
    width: 120,
    height: 75,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardSelectorImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  cardPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  cardPlaceholderText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#999999',
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  recommendationCardSelected: {
    borderWidth: 2,
    borderColor: '#000000',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  recommendationInfo: {
    flex: 1,
  },
  recommendationCardName: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#333333',
    marginBottom: 6,
  },
  benefitSummary: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
    marginBottom: 8,
  },
  benefitDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendationCardImage: {
    width: 80,
    height: 50,
    borderRadius: 6,
  },
  benefitDetailsText: {
    flex: 1,
    gap: 4,
  },
  benefitDetail: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  benefitDetailCondition: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#C23E38',
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  storePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storePlaceholderText: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: '#666666',
  },
  storeInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  storeCardName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#333333',
    marginBottom: 4,
  },
  storeDistance: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    marginBottom: 6,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardName: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#333333',
  },
  benefitText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: '#4AA63C',
    marginTop: 2,
  },
  noBenefitText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scoreText: {
    fontSize: 32,
    fontFamily: FONTS.bold,
    color: '#333333',
  },
  scoreLabel: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  cardImage: {
    width: 100,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  merchantLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  progressSection: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 32,
    marginTop: -20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    zIndex: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  progressRow: {
    flexDirection: 'row',
    gap: 16,
  },
  progressItem: {
    flex: 1,
  },
  progressLabel: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#333333',
    marginBottom: 8,
  },
  progressBarContainer: {
    marginBottom: 6,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  progressTextNoData: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginTop: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    marginHorizontal: 20,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333333',
  },
  profileOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  myLocationButton: {
    position: 'absolute',
    right: 15,
    bottom: 300,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterButtonText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  filterButtonTextActive: {
    color: '#000000',
    fontFamily: FONTS.semiBold,
  },
});
