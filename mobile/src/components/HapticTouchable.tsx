import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { haptic } from '../utils/haptics';

interface Props extends TouchableOpacityProps {
  hapticType?: 'light' | 'medium' | 'heavy' | 'selection' | 'success';
}

export const HapticTouchable: React.FC<Props> = ({
  hapticType = 'light',
  onPress,
  children,
  activeOpacity = 0.7,
  ...props
}) => {
  const handlePress = (e: any) => {
    switch (hapticType) {
      case 'medium':
        haptic.medium();
        break;
      case 'heavy':
        haptic.heavy();
        break;
      case 'selection':
        haptic.selection();
        break;
      case 'success':
        haptic.success();
        break;
      case 'light':
      default:
        haptic.light();
        break;
    }
    onPress?.(e);
  };

  return (
    <TouchableOpacity activeOpacity={activeOpacity} onPress={handlePress} {...props}>
      {children}
    </TouchableOpacity>
  );
};
