import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme/colors';
import { HapticTouchable } from '../src/components/HapticTouchable';
import { GlassCard } from '../src/components/GlassCard';
import { GradientPill } from '../src/components/GradientPill';
import { api } from '../src/api/endpoints';
import { useApp } from '../src/context/AppContext';
import { haptic } from '../src/utils/haptics';

export default function ApiKeysScreen() {
  const { refreshDashboard } = useApp();
  const [keysStatus, setKeysStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAi, setTestingAi] = useState(false);

  // Key form inputs
  const [geminiKey, setGeminiKey] = useState('');
  const [showGemini, setShowGemini] = useState(false);

  const [binanceKey, setBinanceKey] = useState('');
  const [binanceSecret, setBinanceSecret] = useState('');
  const [showBinance, setShowBinance] = useState(false);

  const [oandaKey, setOandaKey] = useState('');
  const [alpacaKey, setAlpacaKey] = useState('');
  const [alpacaSecret, setAlpacaSecret] = useState('');

  const loadStatus = async () => {
    try {
      const data = await api.getApiKeys();
      setKeysStatus(data);
    } catch (err) {
      console.log('Error loading API keys status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleTestGemini = async () => {
    const keyToTest = geminiKey.trim();
    if (!keyToTest) {
      Alert.alert('Empty Key', 'Please paste your Google Gemini API key first to test it.');
      return;
    }

    setTestingAi(true);
    haptic.selection();
    try {
      const res = await api.testApiKey(keyToTest, 'gemini');
      if (res.success) {
        haptic.success();
        Alert.alert(
          'Gemini Key Verified!',
          `Successfully connected to ${res.model}. Your free AI key is ready for real-time market scanning.`
        );
      } else {
        haptic.error();
        Alert.alert('Key Error', res.error || 'Failed to authenticate with Gemini.');
      }
    } catch (err: any) {
      haptic.error();
      Alert.alert('Verification Failed', err.message);
    } finally {
      setTestingAi(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    haptic.medium();
    try {
      const patch: any = {};
      if (geminiKey.trim()) patch.gemini_api_key = geminiKey.trim();
      if (binanceKey.trim()) patch.binance_api_key = binanceKey.trim();
      if (binanceSecret.trim()) patch.binance_api_secret = binanceSecret.trim();
      if (oandaKey.trim()) patch.oanda_api_key = oandaKey.trim();
      if (alpacaKey.trim()) patch.alpaca_api_key = alpacaKey.trim();
      if (alpacaSecret.trim()) patch.alpaca_api_secret = alpacaSecret.trim();

      const res = await api.saveApiKeys(patch);
      haptic.success();
      setKeysStatus(res.keys);
      setGeminiKey('');
      setBinanceKey('');
      setBinanceSecret('');
      setOandaKey('');
      setAlpacaKey('');
      setAlpacaSecret('');
      refreshDashboard();

      Alert.alert('Keys Saved', `Updated: ${res.updated.join(', ') || 'Settings saved.'}`);
    } catch (err: any) {
      haptic.error();
      Alert.alert('Save Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const openFreeAiStudio = () => {
    haptic.selection();
    Linking.openURL('https://aistudio.google.com/app/apikey');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Free AI Hub Banner */}
        <GlassCard glowColor="gold" borderRadius={22} style={styles.heroPad}>
          <View style={styles.heroTop}>
            <View style={styles.iconCircle}>
              <Ionicons name="sparkles" size={18} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>FREE AI & BROKER API HUB</Text>
              <Text style={styles.heroSub}>
                Add your free AI key directly here to activate live web-grounded market scanning and psychological coaching.
              </Text>
            </View>
          </View>

          <HapticTouchable
            style={styles.freeLinkBtn}
            onPress={openFreeAiStudio}
            hapticType="selection"
          >
            <Ionicons name="open-outline" size={16} color={colors.goldBright} />
            <Text style={styles.freeLinkText}>Get 100% Free Gemini Key (Google AI Studio) ›</Text>
          </HapticTouchable>
        </GlassCard>

        {/* Section 1: Free Gemini AI Key */}
        <GlassCard glowColor={keysStatus?.gemini?.configured ? 'bullish' : 'gold'} borderRadius={20} style={styles.cardPad}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="hardware-chip" size={20} color={colors.goldBright} />
              <Text style={styles.sectionTitle}>GOOGLE GEMINI (FREE AI ENGINE)</Text>
            </View>

            <GradientPill
              label={keysStatus?.gemini?.configured ? 'CONNECTED' : 'NOT CONNECTED'}
              variant={keysStatus?.gemini?.configured ? 'bullish' : 'glass'}
              size="sm"
            />
          </View>

          {keysStatus?.gemini?.configured && (
            <Text style={styles.activeKeyInfo}>
              Active Key: <Text style={{ color: colors.goldBright, fontWeight: '800' }}>{keysStatus.gemini.preview}</Text>
            </Text>
          )}

          <Text style={styles.inputLabel}>PASTE GEMINI API KEY</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.keyInput}
              value={geminiKey}
              onChangeText={setGeminiKey}
              placeholder="AIzaSy..."
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showGemini}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <HapticTouchable
              style={styles.eyeBtn}
              onPress={() => setShowGemini(!showGemini)}
            >
              <Ionicons
                name={showGemini ? 'eye-off' : 'eye'}
                size={18}
                color={colors.textSecondary}
              />
            </HapticTouchable>
          </View>

          <View style={styles.keyActionsRow}>
            <GradientPill
              label={testingAi ? 'TESTING...' : 'TEST KEY'}
              variant="glass"
              icon={testingAi ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="checkmark-circle-outline" size={14} color="#FFF" />}
              size="sm"
              onPress={handleTestGemini}
            />

            <GradientPill
              label="SAVE KEY"
              variant="gold"
              size="sm"
              onPress={handleSaveAll}
            />
          </View>
        </GlassCard>

        {/* Section 2: Binance Exchange Keys */}
        <GlassCard glowColor={keysStatus?.binance?.configured ? 'bullish' : 'none'} borderRadius={20} style={styles.cardPad}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="logo-bitcoin" size={20} color={colors.goldBright} />
              <Text style={styles.sectionTitle}>BINANCE CRYPTO (SPOT / TESTNET)</Text>
            </View>

            <GradientPill
              label={keysStatus?.binance?.configured ? 'CONNECTED' : 'OPTIONAL'}
              variant={keysStatus?.binance?.configured ? 'bullish' : 'glass'}
              size="sm"
            />
          </View>

          <Text style={styles.inputLabel}>BINANCE API KEY</Text>
          <TextInput
            style={styles.input}
            value={binanceKey}
            onChangeText={setBinanceKey}
            placeholder={keysStatus?.binance?.key_preview || "Enter Binance API Key"}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>BINANCE SECRET KEY</Text>
          <TextInput
            style={styles.input}
            value={binanceSecret}
            onChangeText={setBinanceSecret}
            placeholder="Enter Binance Secret"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showBinance}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.securityWarning}>
            <Ionicons name="shield-checkmark" size={14} color={colors.bullish} />
            <Text style={styles.securityWarningText}>
              Security Rule: Always leave withdrawals DISABLED when generating exchange API keys.
            </Text>
          </View>
        </GlassCard>

        {/* Section 3: OANDA & Alpaca Keys */}
        <GlassCard borderRadius={20} style={styles.cardPad}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="globe" size={20} color={colors.cyan} />
              <Text style={styles.sectionTitle}>FOREX, GOLD & AI STOCKS</Text>
            </View>
            <GradientPill label="OPTIONAL" variant="glass" size="sm" />
          </View>

          <Text style={styles.inputLabel}>OANDA V20 TOKEN (FOREX & GOLD)</Text>
          <TextInput
            style={styles.input}
            value={oandaKey}
            onChangeText={setOandaKey}
            placeholder={keysStatus?.oanda?.key_preview || "OANDA Personal Access Token"}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>ALPACA API KEY (US STOCKS / NVDA / MSFT)</Text>
          <TextInput
            style={styles.input}
            value={alpacaKey}
            onChangeText={setAlpacaKey}
            placeholder={keysStatus?.alpaca?.key_preview || "PK..."}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>ALPACA SECRET KEY</Text>
          <TextInput
            style={styles.input}
            value={alpacaSecret}
            onChangeText={setAlpacaSecret}
            placeholder="Alpaca Secret Key"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
          />
        </GlassCard>

        {/* Global Save Button */}
        <GradientPill
          label={saving ? 'SAVING KEYS...' : 'SAVE ALL KEYS & ACTIVATE'}
          variant="gold"
          size="lg"
          style={{ width: '100%', justifyContent: 'center' }}
          onPress={handleSaveAll}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgVoid,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  heroPad: {
    padding: 18,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  heroSub: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 4,
  },
  freeLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  freeLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.goldBright,
  },
  cardPad: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  activeKeyInfo: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  keyInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
  },
  eyeBtn: {
    padding: 10,
  },
  keyActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  securityWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 245, 160, 0.06)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.2)',
    marginTop: 12,
  },
  securityWarningText: {
    flex: 1,
    fontSize: 10,
    color: colors.bullish,
    lineHeight: 14,
  },
});
