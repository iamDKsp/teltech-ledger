import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { MemberCard } from '../components/MemberCard';

export default function MembersScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleAddMember = () => {
    Alert.alert('Convidar Membro', 'Funcionalidade de convite em breve.');
  };

  return (
    <View className="flex-1 bg-[#111113]">
      <Stack.Screen 
        options={{ 
          title: 'Equipe',
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
        <Text className="text-xl font-bold text-white mb-4">Fundadores</Text>
        
        <MemberCard
          name="Tarcísio"
          email="tarcisio@teltech.com.br"
          role="CEO"
          phone="+55 11 99999-9999"
          tagline="Wise Worded Technical Thief"
          isFounder={true}
        />
        
        <MemberCard
          name="Lucas"
          email="lucas@teltech.com.br"
          role="CTO"
          phone="+55 11 98888-8888"
          tagline="Arcane Developer / Infrastructure Wizard"
          isFounder={true}
        />

        <Text className="text-xl font-bold text-white mt-6 mb-4">Membros da Equipe</Text>
        
        <MemberCard
          name="Mariana Silva"
          email="mariana@teltech.com.br"
          role="Design"
        />
        
        <MemberCard
          name="Carlos Oliveira"
          email="carlos@teltech.com.br"
          role="Dev"
        />
        
        <MemberCard
          name="Ana Costa"
          email="ana@teltech.com.br"
          role="Marketing"
        />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity 
        className="absolute bottom-8 right-6 w-14 h-14 bg-[#7C5AC2] rounded-full items-center justify-center shadow-lg"
        onPress={handleAddMember}
        activeOpacity={0.8}
      >
        <Plus size={24} color="#fafafa" />
      </TouchableOpacity>
    </View>
  );
}
