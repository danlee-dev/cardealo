import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, SafeAreaView, Animated, Dimensions } from 'react-native';
import { FONTS, COLORS } from '../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface AdminDepartmentScreenProps {
  onBack: () => void;
}

interface Department {
  id: string;
  name: string;
  cardCount: number;
  usagePercent: number;
  benefit: string;
  spent: number;
  limit: number;
  color: string;
}

export const AdminDepartmentScreen: React.FC<AdminDepartmentScreenProps> = ({ onBack }) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  const [departments] = useState<Department[]>([
    {
      id: '1',
      name: '마케팅팀',
      cardCount: 5,
      usagePercent: 85.0,
      benefit: '86,00만원',
      spent: 850,
      limit: 1000,
      color: '#4CAF50',
    },
    {
      id: '2',
      name: '영업팀',
      cardCount: 8,
      usagePercent: 82.0,
      benefit: '123,00만원',
      spent: 1230,
      limit: 1500,
      color: '#4CAF50',
    },
    {
      id: '3',
      name: '개발팀',
      cardCount: 4,
      usagePercent: 52.5,
      benefit: '42,06만원',
      spent: 420,
      limit: 800,
      color: '#4CAF50',
    },
    {
      id: '4',
      name: '경영지원팀',
      cardCount: 3,
      usagePercent: 85.0,
      benefit: '85,00만원',
      spent: 850,
      limit: 1000,
      color: '#4CAF50',
    },
  ]);

  const formatAmount = (amount: number) => {
    return `${amount}만원`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <Animated.View
        style={[
          styles.animatedContainer,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>관리자 대시보드</Text>
          <View style={styles.settingsButton} />
        </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.pageTitle}>부서별 지출 현황</Text>

          {departments.map((dept) => (
            <View key={dept.id} style={styles.departmentCard}>
              <View style={styles.departmentHeader}>
                <Text style={styles.departmentName}>{dept.name}</Text>
                <Text style={styles.cardCount}>{dept.cardCount}개 카드</Text>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${dept.usagePercent}%`,
                        backgroundColor: dept.color,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>{dept.usagePercent}% 사용</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statAmountSpent}>
                    {formatAmount(dept.spent)}
                  </Text>
                  <Text style={styles.statAmountLimit}>
                    /{formatAmount(dept.limit)}
                  </Text>
                </View>
              </View>

              <View style={styles.benefitRow}>
                <Text style={styles.benefitLabel}>혜택</Text>
                <Text style={styles.benefitAmount}>{dept.benefit}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  animatedContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#000000',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#000000',
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  pageTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#000000',
    marginBottom: 20,
  },
  departmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  departmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  departmentName: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#000000',
  },
  cardCount: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statLabel: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#4CAF50',
  },
  statAmountSpent: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#000000',
  },
  statAmountLimit: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  benefitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  benefitLabel: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  benefitAmount: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#4CAF50',
  },
});
