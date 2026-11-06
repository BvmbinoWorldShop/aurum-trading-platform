import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { GlassCard } from './GlassCard';
import { GradientPill } from './GradientPill';
import { api } from '../api/endpoints';
import { haptic } from '../utils/haptics';

interface Props {
  onOpenKeyManager?: () => void;
}

export const AiMarketRadar: React.FC<Props> = ({ onOpenKeyManager }) => {
  const [radar, setRadar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchRadar = async () => {
    setLoading(true);
    try {
      const data = await api.getMarketRadar();
      setRadar(data);
    } catch (err) {
      console.log('Error fetching AI radar', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRadar();
  }, []);

  const handleRefresh = () => {
    haptic.medium();
    fetchRadar();
  };

  const hasKey = radar?.has_key ?? false;

  return (
    <GlassCard glowColor="gold" borderRadius={20} style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles" size={16} color="#000" />
          </View>
          <View>
            <Text style={styles.title}>AI MARKET INTELLIGENCE RADAR</Text>
            <Text style={styles.subtitle}>Free Gemini 2026 Live Web-Grounded Analysis</Text>
          </View>
        </View>

        <GradientPill
          label={loading ? 'SCANNING...' : 'REFRESH'}
          variant="gold"
          size="sm"
          icon={loading ? <ActivityIndicator size="small" color="#000" /> : <Ionicons name="refresh" size={12} color="#000" />}
          onPress={handleRefresh}
        />
      </View>

      {!hasKey && (
        <View style={styles.missingKeyBanner}>
          <Ionicons name="key" size={18} color={colors.goldBright} />
          <View style={{ flex: 1 }}>
            <Text style={styles.missingKeyTitle}>Free AI Key Not Connected</Text>
            <Text style={styles.missingKeyText}>
              Add your 100% free Google Gemini key to activate real-time web-grounded market intelligence.
            </Text>
          </View>
          {onOpenKeyManager && (
            <GradientPill
              label="ADD KEY"
              variant="gold"
              size="sm"
              onPress={onOpenKeyManager}
            />
          )}
        </View>
      )}

      {loading && !radar ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadingText}>Synthesizing live multi-asset tendencies...</Text>
        </View>
      ) : radar ? (
        <>
          {/* Regime & Summary */}
          <View style={styles.regimeRow}>
            <Text style={styles.regimeLabel}>MARKET REGIME:</Text>
            <GradientPill
              label={radar.regime || 'CALIBRATED SCAN'}
              variant={
                radar.regime?.includes('Bullish')
                  ? 'bullish'
                  : radar.regime?.includes('Bearish')
                  ? 'bearish'
                  : 'gold'
              }
              size="sm"
            />
          </View>

          <Text style={styles.summaryText}>{radar.summary}</Text>

          {/* Asset Tendencies Breakdown Grid */}
          <View style={styles.tendencyGrid}>
            <View style={styles.tendencyCol}>
              <View style={styles.tendencyHeader}>
                <Ionicons name="logo-bitcoin" size={14} color={colors.goldBright} />
                <Text style={styles.tendencyTitle}>CRYPTO</Text>
              </View>
              <Text
                style={[
                  styles.tendencyDir,
                  {
                    color:
                      radar.crypto_tendency?.direction === 'Bullish'
                        ? colors.bullish
                        : radar.crypto_tendency?.direction === 'Bearish'
                        ? colors.bearish
                        : colors.textSecondary,
                  },
                ]}
              >
                {radar.crypto_tendency?.direction?.toUpperCase() || 'NEUTRAL'}
              </Text>
              <Text style={styles.tendencyDetail} numberOfLines={2}>
                {radar.crypto_tendency?.catalyst || radar.crypto_tendency?.levels}
              </Text>
            </View>

            <View style={styles.tendencyCol}>
              <View style={styles.tendencyHeader}>
                <Ionicons name="cube" size={14} color={colors.gold} />
                <Text style={styles.tendencyTitle}>GOLD / COMMODITY</Text>
              </View>
              <Text
                style={[
                  styles.tendencyDir,
                  {
                    color:
                      radar.commodities_tendency?.direction === 'Bullish'
                        ? colors.bullish
                        : radar.commodities_tendency?.direction === 'Bearish'
                        ? colors.bearish
                        : colors.textSecondary,
                  },
                ]}
              >
                {radar.commodities_tendency?.direction?.toUpperCase() || 'BULLISH'}
              </Text>
              <Text style={styles.tendencyDetail} numberOfLines={2}>
                {radar.commodities_tendency?.catalyst || radar.commodities_tendency?.levels}
              </Text>
            </View>

            <View style={styles.tendencyCol}>
              <View style={styles.tendencyHeader}>
                <Ionicons name="trending-up" size={14} color={colors.cyan} />
                <Text style={styles.tendencyTitle}>AI TECH</Text>
              </View>
              <Text
                style={[
                  styles.tendencyDir,
                  {
                    color:
                      radar.tech_stocks_tendency?.direction === 'Bullish'
                        ? colors.bullish
                        : radar.tech_stocks_tendency?.direction === 'Bearish'
                        ? colors.bearish
                        : colors.textSecondary,
                  },
                ]}
              >
                {radar.tech_stocks_tendency?.direction?.toUpperCase() || 'BULLISH'}
              </Text>
              <Text style={styles.tendencyDetail} numberOfLines={2}>
                {radar.tech_stocks_tendency?.catalyst || radar.tech_stocks_tendency?.levels}
              </Text>
            </View>
          </View>

          {/* Top Opportunities Identified by AI */}
          {radar.top_opportunities && radar.top_opportunities.length > 0 && (
            <View style={styles.oppsContainer}>
              <Text style={styles.oppsHeading}>AI-IDENTIFIED SETUPS</Text>
              {radar.top_opportunities.map((opp: any, idx: number) => {
                const isBuy = opp.action === 'BUY';
                const isSell = opp.action === 'SELL';
                return (
                  <View key={idx} style={styles.oppItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.oppSymbol}>{opp.symbol}</Text>
                      <GradientPill
                        label={opp.action}
                        variant={isBuy ? 'bullish' : isSell ? 'bearish' : 'neutral'}
                        size="sm"
                      />
                    </View>
                    <Text style={styles.oppThesis} numberOfLines={1}>
                      {opp.thesis}
                    </Text>
                    <Text style={styles.oppConf}>
                      Conf: <Text style={{ color: colors.goldBright, fontWeight: '800' }}>{opp.confidence}%</Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Risk Alert */}
          {radar.risk_alert && (
            <View style={styles.riskAlert}>
              <Ionicons name="alert-circle" size={16} color={colors.warning} />
              <Text style={styles.riskAlertText}>{radar.risk_alert}</Text>
            </View>
          )}
        </>
      ) : null}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 10,
    color: colors.textMuted,
  },
  missingKeyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  missingKeyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.goldBright,
  },
  missingKeyText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  centerLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  regimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  regimeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 19,
    marginBottom: 14,
  },
  tendencyGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tendencyCol: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  tendencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  tendencyTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  tendencyDir: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  tendencyDetail: {
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 13,
  },
  oppsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    marginBottom: 10,
    gap: 6,
  },
  oppsHeading: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  oppItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  oppSymbol: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  oppThesis: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    paddingHorizontal: 8,
  },
  oppConf: {
    fontSize: 10,
    color: colors.textMuted,
  },
  riskAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 170, 0, 0.08)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 0, 0.2)',
  },
  riskAlertText: {
    flex: 1,
    fontSize: 11,
    color: colors.warning,
    lineHeight: 15,
  },
});
