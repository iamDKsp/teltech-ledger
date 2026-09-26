import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar, Clock, MapPin, Link } from 'lucide-react-native';

export interface Participant {
  name: string;
  initials: string;
}

export interface MeetingCardProps {
  title: string;
  date: string;
  time: string;
  duration: string;
  location?: string;
  participants: Participant[];
  color?: string;
  isPast?: boolean;
}

export function MeetingCard({
  title,
  date,
  time,
  duration,
  location,
  participants,
  color = '#7C5AC2',
  isPast = false
}: MeetingCardProps) {
  const opacityClass = isPast ? 'opacity-50' : 'opacity-100';

  return (
    <TouchableOpacity className={`bg-[#2b2b2e] border border-[#313136] rounded-2xl mb-4 overflow-hidden active:opacity-80 flex-row ${opacityClass}`}>
      {/* Accent Bar */}
      <View style={{ backgroundColor: color, width: 4 }} />
      
      <View className="p-4 flex-1">
        <View className="flex-row justify-between items-start mb-2">
          <Text className="text-lg font-bold text-white flex-1 mr-2">{title}</Text>
          <View className="bg-[#36363c] px-2 py-1 rounded-md">
            <Text className="text-xs text-[#fafafa] font-medium">{duration}</Text>
          </View>
        </View>

        <View className="flex-row items-center mb-3 space-x-4">
          <View className="flex-row items-center mr-4">
            <Calendar size={14} color="#a1a1aa" className="mr-1.5" />
            <Text className="text-sm text-[#a1a1aa]">{date}</Text>
          </View>
          <View className="flex-row items-center">
            <Clock size={14} color="#a1a1aa" className="mr-1.5" />
            <Text className="text-sm text-[#a1a1aa]">{time}</Text>
          </View>
        </View>

        {location && (
          <View className="flex-row items-center mb-4">
            {location.includes('http') ? (
              <Link size={14} color="#4080d6" className="mr-1.5" />
            ) : (
              <MapPin size={14} color="#a1a1aa" className="mr-1.5" />
            )}
            <Text className={`text-sm ${location.includes('http') ? 'text-[#4080d6]' : 'text-[#a1a1aa]'}`} numberOfLines={1}>
              {location}
            </Text>
          </View>
        )}

        {/* Participants Cluster */}
        {participants.length > 0 && (
          <View className="flex-row items-center mt-1">
            <View className="flex-row relative">
              {participants.slice(0, 4).map((p, i) => (
                <View 
                  key={i} 
                  className="w-8 h-8 rounded-full bg-[#36363c] border-2 border-[#2b2b2e] items-center justify-center"
                  style={{ marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }}
                >
                  <Text className="text-xs font-bold text-white">{p.initials}</Text>
                </View>
              ))}
              {participants.length > 4 && (
                <View 
                  className="w-8 h-8 rounded-full bg-[#111113] border-2 border-[#2b2b2e] items-center justify-center"
                  style={{ marginLeft: -10, zIndex: 5 }}
                >
                  <Text className="text-[10px] font-bold text-[#a1a1aa]">+{participants.length - 4}</Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-[#a1a1aa] ml-3">
              {participants.length} {participants.length === 1 ? 'participante' : 'participantes'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
