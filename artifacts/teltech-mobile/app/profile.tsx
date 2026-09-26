import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { Stack } from 'expo-router';
import { Camera, ChevronRight } from 'lucide-react-native';
// Assuming useAuth is available or mock it if it doesn't exist yet
// import { useAuth } from '../lib/auth';

export default function ProfileScreen() {
  // Mock auth context for now
  const auth = { user: { name: 'Tarcísio', email: 'tarcisio@teltech.com.br' } };
  
  const [name, setName] = useState(auth.user?.name || '');
  const [phone, setPhone] = useState('');
  const [faceIdEnabled, setFaceIdEnabled] = useState(true);

  const handleEditAvatar = () => {
    Alert.alert('Alterar Foto', 'Abrindo o seletor de imagens...');
  };

  const handleSave = () => {
    Alert.alert('Sucesso', 'Perfil atualizado com sucesso.');
  };

  return (
    <View className="flex-1 bg-[#111113]">
      <Stack.Screen 
        options={{ 
          title: 'Meu Perfil',
          headerStyle: { backgroundColor: '#111113' },
          headerTintColor: '#fafafa',
          headerTitleStyle: { fontWeight: 'bold' }
        }} 
      />

      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Avatar Section */}
        <View className="items-center mb-8">
          <View className="relative">
            <View className="w-24 h-24 rounded-full bg-[#36363c] border-2 border-[#313136] items-center justify-center">
              <Text className="text-3xl font-bold text-white">
                {name ? name.substring(0, 2).toUpperCase() : 'US'}
              </Text>
            </View>
            <TouchableOpacity 
              className="absolute bottom-0 right-0 bg-[#7C5AC2] w-8 h-8 rounded-full items-center justify-center border-2 border-[#111113]"
              onPress={handleEditAvatar}
              activeOpacity={0.8}
            >
              <Camera size={14} color="#fafafa" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Form Fields */}
        <View className="space-y-4 mb-8">
          <View>
            <Text className="text-sm font-medium text-[#a1a1aa] mb-2 ml-1">Nome</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              className="bg-[#232326] text-[#fafafa] px-4 py-3 rounded-xl border border-[#313136] text-base"
              placeholderTextColor="#a1a1aa"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-[#a1a1aa] mb-2 ml-1">E-mail</Text>
            <TextInput
              value={auth.user?.email || ''}
              editable={false}
              className="bg-[#1a1a1c] text-[#a1a1aa] px-4 py-3 rounded-xl border border-[#313136] text-base opacity-70"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-[#a1a1aa] mb-2 ml-1">Telefone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+55 (00) 00000-0000"
              keyboardType="phone-pad"
              className="bg-[#232326] text-[#fafafa] px-4 py-3 rounded-xl border border-[#313136] text-base"
              placeholderTextColor="#a1a1aa"
            />
          </View>
        </View>

        {/* Security Section */}
        <Text className="text-lg font-bold text-white mb-3 ml-1">Segurança</Text>
        <View className="bg-[#2b2b2e] rounded-2xl border border-[#313136] overflow-hidden mb-8">
          <TouchableOpacity 
            className="flex-row items-center justify-between p-4 border-b border-[#313136]"
            onPress={() => Alert.alert('Alterar Senha', 'Fluxo de alteração de senha')}
          >
            <Text className="text-base text-white">Alterar Senha</Text>
            <ChevronRight size={20} color="#a1a1aa" />
          </TouchableOpacity>
          <View className="flex-row items-center justify-between p-4">
            <View>
              <Text className="text-base text-white">Face ID / Touch ID</Text>
              <Text className="text-xs text-[#a1a1aa] mt-1">Usar expo-local-authentication</Text>
            </View>
            <Switch
              value={faceIdEnabled}
              onValueChange={setFaceIdEnabled}
              trackColor={{ false: '#36363c', true: '#7C5AC2' }}
              thumbColor="#fafafa"
            />
          </View>
        </View>

        {/* Preferences Section */}
        <Text className="text-lg font-bold text-white mb-3 ml-1">Preferências</Text>
        <View className="bg-[#2b2b2e] rounded-2xl border border-[#313136] overflow-hidden mb-8">
          <View className="flex-row items-center justify-between p-4 border-b border-[#313136]">
            <Text className="text-base text-white">Tema</Text>
            <Text className="text-base text-[#a1a1aa]">Escuro</Text>
          </View>
          <View className="flex-row items-center justify-between p-4">
            <Text className="text-base text-white">Idioma</Text>
            <Text className="text-base text-[#a1a1aa]">Português</Text>
          </View>
        </View>

        <TouchableOpacity 
          className="bg-[#7C5AC2] py-4 rounded-xl items-center active:opacity-80"
          onPress={handleSave}
        >
          <Text className="text-white font-bold text-base">Salvar Alterações</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
