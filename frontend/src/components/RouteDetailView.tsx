import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { FONTS, COLORS } from '../constants/theme';
import {
  BackIcon,
  TurnLeftIcon,
  TurnRightIcon,
  StraightIcon,
  UTurnIcon,
  StartIcon,
  EndIcon,
  CrosswalkIcon,
  BusIcon,
  SubwayIcon,
  CarIcon,
  WalkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from './svg';
import { API_URL } from '../utils/api';
import { getMerchantLogo } from '../constants/merchantImages';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// Types
interface Coordinate {
  latitude: number;
  longitude: number;
}

interface TurnStep {
  type: 'turn' | 'road';
  instruction: string;
  turnType?: string;
  turnCode?: number;
  roadName?: string;
  nextRoadName?: string;
  distance?: number;
  time?: number;
  coordinates?: number[] | number[][];
}

interface DrivingRoute {
  summary: {
    totalDistance: number;
    totalTime: number;
    totalFare: number;
    taxiFare: number;
  };
  steps: TurnStep[];
  polyline: string;
}

interface TransitStation {
  index: number;
  stationName: string;
  stationId: string;
  lat: string;
  lon: string;
}

interface TransitLeg {
  mode: 'WALK' | 'BUS' | 'SUBWAY';
  sectionTime: number;
  distance: number;
  start: { name?: string; lat?: number; lon?: number };
  end: { name?: string; lat?: number; lon?: number };
  steps?: Array<{
    streetName: string;
    distance: number;
    description: string;
    linestring: string;
  }>;
  route?: {
    name: string;
    routeId: string;
    routeColor: string;
    type: number;
    typeName: string;
  };
  passStopList?: {
    count: number;
    stations: TransitStation[];
  };
}

interface TransitItinerary {
  fare: number;
  totalTime: number;
  walkTime: number;
  transitTime: number;
  transferCount: number;
  legs: TransitLeg[];
}

interface TransitRoute {
  itineraries: TransitItinerary[];
}

type RouteMode = 'driving' | 'walking' | 'transit';

interface Props {
  visible: boolean;
  start: Coordinate;
  end: Coordinate;
  startName?: string;
  endName?: string;
  endPlaceId?: string;
  onClose: () => void;
  onRouteSelect?: (polyline: string, mode: RouteMode) => void;
}

export const RouteDetailView: React.FC<Props> = ({
  visible,
  start,
  end,
  startName = '출발지',
  endName = '도착지',
  endPlaceId,
  onClose,
  onRouteSelect,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const [selectedMode, setSelectedMode] = useState<RouteMode>('transit');
  const [destinationPhotos, setDestinationPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [drivingRoute, setDrivingRoute] = useState<DrivingRoute | null>(null);
  const [walkingRoute, setWalkingRoute] = useState<DrivingRoute | null>(null);
  const [transitRoute, setTransitRoute] = useState<TransitRoute | null>(null);
  const [selectedItinerary, setSelectedItinerary] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // Animation
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
      // Fetch default mode on open
      fetchRoute(selectedMode);
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Fetch destination photos
  useEffect(() => {
    const fetchDestinationPhotos = async () => {
      if (!endPlaceId || !visible) return;

      try {
        const response = await axios.get(`${API_URL}/api/place/details`, {
          params: { place_id: endPlaceId },
        });
        if (response.data && response.data.photos) {
          setDestinationPhotos(response.data.photos);
        }
      } catch (err) {
        console.log('[RouteDetail] Failed to fetch destination photos:', err);
      }
    };

    fetchDestinationPhotos();
  }, [endPlaceId, visible]);

  const fetchRoute = useCallback(async (mode: RouteMode) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/route/detail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end, mode }),
      });

      const data = await response.json();

      if (data.success) {
        if (mode === 'driving') {
          setDrivingRoute(data.route);
        } else if (mode === 'walking') {
          setWalkingRoute(data.route);
        } else if (mode === 'transit') {
          setTransitRoute(data.route);
        }
      }
    } catch (error) {
      console.error('[RouteDetail] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  const handleModeChange = (mode: RouteMode) => {
    setSelectedMode(mode);
    // Check if we already have data for this mode
    if (mode === 'driving' && !drivingRoute) {
      fetchRoute(mode);
    } else if (mode === 'walking' && !walkingRoute) {
      fetchRoute(mode);
    } else if (mode === 'transit' && !transitRoute) {
      fetchRoute(mode);
    }
  };

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}초`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}시간 ${remainingMinutes}분`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatFare = (won: number): string => {
    return `${won.toLocaleString()}원`;
  };

  const getTurnIcon = (turnCode?: number): React.ReactNode => {
    const iconSize = 20;
    switch (turnCode) {
      case 12: // Left turn
      case 16: // 8 o'clock left
      case 17: // 10 o'clock left
        return <TurnLeftIcon width={iconSize} height={iconSize} color="#1565C0" />;
      case 13: // Right turn
      case 18: // 2 o'clock right
      case 19: // 4 o'clock right
        return <TurnRightIcon width={iconSize} height={iconSize} color="#1565C0" />;
      case 14: // U-turn
        return <UTurnIcon width={iconSize} height={iconSize} color="#1565C0" />;
      case 11: // Straight
        return <StraightIcon width={iconSize} height={iconSize} color="#1565C0" />;
      case 200: // Start
        return <StartIcon width={iconSize} height={iconSize} />;
      case 201: // End
        return <EndIcon width={iconSize} height={iconSize} />;
      case 211:
      case 212:
      case 213:
      case 214:
      case 215:
      case 216:
      case 217:
        return <CrosswalkIcon width={iconSize} height={iconSize} color="#666666" />;
      default:
        return <StraightIcon width={iconSize} height={iconSize} color="#999999" />;
    }
  };

  const getModeIcon = (mode: string): React.ReactNode => {
    const iconSize = 18;
    switch (mode) {
      case 'BUS':
        return <BusIcon width={iconSize} height={iconSize} />;
      case 'SUBWAY':
        return <SubwayIcon width={iconSize} height={iconSize} />;
      case 'WALK':
        return <WalkIcon width={iconSize} height={iconSize} color="#FFFFFF" />;
      default:
        return <WalkIcon width={iconSize} height={iconSize} color="#FFFFFF" />;
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleSelectRoute = () => {
    let polyline = '';
    if (selectedMode === 'driving' && drivingRoute) {
      polyline = drivingRoute.polyline;
    } else if (selectedMode === 'walking' && walkingRoute) {
      polyline = walkingRoute.polyline;
    }
    if (polyline && onRouteSelect) {
      onRouteSelect(polyline, selectedMode);
    }
    handleClose();
  };

  // Render driving/walking route
  const renderDrivingRoute = (route: DrivingRoute) => {
    const turnSteps = route.steps.filter(s => s.type === 'turn' && s.turnCode !== 200 && s.turnCode !== 201);

    return (
      <View style={styles.routeContent}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatTime(route.summary.totalTime)}</Text>
              <Text style={styles.summaryLabel}>예상 소요</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatDistance(route.summary.totalDistance)}</Text>
              <Text style={styles.summaryLabel}>총 거리</Text>
            </View>
            {route.summary.taxiFare > 0 && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{formatFare(route.summary.taxiFare)}</Text>
                  <Text style={styles.summaryLabel}>예상 택시비</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Turn-by-turn steps */}
        <View style={styles.stepsContainer}>
          <Text style={styles.sectionTitle}>상세 경로 안내</Text>
          {turnSteps.map((step, index) => (
            <View key={index} style={styles.stepItem}>
              <View style={styles.stepIconContainer}>
                {getTurnIcon(step.turnCode)}
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepInstruction}>{step.instruction}</Text>
                {step.nextRoadName && (
                  <Text style={styles.stepRoadName}>{step.nextRoadName} 방면</Text>
                )}
                {step.turnType && (
                  <View style={styles.turnBadge}>
                    <Text style={styles.turnBadgeText}>{step.turnType}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render transit route
  const renderTransitRoute = (route: TransitRoute) => {
    if (!route.itineraries || route.itineraries.length === 0) {
      return <Text style={styles.noRouteText}>경로를 찾을 수 없습니다</Text>;
    }

    const itinerary = route.itineraries[selectedItinerary];

    return (
      <View style={styles.routeContent}>
        {/* Itinerary selector */}
        {route.itineraries.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itinerarySelector}>
            {route.itineraries.map((itin, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.itineraryOption,
                  selectedItinerary === index && styles.itineraryOptionSelected,
                ]}
                onPress={() => setSelectedItinerary(index)}
              >
                <Text style={[
                  styles.itineraryTime,
                  selectedItinerary === index && styles.itineraryTimeSelected,
                ]}>
                  {formatTime(itin.totalTime)}
                </Text>
                <Text style={[
                  styles.itineraryTransfer,
                  selectedItinerary === index && styles.itineraryTransferSelected,
                ]}>
                  환승 {itin.transferCount}회
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatTime(itinerary.totalTime)}</Text>
              <Text style={styles.summaryLabel}>총 소요</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatFare(itinerary.fare)}</Text>
              <Text style={styles.summaryLabel}>요금</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{itinerary.transferCount}회</Text>
              <Text style={styles.summaryLabel}>환승</Text>
            </View>
          </View>
          <View style={styles.timeBreakdown}>
            <Text style={styles.timeBreakdownText}>
              도보 {formatTime(itinerary.walkTime)} | 대중교통 {formatTime(itinerary.transitTime)}
            </Text>
          </View>
        </View>

        {/* Legs */}
        <View style={styles.legsContainer}>
          {itinerary.legs.map((leg, index) => (
            <View key={index}>
              <TouchableOpacity
                style={styles.legHeader}
                onPress={() => toggleSection(index)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.legModeIcon,
                  leg.mode === 'SUBWAY' && styles.legModeSubway,
                  leg.mode === 'BUS' && styles.legModeBus,
                ]}>
                  {getModeIcon(leg.mode)}
                </View>

                <View style={styles.legInfo}>
                  {leg.mode === 'WALK' ? (
                    <>
                      <Text style={styles.legTitle}>도보</Text>
                      <Text style={styles.legSubtitle}>
                        {formatDistance(leg.distance)} | {formatTime(leg.sectionTime)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.legTitleRow}>
                        <Text style={styles.legTitle}>{leg.route?.name || '노선'}</Text>
                        {leg.route?.typeName && (
                          <View style={[
                            styles.routeTypeBadge,
                            { backgroundColor: leg.route.routeColor ? `#${leg.route.routeColor}` : '#666' }
                          ]}>
                            <Text style={styles.routeTypeBadgeText}>{leg.route.typeName}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.legSubtitle}>
                        {leg.start.name} {'→'} {leg.end.name}
                      </Text>
                      <Text style={styles.legStops}>
                        {leg.passStopList?.count || 0}개 정류장 | {formatTime(leg.sectionTime)}
                      </Text>
                    </>
                  )}
                </View>

                <View style={styles.legExpandIcon}>
                  {expandedSections.has(index) ? (
                    <ChevronUpIcon width={16} height={16} color="#999999" />
                  ) : (
                    <ChevronDownIcon width={16} height={16} color="#999999" />
                  )}
                </View>
              </TouchableOpacity>

              {/* Expanded content */}
              {expandedSections.has(index) && (
                <View style={styles.legExpanded}>
                  {leg.mode === 'WALK' && leg.steps && leg.steps.length > 0 && (
                    <View style={styles.walkSteps}>
                      {leg.steps.map((step, stepIndex) => (
                        <View key={stepIndex} style={styles.walkStep}>
                          <View style={styles.walkStepDot} />
                          <Text style={styles.walkStepText}>
                            {step.description || step.streetName}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {(leg.mode === 'BUS' || leg.mode === 'SUBWAY') && leg.passStopList && (
                    <View style={styles.stationList}>
                      {leg.passStopList.stations.map((station, stationIndex) => (
                        <View key={stationIndex} style={styles.stationItem}>
                          <View style={[
                            styles.stationDot,
                            stationIndex === 0 && styles.stationDotFirst,
                            stationIndex === leg.passStopList!.stations.length - 1 && styles.stationDotLast,
                          ]} />
                          {stationIndex < leg.passStopList!.stations.length - 1 && (
                            <View style={styles.stationLine} />
                          )}
                          <Text style={[
                            styles.stationName,
                            (stationIndex === 0 || stationIndex === leg.passStopList!.stations.length - 1) && styles.stationNameHighlight,
                          ]}>
                            {station.stationName}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Connector line */}
              {index < itinerary.legs.length - 1 && (
                <View style={styles.legConnector}>
                  <View style={styles.legConnectorLine} />
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Header with destination photo */}
      <View style={styles.headerWithPhoto}>
        {/* Destination Photo */}
        {(destinationPhotos.length > 0 || getMerchantLogo(endName)) ? (
          <View style={styles.destinationPhotoContainer}>
            {getMerchantLogo(endName) ? (
              <Image
                source={getMerchantLogo(endName)}
                style={styles.destinationPhoto}
                resizeMode="cover"
              />
            ) : (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setCurrentPhotoIndex(index);
                }}
              >
                {destinationPhotos.map((photo, index) => (
                  <Image
                    key={index}
                    source={{ uri: photo }}
                    style={styles.destinationPhoto}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.3)']}
              style={styles.photoGradient}
            />
            {destinationPhotos.length > 1 && !getMerchantLogo(endName) && (
              <View style={styles.photoPagination}>
                {destinationPhotos.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      index === currentPhotoIndex && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
            <TouchableOpacity
              style={[styles.backButton, { top: insets.top + 10 }]}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <BackIcon width={10} height={16} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={[styles.photoHeaderInfo, { top: insets.top + 10 }]}>
              <Text style={styles.photoHeaderTitle}>경로 상세</Text>
              <Text style={styles.photoHeaderSubtitle} numberOfLines={1}>
                {startName} {'→'} {endName}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <BackIcon width={10} height={16} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>경로 상세</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {startName} {'→'} {endName}
              </Text>
            </View>
            <View style={{ width: 10 }} />
          </View>
        )}
      </View>

      {/* Mode Tabs */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, selectedMode === 'transit' && styles.modeTabActive]}
          onPress={() => handleModeChange('transit')}
        >
          <SubwayIcon
            width={18}
            height={18}
            color={selectedMode === 'transit' ? '#FFFFFF' : '#1565C0'}
          />
          <Text style={[styles.modeTabText, selectedMode === 'transit' && styles.modeTabTextActive]}>
            대중교통
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, selectedMode === 'driving' && styles.modeTabActive]}
          onPress={() => handleModeChange('driving')}
        >
          <CarIcon
            width={18}
            height={18}
            color={selectedMode === 'driving' ? '#FFFFFF' : '#212121'}
          />
          <Text style={[styles.modeTabText, selectedMode === 'driving' && styles.modeTabTextActive]}>
            자동차
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, selectedMode === 'walking' && styles.modeTabActive]}
          onPress={() => handleModeChange('walking')}
        >
          <WalkIcon
            width={18}
            height={18}
            color={selectedMode === 'walking' ? '#FFFFFF' : '#666666'}
          />
          <Text style={[styles.modeTabText, selectedMode === 'walking' && styles.modeTabTextActive]}>
            도보
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>경로 검색 중...</Text>
          </View>
        ) : (
          <>
            {selectedMode === 'driving' && drivingRoute && renderDrivingRoute(drivingRoute)}
            {selectedMode === 'walking' && walkingRoute && renderDrivingRoute(walkingRoute)}
            {selectedMode === 'transit' && transitRoute && renderTransitRoute(transitRoute)}
            {!loading && (
              (selectedMode === 'driving' && !drivingRoute) ||
              (selectedMode === 'walking' && !walkingRoute) ||
              (selectedMode === 'transit' && !transitRoute)
            ) && (
              <View style={styles.noRouteContainer}>
                <Text style={styles.noRouteText}>경로를 찾을 수 없습니다</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => fetchRoute(selectedMode)}
                >
                  <Text style={styles.retryButtonText}>다시 시도</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom action */}
      {(selectedMode === 'driving' || selectedMode === 'walking') &&
       ((selectedMode === 'driving' && drivingRoute) || (selectedMode === 'walking' && walkingRoute)) && (
        <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.selectButton} onPress={handleSelectRoute}>
            <Text style={styles.selectButtonText}>이 경로로 안내 시작</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
  },
  headerWithPhoto: {},
  destinationPhotoContainer: {
    width: SCREEN_WIDTH,
    height: 180,
    position: 'relative',
  },
  destinationPhoto: {
    width: SCREEN_WIDTH,
    height: 180,
  },
  photoGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHeaderInfo: {
    position: 'absolute',
    left: 70,
    right: 20,
  },
  photoHeaderTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  photoHeaderSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  photoPagination: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  paginationDotActive: {
    backgroundColor: '#FFFFFF',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginTop: 2,
  },
  modeTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: '#212121',
  },
  modeTabText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  routeContent: {},
  summaryCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
  },
  timeBreakdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    alignItems: 'center',
  },
  timeBreakdownText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  stepsContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  stepIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
  },
  stepInstruction: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#212121',
    lineHeight: 20,
  },
  stepRoadName: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginTop: 2,
  },
  turnBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 6,
  },
  turnBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#1565C0',
  },
  itinerarySelector: {
    marginBottom: 12,
  },
  itineraryOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  itineraryOptionSelected: {
    backgroundColor: '#212121',
  },
  itineraryTime: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  itineraryTimeSelected: {
    color: '#FFFFFF',
  },
  itineraryTransfer: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginTop: 2,
  },
  itineraryTransferSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
  legsContainer: {
    marginTop: 8,
  },
  legHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  legModeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  legModeSubway: {
    backgroundColor: '#1565C0',
  },
  legModeBus: {
    backgroundColor: '#2E7D32',
  },
  legInfo: {
    flex: 1,
  },
  legTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  legSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginTop: 2,
  },
  legStops: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#999999',
    marginTop: 2,
  },
  routeTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  routeTypeBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: '#FFFFFF',
  },
  legExpandIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legExpanded: {
    paddingLeft: 48,
    paddingBottom: 12,
  },
  walkSteps: {
    paddingLeft: 8,
  },
  walkStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  walkStepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#BDBDBD',
    marginRight: 10,
  },
  walkStepText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  stationList: {
    paddingLeft: 8,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  stationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BDBDBD',
    marginRight: 12,
    zIndex: 1,
  },
  stationDotFirst: {
    backgroundColor: '#1565C0',
  },
  stationDotLast: {
    backgroundColor: '#D32F2F',
  },
  stationLine: {
    position: 'absolute',
    left: 3,
    top: 16,
    bottom: -8,
    width: 2,
    backgroundColor: '#E0E0E0',
  },
  stationName: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  stationNameHighlight: {
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  legConnector: {
    paddingLeft: 18,
    height: 20,
  },
  legConnectorLine: {
    width: 2,
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  noRouteContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noRouteText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#212121',
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  selectButton: {
    backgroundColor: '#212121',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
});

export default RouteDetailView;
