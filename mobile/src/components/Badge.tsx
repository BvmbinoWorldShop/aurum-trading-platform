import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  label: string;
  variant?: 'bullish' | 'bearish' | 'neutral' | 'gold' | 'warning' | 'purple';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<Props> = ({ label, variant = 'neutral', size = 'sm' }) => {
  const getStyles = () => {
    switch (variant) {
      case 'bullish':
        return { bg: colors.bullishBg, text: colors.bullish, border: 'rgba(0, 230, 118, 0.3)' };
      case 'bearish':
        return { bg: colors.bearishBg, text: colors.bearish, border: 'rgba(255, 59, 86, 0.3)' };
      case 'gold':
        return { bg: colors.goldGlow, text: colors.gold, border: 'rgba(244, 196, 48, 0.3)' };
      case 'warning':
        return { bg: colors.warningBg, text: colors.warning, border: 'rgba(255, 170, 0, 0.3)' };
      case 'purple':
        return { bg: colors.purpleBg, text: colors.purple, border: 'rgba(168, 85, 247, 0.3)' };
      default:
        return { bg: colors.bgElevated, text: colors.textSecondary, border: colors.border };
    }
  };

  const s = getStyles();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: s.bg, borderColor: s.border },
        size === 'md' && styles.badgeMd,
      ]}
    >
      <Text style={[styles.text, { color: s.text }, size === 'md' && styles.textMd]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  textMd: {
    fontSize: 12,
  },
});
