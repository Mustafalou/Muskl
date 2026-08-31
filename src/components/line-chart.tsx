import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type LineChartPoint = {
  label: string;
  value: number;
};

type LineChartProps = {
  points: LineChartPoint[];
  unit: string;
  height?: number;
};

const PADDING_V = 16;

export function LineChart({ points, unit, height = 160 }: LineChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;
  const chartHeight = height - PADDING_V * 2;

  function xFor(index: number) {
    return points.length > 1 ? (index / (points.length - 1)) * width : width / 2;
  }

  function yFor(value: number) {
    return PADDING_V + chartHeight - ((value - minValue) / range) * chartHeight;
  }

  const pathD = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point.value)}`).join(' ');

  return (
    <View style={styles.wrapper}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.maxLabel}>
        {minValue === maxValue ? `${maxValue}${unit}` : `${minValue}${unit} – ${maxValue}${unit}`}
      </ThemedText>

      <View style={{ height }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {points.length > 1 ? <Path d={pathD} stroke={theme.tint} strokeWidth={2} fill="none" /> : null}
            {points.map((point, index) => (
              <Circle
                key={index}
                cx={xFor(index)}
                cy={yFor(point.value)}
                r={index === points.length - 1 ? 5 : 3}
                fill={theme.tint}
              />
            ))}
          </Svg>
        ) : null}
      </View>

      <View style={styles.xLabels}>
        <ThemedText type="small" themeColor="textSecondary">
          {points[0].label}
        </ThemedText>
        {points.length > 1 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {points[points.length - 1].label}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
  },
  maxLabel: {
    textAlign: 'right',
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
