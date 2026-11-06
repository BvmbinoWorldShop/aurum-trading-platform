import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../src/context/AppContext';
import { colors } from '../src/theme/colors';

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.bgSecondary,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: '700',
            color: colors.textPrimary,
          },
          contentStyle: {
            backgroundColor: colors.bgPrimary,
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="profile"
          options={{
            title: 'Sovereign Account & Payments',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="learn"
          options={{
            title: 'Learning Academy',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="plugins"
          options={{
            title: 'Marketplace & Plugins',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Risk Guardian & Settings',
            presentation: 'modal',
          }}
        />
      </Stack>
    </AppProvider>
  );
}
