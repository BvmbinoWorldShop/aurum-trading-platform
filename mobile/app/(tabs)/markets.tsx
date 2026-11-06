import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../src/theme/colors';
import { HapticTouchable } from '../../src/components/HapticTouchable';
import { GlassCard } from '../../src/components/GlassCard';
import { GradientPill } from '../../src/components/GradientPill';
import { Sparkline } from '../../src/components/Sparkline';
import { api, MarketAsset, SignalData, BacktestResult } from '../../src/api/endpoints';
import { haptic } from '../../src/utils/haptics';

const CATEGORIES = ['ALL', 'CRYPTO', 'FOREX', 'COMMODITY', 'STOCK'];

export default function MarketsScreen() {
  const [category, setCategory] = useState('ALL');
  const [markets, setMarkets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Asset Inspection & Backtesting Modal state
  const [selectedAsset, setSelectedAsset] = useState<MarketAsset | null>(null);
  const [signal, setSignal] = useState<SignalData | null>(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [backtesting, setBacktesting] = useState(false);
  const [executing, setExecuting] = useState(false);

  const loadMarkets = async () => {
    try {
      const data = await api.markets();
      setMarkets(data);
    } catch (err) {
      console.log('Error loading markets', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMarkets();
    const timer = setInterval(loadMarkets, 15000);
    return () => clearInterval(timer);
  }, []);

  const openAssetModal = async (asset: MarketAsset) => {
    setSelectedAsset(asset);
    setSignal(null);
    setBacktest(null);
    setSignalLoading(true);
    haptic.selection();

    try {
      const sig = await api.signal(asset.symbol);
      setSignal(sig);
    } catch (err: any) {
      Alert.alert('Signal Error', err.message);
    } finally {
      setSignalLoading(false);
    }
  };

  const handleRunBacktest = async () => {
    if (!selectedAsset) return;
    setBacktesting(true);
    haptic.medium();
    try {
      const res = await api.backtest(selectedAsset.symbol);
      setBacktest(res);
      haptic.success();
    } catch (err: any) {
      haptic.error();
      Alert.alert('Backtest Failed', err.message);
    } finally {
      setBacktesting(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedAsset || !signal) return;
    Alert.alert(
      `Execute ${signal.direction} ${selectedAsset.symbol}?`,
      `Entry: ~$${signal.price.toLocaleString()}\nStop: $${signal.stop?.toFixed(2) || 'None'}\nTarget: $${signal.take_profit?.toFixed(2) || 'None'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Order',
          onPress: async () => {
            try {
              setExecuting(true);
              haptic.medium();
              await api.executeTrade(selectedAsset.symbol);
              haptic.success();
              Alert.alert('Trade Opened', `Order for ${selectedAsset.symbol} placed successfully.`);
              setSelectedAsset(null);
            } catch (err: any) {
              haptic.error();
              Alert.alert('Execution Error', err.message);
            } finally {
              setExecuting(false);
            }
          },
        },
      ]
    );
  };

  const filtered = markets.filter((m) => {
    if (category === 'ALL') return true;
    return m.asset_class?.toUpperCase() === category;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Glass Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>QUANT RADAR</Text>
          <Text style={styles.subtitle}>Multi-asset predictive intelligence & backtests</Text>
        </View>

        <GradientPill
          label="REAL-TIME"
          variant="bullish"
          icon={<View style={styles.greenPulse} />}
          size="sm"
        />
      </View>

      {/* Category Gradient Pills */}
      <View style={styles.pillsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {CATEGORIES.map((cat) => (
            <GradientPill
              key={cat}
              label={cat}
              variant={category === cat ? 'gold' : 'glass'}
              active={category === cat}
              size="sm"
              onPress={() => setCategory(cat)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Markets List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadMarkets();
            }}
            tintColor={colors.gold}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} />
        ) : (
          filtered.map((item) => {
            const isPos = (item.change_24h_pct ?? 0) >= 0;
            return (
              <HapticTouchable
                key={item.symbol}
                onPress={() => openAssetModal(item)}
              >
                <GlassCard
                  glowColor={isPos ? 'bullish' : 'bearish'}
                  borderRadius={18}
                  style={styles.marketCard}
                >
                  <View style={styles.marketLeft}>
                    <Text style={styles.assetSymbol}>{item.symbol}</Text>
                    <Text style={styles.assetSub}>
                      {item.name} · <Text style={{ textTransform: 'capitalize' }}>{item.broker}</Text>
                    </Text>
                  </View>

                  {item.spark && item.spark.length > 2 && (
                    <View style={styles.sparkContainer}>
                      <Sparkline data={item.spark} width={80} height={30} />
                    </View>
                  )}

                  <View style={styles.marketRight}>
                    <Text style={styles.priceVal}>
                      ${item.price < 10 ? item.price.toFixed(4) : item.price.toLocaleString()}
                    </Text>
                    <GradientPill
                      label={`${isPos ? '+' : ''}${(item.change_24h_pct ?? 0).toFixed(2)}%`}
                      variant={isPos ? 'bullish' : 'bearish'}
                      size="sm"
                    />
                  </View>
                </GlassCard>
              </HapticTouchable>
            );
          })
        )}
      </ScrollView>

      {/* Asset Deep-Dive & Quant Terminal Modal */}
      <Modal
        visible={!!selectedAsset}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedAsset(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{selectedAsset?.symbol}</Text>
              <Text style={styles.modalSubtitle}>{selectedAsset?.name}</Text>
            </View>
            <HapticTouchable
              style={styles.closeBtn}
              onPress={() => setSelectedAsset(null)}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </HapticTouchable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            {signalLoading ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={styles.loadingText}>Running Walk-Forward Machine Learning Confluence...</Text>
              </View>
            ) : signal ? (
              <>
                {/* Prediction Summary Glass Card */}
                <GlassCard glowColor="gold" borderRadius={20} style={styles.signalCardPad}>
                  <View style={styles.signalCardHeader}>
                    <GradientPill
                      label={`PREDICTED: ${signal.direction}`}
                      variant={
                        signal.direction === 'LONG'
                          ? 'bullish'
                          : signal.direction === 'SHORT'
                          ? 'bearish'
                          : 'neutral'
                      }
                      size="md"
                    />
                    <Text style={styles.confBadge}>
                      Calibrated Confidence: <Text style={{ color: colors.goldBright, fontWeight: '900' }}>{(signal.confidence * 100).toFixed(0)}%</Text>
                    </Text>
                  </View>

                  {/* Dual Win Probability Meters */}
                  <View style={styles.probContainer}>
                    <View style={styles.probRow}>
                      <Text style={styles.probLabel}>P(LONG WINS TARGET)</Text>
                      <Text style={[styles.probVal, { color: colors.bullish }]}>
                        {(signal.p_long * 100).toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.meterTrack}>
                      <LinearGradient
                        colors={['#00F5A0', '#00D9F5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.meterFill, { width: `${Math.min(100, signal.p_long * 100)}%` }]}
                      />
                    </View>

                    <View style={[styles.probRow, { marginTop: 10 }]}>
                      <Text style={styles.probLabel}>P(SHORT WINS TARGET)</Text>
                      <Text style={[styles.probVal, { color: colors.bearish }]}>
                        {(signal.p_short * 100).toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.meterTrack}>
                      <LinearGradient
                        colors={['#FF416C', '#FF4B2B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.meterFill, { width: `${Math.min(100, signal.p_short * 100)}%` }]}
                      />
                    </View>
                  </View>

                  {/* Quantitative Rationale */}
                  <View style={styles.reasonsBox}>
                    <Text style={styles.reasonsTitle}>MODEL RATIONALE & SIGNALS</Text>
                    {signal.reasons.map((r, i) => (
                      <Text key={i} style={styles.reasonLine}>
                        • {r}
                      </Text>
                    ))}
                  </View>
                </GlassCard>

                {/* Walk-Forward Backtester Section */}
                <GlassCard glowColor="purple" borderRadius={20} style={styles.backtestCardPad}>
                  <View style={styles.backtestHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="bar-chart" size={18} color={colors.purple} />
                      <Text style={styles.cardTitle}>WALK-FORWARD BACKTESTER</Text>
                    </View>
                    <GradientPill
                      label={backtesting ? 'TESTING...' : 'RUN SIMULATION'}
                      variant="gold"
                      size="sm"
                      onPress={handleRunBacktest}
                    />
                  </View>

                  {backtest ? (
                    <View style={styles.backtestResults}>
                      <View style={styles.grid3}>
                        <View style={styles.gridItemSmall}>
                          <Text style={styles.gridLabel}>WIN RATE</Text>
                          <Text style={[styles.gridValSmall, { color: colors.goldBright }]}>
                            {backtest.win_rate ? `${(backtest.win_rate * 100).toFixed(1)}%` : 'N/A'}
                          </Text>
                        </View>
                        <View style={styles.gridItemSmall}>
                          <Text style={styles.gridLabel}>PROFIT FACTOR</Text>
                          <Text style={styles.gridValSmall}>
                            {backtest.profit_factor?.toFixed(2) || 'N/A'}
                          </Text>
                        </View>
                        <View style={styles.gridItemSmall}>
                          <Text style={styles.gridLabel}>MAX DRAWDOWN</Text>
                          <Text style={[styles.gridValSmall, { color: colors.bearish }]}>
                            -{backtest.max_drawdown_pct.toFixed(1)}%
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.grid3, { marginTop: 8 }]}>
                        <View style={styles.gridItemSmall}>
                          <Text style={styles.gridLabel}>TOTAL RETURN</Text>
                          <Text
                            style={[
                              styles.gridValSmall,
                              {
                                color:
                                  backtest.total_return_pct >= 0 ? colors.bullish : colors.bearish,
                              },
                            ]}
                          >
                            {backtest.total_return_pct >= 0 ? '+' : ''}
                            {backtest.total_return_pct.toFixed(1)}%
                          </Text>
                        </View>
                        <View style={styles.gridItemSmall}>
                          <Text style={styles.gridLabel}>BUY & HOLD</Text>
                          <Text style={styles.gridValSmall}>
                            {backtest.buy_hold_return_pct >= 0 ? '+' : ''}
                            {backtest.buy_hold_return_pct.toFixed(1)}%
                          </Text>
                        </View>
                        <View style={styles.gridItemSmall}>
                          <Text style={styles.gridLabel}>TRADES EVALUATED</Text>
                          <Text style={styles.gridValSmall}>{backtest.trades}</Text>
                        </View>
                      </View>

                      {backtest.equity_curve && (
                        <View style={{ marginTop: 14 }}>
                          <Text style={[styles.gridLabel, { marginBottom: 6 }]}>
                            OUT-OF-SAMPLE EQUITY CURVE
                          </Text>
                          <Sparkline
                            data={backtest.equity_curve}
                            width={320}
                            height={60}
                            color={colors.goldBright}
                          />
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.backtestPrompt}>
                      Tap "Run Simulation" to retrain this model over hundreds of bars using purged walk-forward splits to measure genuine out-of-sample expectancy.
                    </Text>
                  )}
                </GlassCard>

                {/* Trade Execution Button */}
                {signal.direction !== 'FLAT' && (
                  <HapticTouchable
                    style={styles.execBtn}
                    hapticType="heavy"
                    onPress={handleExecute}
                    disabled={executing}
                  >
                    <LinearGradient
                      colors={signal.direction === 'LONG' ? ['#00F5A0', '#00D9F5'] : ['#FF416C', '#FF4B2B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.execGradient}
                    >
                      <Text style={styles.execBtnText}>
                        EXECUTE {signal.direction} WITH RISK GUARDIAN
                      </Text>
                    </LinearGradient>
                  </HapticTouchable>
                )}
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bullish,
  },
  pillsContainer: {
    paddingVertical: 10,
  },
  pillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 30,
  },
  marketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  marketLeft: {
    flex: 1,
  },
  assetSymbol: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  assetSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  sparkContainer: {
    paddingHorizontal: 8,
  },
  marketRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  priceVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bgVoid,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  centerLoading: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  signalCardPad: {
    padding: 16,
  },
  signalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  confBadge: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  probContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    marginBottom: 12,
  },
  probRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  probLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  probVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  meterTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  reasonsBox: {
    marginTop: 8,
    gap: 4,
  },
  reasonsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reasonLine: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  backtestCardPad: {
    padding: 16,
  },
  backtestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  backtestResults: {
    gap: 6,
  },
  grid3: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  gridItemSmall: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  gridLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  gridValSmall: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  backtestPrompt: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  execBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  execGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  execBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.8,
  },
});
