import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, Building2, CreditCard, Check, X } from 'lucide-react-native';
import { TransactionRow } from '../../components/TransactionRow';
import { useAuth } from '../../lib/auth';

// Mock Data
const MOCK_MONTHS = [
  'Julho 2026', 'Agosto 2026', 'Setembro 2026', 'Outubro 2026'
];

const MOCK_SUMMARY = {
  mrr: 145000,
  balance: 320500.45,
  burnRate: 42000,
  runway: 7.6
};

const MOCK_ACCOUNTS = [
  { id: '1', name: 'Itaú PJ', type: 'bank', balance: 250000.00 },
  { id: '2', name: 'Cora - Operacional', type: 'bank', balance: 45500.45 },
  { id: '3', name: 'Cartão Corporativo', type: 'credit', balance: -15400.00 }
];

const MOCK_TRANSACTIONS = [
  { id: 't1', type: 'inflow' as const, description: 'Assinaturas - Stripe', category: 'Receita', amount: 45000, date: '26 Set 2026', status: 'paid' as const },
  { id: 't2', type: 'outflow' as const, description: 'AWS Cloud Services', category: 'Infraestrutura', amount: 4200.50, date: '25 Set 2026', status: 'paid' as const },
  { id: 't3', type: 'outflow' as const, description: 'Folha de Pagamento', category: 'RH', amount: 85000, date: '05 Out 2026', status: 'pending' as const },
  { id: 't4', type: 'inflow' as const, description: 'Consultoria Cliente X', category: 'Serviços', amount: 15000, date: '20 Set 2026', status: 'overdue' as const },
];

const MOCK_APPROVALS = [
  { id: 'a1', description: 'Reembolso Viagem SP', amount: 2450.00, requester: 'João Silva' },
];

export default function FinanceScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [monthIndex, setMonthIndex] = useState(2); // Setembro 2026

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const prevMonth = () => setMonthIndex(Math.max(0, monthIndex - 1));
  const nextMonth = () => setMonthIndex(Math.min(MOCK_MONTHS.length - 1, monthIndex + 1));

  return (
    <SafeAreaView className="flex-1 bg-[#111113]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 flex-row items-center justify-between border-b border-[#313136]">
        <Text className="text-[#fafafa] text-2xl font-bold">Financeiro</Text>
        <TouchableOpacity className="w-10 h-10 rounded-full bg-[#7C5AC2] items-center justify-center">
          <Plus color="#fafafa" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C5AC2" />}
      >
        {/* Month Selector */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity onPress={prevMonth} className="p-2">
            <ChevronLeft color="#fafafa" size={24} />
          </TouchableOpacity>
          <Text className="text-[#fafafa] text-lg font-bold">{MOCK_MONTHS[monthIndex]}</Text>
          <TouchableOpacity onPress={nextMonth} className="p-2">
            <ChevronRight color="#fafafa" size={24} />
          </TouchableOpacity>
        </View>

        {/* Top Summary Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 mb-6" contentContainerStyle={{ paddingRight: 32 }}>
          <View className="bg-[#2b2b2e] p-4 rounded-xl border border-[#313136] mr-3 w-40">
            <Text className="text-[#a1a1aa] text-sm mb-1">MRR</Text>
            <Text className="text-[#27a06b] text-xl font-bold">{formatCurrency(MOCK_SUMMARY.mrr)}</Text>
          </View>
          <View className="bg-[#2b2b2e] p-4 rounded-xl border border-[#313136] mr-3 w-40">
            <Text className="text-[#a1a1aa] text-sm mb-1">Saldo Total</Text>
            <Text className="text-[#4080d6] text-xl font-bold">{formatCurrency(MOCK_SUMMARY.balance)}</Text>
          </View>
          <View className="bg-[#2b2b2e] p-4 rounded-xl border border-[#313136] mr-3 w-40">
            <Text className="text-[#a1a1aa] text-sm mb-1">Burn Rate</Text>
            <Text className="text-[#d44040] text-xl font-bold">{formatCurrency(MOCK_SUMMARY.burnRate)}</Text>
          </View>
          <View className="bg-[#2b2b2e] p-4 rounded-xl border border-[#313136] mr-3 w-40">
            <Text className="text-[#a1a1aa] text-sm mb-1">Runway</Text>
            <Text className="text-[#7C5AC2] text-xl font-bold">{MOCK_SUMMARY.runway} meses</Text>
          </View>
        </ScrollView>

        {/* Resumo do Mês */}
        <View className="px-4 mb-6">
          <Text className="text-[#fafafa] text-lg font-bold mb-3">Resumo do Mês</Text>
          <View className="bg-[#2b2b2e] rounded-xl border border-[#313136] p-4">
            <View className="flex-row justify-between items-center py-2 border-b border-[#313136]">
              <Text className="text-[#a1a1aa]">Entradas</Text>
              <Text className="text-[#27a06b] font-semibold">{formatCurrency(125000)}</Text>
            </View>
            <View className="flex-row justify-between items-center py-2 border-b border-[#313136]">
              <Text className="text-[#a1a1aa]">Saídas</Text>
              <Text className="text-[#d44040] font-semibold">{formatCurrency(98000)}</Text>
            </View>
            <View className="flex-row justify-between items-center py-2 mt-1">
              <Text className="text-[#fafafa] font-bold">Resultado</Text>
              <Text className="text-[#27a06b] font-bold text-lg">{formatCurrency(27000)}</Text>
            </View>
          </View>
        </View>

        {/* Aprovações Pendentes */}
        {MOCK_APPROVALS.length > 0 && (
          <View className="px-4 mb-6">
            <Text className="text-[#fafafa] text-lg font-bold mb-3">Aprovações Pendentes</Text>
            {MOCK_APPROVALS.map(app => (
              <View key={app.id} className="bg-[#2b2b2e] rounded-xl border border-[#d44040]/50 p-4 mb-3">
                <Text className="text-[#fafafa] font-bold mb-1">{app.description}</Text>
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-[#a1a1aa] text-sm">Solicitante: {app.requester}</Text>
                  <Text className="text-[#fafafa] font-bold">{formatCurrency(app.amount)}</Text>
                </View>
                <View className="flex-row gap-x-3">
                  <TouchableOpacity className="flex-1 bg-[#27a06b] flex-row items-center justify-center py-2 rounded-lg">
                    <Check color="#fff" size={16} className="mr-2" />
                    <Text className="text-white font-semibold">Aprovar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-1 bg-[#d44040]/20 border border-[#d44040] flex-row items-center justify-center py-2 rounded-lg">
                    <X color="#d44040" size={16} className="mr-2" />
                    <Text className="text-[#d44040] font-semibold">Rejeitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Contas Bancárias */}
        <View className="px-4 mb-6">
          <Text className="text-[#fafafa] text-lg font-bold mb-3">Contas Bancárias</Text>
          {MOCK_ACCOUNTS.map(acc => (
            <TouchableOpacity key={acc.id} className="bg-[#2b2b2e] rounded-xl border border-[#313136] p-4 mb-3 flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-[#36363c] items-center justify-center mr-4">
                {acc.type === 'bank' ? <Building2 color="#a1a1aa" size={24} /> : <CreditCard color="#a1a1aa" size={24} />}
              </View>
              <View className="flex-1">
                <Text className="text-[#fafafa] font-semibold mb-1">{acc.name}</Text>
                <Text className="text-[#a1a1aa] text-sm">Saldo atual</Text>
              </View>
              <Text className={`font-bold text-lg ${acc.balance < 0 ? 'text-[#d44040]' : 'text-[#fafafa]'}`}>
                {formatCurrency(acc.balance)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Últimas Transações */}
        <View className="px-4 mb-8">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-[#fafafa] text-lg font-bold">Últimas Transações</Text>
            <TouchableOpacity>
              <Text className="text-[#7C5AC2] font-semibold">Ver todas</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-[#2b2b2e] rounded-xl border border-[#313136] p-2">
            {MOCK_TRANSACTIONS.map((t) => (
              <View key={t.id}>
                <TransactionRow {...t} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
