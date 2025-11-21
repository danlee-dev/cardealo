import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { FONTS } from '../constants/theme';
import { getCardCompanyInfo } from '../constants/cardCompanies';

interface CardPlaceholderProps {
  cardName: string;
  benefit?: string;
  preMoney?: number;
  width?: number;
  height?: number;
  style?: ViewStyle;
}

export const CardPlaceholder: React.FC<CardPlaceholderProps> = ({
  cardName,
  benefit,
  preMoney = 0,
  width = 320,
  height = 200,
  style,
}) => {
  const companyInfo = useMemo(() => getCardCompanyInfo(cardName), [cardName]);

  // Scale factor based on card size (base: 320x200)
  const scale = useMemo(() => Math.min(width / 320, height / 200), [width, height]);

  // Scaled dimensions
  const borderRadius = useMemo(() => Math.max(8, 20 * scale), [scale]);
  const paddingHorizontal = useMemo(() => Math.max(4, 12 * scale), [scale]);
  const paddingVertical = useMemo(() => Math.max(4, 10 * scale), [scale]);

  // Format benefit text - extract discount/savings info
  const benefitSummary = useMemo(() => {
    if (!benefit) return '혜택 정보';

    // Try to extract percentage or amount
    const percentMatch = benefit.match(/(\d+(?:\.\d+)?)%/);
    const amountMatch = benefit.match(/(\d{1,3}(?:,?\d{3})*)원/);
    const pointMatch = benefit.match(/(\d+(?:\.\d+)?)p/i);

    if (percentMatch) {
      return `${percentMatch[1]}% 할인`;
    } else if (pointMatch) {
      return `${pointMatch[1]}p 적립`;
    } else if (amountMatch) {
      const amount = amountMatch[1].replace(/,/g, '');
      return `${amount}원 할인`;
    }

    // Take first 20 characters or less
    return benefit.length > 20 ? benefit.substring(0, 20) + '...' : benefit;
  }, [benefit]);

  return (
    <View style={[
      styles.container,
      {
        width,
        height,
        borderRadius,
        shadowColor: '#000000',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
      },
      style
    ]}>
      <View style={[
        styles.card,
        {
          backgroundColor: companyInfo.color,
          borderRadius,
          paddingHorizontal,
          paddingTop: paddingVertical,
          paddingBottom: Math.max(4, 12 * scale),
          borderColor: '#FFFFFF',
        }
      ]}>
        {/* Card name - top */}
        <Text
          style={[
            styles.cardName,
            {
              color: companyInfo.textColor,
              fontSize: Math.max(10, 22 * scale),
              lineHeight: Math.max(12, 26 * scale),
            }
          ]}
          numberOfLines={2}
        >
          {cardName}
        </Text>

        {/* Company name - below card name */}
        <Text
          style={[
            styles.companyName,
            {
              color: companyInfo.textColor,
              fontSize: Math.max(6, 12 * scale),
              lineHeight: Math.max(8, 16 * scale),
            }
          ]}
          numberOfLines={1}
        >
          {companyInfo.name}
        </Text>

        {/* Benefit summary - bottom */}
        <Text
          style={[
            styles.benefitSummary,
            {
              color: companyInfo.textColor,
              fontSize: Math.max(9, 16 * scale),
              lineHeight: Math.max(11, 20 * scale),
            }
          ]}
          numberOfLines={1}
        >
          {benefitSummary}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
  },
  card: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000000',
    position: 'relative',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardName: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    marginBottom: 4,
    marginTop: 2,
    lineHeight: 22,
    letterSpacing: -0.5,
  },
  companyName: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    marginBottom: 8,
    lineHeight: 16,
    letterSpacing: -0.3,
  },
  benefitSummary: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    lineHeight: 14,
    letterSpacing: -0.3,
  },
});
