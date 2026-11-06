import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { MarketAsset } from '../api/endpoints';

interface Props {
  items: MarketAsset[];
}

export const TickerBar: React.FC<Props> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((m) => {
          const isPos = (m.change_24h_pct ?? 0) >= 0;
          return (
            <View key={m.symbol} style={styles.tickerItem}>
              <View style={[styles.dot, { backgroundColor: isPos ? colors.bullish : colors.bearish }]} />
              <Text style={styles.tickerSymbol}>{m.symbol.replace('/USDT', '')}</Text>
              <Text style={styles.tickerPrice}>
                ${m.price < 10 ? m.price.toFixed(3) : m.price.toLocaleString()}
              </Text>
              <Text style={[styles.tickerChange, { color: isPos ? colors.bullish : colors.bearish }]}>
                {isPos ? '+' : ''}{(m.change_24h_pct ?? 0).toFixed(1)}%
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(10, 14, 22, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
    paddingVertical: 7,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 16,
    alignItems: 'center',
  },
  tickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tickerSymbol: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  tickerPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tickerChange: {
    fontSize: 10,
    fontWeight: '800',
  },
});
