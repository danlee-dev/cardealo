import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS } from '../constants/theme';
import { BackIcon } from '../components/svg';
import { AuthStorage } from '../utils/auth';
import { API_URL } from '../utils/api';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CorporateCardRegistrationScreenProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CARD_COMPANIES = [
  '신한카드',
  '삼성카드',
  '현대카드',
  'KB국민카드',
  '롯데카드',
  '하나카드',
  '우리카드',
  'NH농협카드',
  'BC카드',
  '기업은행',
];

export const CorporateCardRegistrationScreen: React.FC<CorporateCardRegistrationScreenProps> = ({
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('10000000');
  const [isLoading, setIsLoading] = useState(false);

  const [cardNameFocused, setCardNameFocused] = useState(false);
  const [cardNumberFocused, setCardNumberFocused] = useState(false);
  const [monthlyLimitFocused, setMonthlyLimitFocused] = useState(false);

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleClose = () => {
    Animated.spring(slideAnim, {
      toValue: SCREEN_WIDTH,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const limited = cleaned.slice(0, 16);
    const groups = limited.match(/.{1,4}/g);
    return groups ? groups.join('-') : '';
  };

  const handleCardNumberChange = (text: string) => {
    const formatted = formatCardNumber(text);
    setCardNumber(formatted);
  };

  const formatMonthlyLimit = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    return cleaned;
  };

  const handleMonthlyLimitChange = (text: string) => {
    const formatted = formatMonthlyLimit(text);
    setMonthlyLimit(formatted);
  };

  const validateInputs = (): boolean => {
    if (!cardName.trim()) {
      Alert.alert('오류', '카드 이름을 입력해주세요.');
      return false;
    }

    if (!selectedCompany) {
      Alert.alert('오류', '카드사를 선택해주세요.');
      return false;
    }

    const limitNum = parseInt(monthlyLimit);
    if (isNaN(limitNum) || limitNum < 100000) {
      Alert.alert('오류', '월 한도는 최소 100,000원 이상이어야 합니다.');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    try {
      const token = await AuthStorage.getToken();
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      const response = await fetch(`${API_URL}/api/corporate/cards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          card_name: cardName.trim(),
          card_number: cardNumber.replace(/-/g, ''),
          card_company: selectedCompany,
          monthly_limit: parseInt(monthlyLimit),
          benefit_summary: `${selectedCompany} 법인카드`,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          '등록 완료',
          '법인카드가 성공적으로 등록되었습니다.\n관리자 권한이 부여되었습니다.',
          [{ text: '확인', onPress: () => {
            onSuccess();
            handleClose();
          }}]
        );
      } else {
        Alert.alert('등록 실패', data.error || '법인카드 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('Corporate card registration error:', error);
      Alert.alert('오류', '법인카드 등록 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 24 : 0) + 10 }]}>
          <TouchableOpacity
            onPress={handleClose}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BackIcon width={10} height={16} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>법인카드 등록</Text>
          <View style={{ width: 10 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>법인카드 등록 안내</Text>
            <Text style={styles.infoText}>
              법인카드를 등록하면 자동으로 관리자 권한이 부여됩니다.{'\n'}
              직원을 초대하여 법인카드 사용 내역을 관리할 수 있습니다.
            </Text>
          </View>

          <Text style={styles.label}>카드 이름 *</Text>
          <TextInput
            style={[styles.input, cardNameFocused && styles.inputFocused]}
            placeholder="예: 회사 법인카드"
            placeholderTextColor="#C7C7C7"
            value={cardName}
            onChangeText={setCardName}
            onFocus={() => setCardNameFocused(true)}
            onBlur={() => setCardNameFocused(false)}
          />

          <Text style={styles.label}>카드 번호 (선택)</Text>
          <TextInput
            style={[styles.input, cardNumberFocused && styles.inputFocused]}
            placeholder="0000-0000-0000-0000"
            placeholderTextColor="#C7C7C7"
            value={cardNumber}
            onChangeText={handleCardNumberChange}
            onFocus={() => setCardNumberFocused(true)}
            onBlur={() => setCardNumberFocused(false)}
            keyboardType="number-pad"
            maxLength={19}
          />

          <Text style={styles.label}>카드사 *</Text>
          <View style={styles.companyGrid}>
            {CARD_COMPANIES.map((company) => (
              <TouchableOpacity
                key={company}
                style={[
                  styles.companyButton,
                  selectedCompany === company && styles.companyButtonSelected,
                ]}
                onPress={() => setSelectedCompany(company)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.companyButtonText,
                    selectedCompany === company && styles.companyButtonTextSelected,
                  ]}
                >
                  {company}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>월 한도 *</Text>
          <View style={styles.limitInputContainer}>
            <TextInput
              style={[styles.input, styles.limitInput, monthlyLimitFocused && styles.inputFocused]}
              placeholder="10000000"
              placeholderTextColor="#C7C7C7"
              value={monthlyLimit}
              onChangeText={handleMonthlyLimitChange}
              onFocus={() => setMonthlyLimitFocused(true)}
              onBlur={() => setMonthlyLimitFocused(false)}
              keyboardType="number-pad"
            />
            <Text style={styles.limitUnit}>원</Text>
          </View>
          <Text style={styles.limitHint}>
            설정 한도: {parseInt(monthlyLimit || '0').toLocaleString()}원
          </Text>

          <TouchableOpacity
            style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.registerButtonText}>법인카드 등록하기</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  infoBox: {
    backgroundColor: '#F5F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E3EFFF',
  },
  infoTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: '#1565C0',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#666666',
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#999999',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    width: '100%',
    height: 52,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#393A39',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: '#1565C0',
    backgroundColor: '#FFFFFF',
  },
  companyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  companyButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  companyButtonSelected: {
    borderColor: '#1565C0',
    backgroundColor: '#F5F9FF',
  },
  companyButtonText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  companyButtonTextSelected: {
    color: '#1565C0',
    fontFamily: FONTS.semiBold,
  },
  limitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  limitInput: {
    flex: 1,
    marginBottom: 8,
  },
  limitUnit: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: '#666666',
    marginLeft: 8,
    marginBottom: 8,
  },
  limitHint: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#1565C0',
    marginBottom: 24,
    marginLeft: 4,
  },
  registerButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#1565C0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
});
