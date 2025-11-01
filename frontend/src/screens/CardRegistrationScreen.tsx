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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BackIcon, CameraIcon } from '../components/svg';
import { FONTS } from '../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CardRegistrationScreenProps {
  onBack: () => void;
}

export const CardRegistrationScreen: React.FC<CardRegistrationScreenProps> = ({ onBack }) => {
  const [cardImage, setCardImage] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    requestCameraPermission();
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 권한이 필요합니다.');
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 10],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setCardImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('오류', '카메라를 열 수 없습니다.');
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
        <Text style={styles.instruction}>카드를 촬영해주세요</Text>

        <TouchableOpacity
          style={[
            styles.cameraBox,
            cardImage && styles.cameraBoxWithImage
          ]}
          onPress={takePicture}
          activeOpacity={0.8}
        >
          {cardImage ? (
            <Image source={{ uri: cardImage }} style={styles.cardImage} />
          ) : (
            <View style={styles.cameraIconContainer}>
              <CameraIcon width={80} height={80} color="#999999" />
              <Text style={styles.cameraText}>카드 촬영하기</Text>
            </View>
          )}
        </TouchableOpacity>

        {cardImage && (
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={takePicture}
            activeOpacity={0.8}
          >
            <Text style={styles.retakeButtonText}>다시 촬영하기</Text>
          </TouchableOpacity>
        )}

        {cardImage && (
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => {
              Alert.alert('등록 완료', '카드가 등록되었습니다.', [
                { text: '확인', onPress: handleBack }
              ]);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>등록하기</Text>
          </TouchableOpacity>
        )}
      </View>
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
});
