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

  // Scaled dimensions with better minimum values for small cards
  const borderRadius = useMemo(() => Math.max(6, 20 * scale), [scale]);
  const paddingHorizontal = useMemo(() => Math.max(6, 12 * scale), [scale]);
  const paddingVertical = useMemo(() => Math.max(5, 10 * scale), [scale]);

  // Format benefit text - extract discount/savings info
  const benefitSummary = useMemo(() => {
    if (!benefit) return '혜택';

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

    // Scale-based character limit: smaller cards get fewer characters
    const maxLength = scale < 0.5 ? 12 : 20;
    return benefit.length > maxLength ? benefit.substring(0, maxLength) + '...' : benefit;
  }, [benefit, scale]);

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
          paddingBottom: Math.max(6, 12 * scale),
          borderColor: '#FFFFFF',
        }
      ]}>
        {/* Card name - top */}
        <Text
          style={[
            styles.cardName,
            {
              color: companyInfo.textColor,
              fontSize: Math.max(9, 22 * scale),
              lineHeight: Math.max(11, 26 * scale),
              flexShrink: 1,
            }
          ]}
          numberOfLines={scale < 0.5 ? 1 : 2}
          ellipsizeMode="tail"
        >
          {cardName}
        </Text>

        {/* Company name - below card name */}
        <Text
          style={[
            styles.companyName,
            {
              color: companyInfo.textColor,
              fontSize: Math.max(7, 12 * scale),
              lineHeight: Math.max(9, 16 * scale),
              flexShrink: 1,
            }
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {companyInfo.name}
        </Text>

        {/* Benefit summary - bottom */}
        <Text
          style={[
            styles.benefitSummary,
            {
              color: companyInfo.textColor,
              fontSize: Math.max(8, 16 * scale),
              lineHeight: Math.max(10, 20 * scale),
              flexShrink: 1,
            }
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
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
    marginBottom: 2,
    marginTop: 0,
    lineHeight: 20,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  companyName: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    marginBottom: 4,
    lineHeight: 14,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  benefitSummary: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    lineHeight: 13,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
});
