import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { LogoBlack, KakaoLogo, NaverLogo, GoogleLogo, AppleLogo } from '../components/svg';
import { FONTS } from '../constants/theme';
import { AuthAPI } from '../utils/auth';

interface LoginScreenProps {
  onLogin: () => void;
  onSignup: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await AuthAPI.login(email, password);

      if (response.success) {
        onLogin();
      } else {
        Alert.alert('로그인 실패', response.error || '이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '로그인 중 오류가 발생했습니다.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKakaoLogin = () => {
    console.log('Kakao login pressed');
  };

  const handleNaverLogin = () => {
    console.log('Naver login pressed');
  };

  const handleGoogleLogin = () => {
    console.log('Google login pressed');
  };

  const handleAppleLogin = () => {
    console.log('Apple login pressed');
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
        <View style={styles.logoContainer}>
          <LogoBlack width={60} height={76} />
        </View>

        <View style={styles.formContainer}>
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

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>로그인</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signupLink}
            onPress={onSignup}
            activeOpacity={0.7}
          >
            <Text style={styles.signupLinkText}>
              계정이 없으신가요? <Text style={styles.signupLinkBold}>회원가입</Text>
            </Text>
          </TouchableOpacity>

          <Text style={styles.dividerText}>or</Text>

          <TouchableOpacity style={styles.kakaoButton} onPress={handleKakaoLogin}>
            <View style={styles.buttonContent}>
              <View style={styles.logoWrapper}>
                <KakaoLogo width={18} height={18} />
              </View>
              <Text style={styles.kakaoButtonText}>카카오 로그인</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.naverButton} onPress={handleNaverLogin}>
            <View style={styles.buttonContent}>
              <View style={styles.logoWrapper}>
                <NaverLogo width={15} height={15} />
              </View>
              <Text style={styles.naverButtonText}>네이버 로그인</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
            <View style={styles.buttonContent}>
              <View style={styles.logoWrapper}>
                <GoogleLogo width={19} height={19} />
              </View>
              <Text style={styles.googleButtonText}>구글 로그인</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.appleButton} onPress={handleAppleLogin}>
            <View style={styles.buttonContent}>
              <View style={styles.logoWrapper}>
                <AppleLogo width={22} height={22} />
              </View>
              <Text style={styles.appleButtonText}>애플 로그인</Text>
            </View>
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
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
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
    height: 56,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: '#393A39',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: '#393A39',
    backgroundColor: '#FFFFFF',
  },
  loginButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#393A39',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  signupLink: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  signupLinkText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  signupLinkBold: {
    fontFamily: FONTS.bold,
    color: '#393A39',
  },
  dividerText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
  },
  kakaoButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FEE500',
    borderRadius: 12,
    marginBottom: 12,
  },
  naverButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#03C75A',
    borderRadius: 12,
    marginBottom: 12,
  },
  googleButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  appleButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  buttonContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoWrapper: {
    position: 'absolute',
    left: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#000000',
  },
  naverButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#393A39',
  },
  appleButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#393A39',
  },
});
