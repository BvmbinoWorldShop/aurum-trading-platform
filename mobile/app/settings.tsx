import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme/colors';
import { HapticTouchable } from '../src/components/HapticTouchable';
import { Badge } from '../src/components/Badge';
import { api } from '../src/api/endpoints';
import { getApiConfig } from '../src/api/client';
import { useApp } from '../src/context/AppContext';
import { haptic } from '../src/utils/haptics';

export default function SettingsScreen() {
  const { updateServerUrl, refreshDashboard } = useApp();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Network connection config
  const [serverUrl, setServerUrl] = useState(getApiConfig().baseUrl);
  const [appToken, setAppToken] = useState(getApiConfig().token);
  const [testingConn, setTestingConn] = useState(false);

  // Risk parameters
  const [riskPerTrade, setRiskPerTrade] = useState('1.0');
  const [maxDailyLoss, setMaxDailyLoss] = useState('3.0');
  const [minConfidence, setMinConfidence] = useState('0.70');
  const [tpAtr, setTpAtr] = useState('1.5');
  const [slAtr, setSlAtr] = useState('1.5');
  const [maxOpen, setMaxOpen] = useState('3');
  const [aiVeto, setAiVeto] = useState(true);

  const loadSettings = async () => {
    try {
      const data = await api.settings();
      setSettings(data);
      setRiskPerTrade(data.risk_per_trade_pct?.toString() || '1.0');
      setMaxDailyLoss(data.max_daily_loss_pct?.toString() || '3.0');
      setMinConfidence(data.min_confidence?.toString() || '0.70');
      setTpAtr(data.tp_atr?.toString() || '1.5');
      setSlAtr(data.sl_atr?.toString() || '1.5');
      setMaxOpen(data.max_open_positions?.toString() || '3');
      setAiVeto(!!data.ai_veto);
    } catch (err) {
      console.log('Error loading settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleTestConnection = async () => {
    setTestingConn(true);
    haptic.selection();
    try {
      await updateServerUrl(serverUrl, appToken);
      const res = await api.health();
      haptic.success();
      Alert.alert('Connection Successful', `Connected to backend in ${res.mode.toUpperCase()} mode.`);
      loadSettings();
    } catch (err: any) {
      haptic.error();
      Alert.alert('Connection Failed', err.message);
    } finally {
      setTestingConn(false);
    }
  };

  const handleSaveRisk = async () => {
    setSaving(true);
    haptic.medium();
    try {
      await api.updateSettings({
        risk_per_trade_pct: parseFloat(riskPerTrade),
        max_daily_loss_pct: parseFloat(maxDailyLoss),
        min_confidence: parseFloat(minConfidence),
        tp_atr: parseFloat(tpAtr),
        sl_atr: parseFloat(slAtr),
        max_open_positions: parseInt(maxOpen, 10),
        ai_veto: aiVeto,
      });
      haptic.success();
      Alert.alert('Settings Saved', 'Risk parameters updated across all engines.');
      refreshDashboard();
      loadSettings();
    } catch (err: any) {
      haptic.error();
      Alert.alert('Save Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Network & Backend Server */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="server" size={18} color={colors.gold} />
              <Text style={styles.cardTitle}>BACKEND SERVER CONNECTION</Text>
            </View>
            <Badge label="HOST" variant="neutral" />
          </View>

          <Text style={styles.inputLabel}>SERVER BASE URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://192.168.1.X:8000 or http://localhost:8000"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.fieldHelp}>
            Tip: When testing on a physical phone via Expo Go, enter your computer's local Wi-Fi IP address.
          </Text>

          <Text style={[styles.inputLabel, { marginTop: 10 }]}>APP ACCESS TOKEN</Text>
          <TextInput
            style={styles.input}
            value={appToken}
            onChangeText={setAppToken}
            placeholder="Security token matching backend/.env"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <HapticTouchable
            style={styles.testBtn}
            onPress={handleTestConnection}
            disabled={testingConn}
            hapticType="medium"
          >
            {testingConn ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.testBtnText}>Test & Connect Server</Text>
            )}
          </HapticTouchable>
        </View>

        {/* Risk Guardian */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="shield-checkmark" size={18} color={colors.gold} />
              <Text style={styles.cardTitle}>RISK GUARDIAN PARAMETERS</Text>
            </View>
            <Badge label="ACTIVE" variant="bullish" />
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={colors.gold} />
          ) : (
            <>
              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldName}>Risk Per Trade (%)</Text>
                  <Text style={styles.fieldDesc}>Equity risked between entry & stop</Text>
                </View>
                <TextInput
                  style={styles.numInput}
                  value={riskPerTrade}
                  onChangeText={setRiskPerTrade}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldName}>Max Daily Loss Limit (%)</Text>
                  <Text style={styles.fieldDesc}>Pauses autopilot for 24h upon drawdown</Text>
                </View>
                <TextInput
                  style={styles.numInput}
                  value={maxDailyLoss}
                  onChangeText={setMaxDailyLoss}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldName}>Min Signal Confidence</Text>
                  <Text style={styles.fieldDesc}>Calibrated probability threshold (0.5 - 0.95)</Text>
                </View>
                <TextInput
                  style={styles.numInput}
                  value={minConfidence}
                  onChangeText={setMinConfidence}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldName}>Take Profit (ATR Multiple)</Text>
                  <Text style={styles.fieldDesc}>Target distance based on volatility</Text>
                </View>
                <TextInput
                  style={styles.numInput}
                  value={tpAtr}
                  onChangeText={setTpAtr}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldName}>Stop Loss (ATR Multiple)</Text>
                  <Text style={styles.fieldDesc}>Protective barrier distance</Text>
                </View>
                <TextInput
                  style={styles.numInput}
                  value={slAtr}
                  onChangeText={setSlAtr}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldName}>Max Open Concurrent Trades</Text>
                  <Text style={styles.fieldDesc}>Maximum simultaneous positions</Text>
                </View>
                <TextInput
                  style={styles.numInput}
                  value={maxOpen}
                  onChangeText={setMaxOpen}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldName}>AI Event Risk Veto</Text>
                  <Text style={styles.fieldDesc}>Gemini audits fresh breaking news before execution</Text>
                </View>
                <Switch
                  value={aiVeto}
                  onValueChange={(val) => {
                    haptic.selection();
                    setAiVeto(val);
                  }}
                  trackColor={{ false: colors.bgElevated, true: colors.gold }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <HapticTouchable
                style={styles.saveBtn}
                onPress={handleSaveRisk}
                disabled={saving}
                hapticType="medium"
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Risk Parameters</Text>
                )}
              </HapticTouchable>
            </>
          )}
        </View>

        {/* Live Broker Configuration Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>BROKER API KEYS & CREDENTIALS</Text>
          <Text style={styles.infoText}>
            To configure Binance, OANDA, Alpaca, or Interactive Brokers for real-money execution, edit the{' '}
            <Text style={{ color: colors.gold, fontWeight: '700' }}>backend/.env</Text> file on your server:
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>
              TRADING_MODE=live{'\n'}
              BINANCE_API_KEY=your_key{'\n'}
              BINANCE_API_SECRET=your_secret{'\n'}
              OANDA_API_KEY=your_oanda_token{'\n'}
              ALPACA_API_KEY=your_alpaca_key{'\n'}
              GEMINI_API_KEY=your_gemini_key
            </Text>
          </View>
          <Text style={styles.infoSubtext}>
            Always create API keys with IP whitelisting enabled and WITHDRAWALS DISABLED.
          </Text>
        </View>
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
    gap: 16,
    paddingBottom: 40,
  },
  card: {
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
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldHelp: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  testBtn: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  testBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fieldDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  numInput: {
    width: 70,
    backgroundColor: colors.bgCard,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
  },
  codeBox: {
    backgroundColor: colors.bgPrimary,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 10,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.gold,
    lineHeight: 18,
  },
  infoSubtext: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
