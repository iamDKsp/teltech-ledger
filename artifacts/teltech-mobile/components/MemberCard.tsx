import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Mail, Phone } from 'lucide-react-native';

export interface MemberCardProps {
  name: string;
  email: string;
  role: string;
  avatarUri?: string;
  phone?: string;
  tagline?: string;
  isFounder?: boolean;
}

export function MemberCard({ name, email, role, avatarUri, phone, tagline, isFounder }: MemberCardProps) {
  const getRoleColor = (roleStr: string) => {
    switch (roleStr.toLowerCase()) {
      case 'ceo': return 'bg-[#7C5AC2]';
      case 'cto': return 'bg-[#27a06b]';
      case 'cmo': return 'bg-[#4080d6]';
      case 'admin': return 'bg-[#f59e0b]';
      default: return 'bg-[#a1a1aa]';
    }
  };

  const getInitials = (n: string) => {
    return n.substring(0, 2).toUpperCase();
  };

  if (isFounder) {
    return (
      <TouchableOpacity className="bg-[#2b2b2e] border border-[#313136] rounded-2xl p-5 mb-4 overflow-hidden active:opacity-80">
        <View className="flex-row items-center mb-4">
          <View className="w-16 h-16 rounded-full bg-[#36363c] border border-[#313136] items-center justify-center mr-4">
            <Text className="text-xl font-bold text-white">{getInitials(name)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-white mb-1">{name}</Text>
            <View className="self-start px-2 py-1 rounded-md bg-[#36363c]">
              <Text className="text-xs font-semibold text-[#fafafa]">{role}</Text>
            </View>
          </View>
          <View className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl rounded-tr-xl ${getRoleColor(role)}`}>
            <Text className="text-xs font-bold text-white">{role}</Text>
          </View>
        </View>
        
        {tagline && (
          <Text className="text-sm font-medium text-[#a1a1aa] italic mb-4">"{tagline}"</Text>
        )}
        
        <View className="space-y-2 mt-2 border-t border-[#313136] pt-3">
          <View className="flex-row items-center">
            <Mail size={16} color="#a1a1aa" className="mr-2" />
            <Text className="text-sm text-[#a1a1aa]">{email}</Text>
          </View>
          {phone && (
            <View className="flex-row items-center">
              <Phone size={16} color="#a1a1aa" className="mr-2" />
              <Text className="text-sm text-[#a1a1aa]">{phone}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity className="flex-row items-center bg-[#2b2b2e] border border-[#313136] rounded-xl p-3 mb-3 active:opacity-80">
      <View className="w-12 h-12 rounded-full bg-[#36363c] items-center justify-center mr-3">
        <Text className="text-lg font-bold text-white">{getInitials(name)}</Text>
      </View>
      <View className="flex-1 justify-center">
        <Text className="text-base font-semibold text-white">{name}</Text>
        <Text className="text-sm text-[#a1a1aa]">{email}</Text>
      </View>
      <View className={`px-2 py-1 rounded-md ${getRoleColor(role)} opacity-80`}>
        <Text className="text-xs font-medium text-white">{role}</Text>
      </View>
    </TouchableOpacity>
  );
}
