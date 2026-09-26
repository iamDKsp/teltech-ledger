import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useSegments, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

function ProjectHeader() {
  const router = useRouter();
  const segments = useSegments();
  const { id } = useLocalSearchParams();
  
  // Get current active tab from route segment
  const currentTab = segments[segments.length - 1];

  const navigateTo = (tab: string) => {
    router.replace(`/project/${id}/${tab}`);
  };

  return (
    <View className="bg-[#111113] pt-12 pb-2 px-4 border-b border-[#313136]">
      <View className="flex-row items-center mb-4">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 items-center justify-center mr-2 -ml-2"
        >
          <ChevronLeft color="#fafafa" size={28} />
        </TouchableOpacity>
        <Text className="text-[#fafafa] text-xl font-bold flex-1">Projeto {id}</Text>
      </View>

      <View className="flex-row bg-[#2b2b2e] rounded-lg p-1">
        {[
          { key: 'board', label: 'Quadros' },
          { key: 'list', label: 'Lista' },
          { key: 'overview', label: 'Visão Geral' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => navigateTo(tab.key)}
            className={`flex-1 py-1.5 items-center rounded-md ${currentTab === tab.key ? 'bg-[#36363c]' : 'bg-transparent'}`}
          >
            <Text className={`font-medium text-sm ${currentTab === tab.key ? 'text-[#fafafa]' : 'text-[#a1a1aa]'}`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function ProjectLayout() {
  return (
    <Stack
      screenOptions={{
        header: () => <ProjectHeader />,
        contentStyle: { backgroundColor: '#111113' }
      }}
    >
      <Stack.Screen name="board" />
      <Stack.Screen name="list" />
      <Stack.Screen name="overview" />
    </Stack>
  );
}
