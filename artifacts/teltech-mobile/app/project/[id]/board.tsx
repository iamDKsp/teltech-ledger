import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, MoreHorizontal } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KanbanCard } from '../../../components/KanbanCard';
import { ColumnPicker } from '../../../components/ColumnPicker';
import { triggerSelectionHaptic } from '../../../lib/haptics';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width * 0.85;

// Mock Data
const INITIAL_COLUMNS = [
  {
    id: 'c1',
    title: 'A Fazer',
    tasks: [
      {
        id: 't1',
        title: 'Pesquisa de UX para Novo Dashboard',
        priority: 'normal' as const,
        tags: [{ label: 'Design', color: '#7C5AC2' }],
        assignees: [{ name: 'Ana Silva' }],
        dueDate: '24 Nov',
        commentCount: 2,
        attachmentCount: 0,
        subtaskProgress: { done: 1, total: 3 }
      },
      {
        id: 't2',
        title: 'Definir arquitetura de banco de dados',
        priority: 'high' as const,
        tags: [{ label: 'Backend', color: '#4080d6' }],
        assignees: [{ name: 'Carlos Souza' }, { name: 'Maria Oliveira' }],
        dueDate: '26 Nov',
        commentCount: 5,
        attachmentCount: 2,
      }
    ]
  },
  {
    id: 'c2',
    title: 'Em Progresso',
    tasks: [
      {
        id: 't3',
        title: 'Implementar autenticação Face ID',
        priority: 'urgent' as const,
        tags: [{ label: 'Feature', color: '#7C5AC2' }, { label: 'Segurança', color: '#4080d6' }],
        assignees: [{ name: 'João Silva' }],
        dueDate: '20 Nov',
        commentCount: 1,
        attachmentCount: 0,
        subtaskProgress: { done: 2, total: 4 }
      }
    ]
  },
  {
    id: 'c3',
    title: 'Concluído',
    tasks: [
      {
        id: 't4',
        title: 'Configurar repositório e CI/CD',
        priority: 'normal' as const,
        tags: [{ label: 'DevOps', color: '#27a06b' }],
        assignees: [{ name: 'Carlos Souza' }],
        dueDate: '15 Nov',
        commentCount: 0,
        attachmentCount: 1,
        subtaskProgress: { done: 5, total: 5 }
      }
    ]
  }
];

export default function KanbanBoardScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [columns, setColumns] = useState(INITIAL_COLUMNS);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<{taskId: string, sourceColumnId: string} | null>(null);

  const handleTaskPress = (taskId: string) => {
    router.push(`/task/${taskId}`);
  };

  const handleTaskLongPress = (taskId: string, columnId: string) => {
    triggerSelectionHaptic();
    setSelectedTask({ taskId, sourceColumnId: columnId });
    setPickerVisible(true);
  };

  const moveTask = (targetColumnId: string) => {
    if (!selectedTask || selectedTask.sourceColumnId === targetColumnId) {
      setPickerVisible(false);
      return;
    }

    setColumns(prevColumns => {
      const newColumns = [...prevColumns];
      
      const sourceColIndex = newColumns.findIndex(c => c.id === selectedTask.sourceColumnId);
      const targetColIndex = newColumns.findIndex(c => c.id === targetColumnId);
      
      if (sourceColIndex === -1 || targetColIndex === -1) return prevColumns;

      const sourceCol = { ...newColumns[sourceColIndex], tasks: [...newColumns[sourceColIndex].tasks] };
      const targetCol = { ...newColumns[targetColIndex], tasks: [...newColumns[targetColIndex].tasks] };

      const taskIndex = sourceCol.tasks.findIndex(t => t.id === selectedTask.taskId);
      if (taskIndex === -1) return prevColumns;

      const [taskToMove] = sourceCol.tasks.splice(taskIndex, 1);
      targetCol.tasks.push(taskToMove);

      newColumns[sourceColIndex] = sourceCol;
      newColumns[targetColIndex] = targetCol;

      return newColumns;
    });

    setPickerVisible(false);
    setSelectedTask(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#111113]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-4 border-b border-[#313136] flex-row justify-between items-center">
        <View>
          <Text className="text-white text-xl font-bold">Mobile App v3</Text>
          <Text className="text-[#a1a1aa] text-sm mt-1">3 colunas • 4 tarefas</Text>
        </View>
        <Pressable className="w-10 h-10 bg-[#2b2b2e] rounded-full items-center justify-center border border-[#313136]">
          <MoreHorizontal color="#a1a1aa" size={20} />
        </Pressable>
      </View>

      {/* Board */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        snapToInterval={COLUMN_WIDTH + 16}
        decelerationRate="fast"
      >
        {columns.map(col => (
          <View key={col.id} style={{ width: COLUMN_WIDTH }} className="bg-[#111113]">
            {/* Column Header */}
            <View className="flex-row justify-between items-center mb-4 px-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-white text-base font-semibold">{col.title}</Text>
                <View className="bg-[#2b2b2e] px-2 py-0.5 rounded-full border border-[#313136]">
                  <Text className="text-[#a1a1aa] text-xs font-medium">{col.tasks.length}</Text>
                </View>
              </View>
              <Pressable className="p-1">
                <Plus color="#a1a1aa" size={20} />
              </Pressable>
            </View>

            {/* Tasks */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {col.tasks.map(task => (
                <KanbanCard
                  key={task.id}
                  {...task}
                  onPress={() => handleTaskPress(task.id)}
                  onLongPress={() => handleTaskLongPress(task.id, col.id)}
                />
              ))}
              
              {/* Add Task Button */}
              <Pressable className="mt-2 py-4 rounded-xl border border-dashed border-[#313136] items-center justify-center bg-[#2b2b2e]/30">
                <View className="flex-row items-center gap-2">
                  <Plus color="#a1a1aa" size={16} />
                  <Text className="text-[#a1a1aa] font-medium">Adicionar Tarefa</Text>
                </View>
              </Pressable>
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* FAB */}
      <Pressable 
        className="absolute bottom-6 right-6 w-14 h-14 bg-[#7C5AC2] rounded-full items-center justify-center shadow-lg shadow-[#7C5AC2]/30"
      >
        <Plus color="white" size={24} />
      </Pressable>

      {/* Column Picker Modal */}
      <ColumnPicker
        visible={pickerVisible}
        columns={columns.map(c => ({ id: c.id, title: c.title }))}
        currentColumnId={selectedTask?.sourceColumnId || ''}
        onSelect={moveTask}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
}
