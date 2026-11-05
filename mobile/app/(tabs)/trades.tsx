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
import { Badge } from '../../src/components/Badge';
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>TRADE MANAGEMENT</Text>
        <Text style={styles.subtitle}>Execution monitoring & audited journal</Text>
      </View>

      {/* Performance Bar */}
      <View style={styles.perfBar}>
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
          <Text style={[styles.perfVal, { color: colors.gold }]}>
            {stats?.win_rate ? `${(stats.win_rate * 100).toFixed(1)}%` : 'N/A'}
          </Text>
        </View>

        <View style={styles.perfItem}>
          <Text style={styles.perfLabel}>PROFIT FACTOR</Text>
          <Text style={styles.perfVal}>
            {stats?.profit_factor ? stats.profit_factor.toFixed(2) : 'N/A'}
          </Text>
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.tabContainer}>
        <HapticTouchable
          style={[styles.segmentBtn, tab === 'open' && styles.segmentBtnActive]}
          hapticType="selection"
          onPress={() => setTab('open')}
        >
          <Text style={[styles.segmentText, tab === 'open' && styles.segmentTextActive]}>
            Active Positions ({dashboard?.open_trades?.length ?? 0})
          </Text>
        </HapticTouchable>

        <HapticTouchable
          style={[styles.segmentBtn, tab === 'closed' && styles.segmentBtnActive]}
          hapticType="selection"
          onPress={() => setTab('closed')}
        >
          <Text style={[styles.segmentText, tab === 'closed' && styles.segmentTextActive]}>
            Closed History ({stats?.closed_trades ?? 0})
          </Text>
        </HapticTouchable>
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
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
              {tab === 'open' ? 'No Open Positions' : 'No Closed Trades Yet'}
            </Text>
            <Text style={styles.emptySub}>
              {tab === 'open'
                ? 'Autopilot or manual orders will appear here in real-time.'
                : 'Closed orders will be recorded with full trade auditing.'}
            </Text>
          </View>
        ) : (
          trades.map((t) => {
            const isLong = t.side === 'LONG';
            const isClosed = t.status === 'closed';
            const pnl = t.pnl ?? 0;
            const isProfit = pnl >= 0;

            return (
              <View key={t.id} style={styles.tradeCard}>
                <View style={styles.cardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.tradeSymbol}>{t.symbol}</Text>
                    <Badge
                      label={t.side}
                      variant={isLong ? 'bullish' : 'bearish'}
                    />
                    <Badge label={t.broker.toUpperCase()} variant="neutral" />
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
                    <HapticTouchable
                      style={styles.closeBtn}
                      onPress={() => handleClose(t)}
                      disabled={closingId === t.id}
                      hapticType="medium"
                    >
                      {closingId === t.id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.closeBtnText}>Close</Text>
                      )}
                    </HapticTouchable>
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
                    Source: <Text style={{ color: colors.textPrimary }}>{t.source}</Text>
                    {t.close_reason && ` · Reason: ${t.close_reason}`}
                  </Text>
                  <Text style={styles.footerTime}>
                    {new Date(t.opened_at * 1000).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
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
    backgroundColor: colors.bgPrimary,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  perfBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSecondary,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  perfItem: {
    alignItems: 'center',
  },
  perfLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  perfVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: colors.bgElevated,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.textPrimary,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 30,
  },
  tradeCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontWeight: '800',
  },
  closeBtn: {
    backgroundColor: 'rgba(255, 59, 86, 0.15)',
    borderWidth: 1,
    borderColor: colors.bearish,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.bearish,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  statCol: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
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
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
