import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme/colors';
import { HapticTouchable } from '../src/components/HapticTouchable';
import { Badge } from '../src/components/Badge';
import { api, PluginItem } from '../src/api/endpoints';
import { haptic } from '../src/utils/haptics';

export default function PluginsScreen() {
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const loadPlugins = async () => {
    try {
      const data = await api.plugins();
      setPlugins(data);
    } catch (err) {
      console.log('Error loading plugins', err);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  const handleDiscover = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    haptic.medium();
    try {
      await api.discoverPlugins(searchQuery);
      haptic.success();
      loadPlugins();
    } catch (err: any) {
      haptic.error();
      Alert.alert('Scan Failed', err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleUpdateStatus = async (plugin: PluginItem, newStatus: 'approved' | 'rejected') => {
    try {
      haptic.selection();
      await api.setPluginStatus(plugin.id, newStatus);
      haptic.success();
      loadPlugins();
    } catch (err: any) {
      haptic.error();
      Alert.alert('Status Error', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>GITHUB EXTENSIONS & PLUGINS</Text>
          <Text style={styles.bannerSub}>
            Scan verified open-source algorithmic tools, indicators, and quant repos.
            All discovered extensions require explicit human approval before sandbox integration.
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search GitHub (e.g. crypto strategy, ccxt bot)..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleDiscover}
            returnKeyType="search"
          />
          <HapticTouchable
            style={styles.scanBtn}
            onPress={handleDiscover}
            disabled={searching}
            hapticType="medium"
          >
            {searching ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="search" size={18} color="#000" />
            )}
          </HapticTouchable>
        </View>

        {/* Plugins List */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} />
        ) : plugins.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Plugins Discovered Yet</Text>
            <Text style={styles.emptySub}>
              Type a query above to scan GitHub for audited quantitative trading libraries.
            </Text>
          </View>
        ) : (
          plugins.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.repoName}>{item.full_name}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.starRow}>
                      <Ionicons name="star" size={12} color={colors.gold} />
                      <Text style={styles.starCount}>{item.stars.toLocaleString()}</Text>
                    </View>
                    <Badge label={item.license || 'No License'} variant="neutral" />
                  </View>
                </View>

                <Badge
                  label={item.status.toUpperCase()}
                  variant={
                    item.status === 'approved'
                      ? 'bullish'
                      : item.status === 'rejected'
                      ? 'bearish'
                      : 'warning'
                  }
                />
              </View>

              <Text style={styles.descText}>
                {item.description || 'No description provided by repository.'}
              </Text>

              <View style={styles.actionRow}>
                <HapticTouchable
                  style={styles.linkBtn}
                  onPress={() => Linking.openURL(item.url)}
                >
                  <Ionicons name="logo-github" size={14} color={colors.textSecondary} />
                  <Text style={styles.linkBtnText}>View Source</Text>
                </HapticTouchable>

                <View style={styles.decisionBtns}>
                  <HapticTouchable
                    style={[styles.decisionBtn, styles.approveBtn]}
                    onPress={() => handleUpdateStatus(item, 'approved')}
                    hapticType="medium"
                  >
                    <Ionicons name="checkmark" size={14} color={colors.bullish} />
                    <Text style={[styles.decisionText, { color: colors.bullish }]}>
                      Approve
                    </Text>
                  </HapticTouchable>

                  <HapticTouchable
                    style={[styles.decisionBtn, styles.rejectBtn]}
                    onPress={() => handleUpdateStatus(item, 'rejected')}
                    hapticType="medium"
                  >
                    <Ionicons name="close" size={14} color={colors.bearish} />
                    <Text style={[styles.decisionText, { color: colors.bearish }]}>
                      Reject
                    </Text>
                  </HapticTouchable>
                </View>
              </View>
            </View>
          ))
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
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  banner: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.gold,
    letterSpacing: 1,
  },
  bannerSub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 13,
  },
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  repoName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starCount: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  descText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  decisionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  decisionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  approveBtn: {
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    borderColor: colors.bullish,
  },
  rejectBtn: {
    backgroundColor: 'rgba(255, 59, 86, 0.1)',
    borderColor: colors.bearish,
  },
  decisionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 8,
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
