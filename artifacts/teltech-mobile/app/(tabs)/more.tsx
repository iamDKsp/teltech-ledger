import React from 'react';
import { View, Text, SectionList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  User, Settings, Users, Target, Calendar, 
  HelpCircle, LogOut, ChevronRight, Info
} from 'lucide-react-native';
import { useAuth } from '../../lib/auth';

interface MenuItem {
  id: string;
  title: string;
  icon: React.ElementType;
  action: () => void;
  destructive?: boolean;
}

interface MenuSection {
  title: string;
  data: MenuItem[];
}

export default function MoreScreen() {
  const { logout, user } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          }
        }
      ]
    );
  };

  const menuSections: MenuSection[] = [
    {
      title: 'Minha Conta',
      data: [
        { id: 'profile', title: 'Meu Perfil', icon: User, action: () => router.push('/profile') },
        { id: 'settings', title: 'Configurações', icon: Settings, action: () => router.push('/settings') },
      ]
    },
    {
      title: 'Empresa',
      data: [
        { id: 'goals', title: 'Metas e OKRs', icon: Target, action: () => router.push('/goals') },
        { id: 'members', title: 'Equipe e Membros', icon: Users, action: () => router.push('/members') },
        { id: 'meetings', title: 'Reuniões', icon: Calendar, action: () => router.push('/meetings') },
      ]
    },
    {
      title: 'Outros',
      data: [
        { id: 'help', title: 'Ajuda e Suporte', icon: HelpCircle, action: () => Alert.alert('Suporte', 'Central de ajuda em breve.') },
        { id: 'about', title: 'Sobre o App', icon: Info, action: () => Alert.alert('Teltech Ledger', 'Versão 1.0.0 (Build 42)\nAmbiente de Produção') },
        { id: 'logout', title: 'Sair', icon: LogOut, action: handleLogout, destructive: true },
      ]
    }
  ];

  const renderItem = ({ item, index, section }: { item: MenuItem, index: number, section: MenuSection }) => {
    const isFirst = index === 0;
    const isLast = index === section.data.length - 1;
    
    return (
      <TouchableOpacity
        className={`bg-[#2b2b2e] px-4 py-3 flex-row items-center justify-between
          ${isFirst ? 'rounded-t-xl' : ''} 
          ${isLast ? 'rounded-b-xl' : ''}
          ${!isLast ? 'border-b border-[#313136]' : ''}
        `}
        onPress={item.action}
      >
        <View className="flex-row items-center">
          <View className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${item.destructive ? 'bg-[#d44040]/10' : 'bg-[#36363c]'}`}>
            <item.icon size={18} color={item.destructive ? '#d44040' : '#fafafa'} />
          </View>
          <Text className={`text-base ${item.destructive ? 'text-[#d44040] font-semibold' : 'text-[#fafafa]'}`}>
            {item.title}
          </Text>
        </View>
        {!item.destructive && <ChevronRight size={20} color="#a1a1aa" />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#111113]" edges={['top']}>
      <View className="px-4 py-3 border-b border-[#313136]">
        <Text className="text-[#fafafa] text-2xl font-bold">Mais</Text>
      </View>

      <View className="p-4 flex-row items-center border-b border-[#313136] bg-[#111113]">
        <View className="w-14 h-14 bg-[#7C5AC2] rounded-full items-center justify-center mr-4">
          <Text className="text-[#fafafa] text-xl font-bold">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <View>
          <Text className="text-[#fafafa] text-lg font-bold">{user?.name || 'Usuário'}</Text>
          <Text className="text-[#a1a1aa]">{user?.email || 'usuario@email.com'}</Text>
        </View>
      </View>

      <SectionList
        sections={menuSections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <Text className="text-[#a1a1aa] text-sm font-semibold ml-2 mt-6 mb-2 uppercase tracking-wider">
            {title}
          </Text>
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}
