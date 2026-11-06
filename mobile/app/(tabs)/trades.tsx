import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { HapticTouchable } from '../../src/components/HapticTouchable';
import { GlassCard } from '../../src/components/GlassCard';
import { GradientPill } from '../../src/components/GradientPill';
import { api, Trade } from '../../src/api/endpoints';
import { useApp } from '../../src/context/AppContext';
import { haptic } from '../../src/utils/haptics';

export default function TradesScreen() {
  const { dashboard, refreshDashboard } = useApp();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);

  const loadTrades = async () => {
    try {
      const data = await api.trades(tab);
      setTrades(data);
    } catch (err) {
      console.log('Error loading trades', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadTrades();
  }, [tab]);

  const handleClose = (trade: Trade) => {
    Alert.alert(
      `Close ${trade.side} ${trade.symbol}?`,
      `Position size: ${trade.qty.toFixed(4)}\nEntered at: $${trade.entry.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Position',
          style: 'destructive',
          onPress: async () => {
            try {
              setClosingId(trade.id);
              haptic.medium();
              await api.closeTrade(trade.id);
              haptic.success();
              Alert.alert('Position Closed', `${trade.symbol} closed successfully.`);
              loadTrades();
              refreshDashboard();
            } catch (err: any) {
              haptic.error();
              Alert.alert('Close Error', err.message);
            } finally {
              setClosingId(null);
            }
          },
        },
      ]
    );
  };

  const stats = dashboard?.stats;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Glass Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>EXECUTION ENGINE</Text>
          <Text style={styles.subtitle}>Audited ledger & position lifecycle</Text>
        </View>

        <GradientPill
          label={tab === 'open' ? 'ACTIVE' : 'AUDITED'}
          variant="gold"
          size="sm"
        />
      </View>

      {/* Glassmorphic Performance Bar */}
      <View style={styles.perfWrapper}>
        <GlassCard glowColor="gold" borderRadius={16} style={styles.perfBar}>
          <View style={styles.perfItem}>
            <Text style={styles.perfLabel}>NET REALIZED</Text>
            <Text
              style={[
                styles.perfVal,
                { color: (stats?.net_pnl ?? 0) >= 0 ? colors.bullish : colors.bearish },
              ]}
            >
              {(stats?.net_pnl ?? 0) >= 0 ? '+' : ''}${(stats?.net_pnl ?? 0).toFixed(2)}
            </Text>
          </View>

          <View style={styles.perfItem}>
            <Text style={styles.perfLabel}>HISTORICAL WIN RATE</Text>
            <Text style={[styles.perfVal, { color: colors.goldBright }]}>
              {stats?.win_rate ? `${(stats.win_rate * 100).toFixed(1)}%` : 'N/A'}
            </Text>
          </View>

          <View style={styles.perfItem}>
            <Text style={styles.perfLabel}>PROFIT FACTOR</Text>
            <Text style={styles.perfVal}>
              {stats?.profit_factor ? stats.profit_factor.toFixed(2) : 'N/A'}
            </Text>
          </View>
        </GlassCard>
      </View>

      {/* Gradient Segmented Control */}
      <View style={styles.tabContainer}>
        <GradientPill
          label={`ACTIVE POSITIONS (${dashboard?.open_trades?.length ?? 0})`}
          variant={tab === 'open' ? 'gold' : 'glass'}
          active={tab === 'open'}
          size="sm"
          onPress={() => setTab('open')}
        />

        <GradientPill
          label={`CLOSED HISTORY (${stats?.closed_trades ?? 0})`}
          variant={tab === 'closed' ? 'gold' : 'glass'}
          active={tab === 'closed'}
          size="sm"
          onPress={() => setTab('closed')}
        />
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTrades();
              refreshDashboard();
            }}
            tintColor={colors.gold}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} />
        ) : trades.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="documents-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {tab === 'open' ? 'No Active Positions' : 'No Closed Trades Recorded'}
            </Text>
            <Text style={styles.emptySub}>
              {tab === 'open'
                ? 'Autopilot or manual orders will stream here with real-time execution feedback.'
                : 'Closed orders will be recorded with immutable audited parameters.'}
            </Text>
          </View>
        ) : (
          trades.map((t) => {
            const isLong = t.side === 'LONG';
            const isClosed = t.status === 'closed';
            const pnl = t.pnl ?? 0;
            const isProfit = pnl >= 0;

            return (
              <GlassCard
                key={t.id}
                glowColor={isClosed ? (isProfit ? 'bullish' : 'bearish') : 'gold'}
                borderRadius={18}
                style={styles.tradeCard}
              >
                <View style={styles.cardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.tradeSymbol}>{t.symbol}</Text>
                    <GradientPill
                      label={t.side}
                      variant={isLong ? 'bullish' : 'bearish'}
                      size="sm"
                    />
                    <GradientPill
                      label={t.broker.toUpperCase()}
                      variant="glass"
                      size="sm"
                    />
                  </View>

                  {isClosed ? (
                    <Text
                      style={[
                        styles.pnlText,
                        { color: isProfit ? colors.bullish : colors.bearish },
                      ]}
                    >
                      {isProfit ? '+' : ''}${pnl.toFixed(2)}
                    </Text>
                  ) : (
                    <GradientPill
                      label="CLOSE"
                      variant="bearish"
                      size="sm"
                      onPress={() => handleClose(t)}
                    />
                  )}
                </View>

                {/* Grid stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>ENTRY</Text>
                    <Text style={styles.statValue}>${t.entry.toFixed(2)}</Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>STOP LOSS</Text>
                    <Text style={[styles.statValue, { color: colors.bearish }]}>
                      ${t.stop.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>TAKE PROFIT</Text>
                    <Text style={[styles.statValue, { color: colors.bullish }]}>
                      ${t.take_profit.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>QTY</Text>
                    <Text style={styles.statValue}>{t.qty.toFixed(4)}</Text>
                  </View>
                </View>

                {/* Footer details */}
                <View style={styles.cardFooter}>
                  <Text style={styles.footerText}>
                    Trigger: <Text style={{ color: colors.textPrimary }}>{t.source}</Text>
                    {t.close_reason && ` · Reason: ${t.close_reason}`}
                  </Text>
                  <Text style={styles.footerTime}>
                    {new Date(t.opened_at * 1000).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgVoid,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  perfWrapper: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  perfBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  perfItem: {
    alignItems: 'center',
  },
  perfLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  perfVal: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 30,
  },
  tradeCard: {
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tradeSymbol: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pnlText: {
    fontSize: 16,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  statCol: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  footerTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
