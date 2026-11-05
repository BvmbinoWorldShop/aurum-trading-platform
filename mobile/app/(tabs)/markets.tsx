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
import { colors } from '../../src/theme/colors';
import { HapticTouchable } from '../../src/components/HapticTouchable';
import { Badge } from '../../src/components/Badge';
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
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MARKETS & QUANT MODELS</Text>
        <Text style={styles.subtitle}>Multi-asset predictive screening</Text>
      </View>

      {/* Category Pills */}
      <View style={styles.pillsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {CATEGORIES.map((cat) => (
            <HapticTouchable
              key={cat}
              style={[styles.pill, category === cat && styles.pillActive]}
              hapticType="selection"
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>
                {cat}
              </Text>
            </HapticTouchable>
          ))}
        </ScrollView>
      </View>

      {/* Markets List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
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
                style={styles.marketCard}
                onPress={() => openAssetModal(item)}
              >
                <View style={styles.marketLeft}>
                  <Text style={styles.assetSymbol}>{item.symbol}</Text>
                  <Text style={styles.assetSub}>
                    {item.name} · <Text style={{ textTransform: 'capitalize' }}>{item.broker}</Text>
                  </Text>
                </View>

                {item.spark && item.spark.length > 2 && (
                  <View style={styles.sparkContainer}>
                    <Sparkline data={item.spark} width={75} height={28} />
                  </View>
                )}

                <View style={styles.marketRight}>
                  <Text style={styles.priceVal}>
                    ${item.price < 10 ? item.price.toFixed(4) : item.price.toLocaleString()}
                  </Text>
                  <Text
                    style={[
                      styles.changeVal,
                      { color: isPos ? colors.bullish : colors.bearish },
                    ]}
                  >
                    {isPos ? '+' : ''}
                    {(item.change_24h_pct ?? 0).toFixed(2)}%
                  </Text>
                </View>
              </HapticTouchable>
            );
          })
        )}
      </ScrollView>

      {/* Asset Deep-Dive Modal */}
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
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </HapticTouchable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            {signalLoading ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={styles.loadingText}>Running Walk-Forward Machine Learning Models...</Text>
              </View>
            ) : signal ? (
              <>
                {/* Prediction Summary Card */}
                <View style={styles.signalCard}>
                  <View style={styles.signalCardHeader}>
                    <Badge
                      label={signal.direction}
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
                      Calibrated Confidence: {(signal.confidence * 100).toFixed(0)}%
                    </Text>
                  </View>

                  <View style={styles.grid2}>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>P(LONG WINS)</Text>
                      <Text style={[styles.gridVal, { color: colors.bullish }]}>
                        {(signal.p_long * 100).toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>P(SHORT WINS)</Text>
                      <Text style={[styles.gridVal, { color: colors.bearish }]}>
                        {(signal.p_short * 100).toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>STOP LOSS</Text>
                      <Text style={styles.gridVal}>
                        ${signal.stop?.toFixed(2) || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>TAKE PROFIT</Text>
                      <Text style={styles.gridVal}>
                        ${signal.take_profit?.toFixed(2) || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.subStatsRow}>
                    <Text style={styles.subStatText}>
                      Market Regime: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{signal.regime.toUpperCase()}</Text>
                    </Text>
                    <Text style={styles.subStatText}>
                      Out-of-sample Win Rate:{' '}
                      <Text style={{ color: colors.gold, fontWeight: '700' }}>
                        {signal.validated_win_rate ? `${(signal.validated_win_rate * 100).toFixed(0)}% (${signal.validated_trades} trades)` : 'N/A'}
                      </Text>
                    </Text>
                  </View>

                  {/* Quantitative Rationale */}
                  <View style={styles.reasonsBox}>
                    <Text style={styles.reasonsTitle}>MODEL RATIONALE & METRICS</Text>
                    {signal.reasons.map((r, i) => (
                      <Text key={i} style={styles.reasonLine}>
                        • {r}
                      </Text>
                    ))}
                  </View>
                </View>

                {/* Backtester Section */}
                <View style={styles.backtestCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="bar-chart" size={18} color={colors.gold} />
                      <Text style={styles.cardTitle}>WALK-FORWARD BACKTESTER</Text>
                    </View>
                    <HapticTouchable
                      style={styles.backtestBtn}
                      onPress={handleRunBacktest}
                      disabled={backtesting}
                      hapticType="medium"
                    >
                      {backtesting ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.backtestBtnText}>Run Backtest</Text>
                      )}
                    </HapticTouchable>
                  </View>

                  {backtest ? (
                    <View style={styles.backtestResults}>
                      <View style={styles.grid3}>
                        <View style={styles.gridItemSmall}>
                          <Text style={styles.gridLabel}>WIN RATE</Text>
                          <Text style={[styles.gridValSmall, { color: colors.gold }]}>
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

                      <View style={styles.grid3}>
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
                          <Text style={styles.gridLabel}>TOTAL TRADES</Text>
                          <Text style={styles.gridValSmall}>{backtest.trades}</Text>
                        </View>
                      </View>

                      {backtest.equity_curve && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={[styles.gridLabel, { marginBottom: 6 }]}>
                            OUT-OF-SAMPLE EQUITY CURVE
                          </Text>
                          <Sparkline
                            data={backtest.equity_curve}
                            width={320}
                            height={60}
                            color={colors.gold}
                          />
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.backtestPrompt}>
                      Tap "Run Backtest" to test this quantitative model over hundreds of bars using walk-forward retraining without look-ahead bias.
                    </Text>
                  )}
                </View>

                {/* Trade Execution Button */}
                {signal.direction !== 'FLAT' && (
                  <HapticTouchable
                    style={[
                      styles.executeBtn,
                      {
                        backgroundColor:
                          signal.direction === 'LONG' ? colors.bullish : colors.bearish,
                      },
                    ]}
                    hapticType="heavy"
                    onPress={handleExecute}
                    disabled={executing}
                  >
                    {executing ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.executeBtnText}>
                        EXECUTE {signal.direction} WITH RISK MANAGER
                      </Text>
                    )}
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
  pillsContainer: {
    paddingVertical: 10,
  },
  pillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.goldGlow,
    borderColor: colors.gold,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.gold,
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 30,
  },
  marketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSecondary,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  marketLeft: {
    flex: 1,
  },
  assetSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  assetSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sparkContainer: {
    paddingHorizontal: 8,
  },
  marketRight: {
    alignItems: 'flex-end',
  },
  priceVal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  changeVal: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
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
  signalCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  confBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  gridItem: {
    width: '48%',
    backgroundColor: colors.bgCard,
    padding: 10,
    borderRadius: 8,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  gridVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  subStatsRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  subStatText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reasonsBox: {
    marginTop: 12,
    gap: 4,
  },
  reasonsTitle: {
    fontSize: 11,
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
  backtestCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  backtestBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backtestBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 12,
  },
  backtestPrompt: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  backtestResults: {
    gap: 8,
  },
  grid3: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  gridItemSmall: {
    flex: 1,
    backgroundColor: colors.bgCard,
    padding: 8,
    borderRadius: 8,
  },
  gridValSmall: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  executeBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  executeBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.8,
  },
});
