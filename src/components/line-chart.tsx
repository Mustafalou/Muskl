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
// Without it the first and last dots straddle the edges and get clipped in half.
const PADDING_H = 6;
// Scaling strictly from min to max makes every chart look dramatic: +2 kg of body weight over a
// month would climb as steeply as a 20 kg drop on a bench press. Giving the domain some slack —
// never narrower than a share of the values' own magnitude — keeps small changes looking small,
// and draws a flat series through the middle instead of flush against the bottom.
const DOMAIN_HEADROOM = 1.3;
const MIN_SPAN_RATIO = 0.15;

export function LineChart({ points, unit, height = 160 }: LineChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const span = Math.max((maxValue - minValue) * DOMAIN_HEADROOM, Math.abs(maxValue) * MIN_SPAN_RATIO, 1);
  const domainMin = (maxValue + minValue) / 2 - span / 2;
  const chartHeight = height - PADDING_V * 2;

  function xFor(index: number) {
    if (points.length <= 1) return width / 2;
    return PADDING_H + (index / (points.length - 1)) * (width - PADDING_H * 2);
  }

  function yFor(value: number) {
    return PADDING_V + chartHeight - ((value - domainMin) / span) * chartHeight;
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
