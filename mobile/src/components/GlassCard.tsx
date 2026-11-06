import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glowColor?: 'gold' | 'bullish' | 'bearish' | 'cyan' | 'purple' | 'none';
  borderRadius?: number;
  highlightTop?: boolean;
}

export const GlassCard: React.FC<Props> = ({
  children,
  style,
  glowColor = 'none',
  borderRadius = 18,
  highlightTop = true,
}) => {
  const getGlowBorder = () => {
    switch (glowColor) {
      case 'gold':
        return 'rgba(255, 215, 0, 0.35)';
      case 'bullish':
        return 'rgba(0, 245, 160, 0.35)';
      case 'bearish':
        return 'rgba(255, 65, 108, 0.35)';
      case 'cyan':
        return 'rgba(0, 240, 255, 0.35)';
      case 'purple':
        return 'rgba(168, 85, 247, 0.35)';
      default:
        return colors.borderGlass;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius,
          borderColor: getGlowBorder(),
        },
        style,
      ]}
    >
      {/* Subtle specular top-to-bottom reflection */}
      <LinearGradient
        colors={[
          highlightTop ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
          'rgba(255, 255, 255, 0.01)',
          'rgba(0, 0, 0, 0.20)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.gradientBg, { borderRadius }]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(14, 20, 32, 0.75)',
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  gradientBg: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
