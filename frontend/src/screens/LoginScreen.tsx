import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailLogin = () => {
    console.log('Email login:', email, password);
  };

  const handleKakaoLogin = () => {
    console.log('Kakao login');
  };

  const handleNaverLogin = () => {
    console.log('Naver login');
  };

  const handleGoogleLogin = () => {
    console.log('Google login');
  };

  const handleAppleLogin = () => {
    console.log('Apple login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/logo/logo-black.svg')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.inputLabel}>이메일</Text>
        <TextInput
          style={styles.input}
          placeholder="sample@gmail.com"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.inputLabel}>비밀번호</Text>
        <TextInput
          style={styles.input}
          placeholder="영문, 숫자, 특수문자 포함 8자 이상"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.signupButton} onPress={handleEmailLogin}>
          <Text style={styles.signupButtonText}>회원가입</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dividerContainer}>
        <Text style={styles.dividerText}>or</Text>
      </View>

      <View style={styles.socialLoginContainer}>
        <TouchableOpacity style={[styles.socialButton, styles.kakaoButton]} onPress={handleKakaoLogin}>
          <Image
            source={require('../../assets/logo/kakao-logo.svg')}
            style={styles.socialIcon}
            resizeMode="contain"
          />
          <Text style={styles.kakaoButtonText}>카카오 로그인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.socialButton, styles.naverButton]} onPress={handleNaverLogin}>
          <Image
            source={require('../../assets/logo/naver-logo.svg')}
            style={styles.socialIcon}
            resizeMode="contain"
          />
          <Text style={styles.naverButtonText}>네이버 로그인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.socialButton, styles.googleButton]} onPress={handleGoogleLogin}>
          <Image
            source={require('../../assets/logo/google-logo.svg')}
            style={styles.socialIcon}
            resizeMode="contain"
          />
          <Text style={styles.googleButtonText}>구글 로그인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.socialButton, styles.appleButton]} onPress={handleAppleLogin}>
          <Image
            source={require('../../assets/logo/apple-logo.svg')}
            style={styles.socialIcon}
            resizeMode="contain"
          />
          <Text style={styles.appleButtonText}>애플 로그인</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
  },
  formContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#212121',
  },
  signupButton: {
    backgroundColor: '#393A39',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  dividerContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerText: {
    fontSize: 14,
    color: '#999',
  },
  socialLoginContainer: {
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  socialIcon: {
    width: 24,
    height: 24,
  },
  kakaoButton: {
    backgroundColor: '#FEE500',
  },
  kakaoButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  naverButton: {
    backgroundColor: '#03C75A',
  },
  naverButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  googleButtonText: {
    color: '#212121',
    fontSize: 16,
    fontWeight: '600',
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  appleButtonText: {
    color: '#212121',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LoginScreen;
