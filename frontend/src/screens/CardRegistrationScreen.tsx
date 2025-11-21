import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BackIcon, CameraIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import * as FileSystem from 'expo-file-system/legacy';
import { AuthStorage } from '../utils/auth';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';

interface CardRegistrationScreenProps {
  onBack: () => void;
}

interface CardMatch {
  card_name: string;
  card_benefit: string;
  card_pre_month_money: number;
}

interface OCRResult {
  card_number: string | null;
  card_name: string | null;
  expiry_date: string | null;
  raw_text: string | null;
}

type RegistrationMode = 'ocr' | 'search';

export const CardRegistrationScreen: React.FC<CardRegistrationScreenProps> = ({ onBack }) => {
  const [mode, setMode] = useState<RegistrationMode>('ocr');
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [matchingCards, setMatchingCards] = useState<CardMatch[]>([]);
  const [showCardSelection, setShowCardSelection] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CardMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    requestCameraPermission();
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchCards(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 권한이 필요합니다.');
    }
  };

  const searchCards = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/card/list?keyword=${encodeURIComponent(query)}&page=1`);
      const data = await response.json();

      if (data.success && data.cards) {
        setSearchResults(data.cards);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Card search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
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

  const takePicture = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setCardImage(imageUri);

        // OCR 처리
        await processCardOCR(imageUri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('오류', '카메라를 열 수 없습니다.');
    }
  };

  const processCardOCR = async (imageUri: string) => {
    setIsProcessing(true);

    try {
      // 이미지를 Base64로 변환
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });

      // 이미지 포맷 확인
      const imageFormat = imageUri.split('.').pop()?.toLowerCase() || 'jpg';

      // OCR API 호출
      const response = await fetch(`${BACKEND_URL}/api/ocr/card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64,
          image_format: imageFormat,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setOcrResult(data.ocr_result);
        setMatchingCards(data.matching_cards);

        // 매칭된 카드가 있으면 선택 모달 표시
        if (data.matching_cards && data.matching_cards.length > 0) {
          setShowCardSelection(true);
        } else {
          Alert.alert(
            'OCR 처리 완료',
            `카드사: ${data.ocr_result.card_name || '인식 실패'}\n카드번호: ${data.ocr_result.card_number || '인식 실패'}\n유효기간: ${data.ocr_result.expiry_date || '인식 실패'}\n\n일치하는 카드를 찾지 못했습니다.`,
          );
        }
      } else {
        Alert.alert('오류', 'OCR 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('OCR error:', error);
      Alert.alert('오류', 'OCR 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardSelect = async (cardName: string) => {
    setShowCardSelection(false);

    try {
      const token = await AuthStorage.getToken();

      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/card/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          card_name: cardName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          '등록 완료',
          `${cardName}이(가) 등록되었습니다.`,
          [{ text: '확인', onPress: handleBack }]
        );
      } else {
        Alert.alert('등록 실패', data.error || '카드 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('Card registration error:', error);
      Alert.alert('오류', '카드 등록 중 오류가 발생했습니다.');
    }
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
        <Text style={styles.headerTitle}>카드 등록하기</Text>
        <View style={{ width: 10 }} />
      </View>

      <View style={styles.content}>
        {/* 모드 선택 탭 */}
        <View style={styles.modeTabContainer}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'ocr' && styles.modeTabActive]}
            onPress={() => setMode('ocr')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeTabText, mode === 'ocr' && styles.modeTabTextActive]}>
              카메라 촬영
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'search' && styles.modeTabActive]}
            onPress={() => setMode('search')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeTabText, mode === 'search' && styles.modeTabTextActive]}>
              카드 검색
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'ocr' ? (
          <>
            <Text style={styles.instruction}>카드를 촬영해주세요</Text>

        <TouchableOpacity
          style={[
            styles.cameraBox,
            cardImage && styles.cameraBoxWithImage
          ]}
          onPress={takePicture}
          activeOpacity={0.8}
          disabled={isProcessing}
        >
          {cardImage ? (
            <Image source={{ uri: cardImage }} style={styles.cardImage} />
          ) : (
            <View style={styles.cameraIconContainer}>
              <CameraIcon width={80} height={80} color="#999999" />
              <Text style={styles.cameraText}>카드 촬영하기</Text>
            </View>
          )}
          {isProcessing && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4AA63C" />
              <Text style={styles.loadingText}>카드 정보 인식 중...</Text>
            </View>
          )}
        </TouchableOpacity>

            {cardImage && !isProcessing && (
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={takePicture}
                activeOpacity={0.8}
              >
                <Text style={styles.retakeButtonText}>다시 촬영하기</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <Text style={styles.instruction}>카드를 검색해주세요</Text>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="카드 이름을 입력하세요 (예: 신한, 삼성)"
                placeholderTextColor="#C7C7C7"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {isSearching && (
                <View style={styles.searchingIndicator}>
                  <ActivityIndicator size="small" color="#393A39" />
                </View>
              )}
            </View>

            {searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                keyExtractor={(item, index) => `${item.card_name}-${index}`}
                showsVerticalScrollIndicator={true}
                style={styles.searchResultsList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResultCard}
                    onPress={() => handleCardSelect(item.card_name)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.searchResultCardName}>{item.card_name}</Text>
                    <Text style={styles.searchResultCardBenefit} numberOfLines={2}>
                      {item.card_benefit}
                    </Text>
                    {item.card_pre_month_money > 0 && (
                      <Text style={styles.searchResultCardCondition}>
                        전월 {(item.card_pre_month_money / 10000).toFixed(0)}만원 이상
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}

            {searchQuery.trim().length > 0 && !isSearching && searchResults.length === 0 && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>검색 결과가 없습니다</Text>
                <Text style={styles.noResultsSubtext}>다른 키워드로 검색해보세요</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* 카드 선택 모달 */}
      <Modal
        visible={showCardSelection}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCardSelection(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>카드를 선택해주세요</Text>
            <Text style={styles.modalSubtitle}>
              OCR로 인식된 정보와 일치하는 카드
            </Text>

            {ocrResult && (
              <View style={styles.ocrInfoBox}>
                <Text style={styles.ocrInfoText}>
                  인식된 카드사: {ocrResult.card_name || '알 수 없음'}
                </Text>
                {ocrResult.card_number && (
                  <Text style={styles.ocrInfoText}>
                    카드번호: {ocrResult.card_number}
                  </Text>
                )}
              </View>
            )}

            <ScrollView style={styles.cardList}>
              {matchingCards.map((card, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.cardItem}
                  onPress={() => handleCardSelect(card.card_name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cardItemName}>{card.card_name}</Text>
                  <Text style={styles.cardItemBenefit} numberOfLines={2}>
                    {card.card_benefit}
                  </Text>
                  {card.card_pre_month_money > 0 && (
                    <Text style={styles.cardItemCondition}>
                      전월 {(card.card_pre_month_money / 10000).toFixed(0)}만원 이상
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCardSelection(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  instruction: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 40,
    textAlign: 'center',
  },
  cameraBox: {
    width: '100%',
    height: 240,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cameraBoxWithImage: {
    borderColor: '#212121',
    borderStyle: 'solid',
    backgroundColor: '#FFFFFF',
  },
  cameraIconContainer: {
    alignItems: 'center',
  },
  cameraText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: '#999999',
    marginTop: 16,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  retakeButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#212121',
    marginBottom: 12,
  },
  retakeButtonText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#212121',
  },
  submitButton: {
    backgroundColor: '#4AA63C',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#4AA63C',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
  },
  ocrInfoBox: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  ocrInfoText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#333333',
    marginBottom: 4,
  },
  cardList: {
    maxHeight: 400,
    marginBottom: 16,
  },
  cardItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardItemName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 8,
  },
  cardItemBenefit: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 6,
  },
  cardItemCondition: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#4AA63C',
  },
  modalCloseButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#666666',
  },
  modeTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#999999',
  },
  modeTabTextActive: {
    color: '#212121',
    fontFamily: FONTS.semiBold,
  },
  searchContainer: {
    marginBottom: 24,
  },
  searchInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#393A39',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  searchingIndicator: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  searchResultCardName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 8,
  },
  searchResultCardBenefit: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 6,
  },
  searchResultCardCondition: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#4AA63C',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  noResultsText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#999999',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#CCCCCC',
  },
});
