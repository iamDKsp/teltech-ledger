import React from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { triggerLightHaptic } from '../lib/haptics';

type Column = {
  id: string;
  title: string;
};

type Props = {
  visible: boolean;
  columns: Column[];
  currentColumnId: string;
  onSelect: (columnId: string) => void;
  onClose: () => void;
};

export function ColumnPicker({ visible, columns, currentColumnId, onSelect, onClose }: Props) {
  const handleSelect = (id: string) => {
    triggerLightHaptic();
    onSelect(id);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <Pressable className="absolute inset-0" onPress={onClose} />
        
        <View className="bg-[#111113] rounded-t-3xl pt-6 pb-10 px-4 border-t border-[#313136]">
          <View className="w-12 h-1.5 bg-[#313136] rounded-full self-center mb-6" />
          
          <Text className="text-white text-lg font-semibold mb-4 px-2">
            Mover para...
          </Text>
          
          <View className="bg-[#2b2b2e] rounded-xl overflow-hidden border border-[#313136]">
            {columns.map((col, index) => {
              const isSelected = col.id === currentColumnId;
              
              return (
                <Pressable
                  key={col.id}
                  className={`flex-row items-center justify-between p-4 ${
                    index < columns.length - 1 ? 'border-b border-[#313136]' : ''
                  }`}
                  onPress={() => handleSelect(col.id)}
                >
                  <Text className={`text-base ${isSelected ? 'text-[#7C5AC2] font-semibold' : 'text-white'}`}>
                    {col.title}
                  </Text>
                  {isSelected && (
                    <Check size={20} color="#7C5AC2" />
                  )}
                </Pressable>
              );
            })}
          </View>
          
          <Pressable 
            className="mt-4 p-4 rounded-xl bg-[#2b2b2e] items-center"
            onPress={onClose}
          >
            <Text className="text-[#a1a1aa] text-base font-medium">Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
