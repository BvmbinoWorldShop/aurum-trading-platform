import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

export const Sparkline: React.FC<Props> = ({
  data,
  width = 90,
  height = 32,
  color,
  strokeWidth = 2,
}) => {
  if (!data || data.length < 2) {
    return <View style={{ width, height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const usableHeight = height - padding * 2;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - padding - ((val - min) / range) * usableHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const isPositive = data[data.length - 1] >= data[0];
  const strokeColor = color || (isPositive ? colors.bullish : colors.bearish);

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        <Path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};
