import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { colors } from '../../src/theme/colors';
import { haptic } from '../../src/utils/haptics';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(10, 14, 24, 0.92)',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 12,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.4,
          marginTop: 2,
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
          title: 'Terminal',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconGlow : null}>
              <Ionicons
                name={focused ? 'sparkles' : 'sparkles-outline'}
                size={22}
                color={color as any}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="markets"
        options={{
          title: 'Quant Radar',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconGlow : null}>
              <Ionicons
                name={focused ? 'pulse' : 'pulse-outline'}
                size={22}
                color={color as any}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title: 'Execution',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconGlow : null}>
              <Ionicons
                name={focused ? 'swap-horizontal' : 'swap-horizontal-outline'}
                size={22}
                color={color as any}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconGlow : null}>
              <Ionicons
                name={focused ? 'wallet' : 'wallet-outline'}
                size={22}
                color={color as any}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: 'AI Aurum',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconGlow : null}>
              <Ionicons
                name={focused ? 'hardware-chip' : 'hardware-chip-outline'}
                size={22}
                color={color as any}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconGlow: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
});
