import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../src/theme/colors';
import { GlassCard } from '../../src/components/GlassCard';
import { GradientPill } from '../../src/components/GradientPill';
import { HapticTouchable } from '../../src/components/HapticTouchable';
import { api, VaultData } from '../../src/api/endpoints';

export default function VaultScreen() {
  const router = useRouter();
  const [vault, setVault] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadVault = async () => {
    try {
      const data = await api.vault();
      setVault(data);
    } catch (err) {
      console.log('Error loading vault', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVault();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Glass Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>MULTI-BROKER VAULT</Text>
          <Text style={styles.subtitle}>Unified custody & zero-trust exchange sync</Text>
        </View>

        <GradientPill
          label="Cards & Pay"
          variant="gold"
          size="sm"
          icon={<Ionicons name="card" size={13} color="#000" />}
          onPress={() => router.push('/profile')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadVault();
            }}
            tintColor={colors.gold}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Total Custody Hero Glass Card */}
            <View style={styles.heroWrapper}>
              <LinearGradient
                colors={['#241B08', '#141005', '#080602']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroSpecular} />

                <Text style={styles.heroLabel}>TOTAL CUSTODY NET WORTH</Text>
                <Text style={styles.heroAmount}>
                  ${(vault?.total_equity ?? 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>

                <View style={styles.heroPillRow}>
                  <GradientPill
                    label={`MODE: ${vault?.mode?.toUpperCase() || 'PAPER'}`}
                    variant={vault?.mode === 'live' ? 'gold' : 'royal'}
                    size="sm"
                  />
                  <GradientPill
                    label="0.00% CUSTODY FEE"
                    variant="glass"
                    size="sm"
                  />
                </View>
              </LinearGradient>
            </View>

            {/* Local Sovereign Card Quick Action */}
            <GlassCard glowColor="gold" borderRadius={20} style={styles.cardPad}>
              <View style={styles.cardTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="card" size={20} color={colors.gold} />
                  <Text style={styles.sectionHeaderTitle}>SOVEREIGN CARD & PAYOUTS</Text>
                </View>

                <GradientPill
                  label="MANAGE"
                  variant="gold"
                  size="sm"
                  onPress={() => router.push('/profile')}
                />
              </View>

              <Text style={styles.cardSubtext}>
                Deposit trading capital directly with your credit or debit card, or withdraw your trading gains to your card with 0% protocol fees.
              </Text>
            </GlassCard>

            {/* Broker Breakdown Cards */}
            <Text style={styles.sectionTitle}>CONNECTED EXCHANGES & BROKERS</Text>

            {vault?.balances?.map((b, idx) => {
              const brokerName = b.broker.toUpperCase();
              const isConfigured = b.configured !== false;
              const hasError = !!b.error;

              return (
                <GlassCard
                  key={idx}
                  glowColor={!isConfigured ? 'none' : hasError ? 'bearish' : 'gold'}
                  borderRadius={18}
                  style={styles.brokerCardPad}
                >
                  <View style={styles.brokerHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons
                        name={
                          b.broker === 'binance'
                            ? 'logo-bitcoin'
                            : b.broker === 'oanda'
                            ? 'globe-outline'
                            : b.broker === 'alpaca'
                            ? 'trending-up'
                            : 'shield-checkmark'
                        }
                        size={20}
                        color={colors.gold}
                      />
                      <Text style={styles.brokerTitle}>{brokerName}</Text>
                    </View>

                    <GradientPill
                      label={
                        !isConfigured
                          ? 'NOT CONFIGURED'
                          : hasError
                          ? 'OFFLINE'
                          : b.testnet || b.practice || b.paper
                          ? 'TESTNET / DEMO'
                          : 'LIVE'
                      }
                      variant={
                        !isConfigured
                          ? 'glass'
                          : hasError
                          ? 'bearish'
                          : b.testnet || b.practice || b.paper
                          ? 'royal'
                          : 'gold'
                      }
                      size="sm"
                    />
                  </View>

                  {isConfigured && !hasError ? (
                    <>
                      <View style={styles.balanceGrid}>
                        <View style={styles.balCol}>
                          <Text style={styles.balLabel}>EQUITY</Text>
                          <Text style={styles.balVal}>
                            ${(b.equity ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                        <View style={styles.balCol}>
                          <Text style={styles.balLabel}>AVAILABLE CASH</Text>
                          <Text style={styles.balVal}>
                            ${(b.cash ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                      </View>

                      {b.assets && b.assets.length > 0 && (
                        <View style={styles.assetsList}>
                          <Text style={styles.assetsTitle}>HOLDINGS</Text>
                          {b.assets.slice(0, 4).map((a, i) => (
                            <View key={i} style={styles.assetItem}>
                              <Text style={styles.assetItemName}>{a.asset}</Text>
                              <Text style={styles.assetItemAmt}>
                                {a.amount.toFixed(4)} (${a.value.toFixed(2)})
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  ) : hasError ? (
                    <Text style={styles.errorText}>Connection Error: {b.error}</Text>
                  ) : (
                    <Text style={styles.unconfiguredText}>
                      API keys not configured. Add them to <Text style={{ color: colors.gold }}>backend/.env</Text> to link real trading accounts.
                    </Text>
                  )}
                </GlassCard>
              );
            })}

            {/* Zero-Trust Notice */}
            <GlassCard glowColor="none" borderRadius={18} style={styles.securityBox}>
              <Ionicons name="lock-closed" size={20} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.securityTitle}>ZERO-TRUST ENCRYPTED ARCHITECTURE</Text>
                <Text style={styles.securityText}>
                  Your secret keys and withdrawal rights are never exposed to the frontend or any cloud servers.
                  Keys reside exclusively in your backend server with IP-whitelisting and withdrawal permissions permanently blocked.
                </Text>
              </View>
            </GlassCard>
          </>
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
    borderColor: 'rgba(255, 215, 0, 0.25)',
    position: 'relative',
  },
  heroSpecular: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: 'rgba(255, 215, 0, 0.45)',
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.goldMuted,
    letterSpacing: 1.2,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 14,
  },
  heroPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cardPad: {
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  cardSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: 6,
  },
  brokerCardPad: {
    padding: 16,
  },
  brokerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brokerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  balanceGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  balCol: {
    flex: 1,
  },
  balLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  balVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  assetsList: {
    marginTop: 12,
    gap: 6,
  },
  assetsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  assetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  assetItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  assetItemAmt: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  errorText: {
    fontSize: 12,
    color: colors.bearish,
  },
  unconfiguredText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  securityBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    alignItems: 'flex-start',
  },
  securityTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  securityText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
