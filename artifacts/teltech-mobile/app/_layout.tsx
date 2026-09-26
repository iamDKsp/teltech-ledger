import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth';
import { queryClient } from '../lib/query-client';
import { initializeApi } from '../lib/api';
import '../global.css';

// Initialize API base URL — change to your server's local network IP
// e.g. 'http://192.168.1.100:5000' for iPhone on same WiFi
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
initializeApi(API_URL);

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#111113' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="project/[id]" />
            <Stack.Screen name="task/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="goals" />
            <Stack.Screen name="members" />
            <Stack.Screen name="meetings" />
            <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
            <Stack.Screen name="settings" />
          </Stack>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
