import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/context/AppContext';
import { colors } from '../../src/theme/colors';
import { HapticTouchable } from '../../src/components/HapticTouchable';
import { Badge } from '../../src/components/Badge';
import { Sparkline } from '../../src/components/Sparkline';
import { api, SignalData } from '../../src/api/endpoints';
import { haptic } from '../../src/utils/haptics';

export default function HomeScreen() {
  const router = useRouter();
  const { dashboard, refreshing, refreshDashboard, toggleAutopilot, triggerKillSwitch } = useApp();
  const [executing, setExecuting] = useState<string | null>(null);

  const isLive = dashboard?.mode === 'live';
  const autopilotArmed = !!dashboard?.autopilot?.armed;
  const killSwitchActive = !!dashboard?.autopilot?.kill_switch;

  const handleToggleAutopilot = () => {
    if (!autopilotArmed && isLive) {
      Alert.alert(
        'Arm Live Autopilot?',
        'You are in LIVE TRADING mode. The bot will automatically execute orders with real capital on your exchange/broker accounts according to risk parameters.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Arm Live Bot',
            style: 'destructive',
            onPress: () => toggleAutopilot(true, true),
          },
        ]
      );
    } else {
      toggleAutopilot(!autopilotArmed);
    }
  };

  const handleKillSwitch = () => {
    Alert.alert(
      'EMERGENCY KILL SWITCH',
      'This will IMMEDIATELY halt all autopilot scans and close all open positions across all connected exchanges/brokers at market price.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'ACTIVATE KILL SWITCH',
          style: 'destructive',
          onPress: () => triggerKillSwitch(),
        },
      ]
    );
  };

  const handleQuickExecute = async (sig: SignalData) => {
    Alert.alert(
      `Execute ${sig.direction} ${sig.symbol}?`,
      `Entry: ~$${sig.price.toLocaleString()}\nStop Loss: $${sig.stop?.toFixed(2) || 'None'}\nTake Profit: $${sig.take_profit?.toFixed(2) || 'None'}\nAI Confidence: ${(sig.confidence * 100).toFixed(0)}%`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Execute Order',
          onPress: async () => {
            try {
              setExecuting(sig.symbol);
              haptic.medium();
              await api.executeTrade(sig.symbol);
              haptic.success();
              Alert.alert('Order Placed', `${sig.direction} on ${sig.symbol} filled successfully.`);
              refreshDashboard();
            } catch (err: any) {
              haptic.error();
              Alert.alert('Execution Error', err.message);
            } finally {
              setExecuting(null);
            }
          },
        },
      ]
    );
  };

  const fgValue = dashboard?.sentiment?.value ?? 50;
  const fgColor =
    fgValue > 60 ? colors.bullish : fgValue < 40 ? colors.bearish : colors.warning;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logoTitle}>AURUM</Text>
          <Text style={styles.logoSubtitle}>AUTONOMOUS QUANT & AI</Text>
        </View>

        <View style={styles.headerActions}>
          <HapticTouchable
            style={[styles.iconBtn, { backgroundColor: colors.goldGlow, borderColor: 'rgba(244, 196, 48, 0.3)', borderWidth: 1 }]}
            onPress={() => router.push('/profile')}
            hapticType="selection"
          >
            <Ionicons name="person" size={18} color={colors.gold} />
          </HapticTouchable>

          <Badge
            label={isLive ? 'LIVE' : 'PAPER TRADING'}
            variant={isLive ? 'gold' : 'purple'}
          />

          <HapticTouchable
            style={styles.iconBtn}
            onPress={() => router.push('/learn')}
          >
            <Ionicons name="school-outline" size={20} color={colors.textPrimary} />
          </HapticTouchable>

          <HapticTouchable
            style={styles.iconBtn}
            onPress={() => router.push('/plugins')}
          >
            <Ionicons name="cube-outline" size={20} color={colors.textPrimary} />
          </HapticTouchable>

          <HapticTouchable
            style={styles.iconBtn}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
          </HapticTouchable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshDashboard}
            tintColor={colors.gold}
          />
        }
      >
        {/* Equity Card */}
        <View style={styles.equityCard}>
          <View style={styles.equityHeader}>
            <Text style={styles.equityLabel}>TOTAL ESTIMATED NET WORTH</Text>
            <View style={styles.dailyPnlContainer}>
              <Text style={styles.pnlLabel}>Today's P&L: </Text>
              <Text
                style={[
                  styles.pnlValue,
                  {
                    color:
                      (dashboard?.daily_pnl ?? 0) >= 0 ? colors.bullish : colors.bearish,
                  },
                ]}
              >
                {(dashboard?.daily_pnl ?? 0) >= 0 ? '+' : ''}$
                {(dashboard?.daily_pnl ?? 0).toFixed(2)}
              </Text>
            </View>
          </View>

          <Text style={styles.equityAmount}>
            ${(dashboard?.equity ?? 10000).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>

          {/* Autopilot Bar */}
          <View style={styles.autopilotRow}>
            <View style={styles.autopilotStatus}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: killSwitchActive
                      ? colors.bearish
                      : autopilotArmed
                      ? colors.bullish
                      : colors.textMuted,
                  },
                ]}
              />
              <Text style={styles.autopilotText}>
                Autopilot:{' '}
                <Text
                  style={{
                    color: killSwitchActive
                      ? colors.bearish
                      : autopilotArmed
                      ? colors.bullish
                      : colors.textMuted,
                    fontWeight: '700',
                  }}
                >
                  {killSwitchActive ? 'HALTED (KILL SWITCH)' : autopilotArmed ? 'ARMED & HUNTING' : 'DISARMED'}
                </Text>
              </Text>
            </View>

            <HapticTouchable
              style={[
                styles.armBtn,
                {
                  backgroundColor: autopilotArmed ? 'rgba(255, 59, 86, 0.15)' : 'rgba(0, 230, 118, 0.15)',
                  borderColor: autopilotArmed ? colors.bearish : colors.bullish,
                },
              ]}
              hapticType="medium"
              onPress={handleToggleAutopilot}
            >
              <Ionicons
                name={autopilotArmed ? 'pause' : 'play'}
                size={14}
                color={autopilotArmed ? colors.bearish : colors.bullish}
              />
              <Text
                style={[
                  styles.armBtnText,
                  { color: autopilotArmed ? colors.bearish : colors.bullish },
                ]}
              >
                {autopilotArmed ? 'Disarm' : 'Arm Bot'}
              </Text>
            </HapticTouchable>
          </View>
        </View>

        {/* Psychology / Fear & Greed Gauge */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="pulse" size={18} color={colors.gold} />
              <Text style={styles.cardTitle}>MARKET PSYCHOLOGY</Text>
            </View>
            <Text style={[styles.sentimentLabel, { color: fgColor }]}>
              {dashboard?.sentiment?.label?.toUpperCase() || 'NEUTRAL'} ({fgValue}/100)
            </Text>
          </View>

          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, Math.max(0, fgValue))}%`, backgroundColor: fgColor },
              ]}
            />
          </View>

          <Text style={styles.sentimentSubtext}>
            {fgValue < 25
              ? 'Extreme Fear: High retail panic. Quant models search for accumulation opportunities.'
              : fgValue > 75
              ? 'Extreme Greed: Retail euphoria. AI applies tighter stops to guard against sharp pullbacks.'
              : 'Balanced Sentiment: Normal market conditions with steady liquidity.'}
          </Text>
        </View>

        {/* Top AI Signals */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="hardware-chip" size={18} color={colors.gold} />
              <Text style={styles.cardTitle}>HIGH-CONFIDENCE SIGNALS</Text>
            </View>
            <HapticTouchable onPress={() => router.push('/(tabs)/markets')}>
              <Text style={styles.linkText}>View All</Text>
            </HapticTouchable>
          </View>

          {(!dashboard?.top_signals || dashboard.top_signals.length === 0) ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Scanning markets for high-probability setups...</Text>
            </View>
          ) : (
            dashboard.top_signals.slice(0, 4).map((sig) => {
              const isLong = sig.direction === 'LONG';
              const isShort = sig.direction === 'SHORT';
              const isFlat = sig.direction === 'FLAT';

              return (
                <View key={sig.symbol} style={styles.signalRow}>
                  <View style={styles.signalLeft}>
                    <Text style={styles.symbolText}>{sig.symbol}</Text>
                    <Text style={styles.assetName}>{sig.name || sig.asset_class}</Text>
                    <View style={styles.badgeRow}>
                      <Badge
                        label={sig.direction}
                        variant={isLong ? 'bullish' : isShort ? 'bearish' : 'neutral'}
                      />
                      <Text style={styles.confidenceText}>
                        Conf: {(sig.confidence * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.signalRight}>
                    <Text style={styles.priceText}>
                      ${sig.price < 10 ? sig.price.toFixed(4) : sig.price.toLocaleString()}
                    </Text>
                    {!isFlat && (
                      <HapticTouchable
                        style={[
                          styles.actionBtn,
                          {
                            backgroundColor: isLong ? colors.bullish : colors.bearish,
                            opacity: executing === sig.symbol ? 0.6 : 1,
                          },
                        ]}
                        hapticType="medium"
                        onPress={() => handleQuickExecute(sig)}
                        disabled={executing === sig.symbol}
                      >
                        <Text style={styles.actionBtnText}>
                          {executing === sig.symbol ? '...' : isLong ? 'BUY' : 'SELL'}
                        </Text>
                      </HapticTouchable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Active Positions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="swap-horizontal" size={18} color={colors.gold} />
              <Text style={styles.cardTitle}>ACTIVE POSITIONS ({dashboard?.open_trades?.length ?? 0})</Text>
            </View>
            <HapticTouchable onPress={() => router.push('/(tabs)/trades')}>
              <Text style={styles.linkText}>Manage</Text>
            </HapticTouchable>
          </View>

          {(!dashboard?.open_trades || dashboard.open_trades.length === 0) ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No positions currently open.</Text>
            </View>
          ) : (
            dashboard.open_trades.map((t) => (
              <View key={t.id} style={styles.positionRow}>
                <View>
                  <Text style={styles.symbolText}>{t.symbol}</Text>
                  <Text style={styles.subDetail}>
                    {t.side} · Qty: {t.qty.toFixed(4)} · Entry: ${t.entry.toFixed(2)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Badge label="IN PLAY" variant="gold" />
                  <Text style={styles.stopText}>SL: ${t.stop.toFixed(2)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Emergency Kill Switch */}
        <HapticTouchable
          style={styles.killSwitchBtn}
          hapticType="heavy"
          onPress={handleKillSwitch}
        >
          <Ionicons name="alert-circle" size={20} color="#FFF" />
          <Text style={styles.killSwitchText}>EMERGENCY KILL SWITCH (CLOSE ALL)</Text>
        </HapticTouchable>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    color: colors.gold,
  },
  logoSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  equityCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 20,
  },
  equityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  equityLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  dailyPnlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pnlLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  pnlValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  equityAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  autopilotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    padding: 12,
    borderRadius: 12,
  },
  autopilotStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  autopilotText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  armBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  armBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gold,
  },
  sentimentLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressBg: {
    height: 8,
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  sentimentSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  signalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signalLeft: {
    flex: 1,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  assetName: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  signalRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stopText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  emptyState: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  killSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#8B0000',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  killSwitchText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.8,
  },
});
