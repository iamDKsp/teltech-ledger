import React from 'react';
import { View, Text } from 'react-native';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react-native';

interface TransactionRowProps {
  type: 'inflow' | 'outflow';
  description: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'overdue';
  category?: string;
}

export function TransactionRow({ type, description, amount, date, status, category }: TransactionRowProps) {
  const isInflow = type === 'inflow';
  const amountColor = isInflow ? 'text-[#27a06b]' : 'text-[#d44040]';
  const Icon = isInflow ? ArrowUpRight : ArrowDownRight;
  const iconColor = isInflow ? '#27a06b' : '#d44040';
  
  const getStatusDisplay = () => {
    switch(status) {
      case 'paid': return { text: 'Pago', bg: 'bg-[#27a06b]/20', color: 'text-[#27a06b]' };
      case 'pending': return { text: 'Pendente', bg: 'bg-[#eab308]/20', color: 'text-[#eab308]' };
      case 'overdue': return { text: 'Atrasado', bg: 'bg-[#d44040]/20', color: 'text-[#d44040]' };
    }
  };
  
  const statusDisplay = getStatusDisplay();
  
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-[#313136]">
      <View className="flex-row items-center flex-1">
        <View className={`w-10 h-10 rounded-full items-center justify-center ${isInflow ? 'bg-[#27a06b]/20' : 'bg-[#d44040]/20'} mr-3`}>
          <Icon size={20} color={iconColor} />
        </View>
        <View className="flex-1 mr-2">
          <Text className="text-[#fafafa] font-semibold text-base" numberOfLines={1}>{description}</Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-[#a1a1aa] text-xs mr-2">{date}</Text>
            {category && <Text className="text-[#a1a1aa] text-xs" numberOfLines={1}>• {category}</Text>}
          </View>
        </View>
      </View>
      
      <View className="items-end">
        <Text className={`font-bold text-base ${amountColor}`}>{isInflow ? '+' : '-'}{formattedAmount}</Text>
        <View className={`mt-1 px-2 py-0.5 rounded ${statusDisplay.bg}`}>
          <Text className={`text-[10px] font-bold uppercase ${statusDisplay.color}`}>
            {statusDisplay.text}
          </Text>
        </View>
      </View>
    </View>
  );
}
