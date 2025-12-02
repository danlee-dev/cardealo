import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { LogoBlack, BackIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import { AuthAPI } from '../utils/auth';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';

interface SignupScreenProps {
  onSignupSuccess: () => void;
  onBack: () => void;
}

interface CardSearchResult {
  card_name: string;
  card_benefit: string;
  card_pre_month_money: number;
}

export const SignupScreen: React.FC<SignupScreenProps> = ({ onSignupSuccess, onBack }) => {
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [isBusiness, setIsBusiness] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<CardSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [userNameFocused, setUserNameFocused] = useState(false);
  const [userIdFocused, setUserIdFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [ageFocused, setAgeFocused] = useState(false);
  const [cardNameFocused, setCardNameFocused] = useState(false);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (cardSearchQuery.trim().length >= 2) {
        searchCards(cardSearchQuery);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [cardSearchQuery]);

  const searchCards = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/card/list?keyword=${encodeURIComponent(query)}&page=1`);
      const data = await response.json();

      if (data.success && data.cards) {
        setSearchResults(data.cards.slice(0, 5));
        setShowSearchResults(true);
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

  const handleCardSelect = (card: CardSearchResult) => {
    setCardName(card.card_name);
    setCardSearchQuery(card.card_name);
    setShowSearchResults(false);
    Alert.alert('카드 선택 완료', `${card.card_name}이(가) 선택되었습니다.`);
  };

  const validateInputs = (): boolean => {
    if (!userName.trim()) {
      Alert.alert('오류', '이름을 입력해주세요.');
      return false;
    }

    if (!userId.trim()) {
      Alert.alert('오류', '아이디를 입력해주세요.');
      return false;
    }

    if (!email.trim() || !email.includes('@')) {
      Alert.alert('오류', '올바른 이메일을 입력해주세요.');
      return false;
    }

    if (!password.trim() || password.length < 8) {
      Alert.alert('오류', '비밀번호는 8자 이상이어야 합니다.');
      return false;
    }

    // 영문, 숫자, 특수문자 포함 검사
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasLetter || !hasNumber || !hasSpecial) {
      Alert.alert('오류', '비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
      return false;
    }

    const ageNum = parseInt(age);
    if (!age.trim() || isNaN(ageNum) || ageNum < 1 || ageNum > 150) {
      Alert.alert('오류', '올바른 나이를 입력해주세요.');
      return false;
    }

    // Card registration is now optional
    // Users can add cards later

    return true;
  };

  const handleSignup = async () => {
    if (!validateInputs()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await AuthAPI.register({
        user_name: userName,
        user_id: userId,
        user_pw: password,
        user_email: email,
        user_age: parseInt(age),
        isBusiness: isBusiness,
        card_name: cardName,
      });

      if (response.success) {
        Alert.alert(
          '회원가입 성공',
          '회원가입이 완료되었습니다. 로그인해주세요.',
          [{ text: '확인', onPress: onSignupSuccess }]
        );
      } else {
        Alert.alert('회원가입 실패', response.error || '회원가입에 실패했습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '회원가입 중 오류가 발생했습니다.');
      console.error('Signup error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BackIcon width={10} height={16} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>회원가입</Text>
          <View style={{ width: 10 }} />
        </View>

        <View style={styles.logoContainer}>
          <LogoBlack width={50} height={63} />
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>이름</Text>
          <TextInput
            style={[styles.input, userNameFocused && styles.inputFocused]}
            placeholder="이름을 입력하세요"
            placeholderTextColor="#C7C7C7"
            value={userName}
            onChangeText={setUserName}
            onFocus={() => setUserNameFocused(true)}
            onBlur={() => setUserNameFocused(false)}
          />

          <Text style={styles.label}>아이디</Text>
          <TextInput
            style={[styles.input, userIdFocused && styles.inputFocused]}
            placeholder="아이디를 입력하세요"
            placeholderTextColor="#C7C7C7"
            value={userId}
            onChangeText={setUserId}
            onFocus={() => setUserIdFocused(true)}
            onBlur={() => setUserIdFocused(false)}
            autoCapitalize="none"
          />

          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={[styles.input, emailFocused && styles.inputFocused]}
            placeholder="sample@gmail.com"
            placeholderTextColor="#C7C7C7"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            keyboardType={Platform.OS === 'android' ? 'default' : 'email-address'}
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={[styles.input, passwordFocused && styles.inputFocused]}
            placeholder="영문, 숫자, 특수문자 포함 8자 이상"
            placeholderTextColor="#C7C7C7"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            secureTextEntry
          />

          <Text style={styles.label}>비밀번호 확인</Text>
          <TextInput
            style={[styles.input, confirmPasswordFocused && styles.inputFocused]}
            placeholder="비밀번호를 다시 입력하세요"
            placeholderTextColor="#C7C7C7"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onFocus={() => setConfirmPasswordFocused(true)}
            onBlur={() => setConfirmPasswordFocused(false)}
            secureTextEntry
          />

          <Text style={styles.label}>나이</Text>
          <TextInput
            style={[styles.input, ageFocused && styles.inputFocused]}
            placeholder="나이를 입력하세요"
            placeholderTextColor="#C7C7C7"
            value={age}
            onChangeText={setAge}
            onFocus={() => setAgeFocused(true)}
            onBlur={() => setAgeFocused(false)}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>보유 카드</Text>
          <View>
            <TextInput
              style={[styles.input, cardNameFocused && styles.inputFocused, { marginBottom: 0 }]}
              placeholder="카드 검색 (예: 신한, 삼성)"
              placeholderTextColor="#C7C7C7"
              value={cardSearchQuery}
              onChangeText={(text) => {
                setCardSearchQuery(text);
                if (!text.trim()) {
                  setCardName('');
                }
              }}
              onFocus={() => {
                setCardNameFocused(true);
                if (searchResults.length > 0) {
                  setShowSearchResults(true);
                }
              }}
              onBlur={() => {
                setCardNameFocused(false);
                setTimeout(() => setShowSearchResults(false), 200);
              }}
            />
            {isSearching && (
              <View style={styles.searchingIndicator}>
                <ActivityIndicator size="small" color="#393A39" />
              </View>
            )}
            {showSearchResults && searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item, index) => `${item.card_name}-${index}`}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.searchResultItem}
                      onPress={() => handleCardSelect(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.searchResultName}>{item.card_name}</Text>
                      <Text style={styles.searchResultBenefit} numberOfLines={1}>
                        {item.card_benefit}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
            {cardName && (
              <View style={styles.selectedCardContainer}>
                <Text style={styles.selectedCardLabel}>선택된 카드:</Text>
                <Text style={styles.selectedCardName}>{cardName}</Text>
              </View>
            )}
          </View>

          <View style={styles.businessContainer}>
            <Text style={styles.label}>사업자이신가요?</Text>
            <View style={styles.businessButtons}>
              <TouchableOpacity
                style={[styles.businessButton, !isBusiness && styles.businessButtonActive]}
                onPress={() => setIsBusiness(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.businessButtonText, !isBusiness && styles.businessButtonTextActive]}>
                  아니오
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.businessButton, isBusiness && styles.businessButtonActive]}
                onPress={() => setIsBusiness(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.businessButtonText, isBusiness && styles.businessButtonTextActive]}>
                  예
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.signupButton, isLoading && styles.signupButtonDisabled]}
            onPress={handleSignup}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.signupButtonText}>회원가입</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#212121',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  formContainer: {
    width: '100%',
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
    borderColor: '#393A39',
    backgroundColor: '#FFFFFF',
  },
  businessContainer: {
    marginBottom: 20,
  },
  businessButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  businessButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  businessButtonActive: {
    borderColor: '#393A39',
    backgroundColor: '#FFFFFF',
  },
  businessButtonText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: '#999999',
  },
  businessButtonTextActive: {
    color: '#393A39',
    fontFamily: FONTS.semiBold,
  },
  signupButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#393A39',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  searchingIndicator: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  searchResultsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 16,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchResultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultName: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#212121',
    marginBottom: 4,
  },
  searchResultBenefit: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  selectedCardContainer: {
    backgroundColor: '#F0F7FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4AA63C',
  },
  selectedCardLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#666666',
    marginBottom: 4,
  },
  selectedCardName: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#4AA63C',
  },
});
