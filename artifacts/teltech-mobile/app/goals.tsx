import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { GoalCard } from '../components/GoalCard';

// Mock Data
const MOCK_GOALS = [
  {
    id: 'o1',
    title: 'Aumentar Receita Recorrente no Q3',
    progress: 75,
    status: 'No Prazo',
    owner: 'Carlos S.',
    krs: [
      { id: 'kr1_1', title: 'Alcançar R$ 150k de MRR', progress: 80, current: 120, target: 150, unit: 'k R$' },
      { id: 'kr1_2', title: 'Fechar 5 novos clientes Enterprise', progress: 60, current: 3, target: 5, unit: 'clientes' },
    ]
  },
  {
    id: 'o2',
    title: 'Melhorar Retenção de Clientes',
    progress: 45,
    status: 'Atenção',
    owner: 'Ana P.',
    krs: [
      { id: 'kr2_1', title: 'Reduzir Churn para menos de 2%', progress: 30, current: 3.5, target: 2, unit: '%' },
      { id: 'kr2_2', title: 'Aumentar NPS para 75', progress: 60, current: 65, target: 75, unit: 'pts' },
      { id: 'kr2_3', title: 'Realizar 20 entrevistas de feedback', progress: 85, current: 17, target: 20, unit: 'entrev.' },
    ]
  },
  {
    id: 'o3',
    title: 'Lançar Novo Módulo Financeiro',
    progress: 95,
    status: 'Concluído',
    owner: 'Dev Team',
    krs: [
      { id: 'kr3_1', title: 'Publicar versão beta para 10 clientes', progress: 100, current: 10, target: 10, unit: 'clientes' },
      { id: 'kr3_2', title: 'Zero bugs críticos na primeira semana', progress: 90, current: 1, target: 0, unit: 'bugs' },
    ]
  }
];

export default function GoalsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleAddGoal = () => {
    Alert.alert('Nova Meta', 'Funcionalidade de criar meta será implementada em breve.');
  };

  return (
    <View className="flex-1 bg-[#111113]">
      <Stack.Screen 
        options={{
          title: 'Metas e OKRs',
          headerStyle: { backgroundColor: '#111113' },
          headerTintColor: '#fafafa',
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={handleAddGoal} className="p-2">
              <Plus color="#7C5AC2" size={24} />
            </TouchableOpacity>
          )
        }} 
      />

      <ScrollView 
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C5AC2" />}
      >
        <Text className="text-[#a1a1aa] mb-4 text-base">
          Acompanhe os Objetivos e Resultados-Chave (OKRs) da empresa e sua evolução.
        </Text>

        {MOCK_GOALS.map(goal => (
          <GoalCard
            key={goal.id}
            title={goal.title}
            progress={goal.progress}
            status={goal.status}
            owner={goal.owner}
            isObjective={true}
          >
            {goal.krs.map(kr => (
              <GoalCard
                key={kr.id}
                title={kr.title}
                progress={kr.progress}
                status=""
                isObjective={false}
                current={kr.current}
                target={kr.target}
                unit={kr.unit}
              />
            ))}
          </GoalCard>
        ))}

        <View className="h-10" />
      </ScrollView>
    </View>
  );
}
