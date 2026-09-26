import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useAuth, useDashboard } from '../../hooks';
import { StatCard } from '../../components/StatCard';
import { TaskRow } from '../../components/TaskRow';
import { CheckSquare, AlertCircle, CheckCircle2, FolderKanban } from 'lucide-react-native';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboard();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const currentDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());

  return (
    <ScrollView 
      className="flex-1 bg-[#111113]"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C5AC2" />}
      contentContainerStyle={{ padding: 16 }}
    >
      <View className="mb-6">
        <Text className="text-[#a1a1aa] text-base capitalize">{currentDate}</Text>
        <Text className="text-[#fafafa] text-3xl font-bold mt-1">{getGreeting()}, {user.name}</Text>
      </View>

      <View className="flex-row gap-4 mb-4">
        <StatCard title="Tarefas do Dia" value={data.stats.tarefasDia} icon={CheckSquare} iconColor="#4080d6" />
        <StatCard title="Atrasadas" value={data.stats.atrasadas} icon={AlertCircle} iconColor="#d44040" />
      </View>
      <View className="flex-row gap-4 mb-8">
        <StatCard title="Concluídas Hoje" value={data.stats.concluidas} icon={CheckCircle2} iconColor="#27a06b" />
        <StatCard title="Projetos Ativos" value={data.stats.projetosAtivos} icon={FolderKanban} iconColor="#7C5AC2" />
      </View>

      <View className="mb-8">
        <Text className="text-[#fafafa] text-xl font-bold mb-4">Tarefas de Hoje</Text>
        {data.tarefasHoje.map(task => (
          <TaskRow key={task.id} task={task} />
        ))}
      </View>

      <View className="mb-8">
        <Text className="text-[#fafafa] text-xl font-bold mb-4">Atividades Recentes</Text>
        <View className="bg-[#2b2b2e] rounded-2xl p-4 border border-[#313136]">
          <View className="flex-row items-center mb-4">
            <View className="w-2 h-2 rounded-full bg-[#7C5AC2] mr-3" />
            <View>
              <Text className="text-[#fafafa]">Lucas concluiu <Text className="font-bold">Setup Auth</Text></Text>
              <Text className="text-[#a1a1aa] text-xs">Há 10 min</Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-[#4080d6] mr-3" />
            <View>
              <Text className="text-[#fafafa]">Tarcísio criou o projeto <Text className="font-bold">Ledger Mobile</Text></Text>
              <Text className="text-[#a1a1aa] text-xs">Há 2 horas</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
