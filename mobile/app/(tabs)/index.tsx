import React, { useState, useEffect } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../src/context/AppContext';
import { colors } from '../../src/theme/colors';
import { HapticTouchable } from '../../src/components/HapticTouchable';
import { GlassCard } from '../../src/components/GlassCard';
import { GradientPill } from '../../src/components/GradientPill';
import { TickerBar } from '../../src/components/TickerBar';
import { api, SignalData, MarketAsset } from '../../src/api/endpoints';
import { haptic } from '../../src/utils/haptics';

export default function HomeScreen() {
  const router = useRouter();
  const { dashboard, refreshing, refreshDashboard, toggleAutopilot, triggerKillSwitch } = useApp();
  const [executing, setExecuting] = useState<string | null>(null);
  const [tickerMarkets, setTickerMarkets] = useState<MarketAsset[]>([]);

  useEffect(() => {
    api.markets().then((m) => setTickerMarkets(m)).catch(() => {});
  }, []);

  const isLive = dashboard?.mode === 'live';
  const autopilotArmed = !!dashboard?.autopilot?.armed;
  const killSwitchActive = !!dashboard?.autopilot?.kill_switch;

  const handleToggleAutopilot = () => {
    if (!autopilotArmed && isLive) {
      Alert.alert(
        'Arm Live Autopilot?',
        'You are in LIVE TRADING mode. The bot will automatically execute orders with real capital on your exchange/broker accounts.',
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
      'This will IMMEDIATELY halt all autopilot scans and close all open positions across all connected exchanges at market price.',
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

  const fgValue = dashboard?.sentiment?.value ?? 55;
  const fgLabel = dashboard?.sentiment?.label?.toUpperCase() || 'NEUTRAL';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Glass Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="diamond" size={16} color="#000" />
          </View>
          <View>
            <Text style={styles.logoTitle}>AURUM</Text>
            <Text style={styles.logoSubtitle}>QUANTUM TERMINAL</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <GradientPill
            label={isLive ? 'LIVE' : 'PAPER SOVEREIGN'}
            variant={isLive ? 'gold' : 'royal'}
            size="sm"
          />

          <HapticTouchable
            style={[styles.glassIconBtn, styles.profileHighlight]}
            onPress={() => router.push('/profile')}
            hapticType="selection"
          >
            <Ionicons name="person" size={16} color={colors.goldBright} />
          </HapticTouchable>

          <HapticTouchable
            style={styles.glassIconBtn}
            onPress={() => router.push('/plugins')}
            hapticType="selection"
          >
            <Ionicons name="cube-outline" size={16} color={colors.textPrimary} />
          </HapticTouchable>

          <HapticTouchable
            style={styles.glassIconBtn}
            onPress={() => router.push('/settings')}
            hapticType="selection"
          >
            <Ionicons name="options-outline" size={16} color={colors.textPrimary} />
          </HapticTouchable>
        </View>
      </View>

      {/* Live Market Ticker Ribbon */}
      <TickerBar items={tickerMarkets} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshDashboard}
            tintColor={colors.gold}
          />
        }
      >
        {/* Luxury Hero Portfolio Card */}
        <View style={styles.heroWrapper}>
          <LinearGradient
            colors={['#162238', '#0C1322', '#070A12']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Ambient specular highlight border */}
            <View style={styles.heroSpecular} />

            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroLabel}>TOTAL ESTIMATED NET WORTH</Text>
                <Text style={styles.heroAmount}>
                  ${(dashboard?.equity ?? 10000).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>

              <GradientPill
                label={`${(dashboard?.daily_pnl ?? 0) >= 0 ? '+' : ''}$${(dashboard?.daily_pnl ?? 0).toFixed(2)} 24H`}
                variant={(dashboard?.daily_pnl ?? 0) >= 0 ? 'bullish' : 'bearish'}
                size="sm"
              />
            </View>

            {/* Glass Autopilot Control Strip */}
            <View style={styles.autopilotStrip}>
              <View style={styles.autopilotLeft}>
                <View
                  style={[
                    styles.pulseDot,
                    {
                      backgroundColor: killSwitchActive
                        ? colors.bearish
                        : autopilotArmed
                        ? colors.bullish
                        : colors.textMuted,
                      shadowColor: killSwitchActive
                        ? colors.bearish
                        : autopilotArmed
                        ? colors.bullish
                        : 'transparent',
                    },
                  ]}
                />
                <View>
                  <Text style={styles.autopilotTitle}>
                    {killSwitchActive
                      ? 'EMERGENCY HALT'
                      : autopilotArmed
                      ? 'AUTOPILOT SCANNING'
                      : 'AUTOPILOT STANDBY'}
                  </Text>
                  <Text style={styles.autopilotSub}>
                    {autopilotArmed
                      ? 'AI Triple-Barrier Models Active'
                      : 'Manual confirmation required'}
                  </Text>
                </View>
              </View>

              <GradientPill
                label={autopilotArmed ? 'PAUSE BOT' : 'ARM AUTOPILOT'}
                variant={autopilotArmed ? 'bearish' : 'bullish'}
                icon={
                  <Ionicons
                    name={autopilotArmed ? 'pause' : 'flash'}
                    size={13}
                    color="#000"
                  />
                }
                size="sm"
                onPress={handleToggleAutopilot}
              />
            </View>
          </LinearGradient>
        </View>

        {/* Market Psychology & Fear/Greed Pod */}
        <GlassCard glowColor="gold" borderRadius={20} style={styles.cardPad}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Ionicons name="pulse" size={18} color={colors.goldBright} />
              <Text style={styles.cardHeaderTitle}>MARKET PSYCHOLOGY RADAR</Text>
            </View>
            <GradientPill
              label={`${fgLabel} (${fgValue}/100)`}
              variant={fgValue > 60 ? 'bullish' : fgValue < 40 ? 'bearish' : 'gold'}
              size="sm"
            />
          </View>

          {/* Gradient Glow Meter */}
          <View style={styles.gaugeTrack}>
            <LinearGradient
              colors={['#FF416C', '#F4C430', '#00F5A0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.gaugeFill, { width: `${Math.min(100, Math.max(5, fgValue))}%` }]}
            />
          </View>

          <Text style={styles.psychologyText}>
            {fgValue < 30
              ? 'Extreme Fear Detected: Retail capitulation in progress. Quant engine actively evaluates oversold value accumulation.'
              : fgValue > 70
              ? 'Extreme Greed Detected: Retail euphoria. AI applies tighter trailing stops to safeguard accumulated unrealized gains.'
              : 'Equilibrium Sentiment: Order book depth is balanced with steady liquidity flow across major asset classes.'}
          </Text>
        </GlassCard>

        {/* Quant Signal Intelligence */}
        <GlassCard glowColor="cyan" borderRadius={20} style={styles.cardPad}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Ionicons name="hardware-chip" size={18} color={colors.cyan} />
              <Text style={styles.cardHeaderTitle}>HIGH-CONFIDENCE QUANT SIGNALS</Text>
            </View>
            <HapticTouchable onPress={() => router.push('/(tabs)/markets')}>
              <Text style={styles.viewAllText}>Radar View ›</Text>
            </HapticTouchable>
          </View>

          {(!dashboard?.top_signals || dashboard.top_signals.length === 0) ? (
            <View style={styles.emptySignals}>
              <Text style={styles.emptyText}>Scanning 5 markets for calibrated confluence...</Text>
            </View>
          ) : (
            dashboard.top_signals.slice(0, 4).map((sig) => {
              const isLong = sig.direction === 'LONG';
              const isShort = sig.direction === 'SHORT';
              const isFlat = sig.direction === 'FLAT';

              return (
                <View key={sig.symbol} style={styles.signalItem}>
                  <View style={styles.signalLeft}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.signalSymbol}>{sig.symbol}</Text>
                      <GradientPill
                        label={sig.direction}
                        variant={isLong ? 'bullish' : isShort ? 'bearish' : 'neutral'}
                        size="sm"
                      />
                    </View>
                    <Text style={styles.signalAssetSub}>
                      {sig.name || sig.asset_class} · Conf: <Text style={{ color: colors.goldBright, fontWeight: '800' }}>{(sig.confidence * 100).toFixed(0)}%</Text>
                    </Text>
                  </View>

                  <View style={styles.signalRight}>
                    <Text style={styles.signalPrice}>
                      ${sig.price < 10 ? sig.price.toFixed(4) : sig.price.toLocaleString()}
                    </Text>

                    {!isFlat && (
                      <GradientPill
                        label={executing === sig.symbol ? '...' : isLong ? 'BUY' : 'SELL'}
                        variant={isLong ? 'bullish' : 'bearish'}
                        size="sm"
                        onPress={() => handleQuickExecute(sig)}
                      />
                    )}
                  </View>
                </View>
              );
            })
          )}
        </GlassCard>

        {/* Active Positions */}
        <GlassCard borderRadius={20} style={styles.cardPad}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Ionicons name="swap-horizontal" size={18} color={colors.gold} />
              <Text style={styles.cardHeaderTitle}>
                ACTIVE POSITIONS ({dashboard?.open_trades?.length ?? 0})
              </Text>
            </View>
            <HapticTouchable onPress={() => router.push('/(tabs)/trades')}>
              <Text style={styles.viewAllText}>Manage ›</Text>
            </HapticTouchable>
          </View>

          {(!dashboard?.open_trades || dashboard.open_trades.length === 0) ? (
            <View style={styles.emptySignals}>
              <Text style={styles.emptyText}>No positions currently active in market.</Text>
            </View>
          ) : (
            dashboard.open_trades.map((t) => (
              <View key={t.id} style={styles.positionRow}>
                <View>
                  <Text style={styles.signalSymbol}>{t.symbol}</Text>
                  <Text style={styles.positionDetails}>
                    {t.side} · Qty: {t.qty.toFixed(4)} · Entry: ${t.entry.toFixed(2)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <GradientPill label="LIVE IN PLAY" variant="gold" size="sm" />
                  <Text style={styles.stopLossText}>SL: ${t.stop.toFixed(2)}</Text>
                </View>
              </View>
            ))
          )}
        </GlassCard>

        {/* Emergency Kill Switch */}
        <HapticTouchable
          style={styles.killBtn}
          hapticType="heavy"
          onPress={handleKillSwitch}
        >
          <LinearGradient
            colors={['#8B0000', '#550000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.killGradient}
          >
            <Ionicons name="shield-outline" size={18} color="#FFF" />
            <Text style={styles.killText}>EMERGENCY KILL SWITCH (LIQUIDATE ALL)</Text>
          </LinearGradient>
        </HapticTouchable>
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
    paddingVertical: 10,
    backgroundColor: 'rgba(8, 12, 20, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  logoTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2,
    color: colors.textPrimary,
  },
  logoSubtitle: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.gold,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  glassIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHighlight: {
    backgroundColor: 'rgba(244, 196, 48, 0.12)',
    borderColor: 'rgba(244, 196, 48, 0.35)',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  heroWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  heroCard: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
  },
  heroSpecular: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  autopilotStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
  },
  autopilotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  autopilotTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  autopilotSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  cardPad: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
  },
  gaugeTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 4,
  },
  psychologyText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  signalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderGlass,
  },
  signalLeft: {
    flex: 1,
  },
  signalSymbol: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  signalAssetSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  signalRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  signalPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderGlass,
  },
  positionDetails: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stopLossText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  emptySignals: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  killBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  killGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 65, 108, 0.4)',
  },
  killText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
