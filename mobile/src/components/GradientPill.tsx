import React from 'react';
import { Text, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { HapticTouchable } from './HapticTouchable';

interface Props {
  label: string;
  variant?: 'gold' | 'bullish' | 'bearish' | 'cyber' | 'royal' | 'glass' | 'neutral';
  active?: boolean;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
}

export const GradientPill: React.FC<Props> = ({
  label,
  variant = 'gold',
  active = true,
  icon,
  onPress,
  style,
  size = 'md',
}) => {
  const getGradientColors = (): readonly [string, string, ...string[]] => {
    if (!active) {
      return ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)'];
    }
    switch (variant) {
      case 'gold':
        return ['#FFE57F', '#FFC107', '#FFA000'];
      case 'bullish':
        return ['#00F5A0', '#00D9F5'];
      case 'bearish':
        return ['#FF416C', '#FF4B2B'];
      case 'cyber':
        return ['#8A2387', '#E94057', '#F27121'];
      case 'royal':
        return ['#6366F1', '#A855F7', '#EC4899'];
      case 'glass':
        return ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.04)'];
      default:
        return ['#2C3E50', '#1A252F'];
    }
  };

  const isLightText = !active || variant === 'bearish' || variant === 'cyber' || variant === 'royal' || variant === 'neutral';

  const content = (
    <LinearGradient
      colors={getGradientColors()}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.pill,
        size === 'sm' && styles.pillSm,
        size === 'lg' && styles.pillLg,
        !active && styles.pillInactive,
        style,
      ]}
    >
      {/* Specular glass reflection layer */}
      <View style={styles.specularTop} />

      <View style={styles.innerRow}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text
          style={[
            styles.label,
            size === 'sm' && styles.labelSm,
            size === 'lg' && styles.labelLg,
            { color: active ? (isLightText ? '#FFFFFF' : '#06090E') : colors.textMuted },
          ]}
        >
          {label}
        </Text>
      </View>
    </LinearGradient>
  );

  if (onPress) {
    return (
      <HapticTouchable onPress={onPress} hapticType="selection">
        {content}
      </HapticTouchable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  pill: {
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    alignSelf: 'flex-start',
  },
  pillSm: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  pillLg: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 30,
  },
  pillInactive: {
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowOpacity: 0,
    elevation: 0,
  },
  specularTop: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconContainer: {
    marginRight: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  labelSm: {
    fontSize: 10,
    letterSpacing: 0.4,
  },
  labelLg: {
    fontSize: 14,
    letterSpacing: 0.8,
  },
});
