import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Platform, Alert, TextInput, Keyboard, TouchableWithoutFeedback, Image, StatusBar, FlatList, Animated, Modal } from 'react-native';
import { NaverMapView, NaverMapMarkerOverlay, NaverMapPolylineOverlay } from '@mj-studio/react-native-naver-map';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SearchIcon, StarsIcon, CafeIcon, CoffeeIcon, FoodIcon, CartIcon, CardsIcon, LocationMarkerIcon, StorePinIcon, StarIcon, MyLocationIcon, SearchPinIcon, RefreshIcon, CourseIcon } from '../components/svg';
import { FONTS, COLORS } from '../constants/theme';
import * as Location from 'expo-location';
import axios from 'axios';
import { USER_CARDS, API_URL, CARD_IMAGES } from '../constants/userCards';
import { getMerchantLogo } from '../constants/merchantImages';
import { AuthStorage } from '../utils/auth';
import { CardPlaceholder } from '../components/CardPlaceholder';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileScreen } from './ProfileScreen';
import { OnePayScreen } from './OnePayScreen';
import { LocationDebugModal } from '../components/LocationDebugModal';
import { calculateDistance } from '../constants/mapUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CategoryButton {
  id: string;
  label: string;
  icon: React.ReactNode | null;
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

interface CourseLeg {
  from: string;
  to: string;
  mode: string;
  distance: number;
  duration: number;
  fare: number | null;
  distance_text: string;
  duration_text: string;
  fare_text: string | null;
  polyline: string;
}

interface CourseRoute {
  status: string;
  legs_summary: CourseLeg[];
  total_distance: number;
  total_duration: number;
  total_fare: number;
  total_distance_text: string;
  total_duration_text: string;
  total_fare_text: string;
}

interface CoursePlace {
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  benefits: Array<{
    card: string;
    benefit: string;
  }>;
}

interface AICourseResult {
  intent: {
    theme: string;
    keywords: string[];
    categories: string[];
    num_places: number;
    preferences: any;
  };
  course: {
    title: string;
    benefit_summary: string;
    reasoning: string;
    stops: CoursePlace[];
    routes: any[];
    total_distance: number;
    total_duration: number;
    total_benefit_score: number;
  };
}

interface SavedCourse {
  id: string;
  title: string;
  description: string;
  stops: CoursePlace[];
  route_info?: CourseRoute;
  total_distance: number;
  total_duration: number;
  total_benefit_score: number;
  num_people: number;
  budget: number;
  created_at: string;
  user_id: string;
  is_saved_by_user: boolean;
}

interface PopularCourse extends SavedCourse {
  save_count: number;
}

interface HomeScreenProps {
  onLogout?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onLogout }) => {
  const insets = useSafeAreaInsets();
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
  const [searchResultLocation, setSearchResultLocation] = useState<{ latitude: number; longitude: number; name: string } | null>(null);
  const [debugLocation, setDebugLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [realUserLocation, setRealUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [stayingDuration, setStayingDuration] = useState<number>(0);
  const [lastLocation, setLastLocation] = useState<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const [currentMapCenter, setCurrentMapCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [lastSearchCenter, setLastSearchCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [forceIndoorMode, setForceIndoorMode] = useState(false);
  const [currentSearchRadius, setCurrentSearchRadius] = useState(720); // Initial radius with 20% buffer
  const [userCards, setUserCards] = useState<string[]>([]);

  // AI Course Mode states
  const [isCourseMode, setIsCourseMode] = useState(false);
  const [courseQuery, setCourseQuery] = useState('');
  const [courseResult, setCourseResult] = useState<AICourseResult | null>(null);
  const [courseRoute, setCourseRoute] = useState<CourseRoute | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(false);

  // Course filters
  const [numPeople, setNumPeople] = useState(2);
  const [budget, setBudget] = useState(100000);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showBudgetPicker, setShowBudgetPicker] = useState(false);

  // Course lists
  const [showCourseList, setShowCourseList] = useState(true);
  const [aiCourses, setAiCourses] = useState<AICourseResult[]>([]);
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [popularCourses, setPopularCourses] = useState<PopularCourse[]>([]);
  const [loadingCourseList, setLoadingCourseList] = useState(false);

  // Selected course detail
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<SavedCourse | AICourseResult | null>(null);
  const [courseSaved, setCourseSaved] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<any>(null);
  const cardScrollRef = useRef<FlatList>(null);
  const isScrollingToCard = useRef(false);
  const snapPoints = useMemo(() => ['25%', '45%', '70%', '95%'], []);

  // 카드 애니메이션 값 배열
  const cardScaleAnims = useRef<Animated.Value[]>([]).current;

  // Progress section 애니메이션 (height 기반)
  const progressHeightAnim = useRef(new Animated.Value(0)).current;

  // 로딩 애니메이션 (점 3개)
  const loadingDot1 = useRef(new Animated.Value(0)).current;
  const loadingDot2 = useRef(new Animated.Value(0)).current;
  const loadingDot3 = useRef(new Animated.Value(0)).current;

  // 혜택 레벨 계산 (상위 33%, 중위 33%, 하위 33%)
  const getBenefitLevel = (score: number, allScores: number[]): 'high' | 'medium' | 'low' => {
    if (allScores.length === 0) return 'medium';
    if (allScores.length === 1) return score > 0 ? 'high' : 'low';

    const sortedScores = [...allScores].sort((a, b) => b - a);

    // 상위 33%, 하위 33% 기준
    const topIndex = Math.floor(sortedScores.length / 3);
    const bottomIndex = Math.floor(sortedScores.length * 2 / 3);

    const topThreshold = sortedScores[topIndex];
    const bottomThreshold = sortedScores[bottomIndex];

    // 점수가 같을 때 중복 방지
    if (score > topThreshold) return 'high';
    if (score < bottomThreshold) return 'low';
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

  // Category keyword mapping for search
  const categoryKeywords: { [key: string]: string[] } = {
    'cafe': ['카페', 'cafe', '커피', 'coffee', '스타벅스', '이디야', '투썸', '커피숍'],
    'restaurant': ['음식점', 'restaurant', '식당', '레스토랑', '맛집', '한식', '중식', '일식', '양식'],
    'mart': ['마트', 'mart', '슈퍼', 'supermarket', '홈플러스', '이마트', '롯데마트'],
    'convenience': ['편의점', 'convenience', 'cvs', 'cu', 'gs25', '세븐일레븐', '이마트24'],
    'gas_station': ['주유소', 'gas', 'station', 'sk', 'gs', 's-oil', '현대오일뱅크'],
    'bakery': ['베이커리', 'bakery', '빵집', '제과점'],
    'beauty': ['뷰티', 'beauty', '화장품', '올리브영', '다이소'],
    'movie': ['영화', 'movie', '영화관', 'cgv', '롯데시네마', '메가박스'],
    'pharmacy': ['약국', 'pharmacy'],
    'transit': ['지하철', 'subway', '버스', 'bus', '역'],
    'taxi': ['택시', 'taxi'],
  };

  // Decode Google Polyline Encoding
  const decodePolyline = (encoded: string): Array<{ latitude: number; longitude: number }> => {
    if (!encoded) return [];

    const poly = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }

    return poly;
  };

  const getCategoryIcon = (categoryId: string, isActive: boolean) => {
    const color = isActive ? '#FFFFFF' : '#666666';
    const iconProps = { width: 16, height: 16, color };

    switch (categoryId) {
      case 'course':
        return <CourseIcon width={20} height={19} color="#000000" />;
      case 'favorites':
        return <StarsIcon {...iconProps} />;
      case 'cafe':
        return <CoffeeIcon {...iconProps} />;
      case 'restaurant':
        return <FoodIcon {...iconProps} />;
      case 'mart':
        return <CartIcon {...iconProps} />;
      case 'convenience':
        return <CafeIcon {...iconProps} />;
      default:
        return null;
    }
  };

  const categories: CategoryButton[] = [
    { id: 'course', label: '코스', icon: null },
    { id: 'favorites', label: '즐겨찾기', icon: null },
    { id: 'cafe', label: '카페', icon: null },
    { id: 'restaurant', label: '음식점', icon: null },
    { id: 'mart', label: '마트', icon: null },
    { id: 'convenience', label: '편의점', icon: null },
  ];

  // Detect category from search query
  const detectCategory = (query: string): string | null => {
    const lowerQuery = query.toLowerCase().trim();

    // Exclude place names ending with "역" (station names like "안암역", "강남역")
    // These should be treated as place searches, not category searches
    if (lowerQuery.endsWith('역') && lowerQuery.length > 1) {
      return null;
    }

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()))) {
        return category;
      }
    }

    return null;
  };

  // Fetch user's cards from backend
  const fetchUserCards = async () => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) {
        console.error('[fetchUserCards] No token found, using hardcoded cards');
        setUserCards(USER_CARDS);
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
      if (data.success && data.user && data.user.cards) {
        const cardNames = data.user.cards.map((card: any) => card.card_name);
        console.log('[fetchUserCards] Fetched user cards:', cardNames);
        setUserCards(cardNames);
      } else {
        console.error('[fetchUserCards] Failed to fetch user cards, using hardcoded cards');
        setUserCards(USER_CARDS);
      }
    } catch (error) {
      console.error('[fetchUserCards] Error fetching user cards:', error);
      setUserCards(USER_CARDS);
    }
  };

  useEffect(() => {
    requestLocationPermission();
    fetchUserCards();
  }, []);

  // Initialize card scale animations when userCards change
  useEffect(() => {
    if (userCards.length > 0) {
      // Clear existing animations
      cardScaleAnims.length = 0;
      // Add new animations for each card
      userCards.forEach(() => {
        cardScaleAnims.push(new Animated.Value(1));
      });

      // Refetch stores with user cards to get correct benefits
      if (userLocation) {
        console.log('[HomeScreen] User cards loaded, fetching stores with benefits...');
        fetchNearbyStores(userLocation.latitude, userLocation.longitude, currentSearchRadius);
      }
    }
  }, [userCards]);

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
    userCards.forEach((_, index) => {
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
        Alert.alert('위치 권한 필요', '앱을 사용하려면 위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.');
        return;
      }

      // Try to get last known position first (faster)
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const coords = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        const accuracy = lastKnown.coords.accuracy || null;

        console.log(`[Location] Last known position - accuracy: ${accuracy}m`);
        setGpsAccuracy(accuracy);

        // Check if location is in USA (emulator default)
        if (coords.latitude > 36 && coords.latitude < 38 && coords.longitude > -123 && coords.longitude < -121) {
          console.log('[Location] 에뮬레이터 기본 위치 감지 (미국)');
          Alert.alert('위치 오류', '올바른 위치를 가져올 수 없습니다. 실제 기기에서 사용해주세요.');
          return;
        }
        setRealUserLocation(coords);
        setUserLocation(coords);
        fetchNearbyStores(coords.latitude, coords.longitude, currentSearchRadius);
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
      const accuracy = location.coords.accuracy || null;

      console.log(`[Location] Current position - accuracy: ${accuracy}m`);
      setGpsAccuracy(accuracy);

      // Check if location is in USA (emulator default)
      if (coords.latitude > 36 && coords.latitude < 38 && coords.longitude > -123 && coords.longitude < -121) {
        console.log('[Location] 에뮬레이터 기본 위치 감지 (미국)');
        Alert.alert('위치 오류', '올바른 위치를 가져올 수 없습니다. 실제 기기에서 사용해주세요.');
        return;
      }
      setRealUserLocation(coords);
      setUserLocation(coords);
      fetchNearbyStores(coords.latitude, coords.longitude, currentSearchRadius);
    } catch (error) {
      console.error('위치 가져오기 실패:', error);
      Alert.alert('위치 오류', '위치를 가져올 수 없습니다. 위치 서비스를 확인해주세요.');
    }
  };

  // Calculate distance between two points using Haversine formula
  // Calculate search radius from zoom level with 20% buffer
  const calculateRadiusFromZoom = (zoom: number): number => {
    // Approximate radius in meters for each zoom level (visible map radius)
    // These are rough estimates for Naver Map
    const zoomRadiusMap: { [key: number]: number } = {
      19: 50,
      18: 100,
      17: 200,
      16: 400,
      15: 800,
      14: 1600,
      13: 3200,
      12: 6400,
      11: 12800,
      10: 25600,
    };

    // Get base radius for zoom level (interpolate if needed)
    const floorZoom = Math.floor(zoom);
    const ceilZoom = Math.ceil(zoom);

    const baseRadiusFloor = zoomRadiusMap[floorZoom] || 400;
    const baseRadiusCeil = zoomRadiusMap[ceilZoom] || 400;

    // Linear interpolation
    const fraction = zoom - floorZoom;
    const baseRadius = baseRadiusFloor + (baseRadiusCeil - baseRadiusFloor) * fraction;

    // Add 20% buffer
    const searchRadius = Math.round(baseRadius * 1.2);

    return searchRadius;
  };

  const fetchNearbyStores = async (lat: number, lng: number, radius: number) => {
    try {
      // Update staying duration
      const now = Date.now();
      const STAYING_THRESHOLD = 10; // meters - if moved less than 10m, consider staying

      if (lastLocation) {
        const distance = calculateDistance(
          lastLocation.latitude,
          lastLocation.longitude,
          lat,
          lng
        );

        if (distance < STAYING_THRESHOLD) {
          // Still in the same place - accumulate duration
          const newDuration = Math.floor((now - lastLocation.timestamp) / 1000) + stayingDuration;
          setStayingDuration(newDuration);
          console.log(`[Staying] 체류 중: ${newDuration}초 (이동 거리: ${distance.toFixed(1)}m)`);
        } else {
          // Moved to a new location - reset duration
          setStayingDuration(0);
          setLastLocation({ latitude: lat, longitude: lng, timestamp: now });
          console.log(`[Staying] 새 위치로 이동 (이동 거리: ${distance.toFixed(1)}m) - 체류 시간 리셋`);
        }
      } else {
        // First location update
        setLastLocation({ latitude: lat, longitude: lng, timestamp: now });
      }

      console.log(`[fetchNearbyStores] 요청 위치: ${lat}, ${lng}, radius: ${radius}m`);
      console.log(`[fetchNearbyStores] 사용자 위치: ${userLocation?.latitude}, ${userLocation?.longitude}`);
      console.log(`[fetchNearbyStores] GPS 정확도: ${gpsAccuracy}m`);
      console.log(`[fetchNearbyStores] 체류 시간: ${stayingDuration}초`);

      const params: any = {
        lat,
        lng,
        user_lat: userLocation?.latitude || lat,
        user_lng: userLocation?.longitude || lng,
        radius,
        cards: userCards.join(','),
      };

      // Force indoor mode for demo (발표용)
      if (forceIndoorMode) {
        params.gps_accuracy = 50;  // High inaccuracy (>15m) to avoid outdoor detection
        params.staying_duration = 300;  // >180s to trigger indoor detection
        console.log('[fetchNearbyStores] 건물 내부 강제 모드: GPS 50m, 체류 300초');
      } else {
        // Add GPS accuracy if available
        if (gpsAccuracy !== null) {
          params.gps_accuracy = gpsAccuracy;
        }

        // Add staying duration
        if (stayingDuration > 0) {
          params.staying_duration = stayingDuration;
        }
      }

      const response = await axios.get(`${API_URL}/api/nearby-recommendations`, {
        params,
      });

      console.log(`[fetchNearbyStores] 응답 받음: ${response.data.stores.length}개 가맹점`);

      // 백엔드에서 건물 감지 정보를 받아옴
      const isIndoor = response.data.indoor || false;

      setIsInsideBuilding(isIndoor);

      if (isIndoor) {
        console.log(`[Building Detection] 건물 내부 감지됨: ${response.data.building_name}`);
      }

      // Limit to 50 stores max (performance)
      const limitedStores = response.data.stores.slice(0, 50);
      setStores(limitedStores);

      // Update last search center
      setLastSearchCenter({ latitude: lat, longitude: lng });
      setShowSearchButton(false);
    } catch (error) {
      console.error('API 호출 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchCurrentArea = () => {
    if (currentMapCenter) {
      setLoading(true);
      fetchNearbyStores(currentMapCenter.latitude, currentMapCenter.longitude, currentSearchRadius);
    }
  };

  const handleCameraChange = (event: any) => {
    const { latitude, longitude, zoom } = event;
    setCurrentZoom(zoom);
    setCurrentMapCenter({ latitude, longitude });

    // Calculate and update search radius based on zoom level
    const newRadius = calculateRadiusFromZoom(zoom);
    setCurrentSearchRadius(newRadius);
    console.log(`[Map] Zoom: ${zoom.toFixed(1)}, Search radius: ${newRadius}m`);

    // Check if map moved from last search
    if (lastSearchCenter) {
      const distance = calculateDistance(
        lastSearchCenter.latitude,
        lastSearchCenter.longitude,
        latitude,
        longitude
      );

      // Show search button if moved more than 50m (very sensitive)
      if (distance > 50) {
        setShowSearchButton(true);
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    Keyboard.dismiss();

    try {
      // Detect category from search query
      const detectedCategory = detectCategory(searchQuery);

      // If category detected, just filter current stores without moving map
      if (detectedCategory) {
        console.log(`[Search] 카테고리 검색: ${detectedCategory}`);
        setSelectedCategory(detectedCategory);
        setSearchResultLocation(null);
        setIsSearching(false);
        return;
      }

      // Otherwise, search for specific place
      const params: any = {
        query: searchQuery,
      };

      // Add user location for location-based search
      if (userLocation) {
        params.latitude = userLocation.latitude;
        params.longitude = userLocation.longitude;
      }

      const response = await axios.get(`${API_URL}/api/search-place`, { params });

      if (response.data.location) {
        const { latitude, longitude, name } = response.data.location;
        console.log(`[Search] 장소 검색 결과: ${name} at ${latitude}, ${longitude}`);

        // Clear category filter for place search
        setSelectedCategory(null);

        // Save search result location
        setSearchResultLocation({ latitude, longitude, name });

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
        fetchNearbyStores(latitude, longitude, currentSearchRadius);
      } else {
        Alert.alert('검색 결과 없음', '검색 결과를 찾을 수 없습니다.');
        setSearchResultLocation(null);
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
        user_cards: userCards,
      });

      setRecommendations(response.data.recommendations);
    } catch (error) {
      console.error('상세 혜택 조회 실패:', error);
      Alert.alert('오류', '상세 혜택 정보를 가져올 수 없습니다.');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // AI Course Recommendation
  const handleCourseSearch = async () => {
    if (!courseQuery.trim() || !userLocation) {
      Alert.alert('안내', '검색어를 입력하고 위치 권한을 허용해주세요.');
      return;
    }

    setLoadingCourse(true);
    setCourseSaved(false);
    Keyboard.dismiss();

    try {
      console.log('[Course] AI 코스 추천 요청:', courseQuery);

      const response = await axios.post(`${API_URL}/api/ai/course-recommend`, {
        user_input: courseQuery,
        user_location: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        user_cards: userCards,
        max_distance: 5000,
      }, {
        timeout: 120000, // 2 minutes timeout for AI processing
      });

      const result: AICourseResult = response.data;
      console.log('[Course] 추천 결과:', result);

      setCourseResult(result);

      // Add to AI courses list (keep only last 2)
      setAiCourses(prev => {
        const updated = [result, ...prev];
        return updated.slice(0, 2);
      });

      // Fetch route for the recommended course
      if (result.course && result.course.stops && result.course.stops.length > 0) {
        await fetchCourseRoute(result.course.stops);
      }

      // Move map to first place
      if (result.course && result.course.stops && result.course.stops.length > 0 && mapRef.current) {
        const firstPlace = result.course.stops[0];
        mapRef.current.animateCameraTo({
          latitude: firstPlace.latitude,
          longitude: firstPlace.longitude,
          zoom: 14,
          duration: 500,
        });
      }

      // Show course detail instead of course list
      setShowCourseList(false);

      bottomSheetRef.current?.snapToIndex(3);
    } catch (error) {
      console.error('[Course] AI 코스 추천 실패:', error);
      Alert.alert('오류', 'AI 코스 추천에 실패했습니다.');
    } finally {
      setLoadingCourse(false);
    }
  };

  // Fetch mixed-mode route for course
  const fetchCourseRoute = async (places: CoursePlace[]) => {
    if (!userLocation || places.length === 0) return;

    try {
      console.log('[Course Route] 경로 계산 중...');

      const response = await axios.post(`${API_URL}/api/course-directions-mixed`, {
        course_stops: places.map(p => ({
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
        })),
        start_location: userLocation,
      }, {
        timeout: 60000, // 1 minute timeout for route calculation
      });

      const route: CourseRoute = response.data;
      console.log('[Course Route] 경로 계산 완료:', route);

      setCourseRoute(route);
    } catch (error) {
      console.error('[Course Route] 경로 계산 실패:', error);
      // Route calculation failure is not critical, so we don't show alert
    }
  };

  const handleSaveCourse = async () => {
    if (!courseResult) {
      Alert.alert('오류', '저장할 코스가 없습니다.');
      return;
    }

    setSavingCourse(true);

    try {
      const token = await AuthStorage.getToken();
      if (!token) {
        Alert.alert('안내', '로그인이 필요합니다.');
        setSavingCourse(false);
        return;
      }

      console.log('[Course] 코스 저장 중...');

      const response = await axios.post(
        `${API_URL}/api/course/save`,
        {
          title: courseResult.course.title,
          description: courseResult.course.reasoning,
          stops: courseResult.course.stops.map(stop => ({
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            category: stop.category,
            benefits: stop.benefits,
          })),
          route_info: courseRoute || null,
          total_distance: courseRoute?.total_distance || 0,
          total_duration: courseRoute?.total_duration || 0,
          total_benefit_score: courseResult.course.total_benefit_score || 0,
          num_people: numPeople,
          budget: budget,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('[Course] 코스 저장 완료:', response.data);
      setCourseSaved(true);
      Alert.alert('성공', '코스가 저장되었습니다.');

      // 저장 후 코스 리스트 새로고침
      await fetchSavedCourses();
    } catch (error: any) {
      console.error('[Course] 코스 저장 실패:', error);
      const errorMessage = error.response?.data?.error || '코스 저장에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setSavingCourse(false);
    }
  };

  const fetchSavedCourses = async () => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) {
        console.log('[Course] 로그인하지 않아 저장 코스를 불러올 수 없습니다.');
        return;
      }

      console.log('[Course] 저장 코스 불러오기...');

      const response = await axios.get(`${API_URL}/api/course/saved?limit=10`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success && response.data.courses) {
        setSavedCourses(response.data.courses);
        console.log('[Course] 저장 코스:', response.data.courses.length);
      }
    } catch (error: any) {
      console.error('[Course] 저장 코스 불러오기 실패:', error);
    }
  };

  const fetchPopularCourses = async () => {
    try {
      console.log('[Course] 인기 코스 불러오기...');

      const response = await axios.get(`${API_URL}/api/course/popular?limit=10`);

      if (response.data.success && response.data.courses) {
        setPopularCourses(response.data.courses);
        console.log('[Course] 인기 코스:', response.data.courses.length);
      }
    } catch (error: any) {
      console.error('[Course] 인기 코스 불러오기 실패:', error);
    }
  };

  const loadCourseList = async () => {
    setLoadingCourseList(true);
    try {
      await Promise.all([
        fetchSavedCourses(),
        fetchPopularCourses(),
      ]);
    } finally {
      setLoadingCourseList(false);
    }
  };

  const handleScrollEnd = (event: any) => {
    // 스크롤이 완전히 끝났을 때만 카드 선택 업데이트
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const cardWidth = 150; // 카드 너비(120) + 간격(30)
    const index = Math.round(scrollPosition / cardWidth);
    setSelectedCardIndex(Math.min(Math.max(index, 0), userCards.length - 1));

    // 프로그래밍 방식 스크롤 플래그 해제
    isScrollingToCard.current = false;
  };

  const handleRecommendationCardClick = (cardName: string) => {
    const cardIndex = userCards.indexOf(cardName);
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

  const handleDebugLocationSet = (latitude: number, longitude: number) => {
    console.log(`[Debug] 위치 설정: ${latitude}, ${longitude}`);
    setDebugLocation({ latitude, longitude });
    setUserLocation({ latitude, longitude });
    fetchNearbyStores(latitude, longitude, currentSearchRadius);

    if (mapRef.current) {
      mapRef.current.animateCameraTo({
        latitude,
        longitude,
        zoom: 16,
        duration: 500,
      });
    }
  };

  const handleResetLocation = () => {
    console.log('[Debug] 위치 초기화');
    setDebugLocation(null);
    setForceIndoorMode(false);

    if (realUserLocation) {
      setUserLocation(realUserLocation);
      fetchNearbyStores(realUserLocation.latitude, realUserLocation.longitude, currentSearchRadius);

      if (mapRef.current) {
        mapRef.current.animateCameraTo({
          latitude: realUserLocation.latitude,
          longitude: realUserLocation.longitude,
          zoom: 16,
          duration: 500,
        });
      }
    } else {
      requestLocationPermission();
    }
  };

  const renderCardItem = ({ item: cardName, index }: { item: string; index: number }) => {
    const isLast = index === userCards.length - 1;

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
            <CardPlaceholder
              cardName={cardName}
              width={60}
              height={38}
              style={styles.cardSelectorImage}
            />
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
          initialCamera={userLocation ? {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            zoom: 16,
          } : undefined}
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
        {searchResultLocation && (
          <NaverMapMarkerOverlay
            latitude={searchResultLocation.latitude}
            longitude={searchResultLocation.longitude}
            anchor={{ x: 0.5, y: 1 }}
            width={39}
            height={39}
            caption={{
              text: searchResultLocation.name,
              textSize: 14,
              color: '#000000',
              haloColor: '#FFFFFF',
            }}
          >
            <View style={{ width: 39, height: 39 }}>
              <SearchPinIcon width={39} height={39} />
            </View>
          </NaverMapMarkerOverlay>
        )}

        {/* Course Route Polylines - Naver Style */}
        {isCourseMode && courseRoute && courseRoute.legs_summary && courseRoute.legs_summary.map((leg, index) => {
          const coordinates = decodePolyline(leg.polyline);

          return (
            <React.Fragment key={`leg-${index}`}>
              {/* Outline layer (white border) */}
              <NaverMapPolylineOverlay
                coords={coordinates}
                color="#FFFFFF"
                width={12}
              />
              {/* Main layer (green route) */}
              <NaverMapPolylineOverlay
                coords={coordinates}
                color="#00C853"
                width={8}
              />
            </React.Fragment>
          );
        })}

        {/* Course Place Markers */}
        {isCourseMode && courseResult && courseResult.course && courseResult.course.stops && courseResult.course.stops.map((place, index) => (
          <NaverMapMarkerOverlay
            key={`course-place-${index}`}
            latitude={place.latitude}
            longitude={place.longitude}
            anchor={{ x: 0.5, y: 1 }}
            width={39}
            height={39}
            caption={{
              text: place.name,
              textSize: 14,
              color: '#000000',
              haloColor: '#FFFFFF',
            }}
          >
            <View style={{ width: 39, height: 39 }}>
              <SearchPinIcon width={39} height={39} />
            </View>
          </NaverMapMarkerOverlay>
        ))}
      </NaverMapView>

      {process.env.EXPO_PUBLIC_ENABLE_LOCATION_DEBUG === 'true' && (
        <TouchableOpacity
          style={styles.debugButton}
          onPress={() => setShowDebugModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.debugButtonText}>DEBUG</Text>
          {debugLocation && <View style={styles.debugIndicator} />}
        </TouchableOpacity>
      )}

      <View style={styles.searchContainer}>
        {isCourseMode && (
          <TouchableOpacity
            style={styles.backFromCourseButton}
            onPress={() => {
              setIsCourseMode(false);
              setSelectedCategory(null);
              setCourseResult(null);
              setCourseRoute(null);
              setCourseQuery('');
              setShowCourseList(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.backFromCourseButtonText}>←</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.searchBar, isCourseMode && styles.searchBarAIMode]}>
          <SearchIcon width={20} height={20} color="#000000" />
          <TextInput
            style={styles.searchInput}
            placeholder={isCourseMode ? "원하는 코스를 입력하세요 (예: 카페 → 점심 → 저녁)" : "장소, 주소 검색"}
            placeholderTextColor="#999999"
            value={isCourseMode ? courseQuery : searchQuery}
            onChangeText={isCourseMode ? setCourseQuery : setSearchQuery}
            onSubmitEditing={isCourseMode ? handleCourseSearch : handleSearch}
            returnKeyType="search"
            editable={!isSearching && !loadingCourse}
          />
          {(isCourseMode ? courseQuery.length > 0 : searchQuery.length > 0) && (
            <TouchableOpacity onPress={() => {
              if (isCourseMode) {
                setCourseQuery('');
                setCourseResult(null);
                setCourseRoute(null);
              } else {
                setSearchQuery('');
                setSearchResultLocation(null);
              }
            }}>
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

      {/* Course Filters */}
      {isCourseMode && (
        <View style={styles.courseFiltersContainer}>
          <View style={styles.filterButtonsLeft}>
            <TouchableOpacity
              style={styles.courseFilterButton}
              onPress={() => setShowPeoplePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.courseFilterButtonText}>
                인원: <Text style={styles.courseFilterButtonTextBold}>{numPeople}</Text>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.courseFilterButton}
              onPress={() => setShowBudgetPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.courseFilterButtonText}>
                예산: <Text style={styles.courseFilterButtonTextBold}>{budget / 10000}</Text>만 원
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.myCoursesButton}
            onPress={() => {
              // TODO: Navigate to my saved courses
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.myCoursesButtonText}>📍 내 코스</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isCourseMode && (
        <View style={styles.categoryWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScrollView}
          contentContainerStyle={styles.categoryContainer}
          onScrollBeginDrag={() => Keyboard.dismiss()}
        >
          {categories.map((category) => {
            const isActive = selectedCategory === category.id;
            const isCourse = category.id === 'course';

            if (isCourse) {
              return (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => {
                    Keyboard.dismiss();
                    const newCourseMode = !isCourseMode;
                    setIsCourseMode(newCourseMode);
                    setSelectedCategory(newCourseMode ? 'course' : null);

                    // Clear previous results when toggling mode
                    if (!newCourseMode) {
                      setCourseResult(null);
                      setCourseRoute(null);
                      setCourseQuery('');
                    } else {
                      setSearchQuery('');
                      // Load course list when entering course mode
                      loadCourseList();
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#FFCB9A', '#D3ADD8', '#6DDFE6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.courseButton}
                  >
                    {getCategoryIcon(category.id, isActive)}
                    <Text style={styles.courseText}>
                      {category.label}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  isActive && styles.categoryButtonActive,
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  setSelectedCategory(selectedCategory === category.id ? null : category.id);
                }}
              >
                {getCategoryIcon(category.id, isActive)}
                <Text style={[
                  styles.categoryText,
                  isActive && styles.categoryTextActive,
                ]}>
                  {category.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {showSearchButton && (
          <TouchableOpacity
            style={styles.searchAreaButton}
            onPress={handleSearchCurrentArea}
            activeOpacity={0.8}
          >
            <RefreshIcon width={18} height={18} color="#FFFFFF" />
            <Text style={styles.searchAreaButtonText}>현 지도에서 검색</Text>
          </TouchableOpacity>
        )}
      </View>
      )}

      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={moveToMyLocation}
        activeOpacity={0.8}
      >
        <MyLocationIcon width={24} height={24} color="#000000" />
      </TouchableOpacity>

      <BottomSheet
        ref={bottomSheetRef}
        index={2}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        enableContentPanningGesture={true}
        enableHandlePanningGesture={true}
        enableOverDrag={false}
        overDragResistanceFactor={0}
        animateOnMount={true}
        enableDynamicSizing={false}
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
                  data={userCards}
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
              ) : !isCourseMode ? (
                <View style={styles.filterContainer}>
                  <TouchableOpacity
                    style={[styles.filterButton, filterOpenOnly && styles.filterButtonActive]}
                    onPress={() => setFilterOpenOnly(!filterOpenOnly)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterButtonText, filterOpenOnly && styles.filterButtonTextActive]}>
                      영업중
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterButton, filterSort === 'benefit' && styles.filterButtonActive]}
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
                    style={[styles.filterButton, filterSort === 'distance' && styles.filterButtonActive]}
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
                    style={[styles.filterButton, filterSort === 'recommend' && styles.filterButtonActive]}
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
              ) : null
            )
          )}

          <BottomSheetScrollView
            contentContainerStyle={{
              paddingBottom: insets.bottom + 100,
              paddingHorizontal: 10,
              backgroundColor: COLORS.background,
            }}
            showsVerticalScrollIndicator={true}
            onScrollBeginDrag={() => Keyboard.dismiss()}
          >
            {isCourseMode ? (
              // Course Mode Content
              <>
                {loadingCourse || loadingCourseList ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>
                      {loadingCourse ? 'AI 코스 추천 중...' : '코스 목록 불러오는 중...'}
                    </Text>
                  </View>
                ) : selectedCourseDetail ? (
                  // Course Detail View from Course List
                  <>
                    <TouchableOpacity
                      style={styles.backToCourseListButton}
                      onPress={() => setSelectedCourseDetail(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.backToCourseListText}>← 코스 목록으로</Text>
                    </TouchableOpacity>
                    <Text style={styles.recommendationsTitle}>
                      {'course' in selectedCourseDetail ? selectedCourseDetail.course.title : selectedCourseDetail.title}
                    </Text>
                    <Text style={styles.courseSummary}>
                      {'course' in selectedCourseDetail ? selectedCourseDetail.course.reasoning : selectedCourseDetail.description}
                    </Text>

                    {/* Route info from saved course */}
                    {!('course' in selectedCourseDetail) && selectedCourseDetail.route_info && (
                      <View style={styles.naverRouteContainer}>
                        <View style={styles.naverRouteSummary}>
                          <View style={styles.naverRouteSummaryItem}>
                            <Text style={styles.naverRouteSummaryLabel}>총 시간</Text>
                            <Text style={styles.naverRouteSummaryValue}>
                              {selectedCourseDetail.route_info.total_duration_text || `${selectedCourseDetail.total_duration}분`}
                            </Text>
                          </View>
                          <View style={styles.naverRouteDivider} />
                          <View style={styles.naverRouteSummaryItem}>
                            <Text style={styles.naverRouteSummaryLabel}>총 거리</Text>
                            <Text style={styles.naverRouteSummaryValue}>
                              {selectedCourseDetail.route_info.total_distance_text || `${(selectedCourseDetail.total_distance / 1000).toFixed(1)}km`}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Places */}
                    {(() => {
                      const stops = 'course' in selectedCourseDetail ? selectedCourseDetail.course.stops : selectedCourseDetail.stops;
                      return stops && stops.map((place: any, index: number) => {
                        const bestBenefit = place.benefits && place.benefits.length > 0 ? place.benefits[0] : null;
                        const cardImage = bestBenefit ? CARD_IMAGES[bestBenefit.card] : null;

                        return (
                          <React.Fragment key={index}>
                            <View style={styles.naverPlaceCard}>
                              <View style={styles.naverPlaceNumber}>
                                <Text style={styles.naverPlaceNumberText}>{index + 1}</Text>
                              </View>

                              <View style={styles.naverPlaceContent}>
                                <View style={styles.naverPlaceMerchant}>
                                  <View style={styles.naverMerchantPlaceholder}>
                                    <Text style={styles.naverMerchantPlaceholderText}>
                                      {place.name.substring(0, 1)}
                                    </Text>
                                  </View>
                                </View>

                                <View style={styles.naverPlaceInfo}>
                                  <Text style={styles.naverPlaceName}>{place.name}</Text>
                                  <Text style={styles.naverPlaceCategory}>{place.category}</Text>
                                  {bestBenefit && (
                                    <View style={styles.naverBenefitInfo}>
                                      <Text style={styles.naverBenefitCard}>{bestBenefit.card}</Text>
                                      <Text style={styles.naverBenefitDetail}>{bestBenefit.benefit}</Text>
                                    </View>
                                  )}
                                </View>

                                {cardImage && (
                                  <Image
                                    source={cardImage}
                                    style={styles.naverCardImage}
                                    resizeMode="contain"
                                  />
                                )}
                              </View>
                            </View>

                            {index < stops.length - 1 && (
                              <View style={styles.naverRouteSegment}>
                                <View style={styles.naverRouteDots}>
                                  <View style={styles.naverRouteDot} />
                                  <View style={styles.naverRouteDot} />
                                  <View style={styles.naverRouteDot} />
                                </View>
                              </View>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </>
                ) : showCourseList ? (
                  // Course List View
                  <View style={styles.courseListContainer}>
                    <Text style={styles.courseListTitle}>추천 코스</Text>

                    {/* AI 추천 코스 */}
                    {aiCourses.length > 0 && aiCourses.slice(0, 2).map((course, index) => (
                      <TouchableOpacity
                        key={`ai-${index}`}
                        style={styles.courseCard}
                        onPress={() => setSelectedCourseDetail(course)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.courseCardHeader}>
                          <Text style={styles.courseCardTitle}>{course.course.title}</Text>
                          <View style={styles.courseCardBadge}>
                            <Text style={styles.courseCardBadgeText}>AI 추천</Text>
                          </View>
                        </View>

                        <View style={styles.courseCardPlaces}>
                          {course.course.stops.slice(0, 3).map((place, placeIndex) => (
                            <React.Fragment key={placeIndex}>
                              <View style={styles.coursePlaceImageContainer}>
                                <View style={styles.coursePlacePlaceholder}>
                                  <Text style={styles.coursePlacePlaceholderText}>
                                    {place.name.substring(0, 1)}
                                  </Text>
                                </View>
                                <Text style={styles.courseListPlaceName} numberOfLines={1}>
                                  {place.name}
                                </Text>
                              </View>
                              {placeIndex < Math.min(course.course.stops.length, 3) - 1 && (
                                <Text style={styles.courseArrow}>→</Text>
                              )}
                            </React.Fragment>
                          ))}
                        </View>

                        <View style={styles.courseCardFooter}>
                          <Text style={styles.courseSavingsText}>
                            {course.course.benefit_summary || '혜택 정보'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                    {/* 사용자 저장 코스 */}
                    {savedCourses.length > 0 && (
                      <TouchableOpacity
                        style={styles.courseCard}
                        onPress={() => setSelectedCourseDetail(savedCourses[0])}
                        activeOpacity={0.7}
                      >
                        <View style={styles.courseCardHeader}>
                          <Text style={styles.courseCardTitle}>{savedCourses[0].title}</Text>
                          <View style={[styles.courseCardBadge, styles.courseCardBadgeSaved]}>
                            <Text style={styles.courseCardBadgeText}>내 코스</Text>
                          </View>
                        </View>

                        <View style={styles.courseCardPlaces}>
                          {savedCourses[0].stops.slice(0, 3).map((place, placeIndex) => (
                            <React.Fragment key={placeIndex}>
                              <View style={styles.coursePlaceImageContainer}>
                                <View style={styles.coursePlacePlaceholder}>
                                  <Text style={styles.coursePlacePlaceholderText}>
                                    {place.name.substring(0, 1)}
                                  </Text>
                                </View>
                                <Text style={styles.courseListPlaceName} numberOfLines={1}>
                                  {place.name}
                                </Text>
                              </View>
                              {placeIndex < Math.min(savedCourses[0].stops.length, 3) - 1 && (
                                <Text style={styles.courseArrow}>→</Text>
                              )}
                            </React.Fragment>
                          ))}
                        </View>

                        <View style={styles.courseCardFooter}>
                          <Text style={styles.courseSavingsText}>
                            {savedCourses[0].description || '저장된 코스'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* 인기 코스 */}
                    {popularCourses.length > 0 && (
                      <TouchableOpacity
                        style={styles.courseCard}
                        onPress={() => setSelectedCourseDetail(popularCourses[0])}
                        activeOpacity={0.7}
                      >
                        <View style={styles.courseCardHeader}>
                          <Text style={styles.courseCardTitle}>{popularCourses[0].title}</Text>
                          <View style={[styles.courseCardBadge, styles.courseCardBadgePopular]}>
                            <Text style={styles.courseCardBadgeText}>핫스팟</Text>
                          </View>
                        </View>

                        <View style={styles.courseCardPlaces}>
                          {popularCourses[0].stops.slice(0, 3).map((place, placeIndex) => (
                            <React.Fragment key={placeIndex}>
                              <View style={styles.coursePlaceImageContainer}>
                                <View style={styles.coursePlacePlaceholder}>
                                  <Text style={styles.coursePlacePlaceholderText}>
                                    {place.name.substring(0, 1)}
                                  </Text>
                                </View>
                                <Text style={styles.courseListPlaceName} numberOfLines={1}>
                                  {place.name}
                                </Text>
                              </View>
                              {placeIndex < Math.min(popularCourses[0].stops.length, 3) - 1 && (
                                <Text style={styles.courseArrow}>→</Text>
                              )}
                            </React.Fragment>
                          ))}
                        </View>

                        <View style={styles.courseCardFooter}>
                          <Text style={styles.courseSavingsText}>
                            {popularCourses[0].save_count}명이 저장한 코스
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* Empty state when no courses */}
                    {aiCourses.length === 0 && savedCourses.length === 0 && popularCourses.length === 0 && (
                      <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>아직 추천 코스가 없습니다</Text>
                        <Text style={styles.emptyStateHint}>원하는 코스를 검색해보세요</Text>
                      </View>
                    )}
                  </View>
                ) : courseResult ? (
                  <>
                    <Text style={styles.recommendationsTitle}>{courseResult.course.title}</Text>
                    <Text style={styles.courseSummary}>{courseResult.course.reasoning}</Text>

                    <TouchableOpacity
                      style={[
                        styles.saveCourseButton,
                        (courseSaved || savingCourse) && styles.saveCourseButtonDisabled
                      ]}
                      onPress={handleSaveCourse}
                      disabled={courseSaved || savingCourse}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.saveCourseButtonText}>
                        {savingCourse ? '저장 중...' : courseSaved ? '✓ 저장됨' : '💾 코스 저장'}
                      </Text>
                    </TouchableOpacity>

                    {courseRoute && (
                      <View style={styles.naverRouteContainer}>
                        <View style={styles.naverRouteSummary}>
                          <View style={styles.naverRouteSummaryItem}>
                            <Text style={styles.naverRouteSummaryLabel}>총 시간</Text>
                            <Text style={styles.naverRouteSummaryValue}>{courseRoute.total_duration_text}</Text>
                          </View>
                          <View style={styles.naverRouteDivider} />
                          <View style={styles.naverRouteSummaryItem}>
                            <Text style={styles.naverRouteSummaryLabel}>총 거리</Text>
                            <Text style={styles.naverRouteSummaryValue}>{courseRoute.total_distance_text}</Text>
                          </View>
                          {courseRoute.total_fare > 0 && (
                            <>
                              <View style={styles.naverRouteDivider} />
                              <View style={styles.naverRouteSummaryItem}>
                                <Text style={styles.naverRouteSummaryLabel}>교통비</Text>
                                <Text style={styles.naverRouteSummaryValue}>{courseRoute.total_fare_text}</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                    )}

                    {courseResult.course && courseResult.course.stops && courseResult.course.stops.map((place, index) => {
                      const bestBenefit = place.benefits && place.benefits.length > 0 ? place.benefits[0] : null;
                      const cardImage = bestBenefit ? CARD_IMAGES[bestBenefit.card] : null;

                      return (
                        <React.Fragment key={index}>
                          <View style={styles.naverPlaceCard}>
                            <View style={styles.naverPlaceNumber}>
                              <Text style={styles.naverPlaceNumberText}>{index + 1}</Text>
                            </View>

                            <View style={styles.naverPlaceContent}>
                              <View style={styles.naverPlaceMerchant}>
                                <View style={styles.naverMerchantPlaceholder}>
                                  <Text style={styles.naverMerchantPlaceholderText}>
                                    {place.name.substring(0, 1)}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.naverPlaceInfo}>
                                <Text style={styles.naverPlaceName}>{place.name}</Text>
                                <Text style={styles.naverPlaceCategory}>{place.category}</Text>
                                {bestBenefit && (
                                  <View style={styles.naverBenefitInfo}>
                                    <Text style={styles.naverBenefitCard}>{bestBenefit.card}</Text>
                                    <Text style={styles.naverBenefitDetail}>{bestBenefit.benefit}</Text>
                                  </View>
                                )}
                              </View>

                              {cardImage && (
                                <Image
                                  source={cardImage}
                                  style={styles.naverCardImage}
                                  resizeMode="contain"
                                />
                              )}
                            </View>
                          </View>

                          {courseRoute && courseRoute.legs_summary && courseRoute.legs_summary[index] && index < courseResult.course.stops.length - 1 && (
                            <View style={styles.naverRouteSegment}>
                              <View style={styles.naverRouteDots}>
                                <View style={styles.naverRouteDot} />
                                <View style={styles.naverRouteDot} />
                                <View style={styles.naverRouteDot} />
                              </View>
                              <View style={styles.naverRouteDetails}>
                                <View style={styles.naverRouteMode}>
                                  <Text style={styles.naverRouteModeText}>
                                    {courseRoute.legs_summary[index].mode === 'walking' ? '도보' :
                                     courseRoute.legs_summary[index].mode === 'transit' ? '대중교통' : '이동'}
                                  </Text>
                                </View>
                                <Text style={styles.naverRouteSegmentText}>
                                  {courseRoute.legs_summary[index].distance_text} · {courseRoute.legs_summary[index].duration_text}
                                  {courseRoute.legs_summary[index].fare && courseRoute.legs_summary[index].fare > 0 && ` · ${courseRoute.legs_summary[index].fare}원`}
                                </Text>
                              </View>
                            </View>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>원하는 코스를 검색해보세요</Text>
                    <Text style={styles.emptyStateHint}>예: "카페에서 커피 마시고 점심 먹고 싶어"</Text>
                  </View>
                )}
              </>
            ) : selectedStore ? (
              <>

                {loadingRecommendations ? (
                  <Text style={styles.loadingText}>카드 혜택 조회 중...</Text>
                ) : (
                  <>
                    <Text style={styles.recommendationsTitle}>내 카드 혜택 순위</Text>
                    {recommendations.map((rec) => {
                      const selectedCardName = userCards[selectedCardIndex];
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
                                {CARD_IMAGES[rec.card] ? (
                                  <Image
                                    source={CARD_IMAGES[rec.card]}
                                    style={styles.recommendationCardImage}
                                    resizeMode="contain"
                                  />
                                ) : (
                                  <CardPlaceholder
                                    cardName={rec.card}
                                    benefit={rec.benefit_summary}
                                    width={80}
                                    height={50}
                                    style={styles.recommendationCardImage}
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

                      {store.top_card && (
                        CARD_IMAGES[store.top_card.card] ? (
                          <Image
                            source={CARD_IMAGES[store.top_card.card]}
                            style={styles.cardImage}
                            resizeMode="contain"
                          />
                        ) : (
                          <CardPlaceholder
                            cardName={store.top_card.card}
                            benefit={store.top_card.benefit}
                            width={80}
                            height={50}
                            style={styles.cardImage}
                          />
                        )
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
          <ProfileScreen onBack={() => setShowProfile(false)} onLogout={onLogout} />
        </View>
      )}
      {showOnePay && (
        <View style={styles.profileOverlay}>
          <OnePayScreen onBack={() => setShowOnePay(false)} />
        </View>
      )}
      <LocationDebugModal
        visible={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        onLocationSet={handleDebugLocationSet}
        onReset={handleResetLocation}
        onForceIndoor={() => setForceIndoorMode(!forceIndoorMode)}
        isForceIndoor={forceIndoorMode}
      />

      {/* People Picker Modal */}
      <Modal
        visible={showPeoplePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPeoplePicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPeoplePicker(false)}>
          <View style={styles.pickerModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.pickerModalContent}>
                <Text style={styles.pickerModalTitle}>인원 선택</Text>
                <ScrollView style={styles.pickerScrollView}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.pickerOption,
                        numPeople === num && styles.pickerOptionActive,
                      ]}
                      onPress={() => {
                        setNumPeople(num);
                        setShowPeoplePicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          numPeople === num && styles.pickerOptionTextActive,
                        ]}
                      >
                        {num}명
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Budget Picker Modal */}
      <Modal
        visible={showBudgetPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBudgetPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowBudgetPicker(false)}>
          <View style={styles.pickerModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.pickerModalContent}>
                <Text style={styles.pickerModalTitle}>예산 선택</Text>
                <ScrollView style={styles.pickerScrollView}>
                  {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[
                        styles.pickerOption,
                        budget === amount * 10000 && styles.pickerOptionActive,
                      ]}
                      onPress={() => {
                        setBudget(amount * 10000);
                        setShowBudgetPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          budget === amount * 10000 && styles.pickerOptionTextActive,
                        ]}
                      >
                        {amount}만 원
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  searchBarAIMode: {
    backgroundColor: '#FAE8D7',
  },
  courseFiltersContainer: {
    position: 'absolute',
    top: 108,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  filterButtonsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  courseFilterButton: {
    backgroundColor: '#E5EDF4',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },
  courseFilterButtonText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#212121',
  },
  courseFilterButtonTextBold: {
    fontFamily: FONTS.bold,
  },
  myCoursesButton: {
    backgroundColor: '#FFF0B3',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  myCoursesButtonText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#212121',
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
    color: '#000000',
    marginRight: 8,
  },
  categoryWrapper: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
  },
  categoryScrollView: {
    flexGrow: 0,
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
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
  },
  courseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  courseText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#000000',
  },
  bottomSheetContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
  },
  debugButton: {
    position: 'absolute',
    top: 160,
    left: 20,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  debugButtonText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  debugIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  searchAreaButton: {
    alignSelf: 'center',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  searchAreaButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  // Course Mode Styles
  courseSummary: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginBottom: 16,
    paddingHorizontal: 12,
    lineHeight: 22,
  },
  routeInfo: {
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginHorizontal: 12,
  },
  routeInfoText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#333333',
    marginBottom: 4,
  },
  naverRouteContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  naverRouteSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  naverRouteSummaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  naverRouteSummaryLabel: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginBottom: 4,
  },
  naverRouteSummaryValue: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#333333',
  },
  naverRouteDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  coursePlaceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  coursePlaceNumber: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coursePlaceNumberText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  coursePlaceInfo: {
    marginLeft: 48,
  },
  coursePlaceName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#000000',
    marginBottom: 4,
  },
  coursePlaceCategory: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginBottom: 8,
  },
  benefitsContainer: {
    marginTop: 8,
    gap: 6,
  },
  benefitChip: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  benefitChipText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#1976D2',
  },
  benefitChipDetail: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginTop: 2,
  },
  legInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  legMode: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#007AFF',
  },
  legDistance: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  legDuration: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: '#666666',
    marginBottom: 8,
  },
  emptyStateHint: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
    textAlign: 'center',
  },
  // Naver-style Course Place Cards
  naverPlaceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  naverPlaceNumber: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4AA63C',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  naverPlaceNumberText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  naverPlaceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingLeft: 52,
    gap: 12,
  },
  naverPlaceMerchant: {
    marginRight: 4,
  },
  naverMerchantPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  naverMerchantPlaceholderText: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#999999',
  },
  naverPlaceInfo: {
    flex: 1,
  },
  naverPlaceName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 4,
  },
  naverPlaceCategory: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginBottom: 8,
  },
  naverBenefitInfo: {
    backgroundColor: '#F0F8EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  naverBenefitCard: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
    marginBottom: 2,
  },
  naverBenefitDetail: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  naverCardImage: {
    width: 70,
    height: 44,
    borderRadius: 6,
  },
  // Naver-style Route Segment
  naverRouteSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 40,
    paddingRight: 20,
    paddingVertical: 8,
    marginHorizontal: 12,
  },
  naverRouteDots: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginRight: 12,
  },
  naverRouteDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0D0',
  },
  naverRouteDetails: {
    flex: 1,
  },
  naverRouteMode: {
    marginBottom: 4,
  },
  naverRouteModeText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#666666',
  },
  naverRouteSegmentText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerScrollView: {
    maxHeight: 300,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
  },
  pickerOptionActive: {
    backgroundColor: '#E5EDF4',
  },
  pickerOptionText: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: '#212121',
    textAlign: 'center',
  },
  pickerOptionTextActive: {
    fontFamily: FONTS.bold,
    color: '#000000',
  },
  // Course List Styles
  backToCourseListButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  backToCourseListText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
  },
  courseListContainer: {
    paddingTop: 8,
  },
  courseListTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  courseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  courseCardTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginRight: 8,
  },
  courseCardBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  courseCardBadgeSaved: {
    backgroundColor: '#FFF0B3',
  },
  courseCardBadgePopular: {
    backgroundColor: '#FFE5E5',
  },
  courseCardBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
  },
  courseCardPlaces: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  coursePlaceImageContainer: {
    alignItems: 'center',
    flex: 1,
  },
  coursePlacePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  coursePlacePlaceholderText: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: '#999999',
  },
  courseListPlaceName: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#666666',
    textAlign: 'center',
  },
  courseArrow: {
    fontSize: 20,
    color: '#CCCCCC',
    marginHorizontal: 4,
  },
  courseCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  courseSavingsText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#22B573',
  },
  saveCourseButton: {
    backgroundColor: '#22B573',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  saveCourseButtonDisabled: {
    backgroundColor: '#B0B0B0',
    opacity: 0.6,
  },
  saveCourseButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  backFromCourseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  backFromCourseButtonText: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#393A39',
  },
});
