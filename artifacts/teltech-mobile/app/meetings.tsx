import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { MeetingCard } from '../components/MeetingCard';

export default function MeetingsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleAddMeeting = () => {
    Alert.alert('Nova Reunião', 'Funcionalidade de agendamento em breve.');
  };

  const participants1 = [
    { name: 'Tarcísio', initials: 'TA' },
    { name: 'Lucas', initials: 'LU' },
    { name: 'Mariana', initials: 'MA' }
  ];

  const participants2 = [
    { name: 'Lucas', initials: 'LU' },
    { name: 'Carlos', initials: 'CA' }
  ];

  return (
    <View className="flex-1 bg-[#111113]">
      <Stack.Screen 
        options={{ 
          title: 'Reuniões',
          headerStyle: { backgroundColor: '#111113' },
          headerTintColor: '#fafafa',
          headerTitleStyle: { fontWeight: 'bold' }
        }} 
      />

      <ScrollView 
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C5AC2" />
        }
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 20 }}
      >
        <Text className="text-xl font-bold text-white mb-4">Próximas Reuniões</Text>
        
        <MeetingCard
          title="Planejamento Sprint 4"
          date="28 de Setembro, 2026"
          time="10:00 - 11:30"
          duration="1h 30m"
          location="https://meet.google.com/abc-defg-hij"
          participants={participants1}
          color="#7C5AC2"
        />

        <MeetingCard
          title="Review de Arquitetura"
          date="30 de Setembro, 2026"
          time="14:00 - 15:00"
          duration="1h"
          location="Sala de Reuniões 1"
          participants={participants2}
          color="#27a06b"
        />

        <Text className="text-xl font-bold text-white mt-6 mb-4">Reuniões Anteriores</Text>
        
        <MeetingCard
          title="Sync Semanal"
          date="21 de Setembro, 2026"
          time="09:00 - 10:00"
          duration="1h"
          location="Google Meet"
          participants={participants1}
          color="#a1a1aa"
          isPast={true}
        />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity 
        className="absolute bottom-8 right-6 w-14 h-14 bg-[#7C5AC2] rounded-full items-center justify-center shadow-lg"
        onPress={handleAddMeeting}
        activeOpacity={0.8}
      >
        <Plus size={24} color="#fafafa" />
      </TouchableOpacity>
    </View>
  );
}
