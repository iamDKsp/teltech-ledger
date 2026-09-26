import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Mail, Lock, ScanFace, Fingerprint } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { isBiometricAvailable, isBiometricEnabled, enableBiometric, authenticateWithBiometric, getBiometricLabel, BiometricType } from '../lib/biometrics';
import { triggerSuccessHaptic, triggerLightHaptic } from '../lib/haptics';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioType, setBioType] = useState<BiometricType>('none');
  const [bioLabel, setBioLabel] = useState('Biometria');

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const { available, type } = await isBiometricAvailable();
    const enabled = await isBiometricEnabled();
    const label = await getBiometricLabel();
    
    setBioAvailable(available);
    setBioType(type);
    setBioEnabled(enabled);
    setBioLabel(label);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }
    
    setLocalLoading(true);
    triggerLightHaptic();
    
    try {
      await signIn(email, password);
      triggerSuccessHaptic();
      
      if (bioAvailable && !bioEnabled) {
        Alert.alert(
          `Habilitar ${bioLabel}?`,
          `Deseja usar o ${bioLabel} para entrar rapidamente nas próximas vezes?`,
          [
            { text: 'Agora não', style: 'cancel' },
            { 
              text: 'Sim, habilitar', 
              onPress: async () => {
                await enableBiometric();
              } 
            }
          ]
        );
      }
      
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Erro', 'Credenciais inválidas. Tente novamente.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    triggerLightHaptic();
    const success = await authenticateWithBiometric();
    if (success) {
      setLocalLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
        triggerSuccessHaptic();
        router.replace('/(tabs)');
      } finally {
        setLocalLoading(false);
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#111113]">
      <KeyboardAvoidingView 
        className="flex-1" 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 justify-center px-6">
          <View className="items-center mb-10">
            <View className="w-20 h-20 bg-[#7C5AC2] rounded-2xl items-center justify-center mb-4 shadow-lg shadow-[#7C5AC2]/30">
              <Text className="text-white text-3xl font-bold">TL</Text>
            </View>
            <Text className="text-3xl font-bold text-white mb-2">Teltech Ledger</Text>
            <Text className="text-[#a1a1aa] text-base text-center">Entre para acessar seus projetos e tarefas</Text>
          </View>

          <View className="space-y-4 gap-4">
            <View>
              <Text className="text-[#a1a1aa] text-sm mb-2 ml-1">E-mail</Text>
              <View className="flex-row items-center bg-[#232326] border border-[#313136] rounded-xl px-4 h-14">
                <Mail color="#a1a1aa" size={20} />
                <TextInput
                  className="flex-1 text-white ml-3 text-base"
                  placeholder="Seu e-mail"
                  placeholderTextColor="#a1a1aa"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View>
              <Text className="text-[#a1a1aa] text-sm mb-2 ml-1">Senha</Text>
              <View className="flex-row items-center bg-[#232326] border border-[#313136] rounded-xl px-4 h-14">
                <Lock color="#a1a1aa" size={20} />
                <TextInput
                  className="flex-1 text-white ml-3 text-base"
                  placeholder="Sua senha"
                  placeholderTextColor="#a1a1aa"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <View className="items-end mt-1 mb-4">
              <Pressable>
                <Text className="text-[#7C5AC2] font-medium text-sm">Esqueci minha senha</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={isLoading || localLoading}
              className={`h-14 bg-[#7C5AC2] rounded-xl items-center justify-center ${
                isLoading || localLoading ? 'opacity-70' : ''
              }`}
            >
              {isLoading || localLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">Entrar</Text>
              )}
            </Pressable>

            {bioAvailable && bioEnabled && (
              <Pressable
                onPress={handleBiometricLogin}
                className="h-14 bg-[#2b2b2e] border border-[#313136] rounded-xl items-center justify-center flex-row gap-3 mt-2"
              >
                {bioType === 'face' ? (
                  <ScanFace color="#7C5AC2" size={20} />
                ) : (
                  <Fingerprint color="#7C5AC2" size={20} />
                )}
                <Text className="text-white font-medium text-base">Entrar com {bioLabel}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
