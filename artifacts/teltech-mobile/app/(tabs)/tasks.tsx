import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useMyTasks } from '../../hooks';
import { TaskRow } from '../../components/TaskRow';
import { EmptyState } from '../../components/EmptyState';
import { CheckCircle } from 'lucide-react-native';

const FILTERS = ['Todas', 'Hoje', 'Esta Semana', 'Atrasadas', 'Concluídas'];

export default function TasksScreen() {
  const router = useRouter();
  const { data: tasks, isLoading } = useMyTasks();
  const [activeFilter, setActiveFilter] = useState('Todas');

  const renderHeader = () => (
    <View className="mb-4">
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={item => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setActiveFilter(item)}
            className={`px-4 py-2 rounded-full mr-2 border ${activeFilter === item ? 'bg-[#7C5AC2] border-[#7C5AC2]' : 'bg-transparent border-[#313136]'}`}
          >
            <Text className={`font-medium ${activeFilter === item ? 'text-[#fafafa]' : 'text-[#a1a1aa]'}`}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-[#111113] p-4">
      {renderHeader()}
      
      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TaskRow 
            task={item} 
            onPress={() => router.push(`/task/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState 
            icon={CheckCircle}
            title="Nenhuma tarefa encontrada"
            description="Você não tem tarefas nesta categoria."
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
