import React, { useState } from 'react';
import { View, Text, Switch, SectionList, TouchableOpacity, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

interface SettingItem {
  id: string;
  type: 'toggle' | 'link' | 'action' | 'info';
  title: string;
  value?: boolean | string;
  subtitle?: string;
  destructive?: boolean;
}

interface SettingSection {
  title: string;
  data: SettingItem[];
}

export default function SettingsScreen() {
  const [tasksNotif, setTasksNotif] = useState(true);
  const [approvalsNotif, setApprovalsNotif] = useState(true);
  const [messagesNotif, setMessagesNotif] = useState(false);
  const [haptic, setHaptic] = useState(true);

  const sections: SettingSection[] = [
    {
      title: 'Notificações',
      data: [
        { id: 'notif_tasks', type: 'toggle', title: 'Tarefas vencendo', value: tasksNotif },
        { id: 'notif_approvals', type: 'toggle', title: 'Aprovações financeiras', value: approvalsNotif },
        { id: 'notif_messages', type: 'toggle', title: 'Mensagens em canais', value: messagesNotif },
      ]
    },
    {
      title: 'Aparência',
      data: [
        { id: 'theme', type: 'info', title: 'Tema', value: 'Escuro' },
        { id: 'haptic', type: 'toggle', title: 'Haptic Feedback', value: haptic },
      ]
    },
    {
      title: 'Dados',
      data: [
        { id: 'clear_cache', type: 'action', title: 'Limpar Cache', destructive: true },
        { id: 'export_data', type: 'action', title: 'Exportar Dados' },
      ]
    },
    {
      title: 'Sobre',
      data: [
        { id: 'version', type: 'info', title: 'Versão', value: '1.0.0' },
        { id: 'developer', type: 'info', title: 'Desenvolvido por', value: 'Teltech' },
      ]
    }
  ];

  const handleToggle = (id: string, newValue: boolean) => {
    switch (id) {
      case 'notif_tasks': setTasksNotif(newValue); break;
      case 'notif_approvals': setApprovalsNotif(newValue); break;
      case 'notif_messages': setMessagesNotif(newValue); break;
      case 'haptic': setHaptic(newValue); break;
    }
  };

  const handleAction = (id: string) => {
    if (id === 'clear_cache') {
      Alert.alert(
        'Limpar Cache',
        'Tem certeza que deseja limpar o cache do aplicativo?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Limpar', style: 'destructive', onPress: () => Alert.alert('Sucesso', 'Cache limpo.') }
        ]
      );
    } else if (id === 'export_data') {
      Alert.alert('Exportar Dados', 'Preparando seus dados para exportação...');
    }
  };

  const renderItem = ({ item, index, section }: { item: SettingItem, index: number, section: SettingSection }) => {
    const isFirst = index === 0;
    const isLast = index === section.data.length - 1;

    let content;

    if (item.type === 'toggle') {
      content = (
        <>
          <Text className="text-base text-white">{item.title}</Text>
          <Switch
            value={item.value as boolean}
            onValueChange={(val) => handleToggle(item.id, val)}
            trackColor={{ false: '#36363c', true: '#7C5AC2' }}
            thumbColor="#fafafa"
          />
        </>
      );
    } else if (item.type === 'info') {
      content = (
        <>
          <Text className="text-base text-white">{item.title}</Text>
          <Text className="text-base text-[#a1a1aa]">{item.value as string}</Text>
        </>
      );
    } else {
      content = (
        <TouchableOpacity 
          className="flex-row justify-between items-center w-full"
          onPress={() => handleAction(item.id)}
        >
          <Text className={`text-base ${item.destructive ? 'text-[#d44040]' : 'text-white'}`}>
            {item.title}
          </Text>
          {!item.destructive && <ChevronRight size={20} color="#a1a1aa" />}
        </TouchableOpacity>
      );
    }

    return (
      <View className={`bg-[#2b2b2e] border-x border-[#313136] ${isFirst ? 'rounded-t-2xl border-t' : ''} ${isLast ? 'rounded-b-2xl border-b mb-6' : 'border-b border-b-[#313136]'}`}>
        <View className="flex-row items-center justify-between p-4 min-h-[56px]">
          {content}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#111113]">
      <Stack.Screen 
        options={{ 
          title: 'Configurações',
          headerStyle: { backgroundColor: '#111113' },
          headerTintColor: '#fafafa',
          headerTitleStyle: { fontWeight: 'bold' }
        }} 
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <Text className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-wider mb-2 ml-4 mt-2">
            {title}
          </Text>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}
