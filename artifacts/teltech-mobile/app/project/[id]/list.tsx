import React from 'react';
import { View, Text, SectionList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { TaskRow } from '../../../components/TaskRow';

const MOCK_LIST = [
  {
    title: 'A Fazer',
    data: [
      { id: 't1', title: 'Design System', priority: 'high', dueDate: '24 Set', projectName: 'Ledger Mobile', projectColor: '#7C5AC2' },
      { id: 't2', title: 'Setup Repo', priority: 'medium', dueDate: '25 Set', projectName: 'Ledger Mobile', projectColor: '#7C5AC2' },
    ]
  },
  {
    title: 'Em Progresso',
    data: [
      { id: 't3', title: 'Login Screen', priority: 'high', dueDate: 'Hoje', projectName: 'Ledger Mobile', projectColor: '#7C5AC2', isOverdue: true },
    ]
  }
];

export default function ProjectListScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#111113]">
      <SectionList
        sections={MOCK_LIST}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderSectionHeader={({ section: { title, data } }) => (
          <View className="flex-row justify-between items-center mb-3 mt-4">
            <Text className="text-[#fafafa] font-bold text-lg">{title}</Text>
            <View className="bg-[#2b2b2e] rounded-full px-2 py-0.5 border border-[#313136]">
              <Text className="text-[#a1a1aa] text-xs font-bold">{data.length}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <TaskRow 
            task={item as any} 
            onPress={() => router.push(`/task/${item.id}`)}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
