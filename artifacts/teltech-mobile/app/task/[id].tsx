import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, CheckCircle2, Circle, MessageSquare, Play, Square, Plus, X } from 'lucide-react-native';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../lib/haptics';

// Mock Data
const MOCK_TASK = {
  id: '1',
  title: 'Implementar autenticação Face ID',
  status: 'Em Progresso',
  description: 'Adicionar suporte a Face ID e Touch ID na tela de login utilizando a biblioteca expo-local-authentication. O usuário deve ser questionado se deseja habilitar após o primeiro login bem-sucedido.',
  priority: 'high',
  projectName: 'Teltech Mobile v3',
  dueDate: '2023-11-20',
  assignee: { name: 'João Silva', avatar: null },
  subtasks: [
    { id: 's1', title: 'Instalar expo-local-authentication', completed: true },
    { id: 's2', title: 'Criar funções de helper (isBiometricAvailable, etc)', completed: true },
    { id: 's3', title: 'Adicionar botão na tela de Login', completed: false },
    { id: 's4', title: 'Salvar preferência no SecureStore', completed: false },
  ],
  tags: [
    { label: 'Feature', color: '#7C5AC2' },
    { label: 'Segurança', color: '#4080d6' }
  ],
  comments: [
    { id: 'c1', user: 'Maria Oliveira', date: 'Ontem, 14:30', text: 'Podemos usar o ícone do lucide-react-native para isso.' }
  ],
  estimatedHours: 8,
};

const PRIORITY_COLORS = {
  low: '#4080d6',
  normal: '#a1a1aa',
  high: '#f59e0b',
  urgent: '#d44040',
};

const PRIORITY_LABELS = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [subtasks, setSubtasks] = useState(MOCK_TASK.subtasks);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(3600 * 2 + 15 * 60); // 2h 15m
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const toggleSubtask = (id: string) => {
    triggerLightHaptic();
    setSubtasks(prev => prev.map(st => 
      st.id === id ? { ...st, completed: !st.completed } : st
    ));
  };

  const toggleTimer = () => {
    if (!isTimerRunning) triggerSuccessHaptic();
    else triggerLightHaptic();
    
    setIsTimerRunning(!isTimerRunning);
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const completedCount = subtasks.filter(st => st.completed).length;
  const progressPercent = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  return (
    <SafeAreaView className="flex-1 bg-[#111113] relative">
      <KeyboardAvoidingView 
        className="flex-1" 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#313136]">
          <View className="bg-[#7C5AC2]/20 px-3 py-1 rounded-full border border-[#7C5AC2]/30">
            <Text className="text-[#7C5AC2] text-xs font-semibold">{MOCK_TASK.status}</Text>
          </View>
          <Pressable 
            onPress={() => router.back()}
            className="w-8 h-8 bg-[#2b2b2e] rounded-full items-center justify-center border border-[#313136]"
          >
            <X size={18} color="#a1a1aa" />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          {/* Title */}
          <Text className="text-white text-2xl font-bold mb-6">
            {MOCK_TASK.title}
          </Text>

          {/* Metadata Grid */}
          <View className="bg-[#2b2b2e] rounded-2xl p-4 border border-[#313136] mb-6 flex-row flex-wrap">
            <View className="w-1/2 mb-4">
              <Text className="text-[#a1a1aa] text-xs mb-1">Responsável</Text>
              <View className="flex-row items-center gap-2">
                <View className="w-6 h-6 bg-[#36363c] rounded-full items-center justify-center">
                  <Text className="text-white text-[10px] font-bold">
                    {MOCK_TASK.assignee.name.charAt(0)}
                  </Text>
                </View>
                <Text className="text-white text-sm">{MOCK_TASK.assignee.name}</Text>
              </View>
            </View>

            <View className="w-1/2 mb-4">
              <Text className="text-[#a1a1aa] text-xs mb-1">Data de Entrega</Text>
              <View className="flex-row items-center gap-2">
                <Calendar size={14} color="#a1a1aa" />
                <Text className="text-white text-sm">{MOCK_TASK.dueDate}</Text>
              </View>
            </View>

            <View className="w-1/2">
              <Text className="text-[#a1a1aa] text-xs mb-1">Prioridade</Text>
              <View className="flex-row items-center gap-2">
                <View 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: PRIORITY_COLORS[MOCK_TASK.priority as keyof typeof PRIORITY_COLORS] }} 
                />
                <Text className="text-white text-sm">
                  {PRIORITY_LABELS[MOCK_TASK.priority as keyof typeof PRIORITY_LABELS]}
                </Text>
              </View>
            </View>

            <View className="w-1/2">
              <Text className="text-[#a1a1aa] text-xs mb-1">Projeto</Text>
              <View className="flex-row items-center gap-2">
                <View className="w-2 h-2 rounded-full bg-[#27a06b]" />
                <Text className="text-white text-sm">{MOCK_TASK.projectName}</Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View className="mb-8">
            <Text className="text-white text-lg font-semibold mb-3">Descrição</Text>
            <Text className="text-[#a1a1aa] text-base leading-6">
              {MOCK_TASK.description}
            </Text>
          </View>

          {/* Timer */}
          <View className="mb-8">
            <Text className="text-white text-lg font-semibold mb-3">Cronômetro</Text>
            <View className="bg-[#2b2b2e] rounded-2xl p-5 border border-[#313136] flex-row items-center justify-between">
              <View>
                <Text className="text-[#a1a1aa] text-sm mb-1">Tempo Registrado</Text>
                <Text className="text-white text-3xl font-bold font-mono tracking-wider">
                  {formatTime(elapsedSeconds)}
                </Text>
                <Text className="text-[#a1a1aa] text-xs mt-1">Estimativa: {MOCK_TASK.estimatedHours}h</Text>
              </View>
              
              <Pressable 
                onPress={toggleTimer}
                className={`w-16 h-16 rounded-full items-center justify-center shadow-lg ${
                  isTimerRunning ? 'bg-[#d44040]' : 'bg-[#27a06b]'
                }`}
              >
                {isTimerRunning ? (
                  <Square size={24} color="white" fill="white" />
                ) : (
                  <Play size={24} color="white" fill="white" style={{ marginLeft: 4 }} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Subtasks */}
          <View className="mb-8">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-white text-lg font-semibold">Subtarefas</Text>
              <Text className="text-[#a1a1aa] text-sm">{completedCount}/{subtasks.length}</Text>
            </View>
            
            <View className="h-2 bg-[#2b2b2e] rounded-full overflow-hidden mb-4 border border-[#313136]">
              <View 
                className="h-full bg-[#27a06b] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </View>

            <View className="space-y-3 gap-3">
              {subtasks.map(st => (
                <Pressable 
                  key={st.id}
                  onPress={() => toggleSubtask(st.id)}
                  className="flex-row items-center gap-3 bg-[#2b2b2e] p-3 rounded-xl border border-[#313136]"
                >
                  {st.completed ? (
                    <CheckCircle2 size={22} color="#27a06b" />
                  ) : (
                    <Circle size={22} color="#a1a1aa" />
                  )}
                  <Text className={`flex-1 text-base ${st.completed ? 'text-[#a1a1aa] line-through' : 'text-white'}`}>
                    {st.title}
                  </Text>
                </Pressable>
              ))}
              
              <Pressable className="flex-row items-center gap-2 p-3 mt-1">
                <Plus size={20} color="#7C5AC2" />
                <Text className="text-[#7C5AC2] font-medium">Adicionar Subtarefa</Text>
              </Pressable>
            </View>
          </View>

          {/* Tags */}
          <View className="mb-8">
            <Text className="text-white text-lg font-semibold mb-3">Tags</Text>
            <View className="flex-row flex-wrap gap-2">
              {MOCK_TASK.tags.map((tag, idx) => (
                <View 
                  key={idx}
                  className="px-3 py-1.5 rounded-lg border"
                  style={{ backgroundColor: `${tag.color}20`, borderColor: `${tag.color}40` }}
                >
                  <Text style={{ color: tag.color }} className="font-medium">{tag.label}</Text>
                </View>
              ))}
              <Pressable className="px-3 py-1.5 rounded-lg border border-dashed border-[#a1a1aa] items-center justify-center">
                <Text className="text-[#a1a1aa] font-medium">+ Adicionar</Text>
              </Pressable>
            </View>
          </View>

          {/* Comments */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">Comentários</Text>
            <View className="space-y-4 gap-4">
              {MOCK_TASK.comments.map(c => (
                <View key={c.id} className="flex-row gap-3">
                  <View className="w-8 h-8 bg-[#36363c] rounded-full items-center justify-center">
                    <Text className="text-white text-xs font-bold">{c.user.charAt(0)}</Text>
                  </View>
                  <View className="flex-1 bg-[#2b2b2e] rounded-2xl rounded-tl-none p-3 border border-[#313136]">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-white font-medium text-sm">{c.user}</Text>
                      <Text className="text-[#a1a1aa] text-xs">{c.date}</Text>
                    </View>
                    <Text className="text-[#a1a1aa] text-sm">{c.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Comment Input */}
        <View className="absolute bottom-0 left-0 right-0 bg-[#111113] border-t border-[#313136] p-4 flex-row items-center gap-3">
          <View className="flex-1 bg-[#232326] rounded-full border border-[#313136] px-4 py-2 flex-row items-center">
            <MessageSquare size={18} color="#a1a1aa" className="mr-2" />
            <TextInput
              className="flex-1 text-white py-1"
              placeholder="Adicionar comentário..."
              placeholderTextColor="#a1a1aa"
              value={newComment}
              onChangeText={setNewComment}
            />
          </View>
          <Pressable 
            className={`w-10 h-10 rounded-full items-center justify-center ${newComment.trim() ? 'bg-[#7C5AC2]' : 'bg-[#2b2b2e]'}`}
          >
            <Plus size={20} color={newComment.trim() ? "white" : "#a1a1aa"} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
