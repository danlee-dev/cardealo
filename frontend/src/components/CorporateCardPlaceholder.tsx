import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { FONTS } from '../constants/theme';

interface CorporateCardPlaceholderProps {
  cardName: string;
  cardCompany?: string;
  department?: string;
  role?: string;
  monthlyLimit?: number;
  usedAmount?: number;
  width?: number;
  height?: number;
  style?: ViewStyle;
}

export const CorporateCardPlaceholder: React.FC<CorporateCardPlaceholderProps> = ({
  cardName,
  cardCompany,
  department,
  role,
  monthlyLimit = 0,
  usedAmount = 0,
  width = 320,
  height = 200,
  style,
}) => {
  // Scale factor based on card size (base: 320x200)
  const scale = useMemo(() => Math.min(width / 320, height / 200), [width, height]);

  // Scaled dimensions with better minimum values for small cards
  const borderRadius = useMemo(() => Math.max(6, 20 * scale), [scale]);
  const paddingHorizontal = useMemo(() => Math.max(6, 12 * scale), [scale]);
  const paddingVertical = useMemo(() => Math.max(5, 10 * scale), [scale]);

  // Format limit display
  const limitDisplay = useMemo(() => {
    if (monthlyLimit <= 0) return '';
    const remaining = monthlyLimit - usedAmount;
    if (scale < 0.5) {
      return `${Math.floor(remaining / 10000)}만원`;
    }
    return `잔여: ${remaining.toLocaleString()}원`;
  }, [monthlyLimit, usedAmount, scale]);

  // Role display
  const roleDisplay = useMemo(() => {
    switch (role) {
      case 'admin': return '관리자';
      case 'manager': return '매니저';
      default: return '사용자';
    }
  }, [role]);

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
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
      },
      style
    ]}>
      <View style={[
        styles.card,
        {
          borderRadius,
          paddingHorizontal,
          paddingTop: paddingVertical,
          paddingBottom: Math.max(10, 14 * scale),
        }
      ]}>
        {/* Corporate badge - top right (hide on very small cards) */}
        {scale >= 0.35 && (
          <View style={[
            styles.corporateBadge,
            {
              top: Math.max(4, 8 * scale),
              right: Math.max(4, 8 * scale),
              paddingHorizontal: Math.max(3, 6 * scale),
              paddingVertical: Math.max(1, 3 * scale),
              borderRadius: Math.max(2, 4 * scale),
            }
          ]}>
            <Text style={[
              styles.corporateBadgeText,
              { fontSize: Math.max(5, 8 * scale) }
            ]}>
              {scale < 0.5 ? 'CORP' : 'CORPORATE'}
            </Text>
          </View>
        )}

        {/* Card name - top */}
        <Text
          style={[
            styles.cardName,
            {
              fontSize: Math.max(9, 20 * scale),
              lineHeight: Math.max(11, 24 * scale),
              paddingRight: scale >= 0.35 ? Math.max(25, 50 * scale) : 0,
            }
          ]}
          numberOfLines={scale < 0.5 ? 1 : 2}
          ellipsizeMode="tail"
        >
          {cardName}
        </Text>

        {/* Company and department info */}
        <View style={[styles.infoRow, { maxWidth: '100%' }]}>
          {cardCompany && (
            <Text
              style={[
                styles.companyName,
                {
                  fontSize: Math.max(6, 11 * scale),
                  lineHeight: Math.max(8, 14 * scale),
                  flexShrink: 1,
                  maxWidth: scale < 0.5 ? '100%' : '60%',
                }
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {cardCompany}
            </Text>
          )}
          {department && scale >= 0.4 && (
            <View style={[
              styles.departmentBadge,
              {
                paddingHorizontal: Math.max(3, 6 * scale),
                paddingVertical: Math.max(1, 2 * scale),
                borderRadius: Math.max(2, 4 * scale),
                marginLeft: Math.max(4, 8 * scale),
                flexShrink: 1,
                maxWidth: '40%',
              }
            ]}>
              <Text
                style={[
                  styles.departmentText,
                  { fontSize: Math.max(5, 9 * scale) }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {department}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom section - limit info */}
        <View style={[styles.bottomSection, { maxWidth: '100%' }]}>
          {limitDisplay && (
            <Text
              style={[
                styles.limitText,
                {
                  fontSize: Math.max(7, 14 * scale),
                  lineHeight: Math.max(9, 18 * scale),
                  flexShrink: 1,
                }
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {limitDisplay}
            </Text>
          )}
          {scale >= 0.5 && (
            <Text style={[
              styles.roleText,
              { fontSize: Math.max(6, 10 * scale) }
            ]}>
              {roleDisplay}
            </Text>
          )}
        </View>
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
    borderWidth: 2,
    borderColor: '#C9A962',
    position: 'relative',
    justifyContent: 'space-between',
    overflow: 'hidden',
    backgroundColor: '#1A1A2E',
  },
  corporateBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#C9A962',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  corporateBadgeText: {
    color: '#1A1A2E',
    fontFamily: FONTS.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  cardName: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    marginBottom: 2,
    marginTop: 0,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  companyName: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#A0A0A0',
    lineHeight: 14,
  },
  departmentBadge: {
    backgroundColor: 'rgba(201, 169, 98, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  departmentText: {
    color: '#C9A962',
    fontFamily: FONTS.medium,
    fontSize: 9,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#C9A962',
    lineHeight: 18,
  },
  roleText: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: '#808080',
  },
});
