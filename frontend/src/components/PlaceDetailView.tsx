import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { StarIcon, CloseIcon, ClockIcon, ChevronRightIcon } from './svg';
import { FONTS } from '../constants/theme';
import { API_URL } from '../utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlaceDetails {
  place_id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number | null;
  user_ratings_total: number | null;
  opening_hours: {
    open_now: boolean;
    weekday_text: string[];
  } | null;
  photos: string[];
  price_level: number | null;
  types: string[];
}

interface PlaceDetailViewProps {
  placeId: string;
  storeName: string;
  storeCategory: string;
  onClose: () => void;
  onNavigate?: () => void;
}

export const PlaceDetailView: React.FC<PlaceDetailViewProps> = ({
  placeId,
  storeName,
  storeCategory,
  onClose,
  onNavigate,
}) => {
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showHours, setShowHours] = useState(false);

  useEffect(() => {
    fetchPlaceDetails();
  }, [placeId]);

  const fetchPlaceDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/place/details`, {
        params: { place_id: placeId },
      });
      setDetails(response.data);
    } catch (err) {
      console.error('Failed to fetch place details:', err);
      setError('Failed to load place details');
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (details?.phone) {
      Linking.openURL(`tel:${details.phone}`);
    }
  };

  const handleWebsite = () => {
    if (details?.website) {
      Linking.openURL(details.website);
    }
  };

  const getPriceLevelText = (level: number | null) => {
    if (level === null) return null;
    const symbols = ['Free', '$', '$$', '$$$', '$$$$'];
    return symbols[level] || null;
  };

  const getCategoryKorean = (category: string) => {
    const map: { [key: string]: string } = {
      'cafe': '카페',
      'restaurant': '음식점',
      'mart': '마트',
      'convenience': '편의점',
      'bakery': '베이커리',
      'pharmacy': '약국',
      'beauty': '뷰티',
      'movie': '영화관',
      'gas_station': '주유소',
      'other': '기타',
    };
    return map[category] || category;
  };

  // Loading State
  if (loading) {
    return (
      <View style={styles.container}>
        {/* Hero placeholder with close button */}
        <View style={[styles.heroPlaceholder, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.floatingCloseButton, { top: insets.top + 12 }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <CloseIcon width={20} height={20} color="#FFFFFF" />
          </TouchableOpacity>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.heroLoadingText}>{storeName}</Text>
        </View>
        <View style={styles.loadingBody}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
          <View style={styles.skeletonCard} />
        </View>
      </View>
    );
  }

  // Error State
  if (error || !details) {
    return (
      <View style={styles.container}>
        <View style={[styles.heroPlaceholder, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.floatingCloseButton, { top: insets.top + 12 }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <CloseIcon width={20} height={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.heroErrorIcon}>!</Text>
          <Text style={styles.heroLoadingText}>{storeName}</Text>
        </View>
        <View style={styles.errorBody}>
          <Text style={styles.errorTitle}>정보를 불러올 수 없습니다</Text>
          <Text style={styles.errorSubtitle}>잠시 후 다시 시도해주세요</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPlaceDetails}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasPhotos = details.photos && details.photos.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero Image Section */}
        <View style={styles.heroSection}>
          {hasPhotos ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setCurrentPhotoIndex(index);
                }}
              >
                {details.photos.map((photo, index) => (
                  <Image
                    key={index}
                    source={{ uri: photo }}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              <LinearGradient
                colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.6)']}
                style={styles.heroGradient}
              />
              {details.photos.length > 1 && (
                <View style={[styles.photoPagination, { bottom: 16 }]}>
                  {details.photos.map((_, index) => (
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
            </>
          ) : (
            <View style={styles.heroPlaceholderImage}>
              <Text style={styles.heroPlaceholderText}>
                {details.name.charAt(0)}
              </Text>
            </View>
          )}

          {/* Floating Close Button */}
          <TouchableOpacity
            onPress={onClose}
            style={[styles.floatingCloseButton, { top: insets.top + 12 }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <CloseIcon width={20} height={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Name & Category */}
          <View style={styles.titleSection}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{getCategoryKorean(storeCategory)}</Text>
            </View>
            <Text style={styles.placeName}>{details.name}</Text>

            {/* Rating */}
            {details.rating && (
              <View style={styles.ratingRow}>
                <StarIcon width={16} height={16} color="#FFB800" />
                <Text style={styles.ratingText}>{details.rating.toFixed(1)}</Text>
                {details.user_ratings_total && (
                  <Text style={styles.reviewCount}>
                    ({details.user_ratings_total.toLocaleString()}개 리뷰)
                  </Text>
                )}
                {details.price_level !== null && (
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceText}>{getPriceLevelText(details.price_level)}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Info Cards */}
          <View style={styles.infoCards}>
            {/* Address Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardIcon}>
                <Text style={styles.infoCardIconText}>pin</Text>
              </View>
              <View style={styles.infoCardContent}>
                <Text style={styles.infoCardLabel}>주소</Text>
                <Text style={styles.infoCardValue}>{details.address}</Text>
              </View>
            </View>

            {/* Opening Hours Card */}
            {details.opening_hours && (
              <TouchableOpacity
                style={styles.infoCard}
                onPress={() => setShowHours(!showHours)}
                activeOpacity={0.7}
              >
                <View style={styles.infoCardIcon}>
                  <ClockIcon width={20} height={20} color="#666666" />
                </View>
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardLabel}>영업시간</Text>
                  <View style={styles.hoursStatusRow}>
                    <Text style={[
                      styles.openStatus,
                      { color: details.opening_hours.open_now ? '#22C55E' : '#EF4444' }
                    ]}>
                      {details.opening_hours.open_now ? '영업 중' : '영업 종료'}
                    </Text>
                    <ChevronRightIcon
                      width={16}
                      height={16}
                      color="#999999"
                      style={{ transform: [{ rotate: showHours ? '90deg' : '0deg' }] }}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {showHours && details.opening_hours?.weekday_text && (
              <View style={styles.hoursDetail}>
                {details.opening_hours.weekday_text.map((text, index) => (
                  <Text key={index} style={styles.hoursText}>{text}</Text>
                ))}
              </View>
            )}

            {/* Phone Card */}
            {details.phone && (
              <TouchableOpacity style={styles.infoCard} onPress={handleCall} activeOpacity={0.7}>
                <View style={styles.infoCardIcon}>
                  <Text style={styles.infoCardIconText}>call</Text>
                </View>
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardLabel}>전화</Text>
                  <Text style={styles.infoCardValueLink}>{details.phone}</Text>
                </View>
                <ChevronRightIcon width={16} height={16} color="#999999" />
              </TouchableOpacity>
            )}

            {/* Website Card */}
            {details.website && (
              <TouchableOpacity style={styles.infoCard} onPress={handleWebsite} activeOpacity={0.7}>
                <View style={styles.infoCardIcon}>
                  <Text style={styles.infoCardIconText}>web</Text>
                </View>
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardLabel}>웹사이트</Text>
                  <Text style={styles.infoCardValueLink} numberOfLines={1}>
                    {details.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </Text>
                </View>
                <ChevronRightIcon width={16} height={16} color="#999999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {/* Bottom Action */}
      {onNavigate && (
        <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.navigateButton} onPress={onNavigate} activeOpacity={0.8}>
            <Text style={styles.navigateButtonText}>길찾기</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },

  // Hero Section
  heroSection: {
    width: SCREEN_WIDTH,
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: 280,
    backgroundColor: '#F0F0F0',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroPlaceholder: {
    height: 200,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderImage: {
    width: SCREEN_WIDTH,
    height: 280,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderText: {
    fontSize: 72,
    fontFamily: FONTS.bold,
    color: '#CCCCCC',
  },
  heroLoadingText: {
    marginTop: 12,
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  heroErrorIcon: {
    fontSize: 48,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    opacity: 0.5,
  },
  floatingCloseButton: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPagination: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: '#FFFFFF',
    width: 20,
  },

  // Content
  content: {
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingTop: 24,
  },

  // Title Section
  titleSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#2E7D32',
  },
  placeName: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#888888',
    marginLeft: 4,
  },
  priceBadge: {
    marginLeft: 8,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priceText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#10B981',
  },

  // Info Cards
  infoCards: {
    paddingHorizontal: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  infoCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoCardIconText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#888888',
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#888888',
    marginBottom: 2,
  },
  infoCardValue: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  infoCardValueLink: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#2E7D32',
  },
  hoursStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  openStatus: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
  hoursDetail: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    marginTop: -6,
  },
  hoursText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#666666',
    lineHeight: 24,
  },

  // Loading & Error States
  loadingBody: {
    padding: 20,
  },
  skeletonTitle: {
    width: '60%',
    height: 28,
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    marginBottom: 12,
  },
  skeletonSubtitle: {
    width: '40%',
    height: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginBottom: 24,
  },
  skeletonCard: {
    width: '100%',
    height: 80,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  errorBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#888888',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#1A1A1A',
  },

  // Bottom Action
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  navigateButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  navigateButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
});

export default PlaceDetailView;
