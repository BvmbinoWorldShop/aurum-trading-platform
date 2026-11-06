import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../src/theme/colors';
import { HapticTouchable } from '../../src/components/HapticTouchable';
import { GlassCard } from '../../src/components/GlassCard';
import { GradientPill } from '../../src/components/GradientPill';
import { api } from '../../src/api/endpoints';
import { haptic } from '../../src/utils/haptics';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  tools?: string[];
  time: string;
}

const PROMPT_SUGGESTIONS = [
  'Scan all markets for top probability setups',
  'Analyze crypto fear & greed & retail psychology',
  'What fresh news is driving Gold and NVDA today?',
  'Audit my open positions and account risk exposure',
];

export default function AgentScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "Greetings. I am AURUM, your quantitative market analyst and trading psychology coach.\n\nI combine real-time exchange data, machine learning signal probabilities, live web intelligence, and risk discipline to keep emotions out of your trading.\n\nHow can I assist your portfolio today?",
      time: 'Now',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<any>(null);

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    haptic.light();

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const res = await api.chat(query);
      haptic.success();
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: res.reply,
        tools: res.tools_used,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      haptic.error();
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: `Error connecting to Aurum Agent: ${err.message}. Make sure your GEMINI_API_KEY is configured in backend/.env.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Glass Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.agentAvatar}>
            <Ionicons name="sparkles" size={16} color="#000" />
          </View>
          <View>
            <Text style={styles.title}>AURUM NEURAL AGENT</Text>
            <Text style={styles.subtitle}>Finance, Quant & Human Psychology</Text>
          </View>
        </View>

        <GradientPill label="GEMINI 2026" variant="gold" size="sm" />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.messageWrapper,
                m.sender === 'user' ? styles.userWrapper : styles.agentWrapper,
              ]}
            >
              {m.sender === 'user' ? (
                <LinearGradient
                  colors={['#FFD54F', '#FFA000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.messageBubble, styles.userBubble]}
                >
                  <Text style={styles.userMessageText}>{m.text}</Text>
                  <Text style={styles.userTimestamp}>{m.time}</Text>
                </LinearGradient>
              ) : (
                <GlassCard glowColor="none" borderRadius={16} style={styles.agentGlassCard}>
                  {m.tools && m.tools.length > 0 && (
                    <View style={styles.toolsUsedRow}>
                      <Ionicons name="construct-outline" size={12} color={colors.goldBright} />
                      <Text style={styles.toolsUsedText}>
                        Tools: {m.tools.join(', ')}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.agentMessageText}>{m.text}</Text>
                  <Text style={styles.agentTimestamp}>{m.time}</Text>
                </GlassCard>
              )}
            </View>
          ))}

          {loading && (
            <View style={styles.agentWrapper}>
              <GlassCard glowColor="gold" borderRadius={16} style={styles.agentGlassCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={colors.goldBright} />
                  <Text style={styles.analyzingText}>Aurum is evaluating markets, psychology & web signals...</Text>
                </View>
              </GlassCard>
            </View>
          )}
        </ScrollView>

        {/* Suggestion Chips */}
        <View style={styles.suggestionsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
            {PROMPT_SUGGESTIONS.map((prompt, idx) => (
              <GradientPill
                key={idx}
                label={prompt}
                variant="glass"
                size="sm"
                onPress={() => sendMessage(prompt)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Glassmorphic Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask about risk, signals, market news..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />

          <HapticTouchable
            style={[styles.sendBtn, !input.trim() && { opacity: 0.4 }]}
            hapticType="medium"
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <LinearGradient
              colors={['#FFE082', '#FF8F00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendGradient}
            >
              <Ionicons name="arrow-up" size={18} color="#000" />
            </LinearGradient>
          </HapticTouchable>
        </View>
      </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 10,
    color: colors.textMuted,
  },
  chatContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  agentWrapper: {
    justifyContent: 'flex-start',
    maxWidth: '90%',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  userMessageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#06090E',
    fontWeight: '700',
  },
  userTimestamp: {
    fontSize: 9,
    color: 'rgba(0, 0, 0, 0.6)',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  agentGlassCard: {
    padding: 14,
    width: '100%',
  },
  agentMessageText: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  agentTimestamp: {
    fontSize: 9,
    color: colors.textMuted,
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  toolsUsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
  },
  toolsUsedText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.goldBright,
  },
  analyzingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  suggestionsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderGlass,
    paddingVertical: 8,
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(8, 12, 20, 0.95)',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderGlass,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: colors.textPrimary,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  sendGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
