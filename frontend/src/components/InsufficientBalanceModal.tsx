import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { FONTS } from '../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface InsufficientBalanceModalProps {
  visible: boolean;
  currentBalance: number;
  requiredAmount: number;
  onClose: () => void;
  onCharge?: () => void;
}

export const InsufficientBalanceModal: React.FC<InsufficientBalanceModalProps> = ({
  visible,
  currentBalance,
  requiredAmount,
  onClose,
  onCharge,
}) => {
  const shortage = requiredAmount - currentBalance;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>!</Text>
          </View>

          <Text style={styles.title}>잔액이 부족합니다</Text>
          <Text style={styles.subtitle}>
            결제를 진행하려면 잔액을 충전해주세요.
          </Text>

          <View style={styles.balanceInfo}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>현재 잔액</Text>
              <Text style={styles.balanceValue}>{currentBalance.toLocaleString()}원</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>결제 금액</Text>
              <Text style={styles.balanceValue}>{requiredAmount.toLocaleString()}원</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.balanceRow}>
              <Text style={styles.shortageLabel}>부족 금액</Text>
              <Text style={styles.shortageValue}>{shortage.toLocaleString()}원</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>닫기</Text>
            </TouchableOpacity>
            {onCharge && (
              <TouchableOpacity
                style={styles.chargeButton}
                onPress={onCharge}
                activeOpacity={0.7}
              >
                <Text style={styles.chargeButtonText}>충전하기</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: '#EF4444',
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  balanceInfo: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  balanceValue: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
  },
  shortageLabel: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#EF4444',
  },
  shortageValue: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#EF4444',
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#666666',
  },
  chargeButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    alignItems: 'center',
  },
  chargeButtonText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
});
