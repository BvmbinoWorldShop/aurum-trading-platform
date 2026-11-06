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
import { colors } from '../../src/theme/colors';
import { Badge } from '../../src/components/Badge';
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>MULTI-BROKER VAULT</Text>
          <Text style={styles.subtitle}>Unified custody & exchange connectivity</Text>
        </View>

        <HapticTouchable
          style={styles.cardPayBtn}
          onPress={() => router.push('/profile')}
          hapticType="selection"
        >
          <Ionicons name="card" size={16} color="#000" />
          <Text style={styles.cardPayBtnText}>Cards & Pay</Text>
        </HapticTouchable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
            {/* Total Custody Valuation */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>TOTAL CUSTODY VALUATION</Text>
              <Text style={styles.summaryAmount}>
                ${(vault?.total_equity ?? 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>

              <View style={styles.modeRow}>
                <Badge
                  label={`MODE: ${vault?.mode?.toUpperCase() || 'PAPER'}`}
                  variant={vault?.mode === 'live' ? 'gold' : 'purple'}
                  size="md"
                />
              </View>
            </View>

            {/* Broker Breakdown Cards */}
            <Text style={styles.sectionTitle}>CONNECTED ACCOUNTS</Text>

            {vault?.balances?.map((b, idx) => {
              const brokerName = b.broker.toUpperCase();
              const isConfigured = b.configured !== false;
              const hasError = !!b.error;

              return (
                <View key={idx} style={styles.brokerCard}>
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

                    <Badge
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
                          ? 'neutral'
                          : hasError
                          ? 'bearish'
                          : b.testnet || b.practice || b.paper
                          ? 'purple'
                          : 'gold'
                      }
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
                      API keys not yet configured. Set them in <Text style={{ color: colors.gold }}>backend/.env</Text> to link real trading.
                    </Text>
                  )}
                </View>
              );
            })}

            {/* Security Architecture Notice */}
            <View style={styles.securityBox}>
              <Ionicons name="lock-closed" size={20} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.securityTitle}>ZERO-TRUST KEY ARCHITECTURE</Text>
                <Text style={styles.securityText}>
                  Your exchange secret keys and withdrawal rights are never exposed to this mobile app.
                  Keys reside exclusively in your backend server with IP-whitelisting and withdrawal permissions permanently blocked.
                </Text>
              </View>
            </View>
          </>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  cardPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardPayBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
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
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 20,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
    marginBottom: 14,
  },
  modeRow: {
    flexDirection: 'row',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: 8,
  },
  brokerCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    letterSpacing: 0.5,
  },
  balanceGrid: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    padding: 12,
    borderRadius: 8,
  },
  balCol: {
    flex: 1,
  },
  balLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
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
    backgroundColor: 'rgba(244, 196, 48, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(244, 196, 48, 0.2)',
    padding: 14,
    borderRadius: 12,
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
