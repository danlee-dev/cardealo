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
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CameraIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import * as FileSystem from 'expo-file-system/legacy';
import { AuthStorage } from '../utils/auth';
import { API_URL } from '../utils/api';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ReceiptScanScreenProps {
  onBack: () => void;
  onSaved?: () => void;
}

interface ReceiptResult {
  merchant_name: string | null;
  merchant_category: string | null;
  total_amount: number | null;
  payment_date: string | null;
  payment_time: string | null;
  card_number: string | null;
  approval_number: string | null;
  raw_text: string | null;
  success: boolean;
}

export const ReceiptScanScreen: React.FC<ReceiptScanScreenProps> = ({ onBack, onSaved }) => {
  const insets = useSafeAreaInsets();
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    requestPermissions();
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (isProcessing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isProcessing]);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== 'granted' || galleryStatus !== 'granted') {
      Alert.alert('권한 필요', '카메라와 갤러리 접근 권한이 필요합니다.');
    }
  };

  const handleBack = () => {
    Animated.spring(slideAnim, {
      toValue: SCREEN_WIDTH,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const takePicture = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setReceiptImage(imageUri);
        await processReceiptOCR(imageUri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('오류', '카메라를 열 수 없습니다.');
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setReceiptImage(imageUri);
        await processReceiptOCR(imageUri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('오류', '갤러리를 열 수 없습니다.');
    }
  };

  const processReceiptOCR = async (imageUri: string) => {
    setIsProcessing(true);
    setShowResult(false);

    try {
      const token = await AuthStorage.getToken();
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        setIsProcessing(false);
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });

      const imageFormat = imageUri.split('.').pop()?.toLowerCase() || 'jpg';

      const response = await fetch(`${API_URL}/api/ocr/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: base64,
          image_format: imageFormat,
        }),
      });

      const data = await response.json();

      if (data.success && data.receipt) {
        setReceiptResult(data.receipt);
        setShowResult(true);
      } else {
        Alert.alert('인식 실패', '영수증을 인식하지 못했습니다. 다시 촬영해주세요.');
      }
    } catch (error) {
      console.error('OCR error:', error);
      Alert.alert('오류', '영수증 인식 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return `${amount.toLocaleString()}원`;
  };

  const handleSave = async () => {
    if (!receiptResult) return;

    try {
      const token = await AuthStorage.getToken();
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      // 법인카드 결제 내역으로 저장 시도
      const response = await fetch(`${API_URL}/api/corporate/receipt/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          merchant_name: receiptResult.merchant_name,
          merchant_category: receiptResult.merchant_category,
          total_amount: receiptResult.total_amount,
          payment_date: receiptResult.payment_date,
          payment_time: receiptResult.payment_time,
          card_number: receiptResult.card_number,
          approval_number: receiptResult.approval_number,
          raw_text: receiptResult.raw_text,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const usage = data.updated_usage;
        let message = '영수증이 법인카드 사용 내역에 저장되었습니다.';
        if (usage?.personal) {
          const remaining = usage.personal.remaining.toLocaleString();
          message += `\n\n잔여 한도: ${remaining}원`;
        }
        Alert.alert('저장 완료', message, [{
          text: '확인',
          onPress: () => {
            onSaved?.();
            handleBack();
          }
        }]);
      } else {
        // 법인카드 멤버가 아니거나 한도 초과 등
        if (data.error?.includes('법인카드 멤버가 아닙니다')) {
          Alert.alert(
            '저장 불가',
            '법인카드 멤버로 등록되어 있지 않습니다.\n관리자에게 초대를 요청해주세요.',
            [{ text: '확인', onPress: handleBack }]
          );
        } else {
          Alert.alert('저장 실패', data.error || '저장에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('Receipt save error:', error);
      Alert.alert('오류', '영수증 저장 중 오류가 발생했습니다.');
    }
  };

  const handleRetake = () => {
    setReceiptImage(null);
    setReceiptResult(null);
    setShowResult(false);
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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BackIcon width={10} height={16} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>영수증 스캔</Text>
        <View style={{ width: 10 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!showResult ? (
          <>
            <Text style={styles.instruction}>
              영수증을 촬영하면{'\n'}자동으로 정보를 인식합니다
            </Text>

            <TouchableOpacity
              onPress={takePicture}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              activeOpacity={1}
              disabled={isProcessing}
            >
              <Animated.View
                style={[
                  styles.cameraBox,
                  receiptImage && styles.cameraBoxWithImage,
                  { transform: [{ scale: isProcessing ? pulseAnim : scaleAnim }] }
                ]}
              >
                {/* Corner markers */}
                <View style={[styles.cornerMark, styles.cornerTopLeft]} />
                <View style={[styles.cornerMark, styles.cornerTopRight]} />
                <View style={[styles.cornerMark, styles.cornerBottomLeft]} />
                <View style={[styles.cornerMark, styles.cornerBottomRight]} />

                {receiptImage ? (
                  <Image source={{ uri: receiptImage }} style={styles.receiptImage} />
                ) : (
                  <View style={styles.cameraIconContainer}>
                    <View style={styles.cameraIconCircle}>
                      <CameraIcon width={32} height={32} color="#666666" />
                    </View>
                    <Text style={styles.cameraText}>영수증 촬영</Text>
                    <Text style={styles.cameraSubtext}>영수증 전체가 보이게 촬영해주세요</Text>
                  </View>
                )}
                {isProcessing && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#212121" />
                    <Text style={styles.loadingText}>인식 중...</Text>
                  </View>
                )}
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.galleryButton}
              onPress={pickFromGallery}
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              <Text style={styles.galleryButtonText}>갤러리에서 선택</Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              영수증이 잘 보이도록 평평한 곳에 놓고 촬영해주세요
            </Text>
          </>
        ) : (
          <>
            {/* Result View */}
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>인식 결과</Text>
              <TouchableOpacity onPress={handleRetake} activeOpacity={0.7}>
                <Text style={styles.retakeText}>다시 촬영</Text>
              </TouchableOpacity>
            </View>

            {/* Receipt Preview */}
            {receiptImage && (
              <View style={styles.previewContainer}>
                <Image source={{ uri: receiptImage }} style={styles.previewImage} />
              </View>
            )}

            {/* Extracted Info */}
            <View style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>가맹점</Text>
                <Text style={styles.resultValue}>
                  {receiptResult?.merchant_name || '인식 실패'}
                </Text>
              </View>

              {receiptResult?.merchant_category && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>업종</Text>
                  <Text style={styles.resultValueSmall}>
                    {receiptResult.merchant_category}
                  </Text>
                </View>
              )}

              <View style={styles.resultDivider} />

              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>결제금액</Text>
                <Text style={styles.resultValueLarge}>
                  {formatCurrency(receiptResult?.total_amount)}
                </Text>
              </View>

              <View style={styles.resultDivider} />

              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>결제일시</Text>
                <Text style={styles.resultValue}>
                  {receiptResult?.payment_date || '-'}
                  {receiptResult?.payment_time && ` ${receiptResult.payment_time}`}
                </Text>
              </View>

              {receiptResult?.card_number && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>카드번호</Text>
                  <Text style={styles.resultValueSmall}>
                    {receiptResult.card_number}
                  </Text>
                </View>
              )}

              {receiptResult?.approval_number && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>승인번호</Text>
                  <Text style={styles.resultValueSmall}>
                    {receiptResult.approval_number}
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>저장하기</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleRetake}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>다시 촬영</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  instruction: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#212121',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 32,
  },
  cameraBox: {
    width: '100%',
    height: 320,
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EBEDF0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  cameraBoxWithImage: {
    backgroundColor: '#000000',
    borderColor: '#212121',
    borderWidth: 2,
  },
  cornerMark: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#D1D5DB',
    borderWidth: 2,
  },
  cornerTopLeft: {
    top: 16,
    left: 16,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  cornerTopRight: {
    top: 16,
    right: 16,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  cornerBottomLeft: {
    bottom: 16,
    left: 16,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  cornerBottomRight: {
    bottom: 16,
    right: 16,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
  cameraIconContainer: {
    alignItems: 'center',
  },
  cameraIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cameraText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#212121',
    marginBottom: 6,
  },
  cameraSubtext: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  galleryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 24,
  },
  galleryButtonText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  hint: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: '#212121',
  },
  // Result styles
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  retakeText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  previewContainer: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  resultLabel: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  resultValue: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#212121',
  },
  resultValueSmall: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  resultValueLarge: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  resultDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  actionButtons: {
    gap: 12,
  },
  saveButton: {
    height: 54,
    backgroundColor: '#212121',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  cancelButton: {
    height: 54,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
});
