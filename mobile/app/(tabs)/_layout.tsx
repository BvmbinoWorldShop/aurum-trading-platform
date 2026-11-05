import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { colors } from '../../src/theme/colors';
import { haptic } from '../../src/utils/haptics';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
      screenListeners={{
        tabPress: () => {
          haptic.selection();
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={size} color={color as any} />
          ),
        }}
      />
      <Tabs.Screen
        name="markets"
        options={{
          title: 'Markets',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" size={size} color={color as any} />
          ),
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title: 'Trades',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal" size={size} color={color as any} />
          ),
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color as any} />
          ),
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: 'AI Agent',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bulb" size={size} color={color as any} />
          ),
        }}
      />
    </Tabs>
  );
}
