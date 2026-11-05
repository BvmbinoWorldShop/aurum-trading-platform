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
import { colors } from '../../src/theme/colors';
import { HapticTouchable } from '../../src/components/HapticTouchable';
import { Badge } from '../../src/components/Badge';
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
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.agentAvatar}>
            <Ionicons name="sparkles" size={18} color="#000" />
          </View>
          <View>
            <Text style={styles.title}>AURUM AI AGENT</Text>
            <Text style={styles.subtitle}>Finance, Quant & Human Psychology</Text>
          </View>
        </View>

        <Badge label="GEMINI POWERED" variant="gold" />
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
              <View
                style={[
                  styles.messageBubble,
                  m.sender === 'user' ? styles.userBubble : styles.agentBubble,
                ]}
              >
                {m.tools && m.tools.length > 0 && (
                  <View style={styles.toolsUsedRow}>
                    <Ionicons name="construct-outline" size={12} color={colors.gold} />
                    <Text style={styles.toolsUsedText}>
                      Tools: {m.tools.join(', ')}
                    </Text>
                  </View>
                )}
                <Text style={styles.messageText}>{m.text}</Text>
                <Text style={styles.timestamp}>{m.time}</Text>
              </View>
            </View>
          ))}

          {loading && (
            <View style={styles.agentWrapper}>
              <View style={[styles.messageBubble, styles.agentBubble, { paddingVertical: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={colors.gold} />
                  <Text style={styles.analyzingText}>Aurum is analyzing live markets & sentiment...</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestion Chips */}
        <View style={styles.suggestionsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
            {PROMPT_SUGGESTIONS.map((prompt, idx) => (
              <HapticTouchable
                key={idx}
                style={styles.suggestionChip}
                hapticType="selection"
                onPress={() => sendMessage(prompt)}
              >
                <Text style={styles.suggestionText}>{prompt}</Text>
              </HapticTouchable>
            ))}
          </ScrollView>
        </View>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask about markets, psychology, signals..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            multiline={false}
          />

          <HapticTouchable
            style={[styles.sendBtn, !input.trim() && { opacity: 0.5 }]}
            hapticType="medium"
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={20} color="#000" />
          </HapticTouchable>
        </View>
      </KeyboardAvoidingView>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
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
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 14,
  },
  userBubble: {
    backgroundColor: colors.gold,
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: colors.bgSecondary,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  timestamp: {
    fontSize: 10,
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
    borderBottomColor: colors.border,
  },
  toolsUsedText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
  },
  analyzingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  suggestionsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.bgSecondary,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.bgCard,
    color: colors.textPrimary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
