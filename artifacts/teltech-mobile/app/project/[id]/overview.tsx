import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useProjectStats } from '../../../hooks';
import { StatCard } from '../../../components/StatCard';
import { CheckSquare, CircleDashed, AlertCircle, CheckCircle2 } from 'lucide-react-native';

export default function ProjectOverviewScreen() {
  const { data } = useProjectStats('mock');

  return (
    <ScrollView className="flex-1 bg-[#111113]" contentContainerStyle={{ padding: 16 }}>
      <View className="mb-8">
        <Text className="text-[#fafafa] text-lg font-bold mb-4">Progresso Geral</Text>
        <View className="bg-[#2b2b2e] rounded-2xl p-6 border border-[#313136] items-center">
          <Text className="text-4xl font-bold text-[#fafafa] mb-2">50%</Text>
          <Text className="text-[#a1a1aa] mb-4">5 de 10 tarefas concluídas</Text>
          <View className="w-full h-2 bg-[#232326] rounded-full overflow-hidden">
            <View className="h-full bg-[#27a06b] rounded-full" style={{ width: '50%' }} />
          </View>
        </View>
      </View>

      <Text className="text-[#fafafa] text-lg font-bold mb-4">Estatísticas</Text>
      <View className="flex-row gap-4 mb-4">
        <StatCard title="Total" value={data.total} icon={CheckSquare} iconColor="#4080d6" />
        <StatCard title="Concluídas" value={data.completed} icon={CheckCircle2} iconColor="#27a06b" />
      </View>
      <View className="flex-row gap-4 mb-8">
        <StatCard title="Em Progresso" value={data.inProgress} icon={CircleDashed} iconColor="#7C5AC2" />
        <StatCard title="Atrasadas" value={data.overdue} icon={AlertCircle} iconColor="#d44040" />
      </View>
      
      <Text className="text-[#fafafa] text-lg font-bold mb-4">Distribuição por Prioridade</Text>
      <View className="bg-[#2b2b2e] rounded-2xl p-4 border border-[#313136] flex-row items-center justify-around">
        <View className="items-center">
          <View className="w-3 h-3 rounded-full bg-[#d44040] mb-2" />
          <Text className="text-[#fafafa] font-bold text-lg">3</Text>
          <Text className="text-[#a1a1aa] text-xs">Alta</Text>
        </View>
        <View className="items-center">
          <View className="w-3 h-3 rounded-full bg-[#f59e0b] mb-2" />
          <Text className="text-[#fafafa] font-bold text-lg">5</Text>
          <Text className="text-[#a1a1aa] text-xs">Média</Text>
        </View>
        <View className="items-center">
          <View className="w-3 h-3 rounded-full bg-[#4080d6] mb-2" />
          <Text className="text-[#fafafa] font-bold text-lg">2</Text>
          <Text className="text-[#a1a1aa] text-xs">Baixa</Text>
        </View>
      </View>
    </ScrollView>
  );
}
