import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Platform, Alert, TextInput, Keyboard, TouchableWithoutFeedback, Image, StatusBar, FlatList, Animated, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NaverMapView, NaverMapMarkerOverlay, NaverMapPolylineOverlay } from '@mj-studio/react-native-naver-map';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SearchIcon, StarsIcon, CafeIcon, CoffeeIcon, FoodIcon, CartIcon, CardsIcon, LocationMarkerIcon, StorePinIcon, StarIcon, MyLocationIcon, SearchPinIcon, RefreshIcon, CourseIcon, SavedCourseIcon, BackIcon, CloseIcon, ChatIcon, ChevronRightIcon } from '../components/svg';
import { FONTS, COLORS } from '../constants/theme';
import * as Location from 'expo-location';
import axios from 'axios';
import { USER_CARDS, CARD_IMAGES } from '../constants/userCards';
import { API_URL } from '../utils/api';
import { getMerchantLogo } from '../constants/merchantImages';
import { AuthStorage } from '../utils/auth';
import { CardPlaceholder } from '../components/CardPlaceholder';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileScreen } from './ProfileScreen';
import { OnePayScreen } from './OnePayScreen';
import { FriendsScreen } from './FriendsScreen';
import { ChatListScreen } from './ChatListScreen';
import { ChatRoomScreen } from './ChatRoomScreen';
import { Conversation } from '../utils/userWebSocket';
import { useNotifications } from '../contexts/NotificationContext';
import { LocationDebugModal } from '../components/LocationDebugModal';
import { calculateDistance } from '../constants/mapUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WheelPicker from 'react-native-wheely';
import { CourseLoadingView } from '../components/CourseLoadingView';
import { PlaceDetailView } from '../components/PlaceDetailView';
import { RouteDetailView } from '../components/RouteDetailView';

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
  photo_url?: string;
  place_id?: string;
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

interface TransitLegDetail {
  mode: 'WALK' | 'BUS' | 'SUBWAY';
  duration: number;
  duration_text: string;
  name: string;
  routeColor?: string;
  typeName?: string;
  stopCount?: number;
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
  transit_legs?: TransitLegDetail[];
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
  place_id?: string;
  photo_url?: string;
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
    legs_summary?: CourseLeg[];  // TMAP polyline included
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
  shared_by?: {
    user_id: string;
    user_name: string;
  };
}

interface PopularCourse extends SavedCourse {
  save_count: number;
}

interface HomeScreenProps {
  onLogout?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onLogout }) => {
  const insets = useSafeAreaInsets();
  const { unreadCount, setNavigationCallbacks } = useNotifications();
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<Array<{
    place_id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    types: string[];
  }>>([]);
  const [searchHistory, setSearchHistory] = useState<Array<{
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  }>>([]);
  const [loadingSearchSuggestions, setLoadingSearchSuggestions] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [favoriteStores, setFavoriteStores] = useState<Set<string>>(new Set());
  const [showProfile, setShowProfile] = useState(false);
  const [showOnePay, setShowOnePay] = useState(false);
  const [showPlaceDetail, setShowPlaceDetail] = useState(false);
  const [showRouteDetail, setShowRouteDetail] = useState(false);
  const [selectedRouteSegment, setSelectedRouteSegment] = useState<{
    start: { latitude: number; longitude: number };
    end: { latitude: number; longitude: number };
    startName: string;
    endName: string;
    endPlaceId?: string;
  } | null>(null);
  const [preSelectedCardIdForOnePay, setPreSelectedCardIdForOnePay] = useState<number | string | null>(null);
  const [isInsideBuilding, setIsInsideBuilding] = useState(false);
  const [filterSort, setFilterSort] = useState<'benefit' | 'distance' | 'recommend'>('recommend');
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
  const [sharedCourses, setSharedCourses] = useState<SavedCourse[]>([]);
  const [loadingCourseList, setLoadingCourseList] = useState(false);

  // Selected course detail
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<SavedCourse | AICourseResult | null>(null);
  const [courseSaved, setCourseSaved] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);

  // Friends
  const [showFriends, setShowFriends] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingCourseId, setSharingCourseId] = useState<string | null>(null);

  // Chat
  const [showChatList, setShowChatList] = useState(false);
  const [showChatRoom, setShowChatRoom] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<any>(null);
  const cardScrollRef = useRef<FlatList>(null);
  const isScrollingToCard = useRef(false);
  const snapPoints = useMemo(() => ['25%', '45%', '70%', '87%'], []);

  // Animation for course mode transition
  const courseModeAnimation = useRef(new Animated.Value(0)).current;
  const searchBarScaleAnim = useRef(new Animated.Value(1)).current;
  const searchBarBorderAnim = useRef(new Animated.Value(0)).current;
  const neonRotationAnim = useRef(new Animated.Value(0)).current;
  const neonAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // 카드 애니메이션 값 배열
  const cardScaleAnims = useRef<Animated.Value[]>([]).current;

  // Progress section 애니메이션 (height 기반)
  const progressHeightAnim = useRef(new Animated.Value(0)).current;

  // Store detail slide 애니메이션
  const storeDetailSlideAnim = useRef(new Animated.Value(0)).current;

  // 로딩 애니메이션 (점 3개)
  const loadingDot1 = useRef(new Animated.Value(0)).current;
  const loadingDot2 = useRef(new Animated.Value(0)).current;
  const loadingDot3 = useRef(new Animated.Value(0)).current;

  // Course card animations
  const courseCardAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const courseDetailFadeAnim = useRef(new Animated.Value(0)).current;
  const placeCardAnims = useRef<Animated.Value[]>([]).current;
  const routeProgressAnim = useRef(new Animated.Value(0)).current;
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search history key for AsyncStorage
  const SEARCH_HISTORY_KEY = 'cardealo_search_history';

  // Load search history from AsyncStorage
  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  // Save search to history
  const saveToSearchHistory = async (item: { name: string; address: string; latitude: number; longitude: number }) => {
    try {
      const newHistory = [item, ...searchHistory.filter(h => h.name !== item.name)].slice(0, 10);
      setSearchHistory(newHistory);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  };

  // Clear search history
  const clearSearchHistory = async () => {
    try {
      setSearchHistory([]);
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  };

  // Fetch search suggestions with debounce
  const fetchSearchSuggestions = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    setLoadingSearchSuggestions(true);
    try {
      const params: any = { query, limit: 8 };
      if (userLocation) {
        params.latitude = userLocation.latitude;
        params.longitude = userLocation.longitude;
      }

      const response = await axios.get(`${API_URL}/api/search-autocomplete`, { params });
      if (response.data.results) {
        setSearchSuggestions(response.data.results);
      }
    } catch (error) {
      console.error('Failed to fetch search suggestions:', error);
      setSearchSuggestions([]);
    } finally {
      setLoadingSearchSuggestions(false);
    }
  };

  // Handle search query change with debounce
  const handleSearchQueryChange = (text: string) => {
    setSearchQuery(text);

    // Clear previous debounce
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Debounce API call
    searchDebounceRef.current = setTimeout(() => {
      fetchSearchSuggestions(text);
    }, 300);
  };

  // Handle selecting a search result
  const handleSelectSearchResult = async (item: { name: string; address: string; latitude: number; longitude: number }) => {
    // Save to history
    await saveToSearchHistory(item);

    // Clear search state
    setSearchQuery(item.name);
    setIsSearchFocused(false);
    setSearchSuggestions([]);
    Keyboard.dismiss();

    // Clear category filter
    setSelectedCategory(null);

    // Save search result location
    setSearchResultLocation({
      latitude: item.latitude,
      longitude: item.longitude,
      name: item.name,
    });

    // Move map to search result
    if (mapRef.current) {
      mapRef.current.animateCameraTo({
        latitude: item.latitude,
        longitude: item.longitude,
        zoom: 16,
        duration: 500,
      });
    }

    // Fetch nearby stores at search location
    fetchNearbyStores(item.latitude, item.longitude, currentSearchRadius);
  };

  // Get or create animation for course card
  const getCourseCardAnim = (key: string) => {
    if (!courseCardAnims[key]) {
      courseCardAnims[key] = new Animated.Value(0);
    }
    return courseCardAnims[key];
  };

  // Animate course cards entrance
  const animateCourseCards = (count: number) => {
    const animations: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < count; i++) {
      const anim = getCourseCardAnim(`course-${i}`);
      anim.setValue(0);
      animations.push(
        Animated.spring(anim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          delay: i * 80,
          useNativeDriver: true,
        })
      );
    }
    Animated.stagger(80, animations).start();
  };

  // Animate place cards in detail view
  const animatePlaceCards = (count: number) => {
    // Reset and create animations
    placeCardAnims.length = 0;
    for (let i = 0; i < count; i++) {
      placeCardAnims.push(new Animated.Value(0));
    }

    // Animate each card with stagger
    const animations = placeCardAnims.map((anim, index) =>
      Animated.spring(anim, {
        toValue: 1,
        friction: 8,
        tension: 50,
        delay: index * 100,
        useNativeDriver: true,
      })
    );

    Animated.stagger(100, animations).start();

    // Animate route progress
    Animated.timing(routeProgressAnim, {
      toValue: 1,
      duration: 800 + (count * 200),
      useNativeDriver: false,
    }).start();
  };

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
    // Find the user's actual card data by matching card name
    const userCard = userCards.find(card => card.card_name === rec.card);

    if (userCard) {
      // Use real data from user's card
      const usedBenefit = userCard.used_amount || 0;
      const totalBenefitLimit = userCard.monthly_limit || rec.monthly_limit || 300000;
      const currentPerformance = userCard.monthly_performance || 0;
      const requiredPerformance = userCard.card_pre_month_money || rec.pre_month_money || 0;

      return {
        currentPerformance,
        requiredPerformance,
        usedBenefit,
        totalBenefitLimit,
        remainingBenefit: totalBenefitLimit - usedBenefit,
      };
    }

    // Fallback to recommendation data if user doesn't have this card
    return {
      currentPerformance: 0,
      requiredPerformance: rec.pre_month_money,
      usedBenefit: 0,
      totalBenefitLimit: rec.monthly_limit,
      remainingBenefit: rec.monthly_limit,
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
        return <CourseIcon width={20} height={19} color="#D4A853" />;
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
        console.error('[fetchUserCards] No token found, using empty array');
        setUserCards([]);
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
        console.log('[fetchUserCards] Fetched all cards (personal + corporate):', allCards);
        setUserCards(allCards);
      } else {
        console.error('[fetchUserCards] Failed to fetch user cards, using empty array');
        setUserCards([]);
      }
    } catch (error) {
      console.error('[fetchUserCards] Error fetching user cards:', error);
      setUserCards([]);
    }
  };

  useEffect(() => {
    requestLocationPermission();
    fetchUserCards();
    loadFavorites();
    loadSearchHistory();
  }, []);

  // Register notification navigation callbacks
  useEffect(() => {
    setNavigationCallbacks({
      navigateToChat: (_conversationId: number) => {
        // Open chat list - user can find the conversation there
        setShowChatList(true);
      },
      navigateToNotifications: () => {
        // Open chat list as notification center
        setShowChatList(true);
      },
      navigateToCourse: (_courseId?: number) => {
        // Switch to course mode
        if (!isCourseMode) {
          setIsCourseMode(true);
          setSelectedCategory('course');
          loadCourseList();
        }
      },
    });
  }, [isCourseMode, setNavigationCallbacks]);

  // Animate course mode transition
  useEffect(() => {
    if (isCourseMode) {
      // Enter course mode - sophisticated animation sequence
      Animated.parallel([
        Animated.timing(courseModeAnimation, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.timing(searchBarScaleAnim, {
            toValue: 1.02,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.spring(searchBarScaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 100,
            useNativeDriver: false,
          }),
        ]),
        Animated.timing(searchBarBorderAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start();

      // Start neon rotation animation
      neonRotationAnim.setValue(0);
      neonAnimationRef.current = Animated.loop(
        Animated.timing(neonRotationAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
          easing: (t) => t, // Linear easing
        })
      );
      neonAnimationRef.current.start();
    } else {
      // Exit course mode
      Animated.parallel([
        Animated.timing(courseModeAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(searchBarScaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(searchBarBorderAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();

      // Stop neon animation
      if (neonAnimationRef.current) {
        neonAnimationRef.current.stop();
        neonAnimationRef.current = null;
      }
    }
  }, [isCourseMode]);

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

  // 즐겨찾기 불러오기
  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem('favoriteStores');
      if (stored) {
        const parsed = JSON.parse(stored);
        setFavoriteStores(new Set(parsed));
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  // 즐겨찾기 저장하기
  const saveFavorites = async (favorites: Set<string>) => {
    try {
      await AsyncStorage.setItem('favoriteStores', JSON.stringify([...favorites]));
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  };

  const toggleFavorite = (storeName: string) => {
    const newFavorites = new Set(favoriteStores);
    if (newFavorites.has(storeName)) {
      newFavorites.delete(storeName);
    } else {
      newFavorites.add(storeName);
    }
    saveFavorites(newFavorites);
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

  // 기본 fallback 위치 (고려대학교 근처)
  const DEFAULT_LOCATION = {
    latitude: 37.5898,
    longitude: 127.0323,
  };

  const requestLocationPermission = async () => {
    // 5초 타임아웃 설정
    const locationTimeout = 5000;
    let timeoutId: NodeJS.Timeout | null = null;

    const useDefaultLocation = () => {
      console.log('[Location] 기본 위치 사용 (fallback)');
      setUserLocation(DEFAULT_LOCATION);
      fetchNearbyStores(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude, currentSearchRadius);
    };

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          '위치 권한 필요',
          '위치 권한이 없어 기본 위치로 설정됩니다.',
          [{ text: '확인', onPress: useDefaultLocation }]
        );
        return;
      }

      // 타임아웃 Promise 생성
      const timeoutPromise = new Promise<null>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Location timeout'));
        }, locationTimeout);
      });

      // Try to get last known position first (faster)
      try {
        const lastKnown = await Promise.race([
          Location.getLastKnownPositionAsync(),
          timeoutPromise,
        ]);

        if (timeoutId) clearTimeout(timeoutId);

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
            console.log('[Location] 에뮬레이터 기본 위치 감지 (미국), 기본 위치 사용');
            useDefaultLocation();
            return;
          }
          setRealUserLocation(coords);
          setUserLocation(coords);
          fetchNearbyStores(coords.latitude, coords.longitude, currentSearchRadius);
          return;
        }
      } catch (e) {
        console.log('[Location] Last known position failed or timeout');
      }

      // Reset timeout for getCurrentPosition
      if (timeoutId) clearTimeout(timeoutId);
      const currentTimeoutPromise = new Promise<null>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Location timeout'));
        }, locationTimeout);
      });

      // If no last known position, get current position
      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        currentTimeoutPromise,
      ]);

      if (timeoutId) clearTimeout(timeoutId);

      if (!location) {
        useDefaultLocation();
        return;
      }

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      const accuracy = location.coords.accuracy || null;

      console.log(`[Location] Current position - accuracy: ${accuracy}m`);
      setGpsAccuracy(accuracy);

      // Check if location is in USA (emulator default)
      if (coords.latitude > 36 && coords.latitude < 38 && coords.longitude > -123 && coords.longitude < -121) {
        console.log('[Location] 에뮬레이터 기본 위치 감지 (미국), 기본 위치 사용');
        useDefaultLocation();
        return;
      }
      setRealUserLocation(coords);
      setUserLocation(coords);
      fetchNearbyStores(coords.latitude, coords.longitude, currentSearchRadius);
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('위치 가져오기 실패:', error);
      console.log('[Location] 위치 가져오기 실패, 기본 위치 사용');
      useDefaultLocation();
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
        cards: userCards.map(card => card.card_name).join(','),
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

  // 목록으로 돌아가기 (슬라이드 애니메이션)
  const handleBackToList = () => {
    Keyboard.dismiss();
    Animated.timing(storeDetailSlideAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setSelectedStore(null);
      setRecommendations([]);
      setSelectedCardIndex(0);
      storeDetailSlideAnim.setValue(0);
      bottomSheetRef.current?.snapToIndex(1);
    });
  };

  const handleMarkerClick = async (store: StoreCard) => {
    Keyboard.dismiss();
    storeDetailSlideAnim.setValue(0);
    setSelectedStore(store);
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
        user_cards: userCards.map(card => card.card_name),
      });

      const recs = response.data.recommendations;
      setRecommendations(recs);

      // Auto-select the highest benefit score card (rank 1)
      if (recs && recs.length > 0) {
        const topCard = recs[0]; // rank 1 card (highest score)
        const cardIndex = userCards.findIndex(card => card.card_name === topCard.card);
        if (cardIndex !== -1) {
          isScrollingToCard.current = true;
          setSelectedCardIndex(cardIndex);
          setTimeout(() => {
            cardScrollRef.current?.scrollToIndex({
              index: cardIndex,
              animated: true
            });
          }, 100);
        } else {
          setSelectedCardIndex(0);
        }
      } else {
        setSelectedCardIndex(0);
      }
    } catch (error) {
      console.error('상세 혜택 조회 실패:', error);
      Alert.alert('오류', '상세 혜택 정보를 가져올 수 없습니다.');
      setSelectedCardIndex(0);
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
        user_cards: userCards.map(card => card.card_name),
        max_distance: 5000,
      }, {
        timeout: 120000, // 2 minutes timeout for AI processing
      });

      const result: AICourseResult = response.data;
      console.log('[Course] 추천 결과:', result);

      // Add to AI courses list (keep only last 2)
      setAiCourses(prev => {
        const updated = [result, ...prev];
        return updated.slice(0, 2);
      });

      // Show course list view
      setCourseResult(null);
      setCourseRoute(null);
      setShowCourseList(true);

      // Trigger animation for AI course cards
      setTimeout(() => {
        animateCourseCards(2);
      }, 100);

      bottomSheetRef.current?.snapToIndex(2);
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

  // Handle course selection from course list
  const handleCourseSelect = async (course: SavedCourse | AICourseResult) => {
    console.log('[Course] 코스 선택:', course);

    // Convert SavedCourse or AICourseResult to AICourseResult format
    const courseResult: AICourseResult = 'course' in course
      ? course // Already AICourseResult
      : {
          // Convert SavedCourse to AICourseResult
          intent: {
            theme: '',
            keywords: [],
            categories: [],
            num_places: course.stops.length,
            preferences: {},
          },
          course: {
            title: course.title,
            reasoning: course.description || '',
            stops: course.stops,
            benefit_summary: '',
            routes: [],
            legs_summary: course.route_info?.legs_summary,  // Use saved route info
            total_distance: course.total_distance,
            total_duration: course.total_duration,
            total_benefit_score: course.total_benefit_score || 0,
          }
        };

    setCourseResult(courseResult);
    setShowCourseList(false);
    // SavedCourse (no 'course' property) means it's already saved in DB
    setCourseSaved(!('course' in course));

    // Reset route progress animation
    routeProgressAnim.setValue(0);

    // Check if we already have legs_summary with polylines from TMAP
    // For AICourseResult (new recommendation), use cached data
    // For SavedCourse (from database), always recalculate based on current user location
    const isAICourseResult = 'course' in course;
    const existingLegsSummary = isAICourseResult
      ? course.course.legs_summary
      : null; // Don't use saved legs_summary - user location may have changed

    const hasValidPolylines = existingLegsSummary?.some(leg => leg.polyline && leg.polyline.length > 0);

    // Get stops
    const stops = isAICourseResult ? course.course.stops : course.stops;

    if (stops && stops.length > 0) {
      if (hasValidPolylines && existingLegsSummary) {
        // Use existing TMAP polylines directly (only for fresh AI recommendations)
        console.log('[Course Route] 기존 TMAP polyline 사용');
        const existingRoute: CourseRoute = {
          status: 'OK',
          legs_summary: existingLegsSummary,
          total_distance: courseResult.course.total_distance,
          total_duration: courseResult.course.total_duration,
          total_fare: 0,
          total_distance_text: `${(courseResult.course.total_distance / 1000).toFixed(1)} km`,
          total_duration_text: `${Math.round(courseResult.course.total_duration)}분`,
          total_fare_text: '',
        };
        setCourseRoute(existingRoute);
      } else {
        // For saved courses or if no polylines, recalculate with current user location
        console.log('[Course Route] 현재 위치 기준 경로 재계산');
        await fetchCourseRoute(stops);
      }

      // Move map to first place
      if (mapRef.current) {
        const firstPlace = stops[0];
        mapRef.current.animateCameraTo({
          latitude: firstPlace.latitude,
          longitude: firstPlace.longitude,
          zoom: 14,
          duration: 500,
        });
      }

      // Trigger place card animations
      setTimeout(() => {
        animatePlaceCards(stops.length);
      }, 200);
    }

    // Expand bottom sheet
    bottomSheetRef.current?.snapToIndex(3);
  };

  // Handle viewing shared course from chat
  const handleViewSharedCourse = async (course: { id: string; title: string; description: string }) => {
    // Close chat room first and wait for it to close
    setShowChatRoom(false);
    setSelectedConversation(null);
    setShowChatList(false);

    // Wait for chat room to fully close before switching to course mode
    await new Promise(resolve => setTimeout(resolve, 350));

    // Switch to course mode
    setIsCourseMode(true);

    // Look for the course in existing loaded courses
    const allCourses = [...savedCourses, ...sharedCourses, ...popularCourses];
    const foundCourse = allCourses.find(c => c.id === course.id);

    if (foundCourse) {
      // Found in cached courses, use it directly
      await handleCourseSelect(foundCourse);
    } else {
      // Not found in cache, try to fetch from API
      try {
        const token = await AuthStorage.getToken();
        if (!token) return;

        const response = await axios.get(`${API_URL}/api/course/${course.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data.success && response.data.course) {
          await handleCourseSelect(response.data.course);
        } else {
          Alert.alert('알림', '코스를 찾을 수 없습니다.');
        }
      } catch (error) {
        console.error('Failed to fetch shared course:', error);
        Alert.alert('알림', '코스를 불러올 수 없습니다.');
      }
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

      // AI 코스 목록 초기화 (저장된 코스는 savedCourses에서 표시됨)
      setAiCourses([]);

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

  const fetchSharedCourses = async () => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      console.log('[Course] 공유받은 코스 불러오기...');

      const response = await axios.get(`${API_URL}/api/course/shared?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success && response.data.courses) {
        setSharedCourses(response.data.courses);
        console.log('[Course] 공유받은 코스:', response.data.courses.length);
      }
    } catch (error: any) {
      console.error('[Course] 공유받은 코스 불러오기 실패:', error);
    }
  };

  const handleShareCourse = async (courseId: string, friendIds: string[]) => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) {
        Alert.alert('안내', '로그인이 필요합니다.');
        return;
      }

      const response = await axios.post(
        `${API_URL}/api/course/share`,
        { course_id: courseId, friend_ids: friendIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert('성공', '코스를 공유했습니다.');
        setShowShareModal(false);
        setSharingCourseId(null);
      } else {
        Alert.alert('오류', response.data.error || '공유에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('[Course] 코스 공유 실패:', error);
      Alert.alert('오류', '코스 공유에 실패했습니다.');
    }
  };

  const loadCourseList = async () => {
    setLoadingCourseList(true);
    try {
      await Promise.all([
        fetchSavedCourses(),
        fetchPopularCourses(),
        fetchSharedCourses(),
      ]);
      // Trigger entrance animations after data loads
      setTimeout(() => {
        const totalCards = aiCourses.length + savedCourses.length + sharedCourses.length + popularCourses.length;
        animateCourseCards(Math.min(totalCards, 10));
      }, 100);
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
    const cardIndex = userCards.findIndex(card => card.card_name === cardName);
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

  const renderCardItem = ({ item: card, index }: { item: typeof userCards[0]; index: number }) => {
    const isLast = index === userCards.length - 1;
    const cardName = card.card_name;

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
          const filteredStores = stores.filter(store => {
            if (!selectedCategory) return true;
            if (selectedCategory === 'favorites') return favoriteStores.has(store.name);
            return store.category === selectedCategory;
          });
          const allScores = filteredStores
            .map(store => store.top_card?.score || 0)
            .filter(score => score > 0);

          return filteredStores.map((store, index) => {
            // 모든 마커 표시 (성능을 위해 최대 50개로 제한됨 - fetchNearbyStores에서)
            // 줌 레벨이 낮을 때도 모든 마커 표시

            const score = store.top_card?.score || 0;
            const benefitLevel = score > 0 ? getBenefitLevel(score, allScores) : 'none';

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

      {/* Hide search bar when showing course result detail */}
      {!(isCourseMode && courseResult && !showCourseList) && (
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
            activeOpacity={0.8}
          >
            <BackIcon width={18} height={18} color="#666666" />
          </TouchableOpacity>
        )}
        <View style={styles.searchBarWrapper}>
          {/* Neon border glow effect for course mode */}
          {isCourseMode && (
            <View style={styles.neonBorderContainer}>
              {/* Top edge */}
              <Animated.View style={[
                styles.neonEdge,
                styles.neonEdgeTop,
                {
                  opacity: neonRotationAnim.interpolate({
                    inputRange: [0, 0.1, 0.25, 0.35, 1],
                    outputRange: [0.3, 1, 1, 0.3, 0.3],
                  }),
                }
              ]}>
                <LinearGradient
                  colors={['transparent', '#909090', '#C0C0C0', '#909090', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.neonGradient}
                />
              </Animated.View>
              {/* Right edge */}
              <Animated.View style={[
                styles.neonEdge,
                styles.neonEdgeRight,
                {
                  opacity: neonRotationAnim.interpolate({
                    inputRange: [0, 0.25, 0.35, 0.5, 0.6, 1],
                    outputRange: [0.3, 0.3, 1, 1, 0.3, 0.3],
                  }),
                }
              ]}>
                <LinearGradient
                  colors={['transparent', '#909090', '#C0C0C0', '#909090', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.neonGradient}
                />
              </Animated.View>
              {/* Bottom edge */}
              <Animated.View style={[
                styles.neonEdge,
                styles.neonEdgeBottom,
                {
                  opacity: neonRotationAnim.interpolate({
                    inputRange: [0, 0.5, 0.6, 0.75, 0.85, 1],
                    outputRange: [0.3, 0.3, 1, 1, 0.3, 0.3],
                  }),
                }
              ]}>
                <LinearGradient
                  colors={['transparent', '#909090', '#C0C0C0', '#909090', 'transparent']}
                  start={{ x: 1, y: 0 }}
                  end={{ x: 0, y: 0 }}
                  style={styles.neonGradient}
                />
              </Animated.View>
              {/* Left edge */}
              <Animated.View style={[
                styles.neonEdge,
                styles.neonEdgeLeft,
                {
                  opacity: neonRotationAnim.interpolate({
                    inputRange: [0, 0.1, 0.75, 0.85, 1],
                    outputRange: [1, 0.3, 0.3, 1, 1],
                  }),
                }
              ]}>
                <LinearGradient
                  colors={['transparent', '#909090', '#C0C0C0', '#909090', 'transparent']}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 0, y: 0 }}
                  style={styles.neonGradient}
                />
              </Animated.View>
            </View>
          )}
          <Animated.View
            style={[
              styles.searchBar,
              {
                backgroundColor: courseModeAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['#FFFFFF', '#FAFAFA'],
                }),
                borderWidth: searchBarBorderAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
                borderColor: searchBarBorderAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['transparent', 'rgba(150, 150, 150, 0.3)', 'rgba(150, 150, 150, 0.5)'],
                }),
                shadowOpacity: searchBarBorderAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.15],
                }),
                shadowRadius: searchBarBorderAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 10],
                }),
                shadowColor: '#000',
                transform: [{ scale: searchBarScaleAnim }],
              },
              isSearchFocused && !isCourseMode && {
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                borderBottomWidth: 0,
              },
            ]}
          >
            <SearchIcon width={20} height={20} color={isCourseMode ? '#666666' : '#000000'} />
            <TextInput
              style={styles.searchInput}
              placeholder={isCourseMode ? "원하는 코스를 입력하세요 (예: 카페 -> 점심 -> 저녁)" : "장소, 주소 검색"}
              placeholderTextColor={isCourseMode ? '#888888' : '#999999'}
              value={isCourseMode ? courseQuery : searchQuery}
              onChangeText={isCourseMode ? setCourseQuery : handleSearchQueryChange}
              onSubmitEditing={isCourseMode ? handleCourseSearch : handleSearch}
              onFocus={() => !isCourseMode && setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              returnKeyType="search"
              editable={!isSearching && !loadingCourse}
            />
            {(isCourseMode ? courseQuery.length > 0 : searchQuery.length > 0) && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  if (isCourseMode) {
                    setCourseQuery('');
                    setCourseResult(null);
                    setCourseRoute(null);
                  } else {
                    setSearchQuery('');
                    setSearchResultLocation(null);
                    setSearchSuggestions([]);
                  }
                }}
                activeOpacity={0.6}
              >
                <CloseIcon width={10} height={10} color="#666666" />
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
        <View style={styles.rightButtonsContainer}>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => setShowChatList(true)}
            activeOpacity={0.7}
          >
            <ChatIcon width={24} height={24} color="#1A1A1A" />
            {chatUnreadCount > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>
                  {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.myPageButtonWrapper,
              {
                width: courseModeAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [56, 0],
                }),
                marginLeft: courseModeAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
                opacity: courseModeAnimation.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 0.3, 0],
                }),
              },
            ]}
            pointerEvents={isCourseMode ? 'none' : 'auto'}
          >
            <TouchableOpacity
              style={styles.myPageButton}
              onPress={() => setShowProfile(true)}
              activeOpacity={0.7}
            >
              <CardsIcon width={44} height={44} />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
      )}

      {/* Course Filters - hide when viewing course detail */}
      {isCourseMode && !courseResult && (
      <Animated.View
        style={[
          styles.courseFiltersContainer,
          {
            transform: [{
              translateX: courseModeAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [400, 0],
              }),
            }],
            opacity: courseModeAnimation,
          },
        ]}
        pointerEvents={isCourseMode ? 'auto' : 'none'}
      >
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
          <SavedCourseIcon width={16} height={16} color="#393A39" filled />
          <Text style={styles.myCoursesButtonText}>내 코스</Text>
        </TouchableOpacity>
      </Animated.View>
      )}

      <Animated.View
        style={[
          styles.categoryWrapper,
          {
            transform: [{
              translateX: courseModeAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -400],
              }),
            }],
            opacity: courseModeAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          },
        ]}
        pointerEvents={!isCourseMode ? 'auto' : 'none'}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScrollView}
          contentContainerStyle={styles.categoryContainer}
          onScrollBeginDrag={() => Keyboard.dismiss()}
        >
          {/* 코스 버튼 - 별도 분리 */}
          <TouchableOpacity
            style={[
              styles.courseButton,
              isCourseMode && styles.courseButtonActive,
            ]}
            onPress={() => {
              Keyboard.dismiss();
              const newCourseMode = !isCourseMode;
              setIsCourseMode(newCourseMode);
              setSelectedCategory(newCourseMode ? 'course' : null);

              if (!newCourseMode) {
                setCourseResult(null);
                setCourseRoute(null);
                setCourseQuery('');
              } else {
                setSearchQuery('');
                loadCourseList();
                // Reset store detail bottom sheet when switching to course mode
                if (selectedStore) {
                  setSelectedStore(null);
                  setRecommendations([]);
                  setSelectedCardIndex(0);
                  storeDetailSlideAnim.setValue(0);
                  bottomSheetRef.current?.snapToIndex(1);
                }
              }
            }}
            activeOpacity={0.8}
          >
            {getCategoryIcon('course', true)}
            <Text style={styles.courseText}>코스</Text>
          </TouchableOpacity>

          {/* 필터 버튼들 */}
          {categories.filter(c => c.id !== 'course').map((category) => {
            const isActive = selectedCategory === category.id;

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
                activeOpacity={0.8}
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
      </Animated.View>

      {/* Search Dropdown - Rendered above category buttons */}
      {isSearchFocused && !isCourseMode && (
        <View style={styles.searchDropdown}>
          {loadingSearchSuggestions ? (
            <View style={styles.searchDropdownLoading}>
              <Text style={styles.searchDropdownLoadingText}>검색 중...</Text>
            </View>
          ) : searchQuery.length >= 2 && searchSuggestions.length > 0 ? (
            <ScrollView
              style={styles.searchDropdownScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {searchSuggestions.map((item, index) => (
                <TouchableOpacity
                  key={item.place_id || index}
                  style={[
                    styles.searchDropdownItem,
                    index === searchSuggestions.length - 1 && styles.searchDropdownItemLast,
                  ]}
                  onPress={() => handleSelectSearchResult(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.searchDropdownItemIcon}>
                    <SearchPinIcon width={18} height={18} />
                  </View>
                  <View style={styles.searchDropdownItemContent}>
                    <Text style={styles.searchDropdownItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.searchDropdownItemAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : searchQuery.length < 2 && searchHistory.length > 0 ? (
            <View>
              <View style={styles.searchDropdownHeader}>
                <Text style={styles.searchDropdownHeaderText}>최근 검색</Text>
                <TouchableOpacity onPress={clearSearchHistory}>
                  <Text style={styles.searchDropdownClearText}>전체 삭제</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.searchDropdownScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {searchHistory.map((item, index) => (
                  <TouchableOpacity
                    key={`history-${index}`}
                    style={[
                      styles.searchDropdownItem,
                      index === searchHistory.length - 1 && styles.searchDropdownItemLast,
                    ]}
                    onPress={() => handleSelectSearchResult(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.searchDropdownItemIcon}>
                      <Text style={styles.historyIcon}>H</Text>
                    </View>
                    <View style={styles.searchDropdownItemContent}>
                      <Text style={styles.searchDropdownItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.searchDropdownItemAddress} numberOfLines={1}>
                        {item.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : searchQuery.length >= 2 && searchSuggestions.length === 0 && !loadingSearchSuggestions ? (
            <View style={styles.searchDropdownEmpty}>
              <Text style={styles.searchDropdownEmptyText}>검색 결과가 없습니다</Text>
            </View>
          ) : null}
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
          {!isCourseMode && (
            <TouchableOpacity
              style={styles.onePayButton}
              onPress={() => {
                Keyboard.dismiss();
                // If a store is selected, pass the currently selected card
                if (selectedStore && userCards.length > 0) {
                  const selectedCard = userCards[selectedCardIndex];
                  if (selectedCard) {
                    setPreSelectedCardIdForOnePay(selectedCard.cid);
                  }
                } else {
                  setPreSelectedCardIdForOnePay(null);
                }
                setShowOnePay(true);
              }}
            >
              <Text style={styles.onePayText}>ONE PAY</Text>
            </TouchableOpacity>
          )}

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

              <Animated.View
                style={{
                  transform: [{
                    translateX: storeDetailSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 300],
                    }),
                  }],
                  opacity: storeDetailSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                }}
              >
                <View style={styles.storeDetailHeader}>
                  <TouchableOpacity
                    onPress={handleBackToList}
                    style={styles.backButton}
                    activeOpacity={0.6}
                  >
                    <BackIcon width={18} height={18} color="#888888" />
                    <Text style={styles.backButtonText}>목록</Text>
                  </TouchableOpacity>

                  <View style={styles.storeHeaderContainer}>
                    <View style={styles.storeNameRow}>
                      <Text style={styles.storeName}>{selectedStore.name}</Text>
                      <TouchableOpacity
                        onPress={() => toggleFavorite(selectedStore.name)}
                        activeOpacity={0.6}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={styles.favoriteButton}
                      >
                        <StarIcon
                          width={22}
                          height={22}
                          filled={favoriteStores.has(selectedStore.name)}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.storeAddress}>{selectedStore.address}</Text>
                    {selectedStore.place_id && (
                      <TouchableOpacity
                        style={styles.viewDetailsButton}
                        onPress={() => setShowPlaceDetail(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.viewDetailsButtonText}>View Details</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Animated.View>
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
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.filterButtonText, filterOpenOnly && styles.filterButtonTextActive]}>
                      영업중
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterButton, filterSort === 'benefit' && styles.filterButtonActive]}
                    onPress={() => setFilterSort('benefit')}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.filterButtonText, filterSort === 'benefit' && styles.filterButtonTextActive]}>
                      혜택순
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterButton, filterSort === 'distance' && styles.filterButtonActive]}
                    onPress={() => setFilterSort('distance')}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.filterButtonText, filterSort === 'distance' && styles.filterButtonTextActive]}>
                      거리순
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterButton, filterSort === 'recommend' && styles.filterButtonActive]}
                    onPress={() => setFilterSort('recommend')}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.filterButtonText, filterSort === 'recommend' && styles.filterButtonTextActive]}>
                      추천순
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null
            )
          )}

          {/* Fixed header for course result */}
          {isCourseMode && courseResult && !showCourseList && !loadingCourse && !loadingCourseList && !selectedCourseDetail && (
            <View style={{ paddingHorizontal: 10, backgroundColor: COLORS.background }}>
              <TouchableOpacity
                style={styles.backToListButton}
                onPress={() => {
                  setShowCourseList(true);
                  setCourseResult(null);
                  setCourseRoute(null);
                  setCourseQuery('');
                  bottomSheetRef.current?.snapToIndex(2);
                }}
                activeOpacity={0.7}
              >
                <BackIcon width={20} height={20} color="#666666" />
                <Text style={styles.backToListButtonText}>뒤로 가기</Text>
              </TouchableOpacity>

              <View style={styles.courseTitleBlock}>
                <View style={styles.courseTitleHeader}>
                  <Text style={styles.courseMainTitle} numberOfLines={1}>
                    {courseResult.course.title.includes(':')
                      ? courseResult.course.title.split(':')[0]
                      : courseResult.course.title}
                  </Text>
                  <TouchableOpacity
                    style={styles.saveCourseIconButton}
                    onPress={handleSaveCourse}
                    disabled={courseSaved || savingCourse}
                    activeOpacity={0.7}
                  >
                    <SavedCourseIcon
                      width={18}
                      height={18}
                      color={courseSaved ? '#393A39' : savingCourse ? '#CCCCCC' : '#BBBBBB'}
                      filled={courseSaved}
                    />
                  </TouchableOpacity>
                </View>
                {courseResult.course.title.includes(':') && (
                  <Text style={styles.courseTagline}>
                    {courseResult.course.title.split(':').slice(1).join(':').trim()}
                  </Text>
                )}
              </View>

              <Text style={styles.courseDescription}>{courseResult.course.reasoning}</Text>

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
            </View>
          )}

          {/* Fixed header for course list */}
          {isCourseMode && showCourseList && !loadingCourse && !loadingCourseList && !selectedCourseDetail && !courseResult && (
            <View style={{ paddingHorizontal: 12, paddingTop: 4, backgroundColor: COLORS.background }}>
              <View style={styles.courseListHeader}>
                <Text style={styles.courseListTitle}>추천 코스</Text>
                <TouchableOpacity
                  style={styles.friendsButton}
                  onPress={() => setShowFriends(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.friendsButtonText}>친구</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <BottomSheetScrollView
            contentContainerStyle={{
              paddingBottom: insets.bottom + 200,
              paddingHorizontal: 10,
              backgroundColor: COLORS.background,
            }}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            scrollEnabled={true}
            bounces={true}
            onScrollBeginDrag={() => Keyboard.dismiss()}
          >
            {isCourseMode ? (
              // Course Mode Content
              <>
                {loadingCourse ? (
                  <CourseLoadingView visible={loadingCourse} />
                ) : loadingCourseList ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>코스 목록 불러오는 중...</Text>
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
                            <View style={styles.naverPlaceCard} pointerEvents="box-none">
                              <View style={styles.naverPlaceNumber}>
                                <Text style={styles.naverPlaceNumberText}>{index + 1}</Text>
                              </View>

                              <View style={styles.naverPlaceContent} pointerEvents="box-none">
                                <View style={styles.naverPlaceMerchant}>
                                  {place.photo_url ? (
                                    <Image
                                      source={{ uri: place.photo_url }}
                                      style={styles.naverPlacePhoto}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View style={styles.naverMerchantPlaceholder}>
                                      <Text style={styles.naverMerchantPlaceholderText}>
                                        {place.name.substring(0, 1)}
                                      </Text>
                                    </View>
                                  )}
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
                    <View style={{ height: 100 }} />
                  </>
                ) : showCourseList ? (
                  // Course List View
                  <View style={styles.courseListContainer}>
                    {/* AI 추천 코스 */}
                    {aiCourses.length > 0 && aiCourses.slice(0, 2).map((course, index) => {
                      const cardAnim = getCourseCardAnim(`course-${index}`);
                      const titleParts = course.course.title.split(':');
                      const mainTitle = titleParts[0];
                      const subTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : null;

                      return (
                        <Animated.View
                          key={`ai-${index}`}
                          style={{
                            opacity: cardAnim,
                            transform: [
                              { translateY: cardAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [20, 0],
                              })},
                            ],
                          }}
                        >
                          <TouchableOpacity
                            style={styles.courseCard}
                            onPress={() => handleCourseSelect(course)}
                            activeOpacity={0.9}
                          >
                            <View style={styles.courseCardHeader}>
                              <View style={styles.courseCardTitleWrap}>
                                <View style={styles.courseCardTitleRow}>
                                  <Text style={styles.courseCardMainTitle} numberOfLines={1}>{mainTitle}</Text>
                                  <View style={styles.courseCardBadgeAI}>
                                    <Text style={styles.courseCardBadgeAIText}>AI</Text>
                                  </View>
                                </View>
                                {subTitle && (
                                  <Text style={styles.courseCardSubTitle}>{subTitle}</Text>
                                )}
                              </View>
                            </View>

                            <View style={styles.courseCardPlaces}>
                              {course.course.stops.slice(0, 3).map((place, placeIndex) => (
                                <React.Fragment key={placeIndex}>
                                  <View style={styles.coursePlaceItem}>
                                    <View style={styles.coursePlaceCircle}>
                                      <Text style={styles.coursePlaceNumText}>{placeIndex + 1}</Text>
                                    </View>
                                    <Text style={styles.courseListPlaceName} numberOfLines={1}>
                                      {place.name}
                                    </Text>
                                  </View>
                                  {placeIndex < Math.min(course.course.stops.length, 3) - 1 && (
                                    <View style={styles.courseArrowContainer}>
                                      <View style={styles.courseArrowLine} />
                                    </View>
                                  )}
                                </React.Fragment>
                              ))}
                            </View>

                            <View style={styles.courseCardBenefitWithShare}>
                              <View style={styles.courseCardBenefit}>
                                <View style={styles.benefitDot} />
                                <Text style={styles.courseBenefitText} numberOfLines={1}>
                                  {course.course.benefit_summary || '카드 혜택 적용 가능'}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={styles.shareButton}
                                onPress={() => {
                                  Alert.alert('알림', '코스를 저장한 후 공유할 수 있습니다.');
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.shareButtonText}>공유</Text>
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        </Animated.View>
                      );
                    })}

                    {/* 사용자 저장 코스 */}
                    {savedCourses.length > 0 && (() => {
                      const titleParts = savedCourses[0].title.split(':');
                      const mainTitle = titleParts[0];
                      const subTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : null;

                      return (
                        <TouchableOpacity
                          style={styles.courseCard}
                          onPress={() => handleCourseSelect(savedCourses[0])}
                          activeOpacity={0.9}
                        >
                          <View style={styles.courseCardHeader}>
                            <View style={styles.courseCardTitleWrap}>
                              <View style={styles.courseCardTitleRow}>
                                <Text style={styles.courseCardMainTitle} numberOfLines={1}>{mainTitle}</Text>
                                <View style={styles.courseCardBadgeMy}>
                                  <Text style={styles.courseCardBadgeMyText}>MY</Text>
                                </View>
                              </View>
                              {subTitle && (
                                <Text style={styles.courseCardSubTitle}>{subTitle}</Text>
                              )}
                            </View>
                          </View>

                          <View style={styles.courseCardPlaces}>
                            {savedCourses[0].stops.slice(0, 3).map((place, placeIndex) => (
                              <React.Fragment key={placeIndex}>
                                <View style={styles.coursePlaceItem}>
                                  <View style={styles.coursePlaceCircle}>
                                    <Text style={styles.coursePlaceNumText}>{placeIndex + 1}</Text>
                                  </View>
                                  <Text style={styles.courseListPlaceName} numberOfLines={1}>
                                    {place.name}
                                  </Text>
                                </View>
                                {placeIndex < Math.min(savedCourses[0].stops.length, 3) - 1 && (
                                  <View style={styles.courseArrowContainer}>
                                    <View style={styles.courseArrowLine} />
                                  </View>
                                )}
                              </React.Fragment>
                            ))}
                          </View>

                          <View style={styles.courseCardBenefitWithShare}>
                            <View style={styles.courseCardBenefit}>
                              <View style={styles.benefitDot} />
                              <Text style={styles.courseBenefitText} numberOfLines={1}>
                                {savedCourses[0].stops[0]?.benefits[0]
                                  ? `${savedCourses[0].stops[0].benefits[0].card} ${savedCourses[0].stops[0].benefits[0].benefit}`
                                  : '카드 혜택 적용 가능'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.shareButton}
                              onPress={() => {
                                setSharingCourseId(savedCourses[0].id);
                                setShowShareModal(true);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.shareButtonText}>공유</Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })()}

                    {/* 공유받은 코스 */}
                    {sharedCourses.length > 0 && (() => {
                      const titleParts = sharedCourses[0].title.split(':');
                      const mainTitle = titleParts[0];
                      const subTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : null;

                      return (
                        <TouchableOpacity
                          style={styles.courseCard}
                          onPress={() => handleCourseSelect(sharedCourses[0])}
                          activeOpacity={0.9}
                        >
                          <View style={styles.courseCardHeader}>
                            <View style={styles.courseCardTitleWrap}>
                              <View style={styles.courseCardTitleRow}>
                                <Text style={styles.courseCardMainTitle} numberOfLines={1}>{mainTitle}</Text>
                                <View style={styles.courseCardBadgeShare}>
                                  <Text style={styles.courseCardBadgeShareText}>
                                    {sharedCourses[0].shared_by?.user_name || '친구'}
                                  </Text>
                                </View>
                              </View>
                              {subTitle && (
                                <Text style={styles.courseCardSubTitle}>{subTitle}</Text>
                              )}
                            </View>
                          </View>

                          <View style={styles.courseCardPlaces}>
                            {sharedCourses[0].stops.slice(0, 3).map((place, placeIndex) => (
                              <React.Fragment key={placeIndex}>
                                <View style={styles.coursePlaceItem}>
                                  <View style={styles.coursePlaceCircle}>
                                    <Text style={styles.coursePlaceNumText}>{placeIndex + 1}</Text>
                                  </View>
                                  <Text style={styles.courseListPlaceName} numberOfLines={1}>
                                    {place.name}
                                  </Text>
                                </View>
                                {placeIndex < Math.min(sharedCourses[0].stops.length, 3) - 1 && (
                                  <View style={styles.courseArrowContainer}>
                                    <View style={styles.courseArrowLine} />
                                  </View>
                                )}
                              </React.Fragment>
                            ))}
                          </View>
                        </TouchableOpacity>
                      );
                    })()}

                    {/* 인기 코스 */}
                    {popularCourses.length > 0 && (() => {
                      const titleParts = popularCourses[0].title.split(':');
                      const mainTitle = titleParts[0];
                      const subTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : null;

                      return (
                        <TouchableOpacity
                          style={styles.courseCard}
                          onPress={() => handleCourseSelect(popularCourses[0])}
                          activeOpacity={0.9}
                        >
                          <View style={styles.courseCardHeader}>
                            <View style={styles.courseCardTitleWrap}>
                              <View style={styles.courseCardTitleRow}>
                                <Text style={styles.courseCardMainTitle} numberOfLines={1}>{mainTitle}</Text>
                                <View style={styles.courseCardBadgeHot}>
                                  <Text style={styles.courseCardBadgeHotText}>HOT</Text>
                                </View>
                              </View>
                              {subTitle && (
                                <Text style={styles.courseCardSubTitle}>{subTitle}</Text>
                              )}
                            </View>
                          </View>

                          <View style={styles.courseCardPlaces}>
                            {popularCourses[0].stops.slice(0, 3).map((place, placeIndex) => (
                              <React.Fragment key={placeIndex}>
                                <View style={styles.coursePlaceItem}>
                                  <View style={styles.coursePlaceCircle}>
                                    <Text style={styles.coursePlaceNumText}>{placeIndex + 1}</Text>
                                  </View>
                                  <Text style={styles.courseListPlaceName} numberOfLines={1}>
                                    {place.name}
                                  </Text>
                                </View>
                                {placeIndex < Math.min(popularCourses[0].stops.length, 3) - 1 && (
                                  <View style={styles.courseArrowContainer}>
                                    <View style={styles.courseArrowLine} />
                                  </View>
                                )}
                              </React.Fragment>
                            ))}
                          </View>

                          <View style={styles.courseCardBenefitWithShare}>
                            <View style={styles.courseCardBenefit}>
                              <View style={styles.benefitDot} />
                              <Text style={styles.courseBenefitText} numberOfLines={1}>
                                {popularCourses[0].stops[0]?.benefits[0]
                                  ? `${popularCourses[0].stops[0].benefits[0].card} ${popularCourses[0].stops[0].benefits[0].benefit}`
                                  : '카드 혜택 적용 가능'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.shareButton}
                              onPress={() => {
                                Alert.alert('알림', '코스를 저장한 후 공유할 수 있습니다.');
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.shareButtonText}>공유</Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })()}

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
                    {courseResult.course && courseResult.course.stops && courseResult.course.stops.map((place, index) => {
                      const bestBenefit = place.benefits && place.benefits.length > 0 ? place.benefits[0] : null;
                      const cardImage = bestBenefit ? CARD_IMAGES[bestBenefit.card] : null;
                      const placeAnim = placeCardAnims[index] || new Animated.Value(1);
                      const totalStops = courseResult.course.stops.length;

                      return (
                        <React.Fragment key={index}>
                          <Animated.View
                            pointerEvents="box-none"
                            style={{
                              opacity: placeAnim,
                              transform: [
                                { translateX: placeAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-30, 0],
                                })},
                                { scale: placeAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.9, 1],
                                })},
                              ],
                            }}
                          >
                            <View style={styles.naverPlaceCard} pointerEvents="box-none">
                              <Animated.View
                                style={[
                                  styles.naverPlaceNumber,
                                  {
                                    backgroundColor: routeProgressAnim.interpolate({
                                      inputRange: [index / totalStops, (index + 0.5) / totalStops, 1],
                                      outputRange: ['#E8E8E8', '#393A39', '#393A39'],
                                      extrapolate: 'clamp',
                                    }),
                                  }
                                ]}
                              >
                                <Text style={styles.naverPlaceNumberText}>{index + 1}</Text>
                              </Animated.View>

                              <View style={styles.naverPlaceContent} pointerEvents="box-none">
                                <View style={styles.naverPlaceMerchant}>
                                  {place.photo_url ? (
                                    <Image
                                      source={{ uri: place.photo_url }}
                                      style={styles.naverPlacePhoto}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View style={styles.naverMerchantPlaceholder}>
                                      <Text style={styles.naverMerchantPlaceholderText}>
                                        {place.name.substring(0, 1)}
                                      </Text>
                                    </View>
                                  )}
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
                          </Animated.View>

                          {/* Route segment card: shows route from place[index] to place[index+1], which is legs_summary[index+1] */}
                          {courseRoute && courseRoute.legs_summary && courseRoute.legs_summary[index + 1] && index < courseResult.course.stops.length - 1 && (
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                const currentStop = courseResult.course.stops[index];
                                const nextStop = courseResult.course.stops[index + 1];
                                setSelectedRouteSegment({
                                  start: { latitude: currentStop.latitude, longitude: currentStop.longitude },
                                  end: { latitude: nextStop.latitude, longitude: nextStop.longitude },
                                  startName: currentStop.name,
                                  endName: nextStop.name,
                                  endPlaceId: nextStop.place_id,
                                });
                                setShowRouteDetail(true);
                              }}
                            >
                              <Animated.View
                                style={[
                                  styles.naverRouteSegment,
                                  {
                                    opacity: placeAnim.interpolate({
                                      inputRange: [0, 0.5, 1],
                                      outputRange: [0, 0.3, 1],
                                    }),
                                  }
                                ]}
                              >
                                <Animated.View
                                  style={[
                                    styles.naverRouteDots,
                                    {
                                      opacity: routeProgressAnim.interpolate({
                                        inputRange: [(index + 0.3) / totalStops, (index + 0.8) / totalStops],
                                        outputRange: [0.3, 1],
                                        extrapolate: 'clamp',
                                      }),
                                    }
                                  ]}
                                >
                                  <View style={styles.naverRouteDot} />
                                  <View style={styles.naverRouteDot} />
                                  <View style={styles.naverRouteDot} />
                                </Animated.View>
                                <View style={styles.naverRouteDetails}>
                                  <View style={styles.naverRouteDetailsContent}>
                                    {courseRoute.legs_summary[index + 1].mode === 'transit' && courseRoute.legs_summary[index + 1].transit_legs ? (
                                      <>
                                        <View style={styles.transitLegsInline}>
                                          {courseRoute.legs_summary[index + 1].transit_legs!.map((tLeg: any, tIdx: number) => (
                                            <React.Fragment key={tIdx}>
                                              {tIdx > 0 && <Text style={styles.transitLegArrow}> → </Text>}
                                              <View style={[
                                                styles.transitLegBadge,
                                                tLeg.mode === 'WALK' && styles.transitLegBadgeWalk,
                                                tLeg.mode === 'BUS' && styles.transitLegBadgeBus,
                                                tLeg.mode === 'SUBWAY' && styles.transitLegBadgeSubway,
                                                tLeg.routeColor && { backgroundColor: `#${tLeg.routeColor}` }
                                              ]}>
                                                <Text style={[
                                                  styles.transitLegBadgeText,
                                                  tLeg.mode !== 'WALK' && styles.transitLegBadgeTextWhite
                                                ]}>
                                                  {tLeg.mode === 'WALK' ? `도보 ${tLeg.duration_text}` :
                                                   `${tLeg.name}${tLeg.stopCount ? ` (${tLeg.stopCount}정류장)` : ''}`}
                                                </Text>
                                              </View>
                                            </React.Fragment>
                                          ))}
                                        </View>
                                        <Text style={styles.naverRouteSegmentText}>
                                          총 {courseRoute.legs_summary[index + 1].duration_text}
                                          {(courseRoute.legs_summary[index + 1].fare ?? 0) > 0 && ` · ${courseRoute.legs_summary[index + 1].fare}원`}
                                        </Text>
                                      </>
                                    ) : (
                                      <>
                                        <View style={styles.naverRouteMode}>
                                          <Text style={styles.naverRouteModeText}>
                                            {courseRoute.legs_summary[index + 1].mode === 'walking' ? '도보' : '이동'}
                                          </Text>
                                        </View>
                                        <Text style={styles.naverRouteSegmentText}>
                                          {courseRoute.legs_summary[index + 1].distance_text} · {courseRoute.legs_summary[index + 1].duration_text}
                                        </Text>
                                      </>
                                    )}
                                  </View>
                                  <ChevronRightIcon width={18} height={18} color="#2E7D32" />
                                </View>
                              </Animated.View>
                            </TouchableOpacity>
                          )}
                        </React.Fragment>
                      );
                    })}
                    <View style={{ height: 100 }} />
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>원하는 코스를 검색해보세요</Text>
                    <Text style={styles.emptyStateHint}>예: "카페에서 커피 마시고 점심 먹고 싶어"</Text>
                  </View>
                )}
              </>
            ) : selectedStore ? (
              <Animated.View
                style={{
                  transform: [{
                    translateX: storeDetailSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 300],
                    }),
                  }],
                  opacity: storeDetailSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                }}
              >
                {loadingRecommendations ? (
                  <View style={styles.loadingRecommendations}>
                    <View style={styles.loadingSpinner}>
                      <Animated.View style={styles.loadingDotSmall} />
                      <Animated.View style={[styles.loadingDotSmall, { marginHorizontal: 6 }]} />
                      <Animated.View style={styles.loadingDotSmall} />
                    </View>
                    <Text style={styles.loadingText}>혜택 분석 중</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.recommendationsTitleRow}>
                      <Text style={styles.recommendationsTitle}>내 카드 혜택 순위</Text>
                      <View style={styles.recommendationsSubtitleBadge}>
                        <Text style={styles.recommendationsSubtitleText}>{recommendations.length}개 카드</Text>
                      </View>
                    </View>

                    {recommendations.map((rec) => {
                      const selectedCardName = userCards[selectedCardIndex]?.card_name;
                      const isSelectedCard = rec.card === selectedCardName;
                      const performanceData = getSamplePerformanceData(rec);
                      const isTopRank = rec.rank === 1;

                      return (
                        <View key={rec.rank} style={styles.recommendationCardWrapper}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => handleRecommendationCardClick(rec.card)}
                            style={[
                              styles.recommendationCard,
                              isSelectedCard && styles.recommendationCardSelected,
                              isTopRank && styles.recommendationCardTop,
                            ]}
                          >
                            {/* Left: Card Image */}
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
                                width={72}
                                height={45}
                                style={styles.recommendationCardImage}
                              />
                            )}

                            {/* Center: Card Info */}
                            <View style={styles.recommendationInfo}>
                              <Text style={styles.recommendationCardName} numberOfLines={1}>{rec.card}</Text>
                              <Text style={[
                                styles.benefitSummary,
                                isTopRank && styles.benefitSummaryTop,
                              ]}>{rec.benefit_summary}</Text>

                              <View style={styles.benefitTags}>
                                {rec.discount_rate > 0 && (
                                  <View style={styles.benefitTag}>
                                    <Text style={styles.benefitTagText}>{rec.discount_rate}% 할인</Text>
                                  </View>
                                )}
                                {rec.point_rate > 0 && (
                                  <View style={styles.benefitTag}>
                                    <Text style={styles.benefitTagText}>{rec.point_rate}% 적립</Text>
                                  </View>
                                )}
                                {rec.discount_amount > 0 && (
                                  <View style={styles.benefitTag}>
                                    <Text style={styles.benefitTagText}>최대 {(rec.discount_amount / 10000).toFixed(0)}만원</Text>
                                  </View>
                                )}
                              </View>

                              {rec.pre_month_money > 0 && (
                                <View style={styles.conditionRow}>
                                  <View style={styles.conditionDot} />
                                  <Text style={styles.benefitDetailCondition}>
                                    전월 {(rec.pre_month_money / 10000).toFixed(0)}만원 이상 실적
                                  </Text>
                                </View>
                              )}
                            </View>

                            {/* Right: Score */}
                            <View style={styles.scoreContainer}>
                              <Text style={[
                                styles.scoreText,
                                isTopRank && styles.scoreTextTop,
                              ]}>{rec.score}</Text>
                              <Text style={styles.scoreLabel}>점</Text>
                            </View>
                          </TouchableOpacity>

                          {/* Expandable Progress Section */}
                          {isSelectedCard && (
                            <Animated.View
                              style={[
                                styles.progressSection,
                                {
                                  maxHeight: progressHeightAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 180],
                                  }),
                                  opacity: progressHeightAnim,
                                },
                              ]}
                            >
                              <View style={styles.progressRow}>
                                {/* 실적 Progress */}
                                <View style={styles.progressItem}>
                                  <View style={styles.progressLabelRow}>
                                    <Text style={styles.progressLabel}>실적</Text>
                                    {performanceData.requiredPerformance > 0 && (
                                      <Text style={styles.progressPercent}>
                                        {Math.min(Math.round((performanceData.currentPerformance / performanceData.requiredPerformance) * 100), 100)}%
                                      </Text>
                                    )}
                                  </View>
                                  {performanceData.requiredPerformance > 0 ? (
                                    <>
                                      <View style={styles.progressBarContainer}>
                                        <View style={styles.progressBarBackground}>
                                          <LinearGradient
                                            colors={['#2E7D32', '#4CAF50']}
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
                                        <Text style={styles.progressTextHighlight}>
                                          {performanceData.currentPerformance.toLocaleString()}
                                        </Text>
                                        원 / {performanceData.requiredPerformance.toLocaleString()}원
                                      </Text>
                                    </>
                                  ) : (
                                    <Text style={styles.progressTextNoData}>조건 없음</Text>
                                  )}
                                </View>

                                {/* 혜택한도 Progress */}
                                <View style={styles.progressItem}>
                                  <View style={styles.progressLabelRow}>
                                    <Text style={styles.progressLabel}>혜택한도</Text>
                                    {performanceData.totalBenefitLimit > 0 && (
                                      <Text style={styles.progressPercent}>
                                        {Math.min(Math.round((performanceData.usedBenefit / performanceData.totalBenefitLimit) * 100), 100)}%
                                      </Text>
                                    )}
                                  </View>
                                  {performanceData.totalBenefitLimit > 0 ? (
                                    <>
                                      <View style={styles.progressBarContainer}>
                                        <View style={styles.progressBarBackground}>
                                          <LinearGradient
                                            colors={['#8B5CF6', '#A78BFA']}
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
                                        잔여 <Text style={styles.progressTextHighlight}>
                                          {performanceData.remainingBenefit.toLocaleString()}
                                        </Text>원
                                      </Text>
                                    </>
                                  ) : (
                                    <Text style={styles.progressTextNoData}>한도 없음</Text>
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
              </Animated.View>
            ) : (
              <>
                {stores
                  .filter(store => {
                    // 카테고리 필터
                    if (selectedCategory) {
                      if (selectedCategory === 'favorites') {
                        if (!favoriteStores.has(store.name)) return false;
                      } else if (store.category !== selectedCategory) {
                        return false;
                      }
                    }

                    // 영업중 필터 (현재는 모든 가게가 영업중이라고 가정)
                    // TODO: 백엔드에서 영업시간 데이터 받아와서 필터링

                    return true;
                  })
                  .sort((a, b) => {
                    // 정렬
                    if (filterSort === 'distance') {
                      // 거리순: 항상 가까운 순
                      return a.distance - b.distance;
                    } else if (filterSort === 'benefit') {
                      // 혜택순: 항상 높은 순
                      const scoreA = a.top_card?.score || 0;
                      const scoreB = b.top_card?.score || 0;
                      return scoreB - scoreA;
                    } else if (filterSort === 'recommend') {
                      // 추천순: 혜택과 거리의 가중치 합산 (혜택 70%, 거리 30%)
                      const scoreA = a.top_card?.score || 0;
                      const scoreB = b.top_card?.score || 0;
                      // 거리 점수: 1km 이내 100점, 멀수록 감소 (최대 10km 기준)
                      const distanceScoreA = Math.max(0, 100 - (a.distance / 100));
                      const distanceScoreB = Math.max(0, 100 - (b.distance / 100));
                      // 가중치 합산 점수
                      const weightedA = (scoreA * 0.7) + (distanceScoreA * 0.3);
                      const weightedB = (scoreB * 0.7) + (distanceScoreB * 0.3);
                      return weightedB - weightedA;
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
                      activeOpacity={0.85}
                    >
                      {getMerchantLogo(store.name) ? (
                        <Image
                          source={getMerchantLogo(store.name)}
                          style={styles.merchantLogo}
                          resizeMode="contain"
                        />
                      ) : store.photo_url ? (
                        <Image
                          source={{ uri: store.photo_url }}
                          style={styles.storePhoto}
                          resizeMode="cover"
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
          <ProfileScreen onBack={() => {
            setShowProfile(false);
            // 카드 등록 후 지도에도 반영되도록 새로고침
            fetchUserCards();
          }} onLogout={onLogout} />
        </View>
      )}
      {showOnePay && (
        <View style={styles.profileOverlay}>
          <OnePayScreen
            onBack={() => {
              setShowOnePay(false);
              setPreSelectedCardIdForOnePay(null);
            }}
            preSelectedCardId={preSelectedCardIdForOnePay}
          />
        </View>
      )}
      {showFriends && (
        <View style={styles.profileOverlay}>
          <FriendsScreen onBack={() => setShowFriends(false)} />
        </View>
      )}
      {showPlaceDetail && selectedStore && selectedStore.place_id && (
        <Modal
          visible={showPlaceDetail}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowPlaceDetail(false)}
        >
          <PlaceDetailView
            placeId={selectedStore.place_id}
            storeName={selectedStore.name}
            storeCategory={selectedStore.category}
            onClose={() => setShowPlaceDetail(false)}
          />
        </Modal>
      )}
      {selectedRouteSegment && (
        <RouteDetailView
          visible={showRouteDetail}
          start={selectedRouteSegment.start}
          end={selectedRouteSegment.end}
          startName={selectedRouteSegment.startName}
          endName={selectedRouteSegment.endName}
          endPlaceId={selectedRouteSegment.endPlaceId}
          onClose={() => {
            setShowRouteDetail(false);
            setSelectedRouteSegment(null);
          }}
          onRouteSelect={(polyline, mode) => {
            console.log('[RouteDetail] Selected route:', mode, polyline.substring(0, 50));
            setShowRouteDetail(false);
            setSelectedRouteSegment(null);
            // Auto-minimize bottom sheet when navigation starts
            bottomSheetRef.current?.snapToIndex(0);
          }}
        />
      )}
      {showShareModal && sharingCourseId && (
        <View style={styles.profileOverlay}>
          <FriendsScreen
            onBack={() => {
              setShowShareModal(false);
              setSharingCourseId(null);
            }}
            shareMode={true}
            courseTitle={savedCourses.find(c => c.id === sharingCourseId)?.title}
            onShareCourse={(friendIds) => handleShareCourse(sharingCourseId, friendIds)}
          />
        </View>
      )}
      {showChatList && (
        <View style={styles.profileOverlay}>
          <ChatListScreen
            onBack={() => setShowChatList(false)}
            onOpenChat={(conversation) => {
              setSelectedConversation(conversation);
              setShowChatRoom(true);
            }}
          />
        </View>
      )}
      {showChatRoom && selectedConversation && (
        <View style={styles.profileOverlay}>
          <ChatRoomScreen
            conversation={selectedConversation}
            onBack={() => {
              setShowChatRoom(false);
              setSelectedConversation(null);
            }}
            onViewCourse={handleViewSharedCourse}
          />
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
        animationType="slide"
        onRequestClose={() => setShowPeoplePicker(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.wheelPickerModalContent}>
            <View style={styles.wheelPickerHeader}>
              <TouchableOpacity onPress={() => setShowPeoplePicker(false)}>
                <Text style={styles.wheelPickerDone}>완료</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.wheelPickerContainer}>
              <WheelPicker
                selectedIndex={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].indexOf(numPeople)}
                options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map(num => `${num}명`)}
                onChange={(index) => setNumPeople([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20][index])}
                itemTextStyle={styles.wheelPickerItemText}
                selectedIndicatorStyle={styles.wheelPickerIndicator}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Budget Picker Modal */}
      <Modal
        visible={showBudgetPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBudgetPicker(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.wheelPickerModalContent}>
            <View style={styles.wheelPickerHeader}>
              <TouchableOpacity onPress={() => setShowBudgetPicker(false)}>
                <Text style={styles.wheelPickerDone}>완료</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.wheelPickerContainer}>
              <WheelPicker
                selectedIndex={[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].indexOf(budget / 10000)}
                options={[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(amount => `${amount}만 원`)}
                onChange={(index) => setBudget([5, 10, 15, 20, 25, 30, 35, 40, 45, 50][index] * 10000)}
                itemTextStyle={styles.wheelPickerItemText}
                selectedIndicatorStyle={styles.wheelPickerIndicator}
              />
            </View>
          </View>
        </View>
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
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBarWrapper: {
    flex: 1,
    position: 'relative',
  },
  neonBorderContainer: {
    position: 'absolute',
    top: -1.5,
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    borderRadius: 13.5,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.25)',
    zIndex: 0,
    shadowColor: '#888888',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  neonEdge: {
    position: 'absolute',
    borderRadius: 1,
  },
  neonEdgeTop: {
    top: -1.5,
    left: 20,
    right: 20,
    height: 1.5,
  },
  neonEdgeBottom: {
    bottom: -1.5,
    left: 20,
    right: 20,
    height: 1.5,
  },
  neonEdgeLeft: {
    left: -1.5,
    top: 10,
    bottom: 10,
    width: 1.5,
  },
  neonEdgeRight: {
    right: -1.5,
    top: 10,
    bottom: 10,
    width: 1.5,
  },
  neonGradient: {
    flex: 1,
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
    top: 124,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButtonsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  courseFilterButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  courseFilterButtonText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  courseFilterButtonTextBold: {
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  myCoursesButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  myCoursesButtonText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  rightButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  chatBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  myPageButtonWrapper: {
    overflow: 'hidden',
  },
  myPageButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  searchDropdown: {
    position: 'absolute',
    top: 107,
    left: 20,
    right: 138,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    maxHeight: 350,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
    zIndex: 1000,
  },
  searchDropdownScroll: {
    maxHeight: 300,
  },
  searchDropdownLoading: {
    padding: 20,
    alignItems: 'center',
  },
  searchDropdownLoadingText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  searchDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchDropdownHeaderText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  searchDropdownClearText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#888888',
  },
  searchDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  searchDropdownItemLast: {
    borderBottomWidth: 0,
  },
  searchDropdownItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyIcon: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#888888',
  },
  searchDropdownItemContent: {
    flex: 1,
  },
  searchDropdownItemName: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  searchDropdownItemAddress: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  searchDropdownEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  searchDropdownEmptyText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: '#333333',
    paddingVertical: 0,
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEEEEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
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
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  categoryButtonActive: {
    backgroundColor: '#393A39',
    borderColor: '#393A39',
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#3D3D3D',
  },
  courseButtonActive: {
    backgroundColor: '#000000',
    borderColor: '#D4A853',
  },
  courseText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  courseTextActive: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
  },
  bottomSheetContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  onePayButton: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#333333',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  onePayText: {
    fontSize: 22,
    fontFamily: FONTS.museoModerno,
    color: '#FFFFFF',
    letterSpacing: 2,
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
  storeDetailHeader: {
    backgroundColor: '#FAFAFA',
    marginHorizontal: 12,
    borderRadius: 16,
    marginBottom: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#888888',
  },
  storeHeaderContainer: {
    paddingHorizontal: 16,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  storeName: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    flex: 1,
    letterSpacing: -0.3,
  },
  favoriteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  storeAddress: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#888888',
    letterSpacing: -0.2,
  },
  viewDetailsButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  viewDetailsButtonText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#007AFF',
  },
  loadingText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: '#888888',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingRecommendations: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingSpinner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CCCCCC',
  },
  recommendationsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  recommendationsTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    letterSpacing: -0.4,
  },
  recommendationsSubtitleBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendationsSubtitleText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#888888',
  },
  recommendationCardWrapper: {
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
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  recommendationCardSelected: {
    borderWidth: 1.5,
    borderColor: '#1A1A1A',
    backgroundColor: '#FAFAFA',
  },
  recommendationCardTop: {
    backgroundColor: '#FAFBFC',
    borderColor: '#E8E8E8',
  },
  recommendationLeft: {
    alignItems: 'center',
    marginRight: 14,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rankBadgeTop: {
    backgroundColor: '#1A1A1A',
  },
  rankBadgeSelected: {
    backgroundColor: '#1A1A1A',
  },
  rankText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: '#666666',
  },
  rankTextTop: {
    color: '#FFFFFF',
  },
  recommendationInfo: {
    flex: 1,
    minWidth: 0,
  },
  recommendationCardName: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  benefitSummary: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#2E7D32',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  benefitSummaryTop: {
    color: '#1B5E20',
  },
  benefitTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  benefitTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  benefitTagText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#6B7280',
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  conditionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#B91C1C',
    marginRight: 6,
  },
  benefitDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendationCardImage: {
    width: 72,
    height: 45,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginRight: 14,
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
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#B91C1C',
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 10,
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
        elevation: 2,
      },
    }),
  },
  storePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storePlaceholderText: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#AAAAAA',
  },
  storeInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  storeCardName: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: '#222222',
    marginBottom: 2,
  },
  storeDistance: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginBottom: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardName: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#555555',
  },
  benefitText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: '#2E7D32',
    marginTop: 1,
  },
  noBenefitText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#BBBBBB',
  },
  scoreContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 12,
    minWidth: 60,
  },
  scoreText: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  scoreTextTop: {
    color: '#1A1A1A',
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#9CA3AF',
    marginTop: -2,
  },
  cardImage: {
    width: 90,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  merchantLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  storePhoto: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
  },
  progressSection: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    marginHorizontal: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 20,
  },
  progressItem: {
    flex: 1,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#374151',
  },
  progressPercent: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: '#6B7280',
  },
  progressBarContainer: {
    marginBottom: 6,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#9CA3AF',
  },
  progressTextHighlight: {
    fontFamily: FONTS.semiBold,
    color: '#374151',
  },
  progressTextNoData: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#D1D5DB',
    marginTop: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 48,
    marginHorizontal: 20,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#212121',
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    marginHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  filterButtonActive: {
    backgroundColor: '#393A39',
    borderColor: '#393A39',
  },
  filterButtonText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#777777',
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
  backToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  backToListButtonText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  courseTitleBlock: {
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  courseTitleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  courseMainTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#222222',
  },
  courseTagline: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#888888',
    marginTop: 2,
  },
  saveCourseIconButton: {
    padding: 4,
  },
  courseDescription: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#555555',
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    marginHorizontal: 10,
    marginBottom: 12,
  },
  courseSummary: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginBottom: 20,
    paddingHorizontal: 10,
    lineHeight: 21,
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
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    marginHorizontal: 8,
    marginBottom: 20,
  },
  naverRouteSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  naverRouteSummaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  naverRouteSummaryLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginBottom: 6,
  },
  naverRouteSummaryValue: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  naverRouteDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
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
    padding: 48,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    color: '#212121',
    marginBottom: 10,
  },
  emptyStateHint: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Naver-style Course Place Cards
  naverPlaceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  naverPlaceNumber: {
    position: 'absolute',
    top: 18,
    left: 18,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#393A39',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  naverPlaceNumberText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  naverPlaceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    paddingLeft: 56,
    gap: 14,
  },
  naverPlaceMerchant: {
    marginRight: 2,
  },
  naverMerchantPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  naverPlacePhoto: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  naverMerchantPlaceholderText: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#BDBDBD',
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
    marginBottom: 10,
  },
  naverBenefitInfo: {
    backgroundColor: '#F8FBF7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
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
    width: 64,
    height: 40,
    borderRadius: 6,
  },
  // Naver-style Route Segment
  naverRouteSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 36,
    paddingRight: 20,
    paddingVertical: 8,
    marginHorizontal: 6,
  },
  naverRouteDots: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginRight: 14,
  },
  naverRouteDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C4C4C4',
  },
  naverRouteDetails: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2E7D32',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  naverRouteDetailsContent: {
    flex: 1,
  },
  naverRouteMode: {
    marginBottom: 3,
  },
  naverRouteModeText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#555555',
  },
  naverRouteSegmentText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#888888',
  },
  routeDetailHint: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: '#007AFF',
    marginTop: 4,
  },
  transitLegsInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 4,
    gap: 2,
  },
  transitLegArrow: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  transitLegBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#E8E8E8',
  },
  transitLegBadgeWalk: {
    backgroundColor: '#F5F5F5',
  },
  transitLegBadgeBus: {
    backgroundColor: '#4CAF50',
  },
  transitLegBadgeSubway: {
    backgroundColor: '#2196F3',
  },
  transitLegBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: '#555555',
  },
  transitLegBadgeTextWhite: {
    color: '#FFFFFF',
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
  // Wheel Picker Styles
  wheelPickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  wheelPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  wheelPickerDone: {
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    color: '#007AFF',
  },
  wheelPickerContainer: {
    height: 220,
    paddingVertical: 10,
  },
  wheelPickerItemText: {
    fontSize: 20,
    fontFamily: FONTS.medium,
    color: '#000000',
  },
  wheelPickerIndicator: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
  },
  // Course List Styles
  backToCourseListButton: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  backToCourseListText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  courseListContainer: {
    paddingTop: 4,
    paddingHorizontal: 2,
    paddingBottom: 100,
  },
  courseListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  courseListTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  friendsButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  friendsButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#666666',
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  courseCardHeader: {
    marginBottom: 16,
  },
  courseCardTitleWrap: {
    flex: 1,
  },
  courseCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  courseCardMainTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#222222',
  },
  courseCardSubTitle: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#7A7570',
  },
  courseCardBadgeAI: {
    backgroundColor: '#393A39',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  courseCardBadgeAIText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  courseCardBadgeMy: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  courseCardBadgeMyText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: '#666666',
  },
  courseCardBadgeShare: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  courseCardBadgeShareText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: '#4A90D9',
  },
  courseCardBadgeHot: {
    backgroundColor: '#FFE8E8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  courseCardBadgeHotText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: '#E85A5A',
  },
  courseCardTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginRight: 12,
    lineHeight: 24,
  },
  courseCardBadge: {
    backgroundColor: '#F0F8EE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  courseCardBadgeSaved: {
    backgroundColor: '#FFF8E7',
  },
  courseCardBadgePopular: {
    backgroundColor: '#FFF0F0',
  },
  courseCardBadgeShared: {
    backgroundColor: '#E3F2FD',
  },
  courseCardBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
  },
  courseCardBadgeSolid: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#393A39',
  },
  courseCardBadgeTextWhite: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  courseCardPlaces: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  coursePlaceItem: {
    alignItems: 'center',
    flex: 1,
  },
  coursePlaceCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: '#E8E2D9',
  },
  coursePlaceNumText: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: '#5C5347',
  },
  coursePlaceImageContainer: {
    alignItems: 'center',
    flex: 1,
  },
  coursePlacePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  coursePlacePlaceholderText: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#BDBDBD',
  },
  courseListPlaceName: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#6B6560',
    textAlign: 'center',
    maxWidth: 80,
  },
  courseArrowContainer: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  courseArrowLine: {
    width: 20,
    height: 2,
    backgroundColor: '#E0DCD6',
    borderRadius: 1,
  },
  courseArrow: {
    fontSize: 14,
    color: '#D0D0D0',
    marginTop: 24,
    marginHorizontal: 2,
  },
  courseCardBenefit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAF8F5',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 8,
    flex: 1,
    borderWidth: 1,
    borderColor: '#F0EDE8',
  },
  courseCardBenefitWithShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#C9A854',
    marginTop: 6,
  },
  courseBenefitText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#5C5347',
    flex: 1,
    lineHeight: 18,
  },
  shareButton: {
    backgroundColor: '#212121',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  shareButtonText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  courseCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 14,
  },
  courseSavingsText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
    flex: 1,
  },
  shareIconButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  shareIconText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  sharedByText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#2196F3',
  },
  saveCourseButton: {
    backgroundColor: '#212121',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
    marginHorizontal: 2,
  },
  saveCourseButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  saveCourseButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  backFromCourseButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
});
