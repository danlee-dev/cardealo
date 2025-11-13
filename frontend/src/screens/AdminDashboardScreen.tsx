import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, SafeAreaView, Animated, Dimensions } from 'react-native';
import { FONTS, COLORS } from '../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface AdminDashboardScreenProps {
  onClose: () => void;
  onViewDepartments: () => void;
}

interface StatCard {
  title: string;
  value: string;
  subValue: string;
  trend?: string;
  iconBg: string;
  icon: string;
}

interface Alert {
  id: string;
  department: string;
  message: string;
  time: string;
  type: 'warning' | 'info' | 'success';
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ onClose, onViewDepartments }) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const [stats] = useState<StatCard[]>([
    {
      title: '총 지출',
      value: '3180만원',
      subValue: '억년 대비 77.6% ↓',
      iconBg: '#E3F2FD',
      icon: '',
    },
    {
      title: '총 혜택',
      value: '318만원',
      subValue: '+0.0% 작년동일',
      trend: '+0.0%',
      iconBg: '#E8F5E9',
      icon: '',
    },
    {
      title: '활용 카드',
      value: '20장',
      subValue: '4개 부서',
      iconBg: '#F3E5F5',
      icon: '',
    },
    {
      title: '혜택 발굴률',
      value: '77.6%',
      subValue: '',
      iconBg: '#FFF3E0',
      icon: '',
    },
  ]);

  const [alerts] = useState<Alert[]>([
    {
      id: '1',
      department: '마케팅팀',
      message: '법인카드 한도 85% 사용 ⚠️',
      time: '3시간 전',
      type: 'warning',
    },
    {
      id: '2',
      department: '영업팀',
      message: '대륙 세제 요청 알림',
      time: '3시간 전',
      type: 'info',
    },
    {
      id: '3',
      department: '개발팀',
      message: '카드 문제 조치 미결 완료',
      time: '1일 전',
      type: 'success',
    },
  ]);

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'warning':
        return '#FFF9C4';
      case 'info':
        return '#E3F2FD';
      case 'success':
        return '#F1F8E9';
      default:
        return '#F5F5F5';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return '!';
      case 'info':
        return 'i';
      case 'success':
        return '✓';
      default:
        return '•';
    }
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
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>관리자 대시보드</Text>
          <View style={styles.settingsButton} />
        </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.sectionSubtitle}>실시간 법인카드 현황을 확인하세요</Text>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: stat.iconBg }]} />
                <Text style={styles.statTitle}>{stat.title}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
                {stat.subValue && (
                  <Text style={styles.statSubValue}>{stat.subValue}</Text>
                )}
                {stat.trend && (
                  <View style={styles.statTrend}>
                    <Text style={[styles.statTrendText, { color: '#4CAF50' }]}>{stat.trend}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Real-time Alerts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>실시간 알림</Text>

            {alerts.map((alert) => (
              <View
                key={alert.id}
                style={[styles.alertCard, { backgroundColor: getAlertColor(alert.type) }]}
              >
                <View style={styles.alertIcon}>
                  <Text style={styles.alertIconText}>{getAlertIcon(alert.type)}</Text>
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.alertMessage}>
                    <Text style={styles.alertDepartment}>{alert.department}</Text> {alert.message}
                  </Text>
                  <Text style={styles.alertTime}>{alert.time}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Department Button */}
          <TouchableOpacity
            style={styles.departmentButton}
            onPress={onViewDepartments}
            activeOpacity={0.8}
          >
            <Text style={styles.departmentButtonText}>부서별 지출 현황 더보기</Text>
            <Text style={styles.departmentButtonArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: '1%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statTitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#666666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#000000',
    marginBottom: 4,
  },
  statSubValue: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  statTrend: {
    marginTop: 4,
  },
  statTrendText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#000000',
    marginBottom: 16,
  },
  alertCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  alertIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertIconText: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#000000',
  },
  alertContent: {
    flex: 1,
    justifyContent: 'center',
  },
  alertMessage: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#333333',
    marginBottom: 4,
    lineHeight: 20,
  },
  alertDepartment: {
    fontFamily: FONTS.bold,
    color: '#000000',
  },
  alertTime: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  departmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5E9',
    padding: 18,
    borderRadius: 12,
    marginTop: 12,
  },
  departmentButtonText: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: '#2E7D32',
  },
  departmentButtonArrow: {
    fontSize: 20,
    color: '#2E7D32',
  },
});
